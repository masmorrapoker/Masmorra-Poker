import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Table, Player, Transaction, PlayerSummary, GlobalPlayer } from '../types';
import { UserPlus, Coffee, XCircle, ArrowDownCircle, ArrowUpCircle, Search, UserCheck } from 'lucide-react';

export default function TableDetail() {
  const { id } = useParams<{ id: string }>();
  
  const [table, setTable] = useState<Table | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [globalPlayers, setGlobalPlayers] = useState<GlobalPlayer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    type: 'buy_in' | 'cash_out' | 'consumo';
    playerId: string;
  }>({ isOpen: false, type: 'buy_in', playerId: '' });
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isClosingTable, setIsClosingTable] = useState(false);

  const CONSUMO_ITEMS = [
    { name: 'Água', price: 0 },
    { name: 'Água com gás', price: 0 },
    { name: 'Coca-Cola', price: 0 },
    { name: 'Coca-Cola Zero', price: 0 },
    { name: 'Cerveja', price: 5 },
    { name: 'Energético', price: 8 },
  ];

  useEffect(() => {
    if (id) {
      fetchTableData();
      fetchGlobalPlayers();
      
      const tablesSub = supabase
        .channel(`table_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `id=eq.${id}` }, () => fetchTableData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${id}` }, () => fetchTableData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `table_id=eq.${id}` }, () => fetchTableData())
        .subscribe();

      const playersSub = supabase
        .channel('public:players')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchGlobalPlayers())
        .subscribe();

      return () => {
        supabase.removeChannel(tablesSub);
        supabase.removeChannel(playersSub);
      };
    }
  }, [id]);

  async function fetchTableData() {
    try {
      const [tableRes, playersRes, txRes] = await Promise.all([
        supabase.from('tables').select('*').eq('id', id).single(),
        supabase.from('table_players').select('*').eq('table_id', id).order('created_at', { ascending: true }),
        supabase.from('transactions').select('*').eq('table_id', id).order('created_at', { ascending: false })
      ]);

      if (tableRes.data) setTable(tableRes.data);
      if (playersRes.data) setPlayers(playersRes.data);
      if (txRes.data) setTransactions(txRes.data);
    } catch (error) {
      console.error('Error fetching table data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGlobalPlayers() {
    const { data } = await supabase.from('players').select('*').order('name', { ascending: true });
    if (data) setGlobalPlayers(data);
  }

  async function addPlayerToTable(name: string) {
    if (!name.trim() || !id) return;
    
    try {
      // 1. Check if global player exists or create
      let globalPlayer = globalPlayers.find(p => p.name.toLowerCase() === name.toLowerCase());
      
      if (!globalPlayer) {
        const { data, error } = await supabase.from('players').insert([{ name }]).select().single();
        if (error) throw error;
        globalPlayer = data;
      }

      // 2. Add to table if globalPlayer is found or created
      if (globalPlayer) {
        await supabase.from('table_players').insert([{
          table_id: id,
          name: globalPlayer.name
        }]);
      }
      
      setIsAddingPlayer(false);
      setPlayerSearchTerm('');
    } catch (error) {
      console.error('Error adding player:', error);
    }
  }

  async function saveTransaction(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount < 0 || !id || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await supabase.from('transactions').insert([{
        table_id: id,
        player_id: transactionModal.playerId,
        type: transactionModal.type,
        amount: amount,
        description: txDescription || (transactionModal.type === 'consumo' ? 'Consumo Manual' : undefined)
      }]);
      setTransactionModal({ isOpen: false, type: 'buy_in', playerId: '' });
      setTxAmount('');
      setTxDescription('');
    } catch (error) {
      console.error('Error saving transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function registerConsumo(itemName: string, amount: number) {
    if (!id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await supabase.from('transactions').insert([{
        table_id: id,
        player_id: transactionModal.playerId,
        type: 'consumo',
        amount: amount,
        description: itemName
      }]);
      setTransactionModal({ isOpen: false, type: 'buy_in', playerId: '' });
      setTxAmount('');
      setTxDescription('');
    } catch (error) {
      console.error('Error saving consumo:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteTransaction(txId: string) {
    if (!window.confirm('Tem certeza que deseja remover esta transação?')) return;
    try {
      await supabase.from('transactions').delete().eq('id', txId);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  }

  async function closeTable() {
    if (!id) return;
    try {
      await supabase.from('tables').update({
        status: 'closed',
        closed_at: new Date().toISOString()
      }).eq('id', id);
      setIsClosingTable(false);
    } catch (error) {
      console.error('Error closing table:', error);
    }
  }

  // Calculate results
  const playerSummaries: PlayerSummary[] = players.map(player => {
    const playerTxs = transactions.filter(tx => tx.player_id === player.id);
    const buyIn = playerTxs.filter(tx => tx.type === 'buy_in').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const cashOut = playerTxs.filter(tx => tx.type === 'cash_out').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const consumo = playerTxs.filter(tx => tx.type === 'consumo').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const balance = cashOut - buyIn - consumo;
    return { player, buyIn, cashOut, consumo, balance };
  });

  const totalBuyIn = playerSummaries.reduce((sum, p) => sum + p.buyIn, 0);
  const totalCashOut = playerSummaries.reduce((sum, p) => sum + p.cashOut, 0);
  const totalConsumo = playerSummaries.reduce((sum, p) => sum + p.consumo, 0);
  const rakeTableTotal = totalBuyIn - totalCashOut; 

  const availablePlayersToAdd = globalPlayers.filter(
    gp => !players.some(tp => tp.name === gp.name) && gp.name.toLowerCase().includes(playerSearchTerm.toLowerCase())
  );
  
  const showCreateOption = playerSearchTerm.trim().length > 0 && 
    !globalPlayers.some(gp => gp.name.toLowerCase() === playerSearchTerm.toLowerCase());

  if (loading) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;
  if (!table) return <div className="container text-center p-20">Mesa não encontrada.</div>;

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <div className="glass-panel mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="mb-2">{table.name}</h1>
          <div className="flex items-center gap-2">
             <span className={`badge ${table.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
               {table.status === 'active' ? 'Ativa' : 'Fechada'}
             </span>
             {table.status === 'closed' && table.closed_at && (
               <span className="text-sm text-muted">
                 Fechada em: {new Date(table.closed_at).toLocaleString('pt-BR')}
               </span>
             )}
          </div>
        </div>
        
        {table.status === 'active' && (
          <button className="btn btn-danger" onClick={() => setIsClosingTable(true)}>
            <XCircle size={20} /> Fechar Mesa
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Players Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel">
            <div className="flex justify-between items-center mb-6">
              <h2>Jogadores na Mesa</h2>
              {table.status === 'active' && (
                <button className="btn btn-success" onClick={() => setIsAddingPlayer(true)}>
                  <UserPlus size={18} /> Adicionar
                </button>
              )}
            </div>

            {players.length === 0 ? (
              <p className="text-muted text-center py-6">Nenhum jogador na mesa ainda.</p>
            ) : (
              <div className="space-y-4">
                {playerSummaries.map(summary => (
                  <div key={summary.player.id} className="glass-panel p-4 flex flex-col md:flex-row justify-between items-center bg-opacity-40">
                    <div className="mb-4 md:mb-0 text-center md:text-left flex-1">
                      <h3 className="mb-1">{summary.player.name}</h3>
                      <div className="flex flex-wrap gap-4 text-sm justify-center md:justify-start mb-2">
                        <span className="text-warning font-medium">In: R$ {summary.buyIn.toFixed(2)}</span>
                        <span className="text-success font-medium">Out: R$ {summary.cashOut.toFixed(2)}</span>
                        <span className="text-danger font-medium">Consumo: R$ {summary.consumo.toFixed(2)}</span>
                      </div>
                      {table.status === 'active' && (
                        <div className="text-sm border-t border-white border-opacity-10 pt-2 mt-2 inline-block">
                          <span className="text-muted mr-2">Resultado parcial:</span>
                          <span className={`font-bold ${summary.balance > 0 ? 'text-success' : summary.balance < 0 ? 'text-danger' : 'text-white'}`}>
                            {summary.balance > 0 ? '+' : ''}R$ {summary.balance.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {table.status === 'active' && (
                      <div className="flex flex-wrap gap-2 justify-center md:justify-end mt-4 md:mt-0">
                        <button 
                          className="btn btn-outline border-warning text-warning hover:bg-warning hover:text-white px-3 py-2 text-sm"
                          onClick={() => setTransactionModal({ isOpen: true, type: 'buy_in', playerId: summary.player.id })}
                        >
                          <ArrowDownCircle size={16} /> Buy-in
                        </button>
                        <button 
                          className="btn btn-outline border-success text-success hover:bg-success hover:text-white px-3 py-2 text-sm"
                          onClick={() => setTransactionModal({ isOpen: true, type: 'cash_out', playerId: summary.player.id })}
                        >
                          <ArrowUpCircle size={16} /> Cash-out
                        </button>
                        <button 
                          className="btn btn-outline border-danger text-danger hover:bg-danger hover:text-white px-3 py-2 text-sm"
                          onClick={() => setTransactionModal({ isOpen: true, type: 'consumo', playerId: summary.player.id })}
                        >
                          <Coffee size={16} /> Consumo
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Results Summary if Closed */}
          {table.status === 'closed' && (
            <div className="glass-panel border-success">
              <h2 className="text-success mb-6">Resultado Final da Mesa</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-white border-opacity-10">
                      <th className="p-3">Jogador</th>
                      <th className="p-3">Buy-in</th>
                      <th className="p-3">Cash-out</th>
                      <th className="p-3">Consumo</th>
                      <th className="p-3 text-right">Resultado Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerSummaries.map(summary => (
                      <tr key={summary.player.id} className="border-b border-white border-opacity-5">
                        <td className="p-3 font-bold">{summary.player.name}</td>
                        <td className="p-3">R$ {summary.buyIn.toFixed(2)}</td>
                        <td className="p-3">R$ {summary.cashOut.toFixed(2)}</td>
                        <td className="p-3">R$ {summary.consumo.toFixed(2)}</td>
                        <td className={`p-3 text-right font-bold ${summary.balance > 0 ? 'text-success' : summary.balance < 0 ? 'text-danger' : ''}`}>
                          R$ {summary.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 pt-4 border-t border-white border-opacity-10 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted">Total Buy-ins</p>
                  <p className="text-xl text-warning">R$ {totalBuyIn.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Total Cash-outs</p>
                  <p className="text-xl text-success">R$ {totalCashOut.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Total Consumo</p>
                  <p className="text-xl text-danger">R$ {totalConsumo.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted">Lucro da Mesa (Rake)</p>
                  <p className="text-xl text-primary font-bold">R$ {rakeTableTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Real-time Transactions feed */}
        <div className="glass-panel h-max max-h-[80vh] overflow-y-auto">
          <h2 className="mb-4">Transações</h2>
          {transactions.length === 0 ? (
            <p className="text-muted text-sm">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map(tx => {
                const player = players.find(p => p.id === tx.player_id);
                const isBuyIn = tx.type === 'buy_in';
                const isCashOut = tx.type === 'cash_out';
                return (
                  <div key={tx.id} className="p-3 rounded-lg bg-black bg-opacity-20 border border-white border-opacity-5">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm">{player?.name || 'Desconhecido'}</span>
                      <span className={`text-sm font-bold ${isBuyIn ? 'text-warning' : isCashOut ? 'text-success' : 'text-danger'}`}>
                        {isBuyIn ? '+' : isCashOut ? '-' : ''} R$ {Number(tx.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted">
                      <div className="flex items-center gap-2">
                        <span>
                          {isBuyIn ? 'Buy-in' : isCashOut ? 'Cash-out' : tx.description || 'Consumo'}
                        </span>
                        <span>•</span>
                        <span>{new Date(tx.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      {table.status === 'active' && (
                        <button 
                          className="text-muted hover:text-danger p-1 rounded transition-colors bg-white bg-opacity-0 hover:bg-opacity-10 cursor-pointer"
                          onClick={() => deleteTransaction(tx.id)}
                          title="Remover transação"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Player Modal */}
      {isAddingPlayer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header mb-4">
              <h2>Adicionar Jogador</h2>
              <button className="close-btn" onClick={() => setIsAddingPlayer(false)}>✕</button>
            </div>
            
            <div className="input-group mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={20} />
                <input 
                  type="text" 
                  className="input pl-10" 
                  placeholder="Buscar ou adicionar novo..."
                  value={playerSearchTerm}
                  onChange={(e) => setPlayerSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
              {availablePlayersToAdd.map(gp => (
                <button 
                  key={gp.id}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-dark bg-opacity-50 text-white hover:bg-primary hover:text-white transition-colors border border-glass-border text-left cursor-pointer"
                  onClick={() => addPlayerToTable(gp.name)}
                >
                  <span className="font-medium">{gp.name}</span>
                  <UserCheck size={18} opacity={0.5} />
                </button>
              ))}
              
              {showCreateOption && (
                <button 
                  className="w-full flex items-center gap-2 p-3 rounded-xl border border-primary text-primary hover:bg-primary hover:text-white transition-colors text-left cursor-pointer"
                  onClick={() => addPlayerToTable(playerSearchTerm)}
                >
                  <UserPlus size={18} />
                  <span className="font-medium">Cadastrar "{playerSearchTerm}"</span>
                </button>
              )}

              {availablePlayersToAdd.length === 0 && !showCreateOption && (
                <div className="text-center text-muted p-4">
                  Todos os jogadores filtrados já estão na mesa.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 mt-2">
              <button type="button" className="btn btn-outline w-full" onClick={() => setIsAddingPlayer(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {transactionModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                Registrar {transactionModal.type === 'buy_in' ? 'Buy-in' : transactionModal.type === 'cash_out' ? 'Cash-out' : 'Consumo'}
              </h2>
              <button className="close-btn" onClick={() => {
                setTransactionModal({ isOpen: false, type: 'buy_in', playerId: '' });
                setTxAmount('');
                setTxDescription('');
              }}>✕</button>
            </div>

            {transactionModal.type === 'consumo' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  {CONSUMO_ITEMS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => registerConsumo(item.name, item.price)}
                      className="p-4 rounded-xl bg-dark bg-opacity-50 text-white border border-glass-border hover:border-primary hover:bg-primary hover:bg-opacity-20 transition-all text-left flex flex-col gap-1 cursor-pointer"
                    >
                      <span className="font-bold">{item.name}</span>
                      <span className="text-sm text-primary">{item.price === 0 ? 'Grátis' : `R$ ${item.price.toFixed(2)}`}</span>
                    </button>
                  ))}
                </div>
                
                <div className="border-t border-glass-border pt-6">
                  <p className="text-sm text-muted mb-3 font-medium">Ou registrar consumo manual:</p>
                  <form onSubmit={saveTransaction} className="flex flex-col gap-3">
                    <div className="input-group mb-0">
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="Descrição (ex: Sanduíche)"
                        value={txDescription}
                        onChange={(e) => setTxDescription(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3 items-end">
                      <div className="input-group mb-0 flex-1">
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          className="input" 
                          placeholder="Valor (R$)"
                          value={txAmount}
                          onChange={(e) => setTxAmount(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary h-max py-3" disabled={!txAmount || isNaN(Number(txAmount)) || Number(txAmount) < 0 || isSubmitting}>
                        {isSubmitting ? '...' : 'Lançar'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <form onSubmit={saveTransaction}>
                <div className="input-group">
                  <label>Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="input text-xl" 
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 mb-6">
                  {[50, 100, 200, 500].map(val => (
                    <button 
                      key={val} 
                      type="button"
                      className="btn btn-outline flex-1 py-2 text-sm"
                      onClick={() => {
                        setTxAmount(val.toString());
                      }}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                  <button type="button" className="btn btn-outline" onClick={() => {
                    setTransactionModal({ isOpen: false, type: 'buy_in', playerId: '' });
                    setTxAmount('');
                    setTxDescription('');
                  }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={!txAmount || isNaN(Number(txAmount)) || Number(txAmount) <= 0 || isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isClosingTable && (
        <div className="modal-overlay">
          <div className="modal-content border-danger">
            <div className="modal-header">
              <h2 className="text-danger">Atenção!</h2>
            </div>
            <p className="mb-6">
              Tem certeza que deseja fechar esta mesa? Isso irá calcular os resultados finais e não será mais possível adicionar transações.
            </p>
            <div className="flex justify-end gap-4">
              <button type="button" className="btn btn-outline" onClick={() => setIsClosingTable(false)}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={closeTable}>Sim, Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
