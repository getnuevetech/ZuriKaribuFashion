import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, ListChecks, Search, Square, Ruler } from 'lucide-react';
import { api } from '../../services/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

interface MeasurementTemplateOption {
  name: string;
  unit: string;
  instructions?: string;
}

interface DesignMeasurementVariable {
  name: string;
  unit: string;
  isRequired: boolean;
  instructions?: string;
}

interface DesignerDesignMeasurementRow {
  id: string;
  name: string;
  status: string;
  categoryName: string;
  measurementVariables: DesignMeasurementVariable[];
}

const normalizeDesignRows = (value: unknown): DesignerDesignMeasurementRow[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry: any) => ({
      id: String(entry?.id || ''),
      name: String(entry?.name || 'Design'),
      status: String(entry?.status || 'DRAFT').toUpperCase(),
      categoryName: String(entry?.category?.name || 'Style'),
      measurementVariables: Array.isArray(entry?.measurementVariables)
        ? entry.measurementVariables
            .map((item: any) => ({
              name: String(item?.name || '').trim(),
              unit: String(item?.unit || 'cm').trim() || 'cm',
              isRequired: item?.isRequired !== false,
              instructions: item?.instructions ? String(item.instructions) : undefined,
            }))
            .filter((item: DesignMeasurementVariable) => Boolean(item.name))
        : [],
    }))
    .filter((row: DesignerDesignMeasurementRow) => Boolean(row.id));
};

