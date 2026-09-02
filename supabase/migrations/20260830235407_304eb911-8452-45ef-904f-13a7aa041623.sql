CREATE TABLE public.mentor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  pinned boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mentor_conversations_user_idx ON public.mentor_conversations (user_id, pinned DESC, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_conversations TO authenticated;
GRANT ALL ON public.mentor_conversations TO service_role;
ALTER TABLE public.mentor_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mentor conversations" ON public.mentor_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.mentor_messages ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.mentor_conversations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS mentor_messages_conversation_idx ON public.mentor_messages (conversation_id, created_at);