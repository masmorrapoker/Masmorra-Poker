import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { GlobalPlayer } from '../types';
import { Plus, Users, Search, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Players() {
  const [players, setPlayers] = useState<GlobalPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => {
    fetchPlayers();
    
    const channel = supabase
      .channel('public:players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPlayers() {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    try {
      await supabase
        .from('players')
        .insert([{ name: newPlayerName }]);
      
      setIsAdding(false);
      setNewPlayerName('');
    } catch (error) {
      console.error('Error adding player:', error);
    }
  }

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="mb-2">Jogadores Cadastrados</h1>
          <p className="text-muted">Gerencie todos os jogadores do clube e veja seus históricos.</p>
        </div>
        <button className="btn btn-primary shadow-lg" onClick={() => setIsAdding(true)}>
          <Plus size={20} /> Novo Jogador
        </button>
      </div>

      <div className="glass-panel mb-8 p-4">
        <div className="input-group mb-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted" size={20} />
            <input 
              type="text" 
              className="input pl-12 py-3 text-lg" 
              placeholder="Buscar jogador por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><div className="spinner"></div></div>
      ) : players.length === 0 ? (
        <div className="glass-panel text-center p-16">
          <Users className="mx-auto mb-4 text-muted" size={64} opacity={0.3} />
          <h2 className="text-2xl mb-2">Nenhum jogador cadastrado</h2>
          <p className="mb-8 text-muted max-w-md mx-auto">Adicione jogadores para começar a acompanhar o histórico e facilitar a adição nas mesas.</p>
          <button className="btn btn-primary btn-lg" onClick={() => setIsAdding(true)}>
            <Plus size={20} /> Cadastrar Primeiro Jogador
          </button>
        </div>
      ) : (
        <div className="glass-panel p-6">
          {filteredPlayers.length === 0 ? (
            <div className="p-12 text-center text-muted text-lg">
              Nenhum jogador encontrado com o nome "<span className="text-white">{searchTerm}</span>"
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlayers.map(player => (
                <Link 
                  key={player.id} 
                  to={`/player/${player.id}`}
                  className="group p-5 bg-dark bg-opacity-40 rounded-2xl flex items-center justify-between border border-glass-border hover:border-primary hover:bg-opacity-80 transition-all no-underline text-white shadow-sm hover:shadow-primary hover:shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{player.name}</span>
                    <span className="text-xs text-muted">Desde {new Date(player.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white bg-opacity-5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <ChevronRight size={18} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdding && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Cadastrar Novo Jogador</h2>
              <button className="close-btn" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <form onSubmit={addPlayer}>
              <div className="input-group">
                <label>Nome do Jogador</label>
                <input 
                  type="text" 
                  className="input text-lg py-3" 
                  placeholder="Nome completo ou apelido"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-4 mt-8">
                <button type="button" className="btn btn-outline" onClick={() => setIsAdding(false)}>
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
