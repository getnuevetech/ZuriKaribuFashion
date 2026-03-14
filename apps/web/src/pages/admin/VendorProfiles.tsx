import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { api } from '../../services/api';
import { getCityOptionsByCountryCode, getCountryOptions, resolveCountryCode, resolveCountryName } from '../../data/locationOptions';

type VendorRole = 'FABRIC_SELLER' | 'FASHION_DESIGNER';
type VendorProfileStatus = 'INCOMPLETE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type FieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'EMAIL'
  | 'PHONE'
  | 'URL'
  | 'DOCUMENT'
  | 'IMAGE'
  | 'IMAGE_DOCUMENT';

const FIELD_TYPES: FieldType[] = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
  'EMAIL',
  'PHONE',
  'URL',
  'DOCUMENT',
  'IMAGE',
  'IMAGE_DOCUMENT',
];

const REJECTION_REASON_OPTIONS = [
  { code: 'DOCUMENT_MISSING', label: 'Missing required documents' },
  { code: 'DOCUMENT_INVALID', label: 'Invalid/expired documents' },
  { code: 'IDENTITY_MISMATCH', label: 'Identity mismatch' },
  { code: 'BUSINESS_INFO_MISMATCH', label: 'Business information mismatch' },
  { code: 'LOW_INFORMATION_QUALITY', label: 'Insufficient profile details' },
  { code: 'COMPLIANCE_RISK', label: 'Compliance/risk concern' },
  { code: 'OTHER', label: 'Other' },
] as const;

type DashboardToggleMap = Record<string, boolean>;
type DashboardFieldMode = 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
type DashboardFieldModeMap = Record<string, DashboardFieldMode>;
type RoleDashboardGovernance = {
  tabs: DashboardToggleMap;
  sections: DashboardToggleMap;
  actions: DashboardToggleMap;
  fields: DashboardFieldModeMap;
};
type DashboardGovernanceSettings = {
  seller: RoleDashboardGovernance;
  designer: RoleDashboardGovernance;
};

const DEFAULT_DASHBOARD_GOVERNANCE_SETTINGS: DashboardGovernanceSettings = {
  seller: {
    tabs: { overview: true, fabrics: true, featured: true, orders: true, tryon: true },
    sections: {
      profileGovernance: true,
      stats: true,
      overviewLowStockAlert: true,
      overviewCharts: true,
      overviewRecentOrders: true,
      overviewActivity: true,
      overviewTryOnInsights: true,
      tryOnInsightsSummary: true,
      tryOnInsightsRecent: true,
      fabricsTable: true,
      featuredTable: true,
      ordersTable: true,
    },
    actions: {
      submitProfile: true,
      addProduct: true,
      editProduct: true,
      updateStock: true,
      updateOrderStatus: true,
    },
    fields: {
      productName: 'ENABLED',
      productDescription: 'ENABLED',
      materialType: 'ENABLED',
      sellerPrice: 'ENABLED',
      listingCurrency: 'ENABLED',
      minYards: 'ENABLED',
      stockYards: 'ENABLED',
      productImages: 'ENABLED',
    },
  },
  designer: {
    tabs: { overview: true, designs: true, featured: true, orders: true, tryon: true },
    sections: {
      profileGovernance: true,
      stats: true,
      overviewOrderStatus: true,
      overviewRevenueChart: true,
      overviewTopDesigns: true,
      overviewActivity: true,
      overviewPendingOrdersAlert: true,
      overviewTryOnInsights: true,
      tryOnInsightsSummary: true,
      tryOnInsightsRecent: true,
      productsTable: true,
      featuredTable: true,
      ordersTable: true,
      fabricCountryAccess: true,
      readyStockModal: true,
    },
    actions: {
      submitProfile: true,
      addDesignProduct: true,
      addReadyToWearProduct: true,
      editDesignProduct: true,
      editReadyToWearProduct: true,
      manageReadyStock: true,
      requestFabricCountryAccess: true,
      updateOrderStatus: true,
    },
    fields: {
      designName: 'ENABLED',
      designDescription: 'ENABLED',
      designStyle: 'ENABLED',
      designBasePrice: 'ENABLED',
      designListingCurrency: 'ENABLED',
      designImages: 'ENABLED',
      designSuitableFabrics: 'ENABLED',
      designMeasurementVariables: 'ENABLED',
      readyName: 'ENABLED',
      readyDescription: 'ENABLED',
      readyStyle: 'ENABLED',
      readyBasePrice: 'ENABLED',
      readyListingCurrency: 'ENABLED',
      readyImages: 'ENABLED',
      readyVariants: 'ENABLED',
    },
  },
};

