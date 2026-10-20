import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import type { GlobalPlayer, Player, Table, Transaction } from '../types';
import { AlertTriangle, ArrowLeft, Cake, History, Calendar, Phone, Edit3, HandCoins, Trophy } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { playerService } from '../services/playerService';
import { fiadoService } from '../services/fiadoService';
import { hasPaymentFeatures } from '../lib/paymentMethods';
import { aggregatePlayers, buildSessions } from '../lib/playerStats';
import { formatNight } from '../lib/nightMath';
import { formatMoney, formatDate, formatPhone } from '../utils';
import { LOCAL_STORAGE_KEYS } from '../constants';
import { triggerHaptic } from '../utils/haptic';
import { toast } from '../components/Toast';

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clubId } = useClub();

  const [player, setPlayer] = useState<GlobalPlayer | null>(null);
  const [tablesHistory, setTablesHistory] = useState<(Table & { player_table_id: string })[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tablePlayers, setTablePlayers] = useState<Player[]>([]);
  const [fiado, setFiado] = useState(0);
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
      toast.success('Perfil atualizado com sucesso!');
      triggerHaptic('success');
      setIsEditing(false);
    } catch(err) {
      toast.error('Erro ao salvar alterações.');
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
      setTablePlayers(data.tablePlayers);
      if (await hasPaymentFeatures()) setFiado(await fiadoService.getPlayerBalance(clubId, id));
    } catch (error) {
      console.error('Error fetching player profile:', error);
    } finally {
      setLoading(false);
    }
  }

  // Uma sessão por mesa (linhas repetidas do mesmo jogador na mesma mesa são somadas)
  const sessions = useMemo(
    () => (player ? buildSessions(tablesHistory, tablePlayers, transactions, [player]) : [])
      .sort((a, b) => new Date(b.table.created_at).getTime() - new Date(a.table.created_at).getTime()),
    [player, tablesHistory, tablePlayers, transactions]
  );
  const stats = useMemo(() => aggregatePlayers(sessions)[0] ?? null, [sessions]);

  if (loading) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;
  if (!player) return <div className="container text-center p-20">Jogador não encontrado.</div>;

  const balance = stats?.result ?? 0;
  const tone = (v: number) => (v > 0 ? 'text-success' : v < 0 ? 'text-danger' : 'text-white');
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`;
  const birthdayIn = (() => {
    if (!player.birth_date) return null;
    const [, m, d] = player.birth_date.split('-').map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let next = new Date(today.getFullYear(), m - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
    return Math.round((next.getTime() - today.getTime()) / 86400000);
  })();

  return (
    <div className="animate-fade-in max-w-4xl mx-auto mobile-view-padding">
      <button className="btn btn-outline mb-6 desktop-only" onClick={() => navigate('/players')}>
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="glass-panel mb-8 border-t-4 border-t-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="mb-2">{player.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-sm text-muted">
            <span>Membro desde {formatDate(player.created_at)}</span>
            {player.phone && <span className="flex items-center gap-1"><Phone size={13} aria-hidden="true" /> {player.phone}</span>}
            {player.birth_date && (
              <span className={`flex items-center gap-1 ${birthdayIn !== null && birthdayIn <= 7 ? 'text-warning font-bold' : ''}`}>
                <Cake size={13} aria-hidden="true" /> {formatDate(player.birth_date + 'T12:00:00').slice(0, 5)}
                {birthdayIn === 0 ? ' · aniversário hoje' : birthdayIn !== null && birthdayIn <= 30 ? ` · em ${birthdayIn} dia${birthdayIn === 1 ? '' : 's'}` : ''}
              </span>
            )}
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

      {fiado > 0.005 && (
        <Link
          to="/fiado"
          className="glass-panel mb-6 p-4 flex items-center justify-between gap-3 border border-warning border-opacity-25 no-underline"
        >
          <span className="flex items-center gap-2 text-sm text-warning font-bold">
            <HandCoins size={18} /> Fiado em aberto
          </span>
          <span className="text-lg font-black text-warning">{formatMoney(fiado)}</span>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-3">
        <div className={`glass-panel p-4 md:p-5 text-left border ${balance > 0 ? 'border-success' : balance < 0 ? 'border-danger' : 'border-glass-border'}`}>
          <p className="text-xs text-muted mb-1">Resultado total</p>
          <p className={`text-xl md:text-2xl font-black mb-0 ${tone(balance)}`}>{signed(balance)}</p>
        </div>
        <div className="glass-panel p-4 md:p-5 text-left">
          <p className="text-xs text-muted mb-1">Noites jogadas</p>
          <p className="text-xl md:text-2xl font-black text-white mb-0">{stats?.nights ?? 0}</p>
        </div>
        <div className="glass-panel p-4 md:p-5 text-left">
          <p className="text-xs text-muted mb-1">Noites no lucro</p>
          <p className="text-xl md:text-2xl font-black text-white mb-0">
            {stats?.winRate != null ? `${Math.round(stats.winRate * 100)}%` : '—'}
          </p>
        </div>
        <div className="glass-panel p-4 md:p-5 text-left">
          <p className="text-xs text-muted mb-1">Consumo total</p>
          <p className="text-xl md:text-2xl font-black text-white mb-0">{formatMoney(stats?.consumo ?? 0)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-8 text-left">
        <div className="p-4 rounded-xl bg-black bg-opacity-20 border border-glass-border flex justify-between gap-3">
          <dt className="text-xs text-muted">Maior prêmio numa noite</dt>
          <dd className={`text-sm font-bold ${tone(stats?.bestNight ?? 0)}`}>{stats && stats.bestNight > 0 ? signed(stats.bestNight) : '—'}</dd>
        </div>
        <div className="p-4 rounded-xl bg-black bg-opacity-20 border border-glass-border flex justify-between gap-3">
          <dt className="text-xs text-muted">Maior perda numa noite</dt>
          <dd className={`text-sm font-bold ${tone(stats?.worstNight ?? 0)}`}>{stats && stats.worstNight < 0 ? signed(stats.worstNight) : '—'}</dd>
        </div>
        <div className="p-4 rounded-xl bg-black bg-opacity-20 border border-glass-border flex justify-between gap-3">
          <dt className="text-xs text-muted">Buy-in médio por noite</dt>
          <dd className="text-sm font-bold text-white">{stats && stats.nights > 0 ? formatMoney(stats.buyIn / stats.nights) : '—'}</dd>
        </div>
      </dl>

      <Link to="/ranking" className="text-xs text-primary font-bold flex items-center gap-1.5 mb-8 no-underline">
        <Trophy size={14} /> Ver ranking do clube
      </Link>

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
                  <span className="text-xs font-bold text-warning block mb-1 flex items-center gap-1.5"><AlertTriangle size={14} /> Jogador inativo</span>
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
          <h2>Histórico de mesas ({sessions.length})</h2>
        </div>

        {sessions.length === 0 ? (
          <p className="text-muted text-center py-6">Este jogador ainda não participou de nenhuma mesa.</p>
        ) : (
          <ul className="space-y-3">
            {sessions.map(sess => (
              <li key={sess.table.id}>
                <Link
                  to={`/table/${sess.table.id}`}
                  className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border flex justify-between items-center gap-4 hover:border-primary no-underline"
                >
                  <span className="min-w-0 text-left">
                    <span className="text-sm font-bold text-white block truncate">{sess.table.name}</span>
                    <span className="text-xs text-muted block capitalize">{formatNight(sess.night)}</span>
                    <span className="text-xs text-muted block">
                      Buy-in {formatMoney(sess.buyIn)} · Cash-out {formatMoney(sess.cashOut)}
                      {sess.consumo > 0 && ` · Consumo ${formatMoney(sess.consumo)}`}
                    </span>
                    {sess.fiado > 0 && <span className="text-xs text-warning font-bold block">Ficou devendo {formatMoney(sess.fiado)}</span>}
                  </span>
                  <span className="text-right flex-shrink-0">
                    {sess.finished ? (
                      <span className={`text-base font-extrabold ${tone(sess.result)}`}>{signed(sess.result)}</span>
                    ) : (
                      <span className="badge badge-active">Jogando</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {isEditing && (
          <div className="modal-overlay animate-fade-in">
            <div className="modal-content mobile-bottom-sheet max-w-lg">
              {/* Mobile Drag Indicator */}
              <div className="w-12 h-1 bg-glass-border rounded-full mx-auto mb-4 md:hidden" onClick={() => setIsEditing(false)} />
              
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

                <div className="flex flex-col md:flex-row gap-4 mt-8">
                  <button type="submit" className="btn btn-primary w-full md:w-auto active:scale-95 transition-transform" disabled={!editName.trim()}>
                    Salvar Alterações
                  </button>
                  <button type="button" className="btn btn-outline w-full md:w-auto" onClick={() => setIsEditing(false)}>
                    Cancelar
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
