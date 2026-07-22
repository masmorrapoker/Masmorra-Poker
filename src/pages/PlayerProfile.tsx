import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { GlobalPlayer, Table, Transaction } from '../types';
import { ArrowLeft, History, DollarSign, TrendingUp, TrendingDown, Coffee, Calendar, Phone, Edit3 } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { playerService } from '../services/playerService';
import { formatMoney, formatDate, formatPhone, calculatePlayerBalance } from '../utils';
import { LOCAL_STORAGE_KEYS } from '../constants';

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clubId } = useClub();

  const [player, setPlayer] = useState<GlobalPlayer | null>(null);
  const [tablesHistory, setTablesHistory] = useState<(Table & { player_table_id: string })[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { clubName } = useClub();

  // Edit profile states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const handleStartEdit = () => {
    if (!player) return;
    setEditName(player.name);
    setEditPhone(player.phone || '');
    setEditBirthDate(player.birth_date || '');
    setEditNotes(player.notes || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !clubId || !editName.trim()) return;
    try {
      const updated = await playerService.updatePlayer(clubId, id, {
        name: editName,
        phone: editPhone.trim() || null,
        birth_date: editBirthDate || null,
        notes: editNotes.trim() || null
      });
      setPlayer(updated);
      setIsEditing(false);
    } catch(err) {
      console.error('Error saving player edits:', err);
    }
  };

  useEffect(() => {
    if (id && clubId) {
      fetchPlayerProfile();
    }
  }, [id, clubId]);

  async function fetchPlayerProfile() {
    if (!id || !clubId) return;
    try {
      const data = await playerService.getPlayerProfile(clubId, id);
      setPlayer(data.player);
      setTablesHistory(data.tablesHistory);
      setTransactions(data.transactions);
    } catch (error) {
      console.error('Error fetching player profile:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;
  if (!player) return <div className="container text-center p-20">Jogador não encontrado.</div>;

  // Calculate totals
  const totalBuyIn = transactions.filter(tx => tx.type === 'buy_in').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalCashOut = transactions.filter(tx => tx.type === 'cash_out').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalConsumo = transactions.filter(tx => tx.type === 'consumo').reduce((sum, tx) => sum + Number(tx.amount), 0);
  
  const balance = calculatePlayerBalance(totalBuyIn, totalCashOut, totalConsumo);
  const isPositive = balance > 0;
  const isNegative = balance < 0;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <button className="btn btn-outline mb-6 desktop-only" onClick={() => navigate('/players')}>
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="glass-panel mb-8 border-t-4 border-t-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="mb-2">{player.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-sm text-muted">
            <span>Membro desde {formatDate(player.created_at)}</span>
            {player.phone && <span>• 📞 {player.phone}</span>}
            {player.birth_date && <span>• 🎂 Aniversário: {formatDate(player.birth_date + 'T12:00:00')}</span>}
          </div>
          {player.notes && (
            <div className="mt-4 p-3 bg-black bg-opacity-35 rounded-xl text-sm border border-glass-border">
              <span className="text-[10px] text-muted block mb-1 font-bold uppercase tracking-wider">Observações</span>
              <p className="mb-0 text-white text-opacity-90 leading-relaxed" style={{ margin: 0 }}>{player.notes}</p>
            </div>
          )}
        </div>
        <button className="btn btn-outline flex items-center gap-2" onClick={handleStartEdit}>
          <Edit3 size={16} /> Editar Perfil
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div className="glass-panel p-4 md:p-6 flex flex-col justify-center items-center text-center">
          <TrendingDown className="text-warning mb-2 animate-fade-in" size={28} />
          <p className="text-xs md:text-sm text-muted mb-1">Total Buy-ins</p>
          <p className="text-lg md:text-2xl font-bold text-warning">{formatMoney(totalBuyIn)}</p>
        </div>
        
        <div className="glass-panel p-4 md:p-6 flex flex-col justify-center items-center text-center">
          <TrendingUp className="text-success mb-2 animate-fade-in" size={28} />
          <p className="text-xs md:text-sm text-muted mb-1">Total Cash-outs</p>
          <p className="text-lg md:text-2xl font-bold text-success">{formatMoney(totalCashOut)}</p>
        </div>

        <div className="glass-panel p-4 md:p-6 flex flex-col justify-center items-center text-center">
          <Coffee className="text-danger mb-2 animate-fade-in" size={28} />
          <p className="text-xs md:text-sm text-muted mb-1">Total Consumo</p>
          <p className="text-lg md:text-2xl font-bold text-danger">{formatMoney(totalConsumo)}</p>
        </div>

        <div className={`glass-panel p-4 md:p-6 flex flex-col justify-center items-center text-center border ${isPositive ? 'border-success bg-success bg-opacity-5' : isNegative ? 'border-danger bg-danger bg-opacity-5' : 'border-glass-border'}`}>
          <DollarSign className={isPositive ? 'text-success mb-2' : isNegative ? 'text-danger mb-2' : 'text-muted mb-2'} size={28} />
          <p className="text-xs md:text-sm text-muted mb-1">Saldo Final</p>
          <p className={`text-xl md:text-3xl font-bold ${isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-white'}`}>
            {isPositive ? '+' : ''}{formatMoney(balance)}
          </p>
        </div>
      </div>

      {/* Análise de Relacionamento Section */}
      {(() => {
        let firstVisit = 'Nunca visitou';
        let lastVisit = 'Nunca visitou';
        let daysWithoutPlaying = 0;
        let averageFrequency = 'Sem dados';
        
        if (tablesHistory.length > 0) {
          const oldestSession = tablesHistory[tablesHistory.length - 1];
          const newestSession = tablesHistory[0];
          
          firstVisit = new Date(oldestSession.created_at).toLocaleDateString('pt-BR');
          lastVisit = new Date(newestSession.created_at).toLocaleDateString('pt-BR');
          
          daysWithoutPlaying = Math.floor((Date.now() - new Date(newestSession.created_at).getTime()) / (1000 * 60 * 60 * 24));
          
          if (tablesHistory.length >= 2) {
            const oldestTime = new Date(oldestSession.created_at).getTime();
            const newestTime = new Date(newestSession.created_at).getTime();
            const diffDays = Math.ceil((newestTime - oldestTime) / (1000 * 60 * 60 * 24));
            const avg = diffDays / (tablesHistory.length - 1);
            averageFrequency = avg <= 1 ? 'Diário' : `A cada ${avg.toFixed(1)} dias`;
          } else {
            averageFrequency = 'Apenas 1 visita';
          }
        }

        let inactiveThreshold = 30;
        try {
          const saved = localStorage.getItem('masmorra_marketing_settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.inactiveDays) inactiveThreshold = Number(parsed.inactiveDays);
          }
        } catch(e) {}

        const isInactive = tablesHistory.length > 0 && daysWithoutPlaying >= inactiveThreshold;

        return (
          <div className="glass-panel mb-8 border border-glass-border">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="text-primary" size={24} />
              <h2>Análise de Relacionamento</h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border">
                <span className="text-[10px] text-muted block mb-1 font-bold uppercase tracking-wider">Última Visita</span>
                <span className="text-base font-bold text-white block">
                  {tablesHistory.length > 0 ? `${lastVisit} (${daysWithoutPlaying} dias atrás)` : 'Nunca visitou'}
                </span>
              </div>

              <div className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border">
                <span className="text-[10px] text-muted block mb-1 font-bold uppercase tracking-wider">Primeira Visita</span>
                <span className="text-base font-bold text-white block">{firstVisit}</span>
              </div>

              <div className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border">
                <span className="text-[10px] text-muted block mb-1 font-bold uppercase tracking-wider">Frequência Média</span>
                <span className="text-base font-bold text-white block">{averageFrequency}</span>
              </div>

              <div className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border">
                <span className="text-[10px] text-muted block mb-1 font-bold uppercase tracking-wider">Total de Sessões</span>
                <span className="text-base font-bold text-white block">{tablesHistory.length} visitas</span>
              </div>
            </div>

            {/* Inactivity warning & action */}
            {isInactive && (
              <div className="p-5 bg-warning bg-opacity-5 border border-warning border-opacity-20 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="text-left">
                  <span className="text-xs font-bold text-warning uppercase block mb-1">⚠️ Jogador Inativo</span>
                  <p className="text-sm text-white mb-0" style={{ margin: 0 }}>
                    Este jogador está há <strong>{daysWithoutPlaying} dias</strong> sem visitar o clube.
                  </p>
                  <p className="text-xs text-muted mt-1 mb-0" style={{ margin: 0 }}>
                    Recomendação: Enviar campanha de reativação para trazê-lo de volta às mesas.
                  </p>
                </div>
                {player.phone ? (
                  <button 
                    onClick={() => {
                      let marketingName = clubName || 'Masmorra Manager';
                      try {
                        const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.MARKETING_SETTINGS);
                        if (saved) {
                          const parsed = JSON.parse(saved);
                          if (parsed.clubName) marketingName = parsed.clubName;
                        }
                      } catch(e) {}
                      
                      const text = `Olá, ${player.name}!\n\nSentimos sua falta. Percebemos que faz um tempinho que você não aparece por aqui.\n\nPara te ver novamente nas mesas, preparamos um bônus especial de 10% no seu próximo buy-in.\n\nEsperamos você!\n\n♠ ${marketingName}`;
                      const cleanedPhone = formatPhone(player.phone);
                      window.open(`https://wa.me/${cleanedPhone}?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className="btn btn-warning flex items-center gap-2 w-full md:w-auto font-bold text-xs"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <Phone size={14} /> Enviar WhatsApp
                  </button>
                ) : (
                  <span className="text-xs text-muted font-medium bg-black bg-opacity-35 px-3 py-2 rounded-xl">
                    Sem telefone cadastrado para reativação
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <div className="glass-panel">
        <div className="flex items-center gap-2 mb-6">
          <History className="text-primary" size={24} />
          <h2>Histórico de Mesas ({tablesHistory.length})</h2>
        </div>

        {tablesHistory.length === 0 ? (
          <p className="text-muted text-center py-6">Este jogador ainda não participou de nenhuma mesa.</p>
        ) : (
          <div className="space-y-4">
            {tablesHistory.map(t => {
              const tableTxs = transactions.filter(tx => tx.player_id === t.player_table_id);
              const tBuyIn = tableTxs.filter(tx => tx.type === 'buy_in').reduce((sum, tx) => sum + Number(tx.amount), 0);
              const tCashOut = tableTxs.filter(tx => tx.type === 'cash_out').reduce((sum, tx) => sum + Number(tx.amount), 0);
              const tConsumo = tableTxs.filter(tx => tx.type === 'consumo').reduce((sum, tx) => sum + Number(tx.amount), 0);
              const tBalance = calculatePlayerBalance(tBuyIn, tCashOut, tConsumo);
              
              return (
                <div key={t.id} className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border flex flex-col md:flex-row justify-between md:items-center gap-4 transition-colors hover:bg-opacity-60 cursor-pointer" onClick={() => navigate(`/table/${t.id}`)}>
                  <div>
                    <h3 className="text-lg mb-1">{t.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${t.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                        {t.status === 'active' ? 'Ativa' : 'Fechada'}
                      </span>
                      <span className="text-sm text-muted">
                        {formatDate(t.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm bg-black bg-opacity-30 p-3 rounded-lg">
                    <div className="text-center">
                      <p className="text-muted text-xs mb-1">Resultado</p>
                      <p className={`font-bold ${tBalance > 0 ? 'text-success' : tBalance < 0 ? 'text-danger' : 'text-white'}`}>
                        {tBalance > 0 ? '+' : ''}{formatMoney(tBalance)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {isEditing && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2>Editar Perfil de Jogador</h2>
                <button className="close-btn" onClick={() => setIsEditing(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveEdit}>
                <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="text-xs font-bold text-muted block mb-2">Nome do Jogador *</label>
                  <input 
                    type="text" 
                    className="input text-base py-2.5 rounded-xl" 
                    placeholder="Nome completo ou apelido"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="text-xs font-bold text-muted block mb-2">Telefone / WhatsApp (Opcional)</label>
                    <input 
                      type="text" 
                      className="input text-base py-2.5 rounded-xl" 
                      placeholder="(00) 00000-0000"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="text-xs font-bold text-muted block mb-2">Data de Nascimento (Opcional)</label>
                    <input 
                      type="date" 
                      className="input text-base py-2.5 rounded-xl" 
                      value={editBirthDate}
                      onChange={(e) => setEditBirthDate(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="text-xs font-bold text-muted block mb-2">Observações / Notas (Opcional)</label>
                  <textarea 
                    className="input text-base py-2.5 rounded-xl resize-none" 
                    placeholder="Informações adicionais do jogador (ex: prefere jogar PLO, cliente VIP)"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    style={{ height: 'auto' }}
                  />
                </div>

                <div className="flex justify-end gap-4 mt-8">
                  <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={!editName.trim()}>
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
