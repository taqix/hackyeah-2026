import { describe, expect, it, vi } from 'vitest';
import {
  Encoder,
  Profile,
  type FileIdMesg,
  type SessionMesg,
  type RecordMesg,
} from '@garmin/fitsdk';
import {
  CorosMcpClient,
  CorosAdapter,
  toolSchemaHash,
  importActivityFit,
  normalizeHealthKitSample,
  summarizeSleepSegments,
  observationSeriesKey,
} from '../dist/index.js';
import { connection, event, now, request } from './fixtures.js';

const tool = {
  name: 'querySportRecords',
  inputSchema: {
    type: 'object',
    properties: { day: { type: 'string' } },
    required: ['day'],
    additionalProperties: false,
  },
};
const client = (http: typeof fetch) =>
  new CorosMcpClient({
    connection_id: 'connection',
    endpoint: 'https://mcpeu.coros.com/mcp',
    getAccessToken: async () => 'synthetic-token',
    fetch: http,
  });
const response = (id: unknown, result: unknown) => Response.json({ jsonrpc: '2.0', id, result });

describe('COROS transport (synthetic JSON-RPC, not vendor data fixtures)', () => {
  it('discovers every catalog page and matches an SSE response by ID', async () => {
    let lists = 0;
    const http: typeof fetch = async (_url, init) => {
      expect(init?.redirect).toBe('error');
      const { id, method, params } = JSON.parse(String(init?.body));
      if (method === 'initialize')
        return response(id, { protocolVersion: '2025-06-18', capabilities: { tools: {} } });
      if (method === 'tools/list') {
        lists += 1;
        return response(
          id,
          lists === 1
            ? { tools: [tool], nextCursor: 'next' }
            : { tools: [{ name: 'writePlan', inputSchema: {} }] },
        );
      }
      expect(params.arguments).toEqual({ day: '2026-10-03' });
      return new Response(
        [
          `data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notification' })}`,
          `data: ${JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '{"synthetic":true}' }] } })}`,
          `data: ${JSON.stringify({ jsonrpc: '2.0', id: 'other', result: { incorrect: true } })}`,
        ].join('\r\n\r\n'),
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    };
    const mcp = client(http);
    const catalog = await mcp.discover();
    expect(catalog).toHaveLength(2);
    expect(await mcp.call(tool, toolSchemaHash(tool), { day: '2026-10-03' })).toEqual({
      synthetic: true,
    });
    await expect(mcp.call(catalog[1]!, toolSchemaHash(catalog[1]!), {})).rejects.toMatchObject({
      code: 'unsupported',
    });
  });
  it('fences schema changes and invalid arguments before making a call', async () => {
    const http = vi.fn<typeof fetch>();
    const mcp = client(http);
    await expect(mcp.call(tool, 'old-hash', { day: 'x' })).rejects.toMatchObject({
      code: 'schema_changed',
    });
    await expect(mcp.call(tool, toolSchemaHash(tool), { inventedField: 1 })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(http).not.toHaveBeenCalled();
  });
  it.each(['rpc_error', 'tool_error', 'wrong_id', 'html', 'prose'])(
    'rejects %s without exposing response content',
    async (failure) => {
      const mcp = client(async (_url, init) => {
        const { id } = JSON.parse(String(init?.body));
        if (failure === 'rpc_error')
          return Response.json({ jsonrpc: '2.0', id, error: { message: 'secret-health-data' } });
        if (failure === 'wrong_id') return response('wrong', {});
        if (failure === 'html')
          return new Response('secret-health-data', { headers: { 'Content-Type': 'text/html' } });
        return response(
          id,
          failure === 'tool_error'
            ? { isError: true, content: [] }
            : { content: [{ type: 'text', text: 'secret-health-data' }] },
        );
      });
      await expect(mcp.call(tool, toolSchemaHash(tool), { day: 'x' })).rejects.toMatchObject({
        message: 'invalid_response',
      });
    },
  );
  it('reports a rate limit and rejects unapproved endpoints', async () => {
    const mcp = client(
      async () => new Response(null, { status: 429, headers: { 'Retry-After': '123' } }),
    );
    await expect(mcp.call(tool, toolSchemaHash(tool), { day: 'x' })).rejects.toMatchObject({
      code: 'rate_limited',
      retry_after_seconds: 123,
    });
    expect(
      () =>
        new CorosMcpClient({
          connection_id: 'c',
          endpoint: 'https://attacker.invalid/mcp',
          getAccessToken: async () => 'secret',
        }),
    ).toThrow('invalid_input');
  });
  it('enforces expanded response limits', async () => {
    const mcp = new CorosMcpClient({
      connection_id: 'c',
      endpoint: 'https://mcp.coros.com/mcp',
      max_response_bytes: 8,
      getAccessToken: async () => 'token',
      fetch: async () => Response.json({ too: 'large' }),
    });
    await expect(mcp.call(tool, toolSchemaHash(tool), { day: 'x' })).rejects.toMatchObject({
      code: 'too_large',
    });
  });
  it('requires a reviewed mapper and a connection-bound client', async () => {
    const mcp = client(async (_url, init) => {
      const { id, method } = JSON.parse(String(init?.body));
      if (method === 'initialize')
        return response(id, { protocolVersion: '2025-06-18', capabilities: { tools: {} } });
      if (method === 'tools/list') return response(id, { tools: [tool] });
      return response(id, { structuredContent: { synthetic_fixture: true } });
    });
    const adapter = new CorosAdapter(mcp, 'synthetic-v1', [
      {
        dataset: 'workouts',
        tool: 'querySportRecords',
        schema_hash: toolSchemaHash(tool),
        arguments: () => ({ day: '2026-10-03' }),
        decode: (output) => {
          expect(output).toEqual({ synthetic_fixture: true });
          return {
            events: [],
            next_cursor: null,
            completeness: 'unknown',
            empty_availability: 'unknown',
          };
        },
      },
    ]);
    const context = { connection: connection(), request, cursor: null };
    expect((await adapter.fetch(context)).completeness).toBe('unknown');
    await expect(
      adapter.fetch({ ...context, connection: connection({ id: 'someone-else' }) }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

function syntheticFit(type: 'activity' | 'workout' = 'activity') {
  const encoder = new Encoder();
  const fileMessage: FileIdMesg = {
    type,
    manufacturer: 'development',
    product: 1,
    timeCreated: new Date('2026-10-02T10:00:00Z'),
  };
  encoder.onMesg(Profile.MesgNum.FILE_ID!, fileMessage);
  const sessionMessage: SessionMesg = {
    messageIndex: 0,
    startTime: new Date('2026-10-02T10:00:00Z'),
    sport: 'running',
    totalElapsedTime: 600,
    totalTimerTime: 550,
    totalDistance: 1234.5,
  };
  encoder.onMesg(Profile.MesgNum.SESSION!, sessionMessage);
  const recordMessage: RecordMesg = {
    timestamp: new Date('2026-10-02T10:00:00Z'),
    positionLat: 50000,
    positionLong: 20000,
    heartRate: 120,
  };
  encoder.onMesg(Profile.MesgNum.RECORD!, recordMessage);
  return encoder.close();
}
const fitContext = {
  connection_id: 'manual',
  connection_generation: 1,
  provider: 'garmin' as const,
  import_id: 'upload-1',
  observed_at: now,
};

describe('manual FIT import in an isolated worker', () => {
  it('validates binary CRC, maps labelled units, and discards location/sensor data', async () => {
    const events = await importActivityFit(syntheticFit(), fitContext);
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({
      elapsed_seconds: 600,
      timer_seconds: 550,
      moving_seconds: null,
      distance_meters: 1234.5,
      source_sport: 'running',
      normalized_sport: null,
      source_timezone: null,
      provenance: { import_mode: 'manual' },
    });
    expect(JSON.stringify(events)).not.toMatch(/positionLat|positionLong|heartRate|serialNumber/);
    expect(await importActivityFit(syntheticFit(), fitContext)).toEqual(events);
  });
  it('rejects corrupt checksums, unsupported file types and oversized input', async () => {
    const corrupt = syntheticFit();
    corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 0xff;
    await expect(importActivityFit(corrupt, fitContext)).rejects.toMatchObject({
      code: 'invalid_file',
    });
    await expect(importActivityFit(syntheticFit('workout'), fitContext)).rejects.toMatchObject({
      code: 'invalid_file',
    });
    await expect(
      importActivityFit(new Uint8Array(10 * 1024 * 1024 + 1), fitContext),
    ).rejects.toMatchObject({ code: 'too_large' });
  });
});

describe('Apple normalization and derived helpers', () => {
  it('keeps unknown sports/stages and never invents moving time or sleep scores', () => {
    const base = {
      uuid: 'id',
      start_at: '2026-10-02T10:00:00Z',
      end_at: '2026-10-02T11:00:00Z',
      source_application: 'apple',
    };
    expect(
      normalizeHealthKitSample({
        ...base,
        type: 'workout',
        sport: 'future-sport',
        distance_meters: null,
      }).payload,
    ).toMatchObject({ normalized_sport: null, moving_seconds: null, timer_seconds: null });
    expect(
      normalizeHealthKitSample({ ...base, type: 'sleep', stage: 'future-stage' }).payload,
    ).toMatchObject({ kind: 'sleep_segment', stage: 'unknown', source_stage: 'future-stage' });
  });
  it('unions overlapping sleep intervals across DST and ignores in-bed duplication', () => {
    const make = (stage: string, start_at: string, end_at: string) => {
      const { payload } = normalizeHealthKitSample({
        type: 'sleep',
        uuid: stage,
        source_application: 'apple',
        stage,
        start_at,
        end_at,
      });
      if (payload.kind !== 'sleep_segment') throw new Error();
      return payload;
    };
    const segments = [
      make('asleepCore', '2026-10-25T01:00:00+02:00', '2026-10-25T03:00:00+01:00'),
      make('asleepDeep', '2026-10-25T02:00:00+02:00', '2026-10-25T04:00:00+01:00'),
      make('inBed', '2026-10-24T22:00:00Z', '2026-10-25T06:00:00Z'),
    ];
    expect(summarizeSleepSegments(segments)).toEqual({
      asleep_seconds: 4 * 3600,
      stage_conflict: true,
    });
    expect(summarizeSleepSegments([segments[2]!]).asleep_seconds).toBeNull();
  });
  it('keeps incompatible HRV series separate', () => {
    const { payload } = normalizeHealthKitSample({
      type: 'hrv_sdnn',
      uuid: 'id',
      start_at: now,
      end_at: now,
      source_application: 'apple',
      value: 42,
      unit: 'ms',
    });
    const original = event({
      provider: 'apple_health',
      dataset: 'observations',
      external_id: 'observation:id',
      payload,
    });
    if (payload.kind !== 'observation') throw new Error();
    expect(observationSeriesKey('subject', original)).not.toBe(
      observationSeriesKey('subject', { ...original, payload: { ...payload, method: 'unknown' } }),
    );
  });
});
