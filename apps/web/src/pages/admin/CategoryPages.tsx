import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api, resolveAssetUrl } from '../../services/api';

type CategoryPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR' | 'COUNTRY' | 'SHOP';
type CategoryFilterKey = 'STYLE' | 'FABRIC_TYPE' | 'MATERIAL' | 'COUNTRY' | 'PRICE' | 'COLOR' | 'CATEGORY';
type CategoryFilterInputType = 'DROPDOWN' | 'SUGGESTIVE_SEARCH';

type CategoryFilterDefinition = {
  id: string;
  key: CategoryFilterKey;
  label: string;
  inputType: CategoryFilterInputType;
  enabled: boolean;
  options: string[];
  displayOrder: number;
};

type CategoryPageSettingsForm = {
  title: string;
  subtitle: string;
  bannerImage: string;
  bannerHeight: number;
  searchPlaceholder: string;
  pageSize: number;
  columns: number;
  showPagination: boolean;
  primaryGridRows: number;
  primaryGridColumns: number;
  primaryGridProductIds: string[];
  countryRowCount: number;
  productCard: {
    imageEnabled: boolean;
    fieldOrder: string[];
    imageAspectRatio: '3:4' | '1:1';
    textGap: number;
    contentPaddingX: number;
    contentPaddingY: number;
    designerNameEnabled: boolean;
    designerNameFontSize: number;
    designerNameColor: string;
    productNameEnabled: boolean;
    productNameFontSize: number;
    productNameColor: string;
    shortDescriptionEnabled: boolean;
    shortDescriptionFontSize: number;
    shortDescriptionColor: string;
    shortDescriptionWordLimit: number;
    priceEnabled: boolean;
    priceFontSize: number;
    priceColor: string;
    labelEnabled: boolean;
    labelFontSize: number;
    labelTextColor: string;
    labelBackgroundColor: string;
    labelPosition: 'TOP_LEFT';
    likesEnabled: boolean;
    likesSize: number;
    likesColor: string;
    likesActiveColor: string;
    likesPosition: 'TOP_RIGHT';
    countryIconEnabled: boolean;
    countryIconSize: number;
    countryIconPosition: 'BOTTOM_RIGHT';
  };
  filterDefinitions: CategoryFilterDefinition[];
};

const splitCommaOptions = (input: string) =>
  input
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 100);

type ProductOption = {
  id: string;
  sourceType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
  name: string;
  ownerName: string;
  country: string;
  priceUsd: number;
  image: string;
};

const PAGE_TABS: Array<{ key: CategoryPageType; label: string; description: string }> = [
  { key: 'READY_TO_WEAR', label: 'Ready To Wear', description: 'Manage all RTW page variables and filters.' },
  { key: 'FABRIC_TO_BUY', label: 'Fabrics To Buy', description: 'Manage all FTB page variables and filters.' },
  { key: 'CUSTOM_TO_WEAR', label: 'Custom To Wear', description: 'Manage all CTW page variables and filters.' },
  { key: 'COUNTRY', label: 'Country Page', description: 'Standardized country category page.' },
  { key: 'SHOP', label: 'Shop Page', description: 'Unified /shop page for RTW, FTB and CTW products.' },
];

const EMPTY_SETTINGS: CategoryPageSettingsForm = {
  title: '',
  subtitle: '',
  bannerImage: '',
  bannerHeight: 680,
  searchPlaceholder: '',
  pageSize: 24,
  columns: 4,
  showPagination: true,
  primaryGridRows: 2,
  primaryGridColumns: 3,
  primaryGridProductIds: [],
  countryRowCount: 12,
  productCard: {
    imageEnabled: true,
    fieldOrder: ['DESIGNER_NAME', 'PRODUCT_NAME', 'SHORT_DESCRIPTION', 'PRICE'],
    imageAspectRatio: '3:4',
    textGap: 6,
    contentPaddingX: 16,
    contentPaddingY: 16,
    designerNameEnabled: true,
    designerNameFontSize: 14,
    designerNameColor: '#6b7280',
    productNameEnabled: true,
    productNameFontSize: 16,
    productNameColor: '#111111',
    shortDescriptionEnabled: true,
    shortDescriptionFontSize: 13,
    shortDescriptionColor: '#4b5563',
    shortDescriptionWordLimit: 10,
    priceEnabled: true,
    priceFontSize: 14,
    priceColor: '#e66045',
    labelEnabled: true,
    labelFontSize: 11,
    labelTextColor: '#ffffff',
    labelBackgroundColor: 'rgba(17, 17, 17, 0.75)',
    labelPosition: 'TOP_LEFT',
    likesEnabled: true,
    likesSize: 18,
    likesColor: '#ffffff',
    likesActiveColor: '#ef4444',
    likesPosition: 'TOP_RIGHT',
    countryIconEnabled: true,
    countryIconSize: 24,
    countryIconPosition: 'BOTTOM_RIGHT',
  },
  filterDefinitions: [],
};

