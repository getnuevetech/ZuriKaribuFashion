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
const DEFAULT_READY_TO_WEAR_SIZE_OPTIONS = ['S', 'M', 'L', 'XL'];
const normalizeReadyToWearSizes = (input: unknown): string[] => {
  const raw = Array.isArray(input) ? input : [];
  const normalized = Array.from(
    new Set(
      raw
        .map((entry) => String(entry || '').trim().toUpperCase())
        .filter((entry) => entry.length > 0 && entry.length <= 20)
        .slice(0, 20)
    )
  );
  return normalized.length >= 3 ? normalized : [...DEFAULT_READY_TO_WEAR_SIZE_OPTIONS];
};

export default function AdminMeasurementTemplates() {
  const [rows, setRows] = useState<MeasurementTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [readyToWearSizes, setReadyToWearSizes] = useState<string[]>([...DEFAULT_READY_TO_WEAR_SIZE_OPTIONS]);
  const [newReadyToWearSize, setNewReadyToWearSize] = useState('');
  const [sizeGuideTitle, setSizeGuideTitle] = useState('Ready-To-Wear Size Guide');
  const [sizeGuideContent, setSizeGuideContent] = useState('');
  const isRouteMissingError = (error: any) =>
    Number(error?.response?.status) === 404 ||
    /route not found/i.test(String(error?.response?.data?.message || error?.message || ''));

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [templatesResult, sizesResult, sizeGuideResult] = await Promise.allSettled([
          api.admin.getMeasurementTemplates(),
          api.admin.getReadyToWearSizesSettings(),
          api.admin.getReadyToWearSizeGuideSettings(),
        ]);
        if (templatesResult.status === 'fulfilled' && templatesResult.value.success) {
          setRows(templatesResult.value.data || []);
        } else if (templatesResult.status === 'rejected') {
          throw templatesResult.reason;
        }
        if (sizesResult.status === 'fulfilled' && sizesResult.value.success && Array.isArray(sizesResult.value.data?.sizes)) {
          setReadyToWearSizes(normalizeReadyToWearSizes(sizesResult.value.data.sizes));
        }
        if (sizeGuideResult.status === 'fulfilled' && sizeGuideResult.value.success) {
          setSizeGuideTitle((sizeGuideResult.value.data?.title || 'Ready-To-Wear Size Guide').trim());
          setSizeGuideContent((sizeGuideResult.value.data?.content || '').trim());
        } else if (
          sizeGuideResult.status === 'rejected' &&
          !isRouteMissingError(sizeGuideResult.reason)
        ) {
          // Keep page usable but surface non-routing failures from this optional endpoint.
          console.warn('Unable to load size guide settings:', sizeGuideResult.reason);
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
      setSuccess('');
      const payload = rows
        .map((row) => ({
          ...row,
          name: row.name.trim(),
          unit: row.unit.trim() || 'cm',
          instructions: row.instructions?.trim() || '',
        }))
        .filter((row) => row.name.length > 0);
      if (readyToWearSizes.length < 3 || readyToWearSizes.length > 20) {
        setError('Ready-to-wear sizes must include at least 3 and at most 20 options.');
        return;
      }
      const cleanSizeGuideTitle = sizeGuideTitle.trim();
      const cleanSizeGuideContent = sizeGuideContent.trim();
      if (cleanSizeGuideTitle.length < 3 || cleanSizeGuideContent.length < 20) {
        setError('Size guide title must be at least 3 characters and content at least 20 characters.');
        return;
      }
      if (payload.length > 0) {
        await api.admin.updateMeasurementTemplates(payload);
      }
      const [sizesSaveResult, guideSaveResult] = await Promise.allSettled([
        api.admin.updateReadyToWearSizesSettings(normalizeReadyToWearSizes(readyToWearSizes)),
        api.admin.updateReadyToWearSizeGuideSettings({
          title: cleanSizeGuideTitle,
          content: cleanSizeGuideContent,
        }),
      ]);
      if (sizesSaveResult.status === 'rejected' && !isRouteMissingError(sizesSaveResult.reason)) {
        throw sizesSaveResult.reason;
      }
      if (guideSaveResult.status === 'rejected' && !isRouteMissingError(guideSaveResult.reason)) {
        throw guideSaveResult.reason;
      }
      const hasLegacyGap =
        (sizesSaveResult.status === 'rejected' && isRouteMissingError(sizesSaveResult.reason)) ||
        (guideSaveResult.status === 'rejected' && isRouteMissingError(guideSaveResult.reason));
      setSuccess(
        hasLegacyGap
          ? 'Measurement templates saved. Some Ready-To-Wear settings require backend deployment update.'
          : 'Measurement templates, ready-to-wear sizes, and size guide saved successfully.'
      );
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
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-3 rounded-xl border bg-white p-4">
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Ready-To-Wear Standard Sizes</h3>
          <p className="mt-1 text-xs text-gray-600">
            Designers can only upload ready-to-wear sizes from the options you define below.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {readyToWearSizes.map((size) => (
              <span key={size} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs">
                {size}
                <button
                  type="button"
                  onClick={() =>
                    setReadyToWearSizes((prev) => {
                      if (prev.length <= 3) return prev;
                      return prev.filter((entry) => entry !== size);
                    })
                  }
                  className="text-red-600"
                  aria-label={`Remove size ${size}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newReadyToWearSize}
              onChange={(event) => setNewReadyToWearSize(event.target.value)}
              maxLength={20}
              placeholder="Add size (e.g. XXL, 38, FREE)"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const normalized = String(newReadyToWearSize || '').trim().toUpperCase();
                if (!normalized) return;
                setReadyToWearSizes((prev) => {
                  const next = Array.from(new Set([...prev, normalized])).slice(0, 20);
                  return next;
                });
                setNewReadyToWearSize('');
              }}
            >
              Add
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEFAULT_READY_TO_WEAR_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
                onClick={() =>
                  setReadyToWearSizes((prev) => {
                    const next = Array.from(new Set([...prev, size])).slice(0, 20);
                    return next;
                  })
                }
              >
                Add {size}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Selected: {readyToWearSizes.join(', ') || 'None'} ({readyToWearSizes.length}/20)
          </p>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Ready-To-Wear Size Guide Content</h3>
          <p className="mt-1 text-xs text-gray-600">
            This content appears in the size guide popup on each ready-to-wear product page.
          </p>
          <div className="mt-3 space-y-3">
            <input
              value={sizeGuideTitle}
              onChange={(event) => setSizeGuideTitle(event.target.value)}
              maxLength={120}
              placeholder="Guide title"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
            <textarea
              value={sizeGuideContent}
              onChange={(event) => setSizeGuideContent(event.target.value)}
              maxLength={6000}
              rows={8}
              placeholder="Add sizing notes and measurements for S, M, L, XL..."
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-5">
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
