import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabase';
import { Save, AlertCircle, CheckCircle, ArrowLeft, User as UserIcon, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OperatorProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      authService.getProfile(user.id)
        .then(profile => {
          if (profile) {
            setFullName(profile.full_name || '');
          }
        })
        .catch(err => console.error('Error fetching profile:', err));
    }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || loading) return;
    
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password && password !== confirmPassword) {
      setErrorMsg('A confirmação de senha não coincide com a nova senha.');
      return;
    }

    if (password && password.length < 6) {
      setErrorMsg('A senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      // 1. Update Profile Full Name
      await authService.updateProfile(user.id, {
        full_name: fullName.trim() || null
      });

      // 2. Update Password if provided
      if (password) {
        const { error: passError } = await supabase.auth.updateUser({
          password: password
        });
        if (passError) throw passError;
      }

      setSuccessMsg('Perfil atualizado com sucesso!');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setErrorMsg(err.message || 'Erro ao salvar alterações do perfil.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Back Button */}
      <button className="btn btn-outline mb-6 desktop-only" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> Voltar
      </button>

      {/* Header */}
      <div className="glass-panel mb-8 border-t-4 border-t-primary flex items-center gap-3">
        <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-xl">
          <UserIcon size={24} />
        </div>
        <div className="text-left">
          <h1 className="mb-1" style={{ fontSize: '1.75rem' }}>Meu Perfil</h1>
          <p className="text-muted text-sm" style={{ margin: 0 }}>Gerencie seus dados pessoais e senha de acesso.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Badge Info */}
        <div className="md:col-span-1">
          <div className="glass-panel text-left flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-blue-600 text-white flex items-center justify-center text-3xl font-extrabold shadow-lg shadow-primary/20">
              {fullName ? fullName.substring(0, 2).toUpperCase() : (user?.email ? user.email.substring(0, 2).toUpperCase() : 'OP')}
            </div>
            <div className="text-center w-full">
              <h3 className="text-base font-bold text-white mb-1 truncate">{fullName || 'Operador'}</h3>
              <p className="text-xs text-muted truncate" style={{ margin: 0 }}>{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Update Form */}
        <div className="md:col-span-2">
          <div className="glass-panel text-left">
            <h2 className="text-lg font-bold text-white mb-6">Informações de Acesso</h2>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 mb-6 bg-danger bg-opacity-10 border border-danger border-opacity-20 rounded-xl flex items-start gap-3 animate-fade-in">
                <AlertCircle className="text-danger flex-shrink-0 mt-0.5" size={18} />
                <p className="text-xs font-semibold text-danger leading-relaxed" style={{ margin: 0 }}>{errorMsg}</p>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-3.5 mb-6 bg-success bg-opacity-10 border border-success border-opacity-20 rounded-xl flex items-start gap-3 animate-fade-in">
                <CheckCircle className="text-success flex-shrink-0 mt-0.5" size={18} />
                <p className="text-xs font-semibold text-success leading-relaxed" style={{ margin: 0 }}>{successMsg}</p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-5">
              <div className="input-group">
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                  Nome Completo
                </label>
                <input
                  type="text"
                  className="input rounded-xl"
                  placeholder="Nome do operador"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                  Endereço de E-mail (Somente Leitura)
                </label>
                <input
                  type="email"
                  className="input rounded-xl opacity-60 cursor-not-allowed"
                  value={user?.email || ''}
                  disabled
                />
              </div>

              <hr className="border-glass-border my-6" />

              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Lock size={16} />
                <span>Alterar Senha (Opcional)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="input-group">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    className="input rounded-xl"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                    Confirmar Senha
                  </label>
                  <input
                    type="password"
                    className="input rounded-xl"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mt-8 active:scale-95 transition-transform hover:shadow-lg cursor-pointer text-white"
                disabled={loading}
              >
                {loading ? (
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Salvar Perfil</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
