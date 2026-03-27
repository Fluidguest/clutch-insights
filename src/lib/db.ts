import { supabase } from '@/integrations/supabase/client';

export interface DiscPart {
  name: string;
  status: 'reaproveitar' | 'trocar';
  quantity: number;
}

export interface Disc {
  id: string;
  date: string;
  size: string;
  referenceNumber: string;
  productionNumber: string;
  observation?: string;
  parts: DiscPart[];
  createdAt: string;
}

export const DEFAULT_PARTS = [
  'Chapa lisa',
  'Chapa disco',
  'Cubo',
  'Suporte pre',
  'Tampa pre disco',
  'Coroa reta',
  'Mola externa',
];

export async function getAllDiscs(): Promise<Disc[]> {
  const { data: discs, error } = await supabase
    .from('discs')
    .select('*, disc_parts(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (discs || []).map(d => ({
    id: d.id,
    date: d.date,
    size: d.size,
    referenceNumber: d.reference_number,
    productionNumber: d.production_number,
    observation: d.observation || undefined,
    parts: (d.disc_parts || []).map((p: any) => ({
      name: p.name,
      status: p.status as 'reaproveitar' | 'trocar',
      quantity: p.quantity,
    })),
    createdAt: d.created_at,
  }));
}

export async function getDisc(id: string): Promise<Disc | undefined> {
  const { data, error } = await supabase
    .from('discs')
    .select('*, disc_parts(*)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return undefined;

  return {
    id: data.id,
    date: data.date,
    size: data.size,
    referenceNumber: data.reference_number,
    productionNumber: data.production_number,
    parts: (data.disc_parts || []).map((p: any) => ({
      name: p.name,
      status: p.status as 'reaproveitar' | 'trocar',
      quantity: p.quantity,
    })),
    createdAt: data.created_at,
  };
}

export async function saveDisc(disc: Omit<Disc, 'id' | 'createdAt'>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('discs')
    .insert({
      user_id: user.id,
      date: disc.date,
      size: disc.size,
      reference_number: disc.referenceNumber,
      production_number: disc.productionNumber,
    })
    .select('id')
    .single();

  if (error || !data) throw error || new Error('Erro ao salvar disco');

  const partsToInsert = disc.parts.map(p => ({
    disc_id: data.id,
    name: p.name,
    status: p.status,
    quantity: p.quantity,
  }));

  const { error: partsError } = await supabase.from('disc_parts').insert(partsToInsert);
  if (partsError) throw partsError;
}

export async function deleteDisc(id: string): Promise<void> {
  const { error } = await supabase.from('discs').delete().eq('id', id);
  if (error) throw error;
}
