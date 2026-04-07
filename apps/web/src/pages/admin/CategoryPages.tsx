import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api, resolveAssetUrl } from '../../services/api';
import {
  CATEGORY_PAGE_DESIGN_PRESET_OPTIONS,
  CategoryPageDesignPreset,
} from '../../design/categoryPagePreset';

type CategoryPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR' | 'COUNTRY_CATEGORY' | 'OTHER_CATEGORY';
type CategoryFilterDefinition = {
  id: string;
  key: 'STYLE' | 'FABRIC_TYPE' | 'MATERIAL' | 'COUNTRY' | 'PRICE' | 'COLOR' | 'CATEGORY';
  label: string;
  inputType: 'DROPDOWN' | 'SUGGESTIVE_SEARCH';
  enabled: boolean;
  options: string[];
  displayOrder: number;
};

type CategoryPageSettingsForm = {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  designPreset: CategoryPageDesignPreset;
  bannerHeight: number;
  pageSize: number;
  columns: number;
  showPagination: boolean;
  featuredSlots: Array<{ productId: string; isActive: boolean }>;
  rotatingProductIds: string[];
  rotatingColumns: number;
  rotatingRows: number;
  rotatingTitleSize: number;
  primaryGridRows: number;
  primaryGridColumns: number;
  primaryGridProductIds: string[];
  filterDefinitions: CategoryFilterDefinition[];
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
  { key: 'READY_TO_WEAR', label: 'Ready To Wear', description: 'Controls /readytowear listing page.' },
  { key: 'FABRIC_TO_BUY', label: 'Fabrics To Buy', description: 'Controls /fabricstobuy listing page.' },
  { key: 'CUSTOM_TO_WEAR', label: 'Custom To Wear', description: 'Controls /cystomtowear listing page.' },
  { key: 'COUNTRY_CATEGORY', label: 'Country Category', description: 'Controls /country-products listing and filter defaults.' },
  { key: 'OTHER_CATEGORY', label: 'Other Category', description: 'Controls additional category page variants.' },
];

