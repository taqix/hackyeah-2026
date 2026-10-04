import { randomUUID } from 'node:crypto';
import { Ajv } from 'ajv';
import { z } from 'zod';
import type { Dataset } from '@hackyeah/contracts/wearables';
import { WearableError } from '../errors.js';
import { digest } from '../hash.js';
import type { ExtractionPage, FetchContext, WearableAdapter } from '../types.js';

export const corosReadTools = [
  'querySportRecords',
  'getActivityDetail',
  'queryActivityLapData',
  'querySleepData',
  'querySleepHrv',
  'queryDailyHealthData',
  'queryAvgHeartRate',
  'queryRestingHeartRate',
] as const;
export type CorosReadTool = (typeof corosReadTools)[number];
const schemaObject = z.record(z.string(), z.unknown());
const toolSchema = z.object({
  name: z.string(),
  inputSchema: schemaObject,
  outputSchema: schemaObject.optional(),
});
export type McpTool = z.infer<typeof toolSchema>;
export const toolSchemaHash = (tool: McpTool): string =>
  digest({ input: tool.inputSchema, output: tool.outputSchema ?? null });

export interface CorosMcpOptions {
  /** A client belongs to exactly one enrolled connection and its pinned regional endpoint. */
  connection_id: string;
  endpoint: string;
  getAccessToken: (signal?: AbortSignal) => Promise<string>;
  fetch?: typeof fetch;
  timeout_ms?: number;
  max_response_bytes?: number;
}

