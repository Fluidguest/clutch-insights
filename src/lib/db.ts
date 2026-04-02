import { supabase } from '@/integrations/supabase/client';

export type EquipmentType = 'disco' | 'plator';

export interface DiscPart {
  name: string;
  status: 'reaproveitar' | 'trocar';
  quantity: number;
  swappedQuantity: number;
}

export interface Disc {
  id: string;
  date: string;
  size: string;
  referenceNumber: string;
  productionNumber: string;
  observation?: string;
  equipmentType: EquipmentType;
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

export interface PartsCatalog {
  id: string;
  name: string;
  displayOrder: number;
  equipmentType: string;
  createdAt: string;
  updatedAt: string;
}

export async function getPartsCatalog(equipmentType?: string): Promise<PartsCatalog[]> {
  let query = (supabase as any)
    .from('parts_catalog')
    .select('*')
    .order('display_order', { ascending: true });

  if (equipmentType) {
    query = query.eq('equipment_type', equipmentType);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    displayOrder: p.display_order,
    equipmentType: p.equipment_type || 'disco',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

export async function addPart(name: string, displayOrder?: number): Promise<PartsCatalog> {
  const { data: existing } = await (supabase as any)
    .from('parts_catalog')
    .select('id, display_order')
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = displayOrder ?? ((existing?.[0]?.display_order ?? 0) + 1);

  const { data, error } = await (supabase as any)
    .from('parts_catalog')
    .insert({ name, display_order: nextOrder })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    displayOrder: data.display_order,
    equipmentType: data.equipment_type || 'disco',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updatePart(id: string, name: string, displayOrder?: number): Promise<PartsCatalog> {
  const updates: any = { name };
  if (displayOrder !== undefined) {
    updates.display_order = displayOrder;
  }

  const { data, error } = await (supabase as any)
    .from('parts_catalog')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    displayOrder: data.display_order,
    equipmentType: data.equipment_type || 'disco',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deletePart(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('parts_catalog')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getAllDiscs(): Promise<Disc[]> {
  const { data: discs, error } = await supabase
    .from('discs')
    .select('*, disc_parts(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (discs || []).map((d: any) => ({
    id: d.id,
    date: d.date,
    size: d.size,
    referenceNumber: d.reference_number,
    productionNumber: d.production_number,
    observation: d.observation || undefined,
    equipmentType: (d.equipment_type || 'disco') as EquipmentType,
    parts: (d.disc_parts || []).map((p: any) => ({
      name: p.name,
      status: p.status as 'reaproveitar' | 'trocar',
      quantity: p.quantity,
      swappedQuantity: p.swapped_quantity || 0,
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
    observation: (data as any).observation || undefined,
    equipmentType: ((data as any).equipment_type || 'disco') as EquipmentType,
    parts: (data.disc_parts || []).map((p: any) => ({
      name: p.name,
      status: p.status as 'reaproveitar' | 'trocar',
      quantity: p.quantity,
      swappedQuantity: p.swapped_quantity || 0,
    })),
    createdAt: data.created_at,
  };
}

export async function saveDisc(disc: Omit<Disc, 'id' | 'createdAt'>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await (supabase as any)
    .from('discs')
    .insert({
      user_id: user.id,
      date: disc.date,
      size: disc.size,
      reference_number: disc.referenceNumber,
      production_number: disc.productionNumber,
      observation: disc.observation || null,
      equipment_type: disc.equipmentType || 'disco',
    })
    .select('id')
    .single();

  if (error || !data) throw error || new Error('Erro ao salvar disco');

  const partsToInsert = disc.parts.map(p => ({
    disc_id: data.id,
    name: p.name,
    status: p.swappedQuantity > 0 ? 'trocar' : 'reaproveitar',
    quantity: p.quantity,
    swapped_quantity: p.swappedQuantity,
  }));

  const { error: partsError } = await supabase.from('disc_parts').insert(partsToInsert);
  if (partsError) throw partsError;
}

export async function deleteDisc(id: string): Promise<void> {
  const { error } = await supabase.from('discs').delete().eq('id', id);
  if (error) throw error;
}
