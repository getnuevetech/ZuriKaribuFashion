import { useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button';
import { api } from '../../services/api';

type EnterpriseWorkspaceProps = {
  vendorType: 'seller' | 'designer';
  initialSection?: 'overview' | 'roles';
  upgradeOnly?: boolean;
};

type PaymentProvider = {
  providerKey: string;
  displayName: string;
  checkoutType: 'INLINE' | 'REDIRECT';
  mode: 'TEST' | 'LIVE';
};

type EnterpriseUpgradeLevel = {
  key: string;
  name: string;
  seatLimit: number;
  yearlyFeeUsd: number;
};

type EnterpriseActivityLog = {
  id: string;
  action: string;
  createdAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, any> | null;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  } | null;
};

export default function EnterpriseWorkspace({
  vendorType,
  initialSection = 'overview',
  upgradeOnly = false,
}: EnterpriseWorkspaceProps) {
  const vendorLabel = vendorType === 'seller' ? 'Seller' : 'Designer';
  const showRoleManagementOnly = initialSection === 'roles';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [enterpriseData, setEnterpriseData] = useState<any>(null);
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [newRole, setNewRole] = useState({ key: '', name: '' });
  const [newSubAccount, setNewSubAccount] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    roleId: '',
  });
  const [upgradeForm, setUpgradeForm] = useState({
    requestedLevelKey: '',
    requestedYears: 1,
    note: '',
  });
  const [paymentDraft, setPaymentDraft] = useState<Record<string, { providerKey: string; reference: string }>>({});
  const [selectedProvider, setSelectedProvider] = useState('STRIPE');
  const [activityLogs, setActivityLogs] = useState<EnterpriseActivityLog[]>([]);
  const [activityPagination, setActivityPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [activitySearch, setActivitySearch] = useState('');
  const [activityActionFilter, setActivityActionFilter] = useState('');
  const [activityLoading, setActivityLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [enterpriseResult, requestsResult, paymentsResult] = await Promise.allSettled([
        api.enterprise.getMe(),
        api.enterprise.listMyUpgradeRequests(),
        api.payments.getOptions({ useCase: 'ENTERPRISE' }),
      ]);

      const enterpriseResponse = enterpriseResult.status === 'fulfilled' ? enterpriseResult.value : null;
      const requestsResponse = requestsResult.status === 'fulfilled' ? requestsResult.value : null;
      const paymentsResponse = paymentsResult.status === 'fulfilled' ? paymentsResult.value : null;

      setEnterpriseData(enterpriseResponse?.data || null);
      setRequests(Array.isArray(requestsResponse?.data) ? requestsResponse?.data : []);
      const providers = Array.isArray(paymentsResponse?.data?.providers) ? paymentsResponse.data.providers : [];
      setPaymentProviders(providers);
      if (providers.length > 0 && !providers.some((provider: any) => provider.providerKey === selectedProvider)) {
        setSelectedProvider(String(providers[0].providerKey || 'STRIPE'));
      }

      if (!enterpriseResponse) {
        const enterpriseError = (enterpriseResult as PromiseRejectedResult).reason;
        setError(enterpriseError?.response?.data?.message || 'Failed to load enterprise workspace.');
      } else if (!requestsResponse || !paymentsResponse) {
        setError('Enterprise workspace loaded with partial data. Some sections may be temporarily unavailable.');
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load enterprise workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const activeRoles = useMemo(() => {
    const rows = Array.isArray(enterpriseData?.roles) ? enterpriseData.roles : [];
    return rows.filter((entry: any) => entry.isActive !== false);
  }, [enterpriseData]);

  const availableUpgradeLevels = useMemo(() => {
    const rows = Array.isArray(enterpriseData?.availableUpgradeLevels) ? enterpriseData.availableUpgradeLevels : [];
    return rows.filter(
      (entry: any) =>
        entry &&
        typeof entry === 'object' &&
        String(entry.key || '').trim() &&
        String(entry.name || '').trim() &&
        Number(entry.seatLimit || 0) > 0
    ) as EnterpriseUpgradeLevel[];
  }, [enterpriseData]);

  const selectedUpgradeLevel = useMemo(() => {
    const key = String(upgradeForm.requestedLevelKey || '').trim().toUpperCase();
    if (!key) return null;
    return availableUpgradeLevels.find((level) => String(level.key || '').toUpperCase() === key) || null;
  }, [availableUpgradeLevels, upgradeForm.requestedLevelKey]);

  useEffect(() => {
    if (availableUpgradeLevels.length === 0) return;
    const currentKey = String(upgradeForm.requestedLevelKey || '').trim().toUpperCase();
    const hasCurrent = availableUpgradeLevels.some((level) => String(level.key || '').toUpperCase() === currentKey);
    if (hasCurrent) return;
    setUpgradeForm((prev) => ({
      ...prev,
      requestedLevelKey: String(availableUpgradeLevels[0].key || ''),
    }));
  }, [availableUpgradeLevels, upgradeForm.requestedLevelKey]);

  const handleCreateUpgradeRequest = async () => {
    const selectedLevelKey = String(upgradeForm.requestedLevelKey || '').trim().toUpperCase();
    if (!selectedLevelKey) {
      setError('Please select an upgrade level.');
      return;
    }
    if (!String(upgradeForm.note || '').trim()) {
      setError('Reason for upgrade request is required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.enterprise.createUpgradeRequest({
        requestedLevelKey: selectedLevelKey,
        requestedYears: Number(upgradeForm.requestedYears || 1),
        note: String(upgradeForm.note || '').trim(),
      });
      setSuccess('Enterprise upgrade request submitted successfully.');
      await loadAll();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Failed to submit enterprise upgrade request.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.key.trim() || !newRole.name.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.enterprise.createRole({
        key: newRole.key,
        name: newRole.name,
        permissions: ['dashboard:view', 'products:view', 'orders:view'],
      });
      setNewRole({ key: '', name: '' });
      setSuccess('Enterprise role created successfully.');
      await loadAll();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Failed to create enterprise role.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRolePermission = async (role: any, permissionKey: string) => {
    const current = Array.isArray(role.permissions) ? role.permissions : [];
    const next = current.includes(permissionKey)
      ? current.filter((entry: string) => entry !== permissionKey)
      : [...current, permissionKey];
    setSaving(true);
    setError('');
    try {
      await api.enterprise.updateRole(String(role.id || ''), {
        permissions: next,
        isActive: role.isActive !== false,
      });
      await loadAll();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Failed to update role permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubAccount = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.enterprise.createSubAccount({
        roleId: newSubAccount.roleId,
        firstName: newSubAccount.firstName,
        lastName: newSubAccount.lastName,
        email: newSubAccount.email,
        password: newSubAccount.password,
        phone: newSubAccount.phone || undefined,
      });
      setNewSubAccount({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phone: '',
        roleId: newSubAccount.roleId,
      });
      setSuccess('Sub-account created successfully.');
      await loadAll();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Failed to create sub-account.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSubAccount = async (subAccountId: string, payload: { status?: 'ACTIVE' | 'DISABLED'; roleId?: string }) => {
    setSaving(true);
    setError('');
    try {
      await api.enterprise.updateSubAccount(subAccountId, payload);
      await loadAll();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Failed to update sub-account.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePaymentSession = async (requestId: string) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.enterprise.createUpgradePaymentSession(requestId, {
        providerKey: selectedProvider,
        returnUrl: `${window.location.origin}/${vendorType}/enterprise`,
        cancelUrl: `${window.location.origin}/${vendorType}/enterprise?payment_cancelled=true`,
      });
      const data = response.data || {};
      const reference = String(data.paymentIntentId || data.reference || '').trim();
      setPaymentDraft((prev) => ({
        ...prev,
        [requestId]: {
          providerKey: String(data.providerKey || selectedProvider),
          reference,
        },
      }));
      if (data.checkoutUrl) {
        window.open(String(data.checkoutUrl), '_blank', 'noopener,noreferrer');
      }
      setSuccess('Payment session created. Complete payment, then click Verify.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Failed to create payment session.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyPayment = async (requestId: string) => {
    const draft = paymentDraft[requestId];
    if (!draft?.providerKey || !draft.reference) {
      setError('Payment provider and reference are required before verification.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.enterprise.verifyUpgradePayment(requestId, {
        providerKey: draft.providerKey,
        reference: draft.reference,
      });
      setSuccess(response.message || 'Payment verified and enterprise subscription activated.');
      await loadAll();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Failed to verify payment.');
    } finally {
      setSaving(false);
    }
  };

  const loadEnterpriseActivityLogs = async (page = 1) => {
    if (!String(activitySearch || '').trim()) {
      setError('Enter username or email to pull enterprise user activity logs.');
      setActivityLogs([]);
      setActivityPagination({ page: 1, limit: 20, total: 0, pages: 1 });
      return;
    }
    setActivityLoading(true);
    setError('');
    try {
      const response = await api.enterprise.getActivityLogs({
        userQuery: String(activitySearch || '').trim(),
        action: String(activityActionFilter || '').trim() || undefined,
        page,
        limit: 20,
      });
      const payload = response.data || {};
      setActivityLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setActivityPagination(
        payload.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          pages: 1,
        }
      );
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load enterprise activity logs.');
      setActivityLogs([]);
    } finally {
      setActivityLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  const account = enterpriseData?.account || {};
  const subAccounts = Array.isArray(enterpriseData?.subAccounts) ? enterpriseData.subAccounts : [];
  const roleRows = Array.isArray(enterpriseData?.roles) ? enterpriseData.roles : [];
  const permissionCatalog = Array.isArray(enterpriseData?.permissionCatalog) ? enterpriseData.permissionCatalog : [];
  const isEnterpriseEnabled = Boolean(account.isEnterprise);

  if (showRoleManagementOnly && !isEnterpriseEnabled) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vendorLabel} Enterprise Role Management</h1>
          <p className="mt-1 text-sm text-gray-600">Role management is available only after enterprise upgrade activation.</p>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Upgrade to an enterprise account and complete payment before managing sub-account roles.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {showRoleManagementOnly ? `${vendorLabel} Enterprise Role Management` : `${vendorLabel} Enterprise Workspace`}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {showRoleManagementOnly
            ? 'Create and configure sub-account roles for your enterprise team.'
            : upgradeOnly
              ? 'Submit enterprise upgrade requests. Additional enterprise tools become available after activation.'
              : 'Manage enterprise subscription, sub-accounts, and internal role permissions for your brand account.'}
        </p>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? (
        <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      ) : null}

      {!showRoleManagementOnly && !upgradeOnly ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-gray-500">Enterprise status</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{account.isEnterprise ? 'Enabled' : 'Not enabled'}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-gray-500">Subscription</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{account.subscriptionStatus || 'INACTIVE'}</p>
            <p className="text-xs text-gray-500">
              {account.subscriptionEndsAt ? `Ends: ${new Date(account.subscriptionEndsAt).toLocaleDateString()}` : 'No active expiry'}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-gray-500">Seat usage</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {Number(account.seatUsage || 0)} / {Number(account.seatLimit || 1)}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-gray-500">Yearly fee (USD)</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">${Number(account.yearlyFeeUsd || 0).toFixed(2)}</p>
          </div>
        </div>
      ) : null}

      {!showRoleManagementOnly ? <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Request enterprise upgrade</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            value={upgradeForm.requestedLevelKey}
            onChange={(event) => setUpgradeForm((prev) => ({ ...prev, requestedLevelKey: event.target.value }))}
            className="rounded border px-3 py-2 text-sm"
            disabled={availableUpgradeLevels.length === 0}
          >
            <option value="">{availableUpgradeLevels.length > 0 ? 'Select upgrade level' : 'No levels configured yet'}</option>
            {availableUpgradeLevels.map((level) => (
              <option key={level.key} value={level.key}>
                {level.name} ({level.key})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={5}
            value={upgradeForm.requestedYears}
            onChange={(event) => setUpgradeForm((prev) => ({ ...prev, requestedYears: Number(event.target.value || 1) }))}
            placeholder="Years"
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={selectedProvider}
            onChange={(event) => setSelectedProvider(event.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            {paymentProviders.map((provider) => (
              <option key={provider.providerKey} value={provider.providerKey}>
                {provider.displayName} ({provider.mode})
              </option>
            ))}
          </select>
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 md:col-span-4">
            {selectedUpgradeLevel ? (
              <div className="space-y-1">
                <p>
                  <span className="font-semibold">Selected plan:</span> {selectedUpgradeLevel.name} ({selectedUpgradeLevel.key})
                </p>
                <p>
                  <span className="font-semibold">Seat limit:</span> {Number(selectedUpgradeLevel.seatLimit || 0)}
                </p>
                <p>
                  <span className="font-semibold">Yearly fee:</span> ${Number(selectedUpgradeLevel.yearlyFeeUsd || 0).toFixed(2)}
                </p>
                <p>
                  <span className="font-semibold">Total for selected years:</span>{' '}
                  ${(Number(selectedUpgradeLevel.yearlyFeeUsd || 0) * Math.max(1, Number(upgradeForm.requestedYears || 1))).toFixed(2)}
                </p>
              </div>
            ) : (
              'Select an upgrade level to view plan details.'
            )}
          </div>
          <textarea
            value={upgradeForm.note}
            onChange={(event) => setUpgradeForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="Reason / note for admin (required)"
            className="h-20 rounded border px-3 py-2 text-sm md:col-span-4"
            required
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleCreateUpgradeRequest}
            disabled={saving || availableUpgradeLevels.length === 0 || !String(upgradeForm.note || '').trim() || !selectedUpgradeLevel}
          >
            Submit Upgrade Request
          </Button>
        </div>
      </div> : null}

      {!showRoleManagementOnly && !upgradeOnly ? <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Upgrade request history</h2>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Level</th>
                <th className="py-2 pr-3">Seats</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Payment</th>
                <th className="py-2 pr-3">Reference</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const draft = paymentDraft[String(request.id)] || {
                  providerKey: String(request.paymentProviderKey || selectedProvider || 'STRIPE'),
                  reference: String(request.paymentReference || ''),
                };
                return (
                  <tr key={request.id} className="border-t">
                    <td className="py-2 pr-3">{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="py-2 pr-3">{request.approvedLevelName || request.requestedLevelKey || '-'}</td>
                    <td className="py-2 pr-3">{request.approvedSeatLimit || request.requestedSeatLimit || '-'}</td>
                    <td className="py-2 pr-3">{request.status}</td>
                    <td className="py-2 pr-3">{request.paymentStatus}</td>
                    <td className="py-2 pr-3">
                      <input
                        value={draft.reference}
                        onChange={(event) =>
                          setPaymentDraft((prev) => ({
                            ...prev,
                            [request.id]: { ...draft, reference: event.target.value },
                          }))
                        }
                        placeholder="Payment reference"
                        className="w-44 rounded border px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="py-2">
                      {String(request.status || '').toUpperCase() === 'APPROVED' &&
                      String(request.paymentStatus || '').toUpperCase() !== 'PAID' ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleCreatePaymentSession(String(request.id))} disabled={saving}>
                            Pay
                          </Button>
                          <Button size="sm" onClick={() => handleVerifyPayment(String(request.id))} disabled={saving}>
                            Verify
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-5 text-center text-gray-500">
                    No enterprise requests yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div> : null}

      {!showRoleManagementOnly && !upgradeOnly ? <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Enterprise User Activity Logs</h2>
        <p className="text-xs text-gray-500">
          Pull activity logs for enterprise users by entering a username or email address.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input
            value={activitySearch}
            onChange={(event) => setActivitySearch(event.target.value)}
            placeholder="Enter username or email"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={activityActionFilter}
            onChange={(event) => setActivityActionFilter(event.target.value)}
            placeholder="Action contains (optional)"
            className="rounded border px-3 py-2 text-sm"
          />
          <div className="rounded border bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Results: {activityPagination.total}
          </div>
          <Button onClick={() => loadEnterpriseActivityLogs(1)} disabled={activityLoading}>
            {activityLoading ? 'Loading...' : 'Pull Logs'}
          </Button>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Endpoint/Details</th>
                <th className="py-2 pr-3">IP</th>
                <th className="py-2">Device</th>
              </tr>
            </thead>
            <tbody>
              {activityLogs.map((row) => {
                const details = (row.details || {}) as Record<string, any>;
                const endpointSummary = details?.path
                  ? `${details.method || 'GET'} ${details.path} (${details.statusCode ?? '-'})`
                  : details?.deviceType || '-';
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="py-2 pr-3 text-gray-700">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900">
                        {`${row.user?.firstName || ''} ${row.user?.lastName || ''}`.trim() || row.user?.email || 'Unknown user'}
                      </p>
                      <p className="text-xs text-gray-500">{row.user?.email || '-'}</p>
                    </td>
                    <td className="py-2 pr-3">{row.action}</td>
                    <td className="py-2 pr-3">
                      <p>{endpointSummary}</p>
                      {typeof details?.durationMs === 'number' ? (
                        <p className="text-[11px] text-gray-400">Duration: {details.durationMs}ms</p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{row.ipAddress || '-'}</td>
                    <td className="py-2">
                      <p className="line-clamp-2 max-w-[280px] text-[11px] text-gray-400">{row.userAgent || '-'}</p>
                    </td>
                  </tr>
                );
              })}
              {!activityLoading && activityLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    No activity logs found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={activityLoading || activityPagination.page <= 1}
            onClick={() => loadEnterpriseActivityLogs(Math.max(1, activityPagination.page - 1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={activityLoading || activityPagination.page >= Math.max(1, activityPagination.pages)}
            onClick={() =>
              loadEnterpriseActivityLogs(
                Math.min(Math.max(1, activityPagination.pages), activityPagination.page + 1)
              )
            }
          >
            Next
          </Button>
        </div>
      </div> : null}

      {!upgradeOnly ? <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Sub-account role management</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            value={newRole.key}
            onChange={(event) => setNewRole((prev) => ({ ...prev, key: event.target.value.toUpperCase() }))}
            placeholder="New role key"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={newRole.name}
            onChange={(event) => setNewRole((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="New role name"
            className="rounded border px-3 py-2 text-sm"
          />
          <Button onClick={handleCreateRole} disabled={saving}>
            Add Role
          </Button>
        </div>
        <div className="space-y-3">
          {roleRows.map((role) => (
            <div key={role.id} className="rounded border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{role.name}</p>
                  <p className="text-xs text-gray-500">{role.key}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={role.isActive !== false}
                    onChange={(event) =>
                      api.enterprise
                        .updateRole(String(role.id || ''), { isActive: event.target.checked, permissions: role.permissions || [] })
                        .then(() => loadAll())
                        .catch((updateError: any) =>
                          setError(updateError?.response?.data?.message || 'Failed to update role status.')
                        )
                    }
                    disabled={Boolean(role.isSystem)}
                  />
                  Active
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {permissionCatalog.map((permission: any) => {
                  const selected = Array.isArray(role.permissions)
                    ? role.permissions.includes(permission.key)
                    : false;
                  return (
                    <label key={`${role.id}-${permission.key}`} className="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRolePermission(role, String(permission.key))}
                        disabled={saving}
                      />
                      {permission.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div> : null}

      {!showRoleManagementOnly && !upgradeOnly ? <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Sub-account management</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
          <input
            value={newSubAccount.firstName}
            onChange={(event) => setNewSubAccount((prev) => ({ ...prev, firstName: event.target.value }))}
            placeholder="First name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={newSubAccount.lastName}
            onChange={(event) => setNewSubAccount((prev) => ({ ...prev, lastName: event.target.value }))}
            placeholder="Last name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={newSubAccount.email}
            onChange={(event) => setNewSubAccount((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Email"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={newSubAccount.password}
            onChange={(event) => setNewSubAccount((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Password"
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={newSubAccount.roleId}
            onChange={(event) => setNewSubAccount((prev) => ({ ...prev, roleId: event.target.value }))}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">Select role</option>
            {activeRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <Button onClick={handleCreateSubAccount} disabled={saving || !newSubAccount.roleId}>
            Create Sub-Account
          </Button>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Last login</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subAccounts.map((entry: any) => (
                <tr key={entry.id} className="border-t">
                  <td className="py-2 pr-3">
                    {[entry.firstName, entry.lastName].filter(Boolean).join(' ') || '-'}
                  </td>
                  <td className="py-2 pr-3">{entry.email}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={entry.roleId || ''}
                      onChange={(event) =>
                        handleUpdateSubAccount(String(entry.id || ''), {
                          roleId: event.target.value,
                          status: String(entry.status || '').toUpperCase() === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
                        })
                      }
                      className="rounded border px-2 py-1 text-xs"
                    >
                      {activeRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">{entry.status}</td>
                  <td className="py-2 pr-3">
                    {entry.lastLogin ? new Date(entry.lastLogin).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-2">
                    <Button
                      size="sm"
                      variant={String(entry.status || '').toUpperCase() === 'DISABLED' ? 'outline' : 'ghost'}
                      onClick={() =>
                        handleUpdateSubAccount(String(entry.id || ''), {
                          status: String(entry.status || '').toUpperCase() === 'DISABLED' ? 'ACTIVE' : 'DISABLED',
                        })
                      }
                      disabled={saving}
                    >
                      {String(entry.status || '').toUpperCase() === 'DISABLED' ? 'Enable' : 'Disable'}
                    </Button>
                  </td>
                </tr>
              ))}
              {subAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    No sub-accounts yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div> : null}
    </div>
  );
}

