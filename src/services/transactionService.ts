import { supabase } from '../lib/supabase';
import type { Transaction } from '../types';

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
  }
};