const DEFAULT_FILTERS_BY_PAGE: Record<CategoryPageType, CategoryFilterDefinition[]> = {
  READY_TO_WEAR: [
    { id: 'style', key: 'STYLE', label: 'Style', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
    { id: 'fabric-type', key: 'FABRIC_TYPE', label: 'Fabric Type', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 2 },
    { id: 'material', key: 'MATERIAL', label: 'Material', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 3 },
    { id: 'country', key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 4 },
    { id: 'price', key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 5 },
  ],
  CUSTOM_TO_WEAR: [
    { id: 'style', key: 'STYLE', label: 'Style', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
    { id: 'country', key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
    { id: 'price', key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 3 },
  ],
  FABRIC_TO_BUY: [
    { id: 'color', key: 'COLOR', label: 'Color', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 1 },
    { id: 'fabric-type', key: 'FABRIC_TYPE', label: 'Fabric Type', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
    { id: 'material', key: 'MATERIAL', label: 'Material', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 3 },
    { id: 'price', key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 4 },
    { id: 'country', key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 5 },
  ],
  COUNTRY_CATEGORY: [
    { id: 'country', key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
    { id: 'category', key: 'CATEGORY', label: 'Category', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
    { id: 'price', key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 3 },
  ],
  OTHER_CATEGORY: [
    { id: 'category', key: 'CATEGORY', label: 'Category', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
    { id: 'country', key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
    { id: 'price', key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 3 },
  ],
};
const normalizeFilterDefinitions = (pageType: CategoryPageType, input: unknown): CategoryFilterDefinition[] => {
  const fallback = DEFAULT_FILTERS_BY_PAGE[pageType];
  const rows = Array.isArray(input) ? input : fallback;
  const normalized = rows
    .map((entry, index) => {
      const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const fallbackRow = fallback[index] || fallback[0];
      const keyToken = String(row.key || fallbackRow.key || '').trim().toUpperCase();
      const key = (
        keyToken === 'STYLE' ||
        keyToken === 'FABRIC_TYPE' ||
        keyToken === 'MATERIAL' ||
        keyToken === 'COUNTRY' ||
        keyToken === 'PRICE' ||
        keyToken === 'COLOR' ||
        keyToken === 'CATEGORY'
      )
        ? (keyToken as CategoryFilterDefinition['key'])
        : fallbackRow.key;
      return {
        id: String(row.id || fallbackRow.id || `${key.toLowerCase()}-${index + 1}`),
        key,
        label: String(row.label || fallbackRow.label || key),
        inputType: String(row.inputType || fallbackRow.inputType || 'DROPDOWN').trim().toUpperCase() === 'SUGGESTIVE_SEARCH'
          ? 'SUGGESTIVE_SEARCH'
          : 'DROPDOWN',
        enabled: row.enabled !== false,
        options: Array.isArray(row.options)
          ? row.options.map((token) => String(token || '').trim()).filter(Boolean).slice(0, 40)
          : fallbackRow.options,
        displayOrder: Number.isFinite(Number(row.displayOrder))
          ? Math.max(0, Math.min(999, Math.round(Number(row.displayOrder))))
          : fallbackRow.displayOrder,
      } satisfies CategoryFilterDefinition;
    })
    .slice(0, 20);
  normalized.sort((a, b) => a.displayOrder - b.displayOrder);
  return normalized;
};

const emptySettings: CategoryPageSettingsForm = {
  bannerTitle: '',
  bannerSubtitle: '',
  bannerImage: '',
  designPreset: 'STANDARD',
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
  primaryGridRows: 2,
  primaryGridColumns: 3,
  primaryGridProductIds: [],
  filterDefinitions: DEFAULT_FILTERS_BY_PAGE.READY_TO_WEAR,
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
  const [selectedPrimaryGridProductId, setSelectedPrimaryGridProductId] = useState('');
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
          bannerImage: resolveAssetUrl(String(nextSettings.bannerImage || '')),
          designPreset:
            String(nextSettings.designPreset || '').trim().toUpperCase() === 'EDITORIAL'
              ? 'EDITORIAL'
              : String(nextSettings.designPreset || '').trim().toUpperCase() === 'MINIMAL'
                ? 'MINIMAL'
                : 'STANDARD',
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
          primaryGridRows: Math.max(1, Math.min(2, Number(nextSettings.primaryGridRows || nextSettings.rotatingRows || 2))),
          primaryGridColumns: Math.max(1, Math.min(6, Number(nextSettings.primaryGridColumns || nextSettings.rotatingColumns || 3))),
          primaryGridProductIds: Array.isArray(nextSettings.primaryGridProductIds)
            ? Array.from(new Set(nextSettings.primaryGridProductIds.map((entry: any) => String(entry || '').trim()).filter(Boolean))).slice(0, 24)
            : [],
          filterDefinitions: normalizeFilterDefinitions(activePage, nextSettings.filterDefinitions),
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
        designPreset: settings.designPreset,
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
        primaryGridRows: Math.max(1, Math.min(2, Math.round(Number(settings.primaryGridRows || 2)))),
        primaryGridColumns: Math.max(1, Math.min(6, Math.round(Number(settings.primaryGridColumns || 3)))),
        primaryGridProductIds: Array.from(
          new Set((settings.primaryGridProductIds || []).map((entry) => String(entry || '').trim()).filter(Boolean))
        ).slice(0, 24),
        filterDefinitions: normalizeFilterDefinitions(activePage, settings.filterDefinitions).map((entry) => ({
          id: String(entry.id || '').trim(),
          key: entry.key,
          label: String(entry.label || '').trim(),
          inputType: entry.inputType,
          enabled: Boolean(entry.enabled),
          options: Array.isArray(entry.options)
            ? entry.options.map((token) => String(token || '').trim()).filter(Boolean).slice(0, 40)
            : [],
          displayOrder: Math.max(0, Math.min(999, Math.round(Number(entry.displayOrder || 0)))),
        })),
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
          bannerImage: resolveAssetUrl(String(response.data.settings.bannerImage || '')),
          designPreset:
            String(response.data.settings.designPreset || '').trim().toUpperCase() === 'EDITORIAL'
              ? 'EDITORIAL'
              : String(response.data.settings.designPreset || '').trim().toUpperCase() === 'MINIMAL'
                ? 'MINIMAL'
                : 'STANDARD',
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
          primaryGridRows: Math.max(
            1,
            Math.min(2, Number(response.data.settings.primaryGridRows || response.data.settings.rotatingRows || 2))
          ),
          primaryGridColumns: Math.max(
            1,
            Math.min(6, Number(response.data.settings.primaryGridColumns || response.data.settings.rotatingColumns || 3))
          ),
          primaryGridProductIds: Array.isArray(response.data.settings.primaryGridProductIds)
            ? Array.from(
                new Set(response.data.settings.primaryGridProductIds.map((entry: any) => String(entry || '').trim()).filter(Boolean))
              ).slice(0, 24)
            : [],
          filterDefinitions: normalizeFilterDefinitions(activePage, response.data.settings.filterDefinitions),
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

  const addPrimaryGridProduct = () => {
    const productId = String(selectedPrimaryGridProductId || '').trim();
    if (!productId) return;
    setSettings((prev) => ({
      ...prev,
      primaryGridProductIds: Array.from(new Set([...(prev.primaryGridProductIds || []), productId])).slice(0, 24),
    }));
    setSelectedPrimaryGridProductId('');
  };

  const removePrimaryGridProduct = (productId: string) => {
    setSettings((prev) => ({
      ...prev,
      primaryGridProductIds: (prev.primaryGridProductIds || []).filter((entry) => entry !== productId),
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

  const updateFilterDefinition = (index: number, patch: Partial<CategoryFilterDefinition>) => {
    setSettings((prev) => {
      const rows = normalizeFilterDefinitions(activePage, prev.filterDefinitions);
      const existing = rows[index];
      if (!existing) return prev;
      rows[index] = {
        ...existing,
        ...patch,
        options: patch.options !== undefined ? patch.options : existing.options,
      };
      return { ...prev, filterDefinitions: rows };
    });
  };

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
        setSettings((prev) => ({ ...prev, bannerImage: resolveAssetUrl(String(response.data.url)) }));
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
        <h1 className="text-2xl font-semibold text-gray-900">Category Pages Manager</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage all category page variables including RTW, FTB, CTW, Country Category and Other Category.
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
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Design preset</span>
                <select
                  value={settings.designPreset}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      designPreset:
                        String(event.target.value || '').toUpperCase() === 'EDITORIAL'
                          ? 'EDITORIAL'
                          : String(event.target.value || '').toUpperCase() === 'MINIMAL'
                            ? 'MINIMAL'
                            : 'STANDARD',
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                >
                  {CATEGORY_PAGE_DESIGN_PRESET_OPTIONS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-gray-500">
                  {
                    CATEGORY_PAGE_DESIGN_PRESET_OPTIONS.find((preset) => preset.value === settings.designPreset)
                      ?.description
                  }
                </span>
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
              <h3 className="text-sm font-semibold text-gray-800">Category Filters (Dropdown or Suggestive Search)</h3>
              <p className="text-xs text-gray-600">
                Configure filter labels and input type for this category page. Use comma-separated options for dropdown suggestions.
              </p>
              <div className="space-y-2">
                {settings.filterDefinitions.map((filter, filterIndex) => (
                  <div key={filter.id || `${filter.key}-${filterIndex}`} className="rounded border p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                      <label className="md:col-span-2 text-xs">
                        Filter Key
                        <select
                          className="mt-1 w-full rounded border px-2 py-1"
                          value={filter.key}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              filterDefinitions: prev.filterDefinitions.map((entry, entryIndex) =>
                                entryIndex === filterIndex
                                  ? { ...entry, key: event.target.value as CategoryFilterDefinition['key'] }
                                  : entry
                              ),
                            }))
                          }
                        >
                          <option value="STYLE">Style</option>
                          <option value="FABRIC_TYPE">Fabric Type</option>
                          <option value="MATERIAL">Material</option>
                          <option value="COUNTRY">Country</option>
                          <option value="PRICE">Price</option>
                          <option value="COLOR">Color</option>
                          <option value="CATEGORY">Category</option>
                        </select>
                      </label>
                      <label className="md:col-span-3 text-xs">
                        Filter Label
                        <input
                          className="mt-1 w-full rounded border px-2 py-1"
                          value={filter.label}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              filterDefinitions: prev.filterDefinitions.map((entry, entryIndex) =>
                                entryIndex === filterIndex ? { ...entry, label: event.target.value } : entry
                              ),
                            }))
                          }
                        />
                      </label>
                      <label className="md:col-span-2 text-xs">
                        Input Type
                        <select
                          className="mt-1 w-full rounded border px-2 py-1"
                          value={filter.inputType}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              filterDefinitions: prev.filterDefinitions.map((entry, entryIndex) =>
                                entryIndex === filterIndex
                                  ? { ...entry, inputType: event.target.value === 'SUGGESTIVE_SEARCH' ? 'SUGGESTIVE_SEARCH' : 'DROPDOWN' }
                                  : entry
                              ),
                            }))
                          }
                        >
                          <option value="DROPDOWN">Dropdown</option>
                          <option value="SUGGESTIVE_SEARCH">Suggestive Search</option>
                        </select>
                      </label>
                      <label className="md:col-span-2 text-xs">
                        Display Order
                        <input
                          type="number"
                          className="mt-1 w-full rounded border px-2 py-1"
                          min={0}
                          max={999}
                          value={filter.displayOrder}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              filterDefinitions: prev.filterDefinitions.map((entry, entryIndex) =>
                                entryIndex === filterIndex
                                  ? { ...entry, displayOrder: Math.max(0, Math.min(999, Number(event.target.value || entry.displayOrder))) }
                                  : entry
                              ),
                            }))
                          }
                        />
                      </label>
                      <label className="md:col-span-1 inline-flex items-center gap-2 text-xs pt-6">
                        <input
                          type="checkbox"
                          checked={filter.enabled}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              filterDefinitions: prev.filterDefinitions.map((entry, entryIndex) =>
                                entryIndex === filterIndex ? { ...entry, enabled: event.target.checked } : entry
                              ),
                            }))
                          }
                        />
                        Enabled
                      </label>
                      <label className="md:col-span-2 text-xs">
                        Dropdown/Suggested options
                        <input
                          className="mt-1 w-full rounded border px-2 py-1"
                          value={filter.options.join(', ')}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              filterDefinitions: prev.filterDefinitions.map((entry, entryIndex) =>
                                entryIndex === filterIndex
                                  ? {
                                      ...entry,
                                      options: event.target.value
                                        .split(',')
                                        .map((token) => token.trim())
                                        .filter(Boolean)
                                        .slice(0, 40),
                                    }
                                  : entry
                              ),
                            }))
                          }
                          placeholder="comma, separated, values"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Primary Product Grid (First 2 rows)</h3>
              <p className="text-xs text-gray-600">
                Configure first-row/second-row layout and assign products by dropdown or search.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm space-y-1">
                  <span className="text-gray-700">Rows (max 2)</span>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={settings.primaryGridRows}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        primaryGridRows: Math.max(1, Math.min(2, Number.parseInt(event.target.value || '2', 10) || 2)),
                      }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-gray-700">Columns</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={settings.primaryGridColumns}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        primaryGridColumns: Math.max(1, Math.min(6, Number.parseInt(event.target.value || '3', 10) || 3)),
                      }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Current total slots: {Math.max(1, Number(settings.primaryGridRows || 1)) * Math.max(1, Number(settings.primaryGridColumns || 1))}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedPrimaryGridProductId}
                  onChange={(event) => setSelectedPrimaryGridProductId(event.target.value)}
                  className="min-w-[280px] flex-1 rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select product for first-2-row grid</option>
                  {productOptions.map((option) => (
                    <option key={`primary-grid-option-${option.id}`} value={option.id}>
                      {option.name} · {option.ownerName} · ${Number(option.priceUsd || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" onClick={addPrimaryGridProduct}>
                  Add product
                </Button>
              </div>
              {settings.primaryGridProductIds.length > 0 ? (
                <div className="space-y-2">
                  {settings.primaryGridProductIds.map((productId) => {
                    const option = optionById.get(productId);
                    return (
                      <div key={`primary-grid-${productId}`} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                        <span className="truncate">{option ? `${option.name} · ${option.ownerName}` : productId}</span>
                        <button
                          type="button"
                          onClick={() => removePrimaryGridProduct(productId)}
                          className="ml-3 shrink-0 text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No primary-grid products selected yet.</p>
              )}
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

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">
                Rotating {selectedPageMeta.label} section (after filters)
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

            {settings.bannerImage ? (
              <div className="rounded-lg border overflow-hidden">
                <img
                  src={resolveAssetUrl(settings.bannerImage)}
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
