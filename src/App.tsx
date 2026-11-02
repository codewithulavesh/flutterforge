import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { PublicOnlyRoute } from '@/app/PublicOnlyRoute';
const LandingPage = lazy(() => import('@/pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import('@/pages/SignupPage').then((module) => ({ default: module.SignupPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const WorkspacePage = lazy(() => import('@/pages/WorkspacePage').then((module) => ({ default: module.WorkspacePage })));
const LegalInfoPage = lazy(() => import('@/pages/LegalInfoPage').then((module) => ({ default: module.LegalInfoPage })));
import { ToastContainer } from '@/components/ui/Toast';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { DesktopMenuBridge } from '@/components/DesktopMenuBridge';

export default function App() {
  const { setSession, initialized } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    // Re-apply persisted theme on boot (store module already applied it at
    // import time — this keeps React state and DOM in sync, no flash).
    const saved = (localStorage.getItem('ff-theme') as 'light' | 'dark' | null) || theme;
    setTheme(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTheme]);

  // Keep the browser chrome in sync with the theme toggle.
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', theme === 'dark' ? '#0a0a0b' : '#FBFADD');
  }, [theme]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(null);
      return;
    }

    let isMounted = true;

    // Safety timeout: if Supabase takes more than 1.5 seconds (e.g. invalid host, DNS failure, or offline),
    // mark initialized as guest so the user is not trapped on the loading screen.
    const timer = setTimeout(() => {
      if (isMounted && !useAuthStore.getState().initialized) {
        console.warn('Supabase auth initialization timed out. Continuing as guest.');
        setSession(null);
      }
    }, 1500);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isMounted) {
          clearTimeout(timer);
          setSession(data?.session ?? null);
        }
      })
      .catch((err) => {
        console.warn('Failed to retrieve Supabase session:', err);
        if (isMounted) {
          clearTimeout(timer);
          setSession(null);
        }
      });

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (isMounted) {
          clearTimeout(timer);
          setSession(session);
          if (event === 'SIGNED_OUT') {
            setSession(null);
          }
        }
      });
      subscription = data?.subscription ?? null;
    } catch (err) {
      console.warn('Failed to subscribe to Supabase auth changes:', err);
    }

    return () => {
      isMounted = false;
      clearTimeout(timer);
      subscription?.unsubscribe();
    };
  }, [setSession]);

  if (!initialized) return <FullPageSpinner label="Loading FlutterForge..." />;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<FullPageSpinner label="Loading FlutterForge..." />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
            <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/project/:projectId" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
            <Route path="/legal/:document" element={<LegalInfoPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <DesktopMenuBridge />
        <ToastContainer />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
