import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { FullPageSpinner } from '@/components/ui/Spinner';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, initialized } = useAuthStore();

  if (!initialized) return <FullPageSpinner label="Loading..." />;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
