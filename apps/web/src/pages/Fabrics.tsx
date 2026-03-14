import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { api } from '../services/api';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';

interface Fabric {
  id: string;
  name: string;
  pricePerMeter: number;
  images: { url: string }[];
  seller: {
    id: string;
    businessName: string;
    country: string;
  };
  materialType: {
    id: string;
    name: string;
  };
  materialTypeId?: string;
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
  bannerHeight: number;
  pageSize: number;
  columns: number;
  showPagination: boolean;
  featuredProductIds: string[];
  rotatingProductIds: string[];
};

type FeaturedProduct = {
  id: string;
  name: string;
  image: string;
  priceUsd: number;
  country: string;
  ownerName: string;
  href: string;
};

const DEFAULT_SETTINGS: CategoryPageSettings = {
  bannerTitle: 'Fabrics To Buy',
  bannerSubtitle: 'Choose quality fabrics by material and country.',
  bannerImage: '/images/hero-fabrics.jpg',
  bannerHeight: 320,
  pageSize: 24,
  columns: 4,
  showPagination: true,
  featuredProductIds: [],
  rotatingProductIds: [],
};

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

function resolveMaterialId(queryValue: string, materials: Material[]) {
  const normalized = queryValue.trim().toLowerCase();
  if (!normalized) return undefined;
  const matched = materials.find((entry) => entry.id.toLowerCase() === normalized || entry.name.toLowerCase() === normalized);
  return matched?.id;
}

function buildFiltersFromParams(searchParams: URLSearchParams) {
  return {
    search: searchParams.get('search') || '',
    material: searchParams.get('material') || '',
    country: searchParams.get('country') || '',
    color: searchParams.get('color') || '',
    page: Number.parseInt(searchParams.get('page') || '1', 10) || 1,
  };
}

