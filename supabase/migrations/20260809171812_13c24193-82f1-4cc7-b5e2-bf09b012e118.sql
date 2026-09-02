CREATE TABLE public.connected_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'instagram' CHECK (provider IN ('instagram')),
  provider_account_id text,
  provider_username text,
  connection_status text NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected','disconnected','expired','error')),
  access_token_encrypted text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT (id, user_id, provider, provider_account_id, provider_username, connection_status, token_expires_at, connected_at, disconnected_at, created_at, updated_at) ON public.connected_accounts TO authenticated;
GRANT INSERT (id, user_id, provider, provider_account_id, provider_username, connection_status, connected_at, disconnected_at) ON public.connected_accounts TO authenticated;
GRANT UPDATE (provider_account_id, provider_username, connection_status, connected_at, disconnected_at) ON public.connected_accounts TO authenticated;
GRANT DELETE ON public.connected_accounts TO authenticated;
GRANT ALL ON public.connected_accounts TO service_role;

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own connected accounts"
  ON public.connected_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER connected_accounts_touch
  BEFORE UPDATE ON public.connected_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();