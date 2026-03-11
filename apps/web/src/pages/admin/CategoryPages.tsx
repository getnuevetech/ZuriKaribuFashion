import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type CategoryPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';

type CategoryPageSettingsForm = {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  pageSize: number;
  columns: number;
  showPagination: boolean;
  featuredProductIds: string[];
};

type ProductOption = {
  id: string;
  name: string;
  ownerName: string;
  country: string;
  priceUsd: number;
  image: string;
};

const PAGE_TABS: Array<{ key: CategoryPageType; label: string; description: string }> = [
  { key: 'READY_TO_WEAR', label: 'Ready To Wear', description: 'Controls /ready-to-wear listing page.' },
  { key: 'FABRIC_TO_BUY', label: 'Fabrics To Buy', description: 'Controls /fabrics listing page.' },
  { key: 'CUSTOM_TO_WEAR', label: 'Custom To Wear', description: 'Controls /designs listing page.' },
];

const emptySettings: CategoryPageSettingsForm = {
  bannerTitle: '',
  bannerSubtitle: '',
  bannerImage: '',
  pageSize: 24,
  columns: 4,
  showPagination: true,
  featuredProductIds: [],
};

const normalizeFeaturedIds = (input: string[]) =>
  Array.from(new Set((input || []).map((entry) => String(entry || '').trim()).filter(Boolean))).slice(0, 2);