const PRODUCT_CARD_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'DESIGNER_NAME', label: 'Designer Name' },
  { key: 'PRODUCT_NAME', label: 'Product Name' },
  { key: 'SHORT_DESCRIPTION', label: 'Short Description' },
  { key: 'PRICE', label: 'Price' },
];

const normalizeFieldOrder = (value: unknown) => {
  const allowed = new Set(PRODUCT_CARD_FIELDS.map((entry) => entry.key));
  const source = Array.isArray(value) ? value.map((entry) => String(entry || '').trim().toUpperCase()) : [];
  const unique: string[] = [];
  source.forEach((token) => {
    if (!allowed.has(token) || unique.includes(token)) return;
    unique.push(token);
  });
  PRODUCT_CARD_FIELDS.forEach((entry) => {
    if (!unique.includes(entry.key)) unique.push(entry.key);
  });
  return unique;
};

const normalizeSettings = (input: any): CategoryPageSettingsForm => ({
  title: String(input?.title || ''),
  subtitle: String(input?.subtitle || ''),
  bannerImage: String(input?.bannerImage || ''),
  bannerHeight: Number(input?.bannerHeight || 680),
  searchPlaceholder: String(input?.searchPlaceholder || ''),
  pageSize: Number(input?.pageSize || 24),
  columns: Number(input?.columns || 4),
  showPagination: input?.showPagination !== false,
  primaryGridRows: Math.max(1, Math.min(2, Number(input?.primaryGridRows || 2))),
  primaryGridColumns: Math.max(1, Math.min(6, Number(input?.primaryGridColumns || 3))),
  primaryGridProductIds: Array.isArray(input?.primaryGridProductIds)
    ? Array.from(new Set(input.primaryGridProductIds.map((entry: any) => String(entry || '').trim()).filter(Boolean))).slice(0, 60)
    : [],
  countryRowCount: Math.max(4, Math.min(30, Number(input?.countryRowCount || 12))),
  productCard: {
    imageEnabled: input?.productCard?.imageEnabled !== false,
    fieldOrder: normalizeFieldOrder(input?.productCard?.fieldOrder),
    imageAspectRatio: String(input?.productCard?.imageAspectRatio || '3:4') === '1:1' ? '1:1' : '3:4',
    textGap: Math.max(0, Math.min(24, Number(input?.productCard?.textGap || 6))),
    contentPaddingX: Math.max(0, Math.min(40, Number(input?.productCard?.contentPaddingX || 16))),
    contentPaddingY: Math.max(0, Math.min(40, Number(input?.productCard?.contentPaddingY || 16))),
    designerNameEnabled: input?.productCard?.designerNameEnabled !== false,
    designerNameFontSize: Math.max(10, Math.min(48, Number(input?.productCard?.designerNameFontSize || 14))),
    designerNameColor: String(input?.productCard?.designerNameColor || '#6b7280'),
    productNameEnabled: input?.productCard?.productNameEnabled !== false,
    productNameFontSize: Math.max(10, Math.min(64, Number(input?.productCard?.productNameFontSize || 16))),
    productNameColor: String(input?.productCard?.productNameColor || '#111111'),
    shortDescriptionEnabled: input?.productCard?.shortDescriptionEnabled !== false,
    shortDescriptionFontSize: Math.max(10, Math.min(48, Number(input?.productCard?.shortDescriptionFontSize || 13))),
    shortDescriptionColor: String(input?.productCard?.shortDescriptionColor || '#4b5563'),
    shortDescriptionWordLimit: Math.max(4, Math.min(24, Number(input?.productCard?.shortDescriptionWordLimit || 10))),
    priceEnabled: input?.productCard?.priceEnabled !== false,
    priceFontSize: Math.max(10, Math.min(64, Number(input?.productCard?.priceFontSize || 14))),
    priceColor: String(input?.productCard?.priceColor || '#e66045'),
    labelEnabled: input?.productCard?.labelEnabled !== false,
    labelFontSize: Math.max(8, Math.min(36, Number(input?.productCard?.labelFontSize || 11))),
    labelTextColor: String(input?.productCard?.labelTextColor || '#ffffff'),
    labelBackgroundColor: String(input?.productCard?.labelBackgroundColor || 'rgba(17, 17, 17, 0.75)'),
    labelPosition: 'TOP_LEFT',
    likesEnabled: input?.productCard?.likesEnabled !== false,
    likesSize: Math.max(12, Math.min(48, Number(input?.productCard?.likesSize || 18))),
    likesColor: String(input?.productCard?.likesColor || '#ffffff'),
    likesActiveColor: String(input?.productCard?.likesActiveColor || '#ef4444'),
    likesPosition: 'TOP_RIGHT',
    countryIconEnabled: input?.productCard?.countryIconEnabled !== false,
    countryIconSize: Math.max(12, Math.min(56, Number(input?.productCard?.countryIconSize || 24))),
    countryIconPosition: 'BOTTOM_RIGHT',
  },
  filterDefinitions: Array.isArray(input?.filterDefinitions)
    ? input.filterDefinitions.map((row: any) => ({
        id: String(row?.id || ''),
        key: String(row?.key || 'STYLE') as CategoryFilterKey,
        label: String(row?.label || ''),
        inputType: String(row?.inputType || 'DROPDOWN') === 'SUGGESTIVE_SEARCH' ? 'SUGGESTIVE_SEARCH' : 'DROPDOWN',
        enabled: row?.enabled !== false,
        options: Array.isArray(row?.options) ? row.options.map((entry: any) => String(entry || '').trim()).filter(Boolean).slice(0, 100) : [],
        displayOrder: Number.isFinite(Number(row?.displayOrder)) ? Number(row.displayOrder) : 0,
      }))
    : [],
});