export default function DesignerMeasurementsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [designs, setDesigns] = useState<DesignerDesignMeasurementRow[]>([]);
  const [templates, setTemplates] = useState<MeasurementTemplateOption[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);
  const [selectedMeasurementNames, setSelectedMeasurementNames] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [designsResult, templatesResult] = await Promise.allSettled([
        api.designer.getDesigns(),
        api.designer.getMeasurementTemplateOptions(),
      ]);

      if (designsResult.status === 'fulfilled' && designsResult.value?.success) {
        setDesigns(normalizeDesignRows(designsResult.value.data));
      } else {
        setDesigns([]);
      }

      if (templatesResult.status === 'fulfilled' && templatesResult.value?.success) {
        const rows = Array.isArray(templatesResult.value.data) ? templatesResult.value.data : [];
        const normalized = rows
          .map((item: any) => ({
            name: String(item?.name || '').trim(),
            unit: String(item?.unit || 'cm').trim() || 'cm',
            instructions: item?.instructions ? String(item.instructions) : undefined,
          }))
          .filter((item: MeasurementTemplateOption) => Boolean(item.name));
        setTemplates(normalized);
      } else {
        setTemplates([]);
      }
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || 'Unable to load measurement configuration.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredDesigns = useMemo(() => {
    const searchTerm = String(search || '').trim().toLowerCase();
    return designs.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!searchTerm) return true;
      return (
        item.name.toLowerCase().includes(searchTerm) ||
        item.categoryName.toLowerCase().includes(searchTerm) ||
        item.id.toLowerCase().includes(searchTerm)
      );
    });
  }, [designs, search, statusFilter]);

  const filteredDesignIds = useMemo(() => filteredDesigns.map((item) => item.id), [filteredDesigns]);
  const allFilteredSelected =
    filteredDesignIds.length > 0 && filteredDesignIds.every((id) => selectedDesignIds.includes(id));

  const toggleSelectFiltered = () => {
    if (allFilteredSelected) {
      setSelectedDesignIds((prev) => prev.filter((id) => !filteredDesignIds.includes(id)));
      return;
    }
    setSelectedDesignIds((prev) => Array.from(new Set([...prev, ...filteredDesignIds])));
  };

  const toggleDesignSelection = (designId: string) => {
    setSelectedDesignIds((prev) =>
      prev.includes(designId) ? prev.filter((id) => id !== designId) : [...prev, designId]
    );
  };

  const toggleMeasurementSelection = (name: string) => {
    setSelectedMeasurementNames((prev) =>
      prev.includes(name) ? prev.filter((entry) => entry !== name) : [...prev, name]
    );
  };

  const applyMeasurementsInBulk = async () => {
    setError(null);
    setSuccessMessage(null);
    if (selectedDesignIds.length === 0) {
      setError('Select one or more design products to update.');
      return;
    }
    if (selectedMeasurementNames.length === 0) {
      setError('Select at least one measurement template to apply.');
      return;
    }
    const measurementSet = new Set(selectedMeasurementNames.map((entry) => String(entry || '').trim()).filter(Boolean));
    const payloadMeasurements = templates
      .filter((item) => measurementSet.has(item.name))
      .map((item) => ({
        name: item.name,
        unit: item.unit || 'cm',
        isRequired: true,
        instructions: item.instructions || undefined,
      }));
    if (payloadMeasurements.length === 0) {
      setError('Selected measurement templates are invalid. Refresh and try again.');
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.allSettled(
        selectedDesignIds.map((designId) =>
          api.designer.updateDesign(designId, { measurementVariables: payloadMeasurements })
        )
      );
      let successCount = 0;
      let failureCount = 0;
      let firstFailureMessage = '';
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.success !== false) {
          successCount += 1;
          return;
        }
        failureCount += 1;
        if (!firstFailureMessage) {
          const reason: any = result.status === 'rejected' ? result.reason : result.value;
          firstFailureMessage = String(
            reason?.response?.data?.message || reason?.message || 'One or more products failed to update.'
          );
        }
      });

      if (successCount > 0) {
        const successfulIds = new Set(
          results
            .map((result, index) => ({ result, designId: selectedDesignIds[index] }))
            .filter((entry) => entry.result.status === 'fulfilled' && (entry.result as PromiseFulfilledResult<any>).value?.success !== false)
            .map((entry) => entry.designId)
        );
        setDesigns((prev) =>
          prev.map((row) =>
            successfulIds.has(row.id)
              ? {
                  ...row,
                  measurementVariables: payloadMeasurements,
                }
              : row
          )
        );
      }

      if (failureCount === 0) {
        setSuccessMessage(`Updated measurements for ${successCount} design product(s).`);
      } else {
        setSuccessMessage(`Updated ${successCount} design product(s), ${failureCount} failed.`);
        if (firstFailureMessage) {
          setError(firstFailureMessage);
        }
      }
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || 'Bulk measurement update failed.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Measurement Requirements</h1>
          <p className="mt-1 text-sm text-gray-600">
            Bulk-apply required measurements to multiple design products. You can still add extra required measurements
            from each product upload/edit popup after this bulk update.
          </p>
        </div>
        <Button onClick={() => void fetchData()} variant="outline">
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>
      ) : null}

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-amber-700" />
          <h2 className="text-lg font-semibold text-gray-900">Required measurement templates</h2>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">No measurement templates available yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const checked = selectedMeasurementNames.includes(template.name);
              return (
                <label
                  key={template.name}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMeasurementSelection(template.name)}
                  />
                  <span className="font-medium">{template.name}</span>
                  <span className="text-xs text-gray-500">({template.unit})</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              className="w-full rounded-lg border py-2 pl-10 pr-3"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border px-4 py-2"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <Button variant="outline" onClick={toggleSelectFiltered}>
            {allFilteredSelected ? <Square className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />}
            {allFilteredSelected ? 'Unselect filtered' : 'Select filtered'}
          </Button>
          <Button onClick={applyMeasurementsInBulk} disabled={saving || templates.length === 0 || filteredDesigns.length === 0}>
            <ListChecks className="mr-2 h-4 w-4" />
            {saving ? 'Applying...' : `Apply to ${selectedDesignIds.length} selected`}
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Select</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Style</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Current Required Measurements</th>
                </tr>
              </thead>
              <tbody>
                {filteredDesigns.map((item) => {
                  const selected = selectedDesignIds.includes(item.id);
                  const currentMeasurements = item.measurementVariables.map((entry) => `${entry.name} (${entry.unit})`);
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleDesignSelection(item.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="font-mono text-[11px] text-gray-400">ID: {item.id}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.categoryName}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            item.status === 'APPROVED'
                              ? 'green'
                              : item.status === 'PENDING_REVIEW'
                                ? 'yellow'
                                : item.status === 'REJECTED'
                                  ? 'red'
                                  : 'gray'
                          }
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {currentMeasurements.length > 0 ? currentMeasurements.join(' • ') : 'No required measurements yet'}
                      </td>
                    </tr>
                  );
                })}
                {filteredDesigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      No design products found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
