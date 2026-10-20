import type { Table, Transaction } from '../types';
import { aggregatePlayers, sessionMinutes, type Session } from './playerStats';
import { formatNight } from './nightMath';

/**
 * Retrospectiva do mês: os destaques que viram quadros do vídeo.
 * Só celebra feitos (ninguém aparece por ter perdido).
 */

export interface Highlight {
  name: string;
  value: number;
  detail?: string;
}

export interface Retrospective {
  month: string; // AAAA-MM
  monthName: string; // "outubro"
  nights: number;
  players: number;
  minutes: number;
  mostPresent: Highlight | null; // value = noites
  mostTime: Highlight | null; // value = minutos
  bestNight: Highlight | null; // value = R$
  topWinner: Highlight | null; // value = R$
  longestTable: Highlight | null; // value = minutos
  barKing: Highlight | null; // value = itens
  topProduct: Highlight | null; // value = pedidos
  debuts: string[];
  top5: Highlight[]; // por resultado (só positivos)
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? names[0] ?? '' : names.length === 2 ? `${names[0]} e ${names[1]}` : `${names[0]}, ${names[1]} e mais ${names.length - 2}`;

/** Maior valor; empate junta os nomes. */
function leader<T>(items: T[], value: (t: T) => number, name: (t: T) => string): Highlight | null {
  if (items.length === 0) return null;
  const max = Math.max(...items.map(value));
  if (!(max > 0)) return null;
  const tied = items.filter(i => value(i) === max).map(name);
  return { name: joinNames(tied), value: max };
}

export function buildRetrospective(
  month: string,
  allSessions: Session[],
  tables: Table[],
  transactions: Transaction[]
): Retrospective {
  const sessions = allSessions.filter(s => s.night.startsWith(month));
  const stats = aggregatePlayers(sessions);
  const [y, m] = month.split('-').map(Number);
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));

  // Tempo por jogador
  const minutesByKey = new Map<string, { name: string; min: number }>();
  let totalMinutes = 0;
  for (const s of sessions) {
    const min = sessionMinutes(s);
    if (min === null) continue;
    totalMinutes += min;
    const cur = minutesByKey.get(s.key) ?? { name: s.name, min: 0 };
    cur.min += min;
    minutesByKey.set(s.key, cur);
  }

  // Maior noite (um jogador, uma noite)
  const nightResults = new Map<string, { name: string; value: number; tables: string[]; night: string }>();
  for (const s of sessions.filter(x => x.finished)) {
    const k = `${s.key}|${s.night}`;
    const cur = nightResults.get(k) ?? { name: s.name, value: 0, tables: [], night: s.night };
    cur.value += s.result;
    cur.tables.push(s.table.name);
    nightResults.set(k, cur);
  }
  const bestNightEntry = [...nightResults.values()].sort((a, b) => b.value - a.value)[0];
  const bestNight =
    bestNightEntry && bestNightEntry.value > 0
      ? { name: bestNightEntry.name, value: bestNightEntry.value, detail: `${bestNightEntry.tables[0]} · ${formatNight(bestNightEntry.night, { weekday: false }).slice(0, 5)}` }
      : null;

  // Mesa mais longa: da primeira entrada ao último lançamento
  const monthTables = tables.filter(t => sessions.some(s => s.table.id === t.id));
  const tableSpans = monthTables.map(t => {
    const starts = sessions.filter(s => s.table.id === t.id && s.enteredAt).map(s => s.enteredAt!);
    const ends = transactions.filter(tx => tx.table_id === t.id).map(tx => tx.created_at);
    const start = starts.sort()[0] ?? t.created_at;
    const end = ends.sort().pop();
    const min = end ? Math.min((new Date(end).getTime() - new Date(start).getTime()) / 60000, 20 * 60) : 0;
    return { name: t.name, min };
  });

  // Copa
  const tableIds = new Set(monthTables.map(t => t.id));
  const consumoTx = transactions.filter(tx => tx.type === 'consumo' && tableIds.has(tx.table_id));
  const itemsByPlayer = new Map<string, { name: string; n: number }>();
  for (const s of sessions) {
    const rows = new Set(s.rowIds ?? []);
    const n = consumoTx.filter(tx => rows.has(tx.player_id)).length;
    if (!n) continue;
    const cur = itemsByPlayer.get(s.key) ?? { name: s.name, n: 0 };
    cur.n += n;
    itemsByPlayer.set(s.key, cur);
  }
  const products = new Map<string, number>();
  for (const tx of consumoTx) {
    const p = (tx.description || 'Consumo').trim();
    products.set(p, (products.get(p) ?? 0) + 1);
  }

  // Estreias: primeira noite da vida no clube caiu neste mês
  const firstNight = new Map<string, { name: string; night: string }>();
  for (const s of allSessions) {
    const cur = firstNight.get(s.key);
    if (!cur || s.night < cur.night) firstNight.set(s.key, { name: s.name, night: s.night });
  }
  const debuts = [...firstNight.values()].filter(f => f.night.startsWith(month)).map(f => f.name);

  const winners = stats.filter(p => p.result > 0).sort((a, b) => b.result - a.result);

  return {
    month,
    monthName,
    nights: new Set(sessions.map(s => s.night)).size,
    players: stats.length,
    minutes: Math.round(totalMinutes),
    mostPresent: leader(stats, p => p.nights, p => p.name),
    mostTime: leader([...minutesByKey.values()], v => Math.round(v.min), v => v.name),
    bestNight,
    topWinner: winners[0] ? { name: winners[0].name, value: winners[0].result } : null,
    longestTable: leader(tableSpans, t => Math.round(t.min), t => t.name),
    barKing: leader([...itemsByPlayer.values()], v => v.n, v => v.name),
    topProduct: leader([...products.entries()], ([, n]) => n, ([p]) => p),
    debuts,
    top5: winners.slice(0, 5).map(p => ({ name: p.name, value: p.result }))
  };
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  return m ? `${h}h ${String(m).padStart(2, '0')}min` : `${h}h`;
}
