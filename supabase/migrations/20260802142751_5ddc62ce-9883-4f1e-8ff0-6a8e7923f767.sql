CREATE TABLE public.shared_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid,
  title text NOT NULL,
  description text NOT NULL,
  reason text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  executed_at timestamptz,
  CONSTRAINT shared_directions_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT shared_directions_status_chk CHECK (status IN ('pending','accepted','declined','archived')),
  CONSTRAINT shared_directions_message_len CHECK (message IS NULL OR char_length(message) <= 120)
);

CREATE INDEX shared_directions_recipient_idx ON public.shared_directions (recipient_id, status, created_at DESC);
CREATE INDEX shared_directions_sender_idx ON public.shared_directions (sender_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.shared_directions TO authenticated;
GRANT ALL ON public.shared_directions TO service_role;

ALTER TABLE public.shared_directions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view shared directions"
  ON public.shared_directions FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Senders can share directions"
  ON public.shared_directions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND sender_id <> recipient_id);

CREATE POLICY "Recipients can respond to shared directions"
  ON public.shared_directions FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.search_imag_people(_q text)
RETURNS TABLE (id uuid, handle text, full_name text, avatar_url text, profession text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.handle, p.full_name, p.avatar_url, p.profession
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND p.handle IS NOT NULL
    AND char_length(btrim(coalesce(_q, ''))) >= 2
    AND (
      p.handle ILIKE '%' || btrim(_q) || '%'
      OR coalesce(p.full_name, '') ILIKE '%' || btrim(_q) || '%'
    )
  ORDER BY (p.handle ILIKE btrim(_q) || '%') DESC, p.full_name NULLS LAST
  LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.recent_direction_contacts()
RETURNS TABLE (id uuid, handle text, full_name text, avatar_url text, profession text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH counterparties AS (
    SELECT CASE WHEN s.sender_id = auth.uid() THEN s.recipient_id ELSE s.sender_id END AS uid,
           max(s.created_at) AS last_at
    FROM public.shared_directions s
    WHERE auth.uid() IS NOT NULL
      AND (s.sender_id = auth.uid() OR s.recipient_id = auth.uid())
    GROUP BY 1
  )
  SELECT p.id, p.handle, p.full_name, p.avatar_url, p.profession
  FROM counterparties c
  JOIN public.profiles p ON p.id = c.uid
  ORDER BY c.last_at DESC
  LIMIT 8;
$$;

GRANT EXECUTE ON FUNCTION public.search_imag_people(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recent_direction_contacts() TO authenticated;