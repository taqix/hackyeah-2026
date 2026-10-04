import { createProductApi } from './handler.ts';
import { unavailableGenerator } from './provider.ts';
import { createSupabaseDependencies } from './supabase-store.ts';

const url = Deno.env.get('SUPABASE_URL');
const publishableKey =
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
if (!url || !publishableKey) throw new Error('Supabase runtime configuration is required.');

Deno.serve(
  createProductApi(
    createSupabaseDependencies(
      {
        url,
        publishableKey,
        serverKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      },
      unavailableGenerator,
    ),
  ),
);
