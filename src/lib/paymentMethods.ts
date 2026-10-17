import { supabase } from './supabase';
import type { PaymentMethod } from '../types';

export type { PaymentMethod };

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'fiado', label: 'Fiado' }
];

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
 * Formas de pagamento e fiado dependem da migração
 * 20261017240000_pagamentos_e_fiado. Até ela ser aplicada no banco, o app
 * esconde esses campos e continua funcionando como antes.
 */
let paymentsAvailable: Promise<boolean> | null = null;

export function hasPaymentFeatures(): Promise<boolean> {
  if (!paymentsAvailable) {
    paymentsAvailable = (async () => {
      const { error } = await supabase.from('transactions').select('payment_method').limit(1);
      return !error;
    })();
  }
  return paymentsAvailable;
}
