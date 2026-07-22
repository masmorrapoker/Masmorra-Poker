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
