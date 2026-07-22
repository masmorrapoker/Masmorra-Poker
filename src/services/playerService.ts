import { supabase } from '../lib/supabase';
import type { GlobalPlayer } from '../types';

export const playerService = {
  async getPlayers(clubId: string): Promise<GlobalPlayer[]> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('club_id', clubId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching players:', error);
      throw error;
    }
    return data || [];
  },

  async createPlayer(
    clubId: string, 
    name: string, 
    phone: string | null = null, 
    birth_date: string | null = null, 
    notes: string | null = null
  ): Promise<GlobalPlayer> {
    const { data, error } = await supabase
      .from('players')
      .insert([{ 
        name, 
        club_id: clubId, 
        phone: phone || null, 
        birth_date: birth_date || null, 
        notes: notes || null 
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating player:', error);
      throw error;
    }
    return data;
  },

  async updatePlayer(
    clubId: string, 
    playerId: string, 
    updates: { 
      name?: string; 
      phone?: string | null; 
      birth_date?: string | null; 
      notes?: string | null; 
    }
  ): Promise<GlobalPlayer> {
    const { data, error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', playerId)
      .eq('club_id', clubId)
      .select()
      .single();

    if (error) {
      console.error('Error updating player:', error);
      throw error;
    }
    return data;
  },

  async getPlayerProfile(clubId: string, playerId: string) {
    // 1. Get global player
    const { data: player, error: pError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('club_id', clubId)
      .single();
      
    if (pError) throw pError;

    // 2. Find table_players entries for this name under the current club
    const { data: tablePlayers, error: tpError } = await supabase
      .from('table_players')
      .select('*')
      .eq('name', player.name)
      .eq('club_id', clubId);

    if (tpError) throw tpError;

    let tablesHistory: any[] = [];
    let transactions: any[] = [];

    if (tablePlayers && tablePlayers.length > 0) {
      const tablePlayerIds = tablePlayers.map(tp => tp.id);
      const tableIds = tablePlayers.map(tp => tp.table_id);

      // 3. Fetch the tables they played at (scoped by club_id)
      const { data: tablesData } = await supabase
        .from('tables')
        .select('*')
        .eq('club_id', clubId)
        .in('id', tableIds)
        .order('created_at', { ascending: false });

      if (tablesData) {
        tablesHistory = tablesData.map(t => {
          const tp = tablePlayers.find(tp => tp.table_id === t.id);
          return { ...t, player_table_id: tp?.id || '' };
        });
      }

      // 4. Fetch all their transactions (scoped by club_id)
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('club_id', clubId)
        .in('player_id', tablePlayerIds);

      if (txData) {
        transactions = txData;
      }
    }

    return { player, tablesHistory, transactions };
  }
};
