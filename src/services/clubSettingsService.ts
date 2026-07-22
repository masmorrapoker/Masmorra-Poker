import { supabase } from '../lib/supabase';

export interface ClubSettings {
  club_id: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  opening_time: string;
  closing_time: string;
  business_days: string[];
  default_buyin: number;
  default_rebuy: number;
  currency: string;
  welcome_message: string;
  primary_color: string;
  custom_products: any[];
  marketing_inactive_days: number;
  marketing_club_name: string | null;
  marketing_templates: Record<string, string>;
}

export const clubSettingsService = {
  async getSettings(clubId: string): Promise<ClubSettings> {
    const { data, error } = await supabase
      .from('club_settings')
      .select('*')
      .eq('club_id', clubId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }

    if (data) {
      return {
        ...data,
        default_buyin: Number(data.default_buyin ?? 200),
        default_rebuy: Number(data.default_rebuy ?? 200),
        business_days: data.business_days || ['segunda', 'terca', 'quinta'],
        custom_products: data.custom_products || [],
        marketing_inactive_days: Number(data.marketing_inactive_days ?? 30),
        marketing_templates: data.marketing_templates || {}
      };
    }

    // Default settings to insert if not exist yet
    const defaults = {
      club_id: clubId,
      email: '',
      phone: '',
      instagram: '',
      address: '',
      city: '',
      state: '',
      opening_time: '20:00',
      closing_time: '04:00',
      business_days: ['segunda', 'terca', 'quinta'],
      default_buyin: 200,
      default_rebuy: 200,
      currency: 'R$',
      welcome_message: 'Bem-vindo ao Masmorra Manager',
      primary_color: '#3b82f6',
      custom_products: [
        { id: '1', name: 'Água', category: 'Bebidas', price: 0, active: true },
        { id: '2', name: 'Água com gás', category: 'Bebidas', price: 0, active: true },
        { id: '3', name: 'Coca-Cola', category: 'Bebidas', price: 5.0, active: true },
        { id: '4', name: 'Coca-Cola Zero', category: 'Bebidas', price: 5.0, active: true },
        { id: '5', name: 'Cerveja', category: 'Bebidas', price: 5.0, active: true },
        { id: '6', name: 'Energético', category: 'Bebidas', price: 8.0, active: true },
      ],
      marketing_inactive_days: 30,
      marketing_club_name: '',
      marketing_templates: {
        template1: "Olá, {{nome}}!\n\nSentimos sua falta. Percebemos que faz um tempinho que você não aparece por aqui.\n\nPara te ver novamente nas mesas, preparamos um bônus especial de 10% no seu próximo buy-in.\n\nEsperamos você!\n\n♠ {{nome_do_clube}}",
        template2: "Olá, {{nome}}!\n\nNa sua próxima visita você ganha uma bebida por nossa conta.\n\nEsperamos você!\n\n♠ {{nome_do_clube}}",
        template3: "Olá, {{nome}}!\n\nHoje teremos Cash Game a partir das 20h. Sua cadeira está te esperando!\n\nEsperamos você!\n\n♠ {{nome_do_clube}}",
        template4: "Feliz aniversário, {{nome}}!\n\nComo presente do {{nome_do_clube}}, você ganhou um bônus especial para utilizar na sua próxima visita. Parabéns!\n\nEsperamos você!"
      }
    };

    const { data: inserted, error: insertError } = await supabase
      .from('club_settings')
      .insert(defaults)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating default settings:', insertError);
      throw insertError;
    }

    return {
      ...inserted,
      default_buyin: Number(inserted.default_buyin ?? 200),
      default_rebuy: Number(inserted.default_rebuy ?? 200),
      business_days: inserted.business_days || ['segunda', 'terca', 'quinta'],
      custom_products: inserted.custom_products || [],
      marketing_inactive_days: Number(inserted.marketing_inactive_days ?? 30),
      marketing_templates: inserted.marketing_templates || {}
    };
  },

  async updateSettings(clubId: string, data: Partial<Omit<ClubSettings, 'club_id'>>) {
    const { error } = await supabase
      .from('club_settings')
      .update(data)
      .eq('club_id', clubId);

    if (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }
};
