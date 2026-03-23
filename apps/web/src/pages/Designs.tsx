import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { api } from '../services/api';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';
import { CategoryPageDesignPreset, resolveRotatingTitlePresentation } from '../design/categoryPagePreset';

interface Design {
  id: string;
  name: string;
  basePrice: number;
  finalPrice: number;
  images: { url: string }[];
  designer: {
    id: string;
    businessName: string;
    country: string;
  };
  category: {
    id: string;
    name: string;
  };
  productLabels?: Array<{
    id: string;
    name: string;
    textColor: string;
    backgroundColor: string;
    sizePercent?: number;
    fontSizePx?: number;
    isBold?: boolean;
  }>;
}

interface Category {
  id: string;
  name: string;
}

interface Material {
  id: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

type CategoryPageSettings = {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  designPreset: CategoryPageDesignPreset;
  bannerHeight: number;
  pageSize: number;
  columns: number;
  showPagination: boolean;
  featuredProductIds: string[];
  rotatingProductIds: string[];
  rotatingColumns: number;
  rotatingRows: number;
  rotatingTitleSize: number;
};

type FeaturedProduct = {
  id: string;
  name: string;
  description?: string;
  image: string;
  priceUsd: number;
  country: string;
  ownerName: string;
  href: string;
};

const DEFAULT_SETTINGS: CategoryPageSettings = {
  bannerTitle: 'Custom To Wear',
  bannerSubtitle: 'Discover custom designs from top fashion designers.',
  bannerImage: '/images/hero-designs.jpg',
  designPreset: 'STANDARD',
  bannerHeight: 320,
  pageSize: 24,
  columns: 4,
  showPagination: true,
  featuredProductIds: [],
  rotatingProductIds: [],
  rotatingColumns: 2,
  rotatingRows: 1,
  rotatingTitleSize: 32,
};

const COMMON_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const COMMON_COLOR_OPTIONS = [
  'Black',
  'White',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Pink',
  'Purple',
  'Orange',
  'Brown',
  'Gold',
  'Silver',
];

const lgGridByColumns: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

const mdGridByColumns: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-3',
  5: 'md:grid-cols-3',
  6: 'md:grid-cols-3',
};

const dynamicMdGridByColumns: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
};

const dynamicLgGridByColumns: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

function pickRandomProducts(rows: FeaturedProduct[], count: number) {
  const copy = [...rows];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy.slice(0, Math.max(0, count));
}

function buildFiltersFromParams(searchParams: URLSearchParams) {
  return {
    search: searchParams.get('search') || '',
    categoryId: searchParams.get('category') || '',
    country: searchParams.get('country') || '',
    size: searchParams.get('size') || '',
    color: searchParams.get('color') || '',
    materialTypeId: searchParams.get('material') || '',
    designerId: searchParams.get('designerId') || '',
    page: parseInt(searchParams.get('page') || '1', 10),
  };
}

