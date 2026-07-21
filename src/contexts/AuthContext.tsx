import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  async function handleSession(currentSession: Session | null) {
    if (currentSession) {
      setSession(currentSession);
      setUser(currentSession.user);
    } else {
      setSession(null);
      setUser(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    // 1. Initial check of active session
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      handleSession(activeSession);
    }).catch(err => {
      console.error('Error fetching initial session:', err);
      setLoading(false);
    });

    // 2. Listen to authentication changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, changedSession) => {
      handleSession(changedSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    setLoading(true);
    try {
      await authService.signOut();
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      setUser(null);
      setSession(null);
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
