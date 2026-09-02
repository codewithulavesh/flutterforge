import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { PublicOnlyRoute } from '@/app/PublicOnlyRoute';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { WorkspacePage } from '@/pages/WorkspacePage';
import { ToastContainer } from '@/components/ui/Toast';
import { FullPageSpinner } from '@/components/ui/Spinner';

export default function App() {
  const { setSession, initialized } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    const saved = (localStorage.getItem('ff-theme') as 'light' | 'dark' | null) || theme;
    setTheme(saved);
  }, [setTheme]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(null);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setSession(session);
        if (event === 'SIGNED_OUT') {
          setSession(null);
        }
      })();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [setSession]);

  if (!initialized) return <FullPageSpinner label="Loading FlutterForge..." />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/project/:projectId" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
