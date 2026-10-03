-- Backend-only storage. The host API verifies Supabase sessions and passes their owner ID.
-- JSONB bodies use versioned @hackyeah/contracts/wearables; keys never authorize access.
CREATE TABLE wearable_owner_locks (owner_id text PRIMARY KEY);
ALTER TABLE wearable_owner_locks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['wearable_connections', 'wearable_records', 'wearable_revisions',
    'wearable_receipts', 'wearable_checkpoints', 'wearable_consents', 'wearable_leases']
  LOOP
    EXECUTE format('CREATE TABLE %I (
      owner_id text NOT NULL REFERENCES wearable_owner_locks(owner_id),
      key text NOT NULL,
      body jsonb NOT NULL CHECK (jsonb_typeof(body) = ''object''),
      PRIMARY KEY (owner_id, key)
    )', table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    -- No client RLS policies: all application data goes through the authenticated backend.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON %I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON %I FROM authenticated', table_name);
    END IF;
  END LOOP;
END $$;

CREATE INDEX wearable_records_dataset ON wearable_records (owner_id, (body->'event'->>'dataset'));
CREATE INDEX wearable_records_subject ON wearable_records (owner_id, (body->>'provider_subject'));
