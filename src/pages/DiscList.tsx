import { useNavigate } from 'react-router-dom';
import { getAllDiscs, type Disc } from '@/lib/db';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronRight, Package, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.png';

export default function DiscList() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllDiscs().then(d => { setDiscs(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <img src={logo} alt="Logo Controle Embreagem" className="w-10 h-10 rounded-lg" />
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-tight">Discos Cadastrados</h1>
          <p className="text-sm text-muted-foreground">{discs.length} registro(s)</p>
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
          <p className="text-lg font-medium">Nenhum disco cadastrado</p>
          <p className="text-sm mt-1">Toque em "Novo" para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {discs.map(disc => {
            const reuse = disc.parts.filter(p => p.status === 'reaproveitar').length;
            const total = disc.parts.length;
            return (
              <button
                key={disc.id}
                onClick={() => navigate(`/disc/${disc.id}`)}
                className="w-full bg-card rounded-lg p-4 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform border border-border"
              >
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-sm truncate">Qtd. Prod: {disc.productionNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(disc.date), "dd/MM/yyyy", { locale: ptBR })} · {disc.size}
                  </p>
                </div>
                <div className="text-right shrink-0 mr-1">
                  <span className="text-xs font-medium text-success">{reuse}/{total}</span>
                  <p className="text-[10px] text-muted-foreground">reaprov.</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
