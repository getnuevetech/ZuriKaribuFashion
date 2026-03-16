import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';

type ProductType = 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
type VendorRole = 'FABRIC_SELLER' | 'FASHION_DESIGNER';
type AdminProductChangeTab = 'REQUESTS' | 'POLICY';

type FieldCatalogEntry = {
  key: string;
  label: string;
  productType: ProductType;
};

type ReviewDraft = {
  grantAllChanges: boolean;
  grantedFields: string[];
  grantDurationHours: number;
  reviewNote: string;
};

const PRODUCT_TYPES: ProductType[] = ['FABRIC', 'DESIGN', 'READY_TO_WEAR'];
const VENDOR_ROLES: VendorRole[] = ['FABRIC_SELLER', 'FASHION_DESIGNER'];

export default function AdminProductChangeRequestsPage() {
  const [activeTab, setActiveTab] = useState<AdminProductChangeTab>('REQUESTS');
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldCatalog, setFieldCatalog] = useState<FieldCatalogEntry[]>([]);
  const [defaultGrantDurationHours, setDefaultGrantDurationHours] = useState(48);
  const [allowedFieldsByRole, setAllowedFieldsByRole] = useState<
    Record<VendorRole, Record<ProductType, string[]>>
  >({
    FABRIC_SELLER: { FABRIC: [], DESIGN: [], READY_TO_WEAR: [] },
    FASHION_DESIGNER: { FABRIC: [], DESIGN: [], READY_TO_WEAR: [] },
  });
  const [requests, setRequests] = useState<any[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  const catalogByType = useMemo(() => {
    return PRODUCT_TYPES.reduce(
      (acc, productType) => {
        acc[productType] = fieldCatalog.filter((entry) => entry.productType === productType);
        return acc;
      },
      {} as Record<ProductType, FieldCatalogEntry[]>
    );
  }, [fieldCatalog]);

  const loadConfig = async () => {
    const response = await api.productChangeRequests.getAdminConfig();
    if (!response.success) return;
    const payload = response.data || {};
    setFieldCatalog(Array.isArray(payload.fieldCatalog) ? payload.fieldCatalog : []);
    setDefaultGrantDurationHours(Math.max(1, Number(payload.defaultGrantDurationHours || 48)));
    setAllowedFieldsByRole({
      FABRIC_SELLER: {
        FABRIC: Array.isArray(payload.allowedFieldsByRole?.FABRIC_SELLER?.FABRIC)
          ? payload.allowedFieldsByRole.FABRIC_SELLER.FABRIC
          : [],
        DESIGN: Array.isArray(payload.allowedFieldsByRole?.FABRIC_SELLER?.DESIGN)
          ? payload.allowedFieldsByRole.FABRIC_SELLER.DESIGN
          : [],
        READY_TO_WEAR: Array.isArray(payload.allowedFieldsByRole?.FABRIC_SELLER?.READY_TO_WEAR)
          ? payload.allowedFieldsByRole.FABRIC_SELLER.READY_TO_WEAR
          : [],
      },
      FASHION_DESIGNER: {
        FABRIC: Array.isArray(payload.allowedFieldsByRole?.FASHION_DESIGNER?.FABRIC)
          ? payload.allowedFieldsByRole.FASHION_DESIGNER.FABRIC
          : [],
        DESIGN: Array.isArray(payload.allowedFieldsByRole?.FASHION_DESIGNER?.DESIGN)
          ? payload.allowedFieldsByRole.FASHION_DESIGNER.DESIGN
          : [],
        READY_TO_WEAR: Array.isArray(payload.allowedFieldsByRole?.FASHION_DESIGNER?.READY_TO_WEAR)
          ? payload.allowedFieldsByRole.FASHION_DESIGNER.READY_TO_WEAR
          : [],
      },
    });
  };

  const loadRequests = async () => {
    const response = await api.productChangeRequests.listAdminRequests({
      status: 'PENDING',
      role: (roleFilter as VendorRole) || undefined,
      search: search || undefined,
      page: 1,
      limit: 100,
    });
    if (!response.success) return;
    const rows = Array.isArray(response.data?.requests) ? response.data.requests : [];
    setRequests(rows);
    setReviewDrafts((previous) => {
      const next: Record<string, ReviewDraft> = {};
      for (const row of rows) {
        const existing = previous[row.id];
        next[row.id] = existing || {
          grantAllChanges: Boolean(row.grantAllChanges),
          grantedFields: Array.isArray(row.requestedFields) ? row.requestedFields : [],
          grantDurationHours: Math.max(1, Number(defaultGrantDurationHours || 48)),
          reviewNote: '',
        };
      }
      return next;
    });
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError('');
        await loadConfig();
        await loadRequests();
      } catch (issue: any) {
        setError(issue?.response?.data?.message || issue?.message || 'Unable to load product change request data.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [roleFilter]);

  const togglePolicyField = (role: VendorRole, productType: ProductType, fieldKey: string) => {
    setAllowedFieldsByRole((prev) => {
      const current = prev[role][productType] || [];
      const next = current.includes(fieldKey) ? current.filter((entry) => entry !== fieldKey) : [...current, fieldKey];
      return {
        ...prev,
        [role]: {
          ...prev[role],
          [productType]: next,
        },
      };
    });
  };

  const toggleReviewField = (requestId: string, fieldKey: string) => {
    setReviewDrafts((prev) => {
      const current = prev[requestId] || {
        grantAllChanges: false,
        grantedFields: [],
        grantDurationHours: Math.max(1, Number(defaultGrantDurationHours || 48)),
        reviewNote: '',
      };
      const nextFields = current.grantedFields.includes(fieldKey)
        ? current.grantedFields.filter((entry) => entry !== fieldKey)
        : [...current.grantedFields, fieldKey];
      return {
        ...prev,
        [requestId]: { ...current, grantedFields: nextFields },
      };
    });
  };

  const saveConfig = async () => {
    try {
      setSavingConfig(true);
      setError('');
      setSuccess('');
      const response = await api.productChangeRequests.updateAdminConfig({
        defaultGrantDurationHours: Math.max(1, Number(defaultGrantDurationHours || 48)),
        allowedFieldsByRole,
      });
      if (!response.success) {
        setError(response.message || 'Unable to save product edit policy.');
        return;
      }
      setSuccess(response.message || 'Product edit policy updated.');
      await loadConfig();
    } catch (issue: any) {
      setError(issue?.response?.data?.message || issue?.message || 'Unable to save product edit policy.');
    } finally {
      setSavingConfig(false);
    }
  };

  const reviewRequest = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    const draft = reviewDrafts[requestId];
    if (!draft) return;
    try {
      setReviewingId(requestId);
      setError('');
      setSuccess('');
      const response = await api.productChangeRequests.reviewAdminRequest(requestId, {
        status,
        reviewNote: draft.reviewNote || undefined,
        grantAllChanges: status === 'APPROVED' ? draft.grantAllChanges : undefined,
        grantedFields: status === 'APPROVED' ? draft.grantedFields : undefined,
        grantDurationHours: status === 'APPROVED' ? Math.max(1, Number(draft.grantDurationHours || defaultGrantDurationHours)) : undefined,
      });
      if (!response.success) {
        setError(response.message || 'Unable to review change request.');
        return;
      }
      setSuccess(response.message || 'Change request updated.');
      await loadRequests();
    } catch (issue: any) {
      setError(issue?.response?.data?.message || issue?.message || 'Unable to review change request.');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Change Request</h1>
        <p className="text-sm text-gray-600">Review pending vendor edit-access requests and manage default editable fields per role.</p>
      </div>

      <div className="rounded-xl border bg-white p-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('REQUESTS')}
            className={`rounded border px-3 py-1.5 text-sm ${
              activeTab === 'REQUESTS'
                ? 'border-black bg-black text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            Change Request List
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('POLICY')}
            className={`rounded border px-3 py-1.5 text-sm ${
              activeTab === 'POLICY'
                ? 'border-black bg-black text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            Default Vendor Edit Policy
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

      {activeTab === 'POLICY' ? (
      <div className="rounded-xl border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Default Vendor Edit Policy</h2>
          <Button onClick={saveConfig} disabled={savingConfig}>
            <Save className="mr-2 h-4 w-4" />
            {savingConfig ? 'Saving...' : 'Save Policy'}
          </Button>
        </div>
        <label className="mb-4 block text-sm text-gray-700">
          Default grant timeframe (hours)
          <input
            type="number"
            min={1}
            max={720}
            value={defaultGrantDurationHours}
            onChange={(event) => setDefaultGrantDurationHours(Math.max(1, Number(event.target.value || 48)))}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          {VENDOR_ROLES.map((role) => (
            <div key={role} className="rounded-lg border p-3">
              <h3 className="text-sm font-semibold text-gray-900">{role === 'FABRIC_SELLER' ? 'Seller' : 'Designer'}</h3>
              <div className="mt-3 space-y-3">
                {PRODUCT_TYPES.map((productType) => (
                  <div key={`${role}-${productType}`} className="rounded border p-2">
                    <p className="text-xs font-semibold text-gray-800">{productType}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(catalogByType[productType] || []).map((entry) => (
                        <label key={`${role}-${productType}-${entry.key}`} className="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs">
                          <input
                            type="checkbox"
                            checked={(allowedFieldsByRole[role][productType] || []).includes(entry.key)}
                            onChange={() => togglePolicyField(role, productType, entry.key)}
                          />
                          {entry.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {activeTab === 'REQUESTS' ? (
      <div className="rounded-xl border bg-white p-5">
        <p className="mb-3 text-xs text-gray-500">
          Showing only <span className="font-semibold text-gray-700">pending</span> requests. Approved/rejected requests are logged under Activity Logs.
        </p>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700">
            Role
            <select className="mt-1 rounded-lg border px-3 py-2" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="">All</option>
              <option value="FABRIC_SELLER">Seller</option>
              <option value="FASHION_DESIGNER">Designer</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Search
            <input
              className="mt-1 rounded-lg border px-3 py-2"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Email, name, product..."
            />
          </label>
          <Button variant="outline" onClick={() => void loadRequests()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500">No product change requests found.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((row) => {
              const draft = reviewDrafts[row.id];
              const productType = (row.productType || 'FABRIC') as ProductType;
              const rowCatalog = catalogByType[productType] || [];
              return (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{row.productName || row.productId}</p>
                      <p className="text-xs text-gray-500">
                        {row.requesterName} • {row.requesterRole} • {row.productType} • Status: {row.status}
                      </p>
                      <p className="mt-2 text-sm text-gray-700">{row.message}</p>
                    </div>
                    <div className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded border p-2 text-xs">
                      <p className="font-semibold text-gray-800">Requested fields</p>
                      <p className="mt-1 text-gray-600">{(row.requestedFields || []).join(', ') || 'Not specified'}</p>
                    </div>
                    <label className="rounded border p-2 text-xs text-gray-700">
                      Grant timeframe (hours)
                      <input
                        type="number"
                        min={1}
                        max={720}
                        value={Number(draft?.grantDurationHours || defaultGrantDurationHours)}
                        onChange={(event) =>
                          setReviewDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...(prev[row.id] || {
                                grantAllChanges: false,
                                grantedFields: [],
                                grantDurationHours: defaultGrantDurationHours,
                                reviewNote: '',
                              }),
                              grantDurationHours: Math.max(1, Number(event.target.value || defaultGrantDurationHours)),
                            },
                          }))
                        }
                        className="mt-1 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="rounded border p-2 text-xs">
                      <span className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(draft?.grantAllChanges)}
                          onChange={(event) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...(prev[row.id] || {
                                  grantAllChanges: false,
                                  grantedFields: [],
                                  grantDurationHours: defaultGrantDurationHours,
                                  reviewNote: '',
                                }),
                                grantAllChanges: event.target.checked,
                              },
                            }))
                          }
                        />
                        Grant full edit access
                      </span>
                    </label>
                  </div>
                  {!draft?.grantAllChanges ? (
                    <div className="mt-3 rounded border p-2">
                      <p className="text-xs font-semibold text-gray-800">Granted fields</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rowCatalog.map((entry) => (
                          <label key={`${row.id}-${entry.key}`} className="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs">
                            <input
                              type="checkbox"
                              checked={Boolean(draft?.grantedFields?.includes(entry.key))}
                              onChange={() => toggleReviewField(row.id, entry.key)}
                            />
                            {entry.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <textarea
                    className="mt-3 h-20 w-full rounded border px-3 py-2 text-sm"
                    placeholder="Review note (optional)"
                    value={draft?.reviewNote || ''}
                    onChange={(event) =>
                      setReviewDrafts((prev) => ({
                        ...prev,
                        [row.id]: {
                          ...(prev[row.id] || {
                            grantAllChanges: false,
                            grantedFields: [],
                            grantDurationHours: defaultGrantDurationHours,
                            reviewNote: '',
                          }),
                          reviewNote: event.target.value,
                        },
                      }))
                    }
                  />
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void reviewRequest(row.id, 'REJECTED')}
                      disabled={reviewingId === row.id}
                    >
                      Reject
                    </Button>
                    <Button onClick={() => void reviewRequest(row.id, 'APPROVED')} disabled={reviewingId === row.id}>
                      {reviewingId === row.id ? 'Saving...' : 'Approve & Grant Access'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      ) : null}
    </div>
  );
}
