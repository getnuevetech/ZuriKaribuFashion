import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { api } from '../../services/api';
import { useCurrencyStore } from '../../store/currencyStore';
import { resolveCountryCode } from '../../data/locationOptions';
import { CategoryPageDesignPreset, resolveRotatingTitlePresentation } from '../../design/categoryPagePreset';
import '../../styles/jenks-v2.css';

type CategoryPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
type PageKind = 'READY' | 'CUSTOM' | 'FABRIC';

type TaxonomyOption = { id: string; name: string };
type Pagination = { page: number; limit: number; total: number; pages: number };
type ProductLabel = {
  id: string;
  name: string;
  textColor: string;
  backgroundColor: string;
  sizePercent?: number;
  fontSizePx?: number;
  isBold?: boolean;
};
type ProductCard = {
  id: string;
  name: string;
  ownerName: string;
  country: string;
  image: string;
  priceUsd: number;
  href: string;
  description?: string;
  labels: ProductLabel[];
};

type CategoryPageSettings = {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  designPreset: CategoryPageDesignPreset;
  bannerHeight: number;
  pageSize: number;
  columns: number;
  showPagination: boolean;
  rotatingColumns: number;
  rotatingRows: number;
  rotatingTitleSize: number;
};

type FilterState = {
  search: string;
  country: string;
  taxonomy: string;
  material: string;
  size: string;
  color: string;
  page: number;
};

