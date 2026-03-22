import { useMemo, useState } from 'react';
import { getAllDiscs } from '@/lib/db';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Filter, TrendingUp } from 'lucide-react';

export default function Reports() {
  const allDiscs = useMemo(() => getAllDiscs(), []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [refFilter, setRefFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return allDiscs.filter(d => {
      if (dateFrom && d.date < dateFrom) return false;
      if (dateTo && d.date > dateTo) return false;
      if (sizeFilter && !d.size.toLowerCase().includes(sizeFilter.toLowerCase())) return false;
      if (refFilter && !d.referenceNumber.toLowerCase().includes(refFilter.toLowerCase())) return false;
      return true;
    });
  }, [allDiscs, dateFrom, dateTo, sizeFilter, refFilter]);

  const stats = useMemo(() => {
    const totalDiscs = filtered.length;
    const allParts = filtered.flatMap(d => d.parts);
    const reused = allParts.filter(p => p.status === 'reaproveitar').length;
    const swapped = allParts.filter(p => p.status === 'trocar').length;
    const pct = allParts.length > 0 ? Math.round((reused / allParts.length) * 100) : 0;
    return { totalDiscs, reused, swapped, pct, totalParts: allParts.length };
  }, [filtered]);

  const pieData = [
    { name: 'Reaproveitadas', value: stats.reused },
    { name: 'Substituídas', value: stats.swapped },
  ];
  const PIE_COLORS = ['hsl(142, 71%, 45%)', 'hsl(0, 72%, 51%)'];

  const barData = useMemo(() => {
    const map: Record<string, { reused: number; swapped: number }> = {};
    filtered.forEach(d => {
      if (!map[d.size]) map[d.size] = { reused: 0, swapped: 0 };
      d.parts.forEach(p => {
        if (p.status === 'reaproveitar') map[d.size].reused++;
        else map[d.size].swapped++;
      });
    });
    return Object.entries(map).map(([size, v]) => ({ size, ...v }));
  }, [filtered]);

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Relatórios</h1>
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 text-sm text-primary font-medium active:scale-95">
          <Filter className="w-4 h-4" /> Filtros
        </button>
      </div>

      {showFilters && (
        <div className="bg-card rounded-lg p-4 border border-border mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 h-10 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 h-10 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Tamanho</Label>
            <Input placeholder="Ex: 200mm" value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="mt-1 h-10 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Nº Referência</Label>
            <Input placeholder="Filtrar por referência" value={refFilter} onChange={e => setRefFilter(e.target.value)} className="mt-1 h-10 text-sm" />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <StatCard label="Discos analisados" value={stats.totalDiscs} />
        <StatCard label="Reaproveitamento" value={`${stats.pct}%`} accent />
        <StatCard label="Peças reaproveitadas" value={stats.reused} />
        <StatCard label="Peças substituídas" value={stats.swapped} />
      </div>

      {stats.totalParts > 0 && (
        <>
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Distribuição</h2>
          <div className="bg-card rounded-lg border border-border p-4 mb-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </div>

          {barData.length > 0 && (
            <>
              <h2 className="font-semibold text-sm mb-2">Por Tamanho</h2>
              <div className="bg-card rounded-lg border border-border p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData}>
                    <XAxis dataKey="size" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="reused" name="Reaprov." fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="swapped" name="Troca" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-4 border text-center ${accent ? 'bg-primary/10 border-primary/30' : 'bg-card border-border'}`}>
      <p className={`text-2xl font-bold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
