import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Spade, Users, LayoutDashboard, ArrowLeft, LogOut, User, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { clubName, clubLogo } = useClub();

  const navItems = [
    { path: '/', label: 'Mesas', icon: <LayoutDashboard size={22} /> },
    { path: '/players', label: 'Jogadores', icon: <Users size={22} /> },
    { path: '/profile', label: 'Perfil', icon: <User size={22} /> },
    { path: '/settings', label: 'Ajustes', icon: <Settings size={22} /> },
  ];

  const isSubPage = location.pathname.startsWith('/table/') || location.pathname.startsWith('/player/');

  const isTabActive = (itemPath: string) => {
    if (itemPath === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/table/');
    }
    if (itemPath === '/players') {
      return location.pathname.startsWith('/players') || (location.pathname.startsWith('/player/') && !location.pathname.startsWith('/profile'));
    }
    return location.pathname === itemPath;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-dark">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-glass-border">
        <div className="p-6 border-b border-glass-border flex flex-col gap-4 text-left">
          <Link to="/" className="flex items-center gap-3 text-xl font-bold text-white no-underline">
            {clubLogo ? (
              <img 
                src={clubLogo} 
                alt="Logo" 
                className="w-8 h-8 rounded-full object-cover border border-glass-border" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/50?text=Logo';
                }}
              />
            ) : (
              <Spade className="text-primary" size={28} />
            )}
            <span className="truncate">♠ {clubName || 'Masmorra Poker'}</span>
          </Link>
          <div className="text-[11px] text-muted truncate max-w-full font-medium" title={user?.email || ''}>
            {user?.email}
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => {
            const active = isTabActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all no-underline ${
                  active
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
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium text-danger hover:bg-danger hover:bg-opacity-10 border border-transparent transition-all cursor-pointer active:scale-95 text-left"
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
              onClick={() => navigate(-1)} 
              className="text-white flex items-center gap-1.5 px-3 py-1.5 bg-white bg-opacity-5 hover:bg-opacity-10 border border-glass-border rounded-xl active:scale-95 transition-transform cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-semibold">Voltar</span>
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-white no-underline">
              {clubLogo ? (
                <img 
                  src={clubLogo} 
                  alt="Logo" 
                  className="w-6 h-6 rounded-full object-cover border border-glass-border" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/50?text=Logo';
                  }}
                />
              ) : (
                <Spade className="text-primary" size={22} />
              )}
              <span className="truncate max-w-[140px]">♠ {clubName || 'Masmorra'}</span>
            </Link>
          )}
          
          <div className="flex items-center gap-2">
            <button 
              onClick={logout}
              className="text-danger p-2 bg-danger bg-opacity-5 rounded-xl border border-danger border-opacity-10 active:scale-95 transition-transform cursor-pointer flex items-center justify-center"
              title="Sair"
              style={{ width: '36px', height: '36px' }}
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
          {navItems.map((item) => {
            const active = isTabActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all no-underline ${
                  active
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
        </nav>
      </div>
    </div>
  );
}
