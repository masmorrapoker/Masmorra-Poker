import type React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TableDetail from './pages/TableDetail';
import Players from './pages/Players';
import PlayerProfile from './pages/PlayerProfile';
import Relationship from './pages/Relationship';
import Fiado from './pages/Fiado';
import Caixa from './pages/Caixa';
import Ranking from './pages/Ranking';
import Retrospectiva from './pages/Retrospectiva';
import Inicio from './pages/Inicio';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import OperatorProfile from './pages/OperatorProfile';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClubProvider, useClub } from './contexts/ClubContext';
import { AlertCircle, LogOut, MessageCircle } from 'lucide-react';
import Convite from './pages/Convite';
import Admin from './pages/Admin';
import Legal from './pages/Legal';
import NovaSenha from './pages/NovaSenha';
import Tournaments from './pages/Tournaments';
import Tournament from './pages/Tournament';
import TournamentTV from './pages/TournamentTV';

function ClubErrorView({ error, logout }: { error: string; logout: () => Promise<void> }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: '#090d16' }}>
      <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)' }} />
      
      <div className="glass-panel text-center max-w-md w-full p-8 rounded-2xl relative z-10 text-left" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(24px)' }}>
        <div className="w-16 h-16 mx-auto rounded-full text-danger flex items-center justify-center mb-6" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-3 text-center" style={{ margin: 0 }}>Acesso Não Autorizado</h2>
        <p className="text-sm text-muted leading-relaxed mb-8 text-center" style={{ marginTop: '0.5rem' }}>
          {error}
        </p>
        <button 
          onClick={logout}
          className="btn btn-danger w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all text-white"
        >
          <LogOut size={18} />
          <span>Sair da Conta</span>
        </button>
      </div>
    </div>
  );
}

function MainApp() {
  const { user, loading: authLoading } = useAuth();
  const { loading: clubLoading } = useClub();

  // Premium Elegant Splash Screen
  const onInvitePage = typeof window !== 'undefined' && (window.location.pathname.startsWith('/convite/') || window.location.pathname === '/nova-senha' || window.location.pathname.startsWith('/tv/') || window.location.pathname === '/demo');
  if (authLoading || (user && clubLoading && !onInvitePage)) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#090d16' }}>
        {/* Background decorative glows */}
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)' }} />
        <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: 'rgba(99, 102, 241, 0.04)' }} />
        
        <div className="flex flex-col items-center gap-6 relative z-10 animate-fade-in">
          {/* Glowing rotating brand logo */}
          <div className="flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-white shadow-xl shadow-primary/20" style={{ padding: '16px' }}>
            <img src="/logo.png?v=2" alt="Logo" className="w-16 h-16 object-contain lp-loading-logo" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2" style={{ margin: 0 }}>Masmorra Manager</h2>
            <p className="text-sm text-muted" style={{ margin: 0 }}>Carregando fortress...</p>
          </div>
          <div className="spinner mt-2" style={{ width: '28px', height: '28px', borderWidth: '3px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={user ? <Navigate to="/inicio" replace /> : <Login />} />
        <Route path="/convite/:token" element={<Convite />} />
        <Route path="/nova-senha" element={<NovaSenha />} />
        <Route path="/tv/:token" element={<TournamentTV />} />
        <Route path="/demo" element={<TournamentTV />} />
        <Route path="/termos" element={<Legal kind="termos" />} />
        <Route path="/privacidade" element={<Legal kind="privacidade" />} />

        {/* Privadas */}
        <Route path="/inicio" element={<Private><Inicio /></Private>} />
        <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
        <Route path="/table/:id" element={<Private><TableDetail /></Private>} />
        <Route path="/torneios" element={<Private><Tournaments /></Private>} />
        <Route path="/torneios/:id" element={<Private><Tournament /></Private>} />
        <Route path="/players" element={<Private><Players /></Private>} />
        <Route path="/player/:id" element={<Private><PlayerProfile /></Private>} />
        <Route path="/ranking" element={<Private><Ranking /></Private>} />
        <Route path="/caixa" element={<Private><Caixa /></Private>} />
        <Route path="/fiado" element={<Private><Fiado /></Private>} />
        <Route path="/relationship" element={<Private><Relationship /></Private>} />
        <Route path="/settings" element={<Private><Settings /></Private>} />
        <Route path="/profile" element={<Private><OperatorProfile /></Private>} />
        <Route path="/admin" element={<Private><Admin /></Private>} />

        {/* Só dono e gerente (faturamento) */}
        <Route path="/analytics" element={<Private finance><Analytics /></Private>} />
        <Route path="/retrospectiva" element={<Private finance><Retrospectiva /></Private>} />

        <Route path="*" element={<Navigate to={user ? '/inicio' : '/'} replace />} />
      </Routes>
    </Router>
  );
}

/** Rota privada: exige login e clube ativo; `finance` exige dono ou gerente. */
function Private({ children, finance = false }: { children: React.ReactNode; finance?: boolean }) {
  const { user, logout } = useAuth();
  const { error, blocked, canSeeFinance } = useClub();
  if (!user) return <Navigate to="/login" replace />;
  if (blocked && error) return <BlockedView message={error} logout={logout} />;
  if (error) return <ClubErrorView error={error} logout={logout} />;
  if (finance && !canSeeFinance) return <Navigate to="/inicio" replace />;
  return <Layout>{children}</Layout>;
}

const SUPPORT_WHATSAPP = '5551998811587';

function BlockedView({ message, logout }: { message: string; logout: () => Promise<void> }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center p-6" style={{ backgroundColor: '#090d16' }}>
      <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center">
        <div className="w-16 h-16 mx-auto rounded-full text-warning flex items-center justify-center mb-6" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-3">Acesso suspenso</h2>
        <p className="text-sm text-muted leading-relaxed mb-2">{message}</p>
        <p className="text-sm text-muted leading-relaxed mb-6">Seus dados estão guardados. Assim que o pagamento for confirmado, o acesso volta na hora.</p>
        <a
          className="btn btn-success w-full py-3 mb-2 no-underline"
          href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Olá! Quero regularizar a assinatura do Masmorra Manager do meu clube.')}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={18} /> Falar com o suporte
        </a>
        <button onClick={logout} className="btn btn-outline w-full py-3">
          <LogOut size={18} /> Sair
        </button>
      </div>
    </div>
  );
}

import { ToastContainer } from './components/Toast';

function App() {
  return (
    <AuthProvider>
      <ClubProvider>
        <MainApp />
        <ToastContainer />
      </ClubProvider>
    </AuthProvider>
  );
}

export default App;
