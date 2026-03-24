
-- Create table for discs
CREATE TABLE public.discs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  size TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  production_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for disc parts
CREATE TABLE public.disc_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  disc_id UUID NOT NULL REFERENCES public.discs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reaproveitar', 'trocar')),
  quantity INTEGER NOT NULL DEFAULT 1
);

-- Enable RLS
ALTER TABLE public.discs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disc_parts ENABLE ROW LEVEL SECURITY;

-- RLS policies for discs
CREATE POLICY "Users can view their own discs" ON public.discs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own discs" ON public.discs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own discs" ON public.discs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own discs" ON public.discs FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for disc_parts (through disc ownership)
CREATE POLICY "Users can view their own disc parts" ON public.disc_parts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.discs WHERE discs.id = disc_parts.disc_id AND discs.user_id = auth.uid())
);
CREATE POLICY "Users can create parts for their discs" ON public.disc_parts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.discs WHERE discs.id = disc_parts.disc_id AND discs.user_id = auth.uid())
);
CREATE POLICY "Users can update parts for their discs" ON public.disc_parts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.discs WHERE discs.id = disc_parts.disc_id AND discs.user_id = auth.uid())
);
CREATE POLICY "Users can delete parts for their discs" ON public.disc_parts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.discs WHERE discs.id = disc_parts.disc_id AND discs.user_id = auth.uid())
);

-- Index for performance
CREATE INDEX idx_discs_user_id ON public.discs(user_id);
CREATE INDEX idx_disc_parts_disc_id ON public.disc_parts(disc_id);
