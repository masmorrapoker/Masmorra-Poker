import type { Player, PlayerSummary, Table, Transaction } from '../types';
import { PAYMENT_METHODS, type PaymentMethod } from './paymentMethods';

/**
 * Cálculos da mesa num só lugar: a tela, o fechamento e o relatório usam as
 * mesmas regras.
 *
 * Regras do clube:
 *  - saldo do jogador = cash-out − buy-in − consumo
 *  - jogador "ativo" = ainda não fez cash-out
 *  - rake = buy-ins − cash-outs; só é definitivo quando todos fizeram cash-out
 *  - receita do clube na mesa = rake + consumo
 */

export function summarizePlayers(players: Player[], transactions: Transaction[]): PlayerSummary[] {
  return players.map(player => {
    const txs = transactions.filter(tx => tx.player_id === player.id);
    const sum = (type: Transaction['type']) =>
      txs.filter(tx => tx.type === type).reduce((acc, tx) => acc + Number(tx.amount), 0);
    const buyIn = sum('buy_in');
    const cashOut = sum('cash_out');
    const consumo = sum('consumo');
    return {
      player,
      buyIn,
      cashOut,
      consumo,
      balance: cashOut - buyIn - consumo,
      hasCashOut: txs.some(tx => tx.type === 'cash_out')
    };
  });
}

export interface MethodTotals {
  method: PaymentMethod | 'nao_informado';
  label: string;
  entradas: number; // buy-ins recebidos por esse meio
  saidas: number;   // cash-outs pagos por esse meio
}

export interface TableTotals {
  buyIn: number;
  cashOut: number;
  consumo: number;
  /** buy-ins − cash-outs (definitivo só se allCashedOut) */
  rake: number;
  /** rake + consumo */
  revenue: number;
  activeCount: number;
  closedCount: number;
  allCashedOut: boolean;
  byMethod: MethodTotals[];
  /** Total de buy-in lançado como fiado nesta mesa */
  fiado: number;
}

export function computeTableTotals(summaries: PlayerSummary[], transactions: Transaction[]): TableTotals {
  const buyIn = summaries.reduce((s, p) => s + p.buyIn, 0);
  const cashOut = summaries.reduce((s, p) => s + p.cashOut, 0);
  const consumo = summaries.reduce((s, p) => s + p.consumo, 0);
  const activeCount = summaries.filter(p => !p.hasCashOut).length;

  const keys: (PaymentMethod | 'nao_informado')[] = [...PAYMENT_METHODS.map(m => m.value), 'nao_informado'];
  const byMethod: MethodTotals[] = keys.map(key => {
    const txs = transactions.filter(tx => tx.type !== 'consumo' && (tx.payment_method ?? 'nao_informado') === key);
    return {
      method: key,
      label: key === 'nao_informado' ? 'Não informado' : PAYMENT_METHODS.find(m => m.value === key)!.label,
      entradas: txs.filter(tx => tx.type === 'buy_in').reduce((s, tx) => s + Number(tx.amount), 0),
      saidas: txs.filter(tx => tx.type === 'cash_out').reduce((s, tx) => s + Number(tx.amount), 0)
    };
  }).filter(m => m.entradas > 0 || m.saidas > 0);

  const fiado = transactions
    .filter(tx => tx.payment_method === 'fiado' && tx.type === 'buy_in')
    .reduce((s, tx) => s + Number(tx.amount), 0);

  return {
    buyIn,
    cashOut,
    consumo,
    rake: buyIn - cashOut,
    revenue: buyIn - cashOut + consumo,
    activeCount,
    closedCount: summaries.length - activeCount,
    allCashedOut: summaries.length > 0 && activeCount === 0,
    byMethod,
    fiado
  };
}

export function formatDuration(table: Pick<Table, 'created_at' | 'closed_at'>, now = Date.now()): string {
  const start = new Date(table.created_at).getTime();
  const end = table.closed_at ? new Date(table.closed_at).getTime() : now;
  const mins = Math.max(0, Math.floor((end - start) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Junta linhas do mesmo jogador (mesmo cadastro ou mesmo nome) para o
 * relatório. Mesas antigas podem ter o mesmo jogador adicionado mais de uma vez.
 * Linhas sem nenhum lançamento são descartadas.
 */
export function mergeByPlayer(summaries: PlayerSummary[]): PlayerSummary[] {
  const groups = new Map<string, PlayerSummary>();
  for (const s of summaries) {
    if (s.buyIn === 0 && s.cashOut === 0 && s.consumo === 0) continue;
    const key = s.player.player_id || s.player.name.trim().toLowerCase();
    const prev = groups.get(key);
    if (!prev) {
      groups.set(key, { ...s });
      continue;
    }
    groups.set(key, {
      player: prev.player,
      buyIn: prev.buyIn + s.buyIn,
      cashOut: prev.cashOut + s.cashOut,
      consumo: prev.consumo + s.consumo,
      balance: prev.balance + s.balance,
      hasCashOut: Boolean(prev.hasCashOut && s.hasCashOut)
    });
  }
  return [...groups.values()];
}
