import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';

type ActivityRole = 'ALL' | 'ADMINISTRATOR' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'CUSTOMER' | 'QA_TEAM';
type ActivityLogRow = {
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

interface ActivityLogResponse {
  logs: ActivityLogRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const ROLE_TABS: Array<{ key: ActivityRole; label: string }> = [
  { key: 'ALL', label: 'All Activity' },
  { key: 'ADMINISTRATOR', label: 'Admin Activity' },
  { key: 'FABRIC_SELLER', label: 'Seller Activity' },
  { key: 'FASHION_DESIGNER', label: 'Designer Activity' },
  { key: 'CUSTOMER', label: 'Customer Activity' },
  { key: 'QA_TEAM', label: 'QA Activity' },
];

export default function AdminSessionAudit() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<ActivityLogResponse>({
    logs: [],
    pagination: { page: 1, limit: 25, total: 0, pages: 1 },
  });
  const [roleTab, setRoleTab] = useState<ActivityRole>('ALL');
  const [userQuery, setUserQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [exportingFormat, setExportingFormat] = useState<'' | 'csv' | 'xlsx' | 'pdf'>('');

  const searchRequired = roleTab !== 'ALL';

  const load = async (nextPage = page) => {
    if (searchRequired && !String(userQuery || '').trim()) {
      setError(`Enter username or email to pull ${ROLE_TABS.find((tab) => tab.key === roleTab)?.label?.toLowerCase() || 'role'} logs.`);
      setData({
        logs: [],
        pagination: { page: 1, limit: 25, total: 0, pages: 1 },
      });
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const response = await api.admin.getActivityLogs({
        role: roleTab === 'ALL' ? undefined : roleTab,
        userQuery: userQuery.trim() || undefined,
        action: actionFilter.trim() || undefined,
        page: nextPage,
        limit: 25,
      });
      if (response.success) {
        setData(response.data || { logs: [], pagination: { page: 1, limit: 25, total: 0, pages: 1 } });
        setPage(response.data?.pagination?.page || nextPage);
      } else {
        setError('Failed to load activity logs.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    void load(1);
  };

  const downloadExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (searchRequired && !String(userQuery || '').trim()) {
      setError(`Enter username or email to pull ${ROLE_TABS.find((tab) => tab.key === roleTab)?.label?.toLowerCase() || 'role'} logs.`);
      return;
    }
    try {
      setExportingFormat(format);
      setError('');
      const payload = await api.admin.exportActivityLogs({
        format,
        role: roleTab === 'ALL' ? undefined : roleTab,
        userQuery: userQuery.trim() || undefined,
        action: actionFilter.trim() || undefined,
      });
      const blobUrl = window.URL.createObjectURL(payload.blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = payload.filename || `activity-logs.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to export activity logs.');
    } finally {
      setExportingFormat('');
    }
  };

  const roleBadge = useMemo(() => {
    if (roleTab === 'ALL') return 'All users';
    return ROLE_TABS.find((tab) => tab.key === roleTab)?.label || roleTab;
  }, [roleTab]);

  const userName = (row: ActivityLogRow) => {
    const fullName = `${row.user?.firstName || ''} ${row.user?.lastName || ''}`.trim();
    return fullName || row.user?.email || 'Unknown user';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Operations audit for all user types. Use username/email to pull role-specific logs.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRoleTab(tab.key)}
              className={`rounded border px-3 py-1.5 text-sm ${
                roleTab === tab.key
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder={searchRequired ? 'Enter username or email (required)' : 'Username or email (optional)'}
            className="rounded-lg border px-3 py-2"
          />
          <input
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="Action contains (optional)"
            className="rounded-lg border px-3 py-2"
          />
          <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Scope: <span className="font-semibold">{roleBadge}</span>
          </div>
          <Button onClick={applyFilters}>Pull Logs</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void downloadExport('csv')}
            disabled={Boolean(exportingFormat)}
          >
            {exportingFormat === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void downloadExport('xlsx')}
            disabled={Boolean(exportingFormat)}
          >
            {exportingFormat === 'xlsx' ? 'Exporting Excel...' : 'Export Excel'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void downloadExport('pdf')}
            disabled={Boolean(exportingFormat)}
          >
            {exportingFormat === 'pdf' ? 'Exporting PDF...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {data.pagination.page} of {Math.max(1, data.pagination.pages)} • {data.pagination.total} logs
            </p>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">User</th>
                  <th className="pb-2 pr-3">Role</th>
                  <th className="pb-2 pr-3">Action</th>
                  <th className="pb-2 pr-3">Endpoint/Details</th>
                  <th className="pb-2 pr-3">IP</th>
                  <th className="pb-2">Device</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((row) => {
                  const details = (row.details || {}) as Record<string, any>;
                  const endpointSummary = details?.path
                    ? `${details.method || 'GET'} ${details.path} (${details.statusCode ?? '-'})`
                    : details?.deviceType || '-';
                  return (
                    <tr key={row.id} className="border-t align-top">
                      <td className="py-2 pr-3 text-gray-700">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-gray-900">{userName(row)}</p>
                        <p className="text-xs text-gray-500">{row.user?.email || '-'}</p>
                      </td>
                      <td className="py-2 pr-3">{row.user?.role || '-'}</td>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-gray-900">{row.action}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <p>{endpointSummary}</p>
                        {typeof details?.durationMs === 'number' ? (
                          <p className="text-[11px] text-gray-400">Duration: {details.durationMs}ms</p>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">{row.ipAddress || '-'}</td>
                      <td className="py-2 text-gray-700">
                        <p className="line-clamp-2 max-w-[280px] text-[11px] text-gray-400">{row.userAgent || '-'}</p>
                      </td>
                    </tr>
                  );
                })}
                {data.logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-500">
                      No activity logs found for current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.pagination.page <= 1}
              onClick={() => void load(Math.max(1, data.pagination.page - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.pagination.page >= Math.max(1, data.pagination.pages)}
              onClick={() => void load(Math.min(Math.max(1, data.pagination.pages), data.pagination.page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
