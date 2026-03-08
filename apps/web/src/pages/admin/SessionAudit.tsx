import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';

type SessionAuditAction = 'VENDOR_SESSION_STARTED' | 'VENDOR_SESSION_REPLACED' | 'VENDOR_SESSION_LOGOUT';
type VendorRole = 'FABRIC_SELLER' | 'FASHION_DESIGNER';

interface SessionAuditEvent {
  id: string;
  action: SessionAuditAction;
  createdAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
  };
  details: {
    role?: string | null;
    deviceType?: string;
    sessionIssuedAt?: number | null;
    previousSessionAt?: string | null;
  };
}

interface SessionAuditResponse {
  events: SessionAuditEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const actionLabel: Record<SessionAuditAction, string> = {
  VENDOR_SESSION_STARTED: 'Session started',
  VENDOR_SESSION_REPLACED: 'Session replaced',
  VENDOR_SESSION_LOGOUT: 'Session logout',
};

export default function AdminSessionAudit() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<SessionAuditResponse>({
    events: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 1 },
  });

  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = async (nextPage = page) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.admin.getSessionAudit({
        action: (actionFilter || undefined) as SessionAuditAction | undefined,
        role: (roleFilter || undefined) as VendorRole | undefined,
        userId: userIdFilter.trim() || undefined,
        page: nextPage,
        limit: 20,
      });

      if (response.success) {
        setData(response.data);
        setPage(response.data.pagination?.page || nextPage);
      } else {
        setError('Failed to load session audit.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load session audit.');
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

  const getUserDisplayName = (event: SessionAuditEvent) => {
    const fullName = `${event.user?.firstName || ''} ${event.user?.lastName || ''}`.trim();
    return fullName || event.user?.email || 'Unknown user';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Session Audit</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track seller/designer login sessions, replacements, and logouts.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="">All actions</option>
            <option value="VENDOR_SESSION_STARTED">Session started</option>
            <option value="VENDOR_SESSION_REPLACED">Session replaced</option>
            <option value="VENDOR_SESSION_LOGOUT">Session logout</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="">All vendor roles</option>
            <option value="FABRIC_SELLER">Fabric Seller</option>
            <option value="FASHION_DESIGNER">Fashion Designer</option>
          </select>
          <input
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            placeholder="Filter by User ID"
            className="rounded-lg border px-3 py-2"
          />
          <Button onClick={applyFilters}>Apply Filters</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {data.pagination.page} of {Math.max(1, data.pagination.pages)} • {data.pagination.total} events
            </p>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Vendor</th>
                  <th className="pb-2 pr-3">Action</th>
                  <th className="pb-2 pr-3">Device</th>
                  <th className="pb-2 pr-3">IP</th>
                  <th className="pb-2">Previous Session</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={event.id} className="border-t align-top">
                    <td className="py-2 pr-3 text-gray-700">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900">{getUserDisplayName(event)}</p>
                      <p className="text-xs text-gray-500">{event.user?.role}</p>
                      <p className="text-[11px] text-gray-400">{event.user?.id}</p>
                    </td>
                    <td className="py-2 pr-3">{actionLabel[event.action] || event.action}</td>
                    <td className="py-2 pr-3">
                      <p>{event.details?.deviceType || 'unknown'}</p>
                      <p className="line-clamp-1 max-w-[280px] text-[11px] text-gray-400">{event.userAgent || '-'}</p>
                    </td>
                    <td className="py-2 pr-3">{event.ipAddress || '-'}</td>
                    <td className="py-2 text-gray-700">
                      {event.details?.previousSessionAt
                        ? new Date(event.details.previousSessionAt).toLocaleString()
                        : '-'}
                    </td>
                  </tr>
                ))}
                {data.events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-500">
                      No session audit events found.
                    </td>
                  </tr>
                )}
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
