import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowRight, ArrowUpRight } from 'lucide-react';
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
      <div className="ffb-auth-card ff-fade-in">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--fb-line)] px-5 py-3.5 sm:px-7">
          <span className="inline-flex items-center gap-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-[var(--fb-muted)]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--fb-lime)]" />
            Sign in
          </span>
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--fb-dim)] transition-colors hover:text-[var(--fb-ink)]"
          >
            Home
            <ArrowUpRight size={11} aria-hidden />
          </Link>
        </div>

        <div className="p-5 sm:p-7">
          <h1 className="ffb-display ffb-caps text-[clamp(30px,6.4vw,42px)] leading-[0.9] tracking-[-0.035em] text-[var(--fb-ink)]">
            Welcome back
          </h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--fb-muted)]">
            Sign in to your FlutterForge account.
          </p>

          {(error || formError) && (
            <div role="alert" className="ffb-auth-alert mt-5">
              <AlertCircle size={15} className="mt-px shrink-0" aria-hidden />
              <span>{formError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-[18px]">
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

            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="inline-flex min-h-9 items-center font-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--fb-muted)] underline decoration-[var(--fb-line)] underline-offset-4 transition-colors hover:text-[var(--fb-ink)] hover:decoration-[var(--fb-ink)]"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} className="h-12 w-full font-semibold">
              Sign in
            </Button>
          </form>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--fb-line)] bg-[var(--fb-soft)] px-5 py-3.5 sm:px-7">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fb-muted)]">
            New here?
          </span>
          <Link
            to="/signup"
            className="group inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-semibold text-[var(--fb-ink)]"
          >
            Create an account
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
