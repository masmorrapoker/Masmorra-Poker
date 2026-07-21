import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { authService } from '../services/authService';
import { clubService } from '../services/clubService';
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
  refreshClub: () => Promise<void>;
}

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadClubData() {
    if (!user) {
      setClub(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Fetch profile
      const profile = await authService.getProfile(user.id);
      
      if (!profile || !profile.club_id) {
        setClub(null);
        setError('Usuário não está associado a nenhum clube. Entre em contato com o administrador do sistema.');
        setLoading(false);
        return;
      }

      // 2. Fetch club configs
      const clubData = await clubService.getClub(profile.club_id);
      
      if (!clubData) {
        setClub(null);
        setError('Clube não encontrado no sistema. Entre em contato com o administrador.');
        setLoading(false);
        return;
      }

      setClub(clubData);
    } catch (err: any) {
      console.error('Error loading club/profile:', err);
      setError('Erro ao carregar dados do clube. Verifique sua conexão ou tente novamente.');
      setClub(null);
    } finally {
      setLoading(false);
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
    loading,
    error,
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
