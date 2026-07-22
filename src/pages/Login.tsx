import React, { useState } from 'react';
import { Mail, Lock, LogIn, AlertCircle, Check } from 'lucide-react';
import { authService } from '../services/authService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setErrorMsg(null);
    setLoading(true);

    try {
      // Sign In Flow through Service
      await authService.signIn(email, password);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao processar autenticação. Verifique seu e-mail e senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      {/* Background Decorative Glows */}
      <div className="glow-orb" style={{ top: '-10%', left: '-10%', width: '50%', height: '50%', backgroundColor: 'rgba(59, 130, 246, 0.08)' }} />
      <div className="glow-orb" style={{ bottom: '-10%', right: '-10%', width: '50%', height: '50%', backgroundColor: 'rgba(99, 102, 241, 0.04)' }} />
      <div className="glow-orb" style={{ top: '30%', right: '20%', width: '30%', height: '30%', backgroundColor: 'rgba(59, 130, 246, 0.04)', filter: 'blur(100px)' }} />

      <div className="login-grid">
        
        {/* Left Column: Branding, Benefits & Poker Graphics */}
        <div className="flex flex-col animate-fade-in text-left" style={{ gap: '2rem' }}>
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <img src="/logo.png?v=2" alt="Logo" className="object-contain" style={{ width: '48px', height: '48px' }} />
            <span className="text-xl font-bold text-white tracking-tight uppercase" style={{ letterSpacing: '0.05em' }}>Masmorra Manager</span>
          </div>

          {/* Title Area */}
          <div className="flex flex-col" style={{ gap: '0.75rem' }}>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight" style={{ margin: 0, background: 'linear-gradient(135deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Masmorra Manager
            </h1>
            <p className="text-base sm:text-lg text-muted font-medium leading-relaxed" style={{ margin: 0 }}>
              Gestão e controle financeiro integrado para clubes de poker.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="pt-2">
            <ul className="benefits-grid">
              {[
                'Controle de Mesas',
                'Buy-ins e Cash-outs',
                'Consumo integrado',
                'Histórico completo',
                'Fechamento de Caixa',
                'Relatórios por jogador'
              ].map((benefit, idx) => (
                <li key={idx} className="flex items-center gap-2 text-white text-opacity-80">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full text-success flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <Check size={11} style={{ strokeWidth: 3 }} />
                  </span>
                  <span className="text-sm font-semibold tracking-wide">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Premium Vector Illustration */}
          <div className="relative max-w-md w-full animate-float-slow" style={{ paddingTop: '1rem' }}>
            <svg width="100%" height="200" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="select-none">
              <defs>
                <linearGradient id="cardGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="#000000" floodOpacity="0.5" />
                </filter>
                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Ambient Glow */}
              <circle cx="200" cy="100" r="70" fill="url(#glowGrad)" opacity="0.08" filter="url(#cardShadow)" />

              {/* Left Card (King of Diamonds) */}
              <g transform="translate(130, 20) rotate(-10)">
                <rect x="0" y="0" width="85" height="130" rx="10" fill="url(#cardGrad1)" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.2" filter="url(#cardShadow)" />
                <rect x="5" y="5" width="75" height="120" rx="7" fill="none" stroke="rgba(59, 130, 246, 0.12)" strokeWidth="1" />
                <text x="12" y="20" fill="#ef4444" fontSize="12" fontWeight="bold" fontFamily="sans-serif">K</text>
                <path d="M14 27 L18 23 L22 27 L18 31 Z" fill="#ef4444" />
                <path d="M37 65 L43 55 L49 65 L43 75 Z" fill="#ef4444" filter="url(#neonGlow)" />
              </g>

              {/* Right Card (Ace of Spades) */}
              <g transform="translate(185, 30) rotate(8)">
                <rect x="0" y="0" width="85" height="130" rx="10" fill="url(#cardGrad1)" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.2" filter="url(#cardShadow)" />
                <rect x="5" y="5" width="75" height="120" rx="7" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                <text x="12" y="20" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="sans-serif">A</text>
                <path d="M18 24 C18.5 24 19 25 19 25.5 C19 26 18.5 27 18 27 C17.5 27 17 26 17 25.5 C17 25 17.5 24 18 24 Z M18 27 L18 29 L16.5 29 L19.5 29 L18 27 Z" fill="#ffffff" />
                <g transform="translate(28, 48) scale(1.3)">
                  <path d="M10 3 C10.7 3 12.5 5 12.5 5.8 C12.5 6.6 10.7 10 10 10 C9.3 10 7.5 6.6 7.5 5.8 C7.5 5 9.3 3 10 3 Z M10 10 L10 14 L7.5 14 L12.5 14 L10 10 Z" fill="#3b82f6" filter="url(#neonGlow)" />
                </g>
              </g>

              {/* Stack of Poker Chips */}
              <g transform="translate(70, 70)">
                {/* Chip 1 */}
                <ellipse cx="60" cy="80" rx="35" ry="11" fill="#0f172a" stroke="rgba(255,255,255,0.03)" strokeWidth="1" filter="url(#cardShadow)" />
                <path d="M25 80 C25 87 95 87 95 80 L95 86 C95 93 25 93 25 86 Z" fill="#1e293b" />
                <ellipse cx="60" cy="86" rx="35" ry="11" fill="#2563eb" opacity="0.2" />

                {/* Chip 2 */}
                <path d="M25 68 C25 75 95 75 95 68 L95 74 C95 81 25 81 25 74 Z" fill="#111827" />
                <ellipse cx="60" cy="68" rx="35" ry="11" fill="#1e293b" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <path d="M60 59 L60 77 M42 62 L42 74 M78 62 L78 74" stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeDasharray="2 2" />
                <ellipse cx="60" cy="68" rx="24" ry="8" fill="#111827" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                {/* Chip 3 (Top) */}
                <path d="M30 55 C30 62 100 62 100 55 L100 61 C100 68 30 68 30 61 Z" fill="#1d4ed8" />
                <ellipse cx="65" cy="55" rx="35" ry="11" fill="url(#cardGrad1)" stroke="#3b82f6" strokeWidth="1.8" filter="url(#neonGlow)" />
                <path d="M65 46 L65 64 M47 49 L83 61 M83 49 L47 61" stroke="#3b82f6" strokeWidth="3" strokeDasharray="2 4" />
                <ellipse cx="65" cy="55" rx="20" ry="6" fill="#0f172a" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                <text x="65" y="58" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">100</text>
              </g>
            </svg>
          </div>
        </div>
        <div className="w-full flex flex-col items-center justify-center animate-fade-in">
          <div className="login-card">
            
            {/* Ambient edge glow on card */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: '1px solid rgba(59, 130, 246, 0.1)' }} />

            <div className="flex flex-col items-center mb-8">
              <img src="/logo.png?v=2" alt="Masmorra Manager Logo" className="object-contain mb-4 animate-pulse-slow" style={{ width: '64px', height: '64px' }} />
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight text-center" style={{ margin: 0 }}>Masmorra Manager</h2>
              <p className="text-xs text-muted text-center mt-2" style={{ margin: 0 }}>
                Insira suas credenciais de operador para entrar
              </p>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 mb-6 bg-danger bg-opacity-10 rounded-xl flex items-start gap-2 animate-fade-in" style={{ border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px' }}>
                <AlertCircle className="text-danger flex-shrink-0" size={16} style={{ marginTop: '2px' }} />
                <p className="text-xs font-semibold text-danger leading-relaxed" style={{ margin: 0 }}>{errorMsg}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: '1.25rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest block" style={{ marginBottom: '0.5rem' }}>
                  Endereço de E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute text-muted" size={16} style={{ left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    className="input rounded-xl"
                    style={{ paddingLeft: '44px', paddingRight: '16px', height: '48px' }}
                    placeholder="seu-email@dominio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest block" style={{ marginBottom: '0.5rem' }}>
                  Senha de Acesso
                </label>
                <div className="relative">
                  <Lock className="absolute text-muted" size={16} style={{ left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    className="input rounded-xl"
                    style={{ paddingLeft: '44px', paddingRight: '16px', height: '48px' }}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full rounded-xl text-sm font-bold flex items-center justify-center gap-2 mt-4 cursor-pointer text-white"
                style={{ height: '48px', marginTop: '1rem' }}
                disabled={loading}
              >
                {loading ? (
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Entrar</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer option */}
            <div className="text-center" style={{ marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="text-xs text-muted hover:text-white transition-colors cursor-not-allowed"
                style={{ opacity: 0.5, border: 'none', background: 'none', textDecoration: 'underline' }}
                disabled
              >
                Esqueceu sua senha?
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
