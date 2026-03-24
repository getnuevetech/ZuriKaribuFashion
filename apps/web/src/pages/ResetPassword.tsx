import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { evaluatePasswordSecurity } from '../utils/passwordSecurity';
import { AUTH_PAGE_SETTINGS_DEFAULTS, useAuthPageSettings } from '../hooks/useAuthPageSettings';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { settings: authPageSettings } = useAuthPageSettings();
  const token = useMemo(() => String(params.get('token') || '').trim(), [params]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }
    const passwordSecurity = evaluatePasswordSecurity(newPassword);
    if (!passwordSecurity.isValid) {
      setError(passwordSecurity.message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.auth.resetPassword(token, newPassword);
      setMessage(response?.message || 'Password reset successful.');
      window.setTimeout(() => navigate('/auth/login', { replace: true }), 1200);
    } catch (requestError: any) {
      setError(
        String(
          requestError?.response?.data?.message ||
            requestError?.message ||
            'Unable to reset password right now.'
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
            src={authPageSettings.resetPasswordHeroImage}
            alt={`${authPageSettings.brandName} reset password`}
            className="h-full w-full object-cover"
            onError={(event) => {
              const fallback = AUTH_PAGE_SETTINGS_DEFAULTS.resetPasswordHeroImage;
              if (event.currentTarget.src !== fallback) {
                event.currentTarget.src = fallback;
              }
            }}
          />
          <div className="absolute inset-0 bg-black/20" />
          <p className="absolute left-6 top-5 text-3xl font-bold text-white md:text-4xl">
            {authPageSettings.brandName}
          </p>
          <p className="absolute bottom-6 left-6 pr-6 text-2xl font-medium italic text-white md:text-4xl">
            {authPageSettings.resetPasswordHeroCaption}
          </p>
        </div>

        <div className="border border-gray-200 bg-white px-5 py-8 shadow-sm sm:px-8 md:py-10">
          <div className="mx-auto w-full max-w-md space-y-5">
            <Link to="/" className="inline-flex text-sm font-medium text-amber-700 hover:text-amber-800">
              Back to Home
            </Link>
            <div className="text-center">
              <p className="text-4xl font-bold text-black">{authPageSettings.brandName}</p>
              <h1 className="mt-6 text-4xl font-bold text-gray-900">{authPageSettings.resetPasswordTitle}</h1>
              <p className="mt-2 text-sm text-gray-600">{authPageSettings.resetPasswordSubtitle}</p>
            </div>

            {!token ? (
              <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Invalid reset link. Please request a new one from the forgot password page.
              </div>
            ) : null}
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
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    className="h-11 w-full border border-gray-300 pl-10 pr-3 text-sm focus:border-black focus:outline-none"
                    placeholder="Minimum 8 characters"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    className="h-11 w-full border border-gray-300 pl-10 pr-3 text-sm focus:border-black focus:outline-none"
                    placeholder="Re-enter password"
                  />
                </div>
              </div>
              <PasswordStrengthMeter password={newPassword} />

              <Button type="submit" className="h-11 w-full text-sm" disabled={loading || !token}>
                {loading ? (
                  'Resetting password...'
                ) : (
                  <>
                    {authPageSettings.resetPasswordSubmitLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-600">
              <Link to="/auth/login" className="font-medium text-amber-700 hover:text-amber-800">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
