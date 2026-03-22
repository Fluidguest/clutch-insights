// Local storage based DB for offline-first operation

export interface DiscPart {
  name: string;
  status: 'reaproveitar' | 'trocar';
}

export interface Disc {
  id: string;
  date: string;
  size: string;
  referenceNumber: string;
  productionNumber: string;
  parts: DiscPart[];
  createdAt: string;
}

const STORAGE_KEY = 'clutch_discs_data';

export const DEFAULT_PARTS = [
  'Chapa lisa',
  'Chapa disco',
  'Cubo',
  'Suporte pre',
  'Tampa pre disco',
  'Coroa reta',
  'Mola externa',
];

export function getAllDiscs(): Disc[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function getDisc(id: string): Disc | undefined {
  return getAllDiscs().find(d => d.id === id);
}

export function saveDisc(disc: Disc): void {
  const discs = getAllDiscs();
  const idx = discs.findIndex(d => d.id === disc.id);
  if (idx >= 0) {
    discs[idx] = disc;
  } else {
    discs.push(disc);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(discs));
}

export function deleteDisc(id: string): void {
  const discs = getAllDiscs().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(discs));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
