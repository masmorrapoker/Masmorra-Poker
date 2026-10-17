import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import type { Table, Player, TableEvent } from '../types';

export const tableService = {
  async getTables(clubId: string): Promise<Table[]> {
    try {
      return await fetchAll<Table>((from, to) => supabase
        .from('tables')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to));
    } catch (error) {
      console.error('Error fetching tables:', error);
      throw error;
    }
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

  /**
   * Linha do tempo da mesa (mais recente primeiro). Devolve null se o
   * histórico ainda não existir no banco, para a tela usar o modo antigo.
   */
  async getTableEvents(clubId: string, tableId: string): Promise<TableEvent[] | null> {
    const { data, error } = await supabase
      .from('table_events')
      .select('*')
      .eq('club_id', clubId)
      .eq('table_id', tableId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('Histórico da mesa indisponível:', error.message);
      return null;
    }
    return (data || []) as TableEvent[];
  },

  /** Remove um jogador adicionado por engano (o banco só permite sem lançamentos). */
  async removePlayerFromTable(clubId: string, tablePlayerId: string): Promise<void> {
    const { error } = await supabase
      .from('table_players')
      .delete()
      .eq('id', tablePlayerId)
      .eq('club_id', clubId);
    if (error) throw error;
  },

  /**
   * Adiciona um jogador à mesa, sempre vinculado ao cadastro (players.id).
   * - `playerId` informado: usa esse cadastro.
   * - Só o nome: reaproveita o cadastro com o mesmo nome (sem diferenciar
   *   maiúsculas/espaços) ou cria um novo.
   * Lança erro `ALREADY_AT_TABLE` se o jogador já estiver nesta mesa.
   */
  async addPlayerToTable(clubId: string, tableId: string, name: string, playerId?: string): Promise<Player> {
    const cleanName = name.trim();
    let globalPlayerId = playerId;

    if (!globalPlayerId) {
      const { data: globalPlayers, error: gpError } = await supabase
        .from('players')
        .select('id, name')
        .eq('club_id', clubId);
      if (gpError) throw gpError;

      const existing = globalPlayers?.find(
        p => p.name.trim().toLowerCase() === cleanName.toLowerCase()
      );

      if (existing) {
        globalPlayerId = existing.id;
      } else {
        const { data, error } = await supabase
          .from('players')
          .insert([{ name: cleanName, club_id: clubId }])
          .select('id')
          .single();

        if (error) {
          // Outro aparelho criou o mesmo cadastro ao mesmo tempo: reaproveita.
          if (error.code === '23505') {
            const { data: again, error: againError } = await supabase
              .from('players')
              .select('id, name')
              .eq('club_id', clubId);
            if (againError) throw againError;
            globalPlayerId = again?.find(
              p => p.name.trim().toLowerCase() === cleanName.toLowerCase()
            )?.id;
            if (!globalPlayerId) throw error;
          } else {
            throw error;
          }
        } else {
          globalPlayerId = data.id;
        }
      }
    }

    // Evita o mesmo cadastro duas vezes na mesma mesa.
    const { data: alreadyAtTable, error: atError } = await supabase
      .from('table_players')
      .select('id')
      .eq('club_id', clubId)
      .eq('table_id', tableId)
      .eq('player_id', globalPlayerId)
      .limit(1);
    if (atError) throw atError;
    if (alreadyAtTable && alreadyAtTable.length > 0) {
      throw new Error('ALREADY_AT_TABLE');
    }

    // O nome exibido é preenchido pelo banco a partir do cadastro.
    const { data: newTablePlayer, error: tpError } = await supabase
      .from('table_players')
      .insert([{
        table_id: tableId,
        player_id: globalPlayerId,
        name: cleanName,
        club_id: clubId
      }])
      .select()
      .single();

    if (tpError) throw tpError;
    return newTablePlayer;
  }
};