type KimiCategoryPageProps = {
  pageType: CategoryPageType;
  kind: PageKind;
  pageLabel: string;
  routeBase: '/ready-to-wear' | '/custom' | '/fabrics';
  defaultBanner: string;
  defaultSubtitle: string;
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

const DEFAULT_SETTINGS: CategoryPageSettings = {
  bannerTitle: '',
  bannerSubtitle: '',
  bannerImage: '',
  designPreset: 'STANDARD',
  bannerHeight: 360,
  pageSize: 24,
  columns: 4,
  showPagination: true,
  rotatingColumns: 2,
  rotatingRows: 1,
  rotatingTitleSize: 32,
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

const asString = (value: unknown, fallback = '') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const pickRandomProducts = (rows: ProductCard[], count: number) => {
  const copy = [...rows];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy.slice(0, Math.max(0, count));
};

const buildFiltersFromParams = (searchParams: URLSearchParams): FilterState => ({
  search: searchParams.get('search') || '',
  country: searchParams.get('country') || '',
  taxonomy: searchParams.get('taxonomy') || searchParams.get('category') || '',
  material: searchParams.get('material') || '',
  size: searchParams.get('size') || '',
  color: searchParams.get('color') || '',
  page: Number.parseInt(searchParams.get('page') || '1', 10) || 1,
});

const normalizeSettings = (
  source: any,
  defaults: Pick<KimiCategoryPageProps, 'pageLabel' | 'defaultBanner' | 'defaultSubtitle'>
): CategoryPageSettings => ({
  bannerTitle: asString(source?.bannerTitle, defaults.pageLabel),
  bannerSubtitle: asString(source?.bannerSubtitle, defaults.defaultSubtitle),
  bannerImage: asString(source?.bannerImage, defaults.defaultBanner),
  designPreset:
    String(source?.designPreset || '').trim().toUpperCase() === 'EDITORIAL'
      ? 'EDITORIAL'
      : String(source?.designPreset || '').trim().toUpperCase() === 'MINIMAL'
        ? 'MINIMAL'
        : 'STANDARD',
  bannerHeight: Number(source?.bannerHeight || DEFAULT_SETTINGS.bannerHeight),
  pageSize: Number(source?.pageSize || DEFAULT_SETTINGS.pageSize),
  columns: Number(source?.columns || DEFAULT_SETTINGS.columns),
  showPagination: Boolean(source?.showPagination ?? true),
  rotatingColumns: Number(source?.rotatingColumns || DEFAULT_SETTINGS.rotatingColumns),
  rotatingRows: Number(source?.rotatingRows || DEFAULT_SETTINGS.rotatingRows),
  rotatingTitleSize: Number(source?.rotatingTitleSize || DEFAULT_SETTINGS.rotatingTitleSize),
});

const normalizeManagedProduct = (row: any, routeBase: string): ProductCard => ({
  id: asString(row?.id, ''),
  name: asString(row?.name, 'Product'),
  ownerName: asString(row?.ownerName, 'Vendor'),
  country: asString(row?.country, ''),
  image: asString(row?.image, '/placeholder.jpg'),
  priceUsd: Number(row?.priceUsd || 0),
  href: String(row?.href || '').startsWith('/') ? String(row.href) : `${routeBase}/${asString(row?.id, '')}`,
  description: asString(row?.description, ''),
  labels: [],
});

const normalizeProductLabel = (label: any): ProductLabel => ({
  id: asString(label?.id, ''),
  name: asString(label?.name, ''),
  textColor: asString(label?.textColor, '#ffffff'),
  backgroundColor: asString(label?.backgroundColor, '#111827'),
  sizePercent: Number(label?.sizePercent || 120),
  fontSizePx: Number(label?.fontSizePx || 12),
  isBold: label?.isBold !== false,
});

export default function KimiCategoryPage({
  pageType,
  kind,
  pageLabel,
  routeBase,
  defaultBanner,
  defaultSubtitle,
}: KimiCategoryPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatFromUsd } = useCurrencyStore();

  const [settings, setSettings] = useState<CategoryPageSettings>({
    ...DEFAULT_SETTINGS,
    bannerTitle: pageLabel,
    bannerSubtitle: defaultSubtitle,
    bannerImage: defaultBanner,
  });
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductCard[]>([]);
  const [rotatingProducts, setRotatingProducts] = useState<ProductCard[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [taxonomyOptions, setTaxonomyOptions] = useState<TaxonomyOption[]>([]);
  const [materialOptions, setMaterialOptions] = useState<TaxonomyOption[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(() => buildFiltersFromParams(searchParams));
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() => buildFiltersFromParams(searchParams));

  const selectedTaxonomyId = useMemo(() => {
    const token = String(appliedFilters.taxonomy || '').trim().toLowerCase();
    if (!token) return '';
    const match = taxonomyOptions.find(
      (entry) => entry.id.toLowerCase() === token || entry.name.toLowerCase() === token
    );
    return match?.id || '';
  }, [appliedFilters.taxonomy, taxonomyOptions]);

  const selectedMaterialId = useMemo(() => {
    const token = String(appliedFilters.material || '').trim().toLowerCase();
    if (!token) return '';
    const match = materialOptions.find(
      (entry) => entry.id.toLowerCase() === token || entry.name.toLowerCase() === token
    );
    return match?.id || '';
  }, [appliedFilters.material, materialOptions]);

  const selectedMaterialName = useMemo(() => {
    if (!selectedMaterialId) return '';
    return materialOptions.find((entry) => entry.id === selectedMaterialId)?.name || '';
  }, [materialOptions, selectedMaterialId]);

  const countryOptions = useMemo(
    () =>
      Array.from(new Set([...allCountries, ...products.map((product) => product.country).filter(Boolean)])).sort((a, b) =>
        a.localeCompare(b)
      ),
    [allCountries, products]
  );

  const productGridClass = useMemo(() => {
    const columns = Math.max(2, Math.min(6, Math.round(Number(settings.columns || 4))));
    return `grid grid-cols-2 ${mdGridByColumns[columns]} ${lgGridByColumns[columns]} gap-4 md:gap-6`;
  }, [settings.columns]);

  const rotatingGridClass = useMemo(() => {
    const columns = Math.max(1, Math.min(6, Math.round(Number(settings.rotatingColumns || 2))));
    return `grid grid-cols-1 ${dynamicMdGridByColumns[columns]} ${dynamicLgGridByColumns[columns]} gap-6`;
  }, [settings.rotatingColumns]);

  const taxonomyLabel = kind === 'FABRIC' ? 'Fabric' : 'Style';
  const showMaterialFilter = kind !== 'FABRIC';
  const showSizeFilter = kind !== 'FABRIC';

  useEffect(() => {
    const next = buildFiltersFromParams(searchParams);
    if (kind === 'FABRIC' && !next.taxonomy && next.material) {
      next.taxonomy = next.material;
      next.material = '';
    }
    setFilters(next);
    setAppliedFilters(next);
  }, [kind, searchParams]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.products.getCategoryPageSettings(pageType);
        if (!response.success || !response.data?.settings) return;
        const normalized = normalizeSettings(response.data.settings, { pageLabel, defaultBanner, defaultSubtitle });
        setSettings(normalized);

        const managedFeaturedRows = Array.isArray(response.data.featuredProducts)
          ? response.data.featuredProducts.map((row) => normalizeManagedProduct(row, routeBase))
          : [];
        setFeaturedProducts(managedFeaturedRows.slice(0, 3));

        const rotatingPool = Array.isArray(response.data.rotatingProducts)
          ? response.data.rotatingProducts.map((row) => normalizeManagedProduct(row, routeBase))
          : [];
        const rotatingCount =
          Math.max(1, Math.min(6, Math.round(Number(normalized.rotatingColumns || 2)))) *
          Math.max(1, Math.min(6, Math.round(Number(normalized.rotatingRows || 1))));
        setRotatingProducts(pickRandomProducts(rotatingPool, rotatingCount));
      } catch {
        // Keep defaults when settings API is unavailable.
      }
    };
    void loadSettings();
  }, [defaultBanner, defaultSubtitle, pageLabel, pageType, routeBase]);

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        if (kind === 'FABRIC') {
          const [taxonomyResponse, countriesResponse] = await Promise.all([
            api.products.getFabricCategories(),
            api.products.getCountries(),
          ]);
          setTaxonomyOptions(
            taxonomyResponse.success && Array.isArray(taxonomyResponse.data)
              ? taxonomyResponse.data.map((entry: any) => ({
                  id: asString(entry?.id, ''),
                  name: asString(entry?.name, ''),
                }))
              : []
          );
          setMaterialOptions([]);
          setAllCountries(
            countriesResponse.success && Array.isArray(countriesResponse.data)
              ? Array.from(new Set(countriesResponse.data.map((entry: any) => asString(entry, '')).filter(Boolean))).sort((a, b) =>
                  a.localeCompare(b)
                )
              : []
          );
          return;
        }

        const [taxonomyResponse, materialsResponse, countriesResponse] = await Promise.all([
          api.products.getCategories(),
          api.products.getMaterials(),
          api.products.getCountries(),
        ]);
        setTaxonomyOptions(
          taxonomyResponse.success && Array.isArray(taxonomyResponse.data)
            ? taxonomyResponse.data.map((entry: any) => ({
                id: asString(entry?.id, ''),
                name: asString(entry?.name, ''),
              }))
            : []
        );
        setMaterialOptions(
          materialsResponse.success && Array.isArray(materialsResponse.data)
            ? materialsResponse.data.map((entry: any) => ({
                id: asString(entry?.id, ''),
                name: asString(entry?.name, ''),
              }))
            : []
        );
        setAllCountries(
          countriesResponse.success && Array.isArray(countriesResponse.data)
            ? Array.from(new Set(countriesResponse.data.map((entry: any) => asString(entry, '')).filter(Boolean))).sort((a, b) =>
                a.localeCompare(b)
              )
            : []
        );
      } catch {
        setTaxonomyOptions([]);
        setMaterialOptions([]);
        setAllCountries([]);
      }
    };
    void loadTaxonomy();
  }, [kind]);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        if (kind === 'READY') {
          const response = await api.products.getReadyToWear({
            search: appliedFilters.search || undefined,
            country: appliedFilters.country || undefined,
            categoryId: selectedTaxonomyId || undefined,
            size: appliedFilters.size || undefined,
            color: appliedFilters.color || undefined,
            material: selectedMaterialName || undefined,
            materialTypeId: selectedMaterialId || undefined,
            page: appliedFilters.page,
            limit: settings.pageSize,
          });
          if (!response.success) throw new Error('Unable to load products');
          const rows = Array.isArray(response.data?.products) ? response.data.products : [];
          setProducts(
            rows.map((row: any) => {
              const variationPrices = (Array.isArray(row?.sizeVariations) ? row.sizeVariations : [])
                .map((entry: any) => Number(entry?.price || 0))
                .filter((value: number) => Number.isFinite(value) && value > 0);
              const priceUsd = variationPrices.length > 0 ? Math.min(...variationPrices) : Number(row?.basePrice || 0);
              return {
                id: asString(row?.id, ''),
                name: asString(row?.name, 'Ready To Wear'),
                ownerName: asString(row?.designer?.businessName, 'Designer'),
                country: asString(row?.designer?.country, ''),
                image: asString(row?.images?.[0]?.url, '/placeholder.jpg'),
                priceUsd,
                href: `${routeBase}/${asString(row?.id, '')}`,
                labels: Array.isArray(row?.productLabels) ? row.productLabels.map(normalizeProductLabel) : [],
              } satisfies ProductCard;
            })
          );
          setPagination(response.data?.pagination || null);
          return;
        }

        if (kind === 'CUSTOM') {
          const response = await api.products.getDesigns({
            search: appliedFilters.search || undefined,
            country: appliedFilters.country || undefined,
            categoryId: selectedTaxonomyId || undefined,
            size: appliedFilters.size || undefined,
            color: appliedFilters.color || undefined,
            materialTypeId: selectedMaterialId || undefined,
            page: appliedFilters.page,
            limit: settings.pageSize,
          });
          if (!response.success) throw new Error('Unable to load products');
          const rows = Array.isArray(response.data?.designs) ? response.data.designs : [];
          setProducts(
            rows.map((row: any) => ({
              id: asString(row?.id, ''),
              name: asString(row?.name, 'Custom To Wear'),
              ownerName: asString(row?.designer?.businessName, 'Designer'),
              country: asString(row?.designer?.country, ''),
              image: asString(row?.images?.[0]?.url, '/placeholder.jpg'),
              priceUsd: Number(row?.finalPrice || row?.basePrice || 0),
              href: `${routeBase}/${asString(row?.id, '')}`,
              labels: Array.isArray(row?.productLabels) ? row.productLabels.map(normalizeProductLabel) : [],
            }))
          );
          setPagination(response.data?.pagination || null);
          return;
        }

        const response = await api.products.getFabrics({
          search: appliedFilters.search || undefined,
          country: appliedFilters.country || undefined,
          fabricCategoryId: selectedTaxonomyId || undefined,
          color: appliedFilters.color || undefined,
          page: appliedFilters.page,
          limit: settings.pageSize,
        });
        if (!response.success) throw new Error('Unable to load products');
        const rows = Array.isArray(response.data?.fabrics) ? response.data.fabrics : [];
        setProducts(
          rows.map((row: any) => ({
            id: asString(row?.id, ''),
            name: asString(row?.name, 'Fabric'),
            ownerName: asString(row?.seller?.businessName, 'Seller'),
            country: asString(row?.seller?.country, ''),
            image: asString(row?.images?.[0]?.url, '/placeholder.jpg'),
            priceUsd: Number(row?.pricePerMeter || row?.finalPrice || row?.sellerPrice || 0),
            href: `${routeBase}/${asString(row?.id, '')}`,
            labels: Array.isArray(row?.productLabels) ? row.productLabels.map(normalizeProductLabel) : [],
          }))
        );
        setPagination(response.data?.pagination || null);
      } catch {
        setProducts([]);
        setPagination(null);
        setError(`Unable to load ${pageLabel.toLowerCase()} products.`);
      } finally {
        setLoading(false);
      }
    };
    void loadProducts();
  }, [
    appliedFilters.color,
    appliedFilters.country,
    appliedFilters.page,
    appliedFilters.search,
    appliedFilters.size,
    kind,
    pageLabel,
    routeBase,
    selectedMaterialId,
    selectedMaterialName,
    selectedTaxonomyId,
    settings.pageSize,
  ]);

  const updateUrl = (next: FilterState) => {
    const params = new URLSearchParams();
    if (next.search.trim()) params.set('search', next.search.trim());
    if (next.country.trim()) params.set('country', next.country.trim());
    if (next.taxonomy.trim()) params.set('taxonomy', next.taxonomy.trim());
    if (next.material.trim()) params.set('material', next.material.trim());
    if (next.size.trim()) params.set('size', next.size.trim());
    if (next.color.trim()) params.set('color', next.color.trim());
    if (next.page > 1) params.set('page', String(next.page));
    setSearchParams(params);
  };

  const updateFilter = (key: keyof FilterState, value: string | number) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? Number(value) : 1,
    }));
  };

  const applyFilters = (next: FilterState) => {
    setAppliedFilters(next);
    setFilters(next);
    updateUrl(next);
  };

  const handleSearch = () => applyFilters({ ...filters, page: 1 });
  const handlePageChange = (page: number) => {
    const next = { ...appliedFilters, page };
    setAppliedFilters(next);
    setFilters(next);
    updateUrl(next);
  };

  return (
    <div className="kimi-site min-h-screen bg-[#f3f1ec] text-[#111]">
      <section
        className="relative overflow-hidden border-b border-black/10"
        style={{ height: `${Math.max(260, Math.min(620, Number(settings.bannerHeight || 360)))}px` }}
      >
        <img src={settings.bannerImage || defaultBanner} alt={settings.bannerTitle} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/25" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-[1700px] px-4 sm:px-6 lg:px-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Kimi Category Build</p>
            <h1 className="mt-3 max-w-2xl font-['Oswald'] text-4xl font-bold uppercase leading-[0.95] text-white sm:text-5xl lg:text-6xl">
              {settings.bannerTitle || pageLabel}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
              {settings.bannerSubtitle || defaultSubtitle}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1700px] space-y-8 px-4 py-8 sm:px-6 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/55">
            Home / {pageLabel} / {pagination?.total ?? products.length} products
          </p>
        </div>

        <div className="rounded border border-black/10 bg-white p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-8">
            <label className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
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
                placeholder={`Search ${pageLabel}...`}
                className="h-10 w-full border border-black/15 bg-white pl-9 pr-3 text-sm outline-none focus:border-black/40"
              />
            </label>

            <select
              value={filters.country}
              onChange={(event) => updateFilter('country', event.target.value)}
              className="h-10 border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40"
            >
              <option value="">Country (All)</option>
              {countryOptions.map((country) => (
                <option key={`country-${country}`} value={country}>
                  {country}
                </option>
              ))}
            </select>

            <select
              value={filters.taxonomy}
              onChange={(event) => updateFilter('taxonomy', event.target.value)}
              className="h-10 border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40"
            >
              <option value="">{taxonomyLabel} (All)</option>
              {taxonomyOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>

            {showMaterialFilter ? (
              <select
                value={filters.material}
                onChange={(event) => updateFilter('material', event.target.value)}
                className="h-10 border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40"
              >
                <option value="">Material (All)</option>
                {materialOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            ) : null}

            {showSizeFilter ? (
              <select
                value={filters.size}
                onChange={(event) => updateFilter('size', event.target.value)}
                className="h-10 border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40"
              >
                <option value="">Size (All)</option>
                {COMMON_SIZE_OPTIONS.map((entry) => (
                  <option key={`size-${entry}`} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            ) : null}

            <select
              value={filters.color}
              onChange={(event) => updateFilter('color', event.target.value)}
              className="h-10 border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40"
            >
              <option value="">Color (All)</option>
              {COMMON_COLOR_OPTIONS.map((entry) => (
                <option key={`color-${entry}`} value={entry}>
                  {entry}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSearch}
                className="h-10 flex-1 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#1b1b1b]"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() =>
                  applyFilters({
                    search: '',
                    country: '',
                    taxonomy: '',
                    material: '',
                    size: '',
                    color: '',
                    page: 1,
                  })
                }
                className="h-10 flex-1 border border-black/20 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 hover:border-black/50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {rotatingProducts.length > 0 ? (
          <section className="rounded border border-black/15 bg-[#090b10] p-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-['Oswald'] text-3xl font-bold uppercase">Curated Picks</h2>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                {settings.rotatingColumns} x {settings.rotatingRows} rotating grid
              </p>
            </div>
            <div className={`${rotatingGridClass} mt-5`}>
              {rotatingProducts.map((product) => {
                const titlePreset = resolveRotatingTitlePresentation(
                  settings.designPreset,
                  Number(settings.rotatingTitleSize || DEFAULT_SETTINGS.rotatingTitleSize)
                );
                const flagCode = resolveCountryCode(product.country || '');
                return (
                  <Link key={`rotating-${product.id}`} to={product.href} className="group overflow-hidden border border-white/10 bg-white/5">
                    <div className="relative" style={{ aspectRatio: '3/4' }}>
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h3 className={titlePreset.titleClassName} style={{ fontSize: `${titlePreset.fontSize}px` }}>
                          {product.name}
                        </h3>
                        <p className="mt-1 text-xs text-white/80">{product.ownerName}</p>
                        <p className={titlePreset.priceClassName}>{formatFromUsd(product.priceUsd)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {featuredProducts.length > 0 ? (
          <section className="space-y-4">
            <h2 className="font-['Oswald'] text-3xl font-bold uppercase">Featured {pageLabel}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {featuredProducts.map((product) => (
                <Link key={`featured-${product.id}`} to={product.href} className="group overflow-hidden border border-black/15 bg-white">
                  <div className="relative" style={{ aspectRatio: '3/4' }}>
                    <img
                      src={product.image || '/placeholder.jpg'}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-1 text-lg font-semibold">{product.name}</p>
                    <p className="text-xs text-black/55">{product.ownerName}</p>
                    <p className="mt-2 text-base font-semibold">{formatFromUsd(product.priceUsd)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-black" />
          </div>
        ) : error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : products.length === 0 ? (
          <div className="border bg-white px-4 py-14 text-center text-sm text-black/65">
            No {pageLabel.toLowerCase()} products found for this filter.
          </div>
        ) : (
          <>
            <div className={productGridClass}>
              {products.map((product) => {
                const flagCode = resolveCountryCode(product.country || '');
                return (
                  <Link key={product.id} to={product.href} className="group overflow-hidden border border-black/15 bg-white">
                    <div className="relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                      <img
                        src={product.image || '/placeholder.jpg'}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {product.labels.length > 0 ? (
                        <div className="absolute right-2 top-2 z-10 flex flex-wrap justify-end gap-1">
                          {product.labels.slice(0, 2).map((label) => (
                            <span
                              key={`${product.id}-label-${label.id}`}
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
                          alt={`${product.country || 'Country'} flag`}
                          className="absolute left-2 top-2 h-5 w-8 rounded-sm object-cover shadow"
                        />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-sm font-semibold text-black">{product.name}</p>
                      <p className="line-clamp-1 text-xs text-black/55">{product.ownerName}</p>
                      <p className="mt-2 text-base font-semibold">{formatFromUsd(product.priceUsd)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {settings.showPagination && pagination && pagination.pages > 1 ? (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, appliedFilters.page - 1))}
                  disabled={appliedFilters.page <= 1}
                  className="inline-flex h-9 w-9 items-center justify-center border border-black/20 bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
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
                      className={`h-9 min-w-9 border px-2 text-sm ${
                        appliedFilters.page === pageNumber
                          ? 'border-black bg-black text-white'
                          : 'border-black/20 bg-white text-black/75'
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
                  className="inline-flex h-9 w-9 items-center justify-center border border-black/20 bg-white disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
