import type { Acerto, DebtSettlement, Player, Table, Transaction } from '../types';
import { summarizePlayers, computeTableTotals } from './tableMath';

/**
 * Noite de jogo: mesas abertas entre 08:00 de um dia e 08:00 do dia seguinte
 * (horário de Brasília) pertencem à mesma noite. Uma mesa aberta à 00:59
 * conta para a noite anterior.
 */
const TZ = 'America/Sao_Paulo';
const CUTOFF_HOUR = 8;
const OFFSET = '-03:00'; // Brasília sem horário de verão desde 2019

const ymd = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export function nightOf(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return ymd(new Date(d.getTime() - CUTOFF_HOUR * 3600 * 1000));
}

export const currentNight = () => nightOf(new Date());

export function shiftNight(night: string, days: number): string {
  const d = new Date(`${night}T12:00:00${OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

export function nightRange(night: string): { from: string; to: string } {
  const hh = String(CUTOFF_HOUR).padStart(2, '0');
  return {
    from: new Date(`${night}T${hh}:00:00${OFFSET}`).toISOString(),
    to: new Date(`${shiftNight(night, 1)}T${hh}:00:00${OFFSET}`).toISOString()
  };
}

export function formatNight(night: string, opts: { weekday?: boolean } = { weekday: true }): string {
  const d = new Date(`${night}T12:00:00${OFFSET}`);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: opts.weekday ? 'long' : undefined,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

export type CashMethod = 'dinheiro' | 'pix' | 'cartao';

export interface MethodFlow {
  recebido: number;      // acertos pagos pelos jogadores que perderam
  pago: number;          // acertos pagos aos jogadores que ganharam
  fiadoRecebido: number; // pagamentos de fiado antigo recebidos nesta noite
}

export interface NightData {
  tables: Table[];
  players: Player[];
  transactions: Transaction[];
  /** Abatimentos ligados às mesas da noite */
  tableSettlements: DebtSettlement[];
  /** Pagamentos de fiado recebidos durante a noite (dinheiro/PIX/cartão) */
  fiadoPayments: DebtSettlement[];
  /** Lançamentos de torneio feitos na noite (com o nome do inscrito) */
  tournamentMovements?: NightTournamentMovement[];
}

export interface NightTournamentMovement {
  tournament_id: string;
  kind: 'buyin' | 'rebuy' | 'addon' | 'bonus' | 'premio' | 'extra';
  amount: number;
  to_prize: number;
  payment_method: string | null;
  name: string;
}

export interface NightSummary {
  tables: { table: Table; activeCount: number; rake: number; revenue: number }[];
  openTables: number;
  stillPlaying: number;
  buyIn: number;
  cashOut: number;
  consumo: number;
  rake: number;
  revenue: number;
  flows: Record<CashMethod, MethodFlow>;
  /** Acertos sem forma de pagamento informada */
  semForma: { recebido: number; pago: number };
  fiadoGerado: { name: string; amount: number }[];
  fiadoGeradoTotal: number;
  abatido: number;
  /** Torneios da noite: taxa da casa e quanto a casa cobriu do garantido */
  tournaments: { count: number; fee: number; overlay: number; collected: number; prizes: number };
}

const emptyFlow = (): MethodFlow => ({ recebido: 0, pago: 0, fiadoRecebido: 0 });

export function summarizeNight(data: NightData): NightSummary {
  const flows: Record<CashMethod, MethodFlow> = { dinheiro: emptyFlow(), pix: emptyFlow(), cartao: emptyFlow() };
  const semForma = { recebido: 0, pago: 0 };
  const fiadoGerado: { name: string; amount: number }[] = [];
  const out: NightSummary['tables'] = [];
  let buyIn = 0, cashOut = 0, consumo = 0, abatido = 0, stillPlaying = 0;

  for (const table of data.tables) {
    const players = data.players.filter(p => p.table_id === table.id);
    const txs = data.transactions.filter(tx => tx.table_id === table.id);
    const sts = data.tableSettlements.filter(s => s.table_id === table.id);
    const summaries = summarizePlayers(players, txs, sts);
    const totals = computeTableTotals(summaries);
    buyIn += totals.buyIn;
    cashOut += totals.cashOut;
    consumo += totals.consumo;
    abatido += totals.abatido;
    stillPlaying += totals.activeCount;
    out.push({ table, activeCount: totals.activeCount, rake: totals.rake, revenue: totals.revenue });

    for (const s of summaries) {
      const a: Acerto | undefined = s.acerto;
      if (!a) continue;
      const bucket = a.method && a.method !== 'fiado' ? flows[a.method] : null;
      if (bucket) {
        bucket.recebido += a.paidIn;
        bucket.pago += a.paidOut;
      } else {
        semForma.recebido += a.paidIn;
        semForma.pago += a.paidOut;
      }
      if (a.fiado > 0) fiadoGerado.push({ name: s.player.name, amount: a.fiado });
    }
  }

  for (const p of data.fiadoPayments) {
    if (p.method === 'dinheiro' || p.method === 'pix' || p.method === 'cartao') {
      flows[p.method].fiadoRecebido += Number(p.amount);
    }
  }

  // Torneios: inscrições recebidas e prêmios pagos passam pela gaveta/PIX.
  const tm = data.tournamentMovements ?? [];
  const tour = { count: new Set(tm.map(m => m.tournament_id)).size, fee: 0, overlay: 0, collected: 0, prizes: 0 };
  const byTournament = new Map<string, { pool: number; prizes: number }>();
  for (const m of tm) {
    const amount = Number(m.amount);
    const acc = byTournament.get(m.tournament_id) ?? { pool: 0, prizes: 0 };
    if (m.kind === 'buyin' || m.kind === 'rebuy' || m.kind === 'addon') {
      tour.collected += amount;
      tour.fee += amount - Number(m.to_prize);
      acc.pool += Number(m.to_prize);
      if (m.payment_method === 'fiado') fiadoGerado.push({ name: `${m.name} (torneio)`, amount });
      else if (m.payment_method === 'dinheiro' || m.payment_method === 'pix' || m.payment_method === 'cartao') flows[m.payment_method].recebido += amount;
      else semForma.recebido += amount;
    } else if (m.kind === 'premio' || m.kind === 'extra') {
      tour.prizes += amount;
      if (m.kind === 'premio') acc.prizes += amount;
      if (m.payment_method === 'dinheiro' || m.payment_method === 'pix' || m.payment_method === 'cartao') flows[m.payment_method].pago += amount;
      else semForma.pago += amount;
      if (m.kind === 'extra') tour.overlay += amount; // prêmio extra sai do bolso da casa
    }
    byTournament.set(m.tournament_id, acc);
  }
  for (const v of byTournament.values()) tour.overlay += Math.max(0, v.prizes - v.pool);

  fiadoGerado.sort((a, b) => b.amount - a.amount);

  return {
    tables: out,
    openTables: data.tables.filter(t => t.status === 'active').length,
    stillPlaying,
    buyIn,
    cashOut,
    consumo,
    rake: buyIn - cashOut,
    revenue: buyIn - cashOut + consumo + tour.fee - tour.overlay,
    flows,
    semForma,
    fiadoGerado,
    fiadoGeradoTotal: fiadoGerado.reduce((s, f) => s + f.amount, 0),
    abatido,
    tournaments: tour
  };
}

/** Dinheiro que deveria estar na gaveta. */
export function expectedCash(summary: NightSummary, openingCash: number): number {
  const d = summary.flows.dinheiro;
  return Math.round((openingCash + d.recebido + d.fiadoRecebido - d.pago) * 100) / 100;
}
