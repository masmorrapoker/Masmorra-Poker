import { supabase } from '../lib/supabase';
import type { DebtSettlement, FiadoBalance, Transaction } from '../types';
import type { SettlementMethod } from '../lib/paymentMethods';

const toNumber = (b: FiadoBalance): FiadoBalance => ({
  ...b,
  devido: Number(b.devido),
  pago: Number(b.pago),
  saldo: Number(b.saldo)
});

export interface FiadoEntry {
  kind: 'fiado' | 'pagamento';
  id: string;
  amount: number;
  label: string;
  table_id: string | null;
  created_at: string;
  removable: boolean;
}

export const fiadoService = {
  /** Jogadores com fiado (saldo em aberto primeiro). */
  async getBalances(clubId: string): Promise<FiadoBalance[]> {
    const { data, error } = await supabase
      .from('fiado_saldos')
      .select('*')
      .eq('club_id', clubId)
      .order('saldo', { ascending: false });
    if (error) throw error;
    return (data || []).map(toNumber);
  },

  /** Saldo de um jogador do cadastro (0 se não houver fiado). */
  async getPlayerBalance(clubId: string, playerId: string): Promise<number> {
    const { data, error } = await supabase
      .from('fiado_saldos')
      .select('saldo')
      .eq('club_id', clubId)
      .eq('player_id', playerId)
      .maybeSingle();
    if (error) return 0;
    return Number(data?.saldo ?? 0);
  },

  /** Extrato do jogador: fiados lançados e pagamentos, do mais recente ao mais antigo. */
  async getStatement(clubId: string, playerId: string): Promise<FiadoEntry[]> {
    const { data: tps, error: tpError } = await supabase
      .from('table_players')
      .select('id')
      .eq('club_id', clubId)
      .eq('player_id', playerId);
    if (tpError) throw tpError;
    const ids = (tps || []).map(t => t.id);

    const [txRes, setRes] = await Promise.all([
      ids.length
        ? supabase
            .from('transactions')
            .select('id, type, amount, description, table_id, created_at')
            .eq('club_id', clubId)
            .eq('payment_method', 'fiado')
            .in('player_id', ids)
        : Promise.resolve({ data: [] as Partial<Transaction>[], error: null }),
      supabase
        .from('debt_settlements')
        .select('*')
        .eq('club_id', clubId)
        .eq('player_id', playerId)
    ]);
    if (txRes.error) throw txRes.error;
    if (setRes.error) throw setRes.error;

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const entries: FiadoEntry[] = [
      ...((txRes.data || []) as Transaction[]).map(tx => ({
        kind: 'fiado' as const,
        id: tx.id,
        amount: Number(tx.amount),
        label: tx.type === 'buy_in' ? 'Buy-in no fiado' : `Consumo no fiado${tx.description ? ` · ${tx.description}` : ''}`,
        table_id: tx.table_id,
        created_at: tx.created_at,
        removable: false
      })),
      ...((setRes.data || []) as DebtSettlement[]).map(s => ({
        kind: 'pagamento' as const,
        id: s.id,
        amount: Number(s.amount),
        label: s.note ? `Pagamento · ${s.note}` : 'Pagamento',
        table_id: s.table_id,
        created_at: s.created_at,
        removable: new Date(s.created_at).getTime() > dayAgo
      }))
    ];
    return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async registerPayment(
    clubId: string,
    payment: { player_id: string; amount: number; method: SettlementMethod; note?: string | null; table_id?: string | null }
  ): Promise<void> {
    const { error } = await supabase.from('debt_settlements').insert([{
      club_id: clubId,
      player_id: payment.player_id,
      amount: payment.amount,
      method: payment.method,
      note: payment.note?.trim() || null,
      table_id: payment.table_id ?? null
    }]);
    if (error) throw error;
  },

  /** Desfaz um pagamento lançado por engano (o banco só permite nas primeiras 24h). */
  async removePayment(clubId: string, settlementId: string): Promise<void> {
    const { error, count } = await supabase
      .from('debt_settlements')
      .delete({ count: 'exact' })
      .eq('club_id', clubId)
      .eq('id', settlementId);
    if (error) throw error;
    if (count === 0) throw new Error('Esse pagamento não pode mais ser desfeito (mais de 24 horas).');
  }
};
