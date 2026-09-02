CREATE TABLE public.magneto_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid,
  source text not null default 'direction',
  points integer not null default 10,
  created_at timestamptz not null default now(),
  unique (user_id, plan_id)
);
GRANT SELECT, INSERT ON public.magneto_awards TO authenticated;
GRANT ALL ON public.magneto_awards TO service_role;
ALTER TABLE public.magneto_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own magneto awards" ON public.magneto_awards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own magneto awards" ON public.magneto_awards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.antenna_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_key text not null,
  threshold integer not null default 0,
  seen boolean not null default false,
  unlocked_at timestamptz not null default now(),
  unique (user_id, level_key)
);
GRANT SELECT, INSERT, UPDATE ON public.antenna_unlocks TO authenticated;
GRANT ALL ON public.antenna_unlocks TO service_role;
ALTER TABLE public.antenna_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own antenna unlocks" ON public.antenna_unlocks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own antenna unlocks" ON public.antenna_unlocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own antenna unlocks" ON public.antenna_unlocks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.magneto_awards (user_id, plan_id, source, points, created_at)
SELECT p.user_id, p.id, 'direction', 10, coalesce(p.completed_at, now())
FROM public.user_plans p
WHERE p.status = 'completed'
ON CONFLICT DO NOTHING;

INSERT INTO public.antenna_unlocks (user_id, level_key, threshold, seen)
SELECT t.user_id, t.level_key, t.threshold, true
FROM (
  SELECT a.user_id, l.level_key, l.threshold
  FROM (SELECT user_id, sum(points) AS total FROM public.magneto_awards GROUP BY user_id) a
  CROSS JOIN (VALUES
    ('blue',0),('green',100),('yellow',250),('orange',450),('red',700),('pink',1000),
    ('purple',1400),('bronze',1900),('silver',2500),('gold',3300),('black',4500)
  ) AS l(level_key, threshold)
  WHERE a.total >= l.threshold
) t
ON CONFLICT DO NOTHING;