export type TableStatus = 'active' | 'closed';

export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  created_at: string;
  closed_at: string | null;
}

export interface GlobalPlayer {
  id: string;
  name: string;
  created_at: string;
  phone?: string | null;
  birth_date?: string | null;
  notes?: string | null;
}

export interface Player {
  id: string;
  table_id: string;
  name: string;
  created_at: string;
}

export type TransactionType = 'buy_in' | 'cash_out' | 'consumo';

export interface Transaction {
  id: string;
  table_id: string;
  player_id: string;
  type: TransactionType;
  amount: number;
  description?: string;
  created_at: string;
}

export interface PlayerSummary {
  player: Player;
  buyIn: number;
  cashOut: number;
  consumo: number;
  balance: number; // cashOut - buyIn - consumo
}
