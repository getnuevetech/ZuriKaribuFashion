import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

const emptyForm = {
  title: '',
  description: '',
  imageUrl: '',
  targetUrl: '',
  widthPx: '',
  heightPx: '',
  sortOrder: '0',
  isActive: true,
};

export default function AdminReferralMaterialsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [message, setMessage] = useState('');

  const loadRows = async () => {
    try {
      setLoading(true);
      const response = await api.admin.getReferralMaterials();
      if (response.success) setRows(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Failed to load referral materials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage('');
      const response = await api.admin.createReferralMaterial({
        title: String(form.title || '').trim(),
        description: String(form.description || '').trim() || undefined,
        imageUrl: String(form.imageUrl || '').trim() || undefined,
        targetUrl: String(form.targetUrl || '').trim() || undefined,
        widthPx: String(form.widthPx || '').trim() ? Number(form.widthPx) : undefined,
        heightPx: String(form.heightPx || '').trim() ? Number(form.heightPx) : undefined,
        sortOrder: Number(form.sortOrder || 0),
        isActive: Boolean(form.isActive),
      });
      if (response.success) {
        setRows(Array.isArray(response.data) ? response.data : []);
        setForm(emptyForm);
        setMessage(response.message || 'Material created.');
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Failed to create material.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: any) => {
    try {
      setSaving(true);
      const response = await api.admin.updateReferralMaterial(String(row.id), { isActive: !(row.isActive !== false) });
      if (response.success) {
        setRows(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Failed to update material.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this material?')) return;
    try {
      setSaving(true);
      const response = await api.admin.deleteReferralMaterial(id);
      if (response.success) {
        setRows(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Failed to delete material.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Referral Materials</h1>
        <p className="text-sm text-gray-600">Upload and manage promotional assets for referral users.</p>
      </div>
      {message ? <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</div> : null}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Create Material</h2>
        <form onSubmit={create} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            required
            placeholder="Title"
            className="rounded border px-3 py-2"
            value={form.title}
            onChange={(event) => setForm((prev: any) => ({ ...prev, title: event.target.value }))}
          />
          <input
            placeholder="Target URL (optional)"
            className="rounded border px-3 py-2"
            value={form.targetUrl}
            onChange={(event) => setForm((prev: any) => ({ ...prev, targetUrl: event.target.value }))}
          />
          <input
            placeholder="Image URL"
            className="rounded border px-3 py-2 md:col-span-2"
            value={form.imageUrl}
            onChange={(event) => setForm((prev: any) => ({ ...prev, imageUrl: event.target.value }))}
          />
          <textarea
            placeholder="Description"
            className="rounded border px-3 py-2 md:col-span-2"
            value={form.description}
            onChange={(event) => setForm((prev: any) => ({ ...prev, description: event.target.value }))}
          />
          <input
            placeholder="Width (px)"
            className="rounded border px-3 py-2"
            value={form.widthPx}
            onChange={(event) => setForm((prev: any) => ({ ...prev, widthPx: event.target.value }))}
          />
          <input
            placeholder="Height (px)"
            className="rounded border px-3 py-2"
            value={form.heightPx}
            onChange={(event) => setForm((prev: any) => ({ ...prev, heightPx: event.target.value }))}
          />
          <input
            placeholder="Sort order"
            className="rounded border px-3 py-2"
            value={form.sortOrder}
            onChange={(event) => setForm((prev: any) => ({ ...prev, sortOrder: event.target.value }))}
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(event) => setForm((prev: any) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create Material'}
            </Button>
          </div>
        </form>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Materials</h2>
          <Button variant="outline" onClick={() => void loadRows()}>
            Refresh
          </Button>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{row.title}</p>
                    <p className="text-xs text-gray-500">{row.description || '-'}</p>
                    <p className="mt-1 text-xs text-gray-600">{row.imageUrl || '-'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void toggle(row)} disabled={saving}>
                      {row.isActive !== false ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" onClick={() => void remove(String(row.id))} disabled={saving}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {rows.length === 0 ? <div className="py-6 text-center text-sm text-gray-500">No materials yet.</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
