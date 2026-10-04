-- Feedback after the log, mutable "choose again" opinions, and plan Undo.
BEGIN;

-- A completion can be saved before its feedback. The existing object CHECK already admits NULL.
ALTER TABLE public.activity_completion ALTER COLUMN feedback DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.is_valid_feedback(p_feedback jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
BEGIN
  IF jsonb_typeof(p_feedback) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;
  RETURN coalesce(
    (SELECT count(*) FROM jsonb_object_keys(p_feedback)) = 3
    AND coalesce(p_feedback->>'effort' IN ('easy', 'okay', 'hard', 'too_much'), false)
    AND p_feedback ? 'enjoyment'
    AND (jsonb_typeof(p_feedback->'enjoyment') = 'null'
         OR (jsonb_typeof(p_feedback->'enjoyment') = 'string'
             AND p_feedback->>'enjoyment' IN ('yes', 'maybe', 'no')))
    AND jsonb_typeof(p_feedback->'notes') IS NOT DISTINCT FROM 'string'
    AND length(p_feedback->>'notes') <= 1000,
    false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_activity(
  p_plan_version_id uuid,
  p_activity_id uuid,
  p_request_id uuid,
  p_metrics jsonb,
  p_gym_log jsonb,
  p_feedback jsonb,
  p_completed_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  -- JSON null and SQL NULL both mean the log is saved before any feedback.
  v_feedback jsonb := nullif(p_feedback, 'null'::jsonb);
  v_version public.plan_version%ROWTYPE;
  v_activity jsonb;
  v_existing public.product_request_receipt%ROWTYPE;
  v_payload jsonb;
  v_completion public.activity_completion%ROWTYPE;
  v_metric record;
  v_definition jsonb;
  v_sport public.sport%ROWTYPE;
  v_supplied_count integer;
  v_exercise jsonb;
  v_set jsonb;
  v_exercise_id text;
  v_result jsonb;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND'; END IF;
  IF p_plan_version_id IS NULL OR p_activity_id IS NULL OR p_request_id IS NULL
     OR jsonb_typeof(p_metrics) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_gym_log) IS DISTINCT FROM 'array'
     OR p_completed_at IS NULL OR NOT isfinite(p_completed_at)
     OR p_completed_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_metrics)) > 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;
  FOR v_metric IN SELECT key, value FROM jsonb_each(p_metrics) LOOP
    IF v_metric.key !~ '^[a-z][a-z0-9_]{0,39}$'
       OR (CASE jsonb_typeof(v_metric.value)
            WHEN 'number' THEN (v_metric.value #>> '{}')::numeric < 0
            WHEN 'string' THEN length(v_metric.value #>> '{}') > 200
            ELSE true
          END) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
  END LOOP;
  IF v_feedback IS NOT NULL AND NOT public.is_valid_feedback(v_feedback) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;
  IF jsonb_array_length(p_gym_log) > 20 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;
  FOR v_exercise IN SELECT value FROM jsonb_array_elements(p_gym_log) LOOP
    IF jsonb_typeof(v_exercise) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
    IF jsonb_typeof(v_exercise->'exercise_id') IS DISTINCT FROM 'string'
       OR length(v_exercise->>'exercise_id') NOT BETWEEN 1 AND 200
       OR jsonb_typeof(v_exercise->'sets') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(v_exercise)) <> 2
       OR jsonb_array_length(v_exercise->'sets') NOT BETWEEN 1 AND 10 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
    v_exercise_id := v_exercise->>'exercise_id';
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_gym_log) prior
      WHERE prior->>'exercise_id' = v_exercise_id
      GROUP BY prior->>'exercise_id' HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
    FOR v_set IN SELECT value FROM jsonb_array_elements(v_exercise->'sets') LOOP
      IF jsonb_typeof(v_set) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
      END IF;
      IF (CASE WHEN jsonb_typeof(v_set->'repetitions') = 'number'
                   THEN (v_set->>'repetitions')::numeric = trunc((v_set->>'repetitions')::numeric)
                        AND (v_set->>'repetitions')::numeric BETWEEN 0 AND 100
                   ELSE false
              END) IS NOT TRUE
         OR NOT (v_set ? 'weight_kg')
         OR (CASE
              WHEN v_set->'weight_kg' = 'null'::jsonb THEN false
              WHEN jsonb_typeof(v_set->'weight_kg') = 'number'
                THEN (v_set->>'weight_kg')::numeric NOT BETWEEN 0 AND 1000
              ELSE true
            END) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
      END IF;
      IF (SELECT count(*) FROM jsonb_object_keys(v_set)) <> 2 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
      END IF;
    END LOOP;
  END LOOP;
  v_payload := jsonb_build_object('plan_version_id', p_plan_version_id, 'activity_id', p_activity_id,
    'metrics', p_metrics, 'gym_log', p_gym_log, 'feedback', v_feedback, 'completed_at', p_completed_at);
  PERFORM 1 FROM public.profile WHERE id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND'; END IF;
  SELECT * INTO v_existing FROM public.product_request_receipt
    WHERE profile_id = v_owner AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.action <> 'complete_activity' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_CONFLICT';
    END IF;
    IF v_existing.payload IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_CONFLICT';
    END IF;
    RETURN v_existing.result;
  END IF;
  SELECT * INTO v_version FROM public.plan_version
    WHERE id = p_plan_version_id AND profile_id = v_owner;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND'; END IF;
  SELECT value INTO v_activity FROM jsonb_array_elements(v_version."plan"->'activities')
    WHERE value->>'id' = p_activity_id::text;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND'; END IF;
  SELECT * INTO v_sport FROM public.sport WHERE id = (v_activity->>'sport_id')::bigint;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND'; END IF;
  IF v_sport.is_gym THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_gym_log) submitted
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_activity->'gym_exercises') planned
        WHERE planned->>'id' = submitted->>'exercise_id'
      )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
  ELSIF jsonb_array_length(p_gym_log) <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;

  IF jsonb_typeof(v_sport.metrics) = 'array' THEN
    FOR v_definition IN SELECT value FROM jsonb_array_elements(v_sport.metrics) LOOP
      IF v_definition->>'required' = 'true' AND NOT (p_metrics ? (v_definition->>'key')) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
      END IF;
      IF p_metrics ? (v_definition->>'key') THEN
        IF (CASE v_definition->>'type'
             WHEN 'number' THEN
               CASE WHEN jsonb_typeof(p_metrics->(v_definition->>'key')) <> 'number' THEN true
                    ELSE ((v_definition ? 'minimum') AND
                          (p_metrics->>(v_definition->>'key'))::numeric < (v_definition->>'minimum')::numeric)
                      OR ((v_definition ? 'maximum') AND
                          (p_metrics->>(v_definition->>'key'))::numeric > (v_definition->>'maximum')::numeric)
               END
             WHEN 'text' THEN jsonb_typeof(p_metrics->(v_definition->>'key')) <> 'string'
             ELSE true
           END) THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
        END IF;
      END IF;
    END LOOP;
    SELECT count(*)::int INTO v_supplied_count FROM jsonb_object_keys(p_metrics) metric_key;
    IF v_supplied_count <> (SELECT count(*)::int FROM jsonb_array_elements(v_sport.metrics) definition
       WHERE p_metrics ? (definition->>'key')) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
  ELSIF (SELECT count(*) FROM jsonb_object_keys(p_metrics)) <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;
  IF EXISTS (SELECT 1 FROM public.activity_completion WHERE profile_id = v_owner AND activity_id = p_activity_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ALREADY_COMPLETED';
  END IF;
  INSERT INTO public.activity_completion(profile_id, plan_version_id, activity_id, metrics, gym_log,
    feedback, completed_at, request_id)
  VALUES (v_owner, p_plan_version_id, p_activity_id, p_metrics, p_gym_log, v_feedback,
    p_completed_at, p_request_id) RETURNING * INTO v_completion;
  v_result := to_jsonb(v_completion);
  INSERT INTO public.product_request_receipt(profile_id, action, request_id, payload, result)
  VALUES (v_owner, 'complete_activity', p_request_id, v_payload, v_result);
  RETURN v_result;
END;
$function$;

-- Owner-only feedback change; metrics, sets and the completion time stay immutable.
CREATE OR REPLACE FUNCTION public.update_completion_feedback(
  p_completion_id uuid,
  p_feedback jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_completion public.activity_completion%ROWTYPE;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND'; END IF;
  IF p_completion_id IS NULL OR NOT public.is_valid_feedback(p_feedback) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;
  UPDATE public.activity_completion SET feedback = p_feedback
    WHERE id = p_completion_id AND profile_id = v_owner
    RETURNING * INTO v_completion;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND'; END IF;
  RETURN to_jsonb(v_completion);
END;
$function$;

-- "Would you choose this again?" per activity, kept apart from immutable completions.
CREATE TABLE IF NOT EXISTS public.activity_opinion (
  profile_id uuid NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  activity_key text NOT NULL CHECK (
    char_length(activity_key) BETWEEN 1 AND 100 AND activity_key ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200 AND btrim(title) <> ''),
  sport_id bigint NOT NULL REFERENCES public.sport(id) ON UPDATE CASCADE ON DELETE CASCADE,
  opinion text NOT NULL CHECK (opinion IN ('yes', 'maybe', 'no')),
  last_date date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, activity_key)
);
CREATE INDEX IF NOT EXISTS activity_opinion_owner_updated_idx
  ON public.activity_opinion(profile_id, updated_at DESC);

-- The server clock stamps every write, including upserts that resend an opinion.
CREATE OR REPLACE FUNCTION public.touch_activity_opinion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS activity_opinion_touch ON public.activity_opinion;
CREATE TRIGGER activity_opinion_touch
  BEFORE INSERT OR UPDATE ON public.activity_opinion
  FOR EACH ROW EXECUTE FUNCTION public.touch_activity_opinion();

ALTER TABLE public.activity_opinion ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_opinion_owner_select ON public.activity_opinion
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = profile_id);
CREATE POLICY activity_opinion_owner_insert ON public.activity_opinion
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = profile_id);
CREATE POLICY activity_opinion_owner_update ON public.activity_opinion
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);
CREATE POLICY activity_opinion_owner_delete ON public.activity_opinion
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = profile_id);
REVOKE ALL ON public.activity_opinion FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_opinion TO authenticated, service_role;

