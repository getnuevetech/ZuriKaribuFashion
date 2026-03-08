import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { api } from '../../services/api';

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
  | 'IMAGE';

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
];

export default function AdminVendorProfiles() {
  const [tab, setTab] = useState<'fields' | 'reviews'>('fields');
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
  const [reviewing, setReviewing] = useState(false);

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

  useEffect(() => {
    if (tab === 'fields') {
      void loadFields();
    } else {
      void loadProfiles();
    }
  }, [tab, role, statusFilter]);

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

  const reviewProfile = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedProfile?.role || !selectedProfile?.user?.id) return;
    setReviewing(true);
    setError('');
    try {
      await api.admin.reviewVendorProfile(selectedProfile.role, selectedProfile.user.id, {
        status,
        notes: reviewNotes || undefined,
      });
      setSelectedProfile(null);
      setSuccess(`Vendor profile ${status.toLowerCase()} successfully.`);
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
            <Button size="sm" variant="outline" onClick={addField}>
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
                        {type}
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
                    <Button size="sm" variant="outline" onClick={() => removeField(index)}>
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

      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6">
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
              {selectedProfile.profile?.profileReviewNotes ? (
                <p className="mt-1 text-xs text-gray-500">Latest note: {selectedProfile.profile.profileReviewNotes}</p>
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Review note</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="h-24 w-full rounded border px-3 py-2 text-sm"
                placeholder="Optional note. Required for rejection."
              />
            </div>

            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => reviewProfile('REJECTED')}
                disabled={reviewing}
              >
                {reviewing ? 'Submitting...' : 'Reject / Request Correction'}
              </Button>
              <Button className="flex-1" onClick={() => reviewProfile('APPROVED')} disabled={reviewing}>
                {reviewing ? 'Submitting...' : 'Approve Profile'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
