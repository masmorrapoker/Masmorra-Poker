import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, Film, Printer, Trophy } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { tableService } from '../services/tableService';
import { playerService } from '../services/playerService';
import { transactionService } from '../services/transactionService';
import {
  aggregatePlayers,
  buildSessions,
  inPeriod,
  periodLabel,
  shiftPeriod,
  type Period,
  type PlayerStats,
  type Session
} from '../lib/playerStats';
import { currentNight } from '../lib/nightMath';
import { formatMoney } from '../utils';
import { toast } from '../components/Toast';

type Criterion = 'resultado' | 'presenca' | 'maior_noite';

const CRITERIA: { value: Criterion; label: string; hint: string }[] = [
  { value: 'resultado', label: 'Resultado', hint: 'Soma do que cada jogador ganhou ou perdeu nas noites do período.' },
  { value: 'presenca', label: 'Presença', hint: 'Quantas noites cada jogador jogou no período.' },
  { value: 'maior_noite', label: 'Maior noite', hint: 'O melhor resultado de cada jogador numa única noite.' }
];

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`;

function valueOf(p: PlayerStats, c: Criterion): number {
  if (c === 'presenca') return p.nights;
  if (c === 'maior_noite') return p.bestNight;
  return p.result;
}

function display(p: PlayerStats, c: Criterion): string {
  if (c === 'presenca') return `${p.nights} noite${p.nights === 1 ? '' : 's'}`;
  return signed(valueOf(p, c));
}

export default function Ranking() {
  const { clubId, clubName, canSeeFinance } = useClub();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>({ kind: 'month', value: currentNight().slice(0, 7) });
  const [criterion, setCriterion] = useState<Criterion>('resultado');

  useEffect(() => {
    if (!clubId) return;
    (async () => {
      try {
        const [tables, tablePlayers, transactions, players] = await Promise.all([
          tableService.getTables(clubId),
          playerService.getAllTablePlayers(clubId),
          transactionService.getAllTransactions(clubId),
          playerService.getPlayers(clubId)
        ]);
        setSessions(buildSessions(tables, tablePlayers, transactions, players));
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível carregar o ranking.');
      } finally {
        setLoading(false);
      }
    })();
  }, [clubId]);

  const periodSessions = useMemo(() => sessions.filter(s => inPeriod(s.night, period)), [sessions, period]);
  const nightsInPeriod = useMemo(() => new Set(periodSessions.map(s => s.night)).size, [periodSessions]);

  const ranking = useMemo(() => {
    const stats = aggregatePlayers(periodSessions);
    const list = criterion === 'presenca' ? stats : stats.filter(p => p.winRate !== null);
    return list.sort((a, b) => valueOf(b, criterion) - valueOf(a, criterion) || b.nights - a.nights || a.name.localeCompare(b.name));
  }, [periodSessions, criterion]);

  // Posição com empate: mesmo valor, mesma posição.
  const positions = useMemo(() => {
    const out: number[] = [];
    ranking.forEach((p, i) => {
      out.push(i > 0 && valueOf(p, criterion) === valueOf(ranking[i - 1], criterion) ? out[i - 1] : i + 1);
    });
    return out;
  }, [ranking, criterion]);

  const currentMonth = currentNight().slice(0, 7);
  const canGoForward =
    period.kind === 'month' ? period.value < currentMonth : period.kind === 'year' ? period.value < currentMonth.slice(0, 4) : false;

  function setKind(kind: Period['kind']) {
    if (kind === 'all') setPeriod({ kind: 'all' });
    else if (kind === 'year') setPeriod({ kind: 'year', value: currentMonth.slice(0, 4) });
    else setPeriod({ kind: 'month', value: currentMonth });
  }

  async function copyText() {
    const crit = CRITERIA.find(c => c.value === criterion)!;
    const lines = [
      `*Ranking ${crit.label.toLowerCase()} · ${periodLabel(period)}*${clubName ? `\n${clubName}` : ''}`,
      '',
      ...ranking.slice(0, 10).map((p, i) => `${positions[i]}º ${p.name}: ${display(p, criterion)}`)
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Ranking copiado. É só colar no grupo.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  const crit = CRITERIA.find(c => c.value === criterion)!;

  return (
    <div className="animate-fade-in max-w-3xl mx-auto mobile-view-padding text-left print-area">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="mb-1">Ranking</h1>
          <p className="text-muted text-sm mb-0">Quem mais ganhou e quem mais apareceu no clube.</p>
        </div>
        {canSeeFinance && (
          <Link
            to={`/retrospectiva${period.kind === 'month' ? `?mes=${period.value}` : ''}`}
            className="btn btn-outline no-underline no-print"
          >
            <Film size={16} /> Retrospectiva em vídeo
          </Link>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 no-print">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-glass-border" role="group" aria-label="Período" style={{ background: 'rgba(15,23,42,0.5)' }}>
          {([['month', 'Mês'], ['year', 'Ano'], ['all', 'Tudo']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={period.kind === k}
              onClick={() => setKind(k)}
              className={`px-4 py-2.5 rounded-lg text-xs font-bold cursor-pointer border-0 ${period.kind === k ? 'bg-primary text-white' : 'text-muted'}`}
              style={period.kind === k ? undefined : { background: 'transparent' }}
            >
              {label}
            </button>
          ))}
        </div>

        {period.kind !== 'all' && (
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setPeriod(shiftPeriod(period, -1))} aria-label="Período anterior">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-white text-center" style={{ minWidth: 150 }}>{periodLabel(period)}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setPeriod(shiftPeriod(period, 1))} disabled={!canGoForward} aria-label="Próximo período">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-2 overflow-x-auto no-print" role="tablist" aria-label="Critério">
        {CRITERIA.map(c => (
          <button
            key={c.value}
            type="button"
            role="tab"
            aria-selected={criterion === c.value}
            onClick={() => setCriterion(c.value)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer flex-shrink-0 ${
              criterion === c.value ? 'border-primary text-white bg-primary bg-opacity-20' : 'border-glass-border text-muted bg-white bg-opacity-5'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted mb-4">
        {crit.hint}{' '}
        {nightsInPeriod > 0 &&
          `${nightsInPeriod} noite${nightsInPeriod === 1 ? '' : 's'} de jogo ${period.kind === 'all' ? 'no total' : `em ${periodLabel(period).toLowerCase()}`}.`}
      </p>
      <p className="print-only text-sm text-white font-bold mb-3">{crit.label} · {periodLabel(period)}</p>

      {loading ? (
        <div className="flex justify-center p-10"><div className="spinner" role="status" aria-label="Carregando" /></div>
      ) : ranking.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <Trophy className="mx-auto text-muted mb-3" size={32} aria-hidden="true" />
          <p className="text-white font-bold mb-1">Nenhuma noite de jogo neste período.</p>
          <p className="text-sm text-muted mb-0">Use as setas para ver outro mês ou escolha "Tudo".</p>
        </div>
      ) : (
        <>
          <ol className="space-y-2 mb-6">
            {ranking.map((p, i) => {
              const pos = positions[i];
              const v = valueOf(p, criterion);
              const tone = criterion === 'presenca' ? 'text-white' : v > 0 ? 'text-success' : v < 0 ? 'text-danger' : 'text-muted';
              const medal = pos === 1 ? 'text-warning' : pos === 2 ? 'text-white' : pos === 3 ? 'text-danger' : 'text-muted';
              const inner = (
                <>
                  <span className={`w-8 text-center font-black text-sm flex-shrink-0 ${medal}`}>{pos}º</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white block truncate">{p.name}</span>
                    <span className="text-xs text-muted block">
                      {p.nights} noite{p.nights === 1 ? '' : 's'}
                      {p.winRate !== null && ` · ${Math.round(p.winRate * 100)}% no lucro`}
                    </span>
                  </span>
                  <span className={`text-sm font-extrabold flex-shrink-0 ${tone}`}>{display(p, criterion)}</span>
                </>
              );
              const cls = `flex items-center gap-3 p-3 rounded-xl border no-underline ${pos <= 3 ? 'border-glass-border' : 'border-transparent'}`;
              const style = { background: pos <= 3 ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.35)' };
              return (
                <li key={p.key}>
                  {p.playerId ? (
                    <Link to={`/player/${p.playerId}`} className={`${cls} hover:border-primary`} style={style}>{inner}</Link>
                  ) : (
                    <div className={cls} style={style}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="flex flex-col md:flex-row gap-2 no-print">
            <button type="button" className="btn btn-outline flex-1" onClick={copyText}>
              <Copy size={16} /> Copiar top 10 para WhatsApp
            </button>
            <button type="button" className="btn btn-outline flex-1" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir ou salvar PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
