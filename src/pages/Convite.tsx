import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Lock, Mail, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { friendlyError, pendingInvite, ROLE_HINT, ROLE_LABEL, teamService, type InviteInfo } from '../services/teamService';

/**
 * Página aberta pelo link de convite.
 * Sem login: cria a conta (ou entra) e aceita. Com login: aceita direto.
 */
export default function Convite() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { refreshClub } = useClub();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [mode, setMode] = useState<'criar' | 'entrar'>('criar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingEmail, setWaitingEmail] = useState(false);

  useEffect(() => {
    teamService.getInvite(token).then(setInfo).catch(() => setInfo({ valid: false, reason: 'inexistente' }));
  }, [token]);

  async function accept(displayName?: string) {
    await teamService.acceptInvite(token, displayName);
    pendingInvite.clear();
    await refreshClub();
    navigate('/inicio', { replace: true });
  }

  async function acceptLoggedIn() {
    setBusy(true);
    setError(null);
    try {
      await accept(name.trim() || undefined);
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível aceitar o convite.'));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'criar') {
        if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/convite/${token}` }
        });
        if (err) throw err;
        if (!data.session) {
          // Supabase pediu confirmação de e-mail: o convite é aplicado no primeiro login.
          pendingInvite.set(token);
          setWaitingEmail(true);
          return;
        }
        await accept(name.trim());
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        await accept();
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      if (/already registered|already been registered/i.test(msg)) {
        setMode('entrar');
        setError('Este e-mail já tem conta. Entre com a senha dele.');
      } else if (/Invalid login credentials/i.test(msg)) {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(friendlyError(e, 'Não foi possível concluir. Tente de novo.'));
      }
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = info?.role ? ROLE_LABEL[info.role] : '';

  return (
    <div className="login-container">
      <div className="w-full flex flex-col items-center relative z-10 animate-fade-in" style={{ maxWidth: 420 }}>
        <Link to="/" className="inline-block mb-6">
          <img src="/logo.png?v=2" alt="Masmorra Manager" className="object-contain" style={{ width: 96, height: 96 }} />
        </Link>

        <div className="login-card text-left" style={{ margin: 0 }}>
          {!info ? (
            <div className="flex justify-center p-8"><div className="spinner" role="status" aria-label="Carregando" /></div>
          ) : !info.valid ? (
            <div className="text-center">
              <AlertCircle className="mx-auto text-danger mb-3" size={32} />
              <h1 className="text-lg font-bold text-white mb-2">
                {info.reason === 'usado' ? 'Este convite já foi usado' : info.reason === 'expirado' ? 'Este convite expirou' : 'Convite não encontrado'}
              </h1>
              <p className="text-sm text-muted mb-4">Peça um novo link a quem te convidou.</p>
              <Link to="/login" className="btn btn-outline w-full no-underline">Ir para o login</Link>
            </div>
          ) : waitingEmail ? (
            <div className="text-center">
              <Mail className="mx-auto text-primary mb-3" size={32} />
              <h1 className="text-lg font-bold text-white mb-2">Confirme seu e-mail</h1>
              <p className="text-sm text-muted mb-0">
                Enviamos um link para <strong className="text-white">{email}</strong>. Depois de confirmar, entre com seu e-mail e senha:
                você já cai direto no {info.club_name}.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted mb-1">Você foi convidado para</p>
              <h1 className="text-xl font-black text-white mb-1">{info.club_name}</h1>
              <p className="text-sm text-white mb-1">como <strong>{roleLabel}</strong></p>
              {info.role && <p className="text-xs text-muted mb-5">{ROLE_HINT[info.role]}</p>}

              {error && (
                <div className="mb-4 p-3 rounded-xl text-sm text-danger flex gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }} role="alert">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
                </div>
              )}

              {user ? (
                <>
                  <p className="text-sm text-muted mb-4">Entrando como <strong className="text-white">{user.email}</strong>.</p>
                  <button type="button" className="btn btn-primary w-full py-3 mb-2" onClick={acceptLoggedIn} disabled={busy}>
                    <CheckCircle2 size={18} /> {busy ? 'Entrando...' : `Entrar no ${info.club_name}`}
                  </button>
                  <button type="button" className="btn btn-outline w-full py-3" onClick={logout} disabled={busy}>
                    Usar outra conta
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border border-glass-border mb-4" role="tablist">
                    {(['criar', 'entrar'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        role="tab"
                        aria-selected={mode === m}
                        onClick={() => { setMode(m); setError(null); }}
                        className={`py-2.5 rounded-lg text-xs font-bold border-0 cursor-pointer ${mode === m ? 'bg-primary text-white' : 'text-muted'}`}
                        style={mode === m ? undefined : { background: 'transparent' }}
                      >
                        {m === 'criar' ? 'Criar conta' : 'Já tenho conta'}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={submit} className="space-y-3">
                    {mode === 'criar' && (
                      <label className="block">
                        <span className="text-xs text-muted font-bold block mb-1">Seu nome</span>
                        <div className="relative">
                          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                          <input className="input pl-10" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
                        </div>
                      </label>
                    )}
                    <label className="block">
                      <span className="text-xs text-muted font-bold block mb-1">E-mail</span>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                        <input className="input pl-10" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-xs text-muted font-bold block mb-1">Senha{mode === 'criar' ? ' (mínimo 6 caracteres)' : ''}</span>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                        <input
                          className="input pl-10"
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          minLength={6}
                          autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
                        />
                      </div>
                    </label>
                    <button type="submit" className="btn btn-primary w-full py-3" disabled={busy}>
                      {busy ? 'Aguarde...' : mode === 'criar' ? `Criar conta e entrar` : 'Entrar e aceitar convite'}
                    </button>
                  </form>
                  <p className="text-[11px] text-muted mt-4 mb-0">
                    Ao continuar, você concorda com os <Link to="/termos" className="text-primary">Termos de uso</Link> e a{' '}
                    <Link to="/privacidade" className="text-primary">Política de privacidade</Link>.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
