import { useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, LockKeyhole, Plus, RefreshCw } from 'lucide-react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import PasswordStrengthMeter from '../../components/auth/PasswordStrengthMeter';
import { evaluatePasswordSecurity } from '../../utils/passwordSecurity';

export default function AdminResellerInfluencersPage() {
  const authUser = useAuthStore((state) => state.user);
  const isSuperAdmin = useMemo(() => {
    const grants = Array.isArray(authUser?.permissions) ? authUser.permissions : [];
    const normalized = grants.map((entry) => String(entry || '').trim());
    const lower = normalized.map((entry) => entry.toLowerCase());
    return normalized.includes('*') || normalized.includes('ALL') || lower.includes('all');
  }, [authUser?.permissions]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [sendingResetUserId, setSendingResetUserId] = useState<string | null>(null);
  const [settingTempPasswordUserId, setSettingTempPasswordUserId] = useState<string | null>(null);
  const [tempPasswordTarget, setTempPasswordTarget] = useState<{ userId: string; email?: string } | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [tempPasswordReason, setTempPasswordReason] = useState('');
  const [tempPasswordError, setTempPasswordError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    enabled: true,
    registrationReferralEnabled: true,
    defaultReferralCode: 'PLATFORM-DEFAULT',
    codePrefix: 'ZKR-',
    codeDigits: 6,
    sellerCommissionPercent: 5,
    designerCommissionPercent: 5,
    customerCommissionPercent: 0,
    earnFromCustomerOrders: false,
    profileEditableFields: ['firstName', 'lastName', 'phone', 'avatar', 'displayName'],
    holdDays: 7,
    minimumPayoutUsd: 10,
    referralBaseUrl: '',
  });
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatar: '',
    displayName: '',
    commissionOverridePercent: '',
    status: 'ACTIVE',
    isActive: true,
  });
  const [createForm, setCreateForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    phone: '',
    displayName: '',
    commissionOverridePercent: '',
    status: 'ACTIVE',
  });

  const readApiError = (error: any, fallback: string) => {
    const issues = Array.isArray(error?.response?.data?.errors) ? error.response.data.errors : [];
    const firstIssue = issues.length > 0 ? String(issues[0]?.message || '').trim() : '';
    return firstIssue || error?.response?.data?.message || error?.message || fallback;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setMessage('');
      const [settingsRes, rowsRes] = await Promise.all([
        api.admin.getReferralProgramSettings(),
        api.admin.getResellerInfluencers({ search: search || undefined, page: 1, limit: 100 }),
      ]);
      if (settingsRes.success) setSettings(settingsRes.data || settings);
      if (rowsRes.success) setRows(Array.isArray(rowsRes.data) ? rowsRes.data : []);
    } catch (error: any) {
      setMessage(readApiError(error, 'Failed to load reseller referral data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const token = String(search || '').trim().toLowerCase();
    if (!token) return rows;
    return rows.filter((row) => {
      const name = `${row?.user?.firstName || ''} ${row?.user?.lastName || ''}`.toLowerCase();
      const email = String(row?.user?.email || '').toLowerCase();
      const code = String(row?.referralCode || '').toLowerCase();
      return name.includes(token) || email.includes(token) || code.includes(token);
    });
  }, [rows, search]);

  const saveSettings = async () => {
    try {
      setSavingSettings(true);
      setMessage('');
      const response = await api.admin.updateReferralProgramSettings(settings);
      if (response.success) {
        setSettings(response.data || settings);
        setMessage('Referral program settings saved.');
      }
    } catch (error: any) {
      setMessage(readApiError(error, 'Failed to save settings.'));
    } finally {
      setSavingSettings(false);
    }
  };

  const createReseller = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSavingCreate(true);
      setMessage('');
      const passwordSecurity = evaluatePasswordSecurity(createForm.password);
      if (!passwordSecurity.isValid) {
        setMessage(passwordSecurity.message);
        return;
      }
      const payload = {
        email: createForm.email.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        password: createForm.password,
        phone: createForm.phone.trim() || undefined,
        displayName: createForm.displayName.trim() || undefined,
        status: createForm.status as 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED',
        commissionOverridePercent:
          createForm.commissionOverridePercent.trim() === ''
            ? null
            : Number(createForm.commissionOverridePercent),
      };
      const response = await api.admin.createResellerInfluencer(payload);
      if (response.success) {
        setShowCreate(false);
        setCreateForm({
          email: '',
          firstName: '',
          lastName: '',
          password: '',
          phone: '',
          displayName: '',
          commissionOverridePercent: '',
          status: 'ACTIVE',
        });
        setMessage('Reseller/Influencer account created.');
        await loadData();
      }
    } catch (error: any) {
      setMessage(readApiError(error, 'Failed to create reseller account.'));
    } finally {
      setSavingCreate(false);
    }
  };

  const toggleActive = async (row: any) => {
    const nextValue = !(row?.isActive !== false);
    try {
      setSavingUserId(String(row?.userId || ''));
      await api.admin.updateResellerInfluencer(String(row?.userId || ''), { isActive: nextValue });
      setRows((prev) =>
        prev.map((entry) =>
          String(entry?.userId || '') === String(row?.userId || '') ? { ...entry, isActive: nextValue } : entry
        )
      );
    } catch (error: any) {
      setMessage(readApiError(error, 'Failed to update reseller status.'));
    } finally {
      setSavingUserId(null);
    }
  };

  const openEdit = (row: any) => {
    setEditTarget(row);
    setEditForm({
      firstName: String(row?.user?.firstName || ''),
      lastName: String(row?.user?.lastName || ''),
      email: String(row?.user?.email || ''),
      phone: String(row?.user?.phone || ''),
      avatar: String(row?.user?.avatar || ''),
      displayName: String(row?.displayName || ''),
      commissionOverridePercent:
        row?.commissionOverridePercent == null ? '' : String(Number(row.commissionOverridePercent)),
      status: String(row?.user?.status || 'ACTIVE'),
      isActive: row?.isActive !== false,
    });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editTarget?.userId) return;
    try {
      setSavingUserId(String(editTarget.userId));
      setMessage('');
      await api.admin.updateResellerInfluencer(String(editTarget.userId), {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        avatar: editForm.avatar.trim() || null,
        displayName: editForm.displayName.trim() || undefined,
        commissionOverridePercent:
          String(editForm.commissionOverridePercent || '').trim() === ''
            ? null
            : Number(editForm.commissionOverridePercent),
        status: editForm.status,
        isActive: Boolean(editForm.isActive),
      });
      setEditTarget(null);
      await loadData();
      setMessage('Reseller profile updated.');
    } catch (error: any) {
      setMessage(readApiError(error, 'Failed to update reseller account.'));
    } finally {
      setSavingUserId(null);
    }
  };

  const copyText = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage('Copied to clipboard.');
    } catch {
      setMessage('Could not copy. Please copy manually.');
    }
  };

  const sendPasswordResetLink = async (userId: string, email?: string) => {
    if (!userId) return;
    try {
      setSendingResetUserId(userId);
      setMessage('');
      const response = await api.admin.sendUserPasswordResetLink(userId);
      setMessage(response?.message || `Password reset link sent${email ? ` to ${email}` : ''}.`);
    } catch (error: any) {
      setMessage(readApiError(error, 'Failed to send password reset link.'));
    } finally {
      setSendingResetUserId(null);
    }
  };

  const openTempPasswordModal = (userId: string, email?: string) => {
    if (!userId) return;
    setTempPasswordTarget({ userId, email });
    setTempPassword('');
    setTempPasswordReason('');
    setTempPasswordError('');
  };

  const closeTempPasswordModal = () => {
    setTempPasswordTarget(null);
    setTempPassword('');
    setTempPasswordReason('');
    setTempPasswordError('');
  };

  const setTemporaryPassword = async () => {
    if (!tempPasswordTarget?.userId) return;
    const passwordSecurity = evaluatePasswordSecurity(tempPassword);
    if (!passwordSecurity.isValid) {
      setTempPasswordError(passwordSecurity.message);
      return;
    }
    try {
      setSettingTempPasswordUserId(tempPasswordTarget.userId);
      setTempPasswordError('');
      const response = await api.admin.setUserTemporaryPassword(tempPasswordTarget.userId, {
        temporaryPassword: tempPassword,
        reason: tempPasswordReason.trim() || undefined,
      });
      setMessage(response?.message || 'Temporary password set successfully.');
      closeTempPasswordModal();
    } catch (error: any) {
      setTempPasswordError(readApiError(error, 'Failed to set temporary password.'));
    } finally {
      setSettingTempPasswordUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resellers / Influencers</h1>
          <p className="text-sm text-gray-600">
            Create admin-managed referral users, assign commission rules, and track onboarding performance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Reseller
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Referral Program Settings</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-gray-700">
            Referral code prefix
            <input
              type="text"
              value={settings.codePrefix ?? ''}
              onChange={(event) =>
                setSettings((prev: any) => ({
                  ...prev,
                  codePrefix: String(event.target.value || '')
                    .toUpperCase()
                    .replace(/[^A-Z0-9-]/g, '')
                    .slice(0, 12),
                }))
              }
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="ZKR-"
            />
          </label>
          <label className="text-sm text-gray-700">
            Referral code digits
            <input
              type="number"
              min={4}
              max={12}
              value={settings.codeDigits ?? 6}
              onChange={(event) => setSettings((prev: any) => ({ ...prev, codeDigits: Number(event.target.value || 6) }))}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            Seller commission %
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={settings.sellerCommissionPercent ?? 0}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...prev, sellerCommissionPercent: Number(event.target.value || 0) }))
              }
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            Designer commission %
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={settings.designerCommissionPercent ?? 0}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...prev, designerCommissionPercent: Number(event.target.value || 0) }))
              }
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            Customer commission %
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={settings.customerCommissionPercent ?? 0}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...prev, customerCommissionPercent: Number(event.target.value || 0) }))
              }
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            Hold days before payout
            <input
              type="number"
              min={0}
              max={365}
              value={settings.holdDays ?? 0}
              onChange={(event) => setSettings((prev: any) => ({ ...prev, holdDays: Number(event.target.value || 0) }))}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Referral base URL
            <input
              type="text"
              value={settings.referralBaseUrl ?? ''}
              onChange={(event) => setSettings((prev: any) => ({ ...prev, referralBaseUrl: event.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="https://your-domain.com"
            />
          </label>
          <label className="text-sm text-gray-700">
            Default referral code
            <input
              type="text"
              value={settings.defaultReferralCode ?? ''}
              onChange={(event) =>
                setSettings((prev: any) => ({
                  ...prev,
                  defaultReferralCode: String(event.target.value || '')
                    .toUpperCase()
                    .replace(/\s+/g, '-')
                    .slice(0, 80),
                }))
              }
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="PLATFORM-DEFAULT"
            />
          </label>
          <label className="text-sm text-gray-700">
            Minimum payout (USD)
            <input
              type="number"
              min={0}
              step="0.01"
              value={settings.minimumPayoutUsd ?? 0}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...prev, minimumPayoutUsd: Number(event.target.value || 0) }))
              }
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <div className="text-sm text-gray-700 md:col-span-3">
            <p className="mb-1">Referral profile fields editable by referrals</p>
            <div className="flex flex-wrap gap-3 rounded border p-2">
              {['firstName', 'lastName', 'phone', 'avatar', 'displayName'].map((field) => (
                <label key={field} className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Array.isArray(settings.profileEditableFields) && settings.profileEditableFields.includes(field)}
                    onChange={(event) => {
                      setSettings((prev: any) => {
                        const current = Array.isArray(prev.profileEditableFields) ? prev.profileEditableFields : [];
                        const next = event.target.checked
                          ? Array.from(new Set([...current, field]))
                          : current.filter((entry: string) => entry !== field);
                        return { ...prev, profileEditableFields: next };
                      });
                    }}
                  />
                  {field}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings.enabled)}
              onChange={(event) => setSettings((prev: any) => ({ ...prev, enabled: event.target.checked }))}
            />
            Enable referral program
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings.registrationReferralEnabled)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...prev, registrationReferralEnabled: event.target.checked }))
              }
            />
            Enable referral attribution during registration
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings.earnFromCustomerOrders)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...prev, earnFromCustomerOrders: event.target.checked }))
              }
            />
            Allow customer-origin commissions
          </label>
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? 'Saving...' : 'Save Program Settings'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full max-w-sm rounded border px-3 py-2 text-sm"
            placeholder="Search by name, email, referral code"
          />
          <Button variant="outline" onClick={() => void loadData()}>
            Apply
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Reseller</th>
                <th className="px-3 py-2">Referral Code</th>
                <th className="px-3 py-2">Referral Link</th>
                <th className="px-3 py-2">Referrals</th>
                <th className="px-3 py-2">Commission</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">
                      {`${row?.user?.firstName || ''} ${row?.user?.lastName || ''}`.trim() || row?.displayName || 'Reseller'}
                    </p>
                    <p className="text-xs text-gray-500">{row?.user?.email || '-'}</p>
                    {isSuperAdmin && row?.user?.callerId ? (
                      <p className="text-[11px] text-emerald-700">Caller ID: {String(row.user.callerId)}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{row?.referralCode || '-'}</p>
                    <p className="text-xs text-gray-500">#{row?.numericRefId || '-'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900"
                      onClick={() => void copyText(String(row?.referralLink || ''))}
                    >
                      <Copy className="h-3 w-3" />
                      Copy link
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <p>Total: {Number(row?.metrics?.totalReferrals || 0)}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p>Total: ${Number(row?.metrics?.totalCommissionUsd || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      Pending ${Number(row?.metrics?.pendingCommissionUsd || 0).toFixed(2)} / Paid $
                      {Number(row?.metrics?.paidCommissionUsd || 0).toFixed(2)}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <Badge variant={row?.isActive !== false ? 'green' : 'gray'}>
                        {row?.isActive !== false ? 'PROGRAM ACTIVE' : 'PROGRAM PAUSED'}
                      </Badge>
                      <Badge
                        variant={
                          String(row?.user?.status || '').toUpperCase() === 'ACTIVE'
                            ? 'green'
                            : String(row?.user?.status || '').toUpperCase() === 'SUSPENDED'
                              ? 'red'
                              : 'yellow'
                        }
                      >
                        {String(row?.user?.status || 'UNKNOWN')}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isSuperAdmin ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => void sendPasswordResetLink(String(row?.userId || ''), String(row?.user?.email || ''))}
                            disabled={sendingResetUserId === String(row?.userId || '')}
                          >
                            <KeyRound className="mr-1 h-4 w-4" />
                            Reset Password
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => openTempPasswordModal(String(row?.userId || ''), String(row?.user?.email || ''))}
                            disabled={settingTempPasswordUserId === String(row?.userId || '')}
                          >
                            <LockKeyhole className="mr-1 h-4 w-4" />
                            Temp Password
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={() => void toggleActive(row)}
                        disabled={savingUserId === String(row?.userId || '')}
                      >
                        {row?.isActive !== false ? 'Pause' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openEdit(row)}
                        disabled={savingUserId === String(row?.userId || '')}
                      >
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-gray-500" colSpan={7}>
                    No reseller records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-6">
            <h3 className="text-xl font-semibold text-gray-900">Create Reseller / Influencer</h3>
            <form onSubmit={createReseller} className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  required
                  className="rounded border px-3 py-2"
                  placeholder="First name"
                  value={createForm.firstName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, firstName: event.target.value }))}
                />
                <input
                  required
                  className="rounded border px-3 py-2"
                  placeholder="Last name"
                  value={createForm.lastName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, lastName: event.target.value }))}
                />
              </div>
              <input
                required
                type="email"
                className="w-full rounded border px-3 py-2"
                placeholder="Email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              />
              <input
                required
                type="password"
                className="w-full rounded border px-3 py-2"
                placeholder="Temporary password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
              />
              <PasswordStrengthMeter password={createForm.password} />
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  className="rounded border px-3 py-2 md:col-span-2"
                  placeholder="Display name (optional)"
                  value={createForm.displayName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
                />
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Override % (optional)"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={createForm.commissionOverridePercent}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, commissionOverridePercent: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Phone (optional)"
                  value={createForm.phone}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
                <select
                  className="rounded border px-3 py-2"
                  value={createForm.status}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={savingCreate}>
                  {savingCreate ? 'Creating...' : 'Create Reseller'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editTarget ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-6">
            <h3 className="text-xl font-semibold text-gray-900">Edit Reseller Account</h3>
            <form onSubmit={saveEdit} className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  required
                  className="rounded border px-3 py-2"
                  placeholder="First name"
                  value={editForm.firstName}
                  onChange={(event) => setEditForm((prev: any) => ({ ...prev, firstName: event.target.value }))}
                />
                <input
                  required
                  className="rounded border px-3 py-2"
                  placeholder="Last name"
                  value={editForm.lastName}
                  onChange={(event) => setEditForm((prev: any) => ({ ...prev, lastName: event.target.value }))}
                />
              </div>
              <input
                required
                type="email"
                className="w-full rounded border px-3 py-2"
                placeholder="Email"
                value={editForm.email}
                onChange={(event) => setEditForm((prev: any) => ({ ...prev, email: event.target.value }))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Phone"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((prev: any) => ({ ...prev, phone: event.target.value }))}
                />
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Avatar URL"
                  value={editForm.avatar}
                  onChange={(event) => setEditForm((prev: any) => ({ ...prev, avatar: event.target.value }))}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  className="rounded border px-3 py-2 md:col-span-2"
                  placeholder="Display name"
                  value={editForm.displayName}
                  onChange={(event) => setEditForm((prev: any) => ({ ...prev, displayName: event.target.value }))}
                />
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Override %"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={editForm.commissionOverridePercent}
                  onChange={(event) =>
                    setEditForm((prev: any) => ({ ...prev, commissionOverridePercent: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="rounded border px-3 py-2"
                  value={editForm.status}
                  onChange={(event) => setEditForm((prev: any) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(editForm.isActive)}
                    onChange={(event) => setEditForm((prev: any) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  Program Active
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={savingUserId === String(editTarget?.userId || '')}>
                  {savingUserId === String(editTarget?.userId || '') ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {tempPasswordTarget ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-lg rounded-xl bg-white p-6">
            <h3 className="text-xl font-semibold text-gray-900">Set Temporary Password</h3>
            <p className="mt-1 text-sm text-gray-600">
              User must change this password on next login before accessing platform features.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Target: <span className="font-medium">{tempPasswordTarget.email || tempPasswordTarget.userId}</span>
            </p>
            {tempPasswordError ? (
              <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {tempPasswordError}
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              <input
                type="password"
                className="w-full rounded border px-3 py-2"
                value={tempPassword}
                onChange={(event) => setTempPassword(event.target.value)}
                placeholder="Temporary password"
              />
              <PasswordStrengthMeter password={tempPassword} />
              <textarea
                className="w-full rounded border px-3 py-2 text-sm"
                rows={3}
                value={tempPasswordReason}
                onChange={(event) => setTempPasswordReason(event.target.value)}
                placeholder="Reason (optional)"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={closeTempPasswordModal}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => void setTemporaryPassword()}
                disabled={settingTempPasswordUserId === tempPasswordTarget.userId}
              >
                {settingTempPasswordUserId === tempPasswordTarget.userId ? 'Saving...' : 'Set Temporary Password'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
