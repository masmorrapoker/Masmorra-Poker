import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { GlobalPlayer, Table, Transaction } from '../types';
import { ArrowLeft, History, DollarSign, TrendingUp, TrendingDown, Coffee } from 'lucide-react';

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [player, setPlayer] = useState<GlobalPlayer | null>(null);
  const [tablesHistory, setTablesHistory] = useState<(Table & { player_table_id: string })[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPlayerProfile();
    }
  }, [id]);

  async function fetchPlayerProfile() {
    try {
      // 1. Get global player
      const { data: globalPlayer, error: pError } = await supabase
        .from('players')
        .select('*')
        .eq('id', id)
        .single();
        
      if (pError) throw pError;
      setPlayer(globalPlayer);

      // 2. Find all table_players entries for this name
      const { data: tablePlayers, error: tpError } = await supabase
        .from('table_players')
        .select('*')
        .eq('name', globalPlayer.name);

      if (tpError) throw tpError;

      if (tablePlayers && tablePlayers.length > 0) {
        const tablePlayerIds = tablePlayers.map(tp => tp.id);
        const tableIds = tablePlayers.map(tp => tp.table_id);

        // 3. Fetch the tables they played at
        const { data: tablesData } = await supabase
          .from('tables')
          .select('*')
          .in('id', tableIds)
          .order('created_at', { ascending: false });

        if (tablesData) {
          const mappedTables = tablesData.map(t => {
            const tp = tablePlayers.find(tp => tp.table_id === t.id);
            return { ...t, player_table_id: tp?.id || '' };
          });
          setTablesHistory(mappedTables);
        }

        // 4. Fetch all their transactions
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .in('player_id', tablePlayerIds);

        if (txData) {
          setTransactions(txData);
        }
      }
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
  
  const balance = totalCashOut - totalBuyIn - totalConsumo;
  const isPositive = balance > 0;
  const isNegative = balance < 0;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <button className="btn btn-outline mb-6" onClick={() => navigate('/players')}>
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="glass-panel mb-8 border-t-4 border-t-primary">
        <h1 className="mb-2">{player.name}</h1>
        <p className="text-muted">Membro desde {new Date(player.created_at).toLocaleDateString('pt-BR')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-panel p-6 flex flex-col justify-center items-center text-center">
          <TrendingDown className="text-warning mb-2" size={32} />
          <p className="text-sm text-muted mb-1">Total Buy-ins</p>
          <p className="text-2xl font-bold text-warning">R$ {totalBuyIn.toFixed(2)}</p>
        </div>
        
        <div className="glass-panel p-6 flex flex-col justify-center items-center text-center">
          <TrendingUp className="text-success mb-2" size={32} />
          <p className="text-sm text-muted mb-1">Total Cash-outs</p>
          <p className="text-2xl font-bold text-success">R$ {totalCashOut.toFixed(2)}</p>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-center items-center text-center">
          <Coffee className="text-danger mb-2" size={32} />
          <p className="text-sm text-muted mb-1">Total Consumo</p>
          <p className="text-2xl font-bold text-danger">R$ {totalConsumo.toFixed(2)}</p>
        </div>

        <div className={`glass-panel p-6 flex flex-col justify-center items-center text-center border ${isPositive ? 'border-success bg-success bg-opacity-5' : isNegative ? 'border-danger bg-danger bg-opacity-5' : 'border-glass-border'}`}>
          <DollarSign className={isPositive ? 'text-success mb-2' : isNegative ? 'text-danger mb-2' : 'text-muted mb-2'} size={32} />
          <p className="text-sm text-muted mb-1">Saldo Final</p>
          <p className={`text-3xl font-bold ${isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-white'}`}>
            {isPositive ? '+' : ''}R$ {balance.toFixed(2)}
          </p>
        </div>
      </div>

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
              const tBalance = tCashOut - tBuyIn - tConsumo;
              
              return (
                <div key={t.id} className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border flex flex-col md:flex-row justify-between md:items-center gap-4 transition-colors hover:bg-opacity-60 cursor-pointer" onClick={() => navigate(`/table/${t.id}`)}>
                  <div>
                    <h3 className="text-lg mb-1">{t.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${t.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                        {t.status === 'active' ? 'Ativa' : 'Fechada'}
                      </span>
                      <span className="text-sm text-muted">
                        {new Date(t.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm bg-black bg-opacity-30 p-3 rounded-lg">
                    <div className="text-center">
                      <p className="text-muted text-xs mb-1">Resultado</p>
                      <p className={`font-bold ${tBalance > 0 ? 'text-success' : tBalance < 0 ? 'text-danger' : 'text-white'}`}>
                        {tBalance > 0 ? '+' : ''}R$ {tBalance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
}
