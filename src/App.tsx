import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TableDetail from './pages/TableDetail';
import Players from './pages/Players';
import PlayerProfile from './pages/PlayerProfile';
import Relationship from './pages/Relationship';
import Settings from './pages/Settings';
import OperatorProfile from './pages/OperatorProfile';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClubProvider, useClub } from './contexts/ClubContext';
import { AlertCircle, LogOut } from 'lucide-react';

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
  const { user, loading: authLoading, logout } = useAuth();
  const { loading: clubLoading, error: clubError } = useClub();

  // Premium Elegant Splash Screen
  if (authLoading || (user && clubLoading)) {
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
        {/* Public Routes */}
        <Route 
          path="/" 
          element={<Home />} 
        />
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
        />

        {/* Private Routes (Wrapped in Layout with Auth and Club validations) */}
        <Route 
          path="/dashboard" 
          element={
            !user ? <Navigate to="/login" replace /> : 
            clubError ? <ClubErrorView error={clubError} logout={logout} /> :
            <Layout><Dashboard /></Layout>
          } 
        />
        
        <Route 
          path="/table/:id" 
          element={
            !user ? <Navigate to="/login" replace /> : 
            clubError ? <ClubErrorView error={clubError} logout={logout} /> :
            <Layout><TableDetail /></Layout>
          } 
        />
        
        <Route 
          path="/players" 
          element={
            !user ? <Navigate to="/login" replace /> : 
            clubError ? <ClubErrorView error={clubError} logout={logout} /> :
            <Layout><Players /></Layout>
          } 
        />
        
        <Route 
          path="/player/:id" 
          element={
            !user ? <Navigate to="/login" replace /> : 
            clubError ? <ClubErrorView error={clubError} logout={logout} /> :
            <Layout><PlayerProfile /></Layout>
          } 
        />
        <Route 
          path="/relationship" 
          element={
            !user ? <Navigate to="/login" replace /> : 
            clubError ? <ClubErrorView error={clubError} logout={logout} /> :
            <Layout><Relationship /></Layout>
          } 
        />
        
        <Route 
          path="/settings" 
          element={
            !user ? <Navigate to="/login" replace /> : 
            clubError ? <ClubErrorView error={clubError} logout={logout} /> :
            <Layout><Settings /></Layout>
          } 
        />
        
        <Route 
          path="/profile" 
          element={
            !user ? <Navigate to="/login" replace /> : 
            clubError ? <ClubErrorView error={clubError} logout={logout} /> :
            <Layout><OperatorProfile /></Layout>
          } 
        />

        {/* Fallback Redirection */}
        <Route 
          path="*" 
          element={<Navigate to={user ? "/dashboard" : "/"} replace />} 
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <ClubProvider>
        <MainApp />
      </ClubProvider>
    </AuthProvider>
  );
}

export default App;
