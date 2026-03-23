import { useMemo, useState } from 'react';
import { getAllDiscs, type Disc } from '@/lib/db';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Filter, TrendingUp, FileDown, Recycle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from '@/hooks/use-toast';

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
    const reused = allParts.filter(p => p.status === 'reaproveitar').reduce((s, p) => s + (p.quantity || 1), 0);
    const swapped = allParts.filter(p => p.status === 'trocar').reduce((s, p) => s + (p.quantity || 1), 0);
    const total = reused + swapped;
    const pct = total > 0 ? Math.round((reused / total) * 100) : 0;
    return { totalDiscs, reused, swapped, pct, totalParts: total };
  }, [filtered]);

  // Grouped parts breakdown
  const partsByName = useMemo(() => {
    const swapMap: Record<string, number> = {};
    const reuseMap: Record<string, number> = {};
    filtered.forEach(d => {
      d.parts.forEach(p => {
        const qty = p.quantity || 1;
        if (p.status === 'trocar') {
          swapMap[p.name] = (swapMap[p.name] || 0) + qty;
        } else {
          reuseMap[p.name] = (reuseMap[p.name] || 0) + qty;
        }
      });
    });
    return { swapMap, reuseMap };
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
        const qty = p.quantity || 1;
        if (p.status === 'reaproveitar') map[d.size].reused += qty;
        else map[d.size].swapped += qty;
      });
    });
    return Object.entries(map).map(([size, v]) => ({ size, ...v }));
  }, [filtered]);

  const exportPDF = async () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    const addLine = (text: string, size = 10, bold = false) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(text, 14, y);
      y += size * 0.5 + 3;
    };

    const addSeparator = () => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setDrawColor(200);
      doc.line(14, y, pageW - 14, y);
      y += 5;
    };

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatorio de Discos de Embreagem', 14, y);
    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, y);
    y += 5;
    if (dateFrom || dateTo) {
      doc.text(`Periodo: ${dateFrom || '...'} a ${dateTo || '...'}`, 14, y);
      y += 5;
    }
    if (sizeFilter) { doc.text(`Filtro tamanho: ${sizeFilter}`, 14, y); y += 5; }
    if (refFilter) { doc.text(`Filtro referencia: ${refFilter}`, 14, y); y += 5; }
    y += 3;
    addSeparator();

    // Summary
    addLine('RESUMO GERAL', 13, true);
    addLine(`Discos analisados: ${stats.totalDiscs}`);
    addLine(`Total de pecas: ${stats.totalParts}`);
    addLine(`Pecas reaproveitadas: ${stats.reused}`);
    addLine(`Pecas substituidas: ${stats.swapped}`);
    addLine(`Percentual de reaproveitamento: ${stats.pct}%`);
    y += 3;
    addSeparator();

    // Swapped parts grouped
    const swapEntries = Object.entries(partsByName.swapMap).sort((a, b) => b[1] - a[1]);
    if (swapEntries.length > 0) {
      addLine('PECAS SUBSTITUIDAS (por tipo)', 13, true);
      swapEntries.forEach(([name, qty]) => addLine(`  - ${name}: ${qty} unidade(s)`));
      y += 3;
      addSeparator();
    }

    // Reused parts grouped
    const reuseEntries = Object.entries(partsByName.reuseMap).sort((a, b) => b[1] - a[1]);
    if (reuseEntries.length > 0) {
      addLine('PECAS REAPROVEITADAS (por tipo)', 13, true);
      reuseEntries.forEach(([name, qty]) => addLine(`  - ${name}: ${qty} unidade(s)`));
      y += 3;
      addSeparator();
    }

    // Per-disc detail
    addLine('DETALHAMENTO POR DISCO', 13, true);
    y += 2;
    filtered.forEach((disc, idx) => {
      if (y > 250) { doc.addPage(); y = 20; }
      addLine(`Disco ${idx + 1}`, 11, true);
      addLine(`  Data: ${format(new Date(disc.date), "dd/MM/yyyy", { locale: ptBR })}`);
      addLine(`  Tamanho: ${disc.size}`);
      addLine(`  N. Referencia: ${disc.referenceNumber}`);
      addLine(`  Quantidade de producao: ${disc.productionNumber}`);
      disc.parts.forEach(p => {
        const label = p.status === 'reaproveitar' ? 'Reaprov.' : 'Trocar';
        addLine(`    - ${p.name}: ${p.quantity || 1}x (${label})`);
      });
      y += 4;
    });

    const fileName = `relatorio-discos-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

    if (Capacitor.isNativePlatform()) {
      try {
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        const result = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Relatório de Discos',
          url: result.uri,
        });
        toast({ title: 'PDF gerado com sucesso!' });
      } catch (err) {
        console.error('Erro ao exportar PDF:', err);
        toast({ title: 'Erro ao exportar PDF', variant: 'destructive' });
      }
    } else {
      doc.save(fileName);
      toast({ title: 'PDF baixado com sucesso!' });
    }
  };

  const exportCSV = () => {
    const rows = [['Data', 'Tamanho', 'Referencia', 'Quantidade de producao', 'Peca', 'Quantidade', 'Status']];
    filtered.forEach(d => {
      d.parts.forEach(p => {
        rows.push([d.date, d.size, d.referenceNumber, d.productionNumber, p.name, String(p.quantity || 1), p.status === 'reaproveitar' ? 'Reaproveitar' : 'Trocar']);
      });
    });
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-discos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

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

      {/* Export buttons */}
      {filtered.length > 0 && (
        <div className="flex gap-2 mb-6">
          <Button onClick={exportPDF} className="flex-1 h-12 text-sm font-semibold">
            <FileDown className="w-4 h-4 mr-1.5" /> Exportar PDF
          </Button>
          <Button variant="outline" onClick={exportCSV} className="flex-1 h-12 text-sm font-semibold">
            <FileDown className="w-4 h-4 mr-1.5" /> Exportar CSV
          </Button>
        </div>
      )}

      {/* Parts breakdown */}
      {stats.totalParts > 0 && (
        <>
          {Object.keys(partsByName.swapMap).length > 0 && (
            <>
              <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-destructive" /> Peças Substituídas
              </h2>
              <div className="bg-card rounded-lg border border-border p-3 mb-4 space-y-1.5">
                {Object.entries(partsByName.swapMap).sort((a, b) => b[1] - a[1]).map(([name, qty]) => (
                  <div key={name} className="flex justify-between items-center py-1.5 px-2 rounded-md bg-destructive/5">
                    <span className="text-sm">{name}</span>
                    <span className="text-sm font-bold text-destructive">{qty} un.</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {Object.keys(partsByName.reuseMap).length > 0 && (
            <>
              <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                <Recycle className="w-4 h-4 text-success" /> Peças Reaproveitadas
              </h2>
              <div className="bg-card rounded-lg border border-border p-3 mb-4 space-y-1.5">
                {Object.entries(partsByName.reuseMap).sort((a, b) => b[1] - a[1]).map(([name, qty]) => (
                  <div key={name} className="flex justify-between items-center py-1.5 px-2 rounded-md bg-success/5">
                    <span className="text-sm">{name}</span>
                    <span className="text-sm font-bold text-success">{qty} un.</span>
                  </div>
                ))}
              </div>
            </>
          )}

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
