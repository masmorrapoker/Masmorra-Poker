import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClub } from '../contexts/ClubContext';
import { tableService } from '../services/tableService';
import { playerService } from '../services/playerService';
import { transactionService } from '../services/transactionService';
import type { Table, GlobalPlayer, Transaction } from '../types';
import { 
  Plus, Users, MessageSquare, Calendar, 
  ChevronRight, Clock, UserPlus, ArrowRight, Sparkles
} from 'lucide-react';
import { formatMoney } from '../utils';

export default function Inicio() {
  const navigate = useNavigate();
  const { clubId, clubName } = useClub();

  // Data states
  const [tables, setTables] = useState<Table[]>([]);
  const [tablePlayers, setTablePlayers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [globalPlayers, setGlobalPlayers] = useState<GlobalPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');

  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [newPlayerBirthDate, setNewPlayerBirthDate] = useState('');
  const [newPlayerNotes, setNewPlayerNotes] = useState('');

  // Quotes state
  const [quote, setQuote] = useState('');

  const MOTIVATIONAL_QUOTES = [
    "Grandes noites começam com uma boa mesa.",
    "Tudo pronto para receber seus jogadores.",
    "Boa sorte nas mesas.",
    "Gestão eficiente gera resultados consistentes.",
    "Segurança e controle em cada ficha jogada.",
    "Fidelize seus clientes proporcionando a melhor experiência."
  ];

  useEffect(() => {
    const idx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    setQuote(MOTIVATIONAL_QUOTES[idx]);
  }, []);

  useEffect(() => {
    if (clubId) {
      fetchDashboardData();
    }
  }, [clubId]);

  async function fetchDashboardData() {
    if (!clubId) return;
    try {
      setLoading(true);
      const [tablesData, tpData, txData, gPlayers] = await Promise.all([
        tableService.getTables(clubId),
        playerService.getAllTablePlayers(clubId),
        transactionService.getAllTransactions(clubId),
        playerService.getPlayers(clubId)
      ]);
      setTables(tablesData || []);
      setTablePlayers(tpData || []);
      setTransactions(txData || []);
      setGlobalPlayers(gPlayers || []);
    } catch(err) {
      console.error('Error fetching Inicio data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Date helper
  const getTodayLongDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const str = new Date().toLocaleDateString('pt-BR', options);
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Actions
  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault();
    if (!newTableName.trim() || !clubId) return;
    try {
      const data = await tableService.createTable(clubId, newTableName);
      setIsCreatingTable(false);
      setNewTableName('');
      navigate(`/table/${data.id}`);
    } catch (error) {
      console.error('Error creating table:', error);
    }
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlayerName.trim() || !clubId) return;
    try {
      await playerService.createPlayer(
        clubId,
        newPlayerName,
        newPlayerPhone.trim() || null,
        newPlayerBirthDate || null,
        newPlayerNotes.trim() || null
      );
      setIsAddingPlayer(false);
      setNewPlayerName('');
      setNewPlayerPhone('');
      setNewPlayerBirthDate('');
      setNewPlayerNotes('');
      fetchDashboardData(); // reload
    } catch (error) {
      console.error('Error adding player:', error);
    }
  }

  // Compilers for feed segments
  const lastTables = [...tables]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const getTablePlayersCount = (tableId: string) => {
    return tablePlayers.filter(tp => tp.table_id === tableId).length;
  };

  // Unique active players from sessions
  const activeSessions = [...tablePlayers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const uniqueNames: string[] = [];
  const recentPlayers: { name: string; lastPlayed: string; id?: string }[] = [];

  for (const sess of activeSessions) {
    if (!uniqueNames.includes(sess.name) && uniqueNames.length < 5) {
      uniqueNames.push(sess.name);
      const gp = globalPlayers.find(g => g.name === sess.name);
      const diffDays = Math.floor((Date.now() - new Date(sess.created_at).getTime()) / (1000 * 60 * 60 * 24));
      
      let relative = 'Jogou hoje';
      if (diffDays === 1) relative = 'Jogou ontem';
      else if (diffDays > 1) relative = `Jogou há ${diffDays} dias`;

      recentPlayers.push({
        name: sess.name,
        lastPlayed: relative,
        id: gp?.id
      });
    }
  }

  // Recent timeline items (buyin, cashout, consumption, closed table)
  const timelineItems: {
    id: string;
    date: Date;
    type: 'buy_in' | 'cash_out' | 'consumo' | 'table_closed';
    playerName?: string;
    tableName?: string;
    amount?: number;
    description?: string;
  }[] = [];

  transactions.forEach(tx => {
    const playerSession = tablePlayers.find(tp => tp.id === tx.player_id);
    timelineItems.push({
      id: tx.id,
      date: new Date(tx.created_at),
      type: tx.type as any,
      playerName: playerSession?.name || 'Jogador',
      amount: Number(tx.amount),
      description: tx.description || ''
    });
  });

  tables.forEach(t => {
    if (t.status === 'closed' && t.closed_at) {
      timelineItems.push({
        id: t.id,
        date: new Date(t.closed_at),
        type: 'table_closed',
        tableName: t.name,
        description: 'encerrada'
      });
    }
  });

  timelineItems.sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentActivity = timelineItems.slice(0, 5);

  const formatActivityTime = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      const hour = date.getHours().toString().padStart(2, '0');
      const min = date.getMinutes().toString().padStart(2, '0');
      return `Hoje às ${hour}:${min}`;
    }
    if (diffDays === 1) return 'Ontem';
    return date.toLocaleDateString('pt-BR');
  };

  const formatRelativeDay = (dateStr: string) => {
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    
    // Day of the week
    const weekday = new Date(dateStr).toLocaleDateString('pt-BR', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  };

  return (
    <div className="container animate-fade-in text-left max-w-7xl mx-auto px-4 py-2">
      {/* Header operations banner */}
      <div className="glass-panel border-l-4 border-l-primary mb-8 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
        <div>
          <span className="text-primary font-bold text-xs uppercase tracking-widest">{getGreeting()},</span>
          <h1 className="text-2xl md:text-3xl font-black text-white mt-1 leading-tight mb-2">
            Bem-vindo ao Masmorra Manager.
          </h1>
          <p className="text-muted text-sm leading-relaxed max-w-xl">
            Bem-vindo novamente ao <strong className="text-white">{clubName || 'Masmorra Poker Club'}</strong>. Tudo pronto para mais uma noite de poker.
          </p>
        </div>
        <div className="flex items-center gap-2.5 bg-black bg-opacity-40 py-2.5 px-4 rounded-xl border border-glass-border">
          <Clock className="text-primary" size={16} />
          <span className="text-xs text-muted font-semibold">{getTodayLongDate()}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><div className="spinner"></div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Operations Main Column (Left and Center) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Quick Actions Actions Card Grid */}
            <div>
              <h2 className="text-base font-bold text-white mb-4 uppercase tracking-wider text-opacity-80">Ações Rápidas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                <div 
                  onClick={() => setIsCreatingTable(true)}
                  className="glass-panel p-6 cursor-pointer border border-glass-border hover:border-primary bg-dark bg-opacity-40 hover:bg-opacity-80 transition-all flex items-center gap-5 active:scale-[0.98] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(59,130,246,0.12)] group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary bg-opacity-10 text-primary flex items-center justify-center flex-shrink-0 transition-all group-hover:bg-primary group-hover:text-white">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base mb-1 group-hover:text-primary transition-colors">Nova Mesa</h3>
                    <p className="text-xs text-muted leading-relaxed">Inicie uma nova mesa de Cash Game.</p>
                  </div>
                </div>

                <div 
                  onClick={() => setIsAddingPlayer(true)}
                  className="glass-panel p-6 cursor-pointer border border-glass-border hover:border-success bg-dark bg-opacity-40 hover:bg-opacity-80 transition-all flex items-center gap-5 active:scale-[0.98] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.12)] group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-success bg-opacity-10 text-success flex items-center justify-center flex-shrink-0 transition-all group-hover:bg-success group-hover:text-white">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base mb-1 group-hover:text-success transition-colors">Cadastrar Jogador</h3>
                    <p className="text-xs text-muted leading-relaxed">Adicione novos jogadores ao clube.</p>
                  </div>
                </div>

                <div 
                  onClick={() => navigate('/players')}
                  className="glass-panel p-6 cursor-pointer border border-glass-border hover:border-blue-400 bg-dark bg-opacity-40 hover:bg-opacity-80 transition-all flex items-center gap-5 active:scale-[0.98] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(96,165,250,0.12)] group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-500 bg-opacity-10 text-blue-400 flex items-center justify-center flex-shrink-0 transition-all group-hover:bg-blue-400 group-hover:text-white">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base mb-1 group-hover:text-blue-400 transition-colors">Lista de Jogadores</h3>
                    <p className="text-xs text-muted leading-relaxed">Visualize todos os jogadores cadastrados.</p>
                  </div>
                </div>

                <div 
                  onClick={() => navigate('/relationship')}
                  className="glass-panel p-6 cursor-pointer border border-glass-border hover:border-warning bg-dark bg-opacity-40 hover:bg-opacity-80 transition-all flex items-center gap-5 active:scale-[0.98] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(245,158,11,0.12)] group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-warning bg-opacity-10 text-warning flex items-center justify-center flex-shrink-0 transition-all group-hover:bg-warning group-hover:text-white">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base mb-1 group-hover:text-warning transition-colors">Relacionamento</h3>
                    <p className="text-xs text-muted leading-relaxed">Veja jogadores inativos e envie campanhas.</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Last Tables Feed */}
            <div>
              <h2 className="text-base font-bold text-white mb-4 uppercase tracking-wider text-opacity-80">Últimas Mesas Realizadas</h2>
              <div className="glass-panel p-6 text-left">
                {lastTables.length === 0 ? (
                  <div className="py-12 text-center bg-black bg-opacity-20 rounded-2xl border border-glass-border">
                    <p className="text-muted text-sm mb-4">Nenhuma mesa criada ainda.</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setIsCreatingTable(true)}>
                      Criar primeira mesa
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lastTables.map(t => (
                      <div 
                        key={t.id} 
                        className="p-4 bg-black bg-opacity-25 rounded-2xl border border-glass-border hover:bg-opacity-40 transition-all flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h4 className="text-white font-bold text-sm mb-0">{t.name}</h4>
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${
                              t.status === 'active' 
                                ? 'bg-success bg-opacity-10 text-success border-success border-opacity-25' 
                                : 'bg-white bg-opacity-5 text-muted border-white border-opacity-10'
                            }`}>
                              {t.status === 'active' ? 'Ativa' : 'Fechada'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted mt-2">
                            <span>{formatRelativeDay(t.created_at)}</span>
                            <span className="opacity-45">•</span>
                            <span>{getTablePlayersCount(t.id)} jogadores</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => navigate(`/table/${t.id}`)}
                          className="btn btn-outline btn-sm flex items-center gap-1.5 py-2 px-4 rounded-xl font-bold text-xs"
                        >
                          Abrir <ArrowRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Operations Sidebar Column (Right) */}
          <div className="space-y-8">
            
            {/* Last Active Players */}
            <div>
              <h2 className="text-base font-bold text-white mb-4 uppercase tracking-wider text-opacity-80">Últimos Jogadores</h2>
              <div className="glass-panel p-6 text-left">
                {recentPlayers.length === 0 ? (
                  <p className="text-muted text-xs text-center py-4">Nenhuma atividade recente.</p>
                ) : (
                  <div className="space-y-3.5">
                    {recentPlayers.map((player, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => player.id && navigate(`/player/${player.id}`)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border border-glass-border bg-black bg-opacity-25 hover:bg-opacity-40 transition-all ${player.id ? 'cursor-pointer hover:border-primary hover:shadow-[0_0_12px_rgba(59,130,246,0.08)]' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary bg-opacity-10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {player.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="text-left">
                            <p className="text-white font-bold text-xs leading-normal">{player.name}</p>
                            <p className="text-muted text-[10px] leading-normal mt-0.5">{player.lastPlayed}</p>
                          </div>
                        </div>
                        {player.id && <ChevronRight className="text-muted opacity-65" size={16} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent activity timeline log feed */}
            <div>
              <h2 className="text-base font-bold text-white mb-4 uppercase tracking-wider text-opacity-80">Atividade Recente</h2>
              <div className="glass-panel p-6 text-left">
                {recentActivity.length === 0 ? (
                  <p className="text-muted text-xs text-center py-4">Nenhum evento registrado hoje.</p>
                ) : (
                  <div className="relative border-l border-glass-border pl-5 ml-2.5 space-y-6">
                    {recentActivity.map((act) => {
                      const isBuyIn = act.type === 'buy_in';
                      const isCashOut = act.type === 'cash_out';
                      const isConsumo = act.type === 'consumo';
                      const isClosed = act.type === 'table_closed';

                      return (
                        <div key={act.id} className="relative text-left">
                          {/* Timeline Node Point with outer glow */}
                          <div className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-dark flex items-center justify-center ${
                            isBuyIn ? 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                            isCashOut ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                            isConsumo ? 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                            'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                          }`} />
                          
                          <div>
                            <p className="text-[10px] text-muted leading-tight font-semibold mb-1">{formatActivityTime(act.date)}</p>
                            <p className="text-xs text-white leading-relaxed">
                              {isBuyIn && (
                                <><strong>{act.playerName}</strong> realizou Buy-in de <strong className="text-warning">{formatMoney(act.amount)}</strong></>
                              )}
                              {isCashOut && (
                                <><strong>{act.playerName}</strong> realizou Cash-out de <strong className="text-success">{formatMoney(act.amount)}</strong></>
                              )}
                              {isConsumo && (
                                <><strong>{act.playerName}</strong> consumiu <strong className="text-danger">{act.description || 'Consumo'}</strong></>
                              )}
                              {isClosed && (
                                <>Mesa <strong className="text-primary">{act.tableName}</strong> encerrada</>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Next Scheduled Event Event Card */}
            <div>
              <h2 className="text-base font-bold text-white mb-4 uppercase tracking-wider text-opacity-80">Eventos</h2>
              <div className="glass-panel p-6 text-left relative overflow-hidden">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-white">Próximo Torneio</span>
                  <Calendar className="text-muted" size={18} />
                </div>
                <div className="p-4 bg-black bg-opacity-25 rounded-xl border border-glass-border text-center">
                  <p className="text-xs text-muted mb-0">Nenhum evento agendado.</p>
                  <span className="btn btn-outline btn-sm pointer-events-none mt-3 text-[10px] font-extrabold uppercase py-1 px-3">
                    Em breve
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Random quote footer section */}
      <div className="mt-8 text-center text-xs text-muted italic flex items-center justify-center gap-1.5 py-6 opacity-60 border-t border-glass-border max-w-xl mx-auto">
        <Sparkles size={12} className="text-primary" />
        <span>"{quote}"</span>
      </div>

      {/* Add Modals Layout */}
      {isCreatingTable && (
        <div className="modal-overlay">
          <div className="modal-content text-left" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Criar Nova Mesa</h2>
              <button className="close-btn" onClick={() => setIsCreatingTable(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTable}>
              <div className="input-group">
                <label className="text-xs font-bold text-muted block mb-2">Nome ou Número da Mesa</label>
                <input 
                  type="text" 
                  className="input rounded-xl text-base py-2.5" 
                  placeholder="Ex: Mesa 1, VIP, PLO5..."
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setIsCreatingTable(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newTableName.trim()}>
                  Criar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingPlayer && (
        <div className="modal-overlay">
          <div className="modal-content text-left" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Cadastrar Novo Jogador</h2>
              <button className="close-btn" onClick={() => setIsAddingPlayer(false)}>✕</button>
            </div>
            <form onSubmit={handleAddPlayer}>
              <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                <label className="text-xs font-bold text-muted block mb-2">Nome do Jogador *</label>
                <input 
                  type="text" 
                  className="input text-base py-2.5 rounded-xl" 
                  placeholder="Nome completo ou apelido"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="text-xs font-bold text-muted block mb-2">Telefone / WhatsApp (Opcional)</label>
                  <input 
                    type="text" 
                    className="input text-base py-2.5 rounded-xl" 
                    placeholder="(00) 00000-0000"
                    value={newPlayerPhone}
                    onChange={(e) => setNewPlayerPhone(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="text-xs font-bold text-muted block mb-2">Data de Nascimento (Opcional)</label>
                  <input 
                    type="date" 
                    className="input text-base py-2.5 rounded-xl" 
                    value={newPlayerBirthDate}
                    onChange={(e) => setNewPlayerBirthDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label className="text-xs font-bold text-muted block mb-2">Observações / Notas (Opcional)</label>
                <textarea 
                  className="input text-base py-2.5 rounded-xl resize-none" 
                  placeholder="Informações adicionais do jogador (ex: prefere jogar PLO, cliente VIP)"
                  value={newPlayerNotes}
                  onChange={(e) => setNewPlayerNotes(e.target.value)}
                  rows={3}
                  style={{ height: 'auto' }}
                />
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button type="button" className="btn btn-outline" onClick={() => setIsAddingPlayer(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newPlayerName.trim()}>
                  Salvar Jogador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
