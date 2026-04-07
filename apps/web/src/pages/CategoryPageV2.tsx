import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { api, resolveAssetUrl } from '../services/api';
import { resolveCountryCode } from '../data/locationOptions';
import { ThemeProvider } from './jenks-v14/context/ThemeContext';
import BrandImageWithFallback from '../components/BrandImageWithFallback';
import '../styles/jenks-v2.css';

type CategoryPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR' | 'COUNTRY' | 'SHOP';
type CategoryFilterKey = 'STYLE' | 'FABRIC_TYPE' | 'MATERIAL' | 'COUNTRY' | 'PRICE' | 'COLOR' | 'CATEGORY';
type CategoryFilterInputType = 'DROPDOWN' | 'SUGGESTIVE_SEARCH';

type CategoryPageRuntime = {
  settings: {
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
    filterDefinitions: Array<{
      id: string;
      key: CategoryFilterKey;
      label: string;
      inputType: CategoryFilterInputType;
      enabled: boolean;
      options: string[];
      displayOrder: number;
    }>;
  };
  countryIcons: string[];
  primaryGridProducts: CategoryPageProduct[];
};

type CategoryPageProduct = {
  id: string;
  sourceType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
  name: string;
  description?: string;
  image: string;
  ownerName: string;
  country: string;
  priceUsd: number;
  href: string;
  style: string;
  fabricType: string;
  material: string;
  color: string;
  category: string;
};

const FILTER_PARAM_BY_KEY: Record<CategoryFilterKey, 'style' | 'fabricType' | 'material' | 'country' | 'price' | 'color' | 'category'> = {
  STYLE: 'style',
  FABRIC_TYPE: 'fabricType',
  MATERIAL: 'material',
  COUNTRY: 'country',
  PRICE: 'price',
  COLOR: 'color',
  CATEGORY: 'category',
};

const PAGE_PATH_BY_TYPE: Record<CategoryPageType, string> = {
  READY_TO_WEAR: '/readytowear',
  FABRIC_TO_BUY: '/fabricstobuy',
  CUSTOM_TO_WEAR: '/customtowear',
  COUNTRY: '/country',
  SHOP: '/shop',
};

