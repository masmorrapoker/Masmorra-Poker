import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import type { GlobalPlayer } from '../types';

export const playerService = {
  async getPlayers(clubId: string): Promise<GlobalPlayer[]> {
    try {
      return await fetchAll<GlobalPlayer>((from, to) => supabase
        .from('players')
        .select('*')
        .eq('club_id', clubId)
        .order('name', { ascending: true })
        .order('id')
        .range(from, to));
    } catch (error) {
      console.error('Error fetching players:', error);
      throw error;
    }
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
        name: name.trim(), 
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

    // 2. Registros de mesa deste jogador: pelo vínculo (player_id) e,
    //    para registros antigos ainda sem vínculo, pelo nome.
    const [byId, byLegacyName] = await Promise.all([
      supabase
        .from('table_players')
        .select('*')
        .eq('club_id', clubId)
        .eq('player_id', player.id),
      supabase
        .from('table_players')
        .select('*')
        .eq('club_id', clubId)
        .is('player_id', null)
        .eq('name', player.name)
    ]);

    if (byId.error) throw byId.error;
    if (byLegacyName.error) throw byLegacyName.error;
    const tablePlayers = [...(byId.data || []), ...(byLegacyName.data || [])];

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
  },

  async getAllTablePlayers(clubId: string): Promise<any[]> {
    try {
      return await fetchAll<any>((from, to) => supabase
        .from('table_players')
        .select('*')
        .eq('club_id', clubId)
        .order('id')
        .range(from, to));
    } catch (error) {
      console.error('Error fetching all table players:', error);
      throw error;
    }
  }
};
