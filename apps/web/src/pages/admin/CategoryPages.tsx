import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type CategoryPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';

type CategoryPageSettingsForm = {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  bannerHeight: number;
  pageSize: number;
  columns: number;
  showPagination: boolean;
  featuredSlots: Array<{ productId: string; isActive: boolean }>;
  rotatingProductIds: string[];
  rotatingColumns: number;
  rotatingRows: number;
  rotatingTitleSize: number;
  recommendationProductIds: string[];
  recommendationDisplayCount: number;
  recommendationConfiguredOnly: boolean;
  recommendationPreferSameCountry: boolean;
  recommendationPreferDifferentSeller: boolean;
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
  bannerHeight: 320,
  pageSize: 24,
  columns: 4,
  showPagination: true,
  featuredSlots: [
    { productId: '', isActive: false },
    { productId: '', isActive: false },
    { productId: '', isActive: false },
  ],
  rotatingProductIds: [],
  rotatingColumns: 2,
  rotatingRows: 1,
  rotatingTitleSize: 32,
  recommendationProductIds: [],
  recommendationDisplayCount: 12,
  recommendationConfiguredOnly: false,
  recommendationPreferSameCountry: true,
  recommendationPreferDifferentSeller: true,
};
const normalizeFeaturedSlots = (input: unknown) => {
  const rows = Array.isArray(input) ? input : [];
  const slots = rows
    .map((entry) => {
      const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      return {
        productId: String(row.productId || '').trim(),
        isActive: row.isActive !== false,
      };
    })
    .slice(0, 3);
  while (slots.length < 3) {
    slots.push({ productId: '', isActive: false });
  }
  return slots;
};
const activeFeaturedIdsFromSlots = (slots: Array<{ productId: string; isActive: boolean }>) =>
  slots
    .map((slot) => ({ productId: String(slot.productId || '').trim(), isActive: Boolean(slot.isActive) }))
    .filter((slot) => slot.isActive && slot.productId)
    .map((slot) => slot.productId)
    .slice(0, 3);

