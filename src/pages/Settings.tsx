import React, { useState, useEffect } from 'react';
import { useClub } from '../contexts/ClubContext';
import { clubService } from '../services/clubService';
import { Save, AlertCircle, CheckCircle, ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { club, clubId, refreshClub } = useClub();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [beerPrice, setBeerPrice] = useState('');
  const [energyPrice, setEnergyPrice] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (club) {
      setName(club.name);
      setLogoUrl(club.logo_url || '');
      setBeerPrice(club.beer_price.toString());
      setEnergyPrice(club.energy_price.toString());
    }
  }, [club]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId || loading) return;
    
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const parsedBeer = parseFloat(beerPrice);
    const parsedEnergy = parseFloat(energyPrice);
    
    if (isNaN(parsedBeer) || parsedBeer < 0 || isNaN(parsedEnergy) || parsedEnergy < 0) {
      setErrorMsg('Por favor, insira valores de preço válidos e maiores ou iguais a zero.');
      return;
    }

    if (!name.trim()) {
      setErrorMsg('O nome do clube não pode ficar em branco.');
      return;
    }

    setLoading(true);
    try {
      await clubService.updateClub(clubId, {
        name: name.trim(),
        logo_url: logoUrl.trim() || null,
        beer_price: parsedBeer,
        energy_price: parsedEnergy
      });
      await refreshClub();
      setSuccessMsg('Configurações salvas com sucesso!');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setErrorMsg(err.message || 'Erro ao atualizar as configurações. Verifique os dados e tente novamente.');
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
          <SettingsIcon size={24} />
        </div>
        <div className="text-left">
          <h1 className="mb-1" style={{ fontSize: '1.75rem' }}>Configurações do Clube</h1>
          <p className="text-muted text-sm" style={{ margin: 0 }}>Gerencie o nome do clube, logo e preços dos itens de consumo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <div className="glass-panel text-left">
            <h3 className="text-sm font-bold text-white mb-3">Informações Gerais</h3>
            <p className="text-xs text-muted leading-relaxed mb-4">
              Estas configurações definem as informações públicas e regras financeiras da copa do seu clube.
            </p>
            <div className="p-4 bg-black bg-opacity-30 rounded-xl flex flex-col items-center justify-center gap-3">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo do Clube" 
                  className="w-16 h-16 rounded-full object-cover border border-glass-border" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/100?text=Logo';
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary bg-opacity-10 text-primary flex items-center justify-center text-2xl font-bold border border-primary border-opacity-20">
                  {name ? name.substring(0, 2).toUpperCase() : 'MM'}
                </div>
              )}
              <span className="text-xs font-semibold text-white truncate max-w-full">{name || 'Seu Clube'}</span>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="md:col-span-2">
          <div className="glass-panel text-left">
            <h2 className="text-lg font-bold text-white mb-6">Ajustar Parâmetros</h2>

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
                  Nome do Clube
                </label>
                <input
                  type="text"
                  className="input rounded-xl"
                  placeholder="Nome do seu clube de poker"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                  URL do Logotipo (Opcional)
                </label>
                <input
                  type="url"
                  className="input rounded-xl"
                  placeholder="https://exemplo.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="input-group">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                    Preço da Cerveja (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input rounded-xl"
                    placeholder="5.00"
                    value={beerPrice}
                    onChange={(e) => setBeerPrice(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                    Preço do Energético (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input rounded-xl"
                    placeholder="8.00"
                    value={energyPrice}
                    onChange={(e) => setEnergyPrice(e.target.value)}
                    required
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
                    <span>Salvar Alterações</span>
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