export default function Designs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [rotatingProducts, setRotatingProducts] = useState<FeaturedProduct[]>([]);
  const [settings, setSettings] = useState<CategoryPageSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { formatFromUsd } = useCurrencyStore();

  const [filters, setFilters] = useState(() => buildFiltersFromParams(searchParams));
  const [appliedFilters, setAppliedFilters] = useState(() => buildFiltersFromParams(searchParams));

  const countryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...allCountries,
            ...designs
              .map((design) => String(design.designer?.country || '').trim())
              .filter(Boolean),
          ].filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [allCountries, designs]
  );

  const productGridClass = useMemo(() => {
    const columns = Math.max(2, Math.min(6, Math.round(Number(settings.columns || 4))));
    return `grid grid-cols-2 ${mdGridByColumns[columns]} ${lgGridByColumns[columns]} gap-4 md:gap-6`;
  }, [settings.columns]);
  const featuredGridClass = useMemo(() => {
    const count = Math.max(1, Math.min(3, featuredProducts.length));
    if (count === 1) return 'grid grid-cols-1 gap-6';
    if (count === 2) return 'grid grid-cols-1 md:grid-cols-2 gap-6';
    return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
  }, [featuredProducts.length]);
  const rotatingGridClass = useMemo(() => {
    const columns = Math.max(1, Math.min(6, Math.round(Number(settings.rotatingColumns || DEFAULT_SETTINGS.rotatingColumns))));
    return `grid grid-cols-1 ${dynamicMdGridByColumns[columns]} ${dynamicLgGridByColumns[columns]} gap-6`;
  }, [settings.rotatingColumns]);

  const selectedCategoryLabel = useMemo(() => {
    if (!appliedFilters.categoryId) return 'All';
    const matched = categories.find((row) => row.id === appliedFilters.categoryId);
    return matched?.name || appliedFilters.categoryId;
  }, [appliedFilters.categoryId, categories]);

  useEffect(() => {
    const loadPageSettings = async () => {
      try {
        const response = await api.products.getCategoryPageSettings('CUSTOM_TO_WEAR');
        if (!response.success || !response.data?.settings) return;
        setSettings({
          bannerTitle: String(response.data.settings.bannerTitle || DEFAULT_SETTINGS.bannerTitle),
          bannerSubtitle: String(response.data.settings.bannerSubtitle || DEFAULT_SETTINGS.bannerSubtitle),
          bannerImage: String(response.data.settings.bannerImage || DEFAULT_SETTINGS.bannerImage),
          designPreset:
            String(response.data.settings.designPreset || '').trim().toUpperCase() === 'EDITORIAL'
              ? 'EDITORIAL'
              : String(response.data.settings.designPreset || '').trim().toUpperCase() === 'MINIMAL'
                ? 'MINIMAL'
                : 'STANDARD',
          bannerHeight: Number(response.data.settings.bannerHeight || DEFAULT_SETTINGS.bannerHeight),
          pageSize: Number(response.data.settings.pageSize || DEFAULT_SETTINGS.pageSize),
          columns: Number(response.data.settings.columns || DEFAULT_SETTINGS.columns),
          showPagination: Boolean(response.data.settings.showPagination),
          featuredProductIds: Array.isArray(response.data.settings.featuredProductIds) ? response.data.settings.featuredProductIds : [],
          rotatingProductIds: Array.isArray(response.data.settings.rotatingProductIds) ? response.data.settings.rotatingProductIds : [],
          rotatingColumns: Number(response.data.settings.rotatingColumns || DEFAULT_SETTINGS.rotatingColumns),
          rotatingRows: Number(response.data.settings.rotatingRows || DEFAULT_SETTINGS.rotatingRows),
          rotatingTitleSize: Number(response.data.settings.rotatingTitleSize || DEFAULT_SETTINGS.rotatingTitleSize),
        });
        const nextFeatured = Array.isArray(response.data.featuredProducts) ? response.data.featuredProducts : [];
        const nextRotatingPool = Array.isArray(response.data.rotatingProducts) ? response.data.rotatingProducts : [];
        setFeaturedProducts(nextFeatured);
        const rotatingCount =
          Math.max(1, Math.min(6, Math.round(Number(response.data.settings.rotatingColumns || DEFAULT_SETTINGS.rotatingColumns)))) *
          Math.max(1, Math.min(6, Math.round(Number(response.data.settings.rotatingRows || DEFAULT_SETTINGS.rotatingRows))));
        setRotatingProducts(pickRandomProducts(nextRotatingPool, rotatingCount));
      } catch (settingsError) {
        console.error('Failed to load custom-to-wear page settings:', settingsError);
      }
    };
    void loadPageSettings();
  }, []);

  useEffect(() => {
    const next = buildFiltersFromParams(searchParams);
    setFilters(next);
    setAppliedFilters(next);
  }, [searchParams]);

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const [categoryResponse, materialResponse, countryResponse] = await Promise.all([
          api.products.getCategories(),
          api.products.getMaterials(),
          api.products.getCountries(),
        ]);
        if (categoryResponse.success && Array.isArray(categoryResponse.data)) {
          setCategories(categoryResponse.data);
        }
        if (materialResponse.success && Array.isArray(materialResponse.data)) {
          setMaterials(materialResponse.data);
        }
        if (countryResponse.success && Array.isArray(countryResponse.data)) {
          setAllCountries(
            Array.from(
              new Set(
                countryResponse.data
                  .map((entry: any) => String(entry || '').trim())
                  .filter(Boolean)
              )
            ).sort((a, b) => a.localeCompare(b))
          );
        }
      } catch (categoriesError) {
        console.error('Failed to load categories:', categoriesError);
      }
    };
    void loadTaxonomy();
  }, []);

  useEffect(() => {
    const loadDesigns = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.products.getDesigns({
          search: appliedFilters.search || undefined,
          categoryId: appliedFilters.categoryId || undefined,
          country: appliedFilters.country || undefined,
          size: appliedFilters.size || undefined,
          color: appliedFilters.color || undefined,
          materialTypeId: appliedFilters.materialTypeId || undefined,
          designerId: appliedFilters.designerId || undefined,
          page: appliedFilters.page,
          limit: settings.pageSize,
        });
        if (!response.success) {
          setDesigns([]);
          setPagination(null);
          setError('Unable to load custom designs.');
          return;
        }
        setDesigns(Array.isArray(response.data?.designs) ? response.data.designs : []);
        setPagination(response.data?.pagination || null);
      } catch (loadError) {
        console.error('Failed to load designs:', loadError);
        setDesigns([]);
        setPagination(null);
        setError('Unable to load custom designs.');
      } finally {
        setIsLoading(false);
      }
    };
    void loadDesigns();
  }, [appliedFilters, settings.pageSize]);

  const updateURLParams = (newFilters: typeof filters) => {
    const params = new URLSearchParams();
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.categoryId) params.set('category', newFilters.categoryId);
    if (newFilters.country) params.set('country', newFilters.country);
    if (newFilters.size) params.set('size', newFilters.size);
    if (newFilters.color) params.set('color', newFilters.color);
    if (newFilters.materialTypeId) params.set('material', newFilters.materialTypeId);
    if (newFilters.designerId) params.set('designerId', newFilters.designerId);
    if (newFilters.page > 1) params.set('page', newFilters.page.toString());
    setSearchParams(params);
  };

  const updateFilter = (key: keyof typeof filters, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? Number(value) : 1 }));
  };

  const applyFilters = (next: typeof filters) => {
    setAppliedFilters(next);
    setFilters(next);
    updateURLParams(next);
  };

  const handleSearch = () => {
    applyFilters({ ...filters, page: 1 });
  };

  const handlePageChange = (page: number) => {
    const next = { ...appliedFilters, page };
    setAppliedFilters(next);
    setFilters(next);
    updateURLParams(next);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <section
        className="relative overflow-hidden"
        style={{ height: `${Math.max(220, Math.min(560, Number(settings.bannerHeight || DEFAULT_SETTINGS.bannerHeight)))}px` }}
      >
        <img src={settings.bannerImage || DEFAULT_SETTINGS.bannerImage} alt={settings.bannerTitle} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 flex items-center">
          <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-white">
            <h1 className="text-3xl md:text-4xl font-bold">{settings.bannerTitle || DEFAULT_SETTINGS.bannerTitle}</h1>
            <p className="mt-2 max-w-2xl text-sm md:text-base text-white/90">{settings.bannerSubtitle || DEFAULT_SETTINGS.bannerSubtitle}</p>
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Home &gt; Shop &gt; Custom To Wear <span className="mx-2">|</span>{' '}
            <span className="font-semibold text-gray-900">{pagination?.total ?? designs.length}</span> products
          </p>
          <p className="text-sm text-gray-600">Style: {selectedCategoryLabel}</p>
        </div>

        <div className="bg-white border border-gray-200 p-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Search custom designs..."
              className="w-full pl-9 pr-3 py-2 border rounded-md"
            />
          </div>
          <select
            value={filters.country}
            onChange={(event) => updateFilter('country', event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Country (All)</option>
            {countryOptions.map((country) => (
              <option key={`design-country-${country}`} value={country}>
                {country}
              </option>
            ))}
          </select>
          <select
            value={filters.categoryId}
            onChange={(event) => updateFilter('categoryId', event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Style (All)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={filters.size}
            onChange={(event) => updateFilter('size', event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Size (All)</option>
            {COMMON_SIZE_OPTIONS.map((size) => (
              <option key={`design-size-${size}`} value={size}>
                {size}
              </option>
            ))}
          </select>
          <select
            value={filters.color}
            onChange={(event) => updateFilter('color', event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Color (All)</option>
            {COMMON_COLOR_OPTIONS.map((color) => (
              <option key={`design-color-${color}`} value={color}>
                {color}
              </option>
            ))}
          </select>
          <select
            value={filters.materialTypeId}
            onChange={(event) => updateFilter('materialTypeId', event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Material (All)</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSearch}
            className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            Search
          </button>
          {(filters.search || filters.categoryId || filters.country || filters.size || filters.color || filters.materialTypeId) ? (
            <button
              type="button"
              onClick={() => {
                const next = {
                  search: '',
                  categoryId: '',
                  country: '',
                  size: '',
                  color: '',
                  materialTypeId: '',
                  designerId: '',
                  page: 1,
                };
                applyFilters(next);
              }}
              className="border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Clear
            </button>
          ) : null}
        </div>

        {rotatingProducts.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Custom To Wear Picks For You</h2>
              <span className="text-xs text-gray-500">
                {settings.rotatingColumns} column{settings.rotatingColumns > 1 ? 's' : ''} × {settings.rotatingRows} row
                {settings.rotatingRows > 1 ? 's' : ''} (randomized on refresh)
              </span>
            </div>
            <div className={rotatingGridClass}>
              {rotatingProducts.map((product) => {
                const rotatingTitlePresentation = resolveRotatingTitlePresentation(
                  settings.designPreset,
                  Number(settings.rotatingTitleSize || DEFAULT_SETTINGS.rotatingTitleSize)
                );
                const flagCode = resolveCountryCode(product.country || '');
                return (
                  <Link key={`rotating-${product.id}`} to={product.href} className="group overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                      <img
                        src={product.image || '/placeholder.jpg'}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {flagCode ? (
                        <img
                          src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                          alt={`${product.country || 'Country'} flag`}
                          className="absolute left-3 top-3 h-6 w-9 rounded-sm object-cover shadow"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                        <div className="max-w-[95%] text-left text-white">
                          <h2
                            className={rotatingTitlePresentation.titleClassName}
                            style={{ fontSize: `${rotatingTitlePresentation.fontSize}px` }}
                          >
                            {product.name}
                          </h2>
                          {product.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-white/90 md:text-sm">{product.description}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                            <div>
                              <p className="text-xs text-white/90">{product.ownerName}</p>
                              <p className={rotatingTitlePresentation.priceClassName}>
                                {formatFromUsd(Number(product.priceUsd || 0))}
                              </p>
                            </div>
                            <span className={rotatingTitlePresentation.ctaClassName}>VIEW PRODUCT</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {featuredProducts.length > 0 ? (
          <div className={featuredGridClass}>
            {featuredProducts.slice(0, 3).map((product) => {
              const flagCode = resolveCountryCode(product.country || '');
              return (
                <Link key={product.id} to={product.href} className="group bg-white border border-gray-200 overflow-hidden rounded-xl">
                  <div className="relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                    <img
                      src={product.image || '/placeholder.jpg'}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {flagCode ? (
                      <img
                        src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                        alt={`${product.country || 'Country'} flag`}
                        className="absolute left-3 top-3 h-6 w-9 rounded-sm object-cover shadow"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <h2 className="text-2xl font-semibold text-gray-900">{product.name}</h2>
                    <p className="text-gray-500 text-sm">{product.ownerName}</p>
                    <p className="mt-2 text-xl font-semibold text-gray-900">{formatFromUsd(Number(product.priceUsd || 0))}</p>
                    <span className="inline-flex mt-3 bg-black text-white text-xs px-3 py-2">VIEW PRODUCT</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-coral-500" />
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white border rounded-xl">
            <p className="text-red-600">{error}</p>
          </div>
        ) : designs.length === 0 ? (
          <div className="text-center py-16 bg-white border rounded-xl">
            <p className="text-gray-600">No designs found for this filter.</p>
          </div>
        ) : (
          <>
            <div className={productGridClass}>
              {designs.map((design) => {
                const flagCode = resolveCountryCode(design.designer?.country || '');
                return (
                  <Link key={design.id} to={`/custom/${design.id}`} className="group bg-white border border-gray-200 overflow-hidden rounded-xl">
                    <div className="relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                      <img
                        src={design.images?.[0]?.url || '/placeholder.jpg'}
                        alt={design.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {(design.productLabels || []).length > 0 ? (
                        <div className="absolute right-2 top-2 z-10 flex flex-wrap justify-end gap-1">
                          {(design.productLabels || []).slice(0, 2).map((label) => (
                            <span
                              key={`${design.id}-label-${label.id}`}
                              className="inline-flex items-center"
                              style={{
                                backgroundColor: label.backgroundColor || '#111827',
                                color: label.textColor || '#ffffff',
                                fontSize: `${Math.max(8, Math.min(36, Number(label.fontSizePx || 12)))}px`,
                                fontWeight: label.isBold === false ? 500 : 700,
                                padding: `${0.125 * (Math.max(60, Math.min(300, Number(label.sizePercent || 120))) / 100)}rem ${
                                  0.375 * (Math.max(60, Math.min(300, Number(label.sizePercent || 120))) / 100)
                                }rem`,
                              }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {flagCode ? (
                        <img
                          src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                          alt={`${design.designer?.country || 'Country'} flag`}
                          className="absolute left-2 top-2 h-5 w-8 rounded-sm object-cover shadow"
                        />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 leading-tight">{design.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{design.designer?.businessName}</p>
                      <p className="text-base font-semibold mt-2">{formatFromUsd(Number(design.finalPrice || design.basePrice || 0))}</p>
                      <span className="inline-flex mt-2 bg-black text-white text-[11px] px-3 py-1.5">VIEW DETAILS</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {settings.showPagination && pagination && pagination.pages > 1 ? (
              <div className="flex justify-center items-center mt-6 gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, appliedFilters.page - 1))}
                  disabled={appliedFilters.page <= 1}
                  className="p-2 border bg-white disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(7, pagination.pages) }, (_, index) => {
                  let pageNumber = index + 1;
                  if (pagination.pages > 7) {
                    if (appliedFilters.page <= 4) pageNumber = index + 1;
                    else if (appliedFilters.page >= pagination.pages - 3) pageNumber = pagination.pages - 6 + index;
                    else pageNumber = appliedFilters.page - 3 + index;
                  }
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => handlePageChange(pageNumber)}
                      className={`h-9 min-w-9 px-2 border text-sm ${
                        appliedFilters.page === pageNumber ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.min(pagination.pages, appliedFilters.page + 1))}
                  disabled={appliedFilters.page >= pagination.pages}
                  className="p-2 border bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