const GOVERNANCE_LABELS = {
  seller: {
    tabs: {
      overview: 'Overview tab',
      fabrics: 'Fabrics tab',
      featured: 'Featured tab',
      orders: 'Orders tab',
      tryon: '3D TryON tab',
    },
    sections: {
      profileGovernance: 'Vendor governance profile card',
      stats: 'Stats cards',
      overviewLowStockAlert: 'Low-stock alert',
      overviewCharts: 'Overview charts',
      overviewRecentOrders: 'Recent orders panel',
      overviewActivity: 'Activity feed',
      overviewTryOnInsights: 'TryON insights panel',
      tryOnInsightsSummary: 'TryON summary cards',
      tryOnInsightsRecent: 'TryON recent activity table',
      fabricsTable: 'Fabrics table',
      featuredTable: 'Featured products table',
      ordersTable: 'Orders table',
    },
    actions: {
      submitProfile: 'Submit profile for approval',
      addProduct: 'Add new fabric',
      editProduct: 'Edit fabric',
      updateStock: 'Update stock',
      updateOrderStatus: 'Update order status',
    },
    fields: {
      productName: 'Product name field',
      productDescription: 'Product description field',
      materialType: 'Material type field',
      sellerPrice: 'Seller price field',
      listingCurrency: 'Listing currency field',
      minYards: 'Minimum yards field',
      stockYards: 'Stock yards field',
      productImages: 'Product images field',
    },
  },
  designer: {
    tabs: {
      overview: 'Overview tab',
      designs: 'Products tab',
      featured: 'Featured tab',
      orders: 'Orders tab',
      tryon: '3D TryON tab',
    },
    sections: {
      profileGovernance: 'Vendor governance profile card',
      stats: 'Stats cards',
      overviewOrderStatus: 'Order status widget',
      overviewRevenueChart: 'Revenue chart',
      overviewTopDesigns: 'Top designs chart',
      overviewActivity: 'Activity feed',
      overviewPendingOrdersAlert: 'Pending order alert',
      overviewTryOnInsights: 'TryON insights panel',
      tryOnInsightsSummary: 'TryON summary cards',
      tryOnInsightsRecent: 'TryON recent activity table',
      productsTable: 'Products table',
      featuredTable: 'Featured products table',
      ordersTable: 'Orders table',
      fabricCountryAccess: 'Fabric country access request panel',
      readyStockModal: 'Ready-to-wear stock modal',
    },
    actions: {
      submitProfile: 'Submit profile for approval',
      addDesignProduct: 'Add custom-to-wear product',
      addReadyToWearProduct: 'Add ready-to-wear product',
      editDesignProduct: 'Edit custom-to-wear product',
      editReadyToWearProduct: 'Edit ready-to-wear product',
      manageReadyStock: 'Manage ready-to-wear stock',
      requestFabricCountryAccess: 'Request additional fabric countries',
      updateOrderStatus: 'Update order status',
    },
    fields: {
      designName: 'Design name field',
      designDescription: 'Design description field',
      designStyle: 'Design style field',
      designBasePrice: 'Design base price field',
      designListingCurrency: 'Design listing currency field',
      designImages: 'Design images field',
      designSuitableFabrics: 'Suitable fabrics picker',
      designMeasurementVariables: 'Measurement templates picker',
      readyName: 'RTW name field',
      readyDescription: 'RTW description field',
      readyStyle: 'RTW style field',
      readyBasePrice: 'RTW base price field',
      readyListingCurrency: 'RTW listing currency field',
      readyImages: 'RTW images field',
      readyVariants: 'RTW variants/size rows',
    },
  },
} as const;

const normalizeFieldMode = (value: unknown): DashboardFieldMode => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'READ_ONLY') return 'READ_ONLY';
  if (normalized === 'HIDDEN') return 'HIDDEN';
  if (normalized === 'ENABLED') return 'ENABLED';
  if (typeof value === 'boolean') return value ? 'ENABLED' : 'HIDDEN';
  return 'ENABLED';
};

const mergeRoleGovernance = (defaults: RoleDashboardGovernance, input: any): RoleDashboardGovernance => ({
  tabs: { ...defaults.tabs, ...(input?.tabs || {}) },
  sections: { ...defaults.sections, ...(input?.sections || {}) },
  actions: { ...defaults.actions, ...(input?.actions || {}) },
  fields: Object.keys(defaults.fields).reduce((acc, key) => {
    acc[key] = normalizeFieldMode(input?.fields?.[key] ?? defaults.fields[key]);
    return acc;
  }, {} as DashboardFieldModeMap),
});

