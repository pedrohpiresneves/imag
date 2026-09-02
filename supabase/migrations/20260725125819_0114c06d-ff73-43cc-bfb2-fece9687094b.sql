
-- Add iMAG handle to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS handle_updated_at timestamptz;

-- Format check: 3-30 chars, only [a-z0-9.], no leading/trailing dot, no consecutive dots
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_handle_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_handle_format
  CHECK (
    handle IS NULL OR (
      handle ~ '^[a-z0-9]([a-z0-9.]{1,28}[a-z0-9])?$'
      AND handle !~ '\.\.'
      AND length(handle) BETWEEN 3 AND 30
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_unique_idx
  ON public.profiles (handle)
  WHERE handle IS NOT NULL;

-- Allow the trigger below to freely update handle/handle_updated_at
-- (guard_profile_access_fields only locks access/subscription fields; handle isn't there, so fine)

-- Normalize any user-provided string into a valid handle body (no im. prefix)
CREATE OR REPLACE FUNCTION public.normalize_handle_body(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN length(cleaned) < 3 THEN NULL
      WHEN length(cleaned) > 30 THEN substring(cleaned from 1 for 30)
      ELSE cleaned
    END
  FROM (
    SELECT
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              coalesce(_raw, ''),
              'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
              'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
            )
          ),
          '[^a-z0-9.]', '', 'g'
        ),
        '\.+', '.', 'g'
      ) AS cleaned
  ) s;
$$;

-- Check availability (case-insensitive via lower); ignores caller's own row
CREATE OR REPLACE FUNCTION public.check_handle_available(_handle text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE handle = _handle
      AND (auth.uid() IS NULL OR id <> auth.uid())
  );
$$;

-- Suggest 3 alternatives given a base body
CREATE OR REPLACE FUNCTION public.suggest_handles(_base text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text := public.normalize_handle_body(_base);
  candidates text[] := ARRAY[]::text[];
  candidate text;
  suffixes text[];
  i int;
BEGIN
  IF base IS NULL THEN base := 'user'; END IF;
  suffixes := ARRAY['01','02','pro','oficial','mag','br',to_char(now(),'YY')];
  -- Try base itself
  IF public.check_handle_available(base) THEN
    candidates := candidates || base;
  END IF;
  FOR i IN 1..array_length(suffixes,1) LOOP
    IF array_length(candidates,1) IS NOT NULL AND array_length(candidates,1) >= 3 THEN
      EXIT;
    END IF;
    candidate := public.normalize_handle_body(base || '.' || suffixes[i]);
    IF candidate IS NOT NULL AND public.check_handle_available(candidate) THEN
      candidates := candidates || candidate;
    END IF;
  END LOOP;
  -- Fallback with random suffix
  WHILE array_length(candidates,1) IS NULL OR array_length(candidates,1) < 3 LOOP
    candidate := public.normalize_handle_body(base || '.' || floor(random()*9000+1000)::text);
    IF candidate IS NOT NULL AND public.check_handle_available(candidate) THEN
      candidates := candidates || candidate;
    END IF;
  END LOOP;
  RETURN candidates;
END;
$$;

-- Set/change handle with 30-day cooldown
CREATE OR REPLACE FUNCTION public.set_my_handle(_handle text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  normalized text;
  current_handle text;
  last_change timestamptz;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  normalized := public.normalize_handle_body(_handle);
  IF normalized IS NULL OR length(normalized) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_format');
  END IF;

  SELECT handle, handle_updated_at INTO current_handle, last_change
    FROM public.profiles WHERE id = uid;

  IF current_handle = normalized THEN
    RETURN jsonb_build_object('ok', true, 'handle', normalized, 'unchanged', true);
  END IF;

  IF current_handle IS NOT NULL AND last_change IS NOT NULL
     AND last_change > now() - interval '30 days' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'cooldown',
      'next_allowed_at', last_change + interval '30 days'
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = normalized AND id <> uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'taken');
  END IF;

  UPDATE public.profiles
     SET handle = normalized,
         handle_updated_at = now()
   WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'handle', normalized);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_handle_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_handles(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_handle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_handle_body(text) TO anon, authenticated;
