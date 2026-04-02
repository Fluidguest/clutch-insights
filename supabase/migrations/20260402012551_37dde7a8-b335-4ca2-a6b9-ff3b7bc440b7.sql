
-- Add equipment type to discs
ALTER TABLE public.discs ADD COLUMN equipment_type text NOT NULL DEFAULT 'disco';

-- Add swapped_quantity to disc_parts (trocadas)
ALTER TABLE public.disc_parts ADD COLUMN swapped_quantity integer NOT NULL DEFAULT 0;

-- Add equipment_type to parts_catalog
ALTER TABLE public.parts_catalog ADD COLUMN equipment_type text NOT NULL DEFAULT 'disco';

-- Update existing parts to be disco type
UPDATE public.parts_catalog SET equipment_type = 'disco';

-- Insert plator parts
INSERT INTO public.parts_catalog (name, display_order, equipment_type) VALUES
  ('Placa', 1, 'plator'),
  ('Membrana', 2, 'plator'),
  ('Tampa', 3, 'plator');
