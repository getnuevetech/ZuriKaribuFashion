import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

export default function ResellerMaterialsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  const loadRows = async () => {
    try {
      setLoading(true);
      setMessage('');
      const response = await api.referrals.getMyMaterials();
      if (response.success) {
        setRows(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Failed to load referral materials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Could not copy ${label.toLowerCase()}.`);
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referral Materials</h1>
          <p className="text-sm text-gray-600">Use these banners and embed codes to promote your referral link.</p>
        </div>
        <Button variant="outline" onClick={() => void loadRows()}>
          Refresh
        </Button>
      </div>
      {message ? <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="font-medium text-gray-900">{row.title}</p>
            <p className="mt-1 text-xs text-gray-500">{row.description || 'Referral promotional asset'}</p>
            {row.imageUrl ? (
              <img src={row.imageUrl} alt={row.title || 'Material'} className="mt-3 w-full rounded border object-cover" />
            ) : null}
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Target URL</p>
            <p className="break-all text-xs text-gray-700">{row.targetUrl || '-'}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Embed code</p>
            <textarea readOnly value={row.embedHtml || ''} className="mt-1 h-24 w-full rounded border px-2 py-1 text-xs" />
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => void copy(String(row.targetUrl || ''), 'Link')}>
                <Copy className="mr-1 h-4 w-4" />
                Copy Link
              </Button>
              <Button variant="outline" onClick={() => void copy(String(row.embedHtml || ''), 'Embed code')}>
                <Copy className="mr-1 h-4 w-4" />
                Copy Embed
              </Button>
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-500 md:col-span-2">
            No referral materials have been published yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
