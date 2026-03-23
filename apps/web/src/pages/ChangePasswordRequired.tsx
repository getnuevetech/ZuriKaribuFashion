import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { getHomeRouteForUser } from '../auth/rbac';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { evaluatePasswordSecurity } from '../utils/passwordSecurity';
import { AUTH_PAGE_SETTINGS_DEFAULTS, useAuthPageSettings } from '../hooks/useAuthPageSettings';

export default function ChangePasswordRequiredPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const { settings: authPageSettings } = useAuthPageSettings();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const passwordSecurity = evaluatePasswordSecurity(newPassword);
    if (!passwordSecurity.isValid) {
      setError(passwordSecurity.message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    try {
      setSaving(true);
      await api.auth.changePassword(currentPassword, newPassword);
      updateUser({ requirePasswordChange: false });
      setMessage('Password changed successfully. Redirecting...');
      const fallbackRoute = getHomeRouteForUser({ ...(user || {}), requirePasswordChange: false });
      window.setTimeout(() => navigate(fallbackRoute, { replace: true }), 400);
    } catch (submitError: any) {
      setError(submitError?.response?.data?.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 md:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2">
        <div className="relative min-h-[360px] overflow-hidden border border-gray-200 bg-black shadow-sm md:min-h-[640px]">
          <img
            src={authPageSettings.resetPasswordHeroImage}
            alt={`${authPageSettings.brandName} update temporary password`}
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
            Secure your account before continuing
          </p>
        </div>

        <div className="border border-gray-200 bg-white px-5 py-8 shadow-sm sm:px-8 md:py-10">
          <div className="mx-auto w-full max-w-md space-y-5">
            <Link to="/" className="inline-flex text-sm font-medium text-amber-700 hover:text-amber-800">
              Back to Home
            </Link>
            <div className="text-center">
              <p className="text-4xl font-bold text-black">{authPageSettings.brandName}</p>
              <h1 className="mt-6 text-4xl font-bold text-gray-900">Change Temporary Password</h1>
              <p className="mt-2 text-sm text-gray-600">
                Your account was created with a temporary password. You must update it before continuing.
              </p>
            </div>

            {error ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}
            {message ? (
              <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                required
                className="h-11 w-full border border-gray-300 px-3 text-sm focus:border-black focus:outline-none"
                placeholder="Current temporary password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <input
                type="password"
                required
                className="h-11 w-full border border-gray-300 px-3 text-sm focus:border-black focus:outline-none"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <PasswordStrengthMeter password={newPassword} />
              <input
                type="password"
                required
                className="h-11 w-full border border-gray-300 px-3 text-sm focus:border-black focus:outline-none"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <Button type="submit" disabled={saving} className="h-11 w-full text-sm">
                {saving ? 'Saving...' : 'Update Password'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
