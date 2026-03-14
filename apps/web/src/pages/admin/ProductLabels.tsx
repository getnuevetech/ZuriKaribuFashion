import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type ProductType = 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
type LabelMode = 'AUTO_NEW' | 'AUTO_SALE' | 'MANUAL';

type ProductLabelRow = {
  id: string;
  name: string;
  mode: LabelMode;
  textColor: string;
  backgroundColor: string;
  isActive: boolean;
};

type ProductLabelAssignmentRow = {
  labelId: string;
  productType: ProductType;
  productIds: string[];
};

type LabelAppearance = {
  sizePercent: number;
  fontSizePx: number;
  isBold: boolean;
};

const DEFAULT_LABELS: ProductLabelRow[] = [
  { id: 'new', name: 'NEW', mode: 'AUTO_NEW', textColor: '#ffffff', backgroundColor: '#111827', isActive: true },
  { id: 'sale', name: 'SALE', mode: 'AUTO_SALE', textColor: '#ffffff', backgroundColor: '#dc2626', isActive: true },
];

export default function AdminProductLabels() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newTagDays, setNewTagDays] = useState(14);
  const [appearance, setAppearance] = useState<LabelAppearance>({
    sizePercent: 120,
    fontSizePx: 12,
    isBold: true,
  });
  const [labels, setLabels] = useState<ProductLabelRow[]>(DEFAULT_LABELS);
  const [assignments, setAssignments] = useState<ProductLabelAssignmentRow[]>([]);
  const [catalog, setCatalog] = useState<Record<ProductType, Array<{ id: string; name: string }>>>({
    FABRIC: [],
    DESIGN: [],
    READY_TO_WEAR: [],
  });

  const manualLabelOptions = useMemo(
    () => labels.filter((label) => label.mode === 'MANUAL' || label.mode === 'AUTO_NEW' || label.mode === 'AUTO_SALE'),
    [labels]
  );

  const fetchCatalogByType = async (type: ProductType) => {
    let page = 1;
    let pages = 1;
    const rows: Array<{ id: string; name: string }> = [];
    while (page <= pages && page <= 10) {
      const response = await api.admin.getProducts({ type, page, limit: 100 });
      if (!response.success) break;
      const products = Array.isArray(response.data?.products) ? response.data.products : [];
      rows.push(
        ...products.map((entry: any) => ({
          id: String(entry.id || ''),
          name: String(entry.name || 'Product'),
        }))
      );
      pages = Number(response.data?.pagination?.pages || 1);
      page += 1;
    }
    return Array.from(new Map(rows.filter((entry) => entry.id).map((entry) => [entry.id, entry])).values());
  };

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [settingsResult, fabrics, designs, readyToWear] = await Promise.allSettled([
        api.admin.getProductLabelsSettings(),
        fetchCatalogByType('FABRIC'),
        fetchCatalogByType('DESIGN'),
        fetchCatalogByType('READY_TO_WEAR'),
      ]);

      if (settingsResult.status === 'fulfilled' && settingsResult.value.success) {
        const payload = settingsResult.value.data || {};
        setNewTagDays(Math.max(1, Number(payload.newTagDays || 14)));
        setAppearance({
          sizePercent: Math.max(60, Math.min(300, Number(payload.appearance?.sizePercent || 120))),
          fontSizePx: Math.max(8, Math.min(36, Number(payload.appearance?.fontSizePx || 12))),
          isBold: payload.appearance?.isBold !== false,
        });
        const nextLabels = Array.isArray(payload.labels) && payload.labels.length > 0
          ? payload.labels.map((entry: any) => ({
              id: String(entry.id || '').trim().toLowerCase(),
              name: String(entry.name || '').trim(),
              mode: String(entry.mode || 'MANUAL').toUpperCase() as LabelMode,
              textColor: String(entry.textColor || '#ffffff'),
              backgroundColor: String(entry.backgroundColor || '#111827'),
              isActive: entry.isActive !== false,
            }))
          : DEFAULT_LABELS;
        setLabels(nextLabels);
        setAssignments(
          Array.isArray(payload.assignments)
            ? payload.assignments.map((entry: any) => ({
                labelId: String(entry.labelId || '').trim().toLowerCase(),
                productType: String(entry.productType || 'DESIGN').toUpperCase() as ProductType,
                productIds: Array.isArray(entry.productIds)
                  ? entry.productIds.map((id: any) => String(id || '').trim()).filter(Boolean)
                  : [],
              }))
            : []
        );
      }
      setCatalog({
        FABRIC: fabrics.status === 'fulfilled' ? fabrics.value : [],
        DESIGN: designs.status === 'fulfilled' ? designs.value : [],
        READY_TO_WEAR: readyToWear.status === 'fulfilled' ? readyToWear.value : [],
      });
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load product labels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addManualLabel = () => {
    const id = `label-${Date.now()}`;
    setLabels((prev) => [
      ...prev,
      {
        id,
        name: 'NEW LABEL',
        mode: 'MANUAL',
        textColor: '#ffffff',
        backgroundColor: '#1f2937',
        isActive: true,
      },
    ]);
  };

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const normalizedLabels = labels
        .map((entry) => ({
          ...entry,
          id: String(entry.id || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 64),
          name: String(entry.name || '').trim().slice(0, 24),
          textColor: String(entry.textColor || '#ffffff').trim() || '#ffffff',
          backgroundColor: String(entry.backgroundColor || '#111827').trim() || '#111827',
          isActive: entry.isActive !== false,
        }))
        .filter((entry) => entry.id && entry.name);
      if (normalizedLabels.length === 0) {
        setError('Add at least one label.');
        return;
      }
      const normalizedAssignments = assignments
        .map((entry) => ({
          labelId: String(entry.labelId || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 64),
          productType: entry.productType,
          productIds: Array.from(new Set((entry.productIds || []).map((id) => String(id || '').trim()).filter(Boolean))),
        }))
        .filter((entry) => entry.labelId && entry.productIds.length > 0);
      await api.admin.updateProductLabelsSettings({
        newTagDays: Math.max(1, Math.min(120, Number(newTagDays || 14))),
        appearance: {
          sizePercent: Math.max(60, Math.min(300, Number(appearance.sizePercent || 120))),
          fontSizePx: Math.max(8, Math.min(36, Number(appearance.fontSizePx || 12))),
          isBold: appearance.isBold !== false,
        },
        labels: normalizedLabels,
        assignments: normalizedAssignments,
      });
      setSuccess('Product labels saved successfully.');
      await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save product labels.');
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
          <h1 className="text-2xl font-bold text-gray-900">Product Labels</h1>
          <p className="mt-1 text-sm text-gray-500">Manage NEW, SALE and custom product tags with color controls.</p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Labels'}
        </Button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div> : null}

      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="block text-sm font-medium text-gray-700">
            Auto-NEW duration (days)
            <input
              type="number"
              min={1}
              max={120}
              value={newTagDays}
              onChange={(event) => setNewTagDays(Math.max(1, Math.min(120, Number(event.target.value || 14))))}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Label size (%)
            <input
              type="number"
              min={60}
              max={300}
              value={appearance.sizePercent}
              onChange={(event) =>
                setAppearance((prev) => ({
                  ...prev,
                  sizePercent: Math.max(60, Math.min(300, Number(event.target.value || 120))),
                }))
              }
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Font size (px)
            <input
              type="number"
              min={8}
              max={36}
              value={appearance.fontSizePx}
              onChange={(event) =>
                setAppearance((prev) => ({
                  ...prev,
                  fontSizePx: Math.max(8, Math.min(36, Number(event.target.value || 12))),
                }))
              }
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 pt-8">
            <input
              type="checkbox"
              checked={appearance.isBold}
              onChange={(event) => setAppearance((prev) => ({ ...prev, isBold: event.target.checked }))}
            />
            Label text bold
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Labels</h2>
          <Button type="button" variant="outline" onClick={addManualLabel}>
            <Plus className="mr-2 h-4 w-4" />
            Add Custom Label
          </Button>
        </div>
        {labels.map((label, index) => (
          <div key={`${label.id}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-12">
            <input
              value={label.id}
              onChange={(event) =>
                setLabels((prev) => prev.map((entry, i) => (i === index ? { ...entry, id: event.target.value } : entry)))
              }
              disabled={label.mode === 'AUTO_NEW' || label.mode === 'AUTO_SALE'}
              className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
              placeholder="id"
            />
            <input
              value={label.name}
              onChange={(event) =>
                setLabels((prev) => prev.map((entry, i) => (i === index ? { ...entry, name: event.target.value } : entry)))
              }
              className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
              placeholder="Name"
            />
            <select
              value={label.mode}
              onChange={(event) =>
                setLabels((prev) =>
                  prev.map((entry, i) => (i === index ? { ...entry, mode: event.target.value as LabelMode } : entry))
                )
              }
              disabled={label.mode === 'AUTO_NEW' || label.mode === 'AUTO_SALE'}
              className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
            >
              <option value="AUTO_NEW">AUTO_NEW</option>
              <option value="AUTO_SALE">AUTO_SALE</option>
              <option value="MANUAL">MANUAL</option>
            </select>
            <input
              type="color"
              value={label.backgroundColor}
              onChange={(event) =>
                setLabels((prev) =>
                  prev.map((entry, i) => (i === index ? { ...entry, backgroundColor: event.target.value } : entry))
                )
              }
              className="h-10 rounded-lg border px-2 py-1 md:col-span-2"
            />
            <input
              type="color"
              value={label.textColor}
              onChange={(event) =>
                setLabels((prev) => prev.map((entry, i) => (i === index ? { ...entry, textColor: event.target.value } : entry)))
              }
              className="h-10 rounded-lg border px-2 py-1 md:col-span-2"
            />
            <div className="flex items-center justify-between gap-2 md:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={label.isActive}
                  onChange={(event) =>
                    setLabels((prev) =>
                      prev.map((entry, i) => (i === index ? { ...entry, isActive: event.target.checked } : entry))
                    )
                  }
                />
                Active
              </label>
              {label.mode === 'MANUAL' ? (
                <button
                  type="button"
                  onClick={() => setLabels((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Group Assignments</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setAssignments((prev) => [...prev, { labelId: labels[0]?.id || 'new', productType: 'DESIGN', productIds: [] }])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Assignment
          </Button>
        </div>
        {assignments.length === 0 ? <p className="text-sm text-gray-500">No group assignments yet.</p> : null}
        {assignments.map((assignment, index) => (
          <div key={`${assignment.labelId}-${assignment.productType}-${index}`} className="rounded-lg border p-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <select
                value={assignment.labelId}
                onChange={(event) =>
                  setAssignments((prev) =>
                    prev.map((entry, i) => (i === index ? { ...entry, labelId: event.target.value } : entry))
                  )
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {manualLabelOptions.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name} ({label.mode})
                  </option>
                ))}
              </select>
              <select
                value={assignment.productType}
                onChange={(event) =>
                  setAssignments((prev) =>
                    prev.map((entry, i) =>
                      i === index
                        ? { ...entry, productType: event.target.value as ProductType, productIds: [] }
                        : entry
                    )
                  )
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="FABRIC">FABRIC</option>
                <option value="DESIGN">DESIGN</option>
                <option value="READY_TO_WEAR">READY_TO_WEAR</option>
              </select>
              <button
                type="button"
                onClick={() => setAssignments((prev) => prev.filter((_, i) => i !== index))}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 md:col-span-2"
              >
                Remove Assignment
              </button>
            </div>
            <select
              multiple
              value={assignment.productIds}
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                setAssignments((prev) =>
                  prev.map((entry, i) => (i === index ? { ...entry, productIds: selected } : entry))
                );
              }}
              className="h-40 w-full rounded-lg border px-3 py-2 text-sm"
            >
              {(catalog[assignment.productType] || []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Tip: hold Ctrl/Cmd to select multiple products.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
