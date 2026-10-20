import { supabase } from '../lib/supabase';

export type Role = 'dono' | 'gerente' | 'caixa';

export const ROLE_LABEL: Record<Role, string> = {
  dono: 'Dono',
  gerente: 'Gerente',
  caixa: 'Caixa'
};

export const ROLE_HINT: Record<Role, string> = {
  dono: 'Tudo, inclusive equipe e permissões.',
  gerente: 'Tudo, menos mudar papéis. Pode convidar e remover caixas.',
  caixa: 'Opera mesas, fiado e caixa. Não vê faturamento nem Analytics.'
};

export interface Access {
  club_id: string | null;
  club_name: string | null;
  role: Role | null;
  full_name: string | null;
  paid_until: string | null;
  blocked: boolean;
  is_admin: boolean;
}

export interface Member {
  user_id: string;
  full_name: string | null;
  email: string;
  role: Role;
  created_at: string;
  is_me: boolean;
}

export interface Invite {
  id: string;
  role: Role;
  label: string | null;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

export interface InviteInfo {
  club_name?: string;
  role?: Role;
  valid: boolean;
  reason?: 'usado' | 'expirado' | 'inexistente' | null;
}

const PENDING_KEY = 'masmorra_convite_pendente';

export const inviteLink = (token: string) => `${window.location.origin}/convite/${token}`;

export const pendingInvite = {
  get: (): string | null => {
    try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
  },
  set: (token: string) => {
    try { localStorage.setItem(PENDING_KEY, token); } catch { /* sem armazenamento */ }
  },
  clear: () => {
    try { localStorage.removeItem(PENDING_KEY); } catch { /* sem armazenamento */ }
  }
};

/** Traduz erros das funções do banco para uma frase para o usuário. */
export function friendlyError(error: unknown, fallback: string): string {
  const msg = (error as { message?: string })?.message;
  if (msg && !/^(new row|permission denied|JWT|Failed to fetch)/i.test(msg)) return msg;
  if (msg && /Failed to fetch/i.test(msg)) return 'Sem conexão. Verifique a internet e tente de novo.';
  return fallback;
}

export const teamService = {
  /** Papel, clube e situação da assinatura. null se o recurso ainda não existe no banco. */
  async getAccess(): Promise<Access | null> {
    const { data, error } = await supabase.rpc('meu_acesso');
    if (error) return null;
    return data as Access;
  },

  async getInvite(token: string): Promise<InviteInfo> {
    const { data, error } = await supabase.rpc('ver_convite', { p_token: token });
    if (error) throw error;
    return data as InviteInfo;
  },

  async acceptInvite(token: string, name?: string): Promise<string> {
    const { data, error } = await supabase.rpc('aceitar_convite', { p_token: token, p_nome: name ?? null });
    if (error) throw error;
    return data as string;
  },

  async listMembers(): Promise<Member[]> {
    const { data, error } = await supabase.rpc('equipe_listar');
    if (error) throw error;
    return (data || []) as Member[];
  },

  async changeRole(userId: string, role: Role): Promise<void> {
    const { error } = await supabase.rpc('equipe_alterar_papel', { p_user: userId, p_role: role });
    if (error) throw error;
  },

  async removeMember(userId: string): Promise<void> {
    const { error } = await supabase.rpc('equipe_remover', { p_user: userId });
    if (error) throw error;
  },

  async listInvites(clubId: string): Promise<Invite[]> {
    const { data, error } = await supabase
      .from('club_invites')
      .select('id, role, label, token, created_at, expires_at, used_at')
      .eq('club_id', clubId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Invite[];
  },

  async createInvite(clubId: string, role: Role, label: string | null): Promise<Invite> {
    const { data, error } = await supabase
      .from('club_invites')
      .insert([{ club_id: clubId, role, label }])
      .select('id, role, label, token, created_at, expires_at, used_at')
      .single();
    if (error) throw error;
    return data as Invite;
  },

  async cancelInvite(id: string): Promise<void> {
    const { error } = await supabase.from('club_invites').delete().eq('id', id);
    if (error) throw error;
  }
};

export interface AdminClub {
  id: string;
  name: string;
  created_at: string;
  paid_until: string | null;
  blocked: boolean;
  members: number;
  owners: string | null;
  tables: number;
  last_table: string | null;
  pending_invites: number;
}

export const adminService = {
  async listClubs(): Promise<AdminClub[]> {
    const { data, error } = await supabase.rpc('admin_listar_clubes');
    if (error) throw error;
    return (data || []).map((c: AdminClub) => ({ ...c, members: Number(c.members), tables: Number(c.tables), pending_invites: Number(c.pending_invites) }));
  },

  async createClub(name: string, paidUntil: string | null): Promise<{ club_id: string; token: string }> {
    const { data, error } = await supabase.rpc('admin_criar_clube', { p_nome: name, p_paid_until: paidUntil });
    if (error) {
      if ((error as { code?: string }).code === '23505') throw new Error('Já existe um clube com esse nome.');
      throw error;
    }
    return data as { club_id: string; token: string };
  },

  async newInvite(clubId: string, role: Role = 'dono'): Promise<string> {
    const { data, error } = await supabase.rpc('admin_novo_convite', { p_club: clubId, p_role: role });
    if (error) throw error;
    return data as string;
  },

  async setPaidUntil(clubId: string, paidUntil: string | null): Promise<void> {
    const { error } = await supabase.rpc('admin_definir_vencimento', { p_club: clubId, p_paid_until: paidUntil });
    if (error) throw error;
  }
};

/** Dias até o vencimento (negativo = vencido). null = sem vencimento. */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
