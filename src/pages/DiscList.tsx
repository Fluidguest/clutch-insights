import { useNavigate } from 'react-router-dom';
import { getAllDiscs, type Disc } from '@/lib/db';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronRight, Package, LogOut, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.png';

export default function DiscList() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getAllDiscs().then(d => { setDiscs(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const todayDiscs = useMemo(() => discs.filter(d => isToday(parseISO(d.date))), [discs]);
  const olderDiscs = useMemo(() => discs.filter(d => !isToday(parseISO(d.date))), [discs]);
  const visibleDiscs = showAll ? discs : todayDiscs;

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <img src={logo} alt="Logo Controle Embreagem" className="w-10 h-10 rounded-lg" />
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-tight">Cadastros</h1>
          <p className="text-sm text-muted-foreground">{discs.length} registro(s) total</p>
        </div>
        <button onClick={signOut} className="p-2 text-muted-foreground active:scale-95" title="Sair">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p>Carregando...</p>
        </div>
      ) : discs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Package className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-lg font-medium">Nenhum registro cadastrado</p>
          <p className="text-sm mt-1">Toque em "Novo" para começar</p>
        </div>
      ) : (
        <>
          {!showAll && (
            <p className="text-xs text-muted-foreground mb-2">
              Mostrando {todayDiscs.length} registro(s) de hoje
            </p>
          )}
          {showAll && (
            <p className="text-xs text-muted-foreground mb-2">
              Mostrando todos os {discs.length} registro(s)
            </p>
          )}
          <div className="space-y-2">
            {visibleDiscs.length === 0 && !showAll ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Package className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium">Nenhum registro hoje</p>
              </div>
            ) : (
              visibleDiscs.map(disc => <DiscCard key={disc.id} disc={disc} onClick={() => navigate(`/disc/${disc.id}`)} />)
            )}
          </div>

          {!showAll && olderDiscs.length > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full mt-3 py-3 text-sm font-medium text-primary flex items-center justify-center gap-1 active:scale-95 bg-primary/5 rounded-lg"
            >
              <ChevronDown className="w-4 h-4" />
              Ver registros anteriores ({olderDiscs.length})
            </button>
          )}

          {showAll && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full mt-3 py-3 text-sm font-medium text-muted-foreground flex items-center justify-center gap-1 active:scale-95"
            >
              Mostrar apenas hoje
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DiscCard({ disc, onClick }: { disc: Disc; onClick: () => void }) {
  const typeLabel = disc.equipmentType === 'plator' ? 'Plator' : 'Disco';
  const totalReused = disc.parts.reduce((s, p) => s + (p.quantity || 0), 0);
  const totalSwapped = disc.parts.reduce((s, p) => s + (p.swappedQuantity || 0), 0);
  const total = totalReused + totalSwapped;
  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-lg p-4 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform border border-border"
    >
      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
        <Package className="w-5 h-5 text-accent-foreground" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="font-semibold text-sm truncate">{typeLabel} · Qtd. Prod: {disc.productionNumber}</p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(disc.date), "dd/MM/yyyy", { locale: ptBR })} · {disc.size}
        </p>
      </div>
      <div className="text-right shrink-0 mr-1">
        <span className="text-xs font-medium text-success">{totalReused}/{total > 0 ? total : '-'}</span>
        <p className="text-[10px] text-muted-foreground">reaprov.</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
