import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllDiscs, type Disc, type EquipmentType } from '@/lib/db';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Filter, TrendingUp, FileDown, Recycle, RefreshCw, Calendar, Disc as DiscIcon, CircleDot } from 'lucide-react';
import { endOfDay, endOfMonth, endOfWeek, format, isWithinInterval, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from '@/hooks/use-toast';

type EquipmentFilter = 'all' | EquipmentType;

const parseReportDate = (value: string) => new Date(`${value}T12:00:00`);

const getReportInterval = (dateFrom: string, dateTo: string) => {
  if (!dateFrom && !dateTo) return null;
  const start = dateFrom ? startOfDay(parseReportDate(dateFrom)) : null;
  const end = dateTo ? endOfDay(parseReportDate(dateTo)) : null;
  if (start && end) return start <= end ? { start, end } : { start: end, end: start };
  if (start) return { start, end: endOfDay(start) };
  if (end) return { start: startOfDay(end), end };
  return null;
};

export default function Reports() {
  const [allDiscs, setAllDiscs] = useState<Disc[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [refFilter, setRefFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>('all');
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>('all');
  const [expandedDiscs, setExpandedDiscs] = useState<Record<string, boolean>>({});
  const chartsRef = useRef<HTMLDivElement>(null);

  const toggleDisc = (id: string) => {
    setExpandedDiscs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    getAllDiscs().then(d => { setAllDiscs(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const baseFiltered = useMemo(() => {
    return allDiscs.filter(d => {
      if (equipmentFilter !== 'all' && d.equipmentType !== equipmentFilter) return false;
      if (sizeFilter && !d.size.toLowerCase().includes(sizeFilter.toLowerCase())) return false;
      if (refFilter && !d.referenceNumber.toLowerCase().includes(refFilter.toLowerCase())) return false;
      return true;
    });
  }, [allDiscs, sizeFilter, refFilter, equipmentFilter]);

  const reportInterval = useMemo(
    () => getReportInterval(dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  const filtered = useMemo(() => {
    if (!reportInterval) return baseFiltered;
    return baseFiltered.filter(d => isWithinInterval(parseReportDate(d.date), reportInterval));
  }, [baseFiltered, reportInterval]);

  const stats = useMemo(() => {
    const totalDiscs = filtered.length;
    const totalProduction = filtered.reduce((sum, d) => sum + (parseInt(d.productionNumber) || 0), 0);
    const analyzedTotal = totalDiscs * totalProduction;
    let reused = 0;
    let swapped = 0;
    filtered.forEach(d => {
      d.parts.forEach(p => {
        reused += p.quantity || 0;
        swapped += p.swappedQuantity || 0;
      });
    });
    const total = reused + swapped;
    const pct = total > 0 ? Math.round((reused / total) * 100) : 0;
    return { totalDiscs, totalProduction, analyzedTotal, reused, swapped, pct, totalParts: total };
  }, [filtered]);

  const partsByName = useMemo(() => {
    const swapMap: Record<string, number> = {};
    const reuseMap: Record<string, number> = {};
    filtered.forEach(d => {
      d.parts.forEach(p => {
        const qty = p.quantity || 0;
        const trocadas = p.swappedQuantity || 0;
        if (qty > 0) reuseMap[p.name] = (reuseMap[p.name] || 0) + qty;
        if (trocadas > 0) swapMap[p.name] = (swapMap[p.name] || 0) + trocadas;
      });
    });
    return { swapMap, reuseMap };
  }, [filtered]);

  // Ranking by reference
  const rankingByRef = useMemo(() => {
    const map: Record<string, { reused: number; swapped: number; discs: Disc[] }> = {};
    filtered.forEach(d => {
      if (!map[d.referenceNumber]) map[d.referenceNumber] = { reused: 0, swapped: 0, discs: [] };
      map[d.referenceNumber].discs.push(d);
      d.parts.forEach(p => {
        map[d.referenceNumber].reused += p.quantity || 0;
        map[d.referenceNumber].swapped += p.swappedQuantity || 0;
      });
    });
    return Object.entries(map)
      .map(([ref, v]) => ({ ref, ...v, total: v.reused + v.swapped }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Ranking by part
  const rankingByPart = useMemo(() => {
    const map: Record<string, { reused: number; swapped: number; refs: Record<string, { reused: number; swapped: number }> }> = {};
    filtered.forEach(d => {
      d.parts.forEach(p => {
        if (!map[p.name]) map[p.name] = { reused: 0, swapped: 0, refs: {} };
        map[p.name].reused += p.quantity || 0;
        map[p.name].swapped += p.swappedQuantity || 0;
        if (!map[p.name].refs[d.referenceNumber]) map[p.name].refs[d.referenceNumber] = { reused: 0, swapped: 0 };
        map[p.name].refs[d.referenceNumber].reused += p.quantity || 0;
        map[p.name].refs[d.referenceNumber].swapped += p.swappedQuantity || 0;
      });
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, total: v.reused + v.swapped }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});
  const [expandedParts, setExpandedParts] = useState<Record<string, boolean>>({});

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
        map[d.size].reused += p.quantity || 0;
        map[d.size].swapped += p.swappedQuantity || 0;
      });
    });
    return Object.entries(map).map(([size, v]) => ({ size, ...v }));
  }, [filtered]);

  const timelineData = useMemo(() => {
    if (filtered.length === 0) return [];

    const discsWithDate = filtered
      .map(d => ({
        ...d,
        parsedDate: parseReportDate(d.date),
      }))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

    const getKey = (date: Date): string => format(date, 'yyyy-MM-dd');
    const getLabel = (date: Date): string => format(date, 'dd/MM', { locale: ptBR });

    const buckets: Record<string, { label: string; reused: number; swapped: number; discs: number }> = {};

    discsWithDate.forEach(d => {
      const key = getKey(d.parsedDate);
      if (!buckets[key]) {
        buckets[key] = { label: getLabel(d.parsedDate), reused: 0, swapped: 0, discs: 0 };
      }
      buckets[key].discs++;
      d.parts.forEach(p => {
        buckets[key].reused += p.quantity || 0;
        buckets[key].swapped += p.swappedQuantity || 0;
      });
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [filtered]);

  const exportPDF = async () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 20;

    const addLine = (text: string, size = 10, bold = false) => {
      if (y > pageH - 20) { doc.addPage(); y = 20; }
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(text, 14, y);
      y += size * 0.5 + 3;
    };

    const addSeparator = () => {
      if (y > pageH - 20) { doc.addPage(); y = 20; }
      doc.setDrawColor(200);
      doc.line(14, y, pageW - 14, y);
      y += 5;
    };

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const eqLabel = equipmentFilter === 'all' ? 'Geral' : equipmentFilter === 'disco' ? 'Discos' : 'Plators';
    doc.text(`Relatório - ${eqLabel}`, 14, y);
    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, y);
    y += 5;
    if (reportInterval) {
      const fromDate = format(reportInterval.start, 'dd/MM/yyyy', { locale: ptBR });
      const toDate = format(reportInterval.end, 'dd/MM/yyyy', { locale: ptBR });
      doc.text(`Período: ${fromDate} a ${toDate}`, 14, y);
      y += 5;
    }
    if (sizeFilter) { doc.text(`Filtro tamanho: ${sizeFilter}`, 14, y); y += 5; }
    if (refFilter) { doc.text(`Filtro referência: ${refFilter}`, 14, y); y += 5; }
    y += 3;
    addSeparator();

    addLine('RESUMO GERAL', 13, true);
    addLine(`Quantidade de discos: ${stats.totalProduction}`);
    addLine(`Total de peças: ${stats.totalParts}`);
    addLine(`Peças reaproveitadas: ${stats.reused}`);
    addLine(`Peças substituídas: ${stats.swapped}`);
    addLine(`Percentual de reaproveitamento: ${stats.pct}%`);
    y += 3;
    addSeparator();

    if (chartsRef.current) {
      try {
        const canvas = await html2canvas(chartsRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const imgData = canvas.toDataURL('image/png');
        const imgW = pageW - 28;
        const imgH = (canvas.height / canvas.width) * imgW;

        if (y + imgH > pageH - 20) { doc.addPage(); y = 20; }
        addLine('GRÁFICOS', 13, true);
        y += 2;
        doc.addImage(imgData, 'PNG', 14, y, imgW, imgH);
        y += imgH + 10;
        addSeparator();
      } catch (err) {
        console.error('Erro ao capturar gráficos:', err);
      }
    }

    const swapEntries = Object.entries(partsByName.swapMap).sort((a, b) => b[1] - a[1]);
    if (swapEntries.length > 0) {
      addLine('PEÇAS SUBSTITUÍDAS (por tipo)', 13, true);
      swapEntries.forEach(([name, qty]) => addLine(`  - ${name}: ${qty} unidade(s)`));
      y += 3;
      addSeparator();
    }

    const reuseEntries = Object.entries(partsByName.reuseMap).sort((a, b) => b[1] - a[1]);
    if (reuseEntries.length > 0) {
      addLine('PEÇAS REAPROVEITADAS (por tipo)', 13, true);
      reuseEntries.forEach(([name, qty]) => addLine(`  - ${name}: ${qty} unidade(s)`));
      y += 3;
      addSeparator();
    }

    addLine('DETALHAMENTO POR DISCO', 13, true);
    y += 2;
    filtered.forEach((disc, idx) => {
      if (y > pageH - 40) { doc.addPage(); y = 20; }
      const typeLabel = disc.equipmentType === 'plator' ? 'Plator' : 'Disco';
      addLine(`${typeLabel} ${idx + 1}`, 11, true);
      addLine(`  Data: ${format(new Date(disc.date), "dd/MM/yyyy", { locale: ptBR })}`);
      addLine(`  Tamanho: ${disc.size}`);
      addLine(`  N. Referência: ${disc.referenceNumber}`);
      addLine(`  Quantidade de produção: ${disc.productionNumber}`);
      if (disc.observation) {
        addLine(`  Observação: ${disc.observation}`);
      }
      disc.parts.forEach(p => {
        addLine(`    - ${p.name}: Reaprov. ${p.quantity || 0} | Troca ${p.swappedQuantity || 0}`);
      });
      y += 4;
    });

    const fileName = `relatorio-${equipmentFilter}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

    if (Capacitor.isNativePlatform()) {
      try {
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        const result = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache,
        });
        await Share.share({ title: 'Relatório', url: result.uri });
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

  const exportCSV = async () => {
    const rows = [['Tipo', 'Data', 'Tamanho', 'Referência', 'Qtd Produção', 'Peça', 'Reaproveitadas', 'Trocadas', 'Observação']];
    filtered.forEach(d => {
      const typeLabel = d.equipmentType === 'plator' ? 'Plator' : 'Disco';
      d.parts.forEach(p => {
        rows.push([typeLabel, d.date, d.size, d.referenceNumber, d.productionNumber, p.name, String(p.quantity || 0), String(p.swappedQuantity || 0), d.observation || '']);
      });
    });
    const csv = rows.map(r => r.join(';')).join('\n');
    const fileName = `relatorio-${equipmentFilter}-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    if (Capacitor.isNativePlatform()) {
      try {
        const csvBase64 = btoa(unescape(encodeURIComponent(csv)));
        const result = await Filesystem.writeFile({
          path: fileName,
          data: csvBase64,
          directory: Directory.Cache,
        });
        await Share.share({ title: 'Relatório CSV', url: result.uri });
        toast({ title: 'CSV gerado com sucesso!' });
      } catch (err) {
        console.error('Erro ao exportar CSV:', err);
        toast({ title: 'Erro ao exportar CSV', variant: 'destructive' });
      }
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      toast({ title: 'CSV baixado com sucesso!' });
    }
  };

  if (loading) {
    return <div className="px-4 pt-4 pb-24 max-w-lg mx-auto"><p className="text-center text-muted-foreground mt-20">Carregando...</p></div>;
  }

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Relatórios</h1>
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 text-sm text-primary font-medium active:scale-95">
          <Filter className="w-4 h-4" /> Filtros
        </button>
      </div>

      {/* Equipment Type Tabs */}
      <div className="flex gap-1 mb-3 bg-muted rounded-lg p-1">
        {([['all', 'Geral', null], ['disco', 'Disco', DiscIcon], ['plator', 'Plator', CircleDot]] as const).map(([mode, label, Icon]) => (
          <button
            key={mode}
            onClick={() => setEquipmentFilter(mode as EquipmentFilter)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              equipmentFilter === mode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1">
        {([['daily', 'Diário'], ['weekly', 'Semanal'], ['monthly', 'Mensal']] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              viewMode === mode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
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

      <div className="grid grid-cols-2 gap-2 mb-6">
        <StatCard label="Quantidade de discos" value={stats.totalProduction} />
        <StatCard label="Reaproveitamento" value={`${stats.pct}%`} accent />
        <StatCard label="Peças reaproveitadas" value={stats.reused} />
        <StatCard label="Peças substituídas" value={stats.swapped} />
      </div>

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

      {stats.totalParts > 0 && (
        <>
          {/* Ranking por Referência */}
          {rankingByRef.length > 0 && (
            <>
              <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-primary" /> Ranking por Referência
              </h2>
              <div className="bg-card rounded-lg border border-border mb-4 divide-y divide-border">
                {rankingByRef.map((item, idx) => {
                  const isOpen = expandedRefs[item.ref];
                  const reusePct = item.total > 0 ? Math.round((item.reused / item.total) * 100) : 0;
                  return (
                    <div key={item.ref}>
                      <button
                        onClick={() => setExpandedRefs(prev => ({ ...prev, [item.ref]: !prev[item.ref] }))}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-5">#{idx + 1}</span>
                          <div>
                            <p className="text-sm font-medium">Ref: {item.ref}</p>
                            <p className="text-xs text-muted-foreground">{item.discs.length} equip. · {item.total} peças</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs shrink-0">
                          <span className="text-success font-semibold">{reusePct}%</span>
                          <div className="w-16 h-2 bg-destructive/20 rounded-full overflow-hidden">
                            <div className="h-full bg-success rounded-full" style={{ width: `${reusePct}%` }} />
                          </div>
                          <svg className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 space-y-1 animate-fade-in">
                          <div className="flex justify-between text-xs px-2 py-1 text-muted-foreground">
                            <span>Reaproveitadas: <strong className="text-success">{item.reused}</strong></span>
                            <span>Trocadas: <strong className="text-destructive">{item.swapped}</strong></span>
                          </div>
                          {item.discs.map(disc => (
                            <div key={disc.id} className="px-2 py-1.5 rounded-md bg-muted/30 text-xs space-y-0.5">
                              <p className="font-medium">{disc.equipmentType === 'plator' ? 'Plator' : 'Disco'} - {disc.size} · {format(parseReportDate(disc.date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                              {disc.parts.map((p, i) => (
                                <div key={i} className="flex justify-between pl-2">
                                  <span>{p.name}</span>
                                  <span><span className="text-success">R:{p.quantity || 0}</span> <span className="text-destructive">T:{p.swappedQuantity || 0}</span></span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Ranking por Peça */}
          {rankingByPart.length > 0 && (
            <>
              <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-primary" /> Ranking por Peça
              </h2>
              <div className="bg-card rounded-lg border border-border mb-4 divide-y divide-border">
                {rankingByPart.map((item, idx) => {
                  const isOpen = expandedParts[item.name];
                  const reusePct = item.total > 0 ? Math.round((item.reused / item.total) * 100) : 0;
                  const refEntries = Object.entries(item.refs).sort((a, b) => (b[1].reused + b[1].swapped) - (a[1].reused + a[1].swapped));
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => setExpandedParts(prev => ({ ...prev, [item.name]: !prev[item.name] }))}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-5">#{idx + 1}</span>
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.total} un. total</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs shrink-0">
                          <span className="text-success font-semibold">{reusePct}%</span>
                          <div className="w-16 h-2 bg-destructive/20 rounded-full overflow-hidden">
                            <div className="h-full bg-success rounded-full" style={{ width: `${reusePct}%` }} />
                          </div>
                          <svg className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 space-y-1 animate-fade-in">
                          <div className="flex justify-between text-xs px-2 py-1 text-muted-foreground">
                            <span>Reaproveitadas: <strong className="text-success">{item.reused}</strong></span>
                            <span>Trocadas: <strong className="text-destructive">{item.swapped}</strong></span>
                          </div>
                          {refEntries.map(([ref, v]) => (
                            <div key={ref} className="flex justify-between items-center px-2 py-1.5 rounded-md bg-muted/30 text-xs">
                              <span>Ref: {ref}</span>
                              <span><span className="text-success">R:{v.reused}</span> <span className="text-destructive">T:{v.swapped}</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

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

          {/* Detalhamento por disco - expandível */}
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
            <DiscIcon className="w-4 h-4" /> Detalhamento por Equipamento
          </h2>
          <div className="bg-card rounded-lg border border-border mb-4 divide-y divide-border">
            {filtered.map((disc) => {
              const typeLabel = disc.equipmentType === 'plator' ? 'Plator' : 'Disco';
              const discReused = disc.parts.reduce((s, p) => s + (p.quantity || 0), 0);
              const discSwapped = disc.parts.reduce((s, p) => s + (p.swappedQuantity || 0), 0);
              const isExpanded = expandedDiscs[disc.id];
              return (
                <div key={disc.id}>
                  <button
                    onClick={() => toggleDisc(disc.id)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{typeLabel} - {disc.size}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseReportDate(disc.date), 'dd/MM/yyyy', { locale: ptBR })} · Ref: {disc.referenceNumber} · Prod: {disc.productionNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <span className="text-success font-semibold">{discReused}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-destructive font-semibold">{discSwapped}</span>
                      <svg className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-1 animate-fade-in">
                      {disc.parts.map((p, i) => (
                        <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded-md bg-muted/30 text-sm">
                          <span>{p.name}</span>
                          <div className="flex gap-3 text-xs">
                            <span className="text-success font-medium">Reaprov: {p.quantity || 0}</span>
                            <span className="text-destructive font-medium">Troca: {p.swappedQuantity || 0}</span>
                          </div>
                        </div>
                      ))}
                      {disc.observation && (
                        <p className="text-xs text-muted-foreground italic px-2">Obs: {disc.observation}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div ref={chartsRef} className="space-y-4">
            {timelineData.length > 0 && (
              <>
                <h2 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> Evolução {viewMode === 'daily' ? 'Diária' : viewMode === 'weekly' ? 'Semanal' : 'Mensal'}
                </h2>
                <div className="bg-card rounded-lg border border-border p-4 mb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={timelineData}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="reused" name="Reaprov." stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="swapped" name="Trocadas" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
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
          </div>
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
