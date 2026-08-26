import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth.store';

export function useAuth() {
  const store = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      store.setSession(session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        store.setSession(session);
        if (event === 'SIGNED_OUT') {
          store.setSession(null);
        }
      })();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return { ...store, loading };
}
