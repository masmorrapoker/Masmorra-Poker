/**
 * Formats a numeric value into Brazilian Real (R$) currency representation.
 */
export const formatMoney = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined) return 'R$ 0,00';
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return `R$ ${numeric.toFixed(2)}`;
};

/**
 * Formats an ISO date string into Brazilian Portuguese date local.
 */
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

/**
 * Formats an ISO date string into Brazilian Portuguese date-time local.
 */
export const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('pt-BR');
};

/**
 * Normalizes a phone string, pre-pending Brazilian country code (55) if necessary.
 */
export const formatPhone = (phoneStr: string | null | undefined): string => {
  if (!phoneStr) return '';
  let cleaned = phoneStr.replace(/\D/g, '');
  if (cleaned.length === 11 && !cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
};

/**
 * Calculates the number of days between now and the provided date string.
 */
export const getDaysSinceLastVisit = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 9999;
  const timeDiff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
};

/**
 * Dynamically computes player cash-game net balance.
 */
export const calculatePlayerBalance = (
  buyIn: number | string,
  cashOut: number | string,
  consumo: number | string
): number => {
  const b = typeof buyIn === 'number' ? buyIn : parseFloat(buyIn) || 0;
  const c = typeof cashOut === 'number' ? cashOut : parseFloat(cashOut) || 0;
  const co = typeof consumo === 'number' ? consumo : parseFloat(consumo) || 0;
  return c - b - co;
};

/**
 * Erro de nome duplicado (índice único players_club_nome_unico no banco).
 */
export const isDuplicateNameError = (error: unknown): boolean => {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === '23505' || (e?.message ?? '').includes('players_club_nome_unico');
};

/**
 * Erro disparado pelo banco quando a mesa já foi encerrada.
 */
export const isClosedTableError = (error: unknown): boolean => {
  const e = error as { message?: string } | null;
  return (e?.message ?? '').includes('Mesa encerrada');
};

/**
 * Compara um registro de jogador-na-mesa com um cadastro.
 * Usa o vínculo por ID quando existe; nome só para registros antigos sem vínculo.
 */
export const isSamePlayer = (
  tablePlayer: { player_id?: string | null; name: string },
  player: { id: string; name: string }
): boolean =>
  tablePlayer.player_id ? tablePlayer.player_id === player.id : tablePlayer.name === player.name;
