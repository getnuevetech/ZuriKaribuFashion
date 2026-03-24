import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { getHomeRouteForUser } from '../auth/rbac';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { evaluatePasswordSecurity } from '../utils/passwordSecurity';
import { AUTH_PAGE_SETTINGS_DEFAULTS, useAuthPageSettings } from '../hooks/useAuthPageSettings';
import AuthPageShell from '../components/auth/AuthPageShell';
import { ArrowRight } from 'lucide-react';

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
    <AuthPageShell
      brandName={authPageSettings.brandName}
      heroImage={authPageSettings.changePasswordHeroImage || authPageSettings.resetPasswordHeroImage}
      heroImageFallback={
        AUTH_PAGE_SETTINGS_DEFAULTS.changePasswordHeroImage || AUTH_PAGE_SETTINGS_DEFAULTS.resetPasswordHeroImage
      }
      heroAlt={`${authPageSettings.brandName} update temporary password`}
      heroTitle={
        <>
          Your style,
          <br />
          your story.
        </>
      }
      heroSubtitle="Secure your account and continue your African fashion journey."
      pageTitle={authPageSettings.changePasswordTitle || 'Update password'}
      pageSubtitle={
        authPageSettings.changePasswordSubtitle ||
        'Your account was created with a temporary password. You must update it before continuing.'
      }
    >
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
          className="h-12 w-full rounded-xl border border-[#dfdfdf] bg-white px-4 text-sm focus:border-[#e85a3c] focus:outline-none"
          placeholder="Current temporary password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <input
          type="password"
          required
          className="h-12 w-full rounded-xl border border-[#dfdfdf] bg-white px-4 text-sm focus:border-[#e85a3c] focus:outline-none"
          placeholder="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <PasswordStrengthMeter password={newPassword} />
        <input
          type="password"
          required
          className="h-12 w-full rounded-xl border border-[#dfdfdf] bg-white px-4 text-sm focus:border-[#e85a3c] focus:outline-none"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <Button
          type="submit"
          disabled={saving}
          className="h-12 w-full rounded-xl bg-[#e85a3c] text-sm font-semibold text-white hover:bg-[#d14a2e]"
        >
          {saving ? 'Saving...' : authPageSettings.changePasswordSubmitLabel || 'Update Password'}
          {!saving ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600">
        <Link to="/auth/login" className="font-medium text-amber-700 hover:text-amber-800">
          Back to sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}
