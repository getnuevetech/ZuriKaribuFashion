import { useEffect, useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';

interface VisibilitySection {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export default function AdminHomepageVisibility() {
  const [sections, setSections] = useState<VisibilitySection[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchVisibility = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.homepageSections.getAdminVisibility();
      if (response.success) {
        setSections(Array.isArray(response.data?.sections) ? response.data.sections : []);
      }
    } catch (fetchError: any) {
      setError(fetchError?.response?.data?.message || 'Failed to load homepage visibility settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVisibility();
  }, []);

  const handleToggle = async (key: string, enabled: boolean) => {
    const nextVisibility = sections.reduce<Record<string, boolean>>((acc, section) => {
      acc[section.key] = section.key === key ? !enabled : section.enabled;
      return acc;
    }, {});

    setSections((prev) =>
      prev.map((section) =>
        section.key === key
          ? {
              ...section,
              enabled: !enabled,
            }
          : section
      )
    );

    setSavingKey(key);
    setError('');
    try {
      const response = await api.homepageSections.updateAdminVisibility(nextVisibility);
      if (response.success) {
        setSections(Array.isArray(response.data?.sections) ? response.data.sections : []);
      }
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to update visibility.');
      await fetchVisibility();
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Frontpage Visibility</h1>
          <p className="mt-1 text-gray-500">Enable or disable homepage sections from one place.</p>
        </div>
        <Button variant="outline" onClick={fetchVisibility} disabled={loading || Boolean(savingKey)}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading section visibility...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {sections.map((section) => {
              const busy = savingKey === section.key;
              return (
                <div key={section.key} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <div className="pr-3">
                    <p className="text-sm font-medium text-gray-900">{section.label}</p>
                    <p className="text-xs text-gray-500">{section.description}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(section.key, section.enabled)}
                    disabled={busy}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                      section.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } ${busy ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : section.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {section.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