const parseCommaSeparatedTokens = (raw: string, fallback: string[]) => {
  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 100);
  return tokens.length > 0 ? tokens : fallback;
};

const splitCommaSeparated = (value: string) =>
  value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 100);

export default function AdminCategoryPages() {
  const [activePage, setActivePage] = useState<CategoryPageType>('READY_TO_WEAR');
  const [settings, setSettings] = useState<CategoryPageSettingsForm>(EMPTY_SETTINGS);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [optionSearch, setOptionSearch] = useState('');
  const [filterOptionsDraftById, setFilterOptionsDraftById] = useState<Record<string, string>>({});
  const [selectedPrimaryProductId, setSelectedPrimaryProductId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingOptions, setIsRefreshingOptions] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPageMeta = useMemo(
    () => PAGE_TABS.find((tab) => tab.key === activePage) || PAGE_TABS[0],
    [activePage]
  );

  const optionById = useMemo(
    () => new Map(productOptions.map((option) => [option.id, option] as const)),
    [productOptions]
  );

  const loadOptions = async (search = '') => {
    setIsRefreshingOptions(true);
    try {
      const response = await api.admin.getCategoryPageProductOptions(activePage, {
        search: search || undefined,
        limit: 200,
      });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setProductOptions(rows as ProductOption[]);
    } catch {
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
      const nextSettings = normalizeSettings(response?.data?.settings || {});
      setSettings(nextSettings);
      setFilterOptionsDraftById(
        Object.fromEntries(nextSettings.filterDefinitions.map((row) => [row.id, row.options.join(', ')]))
      );
      await loadOptions(optionSearch);
    } catch {
      setSettings(EMPTY_SETTINGS);
      setMessage('Unable to load Category Pages Manager data.');
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
      await api.admin.updateCategoryPageSettings(activePage, {
        title: settings.title.trim(),
        subtitle: settings.subtitle.trim(),
        bannerImage: settings.bannerImage.trim(),
        bannerHeight: Math.max(320, Math.min(1200, Math.round(Number(settings.bannerHeight || 680)))),
        searchPlaceholder: settings.searchPlaceholder.trim(),
        pageSize: Math.max(8, Math.min(120, Math.round(Number(settings.pageSize || 24)))),
        columns: Math.max(1, Math.min(6, Math.round(Number(settings.columns || 4)))),
        showPagination: Boolean(settings.showPagination),
        primaryGridRows: Math.max(1, Math.min(2, Math.round(Number(settings.primaryGridRows || 2)))),
        primaryGridColumns: Math.max(1, Math.min(6, Math.round(Number(settings.primaryGridColumns || 3)))),
        primaryGridProductIds: Array.from(new Set(settings.primaryGridProductIds.map((entry) => String(entry || '').trim()).filter(Boolean))).slice(0, 60),
        countryRowCount: Math.max(4, Math.min(30, Math.round(Number(settings.countryRowCount || 12)))),
        productCard: {
          imageEnabled: settings.productCard.imageEnabled !== false,
          fieldOrder: normalizeFieldOrder(settings.productCard.fieldOrder),
          imageAspectRatio: settings.productCard.imageAspectRatio === '1:1' ? '1:1' : '3:4',
          textGap: Math.max(0, Math.min(24, Math.round(Number(settings.productCard.textGap || 6)))),
          contentPaddingX: Math.max(0, Math.min(40, Math.round(Number(settings.productCard.contentPaddingX || 16)))),
          contentPaddingY: Math.max(0, Math.min(40, Math.round(Number(settings.productCard.contentPaddingY || 16)))),
          designerNameEnabled: settings.productCard.designerNameEnabled !== false,
          designerNameFontSize: Math.max(10, Math.min(48, Math.round(Number(settings.productCard.designerNameFontSize || 14)))),
          designerNameColor: String(settings.productCard.designerNameColor || '#6b7280'),
          productNameEnabled: settings.productCard.productNameEnabled !== false,
          productNameFontSize: Math.max(10, Math.min(64, Math.round(Number(settings.productCard.productNameFontSize || 16)))),
          productNameColor: String(settings.productCard.productNameColor || '#111111'),
          shortDescriptionEnabled: settings.productCard.shortDescriptionEnabled !== false,
          shortDescriptionFontSize: Math.max(10, Math.min(48, Math.round(Number(settings.productCard.shortDescriptionFontSize || 13)))),
          shortDescriptionColor: String(settings.productCard.shortDescriptionColor || '#4b5563'),
          shortDescriptionWordLimit: Math.max(4, Math.min(24, Math.round(Number(settings.productCard.shortDescriptionWordLimit || 10)))),
          priceEnabled: settings.productCard.priceEnabled !== false,
          priceFontSize: Math.max(10, Math.min(64, Math.round(Number(settings.productCard.priceFontSize || 14)))),
          priceColor: String(settings.productCard.priceColor || '#e66045'),
          labelEnabled: settings.productCard.labelEnabled !== false,
          labelFontSize: Math.max(8, Math.min(36, Math.round(Number(settings.productCard.labelFontSize || 11)))),
          labelTextColor: String(settings.productCard.labelTextColor || '#ffffff'),
          labelBackgroundColor: String(settings.productCard.labelBackgroundColor || 'rgba(17, 17, 17, 0.75)'),
          labelPosition: 'TOP_LEFT',
          likesEnabled: settings.productCard.likesEnabled !== false,
          likesSize: Math.max(12, Math.min(48, Math.round(Number(settings.productCard.likesSize || 18)))),
          likesColor: String(settings.productCard.likesColor || '#ffffff'),
          likesActiveColor: String(settings.productCard.likesActiveColor || '#ef4444'),
          likesPosition: 'TOP_RIGHT',
          countryIconEnabled: settings.productCard.countryIconEnabled !== false,
          countryIconSize: Math.max(12, Math.min(56, Math.round(Number(settings.productCard.countryIconSize || 24)))),
          countryIconPosition: 'BOTTOM_RIGHT',
        },
        filterDefinitions: settings.filterDefinitions.map((row) => ({
          id: String(row.id || '').trim(),
          key: row.key,
          label: String(row.label || '').trim(),
          inputType: row.inputType,
          enabled: Boolean(row.enabled),
          options: Array.isArray(row.options) ? row.options.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 100) : [],
          displayOrder: Math.max(0, Math.min(999, Math.round(Number(row.displayOrder || 0)))),
        })),
      });
      setMessage('Category Pages Manager saved successfully.');
      await loadData();
    } catch {
      setMessage('Failed to save Category Pages Manager.');
    } finally {
      setIsSaving(false);
    }
  };

  const addPrimaryProduct = () => {
    const productId = String(selectedPrimaryProductId || '').trim();
    if (!productId) return;
    setSettings((prev) => ({
      ...prev,
      primaryGridProductIds: Array.from(new Set([...(prev.primaryGridProductIds || []), productId])).slice(0, 60),
    }));
    setSelectedPrimaryProductId('');
  };

  const removePrimaryProduct = (productId: string) => {
    setSettings((prev) => ({
      ...prev,
      primaryGridProductIds: prev.primaryGridProductIds.filter((entry) => entry !== productId),
    }));
  };

  const commitFilterOptionsDraft = (filterIndex: number, filterId: string, draft: string) => {
    const parsed = splitCommaOptions(draft);
    setSettings((prev) => ({
      ...prev,
      filterDefinitions: prev.filterDefinitions.map((entry, entryIndex) =>
        entryIndex === filterIndex ? { ...entry, options: parsed } : entry
      ),
    }));
    setFilterOptionsDraftById((prev) => ({ ...prev, [filterId]: parsed.join(', ') }));
  };

  const handleBannerImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingBanner(true);
      setMessage(null);
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.upload.image(formData);
      if (response?.success && response?.data?.url) {
        setSettings((prev) => ({ ...prev, bannerImage: resolveAssetUrl(String(response.data.url)) }));
      } else {
        setMessage('Failed to upload banner image.');
      }
    } catch {
      setMessage('Failed to upload banner image.');
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
          New manager for RTW, FTB, CTW, Country and Shop pages. All category variables and filters are controlled here.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActivePage(tab.key)}
            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
              activePage === tab.key ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
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
                <span className="text-gray-700">Page title</span>
                <input
                  type="text"
                  value={settings.title}
                  onChange={(event) => setSettings((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Banner image</span>
                <input type="file" accept="image/*" className="hidden" id="category-pages-v2-banner-upload" onChange={handleBannerImageUpload} />
                <div className="flex gap-2">
                  <label
                    htmlFor="category-pages-v2-banner-upload"
                    className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {isUploadingBanner ? 'Uploading...' : 'Upload image'}
                  </label>
                  <input
                    type="text"
                    value={settings.bannerImage}
                    onChange={(event) => setSettings((prev) => ({ ...prev, bannerImage: event.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="/rw_hero.jpg or full URL"
                  />
                </div>
              </label>
              <label className="text-sm space-y-1 lg:col-span-2">
                <span className="text-gray-700">Page subtitle</span>
                <textarea
                  value={settings.subtitle}
                  onChange={(event) => setSettings((prev) => ({ ...prev, subtitle: event.target.value }))}
                  className="w-full rounded-md border px-3 py-2 min-h-[90px]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Banner height (px)</span>
                <input
                  type="number"
                  min={320}
                  max={1200}
                  value={settings.bannerHeight}
                  onChange={(event) => setSettings((prev) => ({ ...prev, bannerHeight: Number(event.target.value || 680) }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Search placeholder</span>
                <input
                  type="text"
                  value={settings.searchPlaceholder}
                  onChange={(event) => setSettings((prev) => ({ ...prev, searchPlaceholder: event.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Products per page</span>
                <input
                  type="number"
                  min={8}
                  max={120}
                  value={settings.pageSize}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pageSize: Number(event.target.value || 24) }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Grid columns</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={settings.columns}
                  onChange={(event) => setSettings((prev) => ({ ...prev, columns: Number(event.target.value || 4) }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-gray-700">Country icon row count</span>
                <input
                  type="number"
                  min={4}
                  max={30}
                  value={settings.countryRowCount}
                  onChange={(event) => setSettings((prev) => ({ ...prev, countryRowCount: Number(event.target.value || 12) }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm space-y-1 flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={settings.showPagination}
                  onChange={(event) => setSettings((prev) => ({ ...prev, showPagination: event.target.checked }))}
                />
                <span className="text-gray-700">Show pagination</span>
              </label>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Product Card (RTW, FTB, CTW)</h3>
              <p className="text-xs text-gray-600">
                Control field visibility, colors, text sizes, icon style, and the order of card fields.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="text-xs">
                  Image Aspect Ratio
                  <select
                    className="mt-1 w-full rounded border px-2 py-1"
                    value={settings.productCard.imageAspectRatio}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        productCard: {
                          ...prev.productCard,
                          imageAspectRatio: event.target.value === '1:1' ? '1:1' : '3:4',
                        },
                      }))
                    }
                  >
                    <option value="3:4">3:4</option>
                    <option value="1:1">1:1</option>
                  </select>
                </label>
                <label className="text-xs">
                  Text Gap (px)
                  <input
                    type="number"
                    min={0}
                    max={24}
                    className="mt-1 w-full rounded border px-2 py-1"
                    value={settings.productCard.textGap}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        productCard: {
                          ...prev.productCard,
                          textGap: Math.max(0, Math.min(24, Number(event.target.value || 6))),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Content Padding X (px)
                  <input
                    type="number"
                    min={0}
                    max={40}
                    className="mt-1 w-full rounded border px-2 py-1"
                    value={settings.productCard.contentPaddingX}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        productCard: {
                          ...prev.productCard,
                          contentPaddingX: Math.max(0, Math.min(40, Number(event.target.value || 16))),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Content Padding Y (px)
                  <input
                    type="number"
                    min={0}
                    max={40}
                    className="mt-1 w-full rounded border px-2 py-1"
                    value={settings.productCard.contentPaddingY}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        productCard: {
                          ...prev.productCard,
                          contentPaddingY: Math.max(0, Math.min(40, Number(event.target.value || 16))),
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {PRODUCT_CARD_FIELDS.map((field) => {
                  const token = field.key;
                  const enabledKey =
                    token === 'DESIGNER_NAME'
                      ? 'designerNameEnabled'
                      : token === 'PRODUCT_NAME'
                        ? 'productNameEnabled'
                        : token === 'SHORT_DESCRIPTION'
                          ? 'shortDescriptionEnabled'
                          : 'priceEnabled';
                  const fontSizeKey =
                    token === 'DESIGNER_NAME'
                      ? 'designerNameFontSize'
                      : token === 'PRODUCT_NAME'
                        ? 'productNameFontSize'
                        : token === 'SHORT_DESCRIPTION'
                          ? 'shortDescriptionFontSize'
                          : 'priceFontSize';
                  const colorKey =
                    token === 'DESIGNER_NAME'
                      ? 'designerNameColor'
                      : token === 'PRODUCT_NAME'
                        ? 'productNameColor'
                        : token === 'SHORT_DESCRIPTION'
                          ? 'shortDescriptionColor'
                          : 'priceColor';
                  const rank = settings.productCard.fieldOrder.indexOf(token);
                  return (
                    <div key={field.key} className="rounded border p-3">
                      <p className="text-xs font-semibold text-gray-700">{field.label}</p>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        <label className="inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={Boolean((settings.productCard as any)[enabledKey])}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                productCard: { ...prev.productCard, [enabledKey]: event.target.checked },
                              }))
                            }
                          />
                          Enabled
                        </label>
                        <label className="text-xs">
                          Font Size
                          <input
                            type="number"
                            min={10}
                            max={64}
                            className="mt-1 w-full rounded border px-2 py-1"
                            value={Number((settings.productCard as any)[fontSizeKey] || 14)}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                productCard: {
                                  ...prev.productCard,
                                  [fontSizeKey]: Math.max(10, Math.min(64, Number(event.target.value || 14))),
                                },
                              }))
                            }
                          />
                        </label>
                        <label className="text-xs">
                          Color
                          <input
                            type="text"
                            className="mt-1 w-full rounded border px-2 py-1"
                            value={String((settings.productCard as any)[colorKey] || '')}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                productCard: { ...prev.productCard, [colorKey]: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="text-xs">
                          Order
                          <input
                            type="number"
                            min={1}
                            max={PRODUCT_CARD_FIELDS.length}
                            className="mt-1 w-full rounded border px-2 py-1"
                            value={rank + 1}
                            onChange={(event) => {
                              const desired = Math.max(1, Math.min(PRODUCT_CARD_FIELDS.length, Number(event.target.value || rank + 1))) - 1;
                              setSettings((prev) => {
                                const nextOrder = normalizeFieldOrder(prev.productCard.fieldOrder);
                                const currentIndex = nextOrder.indexOf(token);
                                const base = nextOrder.filter((entry) => entry !== token);
                                base.splice(desired, 0, token);
                                return {
                                  ...prev,
                                  productCard: {
                                    ...prev.productCard,
                                    fieldOrder: normalizeFieldOrder(base),
                                  },
                                };
                              });
                            }}
                          />
                        </label>
                        {token === 'SHORT_DESCRIPTION' ? (
                          <label className="text-xs">
                            Word Limit
                            <input
                              type="number"
                              min={4}
                              max={24}
                              className="mt-1 w-full rounded border px-2 py-1"
                              value={settings.productCard.shortDescriptionWordLimit}
                              onChange={(event) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  productCard: {
                                    ...prev.productCard,
                                    shortDescriptionWordLimit: Math.max(4, Math.min(24, Number(event.target.value || 10))),
                                  },
                                }))
                              }
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded border p-3">
                  <p className="text-xs font-semibold text-gray-700">Product Label (Top-left)</p>
                  <label className="mt-2 inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settings.productCard.labelEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, labelEnabled: event.target.checked },
                        }))
                      }
                    />
                    Enabled
                  </label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <input
                      type="number"
                      min={8}
                      max={36}
                      className="rounded border px-2 py-1 text-xs"
                      value={settings.productCard.labelFontSize}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, labelFontSize: Math.max(8, Math.min(36, Number(event.target.value || 11))) },
                        }))
                      }
                    />
                    <input
                      type="text"
                      className="rounded border px-2 py-1 text-xs"
                      value={settings.productCard.labelTextColor}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, labelTextColor: event.target.value },
                        }))
                      }
                      placeholder="Text color"
                    />
                    <input
                      type="text"
                      className="rounded border px-2 py-1 text-xs"
                      value={settings.productCard.labelBackgroundColor}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, labelBackgroundColor: event.target.value },
                        }))
                      }
                      placeholder="Background color"
                    />
                  </div>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs font-semibold text-gray-700">Likes Icon (Top-right)</p>
                  <label className="mt-2 inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settings.productCard.likesEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, likesEnabled: event.target.checked },
                        }))
                      }
                    />
                    Enabled
                  </label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <input
                      type="number"
                      min={12}
                      max={48}
                      className="rounded border px-2 py-1 text-xs"
                      value={settings.productCard.likesSize}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, likesSize: Math.max(12, Math.min(48, Number(event.target.value || 18))) },
                        }))
                      }
                    />
                    <input
                      type="text"
                      className="rounded border px-2 py-1 text-xs"
                      value={settings.productCard.likesColor}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, likesColor: event.target.value },
                        }))
                      }
                      placeholder="Default color"
                    />
                    <input
                      type="text"
                      className="rounded border px-2 py-1 text-xs"
                      value={settings.productCard.likesActiveColor}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, likesActiveColor: event.target.value },
                        }))
                      }
                      placeholder="Active color"
                    />
                  </div>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs font-semibold text-gray-700">Country Icon (Bottom-right)</p>
                  <label className="mt-2 inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settings.productCard.countryIconEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, countryIconEnabled: event.target.checked },
                        }))
                      }
                    />
                    Enabled
                  </label>
                  <div className="mt-2">
                    <input
                      type="number"
                      min={12}
                      max={56}
                      className="w-full rounded border px-2 py-1 text-xs"
                      value={settings.productCard.countryIconSize}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          productCard: { ...prev.productCard, countryIconSize: Math.max(12, Math.min(56, Number(event.target.value || 24))) },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Primary Product Grid (first 2 rows/columns)</h3>
              <p className="text-xs text-gray-600">
                Configure the first two rows/columns and assign products by dropdown search.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm space-y-1">
                  <span className="text-gray-700">Rows (max 2)</span>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={settings.primaryGridRows}
                    onChange={(event) => setSettings((prev) => ({ ...prev, primaryGridRows: Math.max(1, Math.min(2, Number(event.target.value || 2))) }))}
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
                    onChange={(event) => setSettings((prev) => ({ ...prev, primaryGridColumns: Math.max(1, Math.min(6, Number(event.target.value || 3))) }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Slots configured: {Math.max(1, settings.primaryGridRows) * Math.max(1, settings.primaryGridColumns)}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={optionSearch}
                  onChange={(event) => setOptionSearch(event.target.value)}
                  placeholder="Search products..."
                  className="rounded-md border px-3 py-2 text-sm min-w-[220px]"
                />
                <Button size="sm" variant="outline" onClick={() => void loadOptions(optionSearch)} disabled={isRefreshingOptions}>
                  {isRefreshingOptions ? 'Loading...' : 'Refresh list'}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedPrimaryProductId}
                  onChange={(event) => setSelectedPrimaryProductId(event.target.value)}
                  className="min-w-[300px] flex-1 rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select product for primary grid</option>
                  {productOptions.map((option) => (
                    <option key={`primary-option-${option.id}`} value={option.id}>
                      [{option.sourceType}] {option.name} · {option.ownerName} · ${Number(option.priceUsd || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" onClick={addPrimaryProduct}>
                  Add product
                </Button>
              </div>
              {settings.primaryGridProductIds.length > 0 ? (
                <div className="space-y-2">
                  {settings.primaryGridProductIds.map((productId) => {
                    const option = optionById.get(productId);
                    return (
                      <div key={`primary-grid-${productId}`} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                        <span className="truncate">
                          {option ? `[${option.sourceType}] ${option.name} · ${option.ownerName}` : productId}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePrimaryProduct(productId)}
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
              <h3 className="text-sm font-semibold text-gray-800">Category Filters (same lane as search bar)</h3>
              <p className="text-xs text-gray-600">Configure enabled filters, suggestive-search/dropdown input type, order, and options.</p>
              <div className="space-y-2">
                {settings.filterDefinitions
                  .slice()
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((filter, index) => (
                    <div key={filter.id || `${filter.key}-${index}`} className="rounded border p-3">
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
                                  entryIndex === index ? { ...entry, key: event.target.value as CategoryFilterKey } : entry
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
                          Label
                          <input
                            className="mt-1 w-full rounded border px-2 py-1"
                            value={filter.label}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                filterDefinitions: prev.filterDefinitions.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, label: event.target.value } : entry
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
                                  entryIndex === index
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
                          Order
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
                                  entryIndex === index ? { ...entry, displayOrder: Math.max(0, Math.min(999, Number(event.target.value || 0))) } : entry
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
                                  entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                                ),
                              }))
                            }
                          />
                          Enabled
                        </label>
                        <label className="md:col-span-2 text-xs">
                          Options
                          <input
                            className="mt-1 w-full rounded border px-2 py-1"
                            value={filterOptionsDraftById[filter.id] ?? filter.options.join(', ')}
                            onChange={(event) =>
                              setFilterOptionsDraftById((prev) => ({ ...prev, [filter.id]: event.target.value }))
                            }
                            onBlur={(event) => commitFilterOptionsDraft(index, filter.id, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                const next = (event.currentTarget as HTMLInputElement).value;
                                commitFilterOptionsDraft(index, filter.id, next);
                              }
                            }}
                            placeholder="comma, separated, values"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {settings.bannerImage ? (
              <div className="rounded-lg border overflow-hidden">
                <img
                  src={resolveAssetUrl(settings.bannerImage)}
                  alt={`${selectedPageMeta.label} banner preview`}
                  className="w-full object-cover"
                  style={{ height: `${Math.max(320, Math.min(1200, Number(settings.bannerHeight || 680)))}px` }}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className={`text-sm ${message?.toLowerCase().includes('failed') ? 'text-red-600' : 'text-gray-600'}`}>{message || ' '}</p>
              <Button onClick={() => void saveSettings()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Category Pages Manager'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
