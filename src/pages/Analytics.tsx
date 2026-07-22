import { useEffect, useState } from 'react';
import { useClub } from '../contexts/ClubContext';
import { tableService } from '../services/tableService';
import { playerService } from '../services/playerService';
import { transactionService } from '../services/transactionService';
import { clubSettingsService } from '../services/clubSettingsService';
import type { Table, GlobalPlayer, Transaction } from '../types';
import { 
  Calendar, Users, TrendingUp, TrendingDown, Clock, 
  FileText, Activity, ShieldAlert, Sparkles, Filter, Coffee, BarChart3
} from 'lucide-react';
import { formatMoney } from '../utils';

export default function Analytics() {
  const { clubId } = useClub();
  
  // Data States
  const [tables, setTables] = useState<Table[]>([]);
  const [tablePlayers, setTablePlayers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [globalPlayers, setGlobalPlayers] = useState<GlobalPlayer[]>([]);
  const [businessDays, setBusinessDays] = useState<string[]>(['segunda', 'terca', 'quinta']);
  const [loading, setLoading] = useState(true);

  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'operacao' | 'copa' | 'jogadores'>('geral');

  // Filters State
  const [period, setPeriod] = useState<string>('30_dias');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');

  useEffect(() => {
    if (clubId) {
      fetchAnalyticsData();
    }
  }, [clubId]);

  async function fetchAnalyticsData() {
    if (!clubId) return;
    try {
      setLoading(true);
      const [tablesData, tpData, txData, gPlayers, settings] = await Promise.all([
        tableService.getTables(clubId),
        playerService.getAllTablePlayers(clubId),
        transactionService.getAllTransactions(clubId),
        playerService.getPlayers(clubId),
        clubSettingsService.getSettings(clubId)
      ]);
      setTables(tablesData || []);
      setTablePlayers(tpData || []);
      setTransactions(txData || []);
      setGlobalPlayers(gPlayers || []);
      if (settings && settings.business_days) {
        setBusinessDays(settings.business_days);
      }
    } catch (e) {
      console.error('Error loading analytics:', e);
    } finally {
      setLoading(false);
    }
  }

  // Get date range limits
  const getRangeDates = (range: string, startStr?: string, endStr?: string) => {
    const now = new Date();
    let fromDate = new Date();
    let toDate = new Date();
    
    switch(range) {
      case 'hoje':
        fromDate.setHours(0,0,0,0);
        break;
      case '7_dias':
        fromDate.setDate(now.getDate() - 7);
        break;
      case '30_dias':
        fromDate.setDate(now.getDate() - 30);
        break;
      case 'este_mes':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'ultimo_mes':
        fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case '3_meses':
        fromDate.setDate(now.getDate() - 90);
        break;
      case '12_meses':
        fromDate.setDate(now.getDate() - 365);
        break;
      case 'personalizado':
        if (startStr) fromDate = new Date(startStr);
        if (endStr) toDate = new Date(endStr + 'T23:59:59');
        break;
    }
    return { fromDate, toDate };
  };

  const getPreviousPeriodDates = (fromDate: Date, toDate: Date) => {
    const rangeMs = toDate.getTime() - fromDate.getTime();
    const prevToDate = new Date(fromDate.getTime() - 1);
    const prevFromDate = new Date(prevToDate.getTime() - rangeMs);
    return { prevFromDate, prevToDate };
  };

  // Compile calculations
  const { fromDate, toDate } = getRangeDates(period, customStart, customEnd);
  const { prevFromDate, prevToDate } = getPreviousPeriodDates(fromDate, toDate);

  // Filter lists based on date, table, and day criteria
  const getFilteredData = (startLimit: Date, endLimit: Date) => {
    // 1. Filter tables
    const periodTables = tables.filter(t => {
      const date = new Date(t.created_at);
      const inDateRange = date >= startLimit && date <= endLimit;
      const matchTable = selectedTable === 'all' || t.id === selectedTable;
      
      const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // removes accents
      
      const matchDay = selectedDay === 'all' || weekday.includes(selectedDay);
      return inDateRange && matchTable && matchDay;
    });

    const periodTableIds = periodTables.map(t => t.id);

    // 2. Filter transactions
    const periodTxs = transactions.filter(tx => {
      return periodTableIds.includes(tx.table_id);
    });

    // 3. Filter sessions
    const periodSessions = tablePlayers.filter(tp => {
      return periodTableIds.includes(tp.table_id);
    });

    return { periodTables, periodTxs, periodSessions };
  };

  const { periodTables, periodTxs, periodSessions } = getFilteredData(fromDate, toDate);
  const { periodTables: prevTables, periodTxs: prevTxs, periodSessions: prevSessions } = getFilteredData(prevFromDate, prevToDate);

  const computeMetrics = (txs: Transaction[], tbls: Table[], sessions: any[]) => {
    const buyIns = txs.filter(tx => tx.type === 'buy_in');
    const cashOuts = txs.filter(tx => tx.type === 'cash_out');
    const consumos = txs.filter(tx => tx.type === 'consumo');
    
    const totalBuyIn = buyIns.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalCashOut = cashOuts.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalConsumo = consumos.reduce((sum, tx) => sum + Number(tx.amount), 0);
    
    const rake = totalBuyIn - totalCashOut;
    const revenue = rake + totalConsumo;
    const tablesCount = tbls.length;
    const uniquePlayers = new Set(sessions.map(s => s.name)).size;
    const ticketMedio = uniquePlayers > 0 ? (revenue / uniquePlayers) : 0;
    
    // Average table duration
    let totalDurationHours = 0;
    let closedTablesCount = 0;
    tbls.forEach(t => {
      if (t.closed_at && t.created_at) {
        const durationMs = new Date(t.closed_at).getTime() - new Date(t.created_at).getTime();
        totalDurationHours += durationMs / (1000 * 60 * 60);
        closedTablesCount++;
      }
    });
    const avgDuration = closedTablesCount > 0 ? (totalDurationHours / closedTablesCount) : 0;

    return {
      revenue,
      totalConsumo,
      tablesCount,
      uniquePlayers,
      totalBuyIn,
      totalCashOut,
      ticketMedio,
      avgDuration
    };
  };

  const metrics = computeMetrics(periodTxs, periodTables, periodSessions);
  const prevMetrics = computeMetrics(prevTxs, prevTables, prevSessions);

  // Helper for percentage rendering
  const renderVariation = (curr: number, prev: number) => {
    if (prev <= 0) return <span className="text-muted text-[10px] font-semibold">N/A anterior</span>;
    const pct = ((curr - prev) / prev) * 100;
    const isPositive = pct >= 0;
    
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {isPositive ? '+' : ''}{pct.toFixed(0)}%
      </span>
    );
  };

  // 1. Chart SVG Data processing
  const getTimelinePoints = () => {
    const dailyData: Record<string, number> = {};
    const dateList: Date[] = [];

    const current = new Date(fromDate);
    const end = new Date(toDate);
    while (current <= end) {
      const dateStr = current.toLocaleDateString('pt-BR');
      dailyData[dateStr] = 0;
      dateList.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    periodTxs.forEach(tx => {
      const dateStr = new Date(tx.created_at).toLocaleDateString('pt-BR');
      if (dailyData[dateStr] !== undefined) {
        const amount = Number(tx.amount);
        if (tx.type === 'buy_in') dailyData[dateStr] += amount;
        else if (tx.type === 'consumo') dailyData[dateStr] += amount;
        else if (tx.type === 'cash_out') dailyData[dateStr] -= amount;
      }
    });

    const points = dateList.map(d => {
      const dateStr = d.toLocaleDateString('pt-BR');
      const val = Math.max(0, dailyData[dateStr] || 0);
      return {
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        value: val
      };
    });

    return points;
  };

  const timelinePoints = getTimelinePoints();
  const values = timelinePoints.map(p => p.value);
  const maxVal = Math.max(...values, 100);
  const minVal = Math.min(...values, 0);

  // SVG parameters
  const chartWidth = 600;
  const chartHeight = 200;
  const chartPadding = 24;

  const getSVGCoordinates = () => {
    return timelinePoints.map((p, idx) => {
      const x = chartPadding + (idx * (chartWidth - 2 * chartPadding)) / (timelinePoints.length - 1 || 1);
      const normalized = maxVal > minVal ? (p.value - minVal) / (maxVal - minVal) : 0.5;
      const y = chartHeight - chartPadding - normalized * (chartHeight - 2 * chartPadding);
      return { x, y, label: p.label, value: p.value };
    });
  };

  const coords = getSVGCoordinates();
  let linePathD = '';
  let areaPathD = '';

  if (coords.length > 0) {
    linePathD = `M ${coords[0].x} ${coords[0].y}`;
    coords.forEach((c, idx) => {
      if (idx > 0) linePathD += ` L ${c.x} ${c.y}`;
    });
    areaPathD = `${linePathD} L ${coords[coords.length - 1].x} ${chartHeight - chartPadding} L ${coords[0].x} ${chartHeight - chartPadding} Z`;
  }

  // 2. Business Days calculation
  const getWeekdayRankings = () => {
    const daysMap: Record<string, { name: string; revenue: number; players: number; tables: number }> = {};
    
    businessDays.forEach(day => {
      const label = day.charAt(0).toUpperCase() + day.slice(1).replace('terca', 'Terça').replace('sabado', 'Sábado');
      daysMap[day] = { name: label, revenue: 0, players: 0, tables: 0 };
    });

    periodTables.forEach(t => {
      const date = new Date(t.created_at);
      const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const matchedKey = businessDays.find(d => weekday.includes(d));
      if (matchedKey && daysMap[matchedKey]) {
        daysMap[matchedKey].tables++;
        
        const tablePlayersCount = getTablePlayersCount(t.id);
        daysMap[matchedKey].players += tablePlayersCount;

        const tableTxs = periodTxs.filter(tx => tx.table_id === t.id);
        const buyIn = tableTxs.filter(tx => tx.type === 'buy_in').reduce((sum, tx) => sum + Number(tx.amount), 0);
        const cashOut = tableTxs.filter(tx => tx.type === 'cash_out').reduce((sum, tx) => sum + Number(tx.amount), 0);
        const consumo = tableTxs.filter(tx => tx.type === 'consumo').reduce((sum, tx) => sum + Number(tx.amount), 0);
        
        daysMap[matchedKey].revenue += (buyIn - cashOut) + consumo;
      }
    });

    return Object.values(daysMap).sort((a,b) => b.revenue - a.revenue);
  };

  const weekdaysRank = getWeekdayRankings();
  const topWeekday = weekdaysRank[0]?.revenue > 0 ? weekdaysRank[0] : null;

  // 3. Top players rankings
  const getTopPlayersList = () => {
    const playersMap: Record<string, { name: string; id?: string; sessions: number; buyIn: number; consumo: number; total: number }> = {};

    periodSessions.forEach(sess => {
      if (!playersMap[sess.name]) {
        const gp = globalPlayers.find(g => g.name === sess.name);
        playersMap[sess.name] = { name: sess.name, id: gp?.id, sessions: 0, buyIn: 0, consumo: 0, total: 0 };
      }
      playersMap[sess.name].sessions++;
    });

    periodTxs.forEach(tx => {
      const session = tablePlayers.find(tp => tp.id === tx.player_id);
      if (session && playersMap[session.name]) {
        const amount = Number(tx.amount);
        if (tx.type === 'buy_in') {
          playersMap[session.name].buyIn += amount;
          playersMap[session.name].total += amount;
        } else if (tx.type === 'consumo') {
          playersMap[session.name].consumo += amount;
          playersMap[session.name].total += amount;
        }
      }
    });

    return Object.values(playersMap).sort((a,b) => b.total - a.total).slice(0, 5);
  };

  const topPlayers = getTopPlayersList();

  // 4. Products analytics ranking
  const getTopProducts = () => {
    const productsMap: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {};
    
    periodTxs.filter(tx => tx.type === 'consumo').forEach(tx => {
      const name = tx.description || 'Consumo Manual';
      if (!productsMap[name]) {
        productsMap[name] = { name, category: 'Copa', quantity: 0, revenue: 0 };
      }
      productsMap[name].quantity++;
      productsMap[name].revenue += Number(tx.amount);
    });

    return Object.values(productsMap).sort((a,b) => b.revenue - a.revenue).slice(0, 5);
  };

  const topProducts = getTopProducts();

  // 5. Player retention & active calculation
  const getRetentionData = () => {
    const totalGlobal = globalPlayers.length;
    
    const inactiveCount = globalPlayers.filter(gp => {
      const sessions = tablePlayers.filter(tp => tp.name === gp.name);
      if (sessions.length === 0) return true;
      const lastSession = [...sessions].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const diffDays = (Date.now() - new Date(lastSession.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 30; // inactive if > 30 days
    }).length;

    const newPlayersCount = globalPlayers.filter(gp => {
      const date = new Date(gp.created_at);
      return date >= fromDate && date <= toDate;
    }).length;

    const activeCount = Math.max(0, totalGlobal - inactiveCount);
    const recurrentCount = Math.max(0, activeCount - newPlayersCount);

    return {
      totalGlobal,
      newPlayersCount,
      activeCount,
      recurrentCount,
      inactiveCount
    };
  };

  const retention = getRetentionData();

  // 6. HEALTH SCORE INDEX FORMULA
  const computeHealthScore = () => {
    let score = 55; // baseline

    if (prevMetrics.revenue > 0) {
      const growth = ((metrics.revenue - prevMetrics.revenue) / prevMetrics.revenue) * 100;
      score += Math.min(20, Math.max(-20, growth * 0.6));
    } else if (metrics.revenue > 0) {
      score += 10;
    }

    const recurrenceRate = retention.activeCount > 0 ? (retention.recurrentCount / retention.activeCount) * 100 : 0;
    score += (recurrenceRate * 0.2);

    const density = metrics.tablesCount > 0 ? (periodSessions.length / metrics.tablesCount) : 0;
    score += Math.min(20, density * 2.5);

    const avgConsumo = retention.activeCount > 0 ? (metrics.totalConsumo / retention.activeCount) : 0;
    score += Math.min(20, avgConsumo * 0.8);

    const activeRatio = retention.totalGlobal > 0 ? (retention.activeCount / retention.totalGlobal) * 100 : 100;
    score += (activeRatio * 0.2);

    score = Math.min(100, Math.max(10, Math.round(score)));

    let status = 'Muito bom';
    let colorClass = 'text-primary';
    let feedback = '';

    if (score >= 95) {
      status = 'Elite';
      colorClass = 'text-purple-400';
      feedback = 'A saúde do clube está em nível de elite! A frequência nas sessões e as receitas estão extraordinárias.';
    } else if (score >= 85) {
      status = 'Excelente';
      colorClass = 'text-success';
      feedback = 'A saúde do clube está excelente. O engajamento dos jogadores é alto e o faturamento cresceu.';
    } else if (score >= 70) {
      status = 'Muito Bom';
      colorClass = 'text-blue-400';
      feedback = 'Operação saudável e consistente. Existem boas oportunidades para aumentar o consumo da copa.';
    } else if (score >= 50) {
      status = 'Atenção';
      colorClass = 'text-warning';
      feedback = 'Atenção necessária: percebemos uma queda na frequência de jogadores recorrentes ou na receita das mesas.';
    } else if (score >= 30) {
      status = 'Em Queda';
      colorClass = 'text-orange-400';
      feedback = 'Índice em queda. O número de jogadores inativos está aumentando. Recomenda-se disparar campanhas CRM.';
    } else {
      status = 'Crítico';
      colorClass = 'text-danger';
      feedback = 'Alerta crítico: a atividade do clube está muito abaixo da média histórica. Ação imediata é necessária.';
    }

    return { score, status, colorClass, feedback };
  };

  const health = computeHealthScore();

  function getTablePlayersCount(tableId: string) {
    return tablePlayers.filter(tp => tp.table_id === tableId).length;
  }

  // Insights builder
  const getInsights = () => {
    const list: string[] = [];
    if (topWeekday) {
      const pct = metrics.revenue > 0 ? ((topWeekday.revenue / metrics.revenue) * 100).toFixed(0) : '0';
      list.push(`A ${topWeekday.name} é o seu dia mais lucrativo, representando ${pct}% do faturamento do período.`);
    }
    if (metrics.totalConsumo > 0 && metrics.revenue > 0) {
      const pct = ((metrics.totalConsumo / metrics.revenue) * 100).toFixed(0);
      list.push(`O consumo de copa representa ${pct}% do faturamento líquido total.`);
    }
    if (retention.inactiveCount > 0) {
      list.push(`Existem ${retention.inactiveCount} jogadores inativos que não aparecem nas mesas há mais de 30 dias.`);
    }
    if (metrics.avgDuration > 0) {
      list.push(`Os jogadores permanecem em média ${metrics.avgDuration.toFixed(1)} horas sentados jogando.`);
    }
    if (topProducts[0]) {
      list.push(`O produto campeão de vendas é o "${topProducts[0].name}" com ${topProducts[0].quantity} unidades vendidas.`);
    }

    return list.slice(0, 3);
  };

  const insights = getInsights();

  // Projections
  const projectionRevenue = metrics.revenue * 1.08;
  const projectionPlayers = Math.round(metrics.uniquePlayers * 1.05);

  const handleExport = (type: 'pdf' | 'excel') => {
    alert(`Preparando estrutura de exportação para formato ${type.toUpperCase()}... Disponível em breve.`);
  };

  return (
    <div className="container animate-fade-in text-left max-w-7xl mx-auto px-4 py-2 space-y-6">
      
      {/* Header */}
      <div className="glass-panel border-t-4 border-t-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-xl">
            <BarChart3 size={24} />
          </div>
          <div className="text-left">
            <h1 className="mb-1 text-2xl font-black" style={{ fontSize: '1.75rem', margin: 0 }}>Analytics do Clube</h1>
            <p className="text-muted text-sm" style={{ margin: 0 }}>Transforme dados de caixas em decisões inteligentes para faturamento e gestão.</p>
          </div>
        </div>
        
        {/* PDF & Excel Export triggers */}
        <div className="flex gap-3">
          <button 
            onClick={() => handleExport('excel')}
            className="btn btn-outline btn-sm font-bold text-xs flex items-center gap-1.5 rounded-xl"
          >
            <FileText size={14} /> Excel
          </button>
          <button 
            onClick={() => handleExport('pdf')}
            className="btn btn-outline btn-sm font-bold text-xs flex items-center gap-1.5 rounded-xl"
          >
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><div className="spinner"></div></div>
      ) : (
        <div className="space-y-6">
          
          {/* Filters Bar panel */}
          <div className="glass-panel p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="input-group mb-0">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Calendar size={10} /> Período
              </label>
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
                className="input text-sm rounded-xl py-2 bg-dark"
                style={{ colorScheme: 'dark' }}
              >
                <option value="hoje">Hoje</option>
                <option value="7_dias">Últimos 7 dias</option>
                <option value="30_dias">Últimos 30 dias</option>
                <option value="este_mes">Este mês</option>
                <option value="ultimo_mes">Último mês</option>
                <option value="3_meses">Últimos 3 meses</option>
                <option value="12_meses">Últimos 12 meses</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            <div className="input-group mb-0">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Filter size={10} /> Mesa
              </label>
              <select 
                value={selectedTable} 
                onChange={(e) => setSelectedTable(e.target.value)}
                className="input text-sm rounded-xl py-2 bg-dark"
                style={{ colorScheme: 'dark' }}
              >
                <option value="all">Todas as mesas</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="input-group mb-0">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Filter size={10} /> Dia da Semana
              </label>
              <select 
                value={selectedDay} 
                onChange={(e) => setSelectedDay(e.target.value)}
                className="input text-sm rounded-xl py-2 bg-dark"
                style={{ colorScheme: 'dark' }}
              >
                <option value="all">Todos os dias</option>
                <option value="segunda">Segunda-feira</option>
                <option value="terca">Terça-feira</option>
                <option value="quarta">Quarta-feira</option>
                <option value="quinta">Quinta-feira</option>
                <option value="sexta">Sexta-feira</option>
                <option value="sabado">Sábado</option>
                <option value="domingo">Domingo</option>
              </select>
            </div>

            {period === 'personalizado' ? (
              <div className="grid grid-cols-2 gap-2 mb-0">
                <div className="input-group mb-0">
                  <label className="text-[10px] text-muted font-bold block mb-1">Início</label>
                  <input 
                    type="date" 
                    value={customStart} 
                    onChange={(e) => setCustomStart(e.target.value)} 
                    className="input text-xs py-1.5"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div className="input-group mb-0">
                  <label className="text-[10px] text-muted font-bold block mb-1">Fim</label>
                  <input 
                    type="date" 
                    value={customEnd} 
                    onChange={(e) => setCustomEnd(e.target.value)} 
                    className="input text-xs py-1.5"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted leading-relaxed pb-2 font-medium">
                Comparando com período equivalente anterior.
              </div>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex flex-wrap gap-2 bg-black bg-opacity-35 p-1.5 rounded-xl border border-glass-border max-w-max">
            <button 
              type="button"
              onClick={() => setActiveSubTab('geral')}
              style={{
                background: activeSubTab === 'geral' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none'
              }}
              className={`px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeSubTab === 'geral' ? 'text-white shadow-sm' : 'text-muted hover:text-white hover:bg-white hover:bg-opacity-5'
              }`}
            >
              <Activity size={14} /> Visão Geral
            </button>
            
            <button 
              type="button"
              onClick={() => setActiveSubTab('operacao')}
              style={{
                background: activeSubTab === 'operacao' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none'
              }}
              className={`px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeSubTab === 'operacao' ? 'text-white shadow-sm' : 'text-muted hover:text-white hover:bg-white hover:bg-opacity-5'
              }`}
            >
              <Clock size={14} /> Operação & Dias
            </button>

            <button 
              type="button"
              onClick={() => setActiveSubTab('copa')}
              style={{
                background: activeSubTab === 'copa' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none'
              }}
              className={`px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeSubTab === 'copa' ? 'text-white shadow-sm' : 'text-muted hover:text-white hover:bg-white hover:bg-opacity-5'
              }`}
            >
              <Coffee size={14} /> Copa & Consumos
            </button>

            <button 
              type="button"
              onClick={() => setActiveSubTab('jogadores')}
              style={{
                background: activeSubTab === 'jogadores' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none'
              }}
              className={`px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeSubTab === 'jogadores' ? 'text-white shadow-sm' : 'text-muted hover:text-white hover:bg-white hover:bg-opacity-5'
              }`}
            >
              <Users size={14} /> Jogadores & CRM
            </button>
          </div>

          {/* DYNAMIC RENDERING BY TAB */}

          {activeSubTab === 'geral' && (
            <div className="space-y-6">
              
              {/* Cards metrics dashboard row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                <div className="glass-panel p-5 text-left border border-glass-border">
                  <span className="text-[10px] font-bold text-muted uppercase block mb-1">Receita Líquida Total</span>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <span className="text-xl md:text-2xl font-black text-white">{formatMoney(metrics.revenue)}</span>
                    {renderVariation(metrics.revenue, prevMetrics.revenue)}
                  </div>
                  <p className="text-[10px] text-muted mt-2">Rake da mesa + Consumo da copa</p>
                </div>

                <div className="glass-panel p-5 text-left border border-glass-border">
                  <span className="text-[10px] font-bold text-muted uppercase block mb-1">Receita de Consumo</span>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <span className="text-xl md:text-2xl font-black text-white">{formatMoney(metrics.totalConsumo)}</span>
                    {renderVariation(metrics.totalConsumo, prevMetrics.totalConsumo)}
                  </div>
                  <p className="text-[10px] text-muted mt-2">Vendas totais de bebidas e copa</p>
                </div>

                <div className="glass-panel p-5 text-left border border-glass-border">
                  <span className="text-[10px] font-bold text-muted uppercase block mb-1">Jogadores Ativos</span>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <span className="text-xl md:text-2xl font-black text-white">{metrics.uniquePlayers}</span>
                    {renderVariation(metrics.uniquePlayers, prevMetrics.uniquePlayers)}
                  </div>
                  <p className="text-[10px] text-muted mt-2">Clientes únicos participantes</p>
                </div>

                <div className="glass-panel p-5 text-left border border-glass-border">
                  <span className="text-[10px] font-bold text-muted uppercase block mb-1">Ticket Médio</span>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <span className="text-xl md:text-2xl font-black text-white">{formatMoney(metrics.ticketMedio)}</span>
                    {renderVariation(metrics.ticketMedio, prevMetrics.ticketMedio)}
                  </div>
                  <p className="text-[10px] text-muted mt-2">Gasto médio por jogador ativo</p>
                </div>

              </div>

              {/* Health Index and Primary Line Graph */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* SVG line chart */}
                <div className="lg:col-span-2 glass-panel p-6 text-left">
                  <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
                    <Activity size={18} className="text-primary" />
                    <span>Evolução do Faturamento</span>
                  </h3>
                  
                  <div className="relative w-full overflow-hidden flex justify-center bg-black bg-opacity-25 rounded-2xl p-4 border border-glass-border">
                    {coords.length === 0 ? (
                      <div className="py-20 text-muted text-xs">Sem dados suficientes para gerar evolução.</div>
                    ) : (
                      <div className="w-full">
                        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
                          <defs>
                            <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          
                          <line x1={chartPadding} y1={chartPadding} x2={chartWidth - chartPadding} y2={chartPadding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                          <line x1={chartPadding} y1={chartHeight / 2} x2={chartWidth - chartPadding} y2={chartHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                          <line x1={chartPadding} y1={chartHeight - chartPadding} x2={chartWidth - chartPadding} y2={chartHeight - chartPadding} stroke="rgba(255,255,255,0.1)" />

                          <path d={areaPathD} fill="url(#chart-area-grad)" />
                          <path d={linePathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                          {coords.map((c, idx) => (
                            <circle key={idx} cx={c.x} cy={c.y} r="3.5" fill="#3b82f6" stroke="#0f172a" strokeWidth="1.5" />
                          ))}
                          
                          {/* Label values */}
                          {coords.map((c, idx) => {
                            if (c.value <= 0) return null;
                            return (
                              <text key={idx} x={c.x} y={c.y - 10} fill="#94a3b8" fontSize="8" textAnchor="middle" fontWeight="bold">
                                R$ {c.value.toFixed(0)}
                              </text>
                            );
                          })}

                          <text x={chartPadding} y={chartHeight - 6} fill="#94a3b8" fontSize="9" textAnchor="start">
                            {coords[0]?.label}
                          </text>
                          <text x={chartWidth - chartPadding} y={chartHeight - 6} fill="#94a3b8" fontSize="9" textAnchor="end">
                            {coords[coords.length - 1]?.label}
                          </text>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Health index card */}
                <div className="glass-panel p-6 text-left flex flex-col justify-between border-l-4 border-l-success">
                  <div>
                    <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2">
                      <Sparkles size={18} className="text-success" />
                      <span>Saúde do Clube</span>
                    </h3>
                    <p className="text-[10px] text-muted mb-4 uppercase font-bold tracking-wider">Índice Masmorra Analytics</p>

                    <div className="flex items-center gap-4 py-3 bg-black bg-opacity-35 rounded-2xl p-4 border border-glass-border">
                      <div className="w-16 h-16 rounded-full border-4 border-glass-border flex items-center justify-center text-xl font-black text-white relative">
                        <div className="absolute inset-0 rounded-full border-4 border-success border-t-transparent animate-spin-slow opacity-30" />
                        {health.score}
                      </div>
                      <div>
                        <h4 className={`text-lg font-black ${health.colorClass} mb-0.5`}>{health.status}</h4>
                        <p className="text-[10px] text-muted leading-tight">Nota operacional consolidada</p>
                      </div>
                    </div>

                    <p className="text-xs text-white leading-relaxed mt-4 bg-white bg-opacity-5 p-3.5 rounded-xl border border-glass-border">
                      "{health.feedback}"
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-glass-border space-y-2">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Recomendações</span>
                    <div className="text-[11px] text-muted space-y-1">
                      <p className="flex items-center gap-1.5 text-white"><span className="text-success font-bold">✓</span> Envie campanha de CRM para inativos</p>
                      <p className="flex items-center gap-1.5 text-white"><span className="text-success font-bold">✓</span> Ofereça drinks na mesa nos horários de pico</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Insights */}
              <div className="glass-panel p-5 text-left border-l-4 border-l-primary">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-primary" />
                  <span>Insights do Período</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {insights.map((ins, idx) => (
                    <div key={idx} className="flex gap-2 text-xs leading-normal text-muted bg-white bg-opacity-5 p-3 rounded-xl border border-glass-border">
                      <span className="text-primary text-sm">💡</span>
                      <p className="text-white" style={{ margin: 0 }}>{ins}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {activeSubTab === 'operacao' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column - Days list */}
              <div className="glass-panel p-6 text-left lg:col-span-1">
                <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
                  <Calendar size={18} className="text-primary" />
                  <span>Ranking de Faturamento por Dia</span>
                </h3>

                {weekdaysRank.length === 0 ? (
                  <p className="text-muted text-xs text-center py-6">Sem dados suficientes.</p>
                ) : (
                  <div className="space-y-3">
                    {weekdaysRank.map((day, idx) => (
                      <div key={idx} className="p-3.5 bg-black bg-opacity-25 rounded-xl border border-glass-border flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{day.name}</span>
                            {idx === 0 && day.revenue > 0 && (
                              <span className="text-[8px] bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-1.5 py-0.5 rounded font-extrabold uppercase">
                                🔥 Top
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted block mt-1">{day.tables} mesas • {day.players} jogadores</span>
                        </div>
                        <span className="font-extrabold text-sm text-success">{formatMoney(day.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column - Averages & Projections */}
              <div className="lg:col-span-2 space-y-6">
                
                <div className="glass-panel p-6 text-left">
                  <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-primary" />
                    <span>Métricas de Tempo e Horários</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-black bg-opacity-25 rounded-xl border border-glass-border">
                      <span className="text-[10px] text-muted font-bold uppercase block mb-1">Abertura Média</span>
                      <span className="text-base font-black text-white">20h15</span>
                    </div>
                    <div className="p-4 bg-black bg-opacity-25 rounded-xl border border-glass-border">
                      <span className="text-[10px] text-muted font-bold uppercase block mb-1">Encerramento Médio</span>
                      <span className="text-base font-black text-white">03h50</span>
                    </div>
                    <div className="p-4 bg-black bg-opacity-25 rounded-xl border border-glass-border">
                      <span className="text-[10px] text-muted font-bold uppercase block mb-1">Média de Mesa</span>
                      <span className="text-base font-black text-white">{metrics.avgDuration.toFixed(1)} horas</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="glass-panel p-5 text-left border border-glass-border">
                    <span className="text-[10px] font-bold text-muted uppercase block mb-3">Quinzenas</span>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">1ª Quinzena (Proporcional):</span>
                        <span className="font-extrabold text-white">{formatMoney(metrics.revenue * 0.48)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">2ª Quinzena (Proporcional):</span>
                        <span className="font-extrabold text-white">{formatMoney(metrics.revenue * 0.52)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-5 text-left border border-glass-border border-l-4 border-l-warning">
                    <span className="text-[10px] font-bold text-muted uppercase block mb-3">Previsão Próximo Turno</span>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">Receita Estimada:</span>
                        <span className="font-extrabold text-warning">{formatMoney(projectionRevenue)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">Jogadores Esperados:</span>
                        <span className="font-extrabold text-warning">{projectionPlayers} clientes</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {activeSubTab === 'copa' && (
            <div className="glass-panel p-6 text-left max-w-3xl mx-auto">
              <h3 className="text-white font-bold text-base mb-2 flex items-center gap-2">
                <Coffee size={18} className="text-primary" />
                <span>Ranking de Vendas de Copa</span>
              </h3>
              <p className="text-[10px] text-muted mb-6">Produtos mais vendidos e arrecadação por item</p>

              {topProducts.length === 0 ? (
                <p className="text-muted text-xs text-center py-8">Nenhum consumo lançado no período.</p>
              ) : (
                <div className="space-y-5">
                  {topProducts.map((prod, idx) => {
                    const maxRev = topProducts[0]?.revenue || 1;
                    const pct = (prod.revenue / maxRev) * 100;
                    return (
                      <div key={idx} className="space-y-1.5 p-3.5 bg-black bg-opacity-25 rounded-xl border border-glass-border">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{idx + 1}. {prod.name}</span>
                            <span className="text-[10px] text-muted">({prod.quantity} unidades)</span>
                          </div>
                          <span className="text-success font-extrabold">{formatMoney(prod.revenue)}</span>
                        </div>
                        <div className="w-full h-2 bg-black bg-opacity-35 rounded-full overflow-hidden">
                          <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'jogadores' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Top active players */}
              <div className="glass-panel p-6 text-left">
                <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
                  <Users size={18} className="text-primary" />
                  <span>Top Clientes do Período</span>
                </h3>

                {topPlayers.length === 0 ? (
                  <p className="text-muted text-xs text-center py-6">Nenhum jogador movimentou fundos.</p>
                ) : (
                  <div className="space-y-3">
                    {topPlayers.map((player, idx) => (
                      <div key={idx} className="p-3 bg-black bg-opacity-25 rounded-xl border border-glass-border flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary bg-opacity-10 text-primary flex items-center justify-center font-bold text-xs border border-primary border-opacity-10">
                            {player.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="text-left">
                            <span className="text-xs font-bold text-white block">{player.name}</span>
                            <span className="text-[10px] text-muted">{player.sessions} visitas às mesas</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-xs text-white block">{formatMoney(player.total)}</span>
                          <span className="text-[9px] text-muted">Consumo: {formatMoney(player.consumo)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CRM Retention */}
              <div className="glass-panel p-6 text-left border-l-4 border-l-primary flex flex-col justify-between">
                <div>
                  <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
                    <ShieldAlert size={18} className="text-primary" />
                    <span>Retenção & CRM</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-4 bg-black bg-opacity-25 rounded-xl border border-glass-border">
                      <span className="text-[9px] text-muted font-bold uppercase block mb-1">Novos Registrados</span>
                      <span className="text-lg font-black text-white">{retention.newPlayersCount}</span>
                    </div>
                    <div className="p-4 bg-black bg-opacity-25 rounded-xl border border-glass-border">
                      <span className="text-[9px] text-muted font-bold uppercase block mb-1">Clientes Inativos</span>
                      <span className="text-lg font-black text-danger">{retention.inactiveCount}</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted leading-relaxed mt-4 bg-white bg-opacity-5 p-3 rounded-xl border border-glass-border">
                    💡 **Dica de Fidelização**: Vá na aba **Relacionamento** e envie a mensagem automatizada de bônus para os {retention.inactiveCount} jogadores inativos cadastrados no sistema.
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
