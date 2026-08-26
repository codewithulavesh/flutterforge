import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function LoginForm() {
  const navigate = useNavigate();
  const { signIn, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!email || !password) {
      setFormError('Please enter your email and password.');
      return;
    }

    const { error } = await signIn(email, password);
    if (!error) {
      navigate('/dashboard');
    }
  }

  return (
    <AuthLayout>
      <div className="ff-fade-in">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-[var(--ff-text-muted)] mb-8">Sign in to your FlutterForge account</p>

        {(error || formError) && (
          <div className="flex items-center gap-2 px-3 py-2.5 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={16} />
            {formError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={16} />}
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            name="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={16} />}
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[var(--ff-text-muted)]">
              <input type="checkbox" className="rounded border-[var(--ff-border)] bg-[var(--ff-surface-2)]" />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-sm text-[var(--ff-primary)] hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--ff-text-muted)]">
          Don't have an account?{' '}
          <Link to="/signup" className="text-[var(--ff-primary)] hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
