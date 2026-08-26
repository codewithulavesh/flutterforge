import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ForgotPasswordForm() {
  const navigate = useNavigate();
  const { resetPassword, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!email) {
      setFormError('Please enter your email address.');
      return;
    }

    const { error } = await resetPassword(email);
    if (!error) {
      setSent(true);
    }
  }

  return (
    <AuthLayout>
      <div className="ff-fade-in">
        <Link to="/login" className="flex items-center gap-1.5 text-sm text-[var(--ff-text-muted)] hover:text-white mb-6 transition-colors">
          <ArrowLeft size={16} />
          Back to sign in
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Reset password</h1>
        <p className="text-[var(--ff-text-muted)] mb-8">
          Enter your email and we'll send you a reset link.
        </p>

        {(error || formError) && (
          <div className="flex items-center gap-2 px-3 py-2.5 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={16} />
            {formError || error}
          </div>
        )}

        {sent ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <p className="text-[var(--ff-text)] text-center">
              Check your email for a reset link.
            </p>
            <Button variant="outline" onClick={() => navigate('/login')}>
              Return to sign in
            </Button>
          </div>
        ) : (
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
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Send Reset Link
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
