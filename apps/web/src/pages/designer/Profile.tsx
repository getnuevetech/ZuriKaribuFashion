import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

export default function DesignerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileCompletion, setProfileCompletion] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.designer.getProfileCompletion();
        if (response.success) {
          setProfileCompletion(response.data);
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Designer Profile</h1>
        <p className="text-sm text-gray-600 mt-1">View your storefront profile details.</p>
      </div>
      {error ? <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-gray-600">Business name</p>
        <p className="text-base font-semibold text-gray-900">{profileCompletion?.profile?.businessName || '-'}</p>
        <p className="mt-3 text-sm text-gray-600">Approval status</p>
        <p className="text-base font-semibold text-gray-900">{profileCompletion?.profileStatus || 'INCOMPLETE'}</p>
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