-- Undo writes the restored snapshot as a new immutable version.
ALTER TABLE public.plan_version DROP CONSTRAINT plan_version_origin_check;
ALTER TABLE public.plan_version ADD CONSTRAINT plan_version_origin_check
  CHECK (origin IN ('generate', 'revise', 'undo'));

CREATE OR REPLACE FUNCTION public.save_plan_version(
  p_owner uuid,
  p_plan_id uuid,
  p_expected_version integer,
  p_request_id uuid,
  p_origin text,
  p_plan jsonb,
  p_summary text,
  p_message text DEFAULT NULL,
  p_input jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_plan public.plan%ROWTYPE;
  v_version public.plan_version%ROWTYPE;
  v_existing public.product_request_receipt%ROWTYPE;
  v_activity jsonb;
  v_activity_id uuid;
  v_sport_id bigint;
  v_current_version integer := 0;
  v_payload jsonb;
  v_result jsonb;
BEGIN
  IF p_owner IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_origin IS NULL
     OR p_expected_version < 0 OR p_origin NOT IN ('generate', 'revise', 'undo')
     OR p_summary IS NULL OR jsonb_typeof(p_plan) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_plan->'activities') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_plan->'week_start') IS DISTINCT FROM 'string'
     OR (p_plan->>'week_start') !~ '^\d{4}-\d{2}-\d{2}$'
     OR jsonb_typeof(p_plan->'timezone') IS DISTINCT FROM 'string'
     OR length(p_plan->>'timezone') = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;

  -- A stable owner lock serializes first plan creation as well as later revisions.
  PERFORM 1 FROM public.profile WHERE id = p_owner FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND';
  END IF;
  v_payload := jsonb_build_object('plan_id', p_plan_id, 'expected_version', p_expected_version,
    'origin', p_origin, 'plan', p_plan, 'summary', p_summary, 'message', p_message,
    'client_input', p_input);
  SELECT * INTO v_existing FROM public.product_request_receipt
    WHERE profile_id = p_owner AND request_id = p_request_id;
  IF FOUND AND v_existing.action <> 'save_plan_version' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_CONFLICT';
  END IF;
  SELECT * INTO v_existing FROM public.product_request_receipt
    WHERE profile_id = p_owner AND action = 'save_plan_version' AND request_id = p_request_id;
  IF FOUND THEN
    IF (p_input IS NOT NULL AND v_existing.payload->'client_input' IS DISTINCT FROM p_input)
       OR (p_input IS NULL AND v_existing.payload IS DISTINCT FROM v_payload) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_CONFLICT';
    END IF;
    RETURN v_existing.result;
  END IF;

  IF p_plan_id IS NULL THEN
    IF p_expected_version <> 0 OR p_origin <> 'generate' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_CONFLICT';
    END IF;
    IF EXISTS (SELECT 1 FROM public.plan WHERE profile_id = p_owner) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_CONFLICT';
    END IF;
    INSERT INTO public.plan(profile_id) VALUES (p_owner) RETURNING * INTO v_plan;
  ELSE
    SELECT * INTO v_plan FROM public.plan WHERE id = p_plan_id AND profile_id = p_owner FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND';
    END IF;
    SELECT version INTO v_current_version FROM public.plan_version
      WHERE id = v_plan.active_version_id AND profile_id = p_owner;
    v_current_version := coalesce(v_current_version, 0);
    IF v_current_version <> p_expected_version THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_CONFLICT';
    END IF;
  END IF;

  -- Validate activity shape and references before writing the new immutable version.
  FOR v_activity IN SELECT value FROM jsonb_array_elements(p_plan->'activities') LOOP
    IF jsonb_typeof(v_activity) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_activity->'id') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_activity->'sport_id') IS DISTINCT FROM 'string'
       OR (v_activity->>'sport_id') !~ '^\d+$'
       OR jsonb_typeof(v_activity->'title') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_activity->'description') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_activity->'start_at') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_activity->'duration_minutes') IS DISTINCT FROM 'number'
       OR (v_activity->>'duration_minutes') !~ '^\d+$'
       OR jsonb_typeof(v_activity->'gym_exercises') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
    BEGIN
      v_activity_id := (v_activity->>'id')::uuid;
      v_sport_id := (v_activity->>'sport_id')::bigint;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END;
    IF NOT EXISTS (SELECT 1 FROM public.sport WHERE id = v_sport_id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_plan->'activities') a WHERE a->>'id' = v_activity_id::text
      GROUP BY a->>'id' HAVING count(*) > 1) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
    END IF;
  END LOOP;

  -- A completed object in a week is immutable across same-week revisions: every completed
  -- activity of the active version goes into the next one exactly as the active version has it.
  -- The active copy is the one the planner keeps. A completion saved against an older version
  -- after a revision moved or dropped its activity must not lock the week to a copy no new plan has.
  IF v_plan.active_version_id IS NOT NULL THEN
    IF EXISTS (
         SELECT 1
         FROM public.plan_version current_version
         CROSS JOIN LATERAL jsonb_array_elements(current_version."plan"->'activities') old_activity
         WHERE current_version.id = v_plan.active_version_id
           AND current_version.profile_id = p_owner
           AND current_version."plan"->>'week_start' = p_plan->>'week_start'
           AND EXISTS (
             SELECT 1 FROM public.activity_completion c
             WHERE c.profile_id = p_owner AND c.activity_id::text = old_activity->>'id'
           )
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements(p_plan->'activities') next_activity
             WHERE next_activity = old_activity
           )
       ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COMPLETED_ACTIVITY_LOCKED';
    END IF;
  END IF;

  INSERT INTO public.plan_version(plan_id, profile_id, version, origin, "plan", summary)
  VALUES (v_plan.id, p_owner, p_expected_version + 1, p_origin, p_plan, p_summary)
  RETURNING * INTO v_version;
  UPDATE public.plan SET active_version_id = v_version.id WHERE id = v_plan.id RETURNING * INTO v_plan;
  IF p_message IS NOT NULL THEN
    INSERT INTO public.chat_message(profile_id, plan_id, "role", content, request_id)
    VALUES (p_owner, v_plan.id, 'user', p_message, p_request_id);
    INSERT INTO public.chat_message(profile_id, plan_id, "role", content, outcome, plan_version_id, request_id)
    VALUES (p_owner, v_plan.id, 'assistant', p_summary, 'plan_updated', v_version.id, p_request_id);
  END IF;
  v_result := jsonb_build_object('plan', to_jsonb(v_plan), 'version', to_jsonb(v_version));
  INSERT INTO public.product_request_receipt(profile_id, action, request_id, payload, result)
  VALUES (p_owner, 'save_plan_version', p_request_id, v_payload, v_result);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.is_valid_feedback(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.touch_activity_opinion() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_plan_version(uuid, uuid, integer, uuid, text, jsonb, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_activity(uuid, uuid, uuid, jsonb, jsonb, jsonb, timestamptz) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.update_completion_feedback(uuid, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_plan_version(uuid, uuid, integer, uuid, text, jsonb, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_activity(uuid, uuid, uuid, jsonb, jsonb, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_completion_feedback(uuid, jsonb) TO authenticated;

COMMIT;