export default function Fabrics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CategoryPageSettings>(DEFAULT_SETTINGS);
  const { formatFromUsd } = useCurrencyStore();
  const [filters, setFilters] = useState(() => buildFiltersFromParams(searchParams));
  const [appliedFilters, setAppliedFilters] = useState(() => buildFiltersFromParams(searchParams));

  const selectedMaterialId = useMemo(
    () => resolveMaterialId(appliedFilters.material, materials),
    [appliedFilters.material, materials]
  );

  const countryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          fabrics
            .map((fabric) => String(fabric.seller?.country || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [fabrics]
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

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.products.getCategoryPageSettings('FABRIC_TO_BUY');
        if (!response.success || !response.data?.settings) return;
        setSettings({
          bannerTitle: String(response.data.settings.bannerTitle || DEFAULT_SETTINGS.bannerTitle),
          bannerSubtitle: String(response.data.settings.bannerSubtitle || DEFAULT_SETTINGS.bannerSubtitle),
          bannerImage: String(response.data.settings.bannerImage || DEFAULT_SETTINGS.bannerImage),
          bannerHeight: Number(response.data.settings.bannerHeight || DEFAULT_SETTINGS.bannerHeight),
          pageSize: Number(response.data.settings.pageSize || DEFAULT_SETTINGS.pageSize),
          columns: Number(response.data.settings.columns || DEFAULT_SETTINGS.columns),
          showPagination: Boolean(response.data.settings.showPagination),
          featuredProductIds: Array.isArray(response.data.settings.featuredProductIds) ? response.data.settings.featuredProductIds : [],
          rotatingProductIds: Array.isArray(response.data.settings.rotatingProductIds) ? response.data.settings.rotatingProductIds : [],
        });
        setFeaturedProducts(Array.isArray(response.data.featuredProducts) ? response.data.featuredProducts : []);
      } catch (settingsError) {
        console.error('Failed to load fabrics page settings:', settingsError);
      }
    };
    void loadSettings();
  }, []);

  useEffect(() => {
    const next = buildFiltersFromParams(searchParams);
    setFilters(next);
    setAppliedFilters(next);
  }, [searchParams]);

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const response = await api.products.getMaterials();
        if (!response.success || !Array.isArray(response.data)) return;
        setMaterials(response.data.map((item: any) => ({ id: String(item.id), name: String(item.name || 'Material') })));
      } catch {
        setMaterials([]);
      }
    };
    void loadMaterials();
  }, []);

  useEffect(() => {
    const loadFabrics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.products.getFabrics({
          search: appliedFilters.search || undefined,
          materialTypeId: selectedMaterialId,
          country: appliedFilters.country || undefined,
          color: appliedFilters.color || undefined,
          page: appliedFilters.page,
          limit: settings.pageSize,
        });
        if (!response.success) {
          setFabrics([]);
          setPagination(null);
          setError('Unable to load fabrics.');
          return;
        }
        const rows = Array.isArray(response.data?.fabrics) ? response.data.fabrics : [];
        setFabrics(rows);
        setPagination(response.data?.pagination || null);
      } catch {
        setFabrics([]);
        setPagination(null);
        setError('Unable to load fabrics.');
      } finally {
        setIsLoading(false);
      }
    };
    void loadFabrics();
  }, [
    appliedFilters.color,
    appliedFilters.country,
    appliedFilters.page,
    appliedFilters.search,
    selectedMaterialId,
    settings.pageSize,
  ]);

  const updateUrl = (next: typeof filters) => {
    const params = new URLSearchParams();
    if (next.search.trim()) params.set('search', next.search.trim());
    if (next.material.trim()) params.set('material', next.material.trim());
    if (next.country.trim()) params.set('country', next.country.trim());
    if (next.color.trim()) params.set('color', next.color.trim());
    if (next.page > 1) params.set('page', String(next.page));
    setSearchParams(params);
  };

  const updateFilter = (key: keyof typeof filters, value: string | number) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? Number(value) : 1,
    }));
  };

  const applyFilters = (next: typeof filters) => {
    setAppliedFilters(next);
    setFilters(next);
    updateUrl(next);
  };

  const handleSearch = () => {
    applyFilters({ ...filters, page: 1 });
  };

  const handlePageChange = (page: number) => {
    const next = { ...appliedFilters, page };
    setAppliedFilters(next);
    setFilters(next);
    updateUrl(next);
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
            Home &gt; Shop &gt; Fabrics <span className="mx-2">|</span>{' '}
            <span className="font-semibold text-gray-900">{pagination?.total ?? fabrics.length}</span> products
          </p>
          <p className="text-sm text-gray-600">Material: {filters.material || 'All'}</p>
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
              placeholder="Search fabrics..."
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
              <option key={`fabric-country-${country}`} value={country}>
                {country}
              </option>
            ))}
          </select>
          <select
            value={filters.material}
            onChange={(event) => updateFilter('material', event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Material (All)</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name}
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
              <option key={`fabric-color-${color}`} value={color}>
                {color}
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
          {(filters.search || filters.material || filters.country || filters.color) ? (
            <button
              type="button"
              onClick={() => {
                const next = { search: '', material: '', country: '', color: '', page: 1 };
                applyFilters(next);
              }}
              className="border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Clear
            </button>
          ) : null}
        </div>

        {featuredProducts.length > 0 ? (
          <div className={featuredGridClass}>
            {featuredProducts.slice(0, 3).map((product) => {
              const flagCode = resolveCountryCode(product.country || '');
              return (
                <Link key={product.id} to={product.href} className="group bg-white border border-gray-200 overflow-hidden">
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
                    <p className="mt-2 text-xl font-semibold text-gray-900">{formatFromUsd(Number(product.priceUsd || 0))}/yard</p>
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
        ) : fabrics.length === 0 ? (
          <div className="text-center py-16 bg-white border rounded-xl">
            <p className="text-gray-600 mb-4">No fabrics found for this filter.</p>
          </div>
        ) : (
          <>
            <div className={productGridClass}>
              {fabrics.map((fabric) => {
                const flagCode = resolveCountryCode(fabric.seller?.country || '');
                return (
                  <Link key={fabric.id} to={`/fabrics/${fabric.id}`} className="group bg-white border border-gray-200 overflow-hidden">
                    <div className="relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                      <img
                        src={fabric.images?.[0]?.url || '/placeholder.jpg'}
                        alt={fabric.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {(fabric.productLabels || []).length > 0 ? (
                        <div className="absolute right-2 top-2 z-10 flex flex-wrap justify-end gap-1">
                          {(fabric.productLabels || []).slice(0, 2).map((label) => (
                            <span
                              key={`${fabric.id}-label-${label.id}`}
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
                          alt={`${fabric.seller?.country || 'Country'} flag`}
                          className="absolute left-2 top-2 h-5 w-8 rounded-sm object-cover shadow"
                        />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 leading-tight">{fabric.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{fabric.seller?.businessName}</p>
                      <p className="text-base font-semibold mt-2">{formatFromUsd(Number(fabric.pricePerMeter || 0))}/yard</p>
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
