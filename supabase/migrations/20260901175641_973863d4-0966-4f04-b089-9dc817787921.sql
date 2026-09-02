CREATE TABLE public.mag_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  subject text,
  value jsonb not null default '{}'::jsonb,
  local_date date,
  hour smallint,
  created_at timestamptz not null default now()
);
CREATE INDEX mag_signals_user_created_idx ON public.mag_signals (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mag_signals TO authenticated;
GRANT ALL ON public.mag_signals TO service_role;
ALTER TABLE public.mag_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mag_signals" ON public.mag_signals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mag_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  category text not null default 'padrao',
  label text not null,
  value text not null,
  confidence numeric not null default 0.5,
  source text not null default 'observed',
  evidence_count integer not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
CREATE INDEX mag_memory_user_idx ON public.mag_memory (user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mag_memory TO authenticated;
GRANT ALL ON public.mag_memory TO service_role;
ALTER TABLE public.mag_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mag_memory" ON public.mag_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mag_memory_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fact_key text not null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  answer text,
  status text not null default 'pending',
  asked_at timestamptz not null default now(),
  answered_at timestamptz
);
CREATE INDEX mag_memory_questions_user_idx ON public.mag_memory_questions (user_id, status, asked_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mag_memory_questions TO authenticated;
GRANT ALL ON public.mag_memory_questions TO service_role;
ALTER TABLE public.mag_memory_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mag_memory_questions" ON public.mag_memory_questions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER mag_memory_touch BEFORE UPDATE ON public.mag_memory
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();