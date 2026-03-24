import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { evaluatePasswordSecurity } from '../utils/passwordSecurity';
import { AUTH_PAGE_SETTINGS_DEFAULTS, useAuthPageSettings } from '../hooks/useAuthPageSettings';
import AuthPageShell from '../components/auth/AuthPageShell';

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
    <AuthPageShell
      brandName={authPageSettings.brandName}
      heroImage={authPageSettings.resetPasswordHeroImage}
      heroImageFallback={AUTH_PAGE_SETTINGS_DEFAULTS.resetPasswordHeroImage}
      heroAlt={`${authPageSettings.brandName} reset password`}
      heroTitle={
        <>
          Your style,
          <br />
          your story.
        </>
      }
      heroSubtitle="Reset your password and continue your African fashion journey."
      pageTitle="Reset password"
      pageSubtitle="Set a strong new password for your account."
    >
      {!token ? (
        <div className="border border-red-200 bg-red-50 p-4 text-base text-red-700">
          Invalid reset link. Please request a new one from the forgot password page.
        </div>
      ) : null}
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
        <div>
          <label className="mb-1.5 block text-base font-semibold text-[#2f2f2f]">New password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              className="h-12 w-full rounded-[10px] border border-[#dfdfdf] bg-white pl-11 pr-3 text-base focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 focus:outline-none"
              placeholder="Minimum 8 characters"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-base font-semibold text-[#2f2f2f]">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="h-12 w-full rounded-[10px] border border-[#dfdfdf] bg-white pl-11 pr-3 text-base focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 focus:outline-none"
              placeholder="Re-enter password"
            />
          </div>
        </div>
        <PasswordStrengthMeter password={newPassword} />

        <Button
          type="submit"
          className="w-full h-12 bg-[#e85a3d] hover:bg-[#d14a2d] text-base font-semibold text-white rounded-lg transition-colors"
          disabled={loading || !token}
        >
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

      <p className="text-center text-base text-gray-600">
        <Link to="/auth/login" className="font-medium text-[#e85a3c] hover:text-[#c9492f]">
          Back to sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}
