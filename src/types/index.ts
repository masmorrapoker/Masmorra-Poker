export type TableStatus = 'active' | 'closed';

export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  created_at: string;
  closed_at: string | null;
}

export interface GlobalPlayer {
  id: string;
  name: string;
  created_at: string;
  phone?: string | null;
  birth_date?: string | null;
  notes?: string | null;
}

export interface Player {
  id: string;
  table_id: string;
  /** Vínculo com o cadastro (players.id). Nulo apenas em registros antigos. */
  player_id?: string | null;
  name: string;
  created_at: string;
}

export type TransactionType = 'buy_in' | 'cash_out' | 'consumo';

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao' | 'fiado';

export interface Transaction {
  id: string;
  table_id: string;
  player_id: string;
  type: TransactionType;
  amount: number;
  description?: string;
  /**
   * No cash-out: como o acerto foi pago/recebido (null = sem informação ou
   * tudo no fiado). Lançamentos antigos podem ter forma no buy-in.
   */
  payment_method?: PaymentMethod | null;
  /** No cash-out: quanto do acerto o jogador ficou devendo (fiado). */
  fiado_amount?: number;
  created_at: string;
}

export interface PlayerSummary {
  player: Player;
  buyIn: number;
  cashOut: number;
  consumo: number;
  balance: number; // cashOut - buyIn - consumo
  hasCashOut?: boolean;
  /** Acerto feito na saída (só para quem já fez cash-out) */
  acerto?: Acerto;
}

/**
 * Acerto do jogador na saída. O resultado (balance) é acertado assim:
 *  - perdeu: paidIn (pago na hora) + fiado (ficou devendo) = −resultado
 *  - ganhou: paidOut (pago pelo clube) + abatido (fiado antigo descontado) = resultado
 */
export interface Acerto {
  method: PaymentMethod | null;
  paidIn: number;
  paidOut: number;
  fiado: number;
  abatido: number;
}

/** Lançamento removido, lido da auditoria (transactions_audit). */
export interface RemovedTransaction {
  id: number;
  transaction_id: string;
  old_data: Transaction;
  changed_at: string;
}

export type TableEventType =
  | 'mesa_aberta' | 'mesa_encerrada' | 'jogador_entrou' | 'jogador_removido'
  | 'buy_in' | 'cash_out' | 'consumo' | 'lancamento_removido' | 'lancamento_alterado';

/** Evento da linha do tempo da mesa (tabela table_events, gravada pelo banco). */
export interface TableEvent {
  id: number;
  table_id: string;
  event_type: TableEventType;
  player_name: string | null;
  amount: number | null;
  description: string | null;
  ref_id: string | null;
  created_by: string | null;
  created_at: string;
}

/** Saldo de fiado por jogador (visão fiado_saldos). */
export interface FiadoBalance {
  club_id: string;
  player_id: string;
  name: string;
  phone: string | null;
  devido: number;
  pago: number;
  saldo: number;
  ultima_movimentacao: string | null;
}

/** Pagamento (quitação) de fiado. */
export interface DebtSettlement {
  id: string;
  club_id: string;
  player_id: string;
  amount: number;
  method: 'dinheiro' | 'pix' | 'cartao' | 'abatido_cashout';
  note: string | null;
  table_id: string | null;
  /** Cash-out em que o fiado foi abatido (some junto se o cash-out for removido) */
  transaction_id?: string | null;
  created_at: string;
}