export default function AdminCategoryPages() {
  const [activePage, setActivePage] = useState<CategoryPageType>('READY_TO_WEAR');
  const [settings, setSettings] = useState<CategoryPageSettingsForm>(emptySettings);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [optionSearch, setOptionSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingOptions, setIsRefreshingOptions] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [selectedRotatingProductId, setSelectedRotatingProductId] = useState('');
  const [selectedRecommendationProductId, setSelectedRecommendationProductId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

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
          bannerHeight: Number(nextSettings.bannerHeight || 320),
          pageSize: Number(nextSettings.pageSize || 24),
          columns: Number(nextSettings.columns || 4),
          showPagination: Boolean(nextSettings.showPagination),
          featuredSlots: normalizeFeaturedSlots(
            Array.isArray(nextSettings.featuredSlots)
              ? nextSettings.featuredSlots
              : Array.isArray(nextSettings.featuredProductIds)
                ? nextSettings.featuredProductIds.map((id: string) => ({ productId: String(id || '').trim(), isActive: true }))
                : []
          ),
          rotatingProductIds: Array.isArray(nextSettings.rotatingProductIds)
            ? Array.from(new Set(nextSettings.rotatingProductIds.map((entry: any) => String(entry || '').trim()).filter(Boolean))).slice(0, 24)
            : [],
          rotatingColumns: Number(nextSettings.rotatingColumns || 2),
          rotatingRows: Number(nextSettings.rotatingRows || 1),
          rotatingTitleSize: Number(nextSettings.rotatingTitleSize || 32),
          recommendationProductIds: Array.isArray(nextSettings.recommendationProductIds)
            ? Array.from(
                new Set(nextSettings.recommendationProductIds.map((entry: any) => String(entry || '').trim()).filter(Boolean))
              ).slice(0, 120)
            : [],
          recommendationDisplayCount: Number(nextSettings.recommendationDisplayCount || 12),
          recommendationConfiguredOnly: Boolean(nextSettings.recommendationConfiguredOnly),
          recommendationPreferSameCountry: nextSettings.recommendationPreferSameCountry !== false,
          recommendationPreferDifferentSeller: nextSettings.recommendationPreferDifferentSeller !== false,
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
        bannerHeight: Math.max(220, Math.min(560, Math.round(Number(settings.bannerHeight || 320)))),
        pageSize: Math.max(8, Math.min(120, Math.round(Number(settings.pageSize || 24)))),
        columns: Math.max(2, Math.min(6, Math.round(Number(settings.columns || 4)))),
        showPagination: Boolean(settings.showPagination),
        featuredSlots: normalizeFeaturedSlots(settings.featuredSlots),
        featuredProductIds: activeFeaturedIdsFromSlots(settings.featuredSlots),
        rotatingProductIds: Array.from(
          new Set((settings.rotatingProductIds || []).map((entry) => String(entry || '').trim()).filter(Boolean))
        ).slice(0, 24),
        rotatingColumns: Math.max(1, Math.min(6, Math.round(Number(settings.rotatingColumns || 2)))),
        rotatingRows: Math.max(1, Math.min(6, Math.round(Number(settings.rotatingRows || 1)))),
        rotatingTitleSize: Math.max(16, Math.min(64, Math.round(Number(settings.rotatingTitleSize || 32)))),
        recommendationProductIds: Array.from(
          new Set((settings.recommendationProductIds || []).map((entry) => String(entry || '').trim()).filter(Boolean))
        ).slice(0, 120),
        recommendationDisplayCount: Math.max(1, Math.min(24, Math.round(Number(settings.recommendationDisplayCount || 12)))),
        recommendationConfiguredOnly: Boolean(settings.recommendationConfiguredOnly),
        recommendationPreferSameCountry: Boolean(settings.recommendationPreferSameCountry),
        recommendationPreferDifferentSeller: Boolean(settings.recommendationPreferDifferentSeller),
      });
      if (response.success && response.data?.settings) {
        setSettings({
          bannerTitle: String(response.data.settings.bannerTitle || ''),
          bannerSubtitle: String(response.data.settings.bannerSubtitle || ''),
          bannerImage: String(response.data.settings.bannerImage || ''),
          bannerHeight: Number(response.data.settings.bannerHeight || 320),
          pageSize: Number(response.data.settings.pageSize || 24),
          columns: Number(response.data.settings.columns || 4),
          showPagination: Boolean(response.data.settings.showPagination),
          featuredSlots: normalizeFeaturedSlots(
            Array.isArray(response.data.settings.featuredSlots)
              ? response.data.settings.featuredSlots
              : Array.isArray(response.data.settings.featuredProductIds)
                ? response.data.settings.featuredProductIds.map((id: string) => ({ productId: String(id || '').trim(), isActive: true }))
                : []
          ),
          rotatingProductIds: Array.isArray(response.data.settings.rotatingProductIds)
            ? Array.from(
                new Set(response.data.settings.rotatingProductIds.map((entry: any) => String(entry || '').trim()).filter(Boolean))
              ).slice(0, 24)
            : [],
          rotatingColumns: Number(response.data.settings.rotatingColumns || 2),
          rotatingRows: Number(response.data.settings.rotatingRows || 1),
          rotatingTitleSize: Number(response.data.settings.rotatingTitleSize || 32),
          recommendationProductIds: Array.isArray(response.data.settings.recommendationProductIds)
            ? Array.from(
                new Set(
                  response.data.settings.recommendationProductIds
                    .map((entry: any) => String(entry || '').trim())
                    .filter(Boolean)
                )
              ).slice(0, 120)
            : [],
          recommendationDisplayCount: Number(response.data.settings.recommendationDisplayCount || 12),
          recommendationConfiguredOnly: Boolean(response.data.settings.recommendationConfiguredOnly),
          recommendationPreferSameCountry: response.data.settings.recommendationPreferSameCountry !== false,
          recommendationPreferDifferentSeller: response.data.settings.recommendationPreferDifferentSeller !== false,
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

  const addRotatingProduct = () => {
    const productId = String(selectedRotatingProductId || '').trim();
    if (!productId) return;
    setSettings((prev) => ({
      ...prev,
      rotatingProductIds: Array.from(new Set([...(prev.rotatingProductIds || []), productId])).slice(0, 24),
    }));
    setSelectedRotatingProductId('');
  };

  const removeRotatingProduct = (productId: string) => {
    setSettings((prev) => ({
      ...prev,
      rotatingProductIds: (prev.rotatingProductIds || []).filter((entry) => entry !== productId),
    }));
  };

  const addRecommendationProduct = () => {
    const productId = String(selectedRecommendationProductId || '').trim();
    if (!productId) return;
    setSettings((prev) => ({
      ...prev,
      recommendationProductIds: Array.from(new Set([...(prev.recommendationProductIds || []), productId])).slice(0, 120),
    }));
    setSelectedRecommendationProductId('');
  };

  const removeRecommendationProduct = (productId: string) => {
    setSettings((prev) => ({
      ...prev,
      recommendationProductIds: (prev.recommendationProductIds || []).filter((entry) => entry !== productId),
    }));
  };

  const optionById = useMemo(
    () => new Map(productOptions.map((option) => [option.id, option] as const)),
    [productOptions]
  );

  const updateFeaturedSlot = (index: number, patch: Partial<{ productId: string; isActive: boolean }>) => {
    setSettings((prev) => {
      const slots = normalizeFeaturedSlots(prev.featuredSlots);
      slots[index] = {
        productId: patch.productId !== undefined ? String(patch.productId || '').trim() : slots[index].productId,
        isActive: patch.isActive !== undefined ? Boolean(patch.isActive) : slots[index].isActive,
      };
      return { ...prev, featuredSlots: slots };
    });
  };

  const handleBannerImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingBanner(true);
      setMessage(null);
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.upload.image(formData);
      if (response.success && response.data?.url) {
        setSettings((prev) => ({ ...prev, bannerImage: String(response.data.url) }));
      } else {
        setMessage('Failed to upload banner image.');
      }
    } catch (uploadError: any) {
      setMessage(uploadError?.response?.data?.message || uploadError?.message || 'Failed to upload banner image.');
    } finally {
      setIsUploadingBanner(false);
      event.target.value = '';
    }
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
                <span className="text-gray-700">Banner image</span>
                <input type="file" accept="image/*" className="hidden" id="category-page-banner-upload" onChange={handleBannerImageUpload} />
                <div className="flex gap-2">
                  <label
                    htmlFor="category-page-banner-upload"
                    className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {isUploadingBanner ? 'Uploading...' : 'Upload image'}
                  </label>
                  <input
                    type="text"
                    value={settings.bannerImage}
                    onChange={(event) => setSettings((prev) => ({ ...prev, bannerImage: event.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="/images/hero-readytowear.jpg or full URL"
                  />
                </div>
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
                <span className="text-gray-700">Banner height (px)</span>
                <input
                  type="number"
                  min={220}
                  max={560}
                  value={settings.bannerHeight}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      bannerHeight: Number.parseInt(event.target.value || '320', 10) || 320,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
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
                <h3 className="text-sm font-semibold text-gray-800">Main products on top of category page (up to 3)</h3>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {normalizeFeaturedSlots(settings.featuredSlots).map((slot, index) => (
                  <div key={`featured-slot-${index}`} className="rounded-md border p-3 space-y-2">
                    <label className="text-sm space-y-1 block">
                      <span className="text-gray-700">Main product #{index + 1}</span>
                      <select
                        value={slot.productId}
                        onChange={(event) => updateFeaturedSlot(index, { productId: event.target.value })}
                        className="w-full rounded-md border px-3 py-2"
                      >
                        <option value="">None selected</option>
                        {productOptions.map((option) => (
                          <option key={`${option.id}-${index}`} value={option.id}>
                            {option.name} · {option.ownerName} · ${Number(option.priceUsd || 0).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={slot.isActive}
                        onChange={(event) => updateFeaturedSlot(index, { isActive: event.target.checked })}
                        disabled={!slot.productId}
                      />
                      Active
                    </label>
                  </div>
                ))}
              </div>
              {productOptions.length === 0 && !isRefreshingOptions ? (
                <p className="text-xs text-amber-700">
                  No products found from this route. Try Refresh list or type search text; fallback loading is enabled.
                </p>
              ) : null}
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">You May Also Like recommendation matrix</h3>
              <p className="text-xs text-gray-600">
                Control random/related products shown on product detail pages for this category type.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm space-y-1">
                  <span className="text-gray-700">Display count</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={settings.recommendationDisplayCount}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        recommendationDisplayCount: Number.parseInt(event.target.value || '12', 10) || 12,
                      }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:col-span-1">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={settings.recommendationConfiguredOnly}
                      onChange={(event) =>
                        setSettings((prev) => ({ ...prev, recommendationConfiguredOnly: event.target.checked }))
                      }
                    />
                    Use only configured products
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={settings.recommendationPreferSameCountry}
                      onChange={(event) =>
                        setSettings((prev) => ({ ...prev, recommendationPreferSameCountry: event.target.checked }))
                      }
                    />
                    Prioritize same country
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={settings.recommendationPreferDifferentSeller}
                      onChange={(event) =>
                        setSettings((prev) => ({ ...prev, recommendationPreferDifferentSeller: event.target.checked }))
                      }
                    />
                    Prioritize different sellers/designers
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedRecommendationProductId}
                  onChange={(event) => setSelectedRecommendationProductId(event.target.value)}
                  className="min-w-[280px] flex-1 rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select product to add to recommendation pool</option>
                  {productOptions.map((option) => (
                    <option key={`recommendation-option-${option.id}`} value={option.id}>
                      {option.name} · {option.ownerName} · ${Number(option.priceUsd || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" onClick={addRecommendationProduct}>
                  Add product
                </Button>
              </div>
              {settings.recommendationProductIds.length > 0 ? (
                <div className="space-y-2">
                  {settings.recommendationProductIds.map((productId) => {
                    const option = optionById.get(productId);
                    return (
                      <div key={`recommendation-${productId}`} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                        <span className="truncate">{option ? `${option.name} · ${option.ownerName}` : productId}</span>
                        <button
                          type="button"
                          onClick={() => removeRecommendationProduct(productId)}
                          className="ml-3 shrink-0 text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  No recommendation products configured. If empty, dynamic product matching will still run.
                </p>
              )}
            </div>

            {activePage === 'READY_TO_WEAR' ? (
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  Rotating Ready-To-Wear section (after filters)
                </h3>
                <p className="text-xs text-gray-600">
                  Set products-per-row (columns) and rows. Products shown on refresh = columns × rows.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm space-y-1">
                    <span className="text-gray-700">Products per row (columns)</span>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={settings.rotatingColumns}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          rotatingColumns: Number.parseInt(event.target.value || '2', 10) || 2,
                        }))
                      }
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="text-sm space-y-1">
                    <span className="text-gray-700">Rows</span>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={settings.rotatingRows}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          rotatingRows: Number.parseInt(event.target.value || '1', 10) || 1,
                        }))
                      }
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="text-sm space-y-1 md:col-span-2">
                    <span className="text-gray-700">Rotating product title text size (px)</span>
                    <input
                      type="number"
                      min={16}
                      max={64}
                      value={settings.rotatingTitleSize}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          rotatingTitleSize: Number.parseInt(event.target.value || '32', 10) || 32,
                        }))
                      }
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Current target display count: {Math.max(1, Number(settings.rotatingColumns || 1)) * Math.max(1, Number(settings.rotatingRows || 1))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedRotatingProductId}
                    onChange={(event) => setSelectedRotatingProductId(event.target.value)}
                    className="min-w-[280px] flex-1 rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select product to add</option>
                    {productOptions.map((option) => (
                      <option key={`rotating-option-${option.id}`} value={option.id}>
                        {option.name} · {option.ownerName} · ${Number(option.priceUsd || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={addRotatingProduct}>
                    Add product
                  </Button>
                </div>
                {settings.rotatingProductIds.length > 0 ? (
                  <div className="space-y-2">
                    {settings.rotatingProductIds.map((productId) => {
                      const option = optionById.get(productId);
                      return (
                        <div key={`rotating-${productId}`} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                          <span className="truncate">
                            {option ? `${option.name} · ${option.ownerName}` : productId}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeRotatingProduct(productId)}
                            className="ml-3 shrink-0 text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No rotating products selected yet.</p>
                )}
              </div>
            ) : null}

            {settings.bannerImage ? (
              <div className="rounded-lg border overflow-hidden">
                <img
                  src={settings.bannerImage}
                  alt={`${selectedPageMeta.label} banner preview`}
                  className="w-full object-cover"
                  style={{ height: `${Math.max(220, Math.min(560, Number(settings.bannerHeight || 320)))}px` }}
                />
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
