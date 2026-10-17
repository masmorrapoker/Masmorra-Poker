import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import type { Transaction, RemovedTransaction } from '../types';

export const transactionService = {
  async getTransactions(clubId: string, tableId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('table_id', tableId)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
    return data || [];
  },

  async createTransaction(
    clubId: string, 
    transaction: Omit<Transaction, 'id' | 'created_at' | 'club_id'>
  ): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        ...transaction,
        club_id: clubId
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
    return data;
  },

  async deleteTransaction(clubId: string, transactionId: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('club_id', clubId);

    if (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  },

  /**
   * Lançamentos removidos desta mesa (auditoria). Se a auditoria ainda não
   * existir no banco, devolve lista vazia em vez de quebrar a tela.
   */
  async getRemovedTransactions(clubId: string, tableId: string): Promise<RemovedTransaction[]> {
    const { data, error } = await supabase
      .from('transactions_audit')
      .select('id, transaction_id, old_data, changed_at')
      .eq('club_id', clubId)
      .eq('table_id', tableId)
      .eq('action', 'DELETE')
      .order('changed_at', { ascending: false });

    if (error) {
      console.warn('Auditoria indisponível:', error.message);
      return [];
    }
    return (data || []) as RemovedTransaction[];
  },

  async getAllTransactions(clubId: string): Promise<Transaction[]> {
    try {
      return await fetchAll<Transaction>((from, to) => supabase
        .from('transactions')
        .select('*')
        .eq('club_id', clubId)
        .order('id')
        .range(from, to));
    } catch (error) {
      console.error('Error fetching all club transactions:', error);
      throw error;
    }
  }
};
