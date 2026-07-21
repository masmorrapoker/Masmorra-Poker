import { supabase } from '../lib/supabase';
import type { Table, Player } from '../types';

export const tableService = {
  async getTables(clubId: string): Promise<Table[]> {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tables:', error);
      throw error;
    }
    return data || [];
  },

  async getTable(clubId: string, tableId: string): Promise<Table | null> {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching table details:', error);
      throw error;
    }
    return data;
  },

  async createTable(clubId: string, name: string): Promise<Table> {
    const { data, error } = await supabase
      .from('tables')
      .insert([{ name, club_id: clubId }])
      .select()
      .single();

    if (error) {
      console.error('Error creating table:', error);
      throw error;
    }
    return data;
  },

  async closeTable(clubId: string, tableId: string): Promise<Table> {
    const { data, error } = await supabase
      .from('tables')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString()
      })
      .eq('id', tableId)
      .eq('club_id', clubId)
      .select()
      .single();

    if (error) {
      console.error('Error closing table:', error);
      throw error;
    }
    return data;
  },

  async getTablePlayers(clubId: string, tableId: string): Promise<Player[]> {
    const { data, error } = await supabase
      .from('table_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('club_id', clubId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching table players:', error);
      throw error;
    }
    return data || [];
  },

  async addPlayerToTable(clubId: string, tableId: string, name: string): Promise<Player> {
    // 1. Fetch global players to check existence
    const { data: globalPlayers, error: gpError } = await supabase
      .from('players')
      .select('*')
      .eq('club_id', clubId);

    if (gpError) throw gpError;

    let globalPlayer = globalPlayers?.find(p => p.name.toLowerCase() === name.toLowerCase());

    // Create global player if not exists
    if (!globalPlayer) {
      const { data, error } = await supabase
        .from('players')
        .insert([{ name, club_id: clubId }])
        .select()
        .single();
        
      if (error) throw error;
      globalPlayer = data;
    }

    // 2. Add player to the table
    const { data: newTablePlayer, error: tpError } = await supabase
      .from('table_players')
      .insert([{
        table_id: tableId,
        name: globalPlayer.name,
        club_id: clubId
      }])
      .select()
      .single();

    if (tpError) throw tpError;
    return newTablePlayer;
  }
};
