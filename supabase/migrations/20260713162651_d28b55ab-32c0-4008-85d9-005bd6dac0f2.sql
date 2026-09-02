-- Impede que o usuário logado altere os campos de acesso pago
-- (has_access, access_type, access_granted_at) via o cliente Supabase.
-- Somente o service_role pode escrever essas colunas — usado pelo webhook
-- de pagamento e por rotinas administrativas.

CREATE OR REPLACE FUNCTION public.guard_profile_access_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role_name TEXT := current_setting('role', true);
BEGIN
  -- service_role e postgres (rotinas internas) podem alterar tudo.
  IF current_role_name IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Para qualquer outro role (authenticated/anon), preserva os valores antigos
  -- das colunas privilegiadas. Assim, mesmo que o cliente envie um payload
  -- tentando setar has_access=true, o valor é revertido silenciosamente.
  NEW.has_access := OLD.has_access;
  NEW.access_type := OLD.access_type;
  NEW.access_granted_at := OLD.access_granted_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_access_fields_trg ON public.profiles;
CREATE TRIGGER guard_profile_access_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_access_fields();

-- Reforço explícito nos privilégios (defesa em profundidade). O trigger
-- acima é a barreira efetiva; os grants abaixo só documentam a intenção.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;