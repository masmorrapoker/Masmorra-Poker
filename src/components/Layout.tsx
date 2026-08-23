import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Users, LayoutDashboard, ArrowLeft, LogOut, User, Settings, MessageSquare, Home, BarChart3, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { triggerHaptic } from '../utils/haptic';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { clubName } = useClub();

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Desktop complete navigation items (7 items)
  const desktopNavItems = [
    { path: '/inicio', label: 'Início', icon: <Home size={22} /> },
    { path: '/dashboard', label: 'Mesas', icon: <LayoutDashboard size={22} /> },
    { path: '/players', label: 'Jogadores', icon: <Users size={22} /> },
    { path: '/relationship', label: 'Relacionamento', icon: <MessageSquare size={22} /> },
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={22} /> },
    { path: '/profile', label: 'Perfil', icon: <User size={22} /> },
    { path: '/settings', label: 'Ajustes', icon: <Settings size={22} /> },
  ];

  // Mobile navigation items (4 primary + Mais button trigger)
  const mobileNavItems = [
    { path: '/inicio', label: 'Início', icon: <Home size={20} /> },
    { path: '/dashboard', label: 'Mesas', icon: <LayoutDashboard size={20} /> },
    { path: '/players', label: 'Jogadores', icon: <Users size={20} /> },
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
  ];

  const isSubPage = location.pathname.startsWith('/table/') || location.pathname.startsWith('/player/');

  const isTabActive = (itemPath: string) => {
    if (itemPath === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname.startsWith('/table/');
    }
    if (itemPath === '/players') {
      return location.pathname.startsWith('/players') || (location.pathname.startsWith('/player/') && !location.pathname.startsWith('/profile'));
    }
    return location.pathname === itemPath;
  };

  const handleMobileNavClick = () => {
    triggerHaptic('light');
    setIsMoreMenuOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-dark">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-glass-border">
        <div className="p-6 border-b border-glass-border flex flex-col gap-4 text-left">
          <div className="flex items-center gap-3">
            <img src="/logo.png?v=2" alt="Logo" className="object-contain" style={{ width: '50px', height: '50px' }} />
            <span className="text-lg font-bold text-white tracking-tight uppercase" style={{ letterSpacing: '0.05em' }}>Masmorra Manager</span>
          </div>
          <div className="flex flex-col gap-1 mt-1 border-t border-glass-border pt-3">
            <span className="text-xs font-semibold text-white truncate">{clubName || 'Sem Clube'}</span>
            <span className="text-[10px] text-muted truncate font-medium" title={user?.email || ''}>{user?.email}</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {desktopNavItems.map((item) => {
            const active = isTabActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all no-underline ${active
                    ? 'bg-primary bg-opacity-20 text-primary border-l-4 border-primary'
                    : 'text-muted hover:bg-white hover:bg-opacity-5 hover:text-white border-l-4 border-transparent'
                  }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-glass-border">
          <button
            onClick={() => {
              triggerHaptic('medium');
              logout();
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl font-medium text-muted hover:text-danger hover:bg-danger hover:bg-opacity-10 border border-transparent transition-all cursor-pointer active:scale-95 text-left"
            style={{ background: 'transparent' }}
          >
            <LogOut size={20} />
            <span>Sair do Clube</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header (Top) */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-glass-border fixed inset-x-0 top-0 z-50 h-16 backdrop-blur-lg">
          {isSubPage ? (
            <button
              onClick={() => {
                triggerHaptic('light');
                navigate(-1);
              }}
              className="text-white flex items-center gap-1.5 px-3 py-1.5 bg-white bg-opacity-5 hover:bg-opacity-10 border border-glass-border rounded-xl active:scale-95 transition-transform cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-semibold">Voltar</span>
            </button>
          ) : (
            <Link to="/dashboard" onClick={() => triggerHaptic('light')} className="flex items-center gap-2.5 text-lg font-bold text-white no-underline">
              <img src="/logo.png?v=2" alt="Logo" className="object-contain" style={{ width: '28px', height: '28px' }} />
              <span className="truncate max-w-[140px]">{clubName || 'Masmorra'}</span>
            </Link>
          )}

          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                triggerHaptic('medium');
                logout();
              }}
              className="text-muted hover:text-danger p-2 hover:bg-danger hover:bg-opacity-10 rounded-xl border border-glass-border active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              title="Sair"
              style={{ width: '36px', height: '36px', background: 'transparent' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Dynamic Content Container */}
        <main className="flex-1 overflow-y-auto pt-16 pb-16 md:pt-0 md:pb-0">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation (Bottom) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-glass-border backdrop-blur-xl z-50 flex justify-around p-2.5 h-16 safe-bottom">
          {mobileNavItems.map((item) => {
            const active = isTabActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleMobileNavClick}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all no-underline ${active
                    ? 'text-primary'
                    : 'text-muted'
                  }`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-primary bg-opacity-10' : ''}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {item.icon}
                </div>
                <span className="text-[9px] font-bold mt-0.5 tracking-wide uppercase">{item.label}</span>
              </Link>
            );
          })}

          {/* Mobile Mais button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('light');
              setIsMoreMenuOpen(true);
            }}
            style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all no-underline cursor-pointer ${
              isMoreMenuOpen ? 'text-primary font-bold' : 'text-muted'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all active:scale-90 ${isMoreMenuOpen ? 'bg-primary bg-opacity-10' : ''}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Menu size={20} />
            </div>
            <span className="text-[9px] font-bold mt-0.5 tracking-wide uppercase">Mais</span>
          </button>
        </nav>
      </div>

      {/* Mobile Bottom Sheet Menu "Mais" */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-[999] md:hidden">
          {/* Backdrop overlay */}
          <div 
            onClick={() => setIsMoreMenuOpen(false)}
            className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in"
          />
          
          {/* Sheet content */}
          <div className="absolute bottom-0 inset-x-0 bg-[#0f172a] rounded-t-[32px] border-t border-glass-border p-6 pb-8 flex flex-col gap-5 animate-slide-up max-h-[85vh] overflow-y-auto">
            {/* Drag Handle indicator */}
            <div className="w-12 h-1.5 bg-glass-border rounded-full mx-auto" onClick={() => setIsMoreMenuOpen(false)} />

            {/* Header */}
            <div className="flex justify-between items-center border-b border-glass-border pb-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Mais Opções</span>
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  setIsMoreMenuOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-white bg-opacity-5 flex items-center justify-center text-muted hover:text-white font-bold"
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
              >
                ✕
              </button>
            </div>

            {/* Categorized Menu Items */}
            <div className="space-y-5 text-left">
              <div>
                <span className="text-[10px] text-muted font-bold block uppercase tracking-wider mb-2.5">Gestão do Clube</span>
                <div className="grid grid-cols-2 gap-3">
                  <Link 
                    to="/relationship" 
                    onClick={() => {
                      triggerHaptic('light');
                      setIsMoreMenuOpen(false);
                    }}
                    className="p-4 rounded-2xl bg-white bg-opacity-[0.02] border border-glass-border flex flex-col gap-2 hover:bg-white hover:bg-opacity-5 transition-all text-left no-underline"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary bg-opacity-10 text-primary flex items-center justify-center">
                      <MessageSquare size={18} />
                    </div>
                    <span className="text-xs font-bold text-white">Relacionamento</span>
                    <span className="text-[10px] text-muted leading-tight">CRM e Campanhas</span>
                  </Link>

                  <Link 
                    to="/settings" 
                    onClick={() => {
                      triggerHaptic('light');
                      setIsMoreMenuOpen(false);
                    }}
                    className="p-4 rounded-2xl bg-white bg-opacity-[0.02] border border-glass-border flex flex-col gap-2 hover:bg-white hover:bg-opacity-5 transition-all text-left no-underline"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary bg-opacity-10 text-primary flex items-center justify-center">
                      <Settings size={18} />
                    </div>
                    <span className="text-xs font-bold text-white">Configurações</span>
                    <span className="text-[10px] text-muted leading-tight">Ajustes operacionais</span>
                  </Link>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-muted font-bold block uppercase tracking-wider mb-2.5">Módulos Extras</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-white bg-opacity-[0.01] border border-glass-border flex flex-col gap-2 opacity-50 relative overflow-hidden text-left">
                    <span className="absolute top-2 right-2 text-[8px] bg-primary bg-opacity-20 text-primary font-bold px-1.5 py-0.5 rounded-md">Em breve</span>
                    <div className="w-9 h-9 rounded-xl bg-muted bg-opacity-10 text-muted flex items-center justify-center">
                      <User size={18} />
                    </div>
                    <span className="text-xs font-bold text-white">Usuários</span>
                    <span className="text-[10px] text-muted leading-tight">Níveis de acesso</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white bg-opacity-[0.01] border border-glass-border flex flex-col gap-2 opacity-50 relative overflow-hidden text-left">
                    <span className="absolute top-2 right-2 text-[8px] bg-primary bg-opacity-20 text-primary font-bold px-1.5 py-0.5 rounded-md">Em breve</span>
                    <div className="w-9 h-9 rounded-xl bg-muted bg-opacity-10 text-muted flex items-center justify-center">
                      <LayoutDashboard size={18} />
                    </div>
                    <span className="text-xs font-bold text-white">Estoque</span>
                    <span className="text-[10px] text-muted leading-tight">Consumos da copa</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Logout Action */}
            <div className="mt-4 pt-4 border-t border-glass-border">
              <button 
                onClick={() => {
                  triggerHaptic('medium');
                  setIsMoreMenuOpen(false);
                  logout();
                }}
                className="w-full py-3.5 rounded-xl bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <LogOut size={16} />
                <span>Sair do Clube</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
