import React, { useState, useEffect } from 'react';
import { useClub } from '../contexts/ClubContext';
import { clubService } from '../services/clubService';
import { clubSettingsService } from '../services/clubSettingsService';
import { 
  Save, AlertCircle, CheckCircle, ArrowLeft, Settings as SettingsIcon, 
  Upload, Calendar, DollarSign, Coffee, Sliders, Users2, Key, Trash, Edit, Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
}

export default function Settings() {
  const { club, clubId, refreshClub } = useClub();
  const navigate = useNavigate();
  
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'geral' | 'funcionamento' | 'financeiro' | 'consumos' | 'personalizacao' | 'usuarios' | 'integracoes'>('geral');

  // Geral tab states
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [endereco, setEndereco] = useState('');
  const [instagram, setInstagram] = useState('');
  const [openingHourDefault, setOpeningHourDefault] = useState('20:00');
  const [closingHourDefault, setClosingHourDefault] = useState('04:00');

  // Funcionamento tab states
  const [operatingDays, setOperatingDays] = useState<string[]>(['segunda', 'terca', 'quinta']);
  const [operatingStartHour, setOperatingStartHour] = useState('20:00');
  const [operatingEndHour, setOperatingEndHour] = useState('04:00');
  const [avgSimultaneousTables, setAvgSimultaneousTables] = useState('2');
  const [maxPlayersPerTable, setMaxPlayersPerTable] = useState('');

  // Financeiro tab states
  const [currency, setCurrency] = useState('R$');
  const [defaultBuyIn, setDefaultBuyIn] = useState('200');
  const [minBuyIn, setMinBuyIn] = useState('100');
  const [maxBuyIn, setMaxBuyIn] = useState('1000');
  const [defaultRebuy, setDefaultRebuy] = useState('200');
  const [houseFee, setHouseFee] = useState('5');
  const [dealerCommission, setDealerCommission] = useState('2');

  // Consumos tab states (Custom products registry)
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('Bebidas');
  const [productPrice, setProductPrice] = useState('');
  const [productActive, setProductActive] = useState(true);

  // Personalização tab states
  const [themeColor, setThemeColor] = useState('#3b82f6');
  const [displayName, setDisplayName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('Bem-vindo ao Masmorra Manager');
  const [homeGreetingMessage, setHomeGreetingMessage] = useState('Tudo pronto para mais uma noite de poker.');
  const [whatsappTemplateMessage, setWhatsappTemplateMessage] = useState('');

  // Page global states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (club) {
      setName(club.name);
      setLogoUrl(club.logo_url || '');
      setLogoPreview(club.logo_url || '');
      
      // Load products and configs from Supabase
      fetchSettingsData();
    }
  }, [club, clubId]);

  async function fetchSettingsData() {
    if (!clubId) return;
    try {
      const config = await clubSettingsService.getSettings(clubId);
      if (config) {
        if (config.email) setEmail(config.email);
        if (config.phone) setWhatsapp(config.phone);
        if (config.city) setCidade(config.city);
        if (config.state) setEstado(config.state);
        if (config.address) setEndereco(config.address);
        if (config.instagram) setInstagram(config.instagram);
        if (config.opening_time) setOpeningHourDefault(config.opening_time);
        if (config.closing_time) setClosingHourDefault(config.closing_time);
        
        if (Array.isArray(config.business_days)) setOperatingDays(config.business_days);
        if (config.opening_time) setOperatingStartHour(config.opening_time);
        if (config.closing_time) setOperatingEndHour(config.closing_time);
        
        if (config.default_buyin) setDefaultBuyIn(config.default_buyin.toString());
        if (config.default_rebuy) setDefaultRebuy(config.default_rebuy.toString());
        if (config.currency) setCurrency(config.currency);
        if (config.welcome_message) setWelcomeMessage(config.welcome_message);
        if (config.primary_color) setThemeColor(config.primary_color);
        
        if (Array.isArray(config.custom_products)) {
          setProducts(config.custom_products);
        }
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB Limit
        setErrorMsg('O arquivo de logotipo deve ter no máximo 2MB.');
        return;
      }
      setErrorMsg(null);
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Toggle day helper
  const handleToggleDay = (day: string) => {
    setOperatingDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Products storage helper
  const saveProductsList = async (newProducts: ProductItem[]) => {
    if (!clubId) return;
    setProducts(newProducts);

    try {
      // Save products inside custom_products column in settings
      await clubSettingsService.updateSettings(clubId, {
        custom_products: newProducts
      });

      // Sync default Cerveja and Energético prices to DB if edited
      const beerItem = newProducts.find(p => p.name.toLowerCase() === 'cerveja');
      const energyItem = newProducts.find(p => p.name.toLowerCase() === 'energético' || p.name.toLowerCase() === 'energetico');

      const updates: any = {};
      if (beerItem) updates.beer_price = Number(beerItem.price);
      if (energyItem) updates.energy_price = Number(energyItem.price);

      if (Object.keys(updates).length > 0) {
        await clubService.updateClub(clubId, updates);
        await refreshClub();
      }
    } catch (e) {
      console.error('Error saving custom products list to database:', e);
    }
  };

  // Product CRUD Handlers
  const handleAddProductClick = () => {
    setSelectedProduct(null);
    setProductName('');
    setProductCategory('Bebidas');
    setProductPrice('');
    setProductActive(true);
    setIsEditingProduct(true);
  };

  const handleEditProductClick = (prod: ProductItem) => {
    setSelectedProduct(prod);
    setProductName(prod.name);
    setProductCategory(prod.category);
    setProductPrice(prod.price.toString());
    setProductActive(prod.active);
    setIsEditingProduct(true);
  };

  const handleDeleteProduct = (prodId: string) => {
    if (!window.confirm('Excluir este produto permanentemente?')) return;
    const updated = products.filter(p => p.id !== prodId);
    saveProductsList(updated);
  };

  const handleSaveProductForm = (e: React.FormEvent) => {
    e.preventDefault();
    const priceVal = parseFloat(productPrice);
    if (!productName.trim() || isNaN(priceVal) || priceVal < 0) {
      alert('Dados do produto inválidos.');
      return;
    }

    if (selectedProduct) {
      // Edit mode
      const updated = products.map(p => 
        p.id === selectedProduct.id 
          ? { ...p, name: productName.trim(), category: productCategory, price: priceVal, active: productActive }
          : p
      );
      saveProductsList(updated);
    } else {
      // Create mode
      const newProd: ProductItem = {
        id: Date.now().toString(),
        name: productName.trim(),
        category: productCategory,
        price: priceVal,
        active: productActive
      };
      saveProductsList([...products, newProd]);
    }
    setIsEditingProduct(false);
  };

  // Save All parameters
  const handleSaveAllSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubId || loading) return;
    
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('O nome do clube não pode ficar em branco.');
      return;
    }

    setLoading(true);
    try {
      // 1. Update logo & name in database
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        finalLogoUrl = await clubService.uploadClubLogo(clubId, logoFile);
        setLogoUrl(finalLogoUrl);
        setLogoPreview(finalLogoUrl);
      }

      await clubService.updateClub(clubId, {
        name: name.trim(),
        logo_url: finalLogoUrl || null
      });

      // 2. Save settings to Supabase
      await clubSettingsService.updateSettings(clubId, {
        email: email.trim(),
        phone: whatsapp.trim(),
        instagram: instagram.trim(),
        address: endereco.trim(),
        city: cidade.trim(),
        state: estado.trim(),
        opening_time: openingHourDefault,
        closing_time: closingHourDefault,
        business_days: operatingDays,
        default_buyin: parseFloat(defaultBuyIn) || 200,
        default_rebuy: parseFloat(defaultRebuy) || 200,
        currency,
        welcome_message: welcomeMessage,
        primary_color: themeColor
      });
      
      await refreshClub();
      setSuccessMsg('Configurações salvas com sucesso!');
      setLogoFile(null);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setErrorMsg(err.message || 'Erro ao atualizar as configurações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto text-left px-4">
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
          <h1 className="mb-1 text-2xl font-black" style={{ fontSize: '1.75rem' }}>Configurações do Clube</h1>
          <p className="text-muted text-sm" style={{ margin: 0 }}>Gerencie e personalize completamente as operações do seu clube.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Tabs Bar */}
        <div className="lg:col-span-1 space-y-2">
          <button 
            onClick={() => setActiveTab('geral')}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'geral' ? 'bg-primary text-white shadow-md' : 'bg-dark bg-opacity-40 text-muted border border-glass-border hover:bg-opacity-80'
            }`}
          >
            <SettingsIcon size={18} />
            <span>Geral</span>
          </button>

          <button 
            onClick={() => setActiveTab('funcionamento')}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'funcionamento' ? 'bg-primary text-white shadow-md' : 'bg-dark bg-opacity-40 text-muted border border-glass-border hover:bg-opacity-80'
            }`}
          >
            <Calendar size={18} />
            <span>Funcionamento</span>
          </button>

          <button 
            onClick={() => setActiveTab('financeiro')}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'financeiro' ? 'bg-primary text-white shadow-md' : 'bg-dark bg-opacity-40 text-muted border border-glass-border hover:bg-opacity-80'
            }`}
          >
            <DollarSign size={18} />
            <span>Financeiro</span>
          </button>

          <button 
            onClick={() => setActiveTab('consumos')}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'consumos' ? 'bg-primary text-white shadow-md' : 'bg-dark bg-opacity-40 text-muted border border-glass-border hover:bg-opacity-80'
            }`}
          >
            <Coffee size={18} />
            <span>Consumos (Produtos)</span>
          </button>

          <button 
            onClick={() => setActiveTab('personalizacao')}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'personalizacao' ? 'bg-primary text-white shadow-md' : 'bg-dark bg-opacity-40 text-muted border border-glass-border hover:bg-opacity-80'
            }`}
          >
            <Sliders size={18} />
            <span>Personalização</span>
          </button>

          <button 
            onClick={() => setActiveTab('usuarios')}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'usuarios' ? 'bg-primary text-white shadow-md' : 'bg-dark bg-opacity-40 text-muted border border-glass-border hover:bg-opacity-80'
            }`}
          >
            <Users2 size={18} />
            <span>Usuários (Em breve)</span>
          </button>

          <button 
            onClick={() => setActiveTab('integracoes')}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'integracoes' ? 'bg-primary text-white shadow-md' : 'bg-dark bg-opacity-40 text-muted border border-glass-border hover:bg-opacity-80'
            }`}
          >
            <Key size={18} />
            <span>Integrações (Em breve)</span>
          </button>
        </div>

        {/* Configurations Dynamic Content Panel */}
        <div className="lg:col-span-3">
          <div className="glass-panel text-left">
            
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

            <form onSubmit={handleSaveAllSettings}>
              
              {/* TAB GERAL */}
              {activeTab === 'geral' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white mb-2">Dados do Clube</h2>
                  
                  {/* Logo upload component */}
                  <div className="input-group">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                      Logotipo do Clube
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border">
                      <div className="flex-shrink-0 relative group">
                        {logoPreview ? (
                          <img 
                            src={logoPreview} 
                            alt="Visualização" 
                            className="w-16 h-16 rounded-full object-cover border border-glass-border" 
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary bg-opacity-10 text-primary flex items-center justify-center text-xl font-bold border border-primary border-opacity-20">
                            {name ? name.substring(0, 2).toUpperCase() : 'MM'}
                          </div>
                        )}
                      </div>
                      <div className="text-center sm:text-left flex-1">
                        <p className="text-xs font-medium text-white mb-1">Upload de Nova Logo</p>
                        <p className="text-[10px] text-muted mb-3">Formatos aceitos: PNG, JPG, WEBP. Tamanho máx: 2MB.</p>
                        <label className="btn btn-outline btn-sm cursor-pointer inline-flex items-center gap-2">
                          <Upload size={14} />
                          <span>Selecionar Imagem</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Nome do Clube *</label>
                      <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        className="input" 
                        required 
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">E-mail Operacional</label>
                      <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        className="input" 
                        placeholder="email@clube.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">WhatsApp Contato</label>
                      <input 
                        type="text" 
                        value={whatsapp} 
                        onChange={(e) => setWhatsapp(e.target.value)} 
                        className="input" 
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Instagram (Link ou @)</label>
                      <input 
                        type="text" 
                        value={instagram} 
                        onChange={(e) => setInstagram(e.target.value)} 
                        className="input" 
                        placeholder="@seuvipclub"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="input-group md:col-span-2">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Endereço Completo</label>
                      <input 
                        type="text" 
                        value={endereco} 
                        onChange={(e) => setEndereco(e.target.value)} 
                        className="input" 
                        placeholder="Av. Paulista, 1000"
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Cidade</label>
                      <input 
                        type="text" 
                        value={cidade} 
                        onChange={(e) => setCidade(e.target.value)} 
                        className="input" 
                        placeholder="São Paulo"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Estado (UF)</label>
                      <input 
                        type="text" 
                        value={estado} 
                        onChange={(e) => setEstado(e.target.value)} 
                        className="input" 
                        maxLength={2} 
                        placeholder="SP"
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Hora Abertura Padrão</label>
                      <input 
                        type="time" 
                        value={openingHourDefault} 
                        onChange={(e) => setOpeningHourDefault(e.target.value)} 
                        className="input" 
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Hora Encerramento Padrão</label>
                      <input 
                        type="time" 
                        value={closingHourDefault} 
                        onChange={(e) => setClosingHourDefault(e.target.value)} 
                        className="input" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB FUNCIONAMENTO */}
              {activeTab === 'funcionamento' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white mb-2">Regras de Funcionamento</h2>
                  
                  {/* Days selection */}
                  <div>
                    <label className="text-xs font-bold text-muted uppercase block mb-3">Dias de Funcionamento Semanal</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'].map((day) => {
                        const isChecked = operatingDays.includes(day);
                        const label = day.charAt(0).toUpperCase() + day.slice(1).replace('terca', 'Terça').replace('sabado', 'Sábado');
                        return (
                          <div 
                            key={day}
                            onClick={() => handleToggleDay(day)}
                            className={`p-3 rounded-xl border border-glass-border flex items-center justify-between cursor-pointer transition-all ${
                              isChecked ? 'bg-primary bg-opacity-20 border-primary text-white' : 'bg-black bg-opacity-20 text-muted hover:bg-opacity-35'
                            }`}
                          >
                            <span className="font-bold text-xs">{label}</span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-primary border-primary text-white' : 'border-glass-border'}`}>
                              {isChecked && <span className="text-[10px]">✔</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Horário Padrão de Início</label>
                      <input 
                        type="time" 
                        value={operatingStartHour} 
                        onChange={(e) => setOperatingStartHour(e.target.value)} 
                        className="input" 
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Horário Padrão de Encerramento</label>
                      <input 
                        type="time" 
                        value={operatingEndHour} 
                        onChange={(e) => setOperatingEndHour(e.target.value)} 
                        className="input" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Nº Médio de Mesas Simultâneas</label>
                      <input 
                        type="number" 
                        value={avgSimultaneousTables} 
                        onChange={(e) => setAvgSimultaneousTables(e.target.value)} 
                        className="input" 
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Limite Máx Jogadores por Mesa</label>
                      <input 
                        type="number" 
                        value={maxPlayersPerTable} 
                        onChange={(e) => setMaxPlayersPerTable(e.target.value)} 
                        className="input" 
                        placeholder="Ex: 9 (Opcional)"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB FINANCEIRO */}
              {activeTab === 'financeiro' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white mb-2">Regras Financeiras</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Moeda Corrente</label>
                      <input 
                        type="text" 
                        value={currency} 
                        onChange={(e) => setCurrency(e.target.value)} 
                        className="input cursor-not-allowed opacity-60" 
                        disabled 
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Valor Padrão de Buy-in</label>
                      <input 
                        type="number" 
                        value={defaultBuyIn} 
                        onChange={(e) => setDefaultBuyIn(e.target.value)} 
                        className="input" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Valor Mínimo de Buy-in</label>
                      <input 
                        type="number" 
                        value={minBuyIn} 
                        onChange={(e) => setMinBuyIn(e.target.value)} 
                        className="input" 
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Valor Máximo de Buy-in</label>
                      <input 
                        type="number" 
                        value={maxBuyIn} 
                        onChange={(e) => setMaxBuyIn(e.target.value)} 
                        className="input" 
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Valor Padrão de Rebuy</label>
                      <input 
                        type="number" 
                        value={defaultRebuy} 
                        onChange={(e) => setDefaultRebuy(e.target.value)} 
                        className="input" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Taxa da Casa (Rake %)</label>
                      <input 
                        type="number" 
                        value={houseFee} 
                        onChange={(e) => setHouseFee(e.target.value)} 
                        className="input" 
                        placeholder="Ex: 5"
                      />
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Comissão do Dealer (% Opcional)</label>
                      <input 
                        type="number" 
                        value={dealerCommission} 
                        onChange={(e) => setDealerCommission(e.target.value)} 
                        className="input" 
                        placeholder="Ex: 2"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONSUMOS (PRODUTOS) */}
              {activeTab === 'consumos' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-bold text-white mb-0">Gestão de Produtos da Copa</h2>
                    <button 
                      type="button" 
                      onClick={handleAddProductClick}
                      className="btn btn-success btn-sm flex items-center gap-1.5 font-bold"
                    >
                      <Plus size={16} /> Adicionar Produto
                    </button>
                  </div>

                  <div className="p-4 bg-black bg-opacity-35 rounded-2xl border border-glass-border">
                    {products.length === 0 ? (
                      <p className="text-muted text-center py-6 text-sm">Nenhum produto cadastrado na copa.</p>
                    ) : (
                      <div className="divide-y divide-glass-border">
                        {products.map((prod) => (
                          <div key={prod.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white">{prod.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${prod.active ? 'bg-success bg-opacity-15 text-success' : 'bg-danger bg-opacity-15 text-danger'}`}>
                                  {prod.active ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                              <div className="text-xs text-muted mt-1">Categoria: {prod.category}</div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-extrabold text-sm text-success">
                                {prod.price === 0 ? 'Grátis' : `R$ ${prod.price.toFixed(2)}`}
                              </span>
                              <div className="flex items-center gap-1">
                                <button 
                                  type="button" 
                                  onClick={() => handleEditProductClick(prod)}
                                  className="text-muted hover:text-white p-2 hover:bg-white hover:bg-opacity-5 rounded-lg border border-transparent hover:border-glass-border active:scale-95 transition-transform"
                                  title="Editar"
                                >
                                  <Edit size={14} />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => handleDeleteProduct(prod.id)}
                                  className="text-muted hover:text-danger p-2 hover:bg-danger hover:bg-opacity-10 rounded-lg border border-transparent active:scale-95 transition-transform"
                                  title="Excluir"
                                >
                                  <Trash size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB PERSONALIZAÇÃO */}
              {activeTab === 'personalizacao' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white mb-2">Identidade & Visual</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Cor Principal (Accent)</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="color" 
                          value={themeColor} 
                          onChange={(e) => setThemeColor(e.target.value)} 
                          className="w-12 h-10 bg-transparent cursor-pointer rounded-xl border border-glass-border p-1" 
                        />
                        <input 
                          type="text" 
                          value={themeColor} 
                          onChange={(e) => setThemeColor(e.target.value)} 
                          className="input flex-1" 
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="text-xs font-bold text-muted uppercase block mb-2">Nome Comercial Exibido</label>
                      <input 
                        type="text" 
                        value={displayName} 
                        onChange={(e) => setDisplayName(e.target.value)} 
                        className="input" 
                        placeholder={club?.name || 'Masmorra Manager'}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="text-xs font-bold text-muted uppercase block mb-2">Mensagem de Boas-Vindas (Login)</label>
                    <textarea 
                      value={welcomeMessage} 
                      onChange={(e) => setWelcomeMessage(e.target.value)} 
                      className="input rounded-xl resize-none py-2.5" 
                      rows={2}
                    />
                  </div>

                  <div className="input-group">
                    <label className="text-xs font-bold text-muted uppercase block mb-2">Frase de Saudação Inicial</label>
                    <textarea 
                      value={homeGreetingMessage} 
                      onChange={(e) => setHomeGreetingMessage(e.target.value)} 
                      className="input rounded-xl resize-none py-2.5" 
                      rows={2}
                    />
                  </div>

                  <div className="input-group">
                    <label className="text-xs font-bold text-muted uppercase block mb-2">Mensagem padrão de Cobrança WhatsApp</label>
                    <textarea 
                      value={whatsappTemplateMessage} 
                      onChange={(e) => setWhatsappTemplateMessage(e.target.value)} 
                      className="input rounded-xl resize-none py-2.5" 
                      rows={3}
                      placeholder="Deixe em branco para usar o padrão dinâmico do CRM..."
                    />
                  </div>
                </div>
              )}

              {/* TAB USUARIOS MOCK */}
              {activeTab === 'usuarios' && (
                <div className="py-8 text-center bg-black bg-opacity-25 rounded-2xl border border-glass-border">
                  <Users2 className="mx-auto text-muted mb-3" size={40} opacity={0.6} />
                  <h3 className="text-white font-bold text-base mb-1">Módulo de Gestão de Operadores</h3>
                  <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                    Controle de permissões, múltiplos operadores por turno e logs de auditoria de caixa. Disponível nas próximas versões premium.
                  </p>
                </div>
              )}

              {/* TAB INTEGRACOES MOCK */}
              {activeTab === 'integracoes' && (
                <div className="py-8 text-center bg-black bg-opacity-25 rounded-2xl border border-glass-border">
                  <Key className="mx-auto text-muted mb-3" size={40} opacity={0.6} />
                  <h3 className="text-white font-bold text-base mb-1">Integrações de API Externas</h3>
                  <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                    Conecte sua copa ao WhatsApp Cloud API oficial, painéis de TV externos e gateways de PIX automático. Em breve.
                  </p>
                </div>
              )}

              {/* Global Save Button (Omitted on sub tabs that are read-only mocks) */}
              {activeTab !== 'usuarios' && activeTab !== 'integracoes' && (
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
              )}

            </form>
          </div>
        </div>

      </div>

      {/* Product Add/Edit Modal */}
      {isEditingProduct && (
        <div className="modal-overlay">
          <div className="modal-content text-left" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>{selectedProduct ? 'Editar Produto' : 'Adicionar Produto'}</h2>
              <button type="button" className="close-btn" onClick={() => setIsEditingProduct(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProductForm} className="space-y-4">
              <div className="input-group">
                <label className="text-xs font-bold text-muted block mb-2">Nome do Produto *</label>
                <input 
                  type="text" 
                  value={productName} 
                  onChange={(e) => setProductName(e.target.value)} 
                  className="input rounded-xl"
                  placeholder="Ex: Coca-Cola 350ml"
                  required 
                  autoFocus 
                />
              </div>

              <div className="input-group">
                <label className="text-xs font-bold text-muted block mb-2">Categoria</label>
                <select 
                  value={productCategory} 
                  onChange={(e) => setProductCategory(e.target.value)} 
                  className="input rounded-xl"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="Bebidas">Bebidas</option>
                  <option value="Alimentos">Alimentos</option>
                  <option value="Cigarros">Cigarros</option>
                  <option value="Serviços">Serviços</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="input-group">
                <label className="text-xs font-bold text-muted block mb-2">Preço (R$) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={productPrice} 
                  onChange={(e) => setProductPrice(e.target.value)} 
                  className="input rounded-xl"
                  placeholder="5.00"
                  required 
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div 
                  onClick={() => setProductActive(!productActive)}
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${productActive ? 'bg-primary border-primary text-white' : 'border-glass-border'}`}
                >
                  {productActive && <span className="text-[10px]">✔</span>}
                </div>
                <span className="text-xs text-white font-bold cursor-pointer" onClick={() => setProductActive(!productActive)}>
                  Produto Ativo (Visível para lançamento nas mesas)
                </span>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setIsEditingProduct(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!productName.trim() || !productPrice}>Salvar Produto</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
