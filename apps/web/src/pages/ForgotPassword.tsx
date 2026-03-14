import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { useAuthPageSettings } from '../hooks/useAuthPageSettings';

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
    <div className="min-h-screen bg-gray-100 px-4 py-8 md:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2">
        <div className="relative min-h-[360px] overflow-hidden border border-gray-200 bg-black shadow-sm md:min-h-[640px]">
          <img
            src={authPageSettings.forgotPasswordHeroImage}
            alt={`${authPageSettings.brandName} forgot password`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20" />
          <p className="absolute left-6 top-5 text-3xl font-bold text-white md:text-4xl">
            {authPageSettings.brandName}
          </p>
          <p className="absolute bottom-6 left-6 pr-6 text-2xl font-medium italic text-white md:text-4xl">
            {authPageSettings.forgotPasswordHeroCaption}
          </p>
        </div>

        <div className="border border-gray-200 bg-white px-5 py-8 shadow-sm sm:px-8 md:py-10">
          <div className="mx-auto w-full max-w-md space-y-5">
            <Link to="/" className="inline-flex text-sm font-medium text-amber-700 hover:text-amber-800">
              Back to Home
            </Link>
            <div className="text-center">
              <p className="text-4xl font-bold text-black">{authPageSettings.brandName}</p>
              <h1 className="mt-6 text-4xl font-bold text-gray-900">{authPageSettings.forgotPasswordTitle}</h1>
              <p className="mt-2 text-sm text-gray-600">{authPageSettings.forgotPasswordSubtitle}</p>
            </div>

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
              <Link to="/login" className="font-medium text-amber-700 hover:text-amber-800">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

