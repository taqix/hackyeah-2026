import { mkdirSync, writeFileSync } from 'node:fs';
import { getProductJsonSchemas } from '../../packages/contracts/src/product.ts';
import { routes } from '../functions/product-api/handler.ts';
import { designExamples, examples } from '../tests/fixtures.ts';
import { renderFrontendHandoff } from './frontend-handoff.ts';

const schemas = getProductJsonSchemas();
const paths: Record<string, Record<string, unknown>> = {};
const reference = (name: string) => ({ $ref: `#/components/schemas/${name}` });
for (const route of routes) {
  paths[route.path] ??= {};
  paths[route.path]![route.method.toLowerCase()] = {
    operationId: `${route.method.toLowerCase()}${route.path.replaceAll('/', '_')}`,
    ...(route.path === '/plans/generate'
      ? {
          description:
            'Set sport_id to a catalog sport ID to request that sport, or null to let the generator choose from eligible sports. A valid week may have no activities when no session fits the supplied availability.',
        }
      : {}),
    security: [{ bearerAuth: [], projectKey: [] }],
    ...('request' in route
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: reference(route.request),
                example: examples[route.request],
              },
            },
          },
        }
      : {}),
    parameters:
      route.path === '/chat/messages'
        ? [
            {
              name: 'plan_id',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ]
        : [],
    responses: {
      '200': {
        description:
          route.path === '/plans/generate'
            ? 'Successful response. The saved plan may contain an empty activities array when no session fits the supplied availability.'
            : 'Successful response. Empty collections return []; no active plan returns null.',
        content: {
          'application/json': {
            schema: route.response ? reference(route.response) : { type: 'object' },
            ...(route.response ? { example: examples[route.response] } : {}),
          },
        },
      },
      default: {
        description:
          'Validated application error. Platform gateway errors may have a different shape.',
        content: {
          'application/json': {
            schema: reference('ErrorResponse'),
            example: examples.ErrorResponse,
          },
        },
      },
    },
  };
  if (
    route.method === 'GET' &&
    ['/plans/history', '/chat/messages', '/completions'].includes(route.path)
  ) {
    const operation = paths[route.path]![route.method.toLowerCase()] as {
      parameters: unknown[];
    };
    operation.parameters.push(
      {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
      {
        name: 'offset',
        in: 'query',
        schema: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
      },
    );
  }
}
const directory = new URL('../../docs/api/', import.meta.url);
mkdirSync(directory, { recursive: true });
const write = (name: string, value: unknown) =>
  writeFileSync(new URL(name, directory), `${JSON.stringify(value, null, 2)}\n`);
write('product-api.schemas.json', schemas);
write('product-api.examples.json', examples);
write('product-api.design-examples.json', designExamples);
writeFileSync(new URL('FRONTEND_HANDOFF.md', directory), renderFrontendHandoff());
write('product-api.openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Movo Supabase Product API',
    version: '1.0.0',
    description:
      'Prepared scaffold, not deployed. AI adapters are disabled. Custom Zod refinements add schedule checks beyond JSON Schema.',
  },
  servers: [
    {
      url: 'https://{project_ref}.supabase.co/functions/v1/product-api',
      variables: { project_ref: { default: 'YOUR_PROJECT_REF' } },
    },
  ],
  paths,
  components: {
    schemas,
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Supabase session JWT',
      },
      projectKey: { type: 'apiKey', in: 'header', name: 'apikey' },
    },
  },
});
