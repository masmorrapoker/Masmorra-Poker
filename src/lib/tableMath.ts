import type { Acerto, DebtSettlement, Player, PlayerSummary, Table, Transaction } from '../types';
import { PAYMENT_METHODS, type PaymentMethod } from './paymentMethods';
import { formatMoney } from '../utils';

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

export function summarizePlayers(
  players: Player[],
  transactions: Transaction[],
  settlements: Pick<DebtSettlement, 'amount' | 'transaction_id'>[] = []
): PlayerSummary[] {
  return players.map(player => {
    const txs = transactions.filter(tx => tx.player_id === player.id);
    const sum = (type: Transaction['type']) =>
      txs.filter(tx => tx.type === type).reduce((acc, tx) => acc + Number(tx.amount), 0);
    const buyIn = sum('buy_in');
    const cashOut = sum('cash_out');
    const consumo = sum('consumo');
    const balance = cashOut - buyIn - consumo;
    const cashOuts = txs
      .filter(tx => tx.type === 'cash_out')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const hasCashOut = cashOuts.length > 0;
    return {
      player,
      buyIn,
      cashOut,
      consumo,
      balance,
      hasCashOut,
      acerto: hasCashOut ? buildAcerto(balance, cashOuts, settlements) : undefined
    };
  });
}

function buildAcerto(
  balance: number,
  cashOuts: Transaction[],
  settlements: Pick<DebtSettlement, 'amount' | 'transaction_id'>[]
): Acerto {
  const ids = new Set(cashOuts.map(tx => tx.id));
  const fiado = cashOuts.reduce((s, tx) => s + Number(tx.fiado_amount ?? 0), 0);
  const abatido = settlements
    .filter(st => st.transaction_id && ids.has(st.transaction_id))
    .reduce((s, st) => s + Number(st.amount), 0);
  const method = [...cashOuts].reverse().find(tx => tx.payment_method)?.payment_method ?? null;
  return {
    method,
    paidIn: balance < 0 ? Math.max(0, -balance - fiado) : 0,
    paidOut: balance > 0 ? Math.max(0, balance - abatido) : 0,
    fiado,
    abatido
  };
}

/** Texto curto do acerto, para a lista e o relatório. */
export function describeAcerto(s: PlayerSummary): string {
  const a = s.acerto;
  if (!a) return 'Ainda jogando';
  const how = a.method ? ` (${PAYMENT_METHODS.find(m => m.value === a.method)?.label})` : '';
  const parts: string[] = [];
  if (s.balance < 0) {
    if (a.paidIn > 0) parts.push(`Pagou ${formatMoney(a.paidIn)}${how}`);
    if (a.fiado > 0) parts.push(`Ficou devendo ${formatMoney(a.fiado)}`);
  } else if (s.balance > 0) {
    if (a.paidOut > 0) parts.push(`Recebeu ${formatMoney(a.paidOut)}${how}`);
    if (a.abatido > 0) parts.push(`Abateu ${formatMoney(a.abatido)} de fiado`);
  } else {
    parts.push('Saiu no zero');
  }
  return parts.join(' · ');
}

export interface MethodTotals {
  method: PaymentMethod | 'nao_informado';
  label: string;
  entradas: number; // acertos recebidos dos jogadores que perderam
  saidas: number;   // acertos pagos aos jogadores que ganharam
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
  /** Acertos por forma de pagamento (só de quem já saiu) */
  byMethod: MethodTotals[];
  /** Acertos que ficaram no fiado nesta mesa */
  fiado: number;
  /** Fiado antigo abatido de quem saiu ganhando */
  abatido: number;
}

export function computeTableTotals(summaries: PlayerSummary[]): TableTotals {
  const buyIn = summaries.reduce((s, p) => s + p.buyIn, 0);
  const cashOut = summaries.reduce((s, p) => s + p.cashOut, 0);
  const consumo = summaries.reduce((s, p) => s + p.consumo, 0);
  const activeCount = summaries.filter(p => !p.hasCashOut).length;
  const acertos = summaries.map(s => s.acerto).filter((a): a is Acerto => Boolean(a));

  const keys: (PaymentMethod | 'nao_informado')[] = [...PAYMENT_METHODS.map(m => m.value), 'nao_informado'];
  const byMethod: MethodTotals[] = keys.map(key => {
    const list = acertos.filter(a => (a.method ?? 'nao_informado') === key);
    return {
      method: key,
      label: key === 'nao_informado' ? 'Não informado' : PAYMENT_METHODS.find(m => m.value === key)!.label,
      entradas: list.reduce((s, a) => s + a.paidIn, 0),
      saidas: list.reduce((s, a) => s + a.paidOut, 0)
    };
  }).filter(m => m.entradas > 0 || m.saidas > 0);

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
    fiado: acertos.reduce((s, a) => s + a.fiado, 0),
    abatido: acertos.reduce((s, a) => s + a.abatido, 0)
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
      hasCashOut: Boolean(prev.hasCashOut && s.hasCashOut),
      acerto: prev.acerto && s.acerto
        ? {
            method: s.acerto.method ?? prev.acerto.method,
            paidIn: prev.acerto.paidIn + s.acerto.paidIn,
            paidOut: prev.acerto.paidOut + s.acerto.paidOut,
            fiado: prev.acerto.fiado + s.acerto.fiado,
            abatido: prev.acerto.abatido + s.acerto.abatido
          }
        : prev.acerto ?? s.acerto
    });
  }
  return [...groups.values()];
}
