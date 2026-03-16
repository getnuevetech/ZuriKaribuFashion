import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { getCountryOptions, resolveCountryCode, resolveCountryName } from '../../data/locationOptions';
import { normalizePhoneWithCountryPrefix } from '../../utils/phone';

type AdminProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  avatar: string;
};

const defaultForm: AdminProfileForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  country: '',
  avatar: '',
};

export default function AdminProfilePage() {
  const { updateUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<AdminProfileForm>(defaultForm);
  const countryOptions = useMemo(() => getCountryOptions(), []);
  const countryCode = resolveCountryCode(form.country);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.admin.getAdminProfile();
      if (response.success) {
        const row = response.data || {};
        setForm({
          firstName: String(row.firstName || ''),
          lastName: String(row.lastName || ''),
          email: String(row.email || ''),
          phone: String(row.phone || ''),
          country: String(row.country || ''),
          avatar: String(row.avatar || ''),
        });
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load admin profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const saveProfile = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const response = await api.admin.updateAdminProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        avatar: form.avatar.trim() || null,
        country: form.country.trim(),
      });
      if (response.success) {
        const payload = response.data || {};
        setForm((prev) => ({
          ...prev,
          firstName: String(payload.firstName || prev.firstName),
          lastName: String(payload.lastName || prev.lastName),
          email: String(payload.email || prev.email),
          phone: String(payload.phone || ''),
          country: String(payload.country || ''),
          avatar: String(payload.avatar || ''),
        }));
        updateUser({
          firstName: String(payload.firstName || form.firstName),
          lastName: String(payload.lastName || form.lastName),
          phone: String(payload.phone || ''),
          avatar: String(payload.avatar || ''),
        });
        setMessage(response.message || 'Profile updated successfully.');
      }
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to update admin profile.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file?: File | null) => {
    if (!file) return;
    try {
      setUploadingAvatar(true);
      setError('');
      setMessage('');
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.upload.image(formData);
      if (response?.success && response?.data?.url) {
        setForm((prev) => ({ ...prev, avatar: String(response.data.url || '').trim() }));
      }
    } catch (uploadError: any) {
      setError(uploadError?.response?.data?.message || 'Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Profile</h1>
        <p className="text-sm text-gray-600">Update your administrator account details.</p>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            value={form.firstName}
            onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
            placeholder="First name"
            className="rounded border px-3 py-2"
          />
          <input
            value={form.lastName}
            onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
            placeholder="Last name"
            className="rounded border px-3 py-2"
          />
          <input value={form.email} disabled className="rounded border bg-gray-50 px-3 py-2 text-gray-600 md:col-span-2" />
          <input
            value={form.phone}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                phone: normalizePhoneWithCountryPrefix(event.target.value, prev.country),
              }))
            }
            placeholder="Phone"
            className="rounded border px-3 py-2"
          />
          <select
            value={countryCode}
            onChange={(event) => {
              const nextCountry = resolveCountryName(event.target.value);
              setForm((prev) => ({
                ...prev,
                country: nextCountry,
                phone: normalizePhoneWithCountryPrefix(prev.phone, nextCountry),
              }));
            }}
            className="rounded border px-3 py-2"
          >
            <option value="">Select country</option>
            {countryOptions.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <input
            value={form.avatar}
            onChange={(event) => setForm((prev) => ({ ...prev, avatar: event.target.value }))}
            placeholder="Avatar URL"
            className="rounded border px-3 py-2 md:col-span-2"
          />
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">Upload avatar image</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void uploadAvatar(file);
              }}
              className="w-full text-sm"
            />
            {uploadingAvatar ? <p className="mt-2 text-xs text-amber-700">Uploading avatar...</p> : null}
          </div>
        </div>

        {form.avatar ? (
          <div className="mt-4">
            <img src={form.avatar} alt="Admin avatar preview" className="h-20 w-20 rounded-full border object-cover" />
          </div>
        ) : null}

        <div className="mt-4">
          <Button onClick={() => void saveProfile()} disabled={saving || uploadingAvatar}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </div>
  );
}
