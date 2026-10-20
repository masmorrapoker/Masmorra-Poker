import type { GlobalPlayer, Player, Table, Transaction } from '../types';
import { nightOf } from './nightMath';

/**
 * Uma "sessão" é a participação de um jogador numa mesa. Se ele foi adicionado
 * mais de uma vez na mesma mesa (registros antigos), as linhas são somadas.
 */
export interface Session {
  /** Cadastro (players.id) ou "nome:<nome>" para registros antigos sem vínculo */
  key: string;
  playerId: string | null;
  name: string;
  table: Table;
  night: string;
  buyIn: number;
  cashOut: number;
  consumo: number;
  /** cash-out − buy-in − consumo */
  result: number;
  /** já fez cash-out (resultado definitivo) */
  finished: boolean;
  /** parte do acerto que ficou no fiado */
  fiado: number;
}

const keyOf = (tp: Pick<Player, 'player_id' | 'name'>) =>
  tp.player_id || `nome:${tp.name.trim().toLowerCase()}`;

export function buildSessions(
  tables: Table[],
  tablePlayers: Player[],
  transactions: Transaction[],
  globalPlayers: GlobalPlayer[] = []
): Session[] {
  const tableById = new Map(tables.map(t => [t.id, t]));
  const txByTp = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const list = txByTp.get(tx.player_id);
    if (list) list.push(tx);
    else txByTp.set(tx.player_id, [tx]);
  }
  const nameById = new Map(globalPlayers.map(g => [g.id, g.name]));

  const sessions = new Map<string, Session>();
  for (const tp of tablePlayers) {
    const table = tableById.get(tp.table_id);
    if (!table) continue;
    const key = keyOf(tp);
    const id = `${key}|${table.id}`;
    const txs = txByTp.get(tp.id) ?? [];
    const sum = (type: Transaction['type']) =>
      txs.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
    const buyIn = sum('buy_in');
    const cashOut = sum('cash_out');
    const consumo = sum('consumo');
    const fiado = txs.filter(t => t.type === 'cash_out').reduce((s, t) => s + Number(t.fiado_amount ?? 0), 0);
    const hasCashOut = txs.some(t => t.type === 'cash_out');
    const hasAny = txs.length > 0;

    const prev = sessions.get(id);
    if (prev) {
      const prevEmpty = prev.buyIn === 0 && prev.cashOut === 0 && prev.consumo === 0;
      if (prevEmpty) prev.finished = hasCashOut;
      else if (hasAny) prev.finished = prev.finished && hasCashOut;
      prev.buyIn += buyIn;
      prev.cashOut += cashOut;
      prev.consumo += consumo;
      prev.fiado += fiado;
      prev.result = prev.cashOut - prev.buyIn - prev.consumo;
      continue;
    }
    sessions.set(id, {
      key,
      playerId: tp.player_id ?? null,
      name: (tp.player_id && nameById.get(tp.player_id)) || tp.name,
      table,
      night: nightOf(table.created_at),
      buyIn,
      cashOut,
      consumo,
      result: cashOut - buyIn - consumo,
      finished: hasCashOut,
      fiado
    });
  }
  // Sessões sem nenhum lançamento (só adicionado) não contam.
  return [...sessions.values()].filter(s => s.buyIn > 0 || s.cashOut > 0 || s.consumo > 0);
}

export interface PlayerStats {
  key: string;
  playerId: string | null;
  name: string;
  nights: number;
  sessions: number;
  buyIn: number;
  consumo: number;
  result: number;
  /** noites com resultado positivo / noites finalizadas */
  winRate: number | null;
  bestNight: number;
  worstNight: number;
  lastNight: string | null;
}

/** Junta as sessões por jogador. Só sessões finalizadas entram no resultado. */
export function aggregatePlayers(sessions: Session[]): PlayerStats[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = map.get(s.key);
    if (list) list.push(s);
    else map.set(s.key, [s]);
  }
  return [...map.values()].map(list => {
    // resultado por noite (pode haver mais de uma mesa na mesma noite)
    const byNight = new Map<string, number>();
    for (const s of list.filter(x => x.finished)) {
      byNight.set(s.night, (byNight.get(s.night) ?? 0) + s.result);
    }
    const nightResults = [...byNight.values()];
    const nights = new Set(list.map(s => s.night));
    const last = [...nights].sort().pop() ?? null;
    return {
      key: list[0].key,
      playerId: list[0].playerId,
      name: list[0].name,
      nights: nights.size,
      sessions: list.length,
      buyIn: list.reduce((s, x) => s + x.buyIn, 0),
      consumo: list.reduce((s, x) => s + x.consumo, 0),
      result: nightResults.reduce((s, v) => s + v, 0),
      winRate: nightResults.length ? nightResults.filter(v => v > 0).length / nightResults.length : null,
      bestNight: nightResults.length ? Math.max(...nightResults) : 0,
      worstNight: nightResults.length ? Math.min(...nightResults) : 0,
      lastNight: last
    };
  });
}

/** Período do ranking: um mês (AAAA-MM), um ano (AAAA) ou tudo. */
export type Period = { kind: 'month'; value: string } | { kind: 'year'; value: string } | { kind: 'all' };

export function inPeriod(night: string, period: Period): boolean {
  if (period.kind === 'all') return true;
  return night.startsWith(period.value);
}

export function shiftPeriod(period: Period, step: number): Period {
  if (period.kind === 'year') return { kind: 'year', value: String(Number(period.value) + step) };
  if (period.kind === 'month') {
    const [y, m] = period.value.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + step, 1));
    return { kind: 'month', value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` };
  }
  return period;
}

export function periodLabel(period: Period): string {
  if (period.kind === 'all') return 'Desde o início';
  if (period.kind === 'year') return period.value;
  const [y, m] = period.value.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 15)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
