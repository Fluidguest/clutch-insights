import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPartsCatalog, saveDisc, type DiscPart, type PartsCatalog } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function NewDisc() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [size, setSize] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [prodNumber, setProdNumber] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const [parts, setParts] = useState<DiscPart[]>([]);
  const [partsCatalog, setPartsCatalog] = useState<PartsCatalog[]>([]);
  const [loadingParts, setLoadingParts] = useState(true);

  useEffect(() => {
    getPartsCatalog()
      .then(catalog => {
        setPartsCatalog(catalog);
        setParts(catalog.map(p => ({ name: p.name, status: 'reaproveitar', quantity: 1 })));
        setLoadingParts(false);
      })
      .catch(err => {
        console.error('Erro ao carregar peças:', err);
        setLoadingParts(false);
      });
  }, []);

  const handleNext = () => {
    if (!size || !refNumber || !prodNumber) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    const prodQty = parseInt(prodNumber);
    if (isNaN(prodQty) || prodQty < 1) {
      toast.error('Quantidade de produção deve ser um número válido');
      return;
    }
    setParts(prev => prev.map(p => ({ ...p, quantity: prodQty, status: 'reaproveitar' as const })));
    setStep(2);
  };

  const updateQty = (idx: number, delta: number) => {
    setParts(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const prodQty = parseInt(prodNumber) || 1;
      const newQty = Math.max(0, p.quantity + delta);
      return {
        ...p,
        quantity: newQty,
        status: newQty < prodQty ? 'trocar' as const : 'reaproveitar' as const,
      };
    }));
  };

  const handleQtyChange = (idx: number, value: string) => {
    const prodQty = parseInt(prodNumber) || 1;
    const num = parseInt(value);
    if (!isNaN(num)) {
      const clamped = Math.max(0, num);
      setParts(prev => prev.map((p, i) =>
        i === idx ? {
          ...p,
          quantity: clamped,
          status: clamped < prodQty ? 'trocar' as const : 'reaproveitar' as const,
        } : p
      ));
    } else if (value === '') {
      setParts(prev => prev.map((p, i) =>
        i === idx ? { ...p, quantity: 0, status: 'trocar' as const } : p
      ));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveDisc({
        date,
        size,
        referenceNumber: refNumber,
        productionNumber: prodNumber,
        observation: observation || undefined,
        parts,
      });
      toast.success('Disco cadastrado com sucesso!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar disco');
    } finally {
      setSaving(false);
    }
  };

  const prodQty = parseInt(prodNumber) || 1;

  if (loadingParts) {
    return (
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
        <p className="text-center text-muted-foreground mt-20">Carregando peças...</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto animate-fade-in">
      {step === 1 ? (
        <>
          <h1 className="text-xl font-bold mb-4">Novo Disco</h1>
          <div className="space-y-4">
            <div>
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 h-12 text-base" />
            </div>
            <div>
              <Label htmlFor="size">Tamanho do disco *</Label>
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
              Próximo — Selecionar Peças
            </Button>
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-xl font-bold mb-1">Peças do Disco</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Quantidade de produção: <strong>{prodQty}</strong> — Diminua a quantidade para indicar peças trocadas
          </p>

          <div className="space-y-2">
            {parts.map((part, idx) => {
              const trocadas = prodQty - part.quantity;
              const hasSwaps = trocadas > 0;
              return (
                <div
                  key={idx}
                  className={`w-full rounded-lg border-2 transition-all overflow-hidden ${
                    hasSwaps ? 'border-destructive/40 bg-destructive/5' : 'border-success/40 bg-success/5'
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm block">{part.name}</span>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-success font-semibold">
                          Reaprov: {part.quantity}
                        </span>
                        {hasSwaps && (
                          <span className="text-xs text-destructive font-semibold">
                            Trocadas: {trocadas}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateQty(idx, -1)}
                        className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center active:scale-95"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        value={part.quantity}
                        onChange={(e) => handleQtyChange(idx, e.target.value)}
                        className="w-12 h-9 text-center font-bold text-base bg-transparent border-none focus:ring-0 tabular-nums"
                        inputMode="numeric"
                      />
                      <button
                        onClick={() => updateQty(idx, 1)}
                        className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <Label htmlFor="obs">Observação (opcional)</Label>
            <Textarea
              id="obs"
              placeholder="Adicione uma observação sobre este disco..."
              value={observation}
              onChange={e => setObservation(e.target.value)}
              className="mt-1 text-sm"
              rows={3}
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-14 text-base font-semibold mt-6">
            {saving ? 'Salvando...' : 'Salvar Disco'}
          </Button>
        </>
      )}
    </div>
  );
}
