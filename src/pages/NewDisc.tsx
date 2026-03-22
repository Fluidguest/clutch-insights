import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PARTS, saveDisc, generateId, type DiscPart } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { RefreshCw, Recycle, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default function NewDisc() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [size, setSize] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [prodNumber, setProdNumber] = useState('');
  const [parts, setParts] = useState<DiscPart[]>(
    DEFAULT_PARTS.map(name => ({ name, status: 'reaproveitar' }))
  );

  const handleNext = () => {
    if (!size || !refNumber || !prodNumber) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setStep(2);
  };

  const togglePart = (idx: number) => {
    setParts(prev => prev.map((p, i) =>
      i === idx ? { ...p, status: p.status === 'reaproveitar' ? 'trocar' : 'reaproveitar' } : p
    ));
  };

  const handleSave = () => {
    const disc = {
      id: generateId(),
      date,
      size,
      referenceNumber: refNumber,
      productionNumber: prodNumber,
      parts,
      createdAt: new Date().toISOString(),
    };
    saveDisc(disc);
    toast.success('Disco cadastrado com sucesso!');
    navigate('/');
  };

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
              <Label htmlFor="prod">Nº de produção *</Label>
              <Input id="prod" placeholder="Código interno único" value={prodNumber} onChange={e => setProdNumber(e.target.value)} className="mt-1 h-12 text-base" />
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
          <p className="text-sm text-muted-foreground mb-4">Toque para alternar entre reaproveitar e trocar</p>

          <div className="space-y-2">
            {parts.map((part, idx) => {
              const reuse = part.status === 'reaproveitar';
              return (
                <button
                  key={idx}
                  onClick={() => togglePart(idx)}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all active:scale-[0.98] ${
                    reuse
                      ? 'border-success/40 bg-success/5'
                      : 'border-destructive/40 bg-destructive/5'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    reuse ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {reuse ? <Recycle className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                  </div>
                  <span className="font-medium text-sm flex-1 text-left">{part.name}</span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    reuse ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {reuse ? 'Reaproveitar' : 'Trocar'}
                  </span>
                </button>
              );
            })}
          </div>

          <Button onClick={handleSave} className="w-full h-14 text-base font-semibold mt-6">
            Salvar Disco
          </Button>
        </>
      )}
    </div>
  );
}
