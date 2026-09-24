import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!supabaseClient) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseClient = createClient(url, key);
  }

  return supabaseClient;
};

export const supabase = {
  auth: {
    signUp: async (params: { email: string; password: string; options?: any }) => {
      return getSupabase().auth.signUp(params);
    },
    signInWithPassword: async (params: { email: string; password: string }) => {
      return getSupabase().auth.signInWithPassword(params);
    },
    signOut: async () => {
      return getSupabase().auth.signOut();
    },
    getSession: async () => {
      return getSupabase().auth.getSession();
    },
    onAuthStateChange: (callback: any) => {
      return getSupabase().auth.onAuthStateChange(callback);
    },
    resetPasswordForEmail: async (email: string, options?: { redirectTo?: string }) => {
      return getSupabase().auth.resetPasswordForEmail(email, options);
    },
    updateUser: async (params: { password?: string; email?: string }) => {
      return getSupabase().auth.updateUser(params);
    },
    setSession: async (accessToken: string, refreshToken: string) => {
      return getSupabase().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    },
  },
  from: (table: string) => {
    return getSupabase().from(table);
  },
};