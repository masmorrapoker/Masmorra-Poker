import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { authService } from '../services/authService';
import { clubService } from '../services/clubService';
import { pendingInvite, teamService, type Role } from '../services/teamService';
import type { Club } from '../services/clubService';

interface ClubContextType {
  club: Club | null;
  clubId: string | null;
  clubName: string | null;
  clubLogo: string | null;
  beerPrice: number;
  energyPrice: number;
  loading: boolean;
  error: string | null;
  /** Clube com assinatura vencida (bloqueado) */
  blocked: boolean;
  role: Role;
  /** Dono e gerente veem faturamento; caixa não */
  canSeeFinance: boolean;
  isAdmin: boolean;
  paidUntil: string | null;
  refreshClub: () => Promise<void>;
}

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [role, setRole] = useState<Role>('dono');
  const [isAdmin, setIsAdmin] = useState(false);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  // Para qual usuário os dados atuais foram carregados. Evita mostrar as telas
  // com o papel do usuário anterior (ou nenhum) no instante logo após o login.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  async function loadClubData() {
    if (!user) {
      setClub(null);
      setError(null);
      setLoading(false);
      setLoadedFor(null);
      return;
    }

    setLoading(true);
    setError(null);
    setBlocked(false);
    try {
      // Papel, clube e assinatura (funções do banco). null = recurso ainda não ativado.
      let access = await teamService.getAccess();

      // Convite aceito antes de confirmar o e-mail: aplica agora.
      if (access && !access.club_id) {
        const token = pendingInvite.get();
        if (token) {
          try {
            await teamService.acceptInvite(token, (user.user_metadata?.full_name as string | undefined) ?? undefined);
            pendingInvite.clear();
            access = await teamService.getAccess();
          } catch (e) {
            console.error('Error applying pending invite:', e);
            pendingInvite.clear();
          }
        }
      }

      if (access) {
        setIsAdmin(Boolean(access.is_admin));
        setRole(access.role ?? 'caixa');
        setPaidUntil(access.paid_until);
        if (!access.club_id) {
          setClub(null);
          setError('Sua conta ainda não faz parte de nenhum clube. Abra o link de convite que o dono do clube te mandou.');
          return;
        }
        if (access.blocked) {
          setClub(null);
          setBlocked(true);
          setError(`O acesso do ${access.club_name ?? 'clube'} está suspenso porque a assinatura venceu.`);
          return;
        }
      } else {
        // Banco ainda sem as funções de equipe: comportamento anterior.
        const profile = await authService.getProfile(user.id);
        if (!profile || !profile.club_id) {
          setClub(null);
          setError('Usuário não está associado a nenhum clube. Entre em contato com o administrador do sistema.');
          return;
        }
      }

      const profileClubId = access?.club_id ?? (await authService.getProfile(user.id))?.club_id;
      const clubData = profileClubId ? await clubService.getClub(profileClubId) : null;

      if (!clubData) {
        setClub(null);
        setError('Clube não encontrado no sistema. Entre em contato com o administrador.');
        return;
      }

      setClub(clubData);
    } catch (err: any) {
      console.error('Error loading club/profile:', err);
      setError('Erro ao carregar dados do clube. Verifique sua conexão ou tente novamente.');
      setClub(null);
    } finally {
      setLoading(false);
      setLoadedFor(user.id);
    }
  }

  // Load when user logs in or out
  useEffect(() => {
    loadClubData();
  }, [user]);

  async function refreshClub() {
    await loadClubData();
  }

  const value: ClubContextType = {
    club,
    clubId: club?.id || null,
    clubName: club?.name || null,
    clubLogo: club?.logo_url || null,
    beerPrice: club?.beer_price ?? 5.0,
    energyPrice: club?.energy_price ?? 8.0,
    loading: loading || (!!user && loadedFor !== user.id),
    error,
    blocked,
    role,
    canSeeFinance: role !== 'caixa',
    isAdmin,
    paidUntil,
    refreshClub
  };

  return (
    <ClubContext.Provider value={value}>
      {children}
    </ClubContext.Provider>
  );
}

export function useClub() {
  const context = useContext(ClubContext);
  if (context === undefined) {
    throw new Error('useClub must be used within a ClubProvider');
  }
  return context;
}
