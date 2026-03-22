import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { getHomeRouteForUser } from '../auth/rbac';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { evaluatePasswordSecurity } from '../utils/passwordSecurity';

export default function ChangePasswordRequiredPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
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
    <div className="mx-auto max-w-lg rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Change temporary password</h1>
      <p className="mt-1 text-sm text-gray-600">
        Your account was created with a temporary password. You must change it before continuing.
      </p>
      {error ? <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? (
        <div className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>
      ) : null}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input
          type="password"
          required
          className="w-full rounded border px-3 py-2"
          placeholder="Current temporary password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <input
          type="password"
          required
          className="w-full rounded border px-3 py-2"
          placeholder="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <PasswordStrengthMeter password={newPassword} />
        <input
          type="password"
          required
          className="w-full rounded border px-3 py-2"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Update Password'}
        </Button>
      </form>
    </div>
  );
}
