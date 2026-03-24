import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { AUTH_PAGE_SETTINGS_DEFAULTS, useAuthPageSettings } from '../hooks/useAuthPageSettings';
import AuthPageShell from '../components/auth/AuthPageShell';

export default function ForgotPassword() {
  const { settings: authPageSettings } = useAuthPageSettings();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.auth.requestPasswordReset(email);
      setMessage(
        response?.message ||
          'If your email exists in our system, a password reset link has been sent.'
      );
    } catch (requestError: any) {
      setError(
        String(
          requestError?.response?.data?.message ||
            requestError?.message ||
            'Unable to send reset link right now.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      brandName={authPageSettings.brandName}
      sectionLabel="Kimi v14 Authentication"
      heroImage={authPageSettings.forgotPasswordHeroImage}
      heroImageFallback={AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordHeroImage}
      heroAlt={`${authPageSettings.brandName} forgot password`}
      heroCaption={authPageSettings.forgotPasswordHeroCaption}
      title={authPageSettings.forgotPasswordTitle}
      subtitle={authPageSettings.forgotPasswordSubtitle}
    >
      {message ? (
        <div className="border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="Email Address"
            className="h-11 w-full border border-gray-300 pl-10 pr-3 text-sm focus:border-black focus:outline-none"
          />
        </div>

        <Button type="submit" className="h-11 w-full text-sm" disabled={loading}>
          {loading ? 'Sending reset link...' : authPageSettings.forgotPasswordSubmitLabel}
          {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600">
        Remember your password?{' '}
        <Link to="/auth/login" className="font-medium text-[#e85a3c] hover:text-[#c9492f]">
          Back to sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}

