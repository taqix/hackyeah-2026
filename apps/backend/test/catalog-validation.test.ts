import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parsePlanInput,
  parsePlanOutput,
  PlanValidationError,
  type MetricValueSchema,
  type PlanInput,
  type PlanOutput,
} from '@hackyeah/contracts/plan';

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as T;

function requestWithMetric(valueSchema: MetricValueSchema): PlanInput {
  const request = fixture<PlanInput>('initial.input');
  const sport = request.sports.find((item) => item.is_gym === 0);
  if (!sport || sport.is_gym !== 0) throw Error('Missing non-gym fixture sport');
  sport.metrics.push({
    key: 'test_metric',
    description: 'Catalog-defined test metric',
    required: true,
    value_schema: valueSchema,
  });
  return request;
}

function outputWithMetric(value: number): PlanOutput {
  const output = fixture<PlanOutput>('initial.expected-output');
  const event = output.events.find((item) => item.action === 'add' && 'metrics' in item);
  if (!event || event.action !== 'add' || !('metrics' in event))
    throw Error('Missing non-gym fixture workout');
  event.metrics.test_metric = value;
  for (const part of event.parts) part.metrics.test_metric = value;
  return output;
}

void test('rejects integer metric intervals containing no integer before generation', () => {
  for (const [minimum, maximum] of [
    [0.1, 0.9],
    [-0.9, -0.1],
    [1.1, 1.9],
    [0.5, 0.5],
  ]) {
    assert.throws(
      () => parsePlanInput(requestWithMetric({ type: 'integer', minimum, maximum })),
      PlanValidationError,
      `Expected rejection for integer interval [${minimum}, ${maximum}]`,
    );
  }
});

void test('accepts integer metric bounds when an integer satisfies the generated workout schema', () => {
  const cases = [
    { minimum: 0.1, maximum: 1, value: 1 },
    { minimum: -1, maximum: -0.1, value: -1 },
    { minimum: -0.1, maximum: 0.1, value: 0 },
    { minimum: 1, maximum: 1, value: 1 },
    { minimum: 0.1, value: 1 },
    { maximum: -0.1, value: -1 },
    { value: 0 },
  ];
  for (const { value, ...bounds } of cases) {
    const request = parsePlanInput(requestWithMetric({ type: 'integer', ...bounds }));
    const output = outputWithMetric(value);
    assert.deepEqual(parsePlanOutput(output, request, Date.parse('2026-10-01T00:00:00Z')), output);
  }
});

void test('retains fractional metric intervals for number-valued metrics', () => {
  for (const bounds of [
    { minimum: 0.1, maximum: 0.9 },
    { minimum: 0.5, maximum: 0.5 },
  ]) {
    const request = parsePlanInput(requestWithMetric({ type: 'number', ...bounds }));
    const output = outputWithMetric(0.5);
    assert.deepEqual(parsePlanOutput(output, request, Date.parse('2026-10-01T00:00:00Z')), output);
  }
});
