-- Signup copies the person's name from Auth metadata into profile.username.
-- Google sign-ups carry name/full_name; the app's email sign-up sends {name, full_name}.
BEGIN;

-- The cleaned name, or NULL. It always satisfies the contract's username
-- (shortText: JavaScript-trimmed, 1-200 UTF-16 code units), so GET /profile
-- passes its own response validation.
CREATE OR REPLACE FUNCTION public.profile_username_from_metadata(p_metadata jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
DECLARE
  v_key text;
  v_name text;
BEGIN
  IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
    RETURN NULL;
  END IF;
  FOREACH v_key IN ARRAY ARRAY['name', 'full_name', 'given_name'] LOOP
    CONTINUE WHEN jsonb_typeof(p_metadata -> v_key) IS DISTINCT FROM 'string';
    -- Control characters and every character JavaScript's trim() removes collapse
    -- to one space, so the stored value is already trimmed by the contract's rules.
    v_name := btrim(regexp_replace(
      p_metadata ->> v_key,
      '[\u0001-\u0020\u007F-\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+',
      ' ', 'g'), ' ');
    -- The contract counts UTF-16 code units: characters outside the BMP count twice.
    v_name := left(v_name, 200);
    WHILE length(v_name)
          + length(regexp_replace(v_name, '[^\U00010000-\U0010FFFF]', '', 'g')) > 200 LOOP
      v_name := left(v_name, -1);
    END LOOP;
    v_name := rtrim(v_name, ' ');
    IF v_name <> '' THEN
      RETURN v_name;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_username text;
BEGIN
  -- The name is optional: a failure here must never block signing up.
  BEGIN
    v_username := public.profile_username_from_metadata(NEW.raw_user_meta_data);
  EXCEPTION WHEN OTHERS THEN
    v_username := NULL;
  END;
  INSERT INTO public.profile AS existing (id, email, username)
  VALUES (NEW.id, NEW.email, v_username)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(existing.username, EXCLUDED.username);
  RETURN NEW;
END;
$function$;

-- Metadata that arrives later (an identity refreshed at sign-in) only fills an
-- empty username, so a name the person chose in the app is never overwritten.
CREATE OR REPLACE FUNCTION public.handle_user_metadata_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_username text;
BEGIN
  -- Best effort: this runs inside Auth's own update, so it must never block a sign-in.
  BEGIN
    v_username := public.profile_username_from_metadata(NEW.raw_user_meta_data);
    IF v_username IS NOT NULL THEN
      UPDATE public.profile SET username = v_username
      WHERE id = NEW.id AND username IS NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.profile_username_from_metadata(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_user_metadata_update() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS on_auth_user_metadata_updated ON auth.users;
CREATE TRIGGER on_auth_user_metadata_updated
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_user_metadata_update();

-- Accounts created before this migration (Google sign-ups among them) get their name now.
UPDATE public.profile AS p
SET username = public.profile_username_from_metadata(u.raw_user_meta_data)
FROM auth.users AS u
WHERE p.id = u.id
  AND p.username IS NULL
  AND public.profile_username_from_metadata(u.raw_user_meta_data) IS NOT NULL;

COMMIT;
