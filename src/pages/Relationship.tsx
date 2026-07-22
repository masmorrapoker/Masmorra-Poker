import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { GlobalPlayer, Transaction } from '../types';
import { 
  Calendar, Phone, Search, Send, AlertCircle, 
  Sparkles, Activity, Eye
} from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { playerService } from '../services/playerService';
import { Link } from 'react-router-dom';

interface PlayerCRMStats {
  player: GlobalPlayer;
  totalVisits: number;
  lastVisitDate: string;
  daysSinceLastVisit: number;
  totalBuyIn: number;
  totalCashOut: number;
  totalConsumo: number;
  balance: number;
  isBirthdayThisMonth: boolean;
}

export default function Relationship() {
  const { clubId, clubName } = useClub();
  
  // Data States
  const [players, setPlayers] = useState<GlobalPlayer[]>([]);
  const [tablePlayers, setTablePlayers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings states
  const [inactiveDays, setInactiveDays] = useState(30);
  const [marketingClubName, setMarketingClubName] = useState(clubName || 'Masmorra Manager');
  const [templates, setTemplates] = useState({
    template1: "Olá, {{nome}}!\n\nSentimos sua falta. Percebemos que faz um tempinho que você não aparece por aqui.\n\nPara te ver novamente nas mesas, preparamos um bônus especial de 10% no seu próximo buy-in.\n\nEsperamos você!\n\n♠ {{nome_do_clube}}",
    template2: "Olá, {{nome}}!\n\nNa sua próxima visita você ganha uma bebida por nossa conta.\n\nEsperamos você!\n\n♠ {{nome_do_clube}}",
    template3: "Olá, {{nome}}!\n\nHoje teremos Cash Game a partir das 20h. Sua cadeira está te esperando!\n\nEsperamos você!\n\n♠ {{nome_do_clube}}",
    template4: "Feliz aniversário, {{nome}}!\n\nComo presente do {{nome_do_clube}}, você ganhou um bônus especial para utilizar na sua próxima visita. Parabéns!\n\nEsperamos você!"
  });
  const [activeTab, setActiveTab] = useState<'crm' | 'templates' | 'config'>('crm');

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'birthday' | 'no_phone' | '30' | '45' | '60' | '90'>('all');

  // Outreach Modal States
  const [outreachPlayer, setOutreachPlayer] = useState<PlayerCRMStats | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<'template1' | 'template2' | 'template3' | 'template4'>('template1');
  const [customizedMessage, setCustomizedMessage] = useState('');

  // Add/Edit Phone Modal
  const [phoneEditPlayer, setPhoneEditPlayer] = useState<GlobalPlayer | null>(null);
  const [phoneInput, setPhoneInput] = useState('');

  useEffect(() => {
    if (clubId) {
      fetchCRMData();
      loadMarketingSettings();
    }
  }, [clubId]);

  // Load custom templates and settings from LocalStorage
  const loadMarketingSettings = () => {
    try {
      const saved = localStorage.getItem('masmorra_marketing_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.inactiveDays) setInactiveDays(Number(parsed.inactiveDays));
        if (parsed.clubName) setMarketingClubName(parsed.clubName);
        if (parsed.template1) setTemplates(prev => ({ ...prev, template1: parsed.template1 }));
        if (parsed.template2) setTemplates(prev => ({ ...prev, template2: parsed.template2 }));
        if (parsed.template3) setTemplates(prev => ({ ...prev, template3: parsed.template3 }));
        if (parsed.template4) setTemplates(prev => ({ ...prev, template4: parsed.template4 }));
      }
    } catch(e) {
      console.error('Error loading settings from local storage:', e);
    }
  };

  // Save settings helper
  const saveMarketingSettings = (newThreshold: number, newName: string, newTemplates: typeof templates) => {
    try {
      const toSave = {
        inactiveDays: newThreshold,
        clubName: newName,
        ...newTemplates
      };
      localStorage.setItem('masmorra_marketing_settings', JSON.stringify(toSave));
    } catch(e) {
      console.error('Error saving settings:', e);
    }
  };

  async function fetchCRMData() {
    if (!clubId) return;
    try {
      setLoading(true);
      
      // Fetch global players
      const gPlayers = await playerService.getPlayers(clubId);
      setPlayers(gPlayers);


      // Fetch all table_players (sessions)
      const { data: tpData } = await supabase
        .from('table_players')
        .select('*')
        .eq('club_id', clubId);
      setTablePlayers(tpData || []);

      // Fetch all transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('club_id', clubId);
      setTransactions(txData || []);

    } catch (error) {
      console.error('Error loading CRM Relationship data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Handle saving phone number from the inline modal
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneEditPlayer || !clubId) return;
    try {
      const updated = await playerService.updatePlayer(clubId, phoneEditPlayer.id, {
        phone: phoneInput.trim() || null
      });
      // Update local state
      setPlayers(prev => prev.map(p => p.id === updated.id ? updated : p));
      setPhoneEditPlayer(null);
      setPhoneInput('');
    } catch(err) {
      console.error('Error updating player phone:', err);
    }
  };

  // Compile calculations for each player
  const playerStatsList: PlayerCRMStats[] = players.map(p => {
    const sessions = tablePlayers.filter(tp => tp.name === p.name);
    const sessionIds = sessions.map(s => s.id);
    const playerTxs = transactions.filter(tx => sessionIds.includes(tx.player_id));

    const totalBuyIn = playerTxs.filter(tx => tx.type === 'buy_in').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalCashOut = playerTxs.filter(tx => tx.type === 'cash_out').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalConsumo = playerTxs.filter(tx => tx.type === 'consumo').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const balance = totalCashOut - totalBuyIn - totalConsumo;

    let lastVisitDate = 'Nunca';
    let daysSinceLastVisit = 9999; // High value for never visited players

    if (sessions.length > 0) {
      // Sort sessions newest to oldest
      sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      lastVisitDate = new Date(sessions[0].created_at).toLocaleDateString('pt-BR');
      daysSinceLastVisit = Math.floor((Date.now() - new Date(sessions[0].created_at).getTime()) / (1000 * 60 * 60 * 24));
    }

    let isBirthdayThisMonth = false;
    if (p.birth_date) {
      const birthMonth = new Date(p.birth_date + 'T12:00:00').getMonth();
      const currentMonth = new Date().getMonth();
      isBirthdayThisMonth = birthMonth === currentMonth;
    }

    return {
      player: p,
      totalVisits: sessions.length,
      lastVisitDate,
      daysSinceLastVisit,
      totalBuyIn,
      totalCashOut,
      totalConsumo,
      balance,
      isBirthdayThisMonth
    };
  });

  // Calculate high level KPI Counts
  const activeCount = playerStatsList.filter(s => s.totalVisits > 0 && s.daysSinceLastVisit < inactiveDays).length;
  const inactiveCount = playerStatsList.filter(s => s.totalVisits > 0 && s.daysSinceLastVisit >= inactiveDays).length;
  const birthdayCount = playerStatsList.filter(s => s.isBirthdayThisMonth).length;
  const noPhoneCount = playerStatsList.filter(s => !s.player.phone).length;

  // Filter players
  const filteredList = playerStatsList.filter(s => {
    // Search Term match
    const nameMatch = s.player.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!nameMatch) return false;

    // Filter Type match
    switch(filterType) {
      case 'active':
        return s.totalVisits > 0 && s.daysSinceLastVisit < inactiveDays;
      case 'inactive':
        return s.totalVisits > 0 && s.daysSinceLastVisit >= inactiveDays;
      case 'birthday':
        return s.isBirthdayThisMonth;
      case 'no_phone':
        return !s.player.phone;
      case '30':
        return s.totalVisits > 0 && s.daysSinceLastVisit >= 30;
      case '45':
        return s.totalVisits > 0 && s.daysSinceLastVisit >= 45;
      case '60':
        return s.totalVisits > 0 && s.daysSinceLastVisit >= 60;
      case '90':
        return s.totalVisits > 0 && s.daysSinceLastVisit >= 90;
      default:
        return true;
    }
  });

  // Format message variables
  const formatMessageText = (template: string, stats: PlayerCRMStats) => {
    let text = template;
    text = text.replace(/\{\{nome\}\}/g, stats.player.name || '');
    text = text.replace(/\{\{nome_do_clube\}\}/g, marketingClubName);
    text = text.replace(/\{\{dias_sem_jogar\}\}/g, stats.daysSinceLastVisit === 9999 ? 'N/A' : String(stats.daysSinceLastVisit));
    text = text.replace(/\{\{ultima_visita\}\}/g, stats.lastVisitDate);
    return text;
  };

  // Open modal and pre-compile default message
  const handleOpenOutreach = (stats: PlayerCRMStats) => {
    setOutreachPlayer(stats);
    let key: typeof selectedTemplateKey = 'template1';
    if (stats.isBirthdayThisMonth) {
      key = 'template4';
    } else if (stats.daysSinceLastVisit >= 60) {
      key = 'template2';
    }
    setSelectedTemplateKey(key);
    setCustomizedMessage(formatMessageText(templates[key], stats));
  };

  // Refresh message preview on template switch
  const handleTemplateChange = (key: typeof selectedTemplateKey) => {
    setSelectedTemplateKey(key);
    if (outreachPlayer) {
      setCustomizedMessage(formatMessageText(templates[key], outreachPlayer));
    }
  };

  // Trigger WhatsApp Web URL redirect
  const handleSendWhatsApp = () => {
    if (!outreachPlayer || !outreachPlayer.player.phone) return;
    let cleanedPhone = outreachPlayer.player.phone.replace(/\D/g, '');
    if (cleanedPhone.length === 11 && !cleanedPhone.startsWith('55')) {
      cleanedPhone = '55' + cleanedPhone;
    }
    const url = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(customizedMessage)}`;
    window.open(url, '_blank');
    setOutreachPlayer(null);
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto text-left">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="mb-2">Relacionamento e Marketing</h1>
          <p className="text-muted text-sm">Fidelize seus jogadores nas mesas de cash game e recupere clientes inativos.</p>
        </div>
        
        {/* Module Sub-tabs */}
        <div className="flex bg-card p-1 rounded-xl border border-glass-border w-full md:w-auto">
          <button 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'crm' ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}
            onClick={() => setActiveTab('crm')}
          >
            Fidelização (CRM)
          </button>
          <button 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'templates' ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}
            onClick={() => setActiveTab('templates')}
          >
            Modelos de Mensagem
          </button>
          <button 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'config' ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}
            onClick={() => setActiveTab('config')}
          >
            Ajustes
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><div className="spinner"></div></div>
      ) : (
        <>
          {activeTab === 'crm' && (
            <div className="space-y-6">
              
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div 
                  className={`glass-panel p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-primary border ${filterType === 'active' ? 'border-primary bg-primary bg-opacity-5' : 'border-glass-border'}`}
                  onClick={() => setFilterType(filterType === 'active' ? 'all' : 'active')}
                >
                  <Activity className="text-success mb-2" size={24} />
                  <span className="text-xs text-muted font-bold uppercase tracking-wider mb-1">Jogadores Ativos</span>
                  <span className="text-2xl font-black text-white">{activeCount}</span>
                </div>

                <div 
                  className={`glass-panel p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-primary border ${filterType === 'inactive' ? 'border-primary bg-primary bg-opacity-5' : 'border-glass-border'}`}
                  onClick={() => setFilterType(filterType === 'inactive' ? 'all' : 'inactive')}
                >
                  <AlertCircle className="text-warning mb-2" size={24} />
                  <span className="text-xs text-muted font-bold uppercase tracking-wider mb-1">Jogadores Inativos</span>
                  <span className="text-2xl font-black text-white">{inactiveCount}</span>
                </div>

                <div 
                  className={`glass-panel p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-primary border ${filterType === 'birthday' ? 'border-primary bg-primary bg-opacity-5' : 'border-glass-border'}`}
                  onClick={() => setFilterType(filterType === 'birthday' ? 'all' : 'birthday')}
                >
                  <Calendar className="text-primary mb-2" size={24} />
                  <span className="text-xs text-muted font-bold uppercase tracking-wider mb-1">Niver do Mês</span>
                  <span className="text-2xl font-black text-white">{birthdayCount}</span>
                </div>

                <div 
                  className={`glass-panel p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-primary border ${filterType === 'no_phone' ? 'border-primary bg-primary bg-opacity-5' : 'border-glass-border'}`}
                  onClick={() => setFilterType(filterType === 'no_phone' ? 'all' : 'no_phone')}
                >
                  <Phone className="text-muted mb-2" size={24} />
                  <span className="text-xs text-muted font-bold uppercase tracking-wider mb-1">Sem Telefone</span>
                  <span className="text-2xl font-black text-white">{noPhoneCount}</span>
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="glass-panel p-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
                
                {/* Search box */}
                <div className="input-group mb-0 w-full lg:max-w-xs">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted" size={16} />
                    <input 
                      type="text" 
                      className="input pl-10 py-2 rounded-xl text-sm" 
                      placeholder="Buscar jogador por nome..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Filter chips */}
                <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-start lg:justify-end">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'active', label: 'Ativos' },
                    { key: '30', label: '30 dias+' },
                    { key: '45', label: '45 dias+' },
                    { key: '60', label: '60+ (Crítico)' },
                    { key: '90', label: '90+ (Perdido)' },
                    { key: 'no_phone', label: 'Sem fone' },
                    { key: 'birthday', label: 'Niver' }
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      onClick={() => setFilterType(chip.key as any)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer border ${
                        filterType === chip.key
                          ? 'bg-primary text-white border-primary'
                          : 'bg-dark bg-opacity-40 text-muted border-glass-border hover:text-white'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Players Outreach List */}
              <div className="glass-panel p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-white mb-0" style={{ margin: 0 }}>Resultados ({filteredList.length})</h2>
                  <span className="text-xs text-muted">Período de Inatividade ativo: {inactiveDays} dias</span>
                </div>

                {filteredList.length === 0 ? (
                  <div className="p-16 text-center">
                    <AlertCircle className="mx-auto text-muted mb-4" size={48} opacity={0.3} />
                    <h3 className="text-white mb-1">Nenhum jogador correspondente</h3>
                    <p className="text-muted text-sm" style={{ margin: 0 }}>Tente mudar o filtro ou termo de pesquisa.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredList.map((item) => {
                      const hasNeverVisited = item.totalVisits === 0;
                      const isPlayerInactive = item.totalVisits > 0 && item.daysSinceLastVisit >= inactiveDays;

                      return (
                        <div key={item.player.id} className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors hover:bg-opacity-65">
                          <div className="text-left space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base">{item.player.name}</span>
                              
                              {/* Status Badge */}
                              {hasNeverVisited ? (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 bg-opacity-10 text-blue-400 border border-blue-600 border-opacity-20">Novo</span>
                              ) : isPlayerInactive ? (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-warning bg-opacity-10 text-warning border border-warning border-opacity-20">⚠️ Inativo</span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-success bg-opacity-10 text-success border border-success border-opacity-20">Ativo</span>
                              )}

                              {item.isBirthdayThisMonth && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500 bg-opacity-10 text-purple-400 border border-purple-500 border-opacity-20">🎂 Niver</span>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                              <span><strong>Última visita:</strong> {hasNeverVisited ? 'Nunca' : `${item.lastVisitDate} (${item.daysSinceLastVisit} dias atrás)`}</span>
                              {item.player.phone ? (
                                <span><strong>Telefone:</strong> {item.player.phone}</span>
                              ) : (
                                <span className="text-danger"><strong>Telefone:</strong> Sem cadastro</span>
                              )}
                              <span><strong>Sessões:</strong> {item.totalVisits}</span>
                            </div>
                          </div>

                          {/* Quick details & Outreach CTA button */}
                          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                            <div className="text-right hidden sm:block bg-black bg-opacity-35 py-1.5 px-3 rounded-lg text-xs">
                              <span className="text-muted block text-[9px] font-bold uppercase mb-0.5">Saldo Geral</span>
                              <span className={`font-bold ${item.balance > 0 ? 'text-success' : item.balance < 0 ? 'text-danger' : 'text-white'}`}>
                                {item.balance > 0 ? '+' : ''}R$ {item.balance.toFixed(2)}
                              </span>
                            </div>
                            
                            <div className="flex gap-2">
                              <Link to={`/player/${item.player.id}`} className="btn btn-outline p-2 rounded-xl flex items-center justify-center cursor-pointer" title="Ver Perfil" style={{ width: '36px', height: '36px' }}>
                                <Eye size={16} />
                              </Link>

                              {item.player.phone ? (
                                <button 
                                  onClick={() => handleOpenOutreach(item)}
                                  className="btn btn-primary flex items-center gap-2 py-2 px-3 rounded-xl font-bold text-xs"
                                >
                                  <Phone size={14} /> Enviar WhatsApp
                                </button>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setPhoneEditPlayer(item.player);
                                    setPhoneInput('');
                                  }}
                                  className="btn btn-outline flex items-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs hover:bg-white hover:bg-opacity-5"
                                >
                                  <Phone size={14} /> Cadastrar WhatsApp
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="glass-panel p-6 space-y-8">
              <div>
                <h2>Personalização de Modelos</h2>
                <p className="text-muted text-sm">Edite os modelos de mensagem e use variáveis automáticas para enviar de forma personalizada.</p>
                <div className="p-3 bg-primary bg-opacity-5 border border-primary border-opacity-10 rounded-xl mt-3 flex items-start gap-2 max-w-3xl">
                  <Sparkles className="text-primary flex-shrink-0" size={16} style={{ marginTop: '2px' }} />
                  <p className="text-xs text-muted mb-0 leading-relaxed" style={{ margin: 0 }}>
                    <strong>Dica de Variáveis:</strong> Você pode usar as tags <code>{"{{nome}}"}</code>, <code>{"{{nome_do_clube}}"}</code>, <code>{"{{dias_sem_jogar}}"}</code>, e <code>{"{{ultima_visita}}"}</code> nas mensagens. Elas serão substituídas automaticamente pelos dados reais do jogador correspondente.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Template 1 */}
                <div className="p-5 bg-dark bg-opacity-40 rounded-2xl border border-glass-border flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">Modelo 1: Sentimos sua falta (Campanha Geral)</span>
                  </div>
                  <textarea 
                    className="input w-full p-3 rounded-xl resize-none text-sm font-medium"
                    rows={6}
                    value={templates.template1}
                    onChange={(e) => {
                      const updated = { ...templates, template1: e.target.value };
                      setTemplates(updated);
                      saveMarketingSettings(inactiveDays, marketingClubName, updated);
                    }}
                    style={{ height: 'auto', background: 'rgba(0,0,0,0.2)' }}
                  />
                </div>

                {/* Template 2 */}
                <div className="p-5 bg-dark bg-opacity-40 rounded-2xl border border-glass-border flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">Modelo 2: Consumo por nossa conta (Reativação Crítica)</span>
                  </div>
                  <textarea 
                    className="input w-full p-3 rounded-xl resize-none text-sm font-medium"
                    rows={6}
                    value={templates.template2}
                    onChange={(e) => {
                      const updated = { ...templates, template2: e.target.value };
                      setTemplates(updated);
                      saveMarketingSettings(inactiveDays, marketingClubName, updated);
                    }}
                    style={{ height: 'auto', background: 'rgba(0,0,0,0.2)' }}
                  />
                </div>

                {/* Template 3 */}
                <div className="p-5 bg-dark bg-opacity-40 rounded-2xl border border-glass-border flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">Modelo 3: Convite do Cash Game</span>
                  </div>
                  <textarea 
                    className="input w-full p-3 rounded-xl resize-none text-sm font-medium"
                    rows={6}
                    value={templates.template3}
                    onChange={(e) => {
                      const updated = { ...templates, template3: e.target.value };
                      setTemplates(updated);
                      saveMarketingSettings(inactiveDays, marketingClubName, updated);
                    }}
                    style={{ height: 'auto', background: 'rgba(0,0,0,0.2)' }}
                  />
                </div>

                {/* Template 4 */}
                <div className="p-5 bg-dark bg-opacity-40 rounded-2xl border border-glass-border flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">Modelo 4: Aniversariantes</span>
                  </div>
                  <textarea 
                    className="input w-full p-3 rounded-xl resize-none text-sm font-medium"
                    rows={6}
                    value={templates.template4}
                    onChange={(e) => {
                      const updated = { ...templates, template4: e.target.value };
                      setTemplates(updated);
                      saveMarketingSettings(inactiveDays, marketingClubName, updated);
                    }}
                    style={{ height: 'auto', background: 'rgba(0,0,0,0.2)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="glass-panel p-6 max-w-2xl space-y-6">
              <div>
                <h2>Ajustes do Relacionamento</h2>
                <p className="text-muted text-sm">Defina regras gerais para o funcionamento do módulo de marketing e CRM.</p>
              </div>

              <div className="space-y-4">
                <div className="input-group">
                  <label className="text-xs font-bold text-muted block mb-2">Definição de Inatividade (Dias)</label>
                  <select 
                    className="input rounded-xl text-base py-2.5 cursor-pointer"
                    value={inactiveDays}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setInactiveDays(val);
                      saveMarketingSettings(val, marketingClubName, templates);
                    }}
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="30">30 dias sem jogar</option>
                    <option value="45">45 dias sem jogar</option>
                    <option value="60">60 dias sem jogar</option>
                    <option value="90">90 dias sem jogar</option>
                  </select>
                  <p className="text-[10px] text-muted mt-1" style={{ margin: '0.25rem 0 0 0' }}>
                    Jogadores que excederem esse limite de dias desde a última visita serão marcados com status "Inativo" no sistema.
                  </p>
                </div>

                <div className="input-group">
                  <label className="text-xs font-bold text-muted block mb-2">Nome do Clube Utilizado nas Variáveis</label>
                  <input 
                    type="text" 
                    className="input rounded-xl text-base py-2.5" 
                    placeholder="Masmorra Poker Club"
                    value={marketingClubName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMarketingClubName(val);
                      saveMarketingSettings(inactiveDays, val, templates);
                    }}
                  />
                  <p className="text-[10px] text-muted mt-1" style={{ margin: '0.25rem 0 0 0' }}>
                    Texto que substituirá o marcador <code>{"{{nome_do_clube}}"}</code> nas mensagens.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Outreach Campaign Message Builder Modal */}
      {outreachPlayer && (
        <div className="modal-overlay">
          <div className="modal-content text-left" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2>Enviar Campanha - WhatsApp</h2>
              <button className="close-btn" onClick={() => setOutreachPlayer(null)}>✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-dark bg-opacity-40 border border-glass-border rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted block font-semibold uppercase mb-0.5">Destinatário</span>
                  <span className="font-bold text-white">{outreachPlayer.player.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block font-semibold uppercase mb-0.5 text-right">Telefone</span>
                  <span className="font-bold text-white text-sm">{outreachPlayer.player.phone}</span>
                </div>
              </div>

              {/* Template selector tabs inside modal */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="text-xs font-bold text-muted block mb-2">Selecione o Modelo de Abordagem</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'template1', label: 'Falta' },
                    { key: 'template2', label: 'Copa' },
                    { key: 'template3', label: 'Aviso Cash' },
                    { key: 'template4', label: 'Parabéns' }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleTemplateChange(tab.key as any)}
                      className={`py-2 px-1 text-center rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                        selectedTemplateKey === tab.key
                          ? 'bg-primary text-white border-primary'
                          : 'bg-dark bg-opacity-40 text-muted border-glass-border hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message customizer textbox */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="text-xs font-bold text-muted block mb-2">Mensagem Pronta (Você pode editar livremente antes de enviar)</label>
                <textarea 
                  className="input w-full p-3 rounded-xl resize-none text-xs font-medium leading-relaxed" 
                  rows={8}
                  value={customizedMessage}
                  onChange={(e) => setCustomizedMessage(e.target.value)}
                  style={{ height: 'auto', background: 'rgba(0,0,0,0.2)' }}
                />
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button type="button" className="btn btn-outline" onClick={() => setOutreachPlayer(null)}>
                  Cancelar
                </button>
                <button 
                  onClick={handleSendWhatsApp}
                  className="btn btn-primary flex items-center gap-2 font-bold text-xs"
                >
                  <Send size={14} /> Abrir WhatsApp Web
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline Modal to edit/add phone number */}
      {phoneEditPlayer && (
        <div className="modal-overlay">
          <div className="modal-content text-left" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Cadastrar Telefone</h2>
              <button className="close-btn" onClick={() => setPhoneEditPlayer(null)}>✕</button>
            </div>
            <form onSubmit={handleSavePhone}>
              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label className="text-xs font-bold text-muted block mb-2">Nome do Jogador</label>
                <input 
                  type="text" 
                  className="input text-base py-2.5 rounded-xl bg-black bg-opacity-35 cursor-not-allowed" 
                  value={phoneEditPlayer.name}
                  disabled
                />
              </div>

              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label className="text-xs font-bold text-muted block mb-2">Telefone / WhatsApp *</label>
                <input 
                  type="text" 
                  className="input text-base py-2.5 rounded-xl" 
                  placeholder="(00) 00000-0000"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button type="button" className="btn btn-outline" onClick={() => setPhoneEditPlayer(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!phoneInput.trim()}>
                  Salvar Telefone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
