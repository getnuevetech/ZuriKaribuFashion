import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { api } from '../services/api';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';

interface Category {
  id: string;
  name: string;
  slug?: string;
}

interface MaterialType {
  id: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ReadyToWearProduct {
  id: string;
  name: string;
  basePrice?: number;
  images: { url: string }[];
  designer?: { businessName?: string; country?: string };
  category?: { id: string; name: string; slug?: string };
  sizeVariations?: Array<{ size: string; color?: string; price: number; stock: number }>;
  colors?: string[];
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
  featuredSlots?: Array<{ productId: string; isActive: boolean }>;
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
  bannerTitle: 'Ready To Wear',
  bannerSubtitle: 'Shop ready styles from designers across Africa.',
  bannerImage: '/images/hero-readytowear.jpg',
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

function getCategoryToken(category: Category | ReadyToWearProduct['category'] | undefined) {
  if (!category) return '';
  return (category.slug || category.id || '').trim();
}

function resolveCategoryIdFromQuery(queryValue: string, categories: Category[]): string | undefined {
  if (!queryValue) return undefined;
  const normalized = queryValue.trim().toLowerCase();
  const matched = categories.find(
    (category) =>
      category.id.toLowerCase() === normalized ||
      (category.slug || '').toLowerCase() === normalized ||
      category.name.toLowerCase() === normalized
  );
  return matched?.id;
}

function pickRandomProducts(rows: FeaturedProduct[], count: number) {
  const copy = [...rows];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy.slice(0, Math.max(0, count));
}

export default function ReadyToWear() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ReadyToWearProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<MaterialType[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [rotatingProducts, setRotatingProducts] = useState<FeaturedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CategoryPageSettings>(DEFAULT_SETTINGS);
  const { formatFromUsd } = useCurrencyStore();

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    country: searchParams.get('country') || '',
    category: searchParams.get('category') || '',
    size: searchParams.get('size') || '',
    color: searchParams.get('color') || '',
    material: searchParams.get('material') || '',
    page: Number.parseInt(searchParams.get('page') || '1', 10) || 1,
  });

  const selectedCategoryId = useMemo(
    () => resolveCategoryIdFromQuery(filters.category, categories),
    [filters.category, categories]
  );

  const selectedCategoryLabel = useMemo(() => {
    if (!filters.category) return 'All';
    const normalized = filters.category.toLowerCase();
    const matched = categories.find(
      (category) =>
        category.id.toLowerCase() === normalized ||
        (category.slug || '').toLowerCase() === normalized ||
        category.name.toLowerCase() === normalized
    );
    return matched?.name || filters.category;
  }, [categories, filters.category]);

  const productGridClass = useMemo(() => {
    const columns = Math.max(2, Math.min(6, Math.round(Number(settings.columns || 4))));
    return `grid grid-cols-2 ${mdGridByColumns[columns]} ${lgGridByColumns[columns]} gap-4 md:gap-6`;
  }, [settings.columns]);

