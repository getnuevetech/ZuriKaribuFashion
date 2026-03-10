import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Loader2, Heart } from 'lucide-react';
import { api } from '../services/api';

interface Category {
  id: string;
  name: string;
  slug?: string;
}

interface ReadyToWearProduct {
  id: string;
  name: string;
  description: string;
  basePrice?: number;
  images: { url: string }[];
  designer?: {
    businessName?: string;
    country?: string;
  };
  category?: {
    id: string;
    name: string;
    slug?: string;
  };
  sizeVariations?: Array<{
    size: string;
    price: number;
    stock: number;
  }>;
}

const countryFlags: Record<string, string> = {
  Ghana: '🇬🇭',
  Nigeria: '🇳🇬',
  Kenya: '🇰🇪',
  Senegal: '🇸🇳',
  Ethiopia: '🇪🇹',
  Morocco: '🇲🇦',
  Mali: '🇲🇱',
  'South Africa': '🇿🇦',
  Tanzania: '🇹🇿',
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    page: Number.parseInt(searchParams.get('page') || '1', 10) || 1,
  });

  const selectedCategoryId = useMemo(
    () => resolveCategoryIdFromQuery(filters.category, categories),
    [filters.category, categories]
  );

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.products.getCategories();
        if (!response.success || !Array.isArray(response.data)) return;
        setCategories(response.data);
      } catch (loadError) {
        console.error('Failed to load ready-to-wear categories:', loadError);
      }
    };
    loadCategories();
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
          limit: 60,
        });
        if (!response.success) {
          setProducts([]);
          setError('Unable to load ready-to-wear products.');
          return;
        }
        setProducts(Array.isArray(response.data?.products) ? response.data.products : []);
      } catch (loadError) {
        console.error('Failed to load ready-to-wear products:', loadError);
        setProducts([]);
        setError('Unable to load ready-to-wear products.');
      } finally {
        setIsLoading(false);
      }
    };
    loadProducts();
  }, [filters.page, filters.search, selectedCategoryId]);

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
    <div className="min-h-screen bg-gray-50">
      <section className="relative h-64 md:h-80 overflow-hidden">
        <img src="/images/hero-readytowear.jpg" alt="Ready to Wear" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.5), transparent)' }} />
        <div className="absolute inset-0 flex items-center">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3">Ready to Wear</h1>
              <p className="text-lg text-white text-opacity-80">
                Browse by category, pick your size, and check out quickly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-4 space-y-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search ready-to-wear products..."
              className="w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-coral-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => updateFilter('category', '')}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                !filters.category ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
              }`}
            >
              All Categories
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
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
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
            <p className="text-gray-600">No ready-to-wear products found for this category/filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => {
              const flag = countryFlags[product.designer?.country || ''] || '🌍';
              const validVariationPrices = (product.sizeVariations || [])
                .map((size) => Number(size.price || 0))
                .filter((value) => Number.isFinite(value) && value > 0);
              const defaultPrice =
                validVariationPrices.length > 0
                  ? Math.min(...validVariationPrices)
                  : Number(product.basePrice || 0);
              const availableSizes =
                (product.sizeVariations || [])
                  .filter((size) => Number(size.stock || 0) > 0)
                  .map((size) => size.size)
                  .filter(Boolean) || [];
              const categoryToken = getCategoryToken(product.category);

              return (
                <Link key={product.id} to={`/ready-to-wear/${product.id}`} className="group">
                  <div className="bg-white shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                    <div className="overflow-hidden relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                      <img
                        src={product.images?.[0]?.url || '/placeholder.jpg'}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute bottom-3 right-3 w-10 h-10 flex items-center justify-center z-10">
                        <span className="text-2xl shadow-lg">{flag}</span>
                      </div>
                      <button
                        className="absolute top-3 right-3 w-8 h-8 bg-white bg-opacity-90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-coral-500 hover:text-white"
                        onClick={(event) => event.preventDefault()}
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4">
                      {product.category?.name ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            updateFilter('category', categoryToken || product.category?.id || '');
                          }}
                          className="inline-flex text-xs font-medium text-coral-600 hover:underline"
                        >
                          {product.category.name}
                        </button>
                      ) : null}
                      <h3 className="font-semibold text-gray-900 group-hover:text-coral-500 transition-colors">{product.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{product.designer?.businessName || 'Designer'}</p>
                      <p className="text-coral-500 font-semibold mt-2">${defaultPrice.toFixed(2)}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {availableSizes.slice(0, 4).map((size) => (
                          <span key={size} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {size}
                          </span>
                        ))}
                        {availableSizes.length > 4 ? (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">+{availableSizes.length - 4}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
