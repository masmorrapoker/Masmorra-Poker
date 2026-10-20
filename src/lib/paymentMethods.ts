import { supabase } from './supabase';
import type { PaymentMethod } from '../types';

export type { PaymentMethod };

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'fiado', label: 'Fiado' }
];

/** Como o jogador que saiu perdendo pagou o acerto. */
export const SETTLE_IN_METHODS = PAYMENT_METHODS.filter(m => m.value !== 'fiado');
/** Como o clube pagou o jogador que saiu ganhando. */
export const SETTLE_OUT_METHODS = PAYMENT_METHODS.filter(m => m.value === 'dinheiro' || m.value === 'pix');

export const paymentLabel = (m: string | null | undefined) =>
  PAYMENT_METHODS.find(p => p.value === m)?.label ?? 'Não informado';

export type SettlementMethod = 'dinheiro' | 'pix' | 'cartao' | 'abatido_cashout';

export const SETTLEMENT_METHODS: { value: SettlementMethod; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'abatido_cashout', label: 'Abatido no cash-out' }
];

export const settlementLabel = (m: string) =>
  SETTLEMENT_METHODS.find(p => p.value === m)?.label ?? m;

/**
 * Acerto na saída e fiado dependem das migrações 20261017240000_pagamentos_e_fiado
 * e 20261020160000_acerto_na_saida. Até elas serem aplicadas no banco, o app
 * esconde esses campos e continua funcionando como antes.
 */
let paymentsAvailable: Promise<boolean> | null = null;

export function hasPaymentFeatures(): Promise<boolean> {
  if (!paymentsAvailable) {
    paymentsAvailable = (async () => {
      const { error } = await supabase.from('transactions').select('payment_method, fiado_amount').limit(1);
      return !error;
    })();
  }
  return paymentsAvailable;
}
