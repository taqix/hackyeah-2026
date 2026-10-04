-- Sport catalog seed and profile backfill so generation works on a fresh project.
-- Names match the mobile mock catalog exactly: the app maps catalog rows to its sport slugs by name.
-- IDs are never fixed; rows are upserted by case-insensitive name, so re-running is safe.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS sport_name_lower_key ON public.sport (lower(name));

-- Metric shapes follow the product contract: number/text only, at most five per sport.
-- Boolean and enum fields from the mock (indoor ride, tennis format) are not supported yet.
INSERT INTO public.sport (name, is_gym, generation_enabled, metrics)
SELECT seed.name, seed.is_gym, seed.generation_enabled, seed.metrics
FROM (VALUES
  ('Walking', false, true,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1},
     {"key":"distance","label":"Distance","unit":"km","type":"number","required":false,"minimum":0}]'::jsonb),
  ('Strength', true, true, '[]'::jsonb),
  ('Running', false, true,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1},
     {"key":"distance","label":"Distance","unit":"km","type":"number","required":false,"minimum":0}]'::jsonb),
  ('Cycling', false, true,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1},
     {"key":"distance","label":"Distance","unit":"km","type":"number","required":false,"minimum":0}]'::jsonb),
  ('Swimming', false, true,
   '[{"key":"duration_minutes","label":"Time in the water","unit":"min","type":"number","required":true,"minimum":1},
     {"key":"distance","label":"Distance","unit":"m","type":"number","required":false,"minimum":0}]'::jsonb),
  ('Mobility', false, true,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Football', false, true,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  -- Preview sports are listed but cannot be planned yet.
  ('Tennis', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Table tennis', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Badminton', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Padel', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Basketball', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Volleyball', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Yoga', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Pilates', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Dancing', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Hiking', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1},
     {"key":"distance","label":"Distance","unit":"km","type":"number","required":false,"minimum":0}]'::jsonb),
  ('Nordic walking', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1},
     {"key":"distance","label":"Distance","unit":"km","type":"number","required":false,"minimum":0}]'::jsonb),
  ('Rowing', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1},
     {"key":"distance","label":"Distance","unit":"km","type":"number","required":false,"minimum":0}]'::jsonb),
  ('Climbing', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Ice skating', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb),
  ('Boxing', false, false,
   '[{"key":"duration_minutes","label":"Time","unit":"min","type":"number","required":true,"minimum":1}]'::jsonb)
) AS seed(name, is_gym, generation_enabled, metrics)
ON CONFLICT ((lower(name))) DO UPDATE SET
  name = EXCLUDED.name,
  is_gym = EXCLUDED.is_gym,
  generation_enabled = EXCLUDED.generation_enabled,
  metrics = EXCLUDED.metrics;

-- Accounts created before the signup trigger was fixed have no profile row yet.
INSERT INTO public.profile (id, email)
SELECT users.id, users.email FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;

COMMIT;
