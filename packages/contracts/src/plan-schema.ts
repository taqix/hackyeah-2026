import outputSchema from './schemas/output.schema.json' with { type: 'json' };
import type { PlanInput } from './plan-types.js';

interface JsonSchema {
  [key: string]: unknown;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
}

interface ObjectSchema extends JsonSchema {
  properties: Record<string, JsonSchema>;
  required: string[];
}

/** Catalog-specific schema used for authoritative local validation. */
export function buildPlanOutputSchema(input: PlanInput): JsonSchema {
  // JSON imports infer a union with optional properties for the array branches.
  const branches = outputSchema.properties.events.items.oneOf as unknown as ObjectSchema[];
  const [nonGym, gym, deletion] = branches;
  if (!nonGym || !gym || !deletion) throw new Error('Missing planning schema branches.');
  const additions: JsonSchema[] = input.sports.map((sport): JsonSchema => {
    if (sport.is_gym === 0) {
      return {
        ...nonGym,
        properties: {
          ...nonGym.properties,
          sport_id: { type: 'integer', enum: [sport.id] },
          metrics: {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(
              sport.metrics.map((metric) => [
                metric.key,
                {
                  ...metric.value_schema,
                  description: `${metric.description}${metric.unit ? ` (${metric.unit})` : ''}`,
                },
              ]),
            ),
            required: sport.metrics.filter((metric) => metric.required).map((metric) => metric.key),
          },
        },
      };
    }
    return {
      ...gym,
      properties: {
        ...gym.properties,
        sport_id: { type: 'integer', enum: [sport.id] },
      },
    };
  });
  const windowStart = Date.parse(input.planning_window.start);
  const windowEnd = windowStart + input.planning_window.duration * 1000;
  const deletable = [
    ...new Map(
      [...input.previous_week_events, ...input.current_week_events, ...input.target_window_events]
        .filter((event) => {
          const start = Date.parse(event.time_slot.start);
          return (
            event.editable &&
            event.status === 'planned' &&
            start >= windowStart &&
            start + event.time_slot.duration * 1000 <= windowEnd
          );
        })
        .map((event) => [event.id, event.id]),
    ).values(),
  ];
  if (input.mode === 'modify' && deletable.length) {
    additions.push({
      ...deletion,
      properties: { ...deletion.properties, id: { type: 'integer', enum: deletable } },
    });
  }
  return {
    ...outputSchema,
    properties: {
      events: additions.length
        ? { type: 'array', items: { oneOf: additions } }
        : { type: 'array', maxItems: 0, items: deletion },
      message: input.mode === 'modify' ? { type: 'string', minLength: 1 } : { type: 'null' },
    },
  };
}

/** Translate only schema nodes, preserving metric names such as "minimum". */
function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const {
    $schema: _dialect,
    oneOf,
    const: constant,
    exclusiveMinimum,
    minLength: _minLength,
    maxLength: _maxLength,
    format,
    properties,
    items,
    ...rest
  } = schema;
  return {
    ...rest,
    ...(constant !== undefined
      ? {
          enum: [constant],
          ...(!rest.type ? { type: constant === null ? 'null' : typeof constant } : {}),
        }
      : {}),
    ...(exclusiveMinimum !== undefined ? { minimum: exclusiveMinimum } : {}),
    ...(oneOf ? { anyOf: oneOf.map(toGeminiSchema) } : {}),
    ...(properties
      ? {
          properties: Object.fromEntries(
            Object.entries(properties).map(([key, value]) => [key, toGeminiSchema(value)]),
          ),
        }
      : {}),
    ...(items ? { items: toGeminiSchema(items) } : {}),
    ...(format && format !== 'duration' ? { format } : {}),
  };
}

export function buildGeminiOutputSchema(input: PlanInput): JsonSchema {
  return toGeminiSchema(buildPlanOutputSchema(input));
}
