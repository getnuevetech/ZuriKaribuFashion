import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type AuthenticatorSettingsState = {
  enabled: boolean;
  allowEmailOtp: boolean;
  allowTotpAuthenticator: boolean;
  otpLength: number;
  otpExpiryMinutes: number;
  challengeMaxAttempts: number;
  totpIssuer: string;
  totpPeriodSeconds: number;
  totpDigits: number;
  requiredUserRoles: string[];
  requiredAdminRoleIds: string[];
};

const DEFAULT_SETTINGS: AuthenticatorSettingsState = {
  enabled: false,
  allowEmailOtp: true,
  allowTotpAuthenticator: true,
  otpLength: 6,
  otpExpiryMinutes: 10,
  challengeMaxAttempts: 5,
  totpIssuer: 'African Fashion',
  totpPeriodSeconds: 30,
  totpDigits: 6,
  requiredUserRoles: [],
  requiredAdminRoleIds: [],
};

export default function AuthenticatorSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<AuthenticatorSettingsState>(DEFAULT_SETTINGS);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [adminRoles, setAdminRoles] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);

  const sortedUserRoles = useMemo(() => [...userRoles].sort(), [userRoles]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.admin.getAuthenticatorSettings();
      if (!response.success) {
        setError('Failed to load authenticator settings.');
        return;
      }
      setSettings({
        ...DEFAULT_SETTINGS,
        ...(response.data?.settings || {}),
        requiredUserRoles: Array.isArray(response.data?.settings?.requiredUserRoles)
          ? response.data.settings.requiredUserRoles
          : [],
        requiredAdminRoleIds: Array.isArray(response.data?.settings?.requiredAdminRoleIds)
          ? response.data.settings.requiredAdminRoleIds
          : [],
      });
      setUserRoles(Array.isArray(response.data?.userRoles) ? response.data.userRoles : []);
      setAdminRoles(Array.isArray(response.data?.adminRoles) ? response.data.adminRoles : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load authenticator settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleUserRole = (role: string) => {
    setSettings((prev) => ({
      ...prev,
      requiredUserRoles: prev.requiredUserRoles.includes(role)
        ? prev.requiredUserRoles.filter((entry) => entry !== role)
        : [...prev.requiredUserRoles, role],
    }));
  };

  const toggleAdminRole = (adminRoleId: string) => {
    setSettings((prev) => ({
      ...prev,
      requiredAdminRoleIds: prev.requiredAdminRoleIds.includes(adminRoleId)
        ? prev.requiredAdminRoleIds.filter((entry) => entry !== adminRoleId)
        : [...prev.requiredAdminRoleIds, adminRoleId],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.admin.updateAuthenticatorSettings(settings);
      if (!response.success) {
        setError('Failed to save authenticator settings.');
        return;
      }
      setSettings({
        ...DEFAULT_SETTINGS,
        ...(response.data?.settings || {}),
        requiredUserRoles: Array.isArray(response.data?.settings?.requiredUserRoles)
          ? response.data.settings.requiredUserRoles
          : [],
        requiredAdminRoleIds: Array.isArray(response.data?.settings?.requiredAdminRoleIds)
          ? response.data.settings.requiredAdminRoleIds
          : [],
      });
      setUserRoles(Array.isArray(response.data?.userRoles) ? response.data.userRoles : []);
      setAdminRoles(Array.isArray(response.data?.adminRoles) ? response.data.adminRoles : []);
      setMessage(response.message || 'Authenticator settings saved.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save authenticator settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Authenticator Security</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure OTP and authenticator app requirements. Choose which account levels and admin groups must complete second-factor verification.
        </p>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Authenticator Policy</h2>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => setSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            Enable second-factor authentication policy
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.allowEmailOtp}
              onChange={(event) => setSettings((prev) => ({ ...prev, allowEmailOtp: event.target.checked }))}
            />
            Allow Email OTP method
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.allowTotpAuthenticator}
              onChange={(event) => setSettings((prev) => ({ ...prev, allowTotpAuthenticator: event.target.checked }))}
            />
            Allow Google Authenticator / Authenticator App (TOTP)
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-gray-700">
              <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">OTP digits</span>
              <input
                type="number"
                min={4}
                max={8}
                value={settings.otpLength}
                onChange={(event) => setSettings((prev) => ({ ...prev, otpLength: Number(event.target.value || 6) }))}
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">OTP expiry (minutes)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.otpExpiryMinutes}
                onChange={(event) => setSettings((prev) => ({ ...prev, otpExpiryMinutes: Number(event.target.value || 10) }))}
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">Max verification attempts</span>
              <input
                type="number"
                min={1}
                max={12}
                value={settings.challengeMaxAttempts}
                onChange={(event) => setSettings((prev) => ({ ...prev, challengeMaxAttempts: Number(event.target.value || 5) }))}
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">TOTP period (seconds)</span>
              <input
                type="number"
                min={15}
                max={120}
                value={settings.totpPeriodSeconds}
                onChange={(event) => setSettings((prev) => ({ ...prev, totpPeriodSeconds: Number(event.target.value || 30) }))}
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">TOTP digits</span>
              <input
                type="number"
                min={6}
                max={8}
                value={settings.totpDigits}
                onChange={(event) => setSettings((prev) => ({ ...prev, totpDigits: Number(event.target.value || 6) }))}
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700 sm:col-span-2">
              <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">TOTP issuer label</span>
              <input
                type="text"
                value={settings.totpIssuer}
                onChange={(event) => setSettings((prev) => ({ ...prev, totpIssuer: event.target.value }))}
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                placeholder="African Fashion"
              />
            </label>
          </div>
        </section>

        <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Required Account Levels</h2>
            <p className="text-xs text-gray-500">Select user roles that must use authenticator verification.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sortedUserRoles.map((role) => (
              <label key={role} className="flex items-center gap-3 rounded border border-gray-200 p-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.requiredUserRoles.includes(role)}
                  onChange={() => toggleUserRole(role)}
                />
                <span>{role.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900">Required Admin Groups</h2>
            <p className="text-xs text-gray-500">Select admin roles/groups that must use authenticator verification.</p>
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {adminRoles.map((role) => (
              <label key={role.id} className="flex items-center justify-between rounded border border-gray-200 p-2 text-sm text-gray-700">
                <span>{role.name}</span>
                <input
                  type="checkbox"
                  checked={settings.requiredAdminRoleIds.includes(role.id)}
                  onChange={() => toggleAdminRole(role.id)}
                />
              </label>
            ))}
            {adminRoles.length === 0 ? <p className="text-sm text-gray-500">No admin roles available.</p> : null}
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Authenticator Settings'}
        </Button>
      </div>
    </div>
  );
}

