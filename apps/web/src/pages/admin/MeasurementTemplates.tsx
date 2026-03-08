import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';

interface MeasurementTemplate {
  name: string;
  unit: string;
  isRequired: boolean;
  instructions?: string;
}

const EMPTY_ROW: MeasurementTemplate = {
  name: '',
  unit: 'cm',
  isRequired: true,
  instructions: '',
};

export default function AdminMeasurementTemplates() {
  const [rows, setRows] = useState<MeasurementTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.admin.getMeasurementTemplates();
        if (res.success) {
          setRows(res.data || []);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load measurement templates.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      const payload = rows
        .map((row) => ({
          ...row,
          name: row.name.trim(),
          unit: row.unit.trim() || 'cm',
          instructions: row.instructions?.trim() || '',
        }))
        .filter((row) => row.name.length > 0);
      if (payload.length === 0) {
        setError('Add at least one measurement template.');
        return;
      }
      await api.admin.updateMeasurementTemplates(payload);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save templates.');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Measurement Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure global measurements that designers can select for products.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Templates'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3 rounded-xl border bg-white p-4">
        {rows.map((row, idx) => (
          <div key={`${row.name}-${idx}`} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-5">
            <input
              value={row.name}
              onChange={(e) =>
                setRows((prev) => prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)))
              }
              placeholder="Measurement name"
              className="rounded-lg border px-3 py-2"
            />
            <input
              value={row.unit}
              onChange={(e) =>
                setRows((prev) => prev.map((item, i) => (i === idx ? { ...item, unit: e.target.value } : item)))
              }
              placeholder="Unit (cm/inch)"
              className="rounded-lg border px-3 py-2"
            />
            <input
              value={row.instructions || ''}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((item, i) => (i === idx ? { ...item, instructions: e.target.value } : item))
                )
              }
              placeholder="Instructions (optional)"
              className="rounded-lg border px-3 py-2 md:col-span-2"
            />
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.isRequired}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, isRequired: e.target.checked } : item))
                    )
                  }
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                className="rounded p-1 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW }])}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Measurement
        </Button>
      </div>
    </div>
  );
}
