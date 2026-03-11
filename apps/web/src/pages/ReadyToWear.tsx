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
  sizeVariations?: Array<{ size: string; price: number; stock: number }>;
}

type CategoryPageSettings = {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  pageSize: number;
  columns: number;
  showPagination: boolean;
  featuredProductIds: string[];
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
  bannerTitle: 'Ready To Wear',
  bannerSubtitle: 'Shop ready styles from designers across Africa.',
  bannerImage: '/images/hero-readytowear.jpg',
  pageSize: 24,
  columns: 4,
  showPagination: true,
  featuredProductIds: [],
};

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

export default function ReadyToWear() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ReadyToWearProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CategoryPageSettings>(DEFAULT_SETTINGS);
  const { formatFromUsd } = useCurrencyStore();

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
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

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.products.getCategories();
        if (response.success && Array.isArray(response.data)) {
          setCategories(response.data);
        }
      } catch (loadError) {
        console.error('Failed to load ready-to-wear categories:', loadError);
      }
    };
    void loadCategories();
  }, []);

  useEffect(() => {
    const loadPageSettings = async () => {
      try {
        const response = await api.products.getCategoryPageSettings('READY_TO_WEAR');
        if (!response.success || !response.data?.settings) return;
        setSettings({
          bannerTitle: String(response.data.settings.bannerTitle || DEFAULT_SETTINGS.bannerTitle),
          bannerSubtitle: String(response.data.settings.bannerSubtitle || DEFAULT_SETTINGS.bannerSubtitle),
          bannerImage: String(response.data.settings.bannerImage || DEFAULT_SETTINGS.bannerImage),
          pageSize: Number(response.data.settings.pageSize || DEFAULT_SETTINGS.pageSize),
          columns: Number(response.data.settings.columns || DEFAULT_SETTINGS.columns),
          showPagination: Boolean(response.data.settings.showPagination),
          featuredProductIds: Array.isArray(response.data.settings.featuredProductIds) ? response.data.settings.featuredProductIds : [],
        });
        setFeaturedProducts(Array.isArray(response.data.featuredProducts) ? response.data.featuredProducts : []);
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
          categoryId: selectedCategoryId,
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
  }, [filters.page, filters.search, selectedCategoryId, settings.pageSize]);

  const updateUrl = (next: typeof filters) => {
    const params = new URLSearchParams();
    if (next.search.trim()) params.set('search', next.search.trim());
    if (next.category.trim()) params.set('category', next.category.trim());
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

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <section className="relative h-52 md:h-64 overflow-hidden">
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
            Home &gt; Shop &gt; Ready to Wear <span className="mx-2">|</span>{' '}
            <span className="font-semibold text-gray-900">{pagination?.total ?? products.length}</span> products
          </p>
          <p className="text-sm text-gray-600">Category: {selectedCategoryLabel}</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => updateFilter('category', '')}
            className={`shrink-0 border px-4 py-2 text-sm font-medium ${
              !filters.category ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
            }`}
          >
            All
          </button>
          {categories.map((category) => {
            const token = getCategoryToken(category);
            const isActive =
              Boolean(filters.category) &&
              (filters.category.toLowerCase() === category.id.toLowerCase() ||
                filters.category.toLowerCase() === (category.slug || '').toLowerCase() ||
                filters.category.toLowerCase() === category.name.toLowerCase());
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => updateFilter('category', token || category.id)}
                className={`shrink-0 border px-4 py-2 text-sm font-medium ${
                  isActive ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>

        <div className="bg-white border border-gray-200 p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search Ready To Wear..."
              className="w-full pl-9 pr-3 py-2 border rounded-md"
            />
          </div>
          {(filters.search || filters.category) ? (
            <button
              type="button"
              onClick={() => {
                const next = { search: '', category: '', page: 1 };
                setFilters(next);
                updateUrl(next);
              }}
              className="border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Clear
            </button>
          ) : null}
        </div>

        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featuredProducts.slice(0, 2).map((product) => {
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
      </div>
    </div>
  );
}
