import { supabase } from '../lib/supabase';
import type { DebtSettlement, Player, Table, Transaction } from '../types';
import { nightRange, type NightData, type NightSummary, type NightTournamentMovement } from '../lib/nightMath';

export interface CashClosing {
  id: string;
  club_id: string;
  night: string;
  opening_cash: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  summary: Partial<NightSummary>;
  note: string | null;
  closed_by_name: string | null;
  created_at: string;
}

const toClosing = (c: CashClosing): CashClosing => ({
  ...c,
  opening_cash: Number(c.opening_cash),
  expected_cash: Number(c.expected_cash),
  counted_cash: Number(c.counted_cash),
  difference: Number(c.difference)
});

export const cashService = {
  /** Mesas, jogadores, lançamentos e pagamentos de fiado da noite. */
  async getNightData(clubId: string, night: string): Promise<NightData> {
    const { from, to } = nightRange(night);
    const { data: tables, error } = await supabase
      .from('tables')
      .select('*')
      .eq('club_id', clubId)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const ids = (tables || []).map(t => t.id);

    const [playersRes, txRes, tableStRes, payRes, tourRes] = await Promise.all([
      ids.length
        ? supabase.from('table_players').select('*').eq('club_id', clubId).in('table_id', ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase.from('transactions').select('*').eq('club_id', clubId).in('table_id', ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase.from('debt_settlements').select('*').eq('club_id', clubId).in('table_id', ids)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('debt_settlements')
        .select('*')
        .eq('club_id', clubId)
        .in('method', ['dinheiro', 'pix', 'cartao'])
        .gte('created_at', from)
        .lt('created_at', to),
      supabase
        .from('tournament_movements')
        .select('tournament_id, kind, amount, to_prize, payment_method, entry:tournament_entries(name)')
        .eq('club_id', clubId)
        .gte('created_at', from)
        .lt('created_at', to)
    ]);
    if (playersRes.error) throw playersRes.error;
    if (txRes.error) throw txRes.error;

    return {
      tables: (tables || []) as Table[],
      players: (playersRes.data || []) as Player[],
      transactions: (txRes.data || []) as Transaction[],
      tableSettlements: (tableStRes.error ? [] : tableStRes.data || []) as DebtSettlement[],
      fiadoPayments: (payRes.error ? [] : payRes.data || []) as DebtSettlement[],
      tournamentMovements: tourRes.error
        ? []
        : (tourRes.data || []).map((m: Record<string, unknown>) => {
            const entry = m.entry as { name?: string } | { name?: string }[] | null;
            const name = Array.isArray(entry) ? entry[0]?.name : entry?.name;
            return {
              tournament_id: m.tournament_id as string,
              kind: m.kind as NightTournamentMovement['kind'],
              amount: Number(m.amount),
              to_prize: Number(m.to_prize),
              payment_method: (m.payment_method as string | null) ?? null,
              name: name ?? ''
            };
          })
    };
  },

  /** Fechamento da noite; undefined se o recurso ainda não existe no banco. */
  async getClosing(clubId: string, night: string): Promise<CashClosing | null | undefined> {
    const { data, error } = await supabase
      .from('cash_closings')
      .select('*')
      .eq('club_id', clubId)
      .eq('night', night)
      .maybeSingle();
    if (error) return undefined;
    return data ? toClosing(data as CashClosing) : null;
  },

  async listClosings(clubId: string, limit = 12): Promise<CashClosing[]> {
    const { data, error } = await supabase
      .from('cash_closings')
      .select('*')
      .eq('club_id', clubId)
      .order('night', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data || []).map(c => toClosing(c as CashClosing));
  },

  async createClosing(
    clubId: string,
    closing: Pick<CashClosing, 'night' | 'opening_cash' | 'expected_cash' | 'counted_cash' | 'summary' | 'note' | 'closed_by_name'>
  ): Promise<void> {
    const { error } = await supabase.from('cash_closings').insert([{ ...closing, club_id: clubId }]);
    if (error) {
      if ((error as { code?: string }).code === '23505') throw new Error('O caixa desta noite já foi fechado.');
      throw error;
    }
  },

  /** Desfaz um fechamento (o banco só permite nas primeiras 24h). */
  async removeClosing(clubId: string, id: string): Promise<void> {
    const { error, count } = await supabase
      .from('cash_closings')
      .delete({ count: 'exact' })
      .eq('club_id', clubId)
      .eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error('Esse fechamento não pode mais ser desfeito (mais de 24 horas).');
  }
};
