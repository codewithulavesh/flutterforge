import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import type { Profile } from '@/types';

const supabaseConfigError = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.';

function formatAuthError(error: { message: string; code?: string; status?: number }): string {
  if (error.code === 'invalid_credentials' || error.message.toLowerCase().includes('invalid login credentials')) {
    return 'The email or password is incorrect.';
  }
  if (error.code === 'email_not_confirmed' || error.message.toLowerCase().includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (error.code === 'user_not_found') {
    return 'No account was found for this email. Sign up first.';
  }
  if (error.status === 429) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return error.message;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: false,
  error: null,
  initialized: false,

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    if (!isSupabaseConfigured) {
      set({ loading: false, error: supabaseConfigError });
      return { error: supabaseConfigError };
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      const message = formatAuthError(error);
      set({ loading: false, error: message });
      return { error: message };
    }
    set({ loading: false });
    return { error: null };
  },

  signUp: async (email, password, fullName) => {
    set({ loading: true, error: null });
    if (!isSupabaseConfigured) {
      set({ loading: false, error: supabaseConfigError });
      return { error: supabaseConfigError };
    }
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      const message = formatAuthError(error);
      set({ loading: false, error: message });
      return { error: message };
    }
    set({ loading: false });
    return { error: null };
  },

  signOut: async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    if (!isSupabaseConfigured) {
      set({ loading: false, error: supabaseConfigError });
      return { error: supabaseConfigError };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      const message = formatAuthError(error);
      set({ loading: false, error: message });
      return { error: message };
    }
    set({ loading: false });
    return { error: null };
  },

  setSession: (session) => {
    set({ session, user: session?.user ?? null, initialized: true });
    if (session?.user) {
      get().loadProfile();
    } else {
      set({ profile: null });
    }
  },

  loadProfile: async () => {
    const user = get().user;
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (data) set({ profile: data as Profile });
  },

  clearError: () => set({ error: null }),
}));
