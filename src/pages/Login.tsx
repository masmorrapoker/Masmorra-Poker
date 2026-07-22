import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, LogIn, AlertCircle, ArrowLeft } from 'lucide-react';
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

      <div className="w-full flex flex-col items-center justify-center animate-fade-in relative z-10" style={{ maxWidth: '420px' }}>

        {/* Centered Logo Link pointing back to Home */}
        <Link to="/" className="inline-block mb-6 hover:opacity-85 transition-opacity">
          <img
            src="/logo.png?v=2"
            alt="Masmorra Manager Logo"
            className="object-contain animate-pulse-slow"
            style={{ width: '125px', height: '125px' }}
          />
        </Link>

        {/* Header above card */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ margin: 0 }}>Masmorra Manager</h1>
          <p className="text-xs text-muted mt-2 mb-0">
            Acesse o painel de controle do seu clube.
          </p>
        </div>

        {/* Login Card */}
        <div className="login-card" style={{ margin: 0 }}>
          {/* Ambient edge glow on card */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: '1px solid rgba(59, 130, 246, 0.08)' }} />

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

        {/* Back link to Homepage */}
        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-muted hover:text-white transition-colors flex items-center justify-center gap-1.5 no-underline">
            <ArrowLeft size={14} />
            <span>Voltar para a página inicial</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