export default function AdminCategoryPages() {
  const [activePage, setActivePage] = useState<CategoryPageType>('READY_TO_WEAR');
  const [settings, setSettings] = useState<CategoryPageSettingsForm>(emptySettings);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [optionSearch, setOptionSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingOptions, setIsRefreshingOptions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const featuredOne = settings.featuredProductIds[0] || '';
  const featuredTwo = settings.featuredProductIds[1] || '';

  const selectedPageMeta = useMemo(
    () => PAGE_TABS.find((tab) => tab.key === activePage) || PAGE_TABS[0],
    [activePage]
  );

  const loadOptions = async (search = '') => {
    setIsRefreshingOptions(true);
    try {
      const optionsResponse = await api.admin.getCategoryPageProductOptions(activePage, {
        search: search || undefined,
        limit: 120,
      });
      if (optionsResponse.success && Array.isArray(optionsResponse.data)) {
        setProductOptions(optionsResponse.data);
      } else {
        setProductOptions([]);
      }
    } catch (error) {
      console.error('Failed to load category page product options:', error);
      setProductOptions([]);
    } finally {
      setIsRefreshingOptions(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await api.admin.getCategoryPageSettings(activePage);
      if (!response.success || !response.data?.settings) {
        setSettings(emptySettings);
      } else {
        const nextSettings = response.data.settings;
        setSettings({
          bannerTitle: String(nextSettings.bannerTitle || ''),
          bannerSubtitle: String(nextSettings.bannerSubtitle || ''),
          bannerImage: String(nextSettings.bannerImage || ''),
          pageSize: Number(nextSettings.pageSize || 24),
          columns: Number(nextSettings.columns || 4),
          showPagination: Boolean(nextSettings.showPagination),
          featuredProductIds: normalizeFeaturedIds(Array.isArray(nextSettings.featuredProductIds) ? nextSettings.featuredProductIds : []),
        });
      }
      await loadOptions(optionSearch);
    } catch (error) {
      console.error('Failed to load category page settings:', error);
      setMessage('Unable to load category page settings right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  const saveSettings = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await api.admin.updateCategoryPageSettings(activePage, {
        bannerTitle: settings.bannerTitle.trim(),
        bannerSubtitle: settings.bannerSubtitle.trim(),
        bannerImage: settings.bannerImage.trim(),
        pageSize: Math.max(8, Math.min(120, Math.round(Number(settings.pageSize || 24)))),
        columns: Math.max(2, Math.min(6, Math.round(Number(settings.columns || 4)))),
        showPagination: Boolean(settings.showPagination),
        featuredProductIds: normalizeFeaturedIds(settings.featuredProductIds),
      });
      if (response.success && response.data?.settings) {
        setSettings({
          bannerTitle: String(response.data.settings.bannerTitle || ''),
          bannerSubtitle: String(response.data.settings.bannerSubtitle || ''),
          bannerImage: String(response.data.settings.bannerImage || ''),
          pageSize: Number(response.data.settings.pageSize || 24),
          columns: Number(response.data.settings.columns || 4),
          showPagination: Boolean(response.data.settings.showPagination),
          featuredProductIds: normalizeFeaturedIds(response.data.settings.featuredProductIds || []),
        });
      }
      setMessage('Category page settings saved.');
    } catch (error) {
      console.error('Failed to save category page settings:', error);
      setMessage('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateFeaturedAt = (index: 0 | 1, value: string) => {
    const next = [...settings.featuredProductIds];
    next[index] = value;
    const normalized = normalizeFeaturedIds(next);
    setSettings((prev) => ({ ...prev, featuredProductIds: normalized }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Category Pages</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage banner, featured products, pagination size, and columns for Ready To Wear, Fabrics, and Custom To Wear pages.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActivePage(tab.key)}
            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
              activePage === tab.key
                ? 'border-black bg-black text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{selectedPageMeta.label}</h2>
          <p className="text-sm text-gray-600">{selectedPageMeta.description}</p>
        </div>

        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-coral-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Banner title</span>
                <input
                  type="text"
                  value={settings.bannerTitle}
                  onChange={(event) => setSettings((prev) => ({ ...prev, bannerTitle: event.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Banner image URL</span>
                <input
                  type="text"
                  value={settings.bannerImage}
                  onChange={(event) => setSettings((prev) => ({ ...prev, bannerImage: event.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="/images/hero-readytowear.jpg or full URL"
                />
              </label>
              <label className="text-sm space-y-1 lg:col-span-2">
                <span className="text-gray-700">Banner subtitle</span>
                <textarea
                  value={settings.bannerSubtitle}
                  onChange={(event) => setSettings((prev) => ({ ...prev, bannerSubtitle: event.target.value }))}
                  className="w-full rounded-md border px-3 py-2 min-h-[86px]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Products per page (pagination)</span>
                <input
                  type="number"
                  min={8}
                  max={120}
                  value={settings.pageSize}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      pageSize: Number.parseInt(event.target.value || '24', 10) || 24,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Grid columns</span>
                <input
                  type="number"
                  min={2}
                  max={6}
                  value={settings.columns}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      columns: Number.parseInt(event.target.value || '4', 10) || 4,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm space-y-1 flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={settings.showPagination}
                  onChange={(event) => setSettings((prev) => ({ ...prev, showPagination: event.target.checked }))}
                />
                <span className="text-gray-700">Show pagination controls</span>
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-800">Two main products on top of category page</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={optionSearch}
                    onChange={(event) => setOptionSearch(event.target.value)}
                    placeholder="Search products..."
                    className="rounded-md border px-3 py-1.5 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadOptions(optionSearch)}
                    disabled={isRefreshingOptions}
                  >
                    {isRefreshingOptions ? 'Loading...' : 'Refresh list'}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm space-y-1">
                  <span className="text-gray-700">Main product #1</span>
                  <select
                    value={featuredOne}
                    onChange={(event) => updateFeaturedAt(0, event.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="">None selected</option>
                    {productOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} · {option.ownerName} · ${Number(option.priceUsd || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-gray-700">Main product #2</span>
                  <select
                    value={featuredTwo}
                    onChange={(event) => updateFeaturedAt(1, event.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="">None selected</option>
                    {productOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} · {option.ownerName} · ${Number(option.priceUsd || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {settings.bannerImage ? (
              <div className="rounded-lg border overflow-hidden">
                <img src={settings.bannerImage} alt={`${selectedPageMeta.label} banner preview`} className="w-full h-44 object-cover" />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className={`text-sm ${message?.toLowerCase().includes('failed') ? 'text-red-600' : 'text-gray-600'}`}>
                {message || ' '}
              </p>
              <Button onClick={() => void saveSettings()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save category page settings'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
