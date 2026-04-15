import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';
import { resolveCountryCode } from '../../data/locationOptions';

export default function DesignerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileCompletion, setProfileCompletion] = useState<any>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const [completionRes, meRes] = await Promise.all([
          api.designer.getProfileCompletion(),
          api.auth.getMe(),
        ]);
        if (completionRes.success) {
          setProfileCompletion(completionRes.data);
        }
        if (meRes.success) {
          setMe(meRes.data || null);
        }
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || 'Unable to load designer profile.');
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  const profileCountry = String(profileCompletion?.profile?.country || '').trim();
  const countryCode = resolveCountryCode(profileCountry);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Designer Profile</h1>
        <p className="text-sm text-gray-600 mt-1">View your storefront profile details.</p>
      </div>
      {error ? <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center gap-4">
          <img
            src={String(me?.avatar || '').trim() || '/images/placeholder.jpg'}
            alt="Profile"
            className="h-20 w-20 rounded-full border object-cover"
          />
          <div>
            <p className="text-base font-semibold text-gray-900">
              {`${String(me?.firstName || '').trim()} ${String(me?.lastName || '').trim()}`.trim() || '-'}
            </p>
            <p className="text-sm text-gray-600">{me?.email || '-'}</p>
            <p className="text-sm text-gray-600">{me?.phone || '-'}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Business name</p>
            <p className="text-sm font-medium text-gray-900">{profileCompletion?.profile?.businessName || '-'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Business email</p>
            <p className="text-sm font-medium text-gray-900">{profileCompletion?.profile?.businessEmail || '-'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Business phone</p>
            <p className="text-sm font-medium text-gray-900">{profileCompletion?.profile?.businessPhone || '-'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Country / City</p>
            <div className="flex items-center gap-2">
              {countryCode ? (
                <img
                  src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
                  alt={`${profileCountry || 'Country'} flag`}
                  className="h-4 w-6 rounded-sm border object-cover"
                />
              ) : (
                <span className="text-sm" aria-hidden="true">🌍</span>
              )}
              <p className="text-sm font-medium text-gray-900">
                {[profileCompletion?.profile?.country, profileCompletion?.profile?.city].filter(Boolean).join(', ') || '-'}
              </p>
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Address</p>
            <p className="text-sm font-medium text-gray-900">{profileCompletion?.profile?.address || '-'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Approval status</p>
            <p className="text-sm font-semibold text-gray-900">{profileCompletion?.profileStatus || 'INCOMPLETE'}</p>
          </div>
        </div>
        <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Profile information is view-only here. Updates are managed through vendor governance workflow.
        </p>
        {profileCompletion?.profile?.storefrontPath ? (
          <div className="mt-4">
            <a
              href={profileCompletion.profile.storefrontPath}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-amber-700 underline"
            >
              Open storefront profile
            </a>
          </div>
        ) : null}
        <div className="mt-4">
          <Link to="/designer">
            <Button variant="outline">Back to Designer Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

