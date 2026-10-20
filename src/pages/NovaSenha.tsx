import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/** Aberta pelo link do e-mail de recuperação: o Supabase já entra com uma sessão temporária. */
export default function NovaSenha() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (password !== confirm) return setError('As duas senhas não são iguais.');
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      navigate('/inicio', { replace: true });
    } catch {
      setError('Não foi possível salvar a nova senha. Peça um novo link na tela de login.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-container">
      <div className="w-full relative z-10 animate-fade-in" style={{ maxWidth: 420 }}>
        <div className="login-card text-left" style={{ margin: 0 }}>
          <h1 className="text-xl font-bold text-white mb-1">Nova senha</h1>
          {!user ? (
            <>
              <p className="text-sm text-muted mb-4">Este link expirou ou já foi usado. Peça um novo na tela de login.</p>
              <Link to="/login" className="btn btn-primary w-full no-underline">Ir para o login</Link>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-sm text-muted mb-2">Conta: <strong className="text-white">{user.email}</strong></p>
              {error && (
                <div className="p-3 rounded-xl text-sm text-danger flex gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }} role="alert">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
                </div>
              )}
              {[['Nova senha', password, setPassword], ['Repita a senha', confirm, setConfirm]].map(([label, value, set]) => (
                <label key={label as string} className="block">
                  <span className="text-xs text-muted font-bold block mb-1">{label as string}</span>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                    <input
                      className="input pl-10"
                      type="password"
                      minLength={6}
                      required
                      autoComplete="new-password"
                      value={value as string}
                      onChange={e => (set as (v: string) => void)(e.target.value)}
                    />
                  </div>
                </label>
              ))}
              <button type="submit" className="btn btn-primary w-full py-3" disabled={busy}>
                {busy ? 'Salvando...' : 'Salvar e entrar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
