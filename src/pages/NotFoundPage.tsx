import { Link } from 'react-router-dom';

/** 404 catch-all: unknown URLs get a branded dead end with a way out. */
export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--ff-bg)]">
      <div className="text-center">
        <p className="text-[64px] leading-none font-bold ff-gradient-text mb-2">404</p>
        <h1 className="text-lg font-semibold text-[var(--ff-text)] mb-2">Page not found</h1>
        <p className="text-sm text-[var(--ff-text-muted)] mb-6">
          The page you are looking for doesn't exist or has moved.
        </p>
        <div className="flex gap-2 justify-center">
          <Link to="/dashboard" className="ff-btn-primary px-4 py-2 rounded-lg text-sm">
            Go to dashboard
          </Link>
          <Link to="/" className="ff-btn-ghost px-4 py-2 rounded-lg text-sm">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
