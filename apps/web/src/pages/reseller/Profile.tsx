import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

export default function ResellerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editableFields, setEditableFields] = useState<string[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    avatar: '',
    displayName: '',
  });

  const canEdit = (field: string) => editableFields.includes(field);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.referrals.getMyProfile();
      if (response.success) {
        const nextProfile = response.data?.profile || {};
        setProfile(nextProfile);
        setEditableFields(Array.isArray(response.data?.editableFields) ? response.data.editableFields : []);
        setForm({
          firstName: String(nextProfile.firstName || ''),
          lastName: String(nextProfile.lastName || ''),
          phone: String(nextProfile.phone || ''),
          avatar: String(nextProfile.avatar || ''),
          displayName: String(nextProfile.displayName || ''),
        });
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load referral profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const payload: any = {};
      if (canEdit('firstName')) payload.firstName = form.firstName.trim();
      if (canEdit('lastName')) payload.lastName = form.lastName.trim();
      if (canEdit('phone')) payload.phone = form.phone.trim() || null;
      if (canEdit('avatar')) payload.avatar = form.avatar.trim() || null;
      if (canEdit('displayName')) payload.displayName = form.displayName.trim();
      const response = await api.referrals.updateMyProfile(payload);
      if (response.success) {
        setMessage(response.message || 'Profile updated.');
        await loadData();
      }
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Referral Profile</h1>
        <p className="text-sm text-gray-600">Update the profile fields enabled by admin.</p>
      </div>
      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>
      ) : null}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <form onSubmit={saveProfile} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-gray-700">
              First name
              <input
                className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-100"
                value={form.firstName}
                onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                disabled={!canEdit('firstName')}
              />
            </label>
            <label className="text-sm text-gray-700">
              Last name
              <input
                className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-100"
                value={form.lastName}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                disabled={!canEdit('lastName')}
              />
            </label>
          </div>
          <label className="text-sm text-gray-700">
            Display name
            <input
              className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-100"
              value={form.displayName}
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              disabled={!canEdit('displayName')}
            />
          </label>
          <label className="text-sm text-gray-700">
            Phone
            <input
              className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-100"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              disabled={!canEdit('phone')}
            />
          </label>
          <label className="text-sm text-gray-700">
            Profile image URL
            <input
              className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-100"
              value={form.avatar}
              onChange={(event) => setForm((prev) => ({ ...prev, avatar: event.target.value }))}
              disabled={!canEdit('avatar')}
              placeholder="https://..."
            />
          </label>
          {profile?.avatar ? (
            <div className="pt-1">
              <img src={String(profile.avatar)} alt="Profile" className="h-20 w-20 rounded-full border object-cover" />
            </div>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </form>
      </div>
    </div>
  );
}
