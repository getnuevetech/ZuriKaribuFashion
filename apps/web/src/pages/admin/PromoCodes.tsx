import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

interface PromoCodeRow {
  id?: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxDiscountUsd?: number;
  minOrderUsd?: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  criteria: {
    productTypes?: string[];
    productIds?: string[];
    countries?: string[];
    cities?: string[];
    materialTypeIds?: string[];
    designerIds?: string[];
    sellerIds?: string[];
    paymentProviders?: string[];
    shippingProviders?: string[];
    cardPatterns?: string[];
    shippingQuoteIds?: string[];
  };
}

const emptyPromo = (): PromoCodeRow => ({
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  maxDiscountUsd: undefined,
  minOrderUsd: undefined,
  isActive: true,
  startsAt: '',
  endsAt: '',
  criteria: {},
});

const toList = (value: string) =>
  Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );

const toText = (list?: string[]) => (Array.isArray(list) ? list.join(', ') : '');

export default function AdminPromoCodes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PromoCodeRow[]>([]);
  const [editing, setEditing] = useState<PromoCodeRow>(emptyPromo());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const response = await api.admin.getPromoCodes();
      if (response.success) {
        setRows(Array.isArray(response.data) ? response.data : []);
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load promo codes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const payload = {
        code: editing.code.trim().toUpperCase(),
        name: editing.name.trim(),
        description: editing.description?.trim() || undefined,
        discountType: editing.discountType,
        discountValue: Number(editing.discountValue || 0),
        maxDiscountUsd: editing.maxDiscountUsd ? Number(editing.maxDiscountUsd) : undefined,
        minOrderUsd: editing.minOrderUsd ? Number(editing.minOrderUsd) : undefined,
        isActive: editing.isActive,
        startsAt: editing.startsAt ? new Date(editing.startsAt).toISOString() : undefined,
        endsAt: editing.endsAt ? new Date(editing.endsAt).toISOString() : undefined,
        criteria: editing.criteria || {},
      };
      if (!payload.code || !payload.name || payload.discountValue <= 0) {
        setError('Code, name and discount value are required.');
        return;
      }
      if (editing.id) {
        await api.admin.updatePromoCode(editing.id, payload);
        setSuccess('Promo code updated.');
      } else {
        await api.admin.createPromoCode(payload);
        setSuccess('Promo code created.');
      }
      setEditing(emptyPromo());
      await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save promo code.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this promo code?')) return;
    try {
      setError('');
      await api.admin.deletePromoCode(id);
      setSuccess('Promo code deleted.');
      await load();
    } catch (removeError: any) {
      setError(removeError?.response?.data?.message || 'Failed to delete promo code.');
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
          <h1 className="text-2xl font-bold text-gray-900">Promo Codes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create promotion codes by product groups, location, vendor, payment/shipping methods, and card patterns.
          </p>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div> : null}

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">{editing.id ? 'Edit Promo Code' : 'Create Promo Code'}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={editing.code}
            onChange={(event) => setEditing((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
            placeholder="Code (e.g. AFSALE10)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={editing.name}
            onChange={(event) => setEditing((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Promotion name"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={editing.discountType}
            onChange={(event) => setEditing((prev) => ({ ...prev, discountType: event.target.value as 'PERCENTAGE' | 'FIXED' }))}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed USD</option>
          </select>
          <input
            type="number"
            value={editing.discountValue}
            onChange={(event) => setEditing((prev) => ({ ...prev, discountValue: Number(event.target.value || 0) }))}
            placeholder="Discount value"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={editing.maxDiscountUsd ?? ''}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, maxDiscountUsd: event.target.value ? Number(event.target.value) : undefined }))
            }
            placeholder="Max discount USD (optional)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={editing.minOrderUsd ?? ''}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, minOrderUsd: event.target.value ? Number(event.target.value) : undefined }))
            }
            placeholder="Minimum order USD (optional)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={editing.startsAt || ''}
            onChange={(event) => setEditing((prev) => ({ ...prev, startsAt: event.target.value }))}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={editing.endsAt || ''}
            onChange={(event) => setEditing((prev) => ({ ...prev, endsAt: event.target.value }))}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.isActive}
              onChange={(event) => setEditing((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <textarea
            value={editing.description || ''}
            onChange={(event) => setEditing((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Description"
            className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
            rows={2}
          />
          <input
            value={toText(editing.criteria.productTypes)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, productTypes: toList(event.target.value) } }))
            }
            placeholder="Product types (comma-separated: FABRIC,DESIGN,READY_TO_WEAR)"
            className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={toText(editing.criteria.productIds)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, productIds: toList(event.target.value) } }))
            }
            placeholder="Product IDs (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={toText(editing.criteria.countries)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, countries: toList(event.target.value) } }))
            }
            placeholder="Countries (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={toText(editing.criteria.cities)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, cities: toList(event.target.value) } }))
            }
            placeholder="Cities (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={toText(editing.criteria.materialTypeIds)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, materialTypeIds: toList(event.target.value) } }))
            }
            placeholder="Material type IDs (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={toText(editing.criteria.designerIds)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, designerIds: toList(event.target.value) } }))
            }
            placeholder="Designer IDs (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={toText(editing.criteria.sellerIds)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, sellerIds: toList(event.target.value) } }))
            }
            placeholder="Seller IDs (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={toText(editing.criteria.paymentProviders)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, paymentProviders: toList(event.target.value) } }))
            }
            placeholder="Payment providers (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={toText(editing.criteria.shippingProviders)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, shippingProviders: toList(event.target.value) } }))
            }
            placeholder="Shipping providers (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={toText(editing.criteria.cardPatterns)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, cardPatterns: toList(event.target.value) } }))
            }
            placeholder="Card prefixes/last digits (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={toText(editing.criteria.shippingQuoteIds)}
            onChange={(event) =>
              setEditing((prev) => ({ ...prev, criteria: { ...prev.criteria, shippingQuoteIds: toList(event.target.value) } }))
            }
            placeholder="Shipping option IDs (comma-separated)"
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving...' : editing.id ? 'Update Promo' : 'Create Promo'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(emptyPromo())}>
            <Plus className="mr-2 h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Existing Promo Codes</h2>
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">No promo codes created yet.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="rounded bg-gray-100 px-2 py-1 font-semibold">{row.code}</span>
                <span className="font-medium text-gray-900">{row.name}</span>
                <span className="text-gray-500">
                  {row.discountType === 'PERCENTAGE' ? `${row.discountValue}%` : `$${row.discountValue}`} off
                </span>
                <span className={`rounded px-2 py-0.5 text-xs ${row.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {row.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing({ ...emptyPromo(), ...row, criteria: row.criteria || {} })}>
                    Edit
                  </Button>
                  <button type="button" onClick={() => row.id && remove(row.id)} className="rounded p-2 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
