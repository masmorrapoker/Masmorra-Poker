import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Spade, Users, LayoutDashboard, Menu, X } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { path: '/', label: 'Mesas', icon: <LayoutDashboard size={20} /> },
    { path: '/players', label: 'Jogadores', icon: <Users size={20} /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-dark">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-glass-border">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3 text-xl font-bold text-white no-underline">
            <Spade className="text-primary" size={28} /> 
            <span>Masmorra</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all no-underline ${
                location.pathname === item.path
                  ? 'bg-primary bg-opacity-20 text-primary border-l-4 border-primary'
                  : 'text-muted hover:bg-white hover:bg-opacity-5 hover:text-white border-l-4 border-transparent'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile Header & Nav */}
      <div className="md:hidden flex flex-col fixed inset-x-0 top-0 z-50 bg-card border-b border-glass-border">
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white no-underline">
            <Spade className="text-primary" size={24} /> 
            Masmorra
          </Link>
          <button 
            className="text-white p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        
        {isMobileMenuOpen && (
          <nav className="flex flex-col px-4 pb-4 space-y-2 bg-card">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all no-underline ${
                  location.pathname === item.path
                    ? 'bg-primary bg-opacity-20 text-primary border-l-4 border-primary'
                    : 'text-muted hover:bg-white hover:bg-opacity-5 hover:text-white border-l-4 border-transparent'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
