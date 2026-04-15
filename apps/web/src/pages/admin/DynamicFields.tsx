import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

const DATA_TYPE_OPTIONS = [
  'TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'ENUM',
  'MULTI_ENUM',
  'URL',
  'EMAIL',
  'PHONE',
  'JSON',
];

const MODULE_OPTIONS = ['PRODUCT', 'ACCOUNT', 'ORDER', 'TICKET', 'PAYMENT', 'SHIPPING', 'HOMEPAGE', 'CUSTOM'];
const SCOPE_OPTIONS = [
  'FABRIC',
  'READY_TO_WEAR',
  'DESIGN',
  'ACCOUNT_APPROVAL',
  'CUSTOMER',
  'SELLER',
  'DESIGNER',
  'ORDER',
  'TICKET',
  'GLOBAL',
];

const normalizeList = (value: string) =>
  String(value || '')
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export default function AdminDynamicFieldsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info');
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    module: '',
    scope: '',
    isActive: 'all',
  });
  const [form, setForm] = useState({
    key: '',
    label: '',
    module: 'PRODUCT',
    scope: 'FABRIC',
    dataType: 'TEXT',
    placeholder: '',
    helpText: '',
    defaultValue: '',
    optionsRaw: '',
    functionKeysRaw: '',
    isRequired: false,
    isActive: true,
  });

  const load = async () => {
    try {
      setLoading(true);
      const response = await api.admin.listDynamicFields({
        module: filters.module || undefined,
        scope: filters.scope || undefined,
        isActive: filters.isActive === 'all' ? undefined : filters.isActive === 'active',
      });
      if (response.success) {
        setRows(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to load dynamic fields.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filters.module, filters.scope, filters.isActive]);

  const groupedCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = `${String(row?.module || 'UNKNOWN')} / ${String(row?.scope || 'UNKNOWN')}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const create = async () => {
    if (!form.key.trim() || !form.label.trim()) {
      setMessageTone('error');
      setMessage('Field key and label are required.');
      return;
    }
    try {
      setSaving(true);
      setMessage('');
      const response = await api.admin.createDynamicField({
        key: form.key,
        label: form.label,
        module: form.module,
        scope: form.scope,
        dataType: form.dataType,
        placeholder: form.placeholder || undefined,
        helpText: form.helpText || undefined,
        defaultValue: form.defaultValue || undefined,
        options: normalizeList(form.optionsRaw),
        functionKeys: normalizeList(form.functionKeysRaw),
        isRequired: form.isRequired,
        isActive: form.isActive,
      });
      if (response.success) {
        setMessageTone('success');
        setMessage(response.message || 'Dynamic field created.');
        setForm((prev) => ({
          ...prev,
          key: '',
          label: '',
          placeholder: '',
          helpText: '',
          defaultValue: '',
          optionsRaw: '',
          functionKeysRaw: '',
          isRequired: false,
          isActive: true,
        }));
        await load();
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to create dynamic field.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: any, nextActive: boolean) => {
    try {
      setSaving(true);
      await api.admin.updateDynamicField(String(row?.id || ''), { isActive: nextActive });
      await load();
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to update field.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      setSaving(true);
      await api.admin.deleteDynamicField(id);
      setMessageTone('success');
      setMessage('Dynamic field deleted.');
      await load();
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to delete field.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dynamic Fields Manager</h1>
        <p className="text-sm text-gray-600">
          Create additional fields for any module/scope, define variable types and function behaviors, and keep fields ready for future automation sync.
        </p>
      </div>

      {message ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            messageTone === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : messageTone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-gray-200 bg-gray-50 text-gray-700'
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Create Dynamic Field</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="field_key (example: vendor_badge)"
            value={form.key}
            onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Field label"
            value={form.label}
            onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
          />
          <select
            className="rounded border px-3 py-2 text-sm"
            value={form.module}
            onChange={(event) => setForm((prev) => ({ ...prev, module: event.target.value }))}
          >
            {MODULE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-3 py-2 text-sm"
            value={form.scope}
            onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value }))}
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-3 py-2 text-sm"
            value={form.dataType}
            onChange={(event) => setForm((prev) => ({ ...prev, dataType: event.target.value }))}
          >
            {DATA_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Placeholder"
            value={form.placeholder}
            onChange={(event) => setForm((prev) => ({ ...prev, placeholder: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 text-sm md:col-span-2"
            placeholder="Help text"
            value={form.helpText}
            onChange={(event) => setForm((prev) => ({ ...prev, helpText: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Default value"
            value={form.defaultValue}
            onChange={(event) => setForm((prev) => ({ ...prev, defaultValue: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 text-sm md:col-span-2"
            placeholder="Options (comma separated) for enum-like fields"
            value={form.optionsRaw}
            onChange={(event) => setForm((prev) => ({ ...prev, optionsRaw: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 text-sm md:col-span-2"
            placeholder="Function keys (comma separated): e.g. text_grammar_enhancement,image_verification"
            value={form.functionKeysRaw}
            onChange={(event) => setForm((prev) => ({ ...prev, functionKeysRaw: event.target.value }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(event) => setForm((prev) => ({ ...prev, isRequired: event.target.checked }))}
            />
            Required
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <Button onClick={() => void create()} disabled={saving}>
            {saving ? 'Saving...' : 'Create Field'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Field Inventory</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <select
            className="rounded border px-3 py-2 text-sm"
            value={filters.module}
            onChange={(event) => setFilters((prev) => ({ ...prev, module: event.target.value }))}
          >
            <option value="">All modules</option>
            {MODULE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-3 py-2 text-sm"
            value={filters.scope}
            onChange={(event) => setFilters((prev) => ({ ...prev, scope: event.target.value }))}
          >
            <option value="">All scopes</option>
            {SCOPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-3 py-2 text-sm"
            value={filters.isActive}
            onChange={(event) => setFilters((prev) => ({ ...prev, isActive: event.target.value }))}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <Button variant="outline" onClick={() => void load()} disabled={loading || saving}>
            Refresh
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {groupedCount.map(([key, count]) => (
            <span key={key} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
              {key}: {count}
            </span>
          ))}
        </div>
        {loading ? (
          <div className="mt-4 text-sm text-gray-500">Loading fields...</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1300px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-2">Field</th>
                  <th className="px-3 py-2">Module / Scope</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Functions</th>
                  <th className="px-3 py-2">Required</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row?.id || '')} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{String(row?.label || row?.key || '')}</p>
                      <p className="font-mono text-[11px] text-gray-500">{String(row?.key || '')}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {String(row?.module || '-')}/{String(row?.scope || '-')}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{String(row?.dataType || '-')}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {Array.isArray(row?.functionKeys) && row.functionKeys.length > 0
                        ? row.functionKeys.join(', ')
                        : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(row?.isRequired)}
                        onChange={(event) =>
                          void api.admin
                            .updateDynamicField(String(row?.id || ''), { isRequired: event.target.checked })
                            .then(() => load())
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          row?.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row?.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => void toggleActive(row, !Boolean(row?.isActive))}
                          disabled={saving}
                        >
                          {row?.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void remove(String(row?.id || ''))}
                          disabled={saving}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length < 1 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                      No dynamic fields found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

