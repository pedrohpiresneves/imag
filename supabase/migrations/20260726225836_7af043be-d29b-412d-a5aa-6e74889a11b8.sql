CREATE TABLE public.login_attempts (
  id bigserial PRIMARY KEY,
  ip_hash text,
  identifier_hash text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_ip_idx ON public.login_attempts (ip_hash, attempted_at DESC);
CREATE INDEX login_attempts_identifier_idx ON public.login_attempts (identifier_hash, attempted_at DESC);

GRANT ALL ON public.login_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.login_attempts_id_seq TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role (bypass RLS) acessa.