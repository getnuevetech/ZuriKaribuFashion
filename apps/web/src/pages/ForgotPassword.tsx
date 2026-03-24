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
      heroImage={authPageSettings.forgotPasswordHeroImage}
      heroImageFallback={AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordHeroImage}
      heroAlt={`${authPageSettings.brandName} forgot password`}
      heroTitle={
        <>
          Your style,
          <br />
          your story.
        </>
      }
      heroSubtitle="Reset your password and continue your African fashion journey."
      pageTitle="Forgot password?"
      pageSubtitle="No worries. Enter your email address and we'll send you a link to reset your password."
      topSlot={(
        <Link to="/auth/login" className="inline-flex items-center gap-2 text-base text-[#6a6a6a] hover:text-[#1f1f1f]">
          <span aria-hidden="true">←</span>
          <span>Back to sign in</span>
        </Link>
      )}
    >
      {message ? (
        <div className="border border-green-200 bg-green-50 p-4 text-base text-green-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="border border-red-200 bg-red-50 p-4 text-base text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <label className="block text-base font-semibold text-[#2a2a2a]">Email address</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="Enter your email"
            className="h-12 w-full rounded-[10px] border border-[#dfdfdf] bg-white pl-11 pr-3 text-base focus:border-[#9d9d9d] focus:outline-none"
          />
        </div>

        <Button type="submit" className="h-12 w-full rounded-[10px] bg-[#e85a3c] text-base font-semibold text-white hover:bg-[#d14a2e]" disabled={loading}>
          {loading ? 'Sending reset link...' : authPageSettings.forgotPasswordSubmitLabel}
          {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
        </Button>
      </form>

      <p className="text-center text-base text-gray-600">
        Need help?{' '}
        <Link to="/contact" className="font-medium text-[#e85a3c] hover:text-[#c9492f]">
          Contact support
        </Link>
      </p>
    </AuthPageShell>
  );
}

