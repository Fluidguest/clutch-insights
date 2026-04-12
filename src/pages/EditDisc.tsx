import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDisc, getPartsCatalog, updateDisc, type Disc, type DiscPart, type PartsCatalog, type EquipmentType } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ArrowLeft, Minus, Plus } from 'lucide-react';

export default function EditDisc() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('disco');
  const [date, setDate] = useState('');
  const [size, setSize] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [prodNumber, setProdNumber] = useState('');
  const [observation, setObservation] = useState('');
  const [parts, setParts] = useState<(DiscPart & { enabled: boolean })[]>([]);
  const [allCatalog, setAllCatalog] = useState<PartsCatalog[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([getDisc(id), getPartsCatalog()]).then(([disc, catalog]) => {
      setAllCatalog(catalog);
      if (!disc) { setLoading(false); return; }
      setEquipmentType(disc.equipmentType);
      setDate(disc.date);
      setSize(disc.size);
      setRefNumber(disc.referenceNumber);
      setProdNumber(disc.productionNumber);
      setObservation(disc.observation || '');

      // Build parts from catalog, merging saved values
      const catalogParts = catalog.filter(p => p.equipmentType === disc.equipmentType);
      const savedMap = new Map(disc.parts.map(p => [p.name, p]));
      const merged = catalogParts.map(cp => {
        const saved = savedMap.get(cp.name);
        if (saved) {
          return { ...saved, enabled: true };
        }
        return { name: cp.name, status: 'reaproveitar' as const, quantity: 0, swappedQuantity: 0, enabled: false };
      });
      // Add any saved parts not in catalog
      disc.parts.forEach(p => {
        if (!catalogParts.find(cp => cp.name === p.name)) {
          merged.push({ ...p, enabled: true });
        }
      });
      setParts(merged);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleNext = () => {
    if (!size || !refNumber || !prodNumber) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    // Rebuild parts if equipment type changed
    const currentType = parts.length > 0 ? allCatalog.find(c => c.name === parts[0]?.name)?.equipmentType : null;
    if (currentType && currentType !== equipmentType) {
      const filtered = allCatalog.filter(p => p.equipmentType === equipmentType);
      const prodQty = parseInt(prodNumber) || 1;
      setParts(filtered.map(p => ({ name: p.name, status: 'reaproveitar' as const, quantity: prodQty, swappedQuantity: 0, enabled: true })));
    }
    setStep(2);
  };

  const updateField = (idx: number, field: 'quantity' | 'swappedQuantity', value: string) => {
    const num = parseInt(value);
    const val = isNaN(num) ? 0 : Math.max(0, num);
    setParts(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const updated = { ...p, [field]: val };
      updated.status = updated.swappedQuantity > 0 ? 'trocar' : 'reaproveitar';
      return updated;
    }));
  };

  const adjustField = (idx: number, field: 'quantity' | 'swappedQuantity', delta: number) => {
    setParts(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const newVal = Math.max(0, p[field] + delta);
      const updated = { ...p, [field]: newVal };
      updated.status = updated.swappedQuantity > 0 ? 'trocar' : 'reaproveitar';
      return updated;
    }));
  };

  const handleSave = async () => {
    if (!id) return;
    const enabledParts = parts.filter(p => p.enabled).map(({ enabled, ...rest }) => rest);
    setSaving(true);
    try {
      await updateDisc(id, {
        date,
        size,
        referenceNumber: refNumber,
        productionNumber: prodNumber,
        observation: observation || undefined,
        equipmentType,
        parts: enabledParts,
      });
      toast.success('Registro atualizado com sucesso!');
      navigate(`/disc/${id}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="px-4 pt-4 pb-24 max-w-lg mx-auto"><p className="text-center text-muted-foreground mt-20">Carregando...</p></div>;
  }

  const typeLabel = equipmentType === 'disco' ? 'Disco' : 'Plator';

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto animate-fade-in">
      {step === 1 ? (
        <>
          <button onClick={() => navigate(`/disc/${id}`)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-xl font-bold mb-4">Editar Cadastro</h1>

          <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1">
            {(['disco', 'plator'] as const).map(type => (
              <button
                key={type}
                onClick={() => setEquipmentType(type)}
                className={`flex-1 py-2.5 px-3 rounded-md text-sm font-semibold transition-all ${
                  equipmentType === type ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'disco' ? 'Disco' : 'Plator'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 h-12 text-base" />
            </div>
            <div>
              <Label htmlFor="size">Tamanho do {typeLabel.toLowerCase()} *</Label>
              <Input id="size" placeholder="Ex: 200mm, 4300mm" value={size} onChange={e => setSize(e.target.value)} className="mt-1 h-12 text-base" />
            </div>
            <div>
              <Label htmlFor="ref">Nº de referência *</Label>
              <Input id="ref" placeholder="Número de referência" value={refNumber} onChange={e => setRefNumber(e.target.value)} className="mt-1 h-12 text-base" />
            </div>
            <div>
              <Label htmlFor="prod">Quantidade de produção *</Label>
              <Input id="prod" type="number" inputMode="numeric" placeholder="Ex: 10" value={prodNumber} onChange={e => setProdNumber(e.target.value)} className="mt-1 h-12 text-base" />
            </div>
            <Button onClick={handleNext} className="w-full h-14 text-base font-semibold mt-2">
              Próximo — Editar Peças
            </Button>
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-xl font-bold mb-1">Peças do {typeLabel}</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Quantidade de produção: <strong>{parseInt(prodNumber) || 1}</strong>
          </p>

          <div className="space-y-3">
            {parts.map((part, idx) => {
              const hasSwaps = part.swappedQuantity > 0;
              return (
                <div
                  key={idx}
                  className={`w-full rounded-lg border-2 transition-all overflow-hidden ${
                    !part.enabled
                      ? 'border-border bg-muted/50 opacity-60'
                      : hasSwaps ? 'border-destructive/40 bg-destructive/5' : 'border-success/40 bg-success/5'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Checkbox
                        checked={part.enabled}
                        onCheckedChange={(checked) =>
                          setParts(prev => prev.map((p, i) => i === idx ? { ...p, enabled: !!checked } : p))
                        }
                      />
                      <span className={`font-medium text-sm ${!part.enabled ? 'line-through text-muted-foreground' : ''}`}>{part.name}</span>
                    </div>
                    {part.enabled && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-success font-semibold">Reaproveitadas</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => adjustField(idx, 'quantity', -1)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center active:scale-95"><Minus className="w-3.5 h-3.5" /></button>
                            <input type="number" value={part.quantity} onChange={e => updateField(idx, 'quantity', e.target.value)} className="w-14 h-8 text-center font-bold text-sm bg-transparent border border-border rounded-md focus:ring-0 tabular-nums" inputMode="numeric" />
                            <button onClick={() => adjustField(idx, 'quantity', 1)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center active:scale-95"><Plus className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-destructive font-semibold">Trocadas</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => adjustField(idx, 'swappedQuantity', -1)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center active:scale-95"><Minus className="w-3.5 h-3.5" /></button>
                            <input type="number" value={part.swappedQuantity} onChange={e => updateField(idx, 'swappedQuantity', e.target.value)} className="w-14 h-8 text-center font-bold text-sm bg-transparent border border-border rounded-md focus:ring-0 tabular-nums" inputMode="numeric" />
                            <button onClick={() => adjustField(idx, 'swappedQuantity', 1)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center active:scale-95"><Plus className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <Label htmlFor="obs">Observação (opcional)</Label>
            <Textarea id="obs" placeholder="Adicione uma observação..." value={observation} onChange={e => setObservation(e.target.value)} className="mt-1 text-sm" rows={3} />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-14 text-base font-semibold mt-6">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </>
      )}
    </div>
  );
}