import { useParams, useNavigate } from 'react-router-dom';
import { getDisc, deleteDisc } from '@/lib/db';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Recycle, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DiscDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const disc = id ? getDisc(id) : undefined;

  if (!disc) {
    return (
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
        <p className="text-center text-muted-foreground mt-20">Disco não encontrado</p>
      </div>
    );
  }

  const totalQty = disc.parts.reduce((s, p) => s + (p.quantity || 1), 0);
  const reuseQty = disc.parts.filter(p => p.status === 'reaproveitar').reduce((s, p) => s + (p.quantity || 1), 0);
  const swapQty = disc.parts.filter(p => p.status === 'trocar').reduce((s, p) => s + (p.quantity || 1), 0);
  const pct = totalQty > 0 ? Math.round((reuseQty / totalQty) * 100) : 0;

  const handleDelete = () => {
    deleteDisc(disc.id);
    toast.success('Disco removido');
    navigate('/');
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto animate-fade-in">
      <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3 active:scale-95">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-xl font-bold mb-4">Detalhes do Disco</h1>

      <div className="bg-card rounded-lg p-4 border border-border shadow-sm space-y-3 mb-4">
        <Row label="Data" value={format(new Date(disc.date), "dd/MM/yyyy", { locale: ptBR })} />
        <Row label="Tamanho" value={disc.size} />
        <Row label="Nº Referência" value={disc.referenceNumber} />
        <Row label="Nº Produção" value={disc.productionNumber} />
      </div>

      <div className="flex gap-2 mb-4">
        <Stat label="Reaproveitar" value={reuseQty} color="text-success" />
        <Stat label="Trocar" value={swapQty} color="text-destructive" />
        <Stat label="Reaprov. %" value={`${pct}%`} color="text-primary" />
      </div>

      <h2 className="font-semibold text-sm mb-2">Peças</h2>
      <div className="space-y-2 mb-6">
        {disc.parts.map((part, idx) => {
          const isReuse = part.status === 'reaproveitar';
          return (
            <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${
              isReuse ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
            }`}>
              {isReuse ? <Recycle className="w-4 h-4 text-success" /> : <RefreshCw className="w-4 h-4 text-destructive" />}
              <span className="text-sm flex-1">{part.name}</span>
              <span className="text-xs font-medium text-muted-foreground mr-1">×{part.quantity || 1}</span>
              <span className={`text-xs font-semibold ${isReuse ? 'text-success' : 'text-destructive'}`}>
                {isReuse ? 'Reaproveitar' : 'Trocar'}
              </span>
            </div>
          );
        })}
      </div>

      <Button variant="destructive" onClick={handleDelete} className="w-full h-12">
        <Trash2 className="w-4 h-4 mr-2" /> Excluir Disco
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex-1 bg-card rounded-lg p-3 border border-border text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
