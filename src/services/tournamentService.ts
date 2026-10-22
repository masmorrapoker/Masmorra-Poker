import { supabase } from '../lib/supabase';
import type { EntryRow, MovementKind, MovementRow, TournamentConfig, TournamentRow } from '../lib/tournament';
import { normalizeConfig } from '../lib/tournament';
import type { PaymentMethod } from '../types';

const toTournament = (t: TournamentRow): TournamentRow => ({ ...t, config: normalizeConfig(t.config) });
const toMovement = (m: MovementRow): MovementRow => ({ ...m, amount: Number(m.amount), to_prize: Number(m.to_prize), chips: Number(m.chips) });

export interface TvPayload {
  now: string;
  club: { name: string; logo_url: string | null };
  tournament: Pick<TournamentRow, 'id' | 'name' | 'status' | 'config' | 'clock_level' | 'clock_running' | 'clock_ends_at' | 'clock_remaining' | 'started_at' | 'scheduled_at'>;
  entries: Pick<EntryRow, 'id' | 'name' | 'eliminated_at' | 'position'>[];
  movements: MovementRow[];
}

export const tournamentService = {
  /** null se o recurso ainda não existe no banco */
  async list(clubId: string): Promise<TournamentRow[] | null> {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) return null;
    return (data || []).map(t => toTournament(t as TournamentRow));
  },

  async get(clubId: string, id: string): Promise<TournamentRow | null> {
    const { data, error } = await supabase.from('tournaments').select('*').eq('club_id', clubId).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? toTournament(data as TournamentRow) : null;
  },

  async create(clubId: string, name: string, scheduledAt: string | null, config: TournamentConfig): Promise<TournamentRow> {
    const { data, error } = await supabase
      .from('tournaments')
      .insert([{ club_id: clubId, name: name.trim(), scheduled_at: scheduledAt, config }])
      .select('*')
      .single();
    if (error) throw error;
    return toTournament(data as TournamentRow);
  },

  async update(clubId: string, id: string, patch: Partial<Pick<TournamentRow, 'name' | 'scheduled_at' | 'config' | 'status' | 'finished_at'>>) {
    const { error } = await supabase.from('tournaments').update(patch).eq('club_id', clubId).eq('id', id);
    if (error) throw error;
  },

  async remove(clubId: string, id: string) {
    const { error } = await supabase.from('tournaments').delete().eq('club_id', clubId).eq('id', id);
    if (error) throw error;
  },

  async entries(clubId: string, tournamentId: string): Promise<EntryRow[]> {
    const { data, error } = await supabase
      .from('tournament_entries')
      .select('*')
      .eq('club_id', clubId)
      .eq('tournament_id', tournamentId)
      .order('created_at');
    if (error) throw error;
    return (data || []) as EntryRow[];
  },

  async movements(clubId: string, tournamentId: string): Promise<MovementRow[]> {
    const { data, error } = await supabase
      .from('tournament_movements')
      .select('*')
      .eq('club_id', clubId)
      .eq('tournament_id', tournamentId)
      .order('created_at');
    if (error) throw error;
    return (data || []).map(m => toMovement(m as MovementRow));
  },

  async addEntry(clubId: string, tournamentId: string, playerId: string, name: string): Promise<EntryRow> {
    const { data, error } = await supabase
      .from('tournament_entries')
      .insert([{ club_id: clubId, tournament_id: tournamentId, player_id: playerId, name }])
      .select('*')
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505') throw new Error(`${name} já está inscrito.`);
      throw error;
    }
    return data as EntryRow;
  },

  async removeEntry(clubId: string, entryId: string) {
    const { error } = await supabase.from('tournament_entries').delete().eq('club_id', clubId).eq('id', entryId);
    if (error) throw error;
  },

  async addMovement(
    clubId: string,
    tournamentId: string,
    entryId: string,
    m: { kind: MovementKind; label: string; amount: number; to_prize: number; chips: number; payment_method: PaymentMethod | null }
  ) {
    const { error } = await supabase.from('tournament_movements').insert([{ club_id: clubId, tournament_id: tournamentId, entry_id: entryId, ...m }]);
    if (error) throw error;
  },

  async removeMovement(clubId: string, id: string) {
    const { error } = await supabase.from('tournament_movements').delete().eq('club_id', clubId).eq('id', id);
    if (error) throw error;
  },

  async eliminate(clubId: string, entryId: string, position: number | null) {
    const { error } = await supabase
      .from('tournament_entries')
      .update({ eliminated_at: position ? new Date().toISOString() : null, position })
      .eq('club_id', clubId)
      .eq('id', entryId);
    if (error) throw error;
  },

  async setPosition(clubId: string, entryId: string, position: number | null) {
    const { error } = await supabase.from('tournament_entries').update({ position }).eq('club_id', clubId).eq('id', entryId);
    if (error) throw error;
  },

  /** Comanda o relógio; devolve a hora do servidor. */
  async clock(tournamentId: string, level: number, running: boolean, remaining: number): Promise<string> {
    const { data, error } = await supabase.rpc('torneio_relogio', {
      p_tournament: tournamentId,
      p_level: level,
      p_running: running,
      p_remaining: Math.max(0, Math.round(remaining))
    });
    if (error) throw error;
    return data as string;
  },

  async serverNow(): Promise<number> {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('agora');
    if (error || !data) return Date.now();
    const t1 = Date.now();
    return new Date(data as string).getTime() + (t1 - t0) / 2;
  },

  async tv(token: string): Promise<TvPayload | null> {
    const { data, error } = await supabase.rpc('torneio_tv', { p_token: token });
    if (error) throw error;
    if (!data) return null;
    const p = data as TvPayload;
    return {
      ...p,
      tournament: { ...p.tournament, config: normalizeConfig(p.tournament.config) },
      movements: (p.movements || []).map(toMovement)
    };
  }
};

export const tvLink = (token: string) => `${window.location.origin}/tv/${token}`;
