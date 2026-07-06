
CREATE TABLE public.user_pairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, pair)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_pairs TO authenticated;
GRANT ALL ON public.user_pairs TO service_role;
ALTER TABLE public.user_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved pairs"
  ON public.user_pairs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
