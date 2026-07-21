import { supabase } from '../lib/supabase';

export interface Club {
  id: string;
  name: string;
  logo_url: string | null;
  beer_price: number;
  energy_price: number;
  created_at?: string;
}

export const clubService = {
  async getClub(clubId: string): Promise<Club | null> {
    const { data, error } = await supabase
      .from('clubs')
      .select('id, name, logo_url, beer_price, energy_price')
      .eq('id', clubId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching club:', error);
      throw error;
    }
    
    // Parse prices as numbers to avoid decimal string rendering issues
    if (data) {
      return {
        ...data,
        beer_price: Number(data.beer_price ?? 5.0),
        energy_price: Number(data.energy_price ?? 8.0)
      };
    }
    return null;
  },

  async updateClub(clubId: string, data: Partial<Omit<Club, 'id' | 'created_at'>>) {
    const { error } = await supabase
      .from('clubs')
      .update(data)
      .eq('id', clubId);

    if (error) {
      console.error('Error updating club:', error);
      throw error;
    }
  },

  async uploadClubLogo(clubId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${clubId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading logo:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName);

    return data.publicUrl;
  }
};

