import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function SignupForm() {
  const navigate = useNavigate();
  const { signUp, loading, error, clearError, session } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    clearError();

    if (!fullName || !email || !password) {
      setFormError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    const { error } = await signUp(email, password, fullName);
    if (!error) {
      if (session) {
        navigate('/dashboard');
      } else {
        setSuccessMessage('Account created. Check your email to confirm your account, then sign in.');
      }
    }
  }

  return (
    <AuthLayout>
      <div className="ff-fade-in">
        <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
        <p className="text-[var(--ff-text-muted)] mb-8">Start building Flutter apps with AI</p>

        {(error || formError) && (
          <div className="flex items-center gap-2 px-3 py-2.5 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={16} />
            {formError || error}
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 px-3 py-2.5 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            name="fullName"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={<User size={16} />}
            autoComplete="name"
          />
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
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={16} />}
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--ff-text-muted)]">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--ff-primary)] hover:underline font-medium">
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-[var(--ff-text-dim)]">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </AuthLayout>
  );
}
