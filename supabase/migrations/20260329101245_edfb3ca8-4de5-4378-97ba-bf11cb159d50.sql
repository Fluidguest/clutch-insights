-- Create table for configurable parts catalog
CREATE TABLE public.parts_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parts_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policies for parts_catalog
CREATE POLICY "Everyone can view parts"
ON public.parts_catalog FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert parts"
ON public.parts_catalog FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update parts"
ON public.parts_catalog FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete parts"
ON public.parts_catalog FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default parts
INSERT INTO public.parts_catalog (name, display_order) VALUES
  ('Chapa lisa', 1),
  ('Chapa disco', 2),
  ('Cubo', 3),
  ('Suporte pre', 4),
  ('Tampa pre disco', 5),
  ('Coroa reta', 6),
  ('Mola externa', 7);