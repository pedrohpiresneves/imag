
-- Support chat conversations
CREATE TABLE public.support_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT,
  user_last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_last_read_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own conversation"
  ON public.support_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own conversation"
  ON public.support_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own read cursor"
  ON public.support_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER support_conversations_touch
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Messages
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user','admin')),
  body TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_conv_created ON public.support_messages(conversation_id, created_at);

GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read messages in own conversation"
  ON public.support_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "User sends message in own conversation"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (sender_role = 'user' AND EXISTS (
        SELECT 1 FROM public.support_conversations c
        WHERE c.id = conversation_id AND c.user_id = auth.uid()
      ))
      OR (sender_role = 'admin' AND public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE OR REPLACE FUNCTION public.support_after_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_conversations
     SET last_message_at = NEW.created_at,
         last_message_preview = LEFT(COALESCE(NEW.body, '[anexo]'), 160),
         status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END,
         user_last_read_at = CASE WHEN NEW.sender_role = 'user' THEN NEW.created_at ELSE user_last_read_at END,
         admin_last_read_at = CASE WHEN NEW.sender_role = 'admin' THEN NEW.created_at ELSE admin_last_read_at END
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_messages_after_insert
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_after_message_insert();

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- Storage policies (bucket already exists)
CREATE POLICY "Support: read own or admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "Support: upload own or admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "Support: delete own or admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