export class CorosMcpClient {
  private readonly http: typeof fetch;
  private readonly endpoint: string;
  constructor(private readonly options: CorosMcpOptions) {
    let url: URL;
    try {
      url = new URL(options.endpoint);
    } catch {
      throw new WearableError('invalid_input');
    }
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/mcp' ||
      !['mcp.coros.com', 'mcpcn.coros.com', 'mcpeu.coros.com', 'mcpus.coros.com'].includes(
        url.hostname,
      )
    )
      throw new WearableError('invalid_input');
    this.endpoint = url.href;
    this.http = options.fetch ?? fetch;
  }
  assertConnection(id: string) {
    if (id !== this.options.connection_id) throw new WearableError('not_found');
  }
  async discover(signal?: AbortSignal): Promise<McpTool[]> {
    const initialized = await this.rpc(
      'initialize',
      {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'hackyeah-wearables', version: '1.0.0' },
      },
      signal,
    );
    const handshake = z
      .object({
        protocolVersion: z.literal('2025-06-18'),
        capabilities: z.object({ tools: schemaObject }),
      })
      .safeParse(initialized);
    if (!handshake.success) throw new WearableError('schema_changed');
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    for (let page = 0; page < 100; page += 1) {
      const result = z
        .object({ tools: z.array(toolSchema).max(500), nextCursor: z.string().min(1).optional() })
        .safeParse(await this.rpc('tools/list', cursor ? { cursor } : {}, signal));
      if (!result.success) throw new WearableError('invalid_response');
      for (const tool of result.data.tools) {
        if (tools.some((previous) => previous.name === tool.name))
          throw new WearableError('invalid_response');
        tools.push(tool);
      }
      cursor = result.data.nextCursor;
      if (!cursor) return tools;
      if (seen.has(cursor)) throw new WearableError('invalid_response');
      seen.add(cursor);
    }
    throw new WearableError('invalid_response');
  }
  async call(
    tool: McpTool,
    expectedHash: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!(corosReadTools as readonly string[]).includes(tool.name))
      throw new WearableError('unsupported');
    if (toolSchemaHash(tool) !== expectedHash) throw new WearableError('schema_changed');
    const ajv = new Ajv({ strict: true, allErrors: false, validateFormats: false });
    try {
      if (!ajv.validate(tool.inputSchema, args)) throw new WearableError('invalid_input');
    } catch (error) {
      if (error instanceof WearableError) throw error;
      throw new WearableError('schema_changed');
    }
    const result = z
      .object({
        isError: z.boolean().optional(),
        structuredContent: z.unknown().optional(),
        content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
      })
      .safeParse(await this.rpc('tools/call', { name: tool.name, arguments: args }, signal));
    if (!result.success || result.data.isError) throw new WearableError('invalid_response');
    let output = result.data.structuredContent;
    if (output === undefined) {
      const blocks = result.data.content;
      if (blocks?.length !== 1 || blocks[0]?.type !== 'text' || !blocks[0].text)
        throw new WearableError('invalid_response');
      try {
        output = JSON.parse(blocks[0].text);
      } catch {
        throw new WearableError('invalid_response');
      }
    }
    if (tool.outputSchema) {
      try {
        if (!ajv.validate(tool.outputSchema, output)) throw new WearableError('invalid_response');
      } catch (error) {
        if (error instanceof WearableError) throw error;
        throw new WearableError('schema_changed');
      }
    }
    return output;
  }
  private async rpc(
    method: string,
    params: object,
    externalSignal?: AbortSignal,
  ): Promise<unknown> {
    const signal = AbortSignal.any([
      AbortSignal.timeout(this.options.timeout_ms ?? 15000),
      ...(externalSignal ? [externalSignal] : []),
    ]);
    const id = randomUUID();
    try {
      const token = await this.options.getAccessToken(signal);
      if (!token || /[\r\n]/.test(token)) throw new WearableError('reauth_required');
      const response = await this.http(this.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401) throw new WearableError('reauth_required');
        if (response.status === 403) throw new WearableError('restricted');
        if (response.status === 429) {
          const retry = response.headers.get('retry-after');
          const seconds =
            retry && /^\d+$/.test(retry)
              ? Number(retry)
              : retry
                ? Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
                : null;
          throw new WearableError(
            'rate_limited',
            seconds !== null && Number.isFinite(seconds) ? seconds : null,
          );
        }
        throw new WearableError(response.status >= 500 ? 'unavailable' : 'invalid_response');
      }
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
      if (!['application/json', 'text/event-stream'].includes(contentType ?? '')) {
        await response.body?.cancel();
        throw new WearableError('invalid_response');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new WearableError('invalid_response');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > (this.options.max_response_bytes ?? 5 * 1024 * 1024))
            throw new WearableError('too_large');
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      let messages: unknown[];
      try {
        messages =
          contentType === 'application/json'
            ? [JSON.parse(body)]
            : body
                .replace(/\r\n?/g, '\n')
                .split('\n\n')
                .map((event) =>
                  event
                    .split('\n')
                    .filter((line) => line.startsWith('data:'))
                    .map((line) => line.slice(5).replace(/^ /, ''))
                    .join('\n'),
                )
                .filter(Boolean)
                .map((data) => JSON.parse(data));
      } catch {
        throw new WearableError('invalid_response');
      }
      const matches = messages.filter(
        (message): message is Record<string, unknown> =>
          !!message && typeof message === 'object' && 'id' in message && message.id === id,
      );
      if (
        matches.length !== 1 ||
        matches[0]!.jsonrpc !== '2.0' ||
        'error' in matches[0]! ||
        !('result' in matches[0]!)
      )
        throw new WearableError('invalid_response');
      return matches[0]!.result;
    } catch (error) {
      if (error instanceof WearableError) throw error;
      if (externalSignal?.aborted) throw externalSignal.reason;
      throw new WearableError('unavailable');
    }
  }
}

export interface CorosBinding {
  dataset: Dataset;
  tool: CorosReadTool;
  schema_hash: string;
  arguments(context: FetchContext): Record<string, unknown>;
  /** Implement from reviewed, consented live fixtures. No guessed vendor field names ship here. */
  decode(result: unknown, context: FetchContext): ExtractionPage;
}
export class CorosAdapter implements WearableAdapter {
  readonly provider = 'coros';
  readonly transport = 'coros_mcp';
  readonly datasets: Dataset[];
  constructor(
    private readonly client: CorosMcpClient,
    readonly version: string,
    private readonly bindings: readonly CorosBinding[],
  ) {
    this.datasets = bindings.map((binding) => binding.dataset);
    if (new Set(this.datasets).size !== this.datasets.length)
      throw new WearableError('invalid_input');
  }
  async fetch(context: FetchContext): Promise<ExtractionPage> {
    this.client.assertConnection(context.connection.id);
    const binding = this.bindings.find(
      (candidate) => candidate.dataset === context.request.dataset,
    );
    if (!binding) throw new WearableError('unsupported');
    const tool = (await this.client.discover(context.signal)).find(
      (candidate) => candidate.name === binding.tool,
    );
    if (!tool) throw new WearableError('schema_changed');
    return binding.decode(
      await this.client.call(tool, binding.schema_hash, binding.arguments(context), context.signal),
      context,
    );
  }
}
