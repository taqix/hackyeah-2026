import { createGeminiGenerator } from './gemini.ts';
import { createProductApi } from './handler.ts';
import { unavailableGenerator } from './provider.ts';
import { createSupabaseDependencies } from './supabase-store.ts';

const url = Deno.env.get('SUPABASE_URL');
const publishableKey =
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
if (!url || !publishableKey) throw new Error('Supabase runtime configuration is required.');

// Without both Gemini secrets the AI routes keep answering 501 AI_NOT_CONFIGURED.
const apiKey = Deno.env.get('GEMINI_API_KEY');
const model = Deno.env.get('GEMINI_MODEL');
const generator = apiKey && model ? createGeminiGenerator({ apiKey, model }) : unavailableGenerator;

Deno.serve(
  createProductApi(
    createSupabaseDependencies(
      {
        url,
        publishableKey,
        serverKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      },
      generator,
    ),
  ),
);