  const countryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => String(product.designer?.country || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const sizeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...COMMON_SIZE_OPTIONS,
          ...products.flatMap((product) =>
            (product.sizeVariations || [])
              .map((variation) => String(variation.size || '').trim().toUpperCase())
              .filter(Boolean)
          ),
        ])
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const colorOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...COMMON_COLOR_OPTIONS,
          ...products.flatMap((product) => (product.colors || []).map((entry) => String(entry || '').trim())),
          ...products.flatMap((product) =>
            (product.sizeVariations || []).map((variation) => String(variation.color || '').trim())
          ),
        ])
      )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [products]
  );

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const [categoryResponse, materialResponse] = await Promise.all([
          api.products.getCategories(),
          api.products.getMaterials(),
        ]);
        if (categoryResponse.success && Array.isArray(categoryResponse.data)) {
          setCategories(categoryResponse.data);
        }
        if (materialResponse.success && Array.isArray(materialResponse.data)) {
          setMaterials(
            materialResponse.data.map((entry: any) => ({
              id: String(entry.id || '').trim(),
              name: String(entry.name || '').trim(),
            }))
          );
        }
      } catch (loadError) {
        console.error('Failed to load ready-to-wear taxonomy data:', loadError);
      }
    };
    void loadTaxonomy();
  }, []);

  useEffect(() => {
    const loadPageSettings = async () => {
      try {
        const response = await api.products.getCategoryPageSettings('READY_TO_WEAR');
        if (!response.success || !response.data?.settings) return;
        const nextSettings = response.data.settings;
        setSettings({
          bannerTitle: String(nextSettings.bannerTitle || DEFAULT_SETTINGS.bannerTitle),
          bannerSubtitle: String(nextSettings.bannerSubtitle || DEFAULT_SETTINGS.bannerSubtitle),
          bannerImage: String(nextSettings.bannerImage || DEFAULT_SETTINGS.bannerImage),
          bannerHeight: Number(nextSettings.bannerHeight || DEFAULT_SETTINGS.bannerHeight),
          pageSize: Number(nextSettings.pageSize || DEFAULT_SETTINGS.pageSize),
          columns: Number(nextSettings.columns || DEFAULT_SETTINGS.columns),
          showPagination: Boolean(nextSettings.showPagination),
          featuredProductIds: Array.isArray(nextSettings.featuredProductIds) ? nextSettings.featuredProductIds : [],
          featuredSlots: Array.isArray(nextSettings.featuredSlots) ? nextSettings.featuredSlots : undefined,
          rotatingProductIds: Array.isArray(nextSettings.rotatingProductIds) ? nextSettings.rotatingProductIds : [],
          rotatingColumns: Number(nextSettings.rotatingColumns || DEFAULT_SETTINGS.rotatingColumns),
          rotatingRows: Number(nextSettings.rotatingRows || DEFAULT_SETTINGS.rotatingRows),
          rotatingTitleSize: Number(nextSettings.rotatingTitleSize || DEFAULT_SETTINGS.rotatingTitleSize),
        });
        const nextFeaturedProducts = Array.isArray(response.data.featuredProducts) ? response.data.featuredProducts : [];
        const nextRotatingPool = Array.isArray(response.data.rotatingProducts) ? response.data.rotatingProducts : [];
        setFeaturedProducts(nextFeaturedProducts);
        const rotatingCount =
          Math.max(1, Math.min(6, Math.round(Number(nextSettings.rotatingColumns || DEFAULT_SETTINGS.rotatingColumns)))) *
          Math.max(1, Math.min(6, Math.round(Number(nextSettings.rotatingRows || DEFAULT_SETTINGS.rotatingRows))));
        setRotatingProducts(pickRandomProducts(nextRotatingPool, rotatingCount));
      } catch (loadError) {
        console.error('Failed to load ready-to-wear category page settings:', loadError);
      }
    };
    void loadPageSettings();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.products.getReadyToWear({
          search: filters.search || undefined,
          country: filters.country || undefined,
          categoryId: selectedCategoryId,
          size: filters.size || undefined,
          color: filters.color || undefined,
          material: filters.material || undefined,
          page: filters.page,
          limit: settings.pageSize,
        });
        if (!response.success) {
          setProducts([]);
          setPagination(null);
          setError('Unable to load ready-to-wear products.');
          return;
        }
        setProducts(Array.isArray(response.data?.products) ? response.data.products : []);
        setPagination(response.data?.pagination || null);
      } catch (loadError) {
        console.error('Failed to load ready-to-wear products:', loadError);
        setProducts([]);
        setPagination(null);
        setError('Unable to load ready-to-wear products.');
      } finally {
        setIsLoading(false);
      }
    };
    void loadProducts();
  }, [filters.color, filters.country, filters.material, filters.page, filters.search, filters.size, selectedCategoryId, settings.pageSize]);

  const updateUrl = (next: typeof filters) => {
    const params = new URLSearchParams();
    if (next.search.trim()) params.set('search', next.search.trim());
    if (next.country.trim()) params.set('country', next.country.trim());
    if (next.category.trim()) params.set('category', next.category.trim());
    if (next.size.trim()) params.set('size', next.size.trim());
    if (next.color.trim()) params.set('color', next.color.trim());
    if (next.material.trim()) params.set('material', next.material.trim());
    if (next.page > 1) params.set('page', String(next.page));
    setSearchParams(params);
  };

  const updateFilter = (key: keyof typeof filters, value: string | number) => {
    const next = {
      ...filters,
      [key]: value,
      page: key === 'page' ? Number(value) : 1,
    };
    setFilters(next);
    updateUrl(next);
  };

  const featuredGridClass = useMemo(() => {
    const count = Math.max(1, Math.min(3, featuredProducts.length));
    if (count === 1) return 'grid grid-cols-1 gap-6';
    if (count === 2) return 'grid grid-cols-1 md:grid-cols-2 gap-6';
    return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
  }, [featuredProducts.length]);

  const rotatingGridClass = useMemo(() => {
    const columns = Math.max(1, Math.min(6, Math.round(Number(settings.rotatingColumns || 2))));
    return `grid grid-cols-1 ${dynamicMdGridByColumns[columns]} ${dynamicLgGridByColumns[columns]} gap-6`;
  }, [settings.rotatingColumns]);

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
            <p className="mt-2 max-w-2xl text-sm md:text-base text-white/90">
              {settings.bannerSubtitle || DEFAULT_SETTINGS.bannerSubtitle}
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Home &gt; Shop &gt; Ready to Wear <span className="mx-2">|</span>{' '}
            <span className="font-semibold text-gray-900">{pagination?.total ?? products.length}</span> products
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
              placeholder="Search Ready To Wear..."
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
              <option key={`country-${country}`} value={country}>
                {country}
              </option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(event) => updateFilter('category', event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Style (All)</option>
            {categories.map((category) => (
              <option key={category.id} value={getCategoryToken(category) || category.id}>
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
            {sizeOptions.map((size) => (
              <option key={`size-${size}`} value={size}>
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
            {colorOptions.map((color) => (
              <option key={`color-${color}`} value={color}>
                {color}
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
              <option key={material.id} value={material.name}>
                {material.name}
              </option>
            ))}
          </select>
          {(filters.search || filters.country || filters.category || filters.size || filters.color || filters.material) ? (
            <button
              type="button"
              onClick={() => {
                const next = {
                  search: '',
                  country: '',
                  category: '',
                  size: '',
                  color: '',
                  material: '',
                  page: 1,
                };
                setFilters(next);
                updateUrl(next);
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
              <h2 className="text-lg font-semibold text-gray-900">Ready-To-Wear Picks For You</h2>
              <span className="text-xs text-gray-500">
                {settings.rotatingColumns} column{settings.rotatingColumns > 1 ? 's' : ''} × {settings.rotatingRows} row
                {settings.rotatingRows > 1 ? 's' : ''} (randomized on refresh)
              </span>
            </div>
            <div className={rotatingGridClass}>
              {rotatingProducts.map((product) => {
                const flagCode = resolveCountryCode(product.country || '');
                return (
                  <Link key={`rotating-${product.id}`} to={product.href} className="group bg-white border border-gray-200 overflow-hidden">
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
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent p-4 text-white">
                        <h2
                          className="font-semibold leading-tight"
                          style={{
                            fontSize: `${Math.max(16, Math.min(64, Number(settings.rotatingTitleSize || DEFAULT_SETTINGS.rotatingTitleSize)))}px`,
                          }}
                        >
                          {product.name}
                        </h2>
                        {product.description ? (
                          <p className="mt-2 line-clamp-2 text-sm text-white/90">{product.description}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-white/90">{product.ownerName}</p>
                        <p className="mt-1 text-base font-semibold">{formatFromUsd(Number(product.priceUsd || 0))}</p>
                        <span className="mt-3 inline-flex bg-white px-3 py-1.5 text-xs font-semibold text-black">VIEW PRODUCT</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
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
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-white border rounded-xl">
            <p className="text-gray-600 mb-4">No ready-to-wear products found for this category/filter.</p>
          </div>
        ) : (
          <>
            <div className={productGridClass}>
              {products.map((product) => {
                const flagCode = resolveCountryCode(product.designer?.country || '');
                const validVariationPrices = (product.sizeVariations || [])
                  .map((size) => Number(size.price || 0))
                  .filter((value) => Number.isFinite(value) && value > 0);
                const defaultPrice = validVariationPrices.length > 0 ? Math.min(...validVariationPrices) : Number(product.basePrice || 0);
                return (
                  <Link key={product.id} to={`/ready-to-wear/${product.id}`} className="group bg-white border border-gray-200 overflow-hidden">
                    <div className="relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                      <img
                        src={product.images?.[0]?.url || '/placeholder.jpg'}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {flagCode ? (
                        <img
                          src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                          alt={`${product.designer?.country || 'Country'} flag`}
                          className="absolute left-2 top-2 h-5 w-8 rounded-sm object-cover shadow"
                        />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 leading-tight">{product.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{product.designer?.businessName || 'Designer'}</p>
                      <p className="text-base font-semibold mt-2">{formatFromUsd(defaultPrice)}</p>
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
                  onClick={() => updateFilter('page', Math.max(1, filters.page - 1))}
                  disabled={filters.page <= 1}
                  className="p-2 border bg-white disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(7, pagination.pages) }, (_, index) => {
                  let pageNumber = index + 1;
                  if (pagination.pages > 7) {
                    if (filters.page <= 4) pageNumber = index + 1;
                    else if (filters.page >= pagination.pages - 3) pageNumber = pagination.pages - 6 + index;
                    else pageNumber = filters.page - 3 + index;
                  }
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => updateFilter('page', pageNumber)}
                      className={`h-9 min-w-9 px-2 border text-sm ${
                        filters.page === pageNumber ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => updateFilter('page', Math.min(pagination.pages, filters.page + 1))}
                  disabled={filters.page >= pagination.pages}
                  className="p-2 border bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </>
        )}

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
                    <p className="mt-2 text-xl font-semibold text-gray-900">{formatFromUsd(Number(product.priceUsd || 0))}</p>
                    <span className="inline-flex mt-3 bg-black text-white text-xs px-3 py-2">VIEW PRODUCT</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