export default function CategoryPageV2({
  pageType,
  breadcrumbLabel,
  allowCountryQuery = false,
}: {
  pageType: CategoryPageType;
  breadcrumbLabel: string;
  allowCountryQuery?: boolean;
}) {
  const [searchParams] = useSearchParams();
  const [runtime, setRuntime] = useState<CategoryPageRuntime | null>(null);
  const [products, setProducts] = useState<CategoryPageProduct[]>([]);
  const [loadingRuntime, setLoadingRuntime] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingSearch, setPendingSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [pendingFilters, setPendingFilters] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingRuntime(true);
      setError(null);
      try {
        const response = await api.products.getCategoryPageSettings(pageType);
        if (!active) return;
        const data = response?.data as CategoryPageRuntime | undefined;
        if (!response?.success || !data?.settings) {
          setRuntime(null);
          setError('Unable to load category page settings.');
          return;
        }
        setRuntime(data);
        const initialFilters: Record<string, string> = {};
        for (const row of data.settings.filterDefinitions || []) {
          initialFilters[row.key] = '';
        }
        setPendingFilters(initialFilters);
        const countryFromQuery = allowCountryQuery ? String(searchParams.get('country') || '').trim() : '';
        const categoryFromQuery = allowCountryQuery ? String(searchParams.get('category') || '').trim() : '';
        const nextApplied: Record<string, string[]> = {};
        if (countryFromQuery) {
          initialFilters.COUNTRY = countryFromQuery;
          nextApplied.country = [countryFromQuery];
        }
        if (categoryFromQuery) {
          initialFilters.CATEGORY = categoryFromQuery;
          nextApplied.category = [categoryFromQuery];
        }
        setAppliedFilters(nextApplied);
        setPendingSearch('');
        setAppliedSearch('');
        setPage(1);
      } catch {
        if (!active) return;
        setRuntime(null);
        setError('Unable to load category page settings.');
      } finally {
        if (active) setLoadingRuntime(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [pageType, allowCountryQuery, searchParams]);

  useEffect(() => {
    if (!runtime?.settings) return;
    let active = true;
    const loadProducts = async () => {
      setLoadingProducts(true);
      setError(null);
      try {
        const response = await api.products.getCategoryPageProducts(pageType, {
          search: appliedSearch || undefined,
          page,
          limit: runtime.settings.pageSize,
          style: appliedFilters.style || undefined,
          fabricType: appliedFilters.fabricType || undefined,
          material: appliedFilters.material || undefined,
          country: appliedFilters.country || undefined,
          price: appliedFilters.price || undefined,
          color: appliedFilters.color || undefined,
          category: appliedFilters.category || undefined,
        });
        if (!active) return;
        const rows = Array.isArray(response?.data?.products) ? (response.data.products as CategoryPageProduct[]) : [];
        const pagination = response?.data?.pagination || { page: 1, pages: 1, total: 0 };
        setProducts(rows);
        setPage(Number(pagination.page || 1));
        setPages(Number(pagination.pages || 1));
        setTotal(Number(pagination.total || 0));
      } catch {
        if (!active) return;
        setProducts([]);
        setPages(1);
        setTotal(0);
        setError('Unable to load products.');
      } finally {
        if (active) setLoadingProducts(false);
      }
    };
    void loadProducts();
    return () => {
      active = false;
    };
  }, [runtime, pageType, page, appliedSearch, appliedFilters]);

  const enabledFilters = useMemo(
    () => (runtime?.settings.filterDefinitions || []).filter((row) => row.enabled).sort((a, b) => a.displayOrder - b.displayOrder),
    [runtime]
  );

  const primarySlotCount = Math.max(1, Number(runtime?.settings.primaryGridRows || 1)) * Math.max(1, Number(runtime?.settings.primaryGridColumns || 1));
  const primaryProducts = (runtime?.primaryGridProducts || []).slice(0, primarySlotCount);
  const primaryIds = new Set(primaryProducts.map((row) => row.id));
  const listingProducts = products.filter((row) => !primaryIds.has(row.id));

  const submitFilters = (event?: FormEvent) => {
    event?.preventDefault();
    const nextApplied: Record<string, string[]> = {};
    for (const row of enabledFilters) {
      const paramKey = FILTER_PARAM_BY_KEY[row.key];
      const value = String(pendingFilters[row.key] || '').trim();
      if (value) nextApplied[paramKey] = [value];
    }
    setAppliedSearch(pendingSearch.trim());
    setAppliedFilters(nextApplied);
    setPage(1);
  };

  const clearFilters = () => {
    const reset: Record<string, string> = {};
    for (const row of enabledFilters) reset[row.key] = '';
    setPendingFilters(reset);
    setAppliedFilters({});
    setPendingSearch('');
    setAppliedSearch('');
    setPage(1);
  };

  const applyCountryQuickFilter = (country: string) => {
    const countryToken = String(country || '').trim();
    if (!countryToken) return;
    setPendingFilters((prev) => ({ ...prev, COUNTRY: countryToken }));
    setAppliedFilters((prev) => ({ ...prev, country: [countryToken] }));
    setPage(1);
  };

  return (
    <ThemeProvider>
      <div className="relative bg-[var(--bg-primary)] min-h-screen">
        <div className="grain-overlay" />

        {loadingRuntime ? (
          <div className="min-h-[55vh] flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-[var(--text-primary)]" />
          </div>
        ) : (
          <>
            <section className="relative overflow-hidden" style={{ minHeight: `${Math.max(320, Number(runtime?.settings.bannerHeight || 680))}px` }}>
              <BrandImageWithFallback
                src={resolveAssetUrl(runtime?.settings.bannerImage || '')}
                alt={runtime?.settings.title || 'Category banner'}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-transparent" />
              <div className="relative z-10 px-8 md:px-[8vw] py-16 md:py-20 lg:py-24 flex min-h-[inherit] flex-col justify-end">
                <nav className="mb-3 flex items-center gap-2 text-sm text-white/75">
                  <Link to="/" className="hover:text-white transition-colors">
                    Home
                  </Link>
                  <span aria-hidden="true">&gt;</span>
                  <Link to={PAGE_PATH_BY_TYPE[pageType]} className="hover:text-white transition-colors">
                    {breadcrumbLabel}
                  </Link>
                </nav>
                <h1 className="headline-lg text-[clamp(44px,7vw,96px)] leading-[0.95] text-white mb-4">{runtime?.settings.title || breadcrumbLabel}</h1>
                <p className="max-w-2xl text-base md:text-lg text-white/85">{runtime?.settings.subtitle || ''}</p>
              </div>
            </section>

            <div className="sticky top-20 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border)]">
              <div className="px-8 md:px-[8vw] py-4 space-y-3">
                <form onSubmit={submitFilters} className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[260px] flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      value={pendingSearch}
                      onChange={(event) => setPendingSearch(event.target.value)}
                      placeholder={runtime?.settings.searchPlaceholder || 'Search products...'}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors text-sm"
                    />
                  </div>
                  {enabledFilters.map((row) => {
                    const value = String(pendingFilters[row.key] || '');
                    const listId = `filter-suggest-${pageType}-${row.key}`;
                    return (
                      <div key={row.id} className="min-w-[148px]">
                        <input
                          value={value}
                          onChange={(event) => setPendingFilters((prev) => ({ ...prev, [row.key]: event.target.value }))}
                          placeholder={row.label}
                          list={listId}
                          className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent)]"
                        />
                        <datalist id={listId}>
                          {(row.options || []).map((option) => (
                            <option key={`${listId}-${option}`} value={option} />
                          ))}
                        </datalist>
                      </div>
                    );
                  })}
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-3 py-2.5 text-sm border border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                    title="Search and apply filters"
                  >
                    <Search className="h-4 w-4" />
                    <span>Search</span>
                  </button>
                  <button type="button" onClick={clearFilters} className="px-3 py-2.5 text-sm border border-[var(--border)] text-[var(--text-secondary)]">
                    Clear
                  </button>
                </form>

                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
                  {(runtime?.countryIcons || []).map((country) => {
                    const code = resolveCountryCode(country);
                    const active = (appliedFilters.country || []).some((entry) => entry.toLowerCase() === String(country || '').toLowerCase());
                    return (
                      <button
                        key={`country-icon-${country}`}
                        type="button"
                        onClick={() => applyCountryQuickFilter(country)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm border ${
                          active
                            ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]'
                            : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)]'
                        }`}
                      >
                        {code ? (
                          <img
                            src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
                            alt={country}
                            className="h-4 w-6 object-cover rounded-[2px]"
                            loading="lazy"
                          />
                        ) : null}
                        <span>{country}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <section className="px-8 md:px-[8vw] py-10 space-y-10">
              {error ? <div className="border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div> : null}

              {primaryProducts.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="headline-lg text-[clamp(22px,3vw,34px)] text-[var(--text-primary)]">Featured Selection</h2>
                  <div
                    className="grid gap-6"
                    style={{ gridTemplateColumns: `repeat(${Math.max(1, Number(runtime?.settings.primaryGridColumns || 3))}, minmax(0, 1fr))` }}
                  >
                    {primaryProducts.map((row) => (
                      <Link key={`primary-${row.id}`} to={row.href} className="group bg-[var(--bg-secondary)] border border-[var(--border)]">
                        <div className="relative aspect-[3/4] overflow-hidden">
                          <BrandImageWithFallback
                            src={resolveAssetUrl(row.image)}
                            alt={row.name}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm text-[var(--text-secondary)]">{row.ownerName}</p>
                          <h3 className="text-base font-medium text-[var(--text-primary)] line-clamp-1">{row.name}</h3>
                          <p className="text-[var(--accent)] text-sm mt-1">${Number(row.priceUsd || 0).toFixed(2)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="headline-lg text-[clamp(24px,3vw,40px)] text-[var(--text-primary)]">Collection</h2>
                  <span className="text-sm text-[var(--text-secondary)]">{total} products</span>
                </div>

                {loadingProducts ? (
                  <div className="py-16 flex items-center justify-center">
                    <Loader2 className="h-9 w-9 animate-spin text-[var(--text-primary)]" />
                  </div>
                ) : listingProducts.length === 0 ? (
                  <div className="text-center py-14 text-[var(--text-secondary)]">No products match the selected filters.</div>
                ) : (
                  <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${Math.max(1, Number(runtime?.settings.columns || 4))}, minmax(0, 1fr))` }}>
                    {listingProducts.map((row) => (
                      <Link key={`product-${row.sourceType}-${row.id}`} to={row.href} className="group bg-[var(--bg-secondary)] border border-[var(--border)]">
                        <div className="relative aspect-[3/4] overflow-hidden">
                          <BrandImageWithFallback
                            src={resolveAssetUrl(row.image)}
                            alt={row.name}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>
                        <div className="px-4 py-4">
                          <p className="text-sm text-[var(--text-secondary)]">{row.ownerName}</p>
                          <h3 className="text-[var(--text-primary)] font-medium text-base line-clamp-1">{row.name}</h3>
                          <p className="text-[var(--accent)] text-sm mt-1">${Number(row.priceUsd || 0).toFixed(2)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {runtime?.settings.showPagination && pages > 1 ? (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="px-3 py-2 text-sm border border-[var(--border)] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-[var(--text-secondary)]">
                    Page {page} of {pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pages}
                    onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                    className="px-3 py-2 text-sm border border-[var(--border)] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </section>
          </>
        )}

      </div>
    </ThemeProvider>
  );
}