const normalizeDashboardGovernance = (input: any): DashboardGovernanceSettings => ({
  seller: mergeRoleGovernance(DEFAULT_DASHBOARD_GOVERNANCE_SETTINGS.seller, input?.seller),
  designer: mergeRoleGovernance(DEFAULT_DASHBOARD_GOVERNANCE_SETTINGS.designer, input?.designer),
});

export default function AdminVendorProfiles() {
  const [tab, setTab] = useState<'fields' | 'reviews' | 'dashboard' | 'accounts'>('fields');
  const [role, setRole] = useState<VendorRole>('FABRIC_SELLER');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fields, setFields] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<VendorProfileStatus | ''>('SUBMITTED');
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewReasonCode, setReviewReasonCode] = useState('');
  const [reviewMessageHtml, setReviewMessageHtml] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const messageEditorRef = useRef<HTMLDivElement | null>(null);
  const [dashboardGovernance, setDashboardGovernance] = useState<DashboardGovernanceSettings>(
    DEFAULT_DASHBOARD_GOVERNANCE_SETTINGS
  );
  const [savingDashboardGovernance, setSavingDashboardGovernance] = useState(false);
  const [vendorAccounts, setVendorAccounts] = useState<any[]>([]);
  const [vendorAccountSearch, setVendorAccountSearch] = useState('');
  const [vendorAccountStatusFilter, setVendorAccountStatusFilter] = useState('');
  const [showVendorAccountModal, setShowVendorAccountModal] = useState(false);
  const [savingVendorAccount, setSavingVendorAccount] = useState(false);
  const [vendorAccountForm, setVendorAccountForm] = useState({
    id: '',
    role: 'FABRIC_SELLER' as VendorRole,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    status: 'ACTIVE',
  });
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({
    role: 'FABRIC_SELLER' as VendorRole,
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    businessName: '',
    country: '',
    city: '',
    address: '',
    phone: '',
  });
  const countryOptions = useMemo(() => getCountryOptions(), []);
  const newVendorCountryCode = resolveCountryCode(newVendor.country);
  const cityOptions = useMemo(() => getCityOptionsByCountryCode(newVendorCountryCode), [newVendorCountryCode]);

  const roleLabel = role === 'FABRIC_SELLER' ? 'Fabric Seller' : 'Fashion Designer';

  const loadFields = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.admin.getVendorProfileFields(role);
      if (res.success) {
        setFields((res.data?.fields || []).map((row: any, index: number) => ({ ...row, sortOrder: row.sortOrder ?? index + 1 })));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load vendor profile fields.');
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.admin.getVendorProfiles({
        role,
        status: statusFilter || undefined,
        page: 1,
        limit: 100,
      });
      if (res.success) {
        setProfiles(res.data?.profiles || []);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load vendor profile submissions.');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardGovernance = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.admin.getVendorDashboardGovernance();
      if (res.success) {
        setDashboardGovernance(normalizeDashboardGovernance(res.data?.settings || res.data));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load dashboard governance settings.');
    } finally {
      setLoading(false);
    }
  };

  const loadVendorAccounts = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await api.admin.getUsers({
        search: vendorAccountSearch || undefined,
        status: vendorAccountStatusFilter || undefined,
        page: 1,
        limit: 200,
      });
      const rows = Array.isArray(response?.data?.users) ? response.data.users : [];
      const filtered = rows.filter((user: any) => {
        const roleValue = String(user?.role || '').toUpperCase();
        return roleValue === 'FABRIC_SELLER' || roleValue === 'FASHION_DESIGNER';
      });
      setVendorAccounts(filtered);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load vendor accounts.');
      setVendorAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'fields') {
      void loadFields();
    } else if (tab === 'reviews') {
      void loadProfiles();
    } else if (tab === 'dashboard') {
      void loadDashboardGovernance();
    } else {
      void loadVendorAccounts();
    }
  }, [tab, role, statusFilter, vendorAccountSearch, vendorAccountStatusFilter]);

  const saveDashboardGovernance = async () => {
    setSavingDashboardGovernance(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.admin.updateVendorDashboardGovernance(dashboardGovernance);
      setDashboardGovernance(normalizeDashboardGovernance(response.data || dashboardGovernance));
      setSuccess('Dashboard governance settings updated successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save dashboard governance settings.');
    } finally {
      setSavingDashboardGovernance(false);
    }
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: `custom_${prev.length + 1}`,
        label: 'New Field',
        fieldType: 'TEXT',
        required: false,
        options: null,
        sortOrder: prev.length + 1,
        isActive: true,
      },
    ]);
  };

  const openVendorAccountModal = (account: any) => {
    const roleValue = String(account?.role || '').toUpperCase() === 'FABRIC_SELLER' ? 'FABRIC_SELLER' : 'FASHION_DESIGNER';
    setVendorAccountForm({
      id: String(account?.id || ''),
      role: roleValue,
      firstName: String(account?.firstName || ''),
      lastName: String(account?.lastName || ''),
      email: String(account?.email || ''),
      phone: String(account?.phone || ''),
      status: String(account?.status || 'ACTIVE').toUpperCase(),
    });
    setShowVendorAccountModal(true);
  };

  const saveVendorAccount = async () => {
    if (!vendorAccountForm.id) return;
    setSavingVendorAccount(true);
    setError('');
    try {
      await api.admin.updateUser(vendorAccountForm.id, {
        firstName: vendorAccountForm.firstName.trim(),
        lastName: vendorAccountForm.lastName.trim(),
        email: vendorAccountForm.email.trim(),
        phone: vendorAccountForm.phone.trim() || null,
        role: vendorAccountForm.role,
        status: vendorAccountForm.status,
      });
      setSuccess('Vendor account updated successfully.');
      setShowVendorAccountModal(false);
      await loadVendorAccounts();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update vendor account.');
    } finally {
      setSavingVendorAccount(false);
    }
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, idx) => idx !== index).map((row, idx) => ({ ...row, sortOrder: idx + 1 })));
  };

  const saveFields = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = fields.map((field, index) => ({
        key: String(field.key || '').trim(),
        label: String(field.label || '').trim(),
        fieldType: field.fieldType || 'TEXT',
        required: Boolean(field.required),
        placeholder: field.placeholder || '',
        helpText: field.helpText || '',
        options:
          field.fieldType === 'SELECT' || field.fieldType === 'MULTI_SELECT'
            ? String(field.optionsText || field.options || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : [],
        sortOrder: index + 1,
        isActive: field.isActive !== false,
      }));
      await api.admin.updateVendorProfileFields(role, payload);
      setSuccess(`${roleLabel} profile fields updated successfully.`);
      await loadFields();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save fields.');
    } finally {
      setSaving(false);
    }
  };

  const openProfile = async (entry: any) => {
    setSelectedProfile(null);
    setReviewNotes('');
    setReviewReasonCode('');
    setReviewMessageHtml('');
    setError('');
    try {
      const res = await api.admin.getVendorProfileDetails(entry.role, entry.userId);
      if (res.success) {
        setSelectedProfile(res.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load profile details.');
    }
  };

  const applyMessageFormat = (command: 'bold' | 'italic' | 'insertUnorderedList') => {
    messageEditorRef.current?.focus();
    try {
      document.execCommand(command, false);
      setReviewMessageHtml(String(messageEditorRef.current?.innerHTML || '').trim());
    } catch {
      // no-op
    }
  };

  const reviewProfile = async (status: 'APPROVED' | 'REJECTED', rejectionType?: 'TEMPORARY' | 'PERMANENT') => {
    if (!selectedProfile?.role || !selectedProfile?.user?.id) return;
    const selectedReason = REJECTION_REASON_OPTIONS.find((entry) => entry.code === reviewReasonCode);
    if (status === 'REJECTED' && !selectedReason) {
      setError('Please select a rejection reason.');
      return;
    }
    setReviewing(true);
    setError('');
    try {
      await api.admin.reviewVendorProfile(selectedProfile.role, selectedProfile.user.id, {
        status,
        notes: reviewNotes || undefined,
        rejectionType: status === 'REJECTED' ? rejectionType || 'TEMPORARY' : undefined,
        rejectionReasonCode: status === 'REJECTED' ? selectedReason?.code : undefined,
        rejectionReasonLabel: status === 'REJECTED' ? selectedReason?.label : undefined,
        messageHtml: status === 'REJECTED' ? (reviewMessageHtml || undefined) : undefined,
      });
      setSelectedProfile(null);
      setSuccess(
        status === 'REJECTED'
          ? rejectionType === 'PERMANENT'
            ? 'Vendor profile permanently rejected.'
            : 'Vendor profile temporarily rejected for correction.'
          : `Vendor profile ${status.toLowerCase()} successfully.`
      );
      await loadProfiles();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to review vendor profile.');
    } finally {
      setReviewing(false);
    }
  };

  const statusVariant = (status: VendorProfileStatus) => {
    if (status === 'APPROVED') return 'green';
    if (status === 'SUBMITTED') return 'yellow';
    if (status === 'REJECTED') return 'red';
    return 'gray';
  };

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [fields]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Profile Governance</h1>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setShowAddVendorModal(true)}>
            Add Vendor
          </Button>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as VendorRole)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="FABRIC_SELLER">Fabric Seller</option>
            <option value="FASHION_DESIGNER">Fashion Designer</option>
          </select>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-6">
          <button
            onClick={() => setTab('fields')}
            className={`pb-3 text-sm font-medium ${tab === 'fields' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-500'}`}
          >
            Profile Field Builder
          </button>
          <button
            onClick={() => setTab('reviews')}
            className={`pb-3 text-sm font-medium ${tab === 'reviews' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-500'}`}
          >
            Profile Reviews
          </button>
          <button
            onClick={() => setTab('dashboard')}
            className={`pb-3 text-sm font-medium ${tab === 'dashboard' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-500'}`}
          >
            Dashboard Controls
          </button>
          <button
            onClick={() => setTab('accounts')}
            className={`pb-3 text-sm font-medium ${tab === 'accounts' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-500'}`}
          >
            Vendor Accounts
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
        </div>
      ) : null}

      {!loading && tab === 'fields' && (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Admin-defined required fields for <span className="font-medium">{roleLabel}</span> full profile completion.
            </p>
            <Button size="sm" variant="outline" type="button" onClick={addField}>
              Add Field
            </Button>
          </div>

          <div className="space-y-3">
            {sortedFields.map((field, index) => (
              <div key={`${field.id || field.key}-${index}`} className="rounded-lg border p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input
                    value={field.key || ''}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((row, idx) => (idx === index ? { ...row, key: e.target.value } : row))
                      )
                    }
                    placeholder="field_key"
                    className="rounded border px-2 py-1.5 text-sm"
                  />
                  <input
                    value={field.label || ''}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((row, idx) => (idx === index ? { ...row, label: e.target.value } : row))
                      )
                    }
                    placeholder="Field label"
                    className="rounded border px-2 py-1.5 text-sm"
                  />
                  <select
                    value={field.fieldType || 'TEXT'}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((row, idx) =>
                          idx === index ? { ...row, fieldType: e.target.value as FieldType } : row
                        )
                      )
                    }
                    className="rounded border px-2 py-1.5 text-sm"
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === 'IMAGE_DOCUMENT' ? 'IMAGE/DOCUMENT' : type}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={Boolean(field.required)}
                        onChange={(e) =>
                          setFields((prev) =>
                            prev.map((row, idx) => (idx === index ? { ...row, required: e.target.checked } : row))
                          )
                        }
                      />
                      Required
                    </label>
                    <Button size="sm" variant="outline" type="button" onClick={() => removeField(index)}>
                      Remove
                    </Button>
                  </div>
                </div>
                {(field.fieldType === 'SELECT' || field.fieldType === 'MULTI_SELECT') && (
                  <input
                    value={field.optionsText || (Array.isArray(field.options) ? field.options.join(', ') : '')}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((row, idx) => (idx === index ? { ...row, optionsText: e.target.value } : row))
                      )
                    }
                    placeholder="Options, comma separated"
                    className="mt-2 w-full rounded border px-2 py-1.5 text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={saveFields} disabled={saving}>
              {saving ? 'Saving...' : 'Save Field Configuration'}
            </Button>
          </div>
        </div>
      )}

      {!loading && tab === 'reviews' && (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Review submitted vendor profiles and approve/reject.</p>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VendorProfileStatus | '')}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="INCOMPLETE">INCOMPLETE</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Vendor</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Brand</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Submitted</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={`${profile.role}:${profile.userId}`} className="border-t">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900">
                        {`${profile.user?.firstName || ''} ${profile.user?.lastName || ''}`.trim() || profile.user?.email}
                      </p>
                      <p className="text-xs text-gray-500">{profile.user?.email}</p>
                    </td>
                    <td className="py-2 pr-3">{profile.role === 'FABRIC_SELLER' ? 'Seller' : 'Designer'}</td>
                    <td className="py-2 pr-3">{profile.businessName || '-'}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={statusVariant(profile.profileStatus)}>{profile.profileStatus}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {profile.profileSubmittedAt ? new Date(profile.profileSubmittedAt).toLocaleString() : '-'}
                    </td>
                    <td className="py-2">
                      <Button size="sm" variant="outline" onClick={() => openProfile(profile)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No vendor profiles found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'dashboard' && (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-600">
            Configure seller/designer dashboard tabs, sections, actions, and per-field modes (enabled, read-only, hidden).
          </p>
          {(() => {
            const roleKey = role === 'FABRIC_SELLER' ? 'seller' : 'designer';
            const roleGovernance = dashboardGovernance[roleKey];
            const roleLabels = GOVERNANCE_LABELS[roleKey];
            const groups: Array<{ key: keyof RoleDashboardGovernance; title: string }> = [
              { key: 'tabs', title: 'Tabs' },
              { key: 'sections', title: 'Sections' },
              { key: 'actions', title: 'Actions' },
              { key: 'fields', title: 'Variables / Form Fields' },
            ];
            return (
              <div className="space-y-4">
                {groups.map((group) => {
                  const values = roleGovernance[group.key] || {};
                  const labelMap = roleLabels[group.key] || {};
                  return (
                    <div key={group.key} className="rounded-lg border p-3">
                      <h3 className="mb-3 text-sm font-semibold text-gray-900">{group.title}</h3>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {Object.keys(values).map((toggleKey) => (
                          <label
                            key={`${group.key}-${toggleKey}`}
                            className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                          >
                            <span>{(labelMap as any)?.[toggleKey] || toggleKey}</span>
                            {group.key === 'fields' ? (
                              <select
                                value={String((values as DashboardFieldModeMap)[toggleKey] || 'ENABLED')}
                                onChange={(event) =>
                                  setDashboardGovernance((previous) => ({
                                    ...previous,
                                    [roleKey]: {
                                      ...previous[roleKey],
                                      [group.key]: {
                                        ...previous[roleKey][group.key],
                                        [toggleKey]: normalizeFieldMode(event.target.value),
                                      },
                                    },
                                  }))
                                }
                                className="rounded border px-2 py-1 text-xs"
                              >
                                <option value="ENABLED">Enabled</option>
                                <option value="READ_ONLY">Read only</option>
                                <option value="HIDDEN">Hidden</option>
                              </select>
                            ) : (
                              <input
                                type="checkbox"
                                checked={Boolean((values as DashboardToggleMap)[toggleKey])}
                                onChange={(event) =>
                                  setDashboardGovernance((previous) => ({
                                    ...previous,
                                    [roleKey]: {
                                      ...previous[roleKey],
                                      [group.key]: {
                                        ...previous[roleKey][group.key],
                                        [toggleKey]: event.target.checked,
                                      },
                                    },
                                  }))
                                }
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-end">
                  <Button onClick={saveDashboardGovernance} disabled={savingDashboardGovernance}>
                    {savingDashboardGovernance ? 'Saving...' : `Save ${roleLabel} Dashboard Controls`}
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {!loading && tab === 'accounts' && (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">All Fabric Seller and Fashion Designer accounts are managed here.</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={vendorAccountSearch}
                onChange={(e) => setVendorAccountSearch(e.target.value)}
                placeholder="Search vendor accounts..."
                className="rounded border px-3 py-2 text-sm"
              />
              <select
                value={vendorAccountStatusFilter}
                onChange={(e) => setVendorAccountStatusFilter(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Joined</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {vendorAccounts.map((account) => (
                  <tr key={String(account.id)} className="border-t">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900">
                        {`${account.firstName || ''} ${account.lastName || ''}`.trim() || account.email}
                      </p>
                      <p className="text-xs text-gray-500">{account.email}</p>
                    </td>
                    <td className="py-2 pr-3">
                      {String(account.role || '').toUpperCase() === 'FABRIC_SELLER' ? 'Fabric Seller' : 'Fashion Designer'}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          String(account.status || '').toUpperCase() === 'ACTIVE'
                            ? 'green'
                            : String(account.status || '').toUpperCase() === 'SUSPENDED'
                              ? 'red'
                              : String(account.status || '').toUpperCase() === 'REJECTED'
                                ? 'gray'
                                : 'yellow'
                        }
                      >
                        {String(account.status || 'PENDING').toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {account.createdAt ? new Date(account.createdAt).toLocaleString() : '-'}
                    </td>
                    <td className="py-2">
                      <Button size="sm" variant="outline" onClick={() => openVendorAccountModal(account)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {vendorAccounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No vendor accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showVendorAccountModal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Edit Vendor Account</h3>
              <Button size="sm" variant="outline" onClick={() => setShowVendorAccountModal(false)}>
                Close
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={vendorAccountForm.firstName}
                onChange={(e) => setVendorAccountForm((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="First name"
                className="rounded border px-3 py-2 text-sm"
              />
              <input
                value={vendorAccountForm.lastName}
                onChange={(e) => setVendorAccountForm((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Last name"
                className="rounded border px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={vendorAccountForm.email}
                onChange={(e) => setVendorAccountForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                className="rounded border px-3 py-2 text-sm md:col-span-2"
              />
              <input
                value={vendorAccountForm.phone}
                onChange={(e) => setVendorAccountForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone"
                className="rounded border px-3 py-2 text-sm"
              />
              <select
                value={vendorAccountForm.role}
                onChange={(e) => setVendorAccountForm((prev) => ({ ...prev, role: e.target.value as VendorRole }))}
                className="rounded border px-3 py-2 text-sm"
              >
                <option value="FABRIC_SELLER">Fabric Seller</option>
                <option value="FASHION_DESIGNER">Fashion Designer</option>
              </select>
              <select
                value={vendorAccountForm.status}
                onChange={(e) => setVendorAccountForm((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded border px-3 py-2 text-sm md:col-span-2"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowVendorAccountModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={saveVendorAccount} disabled={savingVendorAccount}>
                {savingVendorAccount ? 'Saving...' : 'Save Vendor Account'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedProfile && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-4xl rounded-xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Vendor Profile Review</h3>
                <p className="text-sm text-gray-500">
                  {(selectedProfile.role === 'FABRIC_SELLER' ? 'Seller' : 'Designer')} • {selectedProfile.user?.email}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedProfile(null)}>
                Close
              </Button>
            </div>

            <div className="mb-4 rounded-lg border bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">
                {`${selectedProfile.user?.firstName || ''} ${selectedProfile.user?.lastName || ''}`.trim() || 'Vendor'}
              </p>
              <p className="text-gray-600">Brand: {selectedProfile.profile?.businessName || '-'}</p>
              <p className="text-gray-600">Status: {selectedProfile.profile?.profileStatus || '-'}</p>
              {selectedProfile.profile?.rejectionType ? (
                <p className="text-gray-600">Rejection type: {String(selectedProfile.profile.rejectionType)}</p>
              ) : null}
              {selectedProfile.profile?.rejectionReasonLabel ? (
                <p className="text-gray-600">Reason: {String(selectedProfile.profile.rejectionReasonLabel)}</p>
              ) : null}
              {selectedProfile.profile?.permanentDisableAt ? (
                <p className="text-gray-600">
                  Auto-disable date: {new Date(selectedProfile.profile.permanentDisableAt).toLocaleString()}
                </p>
              ) : null}
              {selectedProfile.profile?.profileReviewNotes ? (
                <p className="mt-1 text-xs text-gray-500">Latest note: {selectedProfile.profile.profileReviewNotes}</p>
              ) : null}
              {selectedProfile.profile?.profileReviewMessage ? (
                <div
                  className="mt-2 rounded border border-gray-200 bg-white p-2 text-xs text-gray-700"
                  dangerouslySetInnerHTML={{ __html: String(selectedProfile.profile.profileReviewMessage) }}
                />
              ) : null}
            </div>

            <div className="space-y-3">
              {(selectedProfile.fields || []).map((field: any) => {
                const value = selectedProfile.profile?.profileData?.[field.key];
                const display = Array.isArray(value) ? value.join(', ') : String(value || '');
                const isLink = typeof value === 'string' && (value.startsWith('http') || value.startsWith('/uploads/'));
                return (
                  <div key={field.id || field.key} className="rounded-lg border p-3">
                    <p className="text-xs font-semibold uppercase text-gray-500">{field.label}</p>
                    {isLink ? (
                      <a
                        href={String(value)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 underline break-all"
                      >
                        {display || '-'}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-800 break-words">{display || '-'}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Rejection reason</label>
              <select
                value={reviewReasonCode}
                onChange={(e) => setReviewReasonCode(e.target.value)}
                className="mb-3 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">Select reason...</option>
                {REJECTION_REASON_OPTIONS.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <label className="mb-1 block text-sm font-medium text-gray-700">Review note</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="h-24 w-full rounded border px-3 py-2 text-sm"
                placeholder="Short note (optional)."
              />
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">Detailed rejection message (formatted)</label>
                <div className="mb-2 flex items-center gap-2">
                  <Button size="sm" variant="outline" type="button" onClick={() => applyMessageFormat('bold')}>
                    Bold
                  </Button>
                  <Button size="sm" variant="outline" type="button" onClick={() => applyMessageFormat('italic')}>
                    Italic
                  </Button>
                  <Button size="sm" variant="outline" type="button" onClick={() => applyMessageFormat('insertUnorderedList')}>
                    Bullet list
                  </Button>
                </div>
                <div
                  ref={messageEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => setReviewMessageHtml(String(messageEditorRef.current?.innerHTML || '').trim())}
                  className="min-h-[120px] w-full rounded border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This formatted message is shown on vendor dashboard and sent in email for temporary rejection.
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => reviewProfile('REJECTED', 'TEMPORARY')}
                disabled={reviewing}
              >
                {reviewing ? 'Submitting...' : 'Reject Temporarily (Needs Correction)'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => reviewProfile('REJECTED', 'PERMANENT')}
                disabled={reviewing}
              >
                {reviewing ? 'Submitting...' : 'Reject Permanently'}
              </Button>
              <Button className="flex-1" onClick={() => reviewProfile('APPROVED')} disabled={reviewing}>
                {reviewing ? 'Submitting...' : 'Approve Profile'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddVendorModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 max-h-[92vh] overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Create Vendor (Minimal Profile)</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAddVendorModal(false)}>
                Close
              </Button>
            </div>
            <form
              className="flex h-[calc(92vh-110px)] flex-col"
              onSubmit={async (e) => {
                e.preventDefault();
                setCreatingVendor(true);
                setError('');
                try {
                  await api.admin.createMinimalVendor({
                    role: newVendor.role,
                    email: newVendor.email.trim(),
                    password: newVendor.password,
                    firstName: newVendor.firstName.trim(),
                    lastName: newVendor.lastName.trim(),
                    businessName: newVendor.businessName.trim(),
                    country: newVendor.country.trim(),
                    city: newVendor.city.trim() || undefined,
                    address: newVendor.address.trim() || undefined,
                    phone: newVendor.phone.trim() || undefined,
                  });
                  setSuccess('Vendor created. Vendor can complete profile after login.');
                  setShowAddVendorModal(false);
                  setNewVendor({
                    role: 'FABRIC_SELLER',
                    email: '',
                    password: '',
                    firstName: '',
                    lastName: '',
                    businessName: '',
                    country: '',
                    city: '',
                    address: '',
                    phone: '',
                  });
                  if (tab === 'reviews') {
                    await loadProfiles();
                  } else if (tab === 'accounts') {
                    await loadVendorAccounts();
                  }
                } catch (err: any) {
                  setError(err?.response?.data?.message || 'Failed to create vendor.');
                } finally {
                  setCreatingVendor(false);
                }
              }}
            >
              <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                <select
                  value={newVendor.role}
                  onChange={(e) => setNewVendor((prev) => ({ ...prev, role: e.target.value as VendorRole }))}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="FABRIC_SELLER">Fabric Seller</option>
                  <option value="FASHION_DESIGNER">Fashion Designer</option>
                </select>
                <input
                  type="email"
                  required
                  value={newVendor.email}
                  onChange={(e) => setNewVendor((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  required
                  value={newVendor.password}
                  onChange={(e) => setNewVendor((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Temporary password"
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  required
                  value={newVendor.businessName}
                  onChange={(e) => setNewVendor((prev) => ({ ...prev, businessName: e.target.value }))}
                  placeholder="Business name"
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  required
                  value={newVendor.firstName}
                  onChange={(e) => setNewVendor((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  required
                  value={newVendor.lastName}
                  onChange={(e) => setNewVendor((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                  className="rounded border px-3 py-2 text-sm"
                />
                <select
                  required
                  value={newVendorCountryCode}
                  onChange={(e) =>
                    setNewVendor((prev) => ({
                      ...prev,
                      country: resolveCountryName(e.target.value),
                      city: '',
                    }))
                  }
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="">Select country</option>
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newVendor.city}
                  onChange={(e) => setNewVendor((prev) => ({ ...prev, city: e.target.value }))}
                  className="rounded border px-3 py-2 text-sm"
                  disabled={!newVendor.country}
                >
                  <option value="">{newVendor.country ? 'Select city (optional)' : 'Select country first'}</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                <input
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone (optional)"
                  className="rounded border px-3 py-2 text-sm"
                />
              </div>
              <textarea
                value={newVendor.address}
                onChange={(e) => setNewVendor((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Address (optional)"
                className="h-20 w-full rounded border px-3 py-2 text-sm md:col-span-2"
              />
              <div className="sticky bottom-0 mt-3 flex justify-end gap-2 border-t bg-white pt-3 md:col-span-2">
                <Button type="button" variant="outline" onClick={() => setShowAddVendorModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creatingVendor}>
                  {creatingVendor ? 'Creating...' : 'Create Vendor'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
