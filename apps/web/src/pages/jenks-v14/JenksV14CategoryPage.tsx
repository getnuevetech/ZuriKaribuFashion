import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Home, Loader2 } from 'lucide-react';
import '../../styles/jenks-v2.css';
import { api } from '../../services/api';
import { useCurrencyStore } from '../../store/currencyStore';
import { AFRICAN_COUNTRIES } from '../../data/africanCountries';

type CategoryMode = 'FABRICS' | 'READY' | 'CUSTOM';
type CategoryPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';

type JenksV14CategoryPageProps = {
  mode: CategoryMode;
  routeBase: '/fabricstobuy' | '/readytowear' | '/cystomtowear';
};

type TaxonomyOption = {
  id: string;
  name: string;
};

type Label = {
  id: string;
  name: string;
  textColor?: string;
  backgroundColor?: string;
};

type ProductCard = {
  id: string;
  name: string;
  ownerName: string;
  country: string;
  image: string;
  priceUsd: number;
  href: string;
  labels: Label[];
  taxonomyId?: string;
  style?: string;
  fabricType?: string;
  material?: string;
  color?: string;
  isNew?: boolean;
};

type CategoryFilterDefinition = {
  id: string;
  key: 'STYLE' | 'FABRIC_TYPE' | 'MATERIAL' | 'COUNTRY' | 'PRICE' | 'COLOR' | 'CATEGORY';
  label: string;
  inputType: 'DROPDOWN' | 'SUGGESTIVE_SEARCH';
  enabled: boolean;
  options: string[];
  displayOrder: number;
};

type CategoryPageSettings = {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  bannerHeight: number;
  columns: number;
  primaryGridRows: number;
  primaryGridColumns: number;
  primaryGridProductIds: string[];
  filterDefinitions: CategoryFilterDefinition[];
};

const FALLBACK_FILTERS_BY_MODE: Record<CategoryMode, string[]> = {
  FABRICS: ['Ankara', 'Kente', 'Adire', 'Mud Cloth', 'Silk', 'Cotton', 'Kanga', 'Raffia', 'Shweshwe', 'Toghu'],
  READY: ['Dresses', 'Kaftan', 'Agbada', 'Skirt Sets', 'Shirts', 'Jackets', 'Occasion', 'Casual'],
  CUSTOM: ['Bridal', 'Traditional', 'Modern', 'Menswear', 'Womenswear', 'Luxury', 'Event', 'Bespoke'],
};

const asText = (value: unknown, fallback = '') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const toNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const sortByName = (rows: TaxonomyOption[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));
const ASSET_BASE = 'https://african-fashion-zurikaribu.vercel.app';

const CATEGORY_HERO_BY_MODE: Record<
  CategoryMode,
  {
    image: string;
    subtitle: string;
    breadcrumb: string;
  }
> = {
  READY: {
    image: `${ASSET_BASE}/rw_full.jpg`,
    subtitle: 'Curated ready-to-wear edits inspired by African craftsmanship and modern silhouettes.',
    breadcrumb: 'Ready To Wear',
  },
  CUSTOM: {
    image: `${ASSET_BASE}/custom_full.jpg`,
    subtitle: 'Design your bespoke look with premium materials, expert tailors, and timeless style.',
    breadcrumb: 'Custom To Wear',
  },
  FABRICS: {
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    subtitle: 'Source high-quality fabrics from trusted artisan houses across Africa.',
    breadcrumb: 'Fabrics To Buy',
  },
};

const defaultFilterDefinitionsByMode = (mode: CategoryMode): CategoryFilterDefinition[] => {
  if (mode === 'READY') {
    return [
      { id: 'style', key: 'STYLE', label: 'Style', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
      { id: 'fabric-type', key: 'FABRIC_TYPE', label: 'Fabric Type', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 2 },
      { id: 'material', key: 'MATERIAL', label: 'Material', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 3 },
      { id: 'country', key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 4 },
      { id: 'price', key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 5 },
    ];
  }
  if (mode === 'CUSTOM') {
    return [
      { id: 'style', key: 'STYLE', label: 'Style', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
      { id: 'country', key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
      { id: 'price', key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 3 },
    ];
  }
  return [
    { id: 'color', key: 'COLOR', label: 'Color', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 1 },
    { id: 'fabric-type', key: 'FABRIC_TYPE', label: 'Fabric Type', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
    { id: 'material', key: 'MATERIAL', label: 'Material', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 3 },
    { id: 'price', key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 4 },
    { id: 'country', key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 5 },
  ];
};

const normalizeSettings = (mode: CategoryMode, input: any): CategoryPageSettings => {
  const fallback = defaultFilterDefinitionsByMode(mode);
  const filters = Array.isArray(input?.filterDefinitions) ? input.filterDefinitions : fallback;
  return {
    bannerTitle: asText(input?.bannerTitle, mode === 'FABRICS' ? 'Fabrics To Buy' : mode === 'READY' ? 'Ready To Wear' : 'Custom To Wear'),
    bannerSubtitle: asText(input?.bannerSubtitle, ''),
    bannerImage: asText(input?.bannerImage, ''),
    bannerHeight: Math.max(220, Math.min(560, Math.round(toNumber(input?.bannerHeight, 420)))),
    columns: Math.max(1, Math.min(6, Math.round(toNumber(input?.columns, 4)))),
    primaryGridRows: Math.max(1, Math.min(2, Math.round(toNumber(input?.primaryGridRows, 2)))),
    primaryGridColumns: Math.max(1, Math.min(6, Math.round(toNumber(input?.primaryGridColumns, 3)))),
    primaryGridProductIds: Array.isArray(input?.primaryGridProductIds)
      ? Array.from(new Set(input.primaryGridProductIds.map((entry: any) => asText(entry, '')).filter(Boolean))).slice(0, 24)
      : [],
    filterDefinitions: filters
      .map((entry: any, index: number) => ({
        id: asText(entry?.id, `${index + 1}`),
        key: String(entry?.key || fallback[index]?.key || 'STYLE').trim().toUpperCase() as CategoryFilterDefinition['key'],
        label: asText(entry?.label, fallback[index]?.label || 'Filter'),
        inputType: String(entry?.inputType || fallback[index]?.inputType || 'DROPDOWN').trim().toUpperCase() === 'SUGGESTIVE_SEARCH'
          ? 'SUGGESTIVE_SEARCH'
          : 'DROPDOWN',
        enabled: entry?.enabled !== false,
        options: Array.isArray(entry?.options)
          ? entry.options.map((token: any) => asText(token, '')).filter(Boolean).slice(0, 40)
          : [],
        displayOrder: Math.max(0, Math.min(999, Math.round(toNumber(entry?.displayOrder, index + 1)))),
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, 20),
  };
};

const PRICE_BUCKETS = ['Under $50', '$50 - $100', '$100 - $250', '$250+'] as const;

const normalizeToken = (value: unknown) => String(value || '').trim().toLowerCase();

const priceBucketFor = (value: number) => {
  const price = Number(value || 0);
  if (price < 50) return 'Under $50';
  if (price <= 100) return '$50 - $100';
  if (price <= 250) return '$100 - $250';
  return '$250+';
};

const matchesBucket = (price: number, bucket: string) => priceBucketFor(price).toLowerCase() === normalizeToken(bucket);

export default function JenksV14CategoryPage({ mode, routeBase }: JenksV14CategoryPageProps) {
  const { formatFromUsd } = useCurrencyStore();

  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedTaxonomyId, setSelectedTaxonomyId] = useState('');
  const [taxonomySearch, setTaxonomySearch] = useState('');
  const [taxonomyOptions, setTaxonomyOptions] = useState<TaxonomyOption[]>([]);
  const [taxonomyLoadedFromApi, setTaxonomyLoadedFromApi] = useState(true);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<CategoryPageSettings | null>(null);
  const [extraFilterValues, setExtraFilterValues] = useState<Record<string, string>>({});

  const pageType: CategoryPageType = mode === 'FABRICS' ? 'FABRIC_TO_BUY' : mode === 'CUSTOM' ? 'CUSTOM_TO_WEAR' : 'READY_TO_WEAR';

  const countryOptions = useMemo(
    () =>
      [...AFRICAN_COUNTRIES]
        .map((entry) => ({
          code: String(entry.code || '').trim().toUpperCase(),
          name: String(entry.name || '').trim(),
        }))
        .filter((entry) => Boolean(entry.code && entry.name))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const activeFilterDefinitions = useMemo(
    () => (settings?.filterDefinitions || defaultFilterDefinitionsByMode(mode)).filter((entry) => entry.enabled),
    [mode, settings?.filterDefinitions]
  );
  const countryFilterMeta = useMemo(
    () => activeFilterDefinitions.find((entry) => entry.key === 'COUNTRY'),
    [activeFilterDefinitions]
  );
  const taxonomyFilterMeta = useMemo(
    () =>
      activeFilterDefinitions.find((entry) =>
        mode === 'FABRICS'
          ? entry.key === 'FABRIC_TYPE' || entry.key === 'MATERIAL'
          : entry.key === 'STYLE' || entry.key === 'CATEGORY'
      ),
    [activeFilterDefinitions, mode]
  );
  const extraFilterDefinitions = useMemo(
    () =>
      activeFilterDefinitions.filter((entry) => {
        if (!taxonomyFilterMeta) return true;
        return entry.key !== taxonomyFilterMeta.key;
      }),
    [activeFilterDefinitions, taxonomyFilterMeta]
  );
  const taxonomyLabel = taxonomyFilterMeta?.label || (mode === 'FABRICS' ? 'MATERIAL' : mode === 'READY' ? 'STYLE' : 'STYLE');
  const sectionTitle = settings?.bannerTitle || (mode === 'FABRICS' ? 'Fabrics To Buy' : mode === 'READY' ? 'Ready To Wear' : 'Custom To Wear');
  const countLabel = mode === 'FABRICS' ? 'fabrics' : 'products';
  const heroConfig = CATEGORY_HERO_BY_MODE[mode];
  const heroImage = asText(settings?.bannerImage, asText(products[0]?.image, heroConfig.image));
  const heroSubtitle = asText(settings?.bannerSubtitle, heroConfig.subtitle);
  const heroHeight = Math.max(320, Math.min(560, settings?.bannerHeight || 420));

  const filterOptionsByKey = useMemo(() => {
    const buildUnique = (values: Array<string | undefined>) =>
      Array.from(new Set(values.map((entry) => asText(entry, '')).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const taxonomyNames = buildUnique(products.map((entry) => entry.style));
    const fabricTypes = buildUnique(products.map((entry) => entry.fabricType));
    const materials = buildUnique(products.map((entry) => entry.material));
    const colors = buildUnique(products.map((entry) => entry.color));
    return {
      STYLE: taxonomyNames,
      CATEGORY: taxonomyNames,
      FABRIC_TYPE: fabricTypes,
      MATERIAL: materials,
      COUNTRY: countryOptions.map((entry) => entry.name),
      PRICE: [...PRICE_BUCKETS],
      COLOR: colors,
    } as const;
  }, [countryOptions, products]);

  const primaryGridLimit = Math.max(1, Math.min(24, (settings?.primaryGridRows || 2) * (settings?.primaryGridColumns || 3)));
  const filteredProducts = useMemo(() => {
    const activeTaxonomyName = asText(taxonomyOptions.find((entry) => entry.id === selectedTaxonomyId)?.name, '');
    return products.filter((product) => {
      for (const filter of extraFilterDefinitions) {
        const selected = normalizeToken(extraFilterValues[filter.key]);
        if (!selected) continue;
        if (filter.key === 'PRICE') {
          if (!matchesBucket(product.priceUsd, selected)) return false;
          continue;
        }
        const value =
          filter.key === 'STYLE' || filter.key === 'CATEGORY'
            ? normalizeToken(product.style)
            : filter.key === 'FABRIC_TYPE'
              ? normalizeToken(product.fabricType)
              : filter.key === 'MATERIAL'
                ? normalizeToken(product.material)
                : filter.key === 'COLOR'
                  ? normalizeToken(product.color)
                  : filter.key === 'COUNTRY'
                    ? normalizeToken(product.country)
                    : '';
        if (!value) return false;
        if (filter.inputType === 'DROPDOWN') {
          if (value !== selected) return false;
        } else if (!value.includes(selected)) {
          return false;
        }
      }
      if (selectedTaxonomyId && activeTaxonomyName) {
        const styleToken = normalizeToken(product.style || product.fabricType || product.material);
        const taxonomyToken = normalizeToken(activeTaxonomyName);
        if (!styleToken.includes(taxonomyToken) && normalizeToken(product.taxonomyId) !== normalizeToken(selectedTaxonomyId)) {
          return false;
        }
      }
      return true;
    });
  }, [extraFilterDefinitions, extraFilterValues, products, selectedTaxonomyId, taxonomyOptions]);
  const configuredPrimaryCards = useMemo(() => {
    if (!settings?.primaryGridProductIds?.length) return [] as ProductCard[];
    const byId = new Map(filteredProducts.map((entry) => [entry.id, entry] as const));
    return settings.primaryGridProductIds.map((id) => byId.get(id)).filter((entry): entry is ProductCard => Boolean(entry)).slice(0, primaryGridLimit);
  }, [filteredProducts, primaryGridLimit, settings?.primaryGridProductIds]);
  const cardsToDisplay = configuredPrimaryCards.length > 0 ? configuredPrimaryCards : filteredProducts.slice(0, primaryGridLimit);
  const gridColumnsClass = useMemo(() => {
    const cols = Math.max(1, Math.min(6, settings?.primaryGridColumns || settings?.columns || 4));
    if (cols === 1) return 'lg:grid-cols-1';
    if (cols === 2) return 'lg:grid-cols-2';
    if (cols === 3) return 'lg:grid-cols-3';
    if (cols === 4) return 'lg:grid-cols-4';
    if (cols === 5) return 'lg:grid-cols-5';
    return 'lg:grid-cols-6';
  }, [settings?.columns, settings?.primaryGridColumns]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        const response = await api.products.getCategoryPageSettings(pageType);
        if (!mounted) return;
        if (response.success && response.data?.settings) {
          setSettings(normalizeSettings(mode, response.data.settings));
        } else {
          setSettings(normalizeSettings(mode, null));
        }
      } catch {
        if (mounted) setSettings(normalizeSettings(mode, null));
      }
    };
    void loadSettings();
    return () => {
      mounted = false;
    };
  }, [mode, pageType]);

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        if (mode === 'FABRICS') {
          const response = await api.products.getFabricCategories();
          if (response.success && Array.isArray(response.data) && response.data.length > 0) {
            setTaxonomyOptions(
              sortByName(
                response.data.map((entry: any) => ({
                  id: asText(entry?.id, ''),
                  name: asText(entry?.name, ''),
                }))
              )
            );
            setTaxonomyLoadedFromApi(true);
            return;
          }
        } else {
          const response = await api.products.getCategories();
          if (response.success && Array.isArray(response.data) && response.data.length > 0) {
            setTaxonomyOptions(
              sortByName(
                response.data.map((entry: any) => ({
                  id: asText(entry?.id, ''),
                  name: asText(entry?.name, ''),
                }))
              )
            );
            setTaxonomyLoadedFromApi(true);
            return;
          }
        }
      } catch {
        // fallback below
      }
      const fallbackNames = FALLBACK_FILTERS_BY_MODE[mode];
      setTaxonomyOptions(fallbackNames.map((name) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name })));
      setTaxonomyLoadedFromApi(false);
    };
    setSelectedTaxonomyId('');
    setTaxonomySearch('');
    void loadTaxonomy();
  }, [mode]);

  useEffect(() => {
    setExtraFilterValues({});
  }, [mode, settings?.filterDefinitions]);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError('');
      try {
        const fallbackTaxonomyToken =
          !taxonomyLoadedFromApi && selectedTaxonomyId
            ? String(taxonomyOptions.find((entry) => entry.id === selectedTaxonomyId)?.name || selectedTaxonomyId || '')
                .trim()
                .toLowerCase()
            : '';
        const maxRows = Math.max(32, Math.min(120, (settings?.pageSize || 24) + 24));

        if (mode === 'FABRICS') {
          const response = await api.products.getFabrics({
            country: selectedCountry || undefined,
            fabricCategoryId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
            materialTypeId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
            search: taxonomyLoadedFromApi ? undefined : fallbackTaxonomyToken || undefined,
            page: 1,
            limit: maxRows,
          });
          if (!response.success) throw new Error('Unable to load fabrics.');
          const sourceRows = Array.isArray(response.data?.fabrics) ? response.data.fabrics : [];
          const rows = fallbackTaxonomyToken
            ? sourceRows.filter((row: any) => {
                const haystack = [row?.name, row?.description, row?.fabricCategory?.name, row?.materialType?.name]
                  .map((entry) => asText(entry, '').toLowerCase())
                  .join(' ');
                return haystack.includes(fallbackTaxonomyToken);
              })
            : sourceRows;
          setProducts(
            rows.map((row: any) => ({
              id: asText(row?.id, ''),
              name: asText(row?.name, 'Fabric'),
              ownerName: asText(row?.seller?.businessName, 'Seller'),
              country: asText(row?.seller?.country, ''),
              image: asText(row?.images?.[0]?.url, '/images/placeholder.jpg'),
              priceUsd: toNumber(row?.pricePerMeter, row?.finalPrice, row?.sellerPrice, 0),
              href: `${routeBase}/${asText(row?.id, '')}`,
              labels: Array.isArray(row?.productLabels) ? row.productLabels : [],
              taxonomyId: asText(row?.fabricCategoryId, ''),
              style: asText(row?.fabricCategory?.name, asText(row?.fabricCategoryName, '')),
              fabricType: asText(row?.fabricCategory?.name, asText(row?.fabricCategoryName, '')),
              material: asText(row?.materialType?.name, asText(row?.materialTypeName, '')),
              color: asText(row?.predominantColor, asText(row?.color, '')),
              isNew: true,
            }))
          );
          return;
        }

        if (mode === 'READY') {
          const response = await api.products.getReadyToWear({
            country: selectedCountry || undefined,
            categoryId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
            materialTypeId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
            search: taxonomyLoadedFromApi ? undefined : fallbackTaxonomyToken || undefined,
            page: 1,
            limit: maxRows,
          });
          if (!response.success) throw new Error('Unable to load ready-to-wear products.');
          const sourceRows = Array.isArray(response.data?.products) ? response.data.products : [];
          const rows = fallbackTaxonomyToken
            ? sourceRows.filter((row: any) => {
                const haystack = [row?.name, row?.description, row?.category?.name, row?.materialType?.name]
                  .map((entry) => asText(entry, '').toLowerCase())
                  .join(' ');
                return haystack.includes(fallbackTaxonomyToken);
              })
            : sourceRows;
          setProducts(
            rows.map((row: any) => {
              const variationPrices = (Array.isArray(row?.sizeVariations) ? row.sizeVariations : [])
                .map((entry: any) => toNumber(entry?.price, 0))
                .filter((value: number) => value > 0);
              const price = variationPrices.length > 0 ? Math.min(...variationPrices) : toNumber(row?.basePrice, row?.finalPrice, 0);
              return {
                id: asText(row?.id, ''),
                name: asText(row?.name, 'Ready To Wear'),
                ownerName: asText(row?.designer?.businessName, 'Designer'),
                country: asText(row?.designer?.country, ''),
                image: asText(row?.images?.[0]?.url, '/images/placeholder.jpg'),
                priceUsd: price,
                href: `${routeBase}/${asText(row?.id, '')}`,
                labels: Array.isArray(row?.productLabels) ? row.productLabels : [],
                taxonomyId: asText(row?.categoryId, ''),
                style: asText(row?.category?.name, asText(row?.categoryName, '')),
                fabricType: asText(row?.fabricCategory?.name, asText(row?.fabricCategoryName, '')),
                material: asText(row?.materialType?.name, asText(row?.materialTypeName, '')),
                color: asText(row?.color, ''),
                isNew: true,
              } satisfies ProductCard;
            })
          );
          return;
        }

        const response = await api.products.getDesigns({
          country: selectedCountry || undefined,
          categoryId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
          materialTypeId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
          search: taxonomyLoadedFromApi ? undefined : fallbackTaxonomyToken || undefined,
          page: 1,
          limit: maxRows,
        });
        if (!response.success) throw new Error('Unable to load custom products.');
        const sourceRows = Array.isArray(response.data?.designs) ? response.data.designs : [];
        const rows = fallbackTaxonomyToken
          ? sourceRows.filter((row: any) => {
              const haystack = [row?.name, row?.description, row?.category?.name, row?.materialType?.name]
                .map((entry) => asText(entry, '').toLowerCase())
                .join(' ');
              return haystack.includes(fallbackTaxonomyToken);
            })
          : sourceRows;
        setProducts(
          rows.map((row: any) => ({
            id: asText(row?.id, ''),
            name: asText(row?.name, 'Custom To Wear'),
            ownerName: asText(row?.designer?.businessName, 'Designer'),
            country: asText(row?.designer?.country, ''),
            image: asText(row?.images?.[0]?.url, '/images/placeholder.jpg'),
            priceUsd: toNumber(row?.finalPrice, row?.basePrice, 0),
            href: `${routeBase}/${asText(row?.id, '')}`,
            labels: Array.isArray(row?.productLabels) ? row.productLabels : [],
            taxonomyId: asText(row?.categoryId, ''),
            style: asText(row?.category?.name, asText(row?.categoryName, '')),
            fabricType: asText(row?.fabricCategory?.name, asText(row?.fabricCategoryName, '')),
            material: asText(row?.materialType?.name, asText(row?.materialTypeName, '')),
            color: asText(row?.color, ''),
            isNew: true,
          }))
        );
      } catch (loadError) {
        setProducts([]);
        setError(String((loadError as Error)?.message || 'Unable to load products.'));
      } finally {
        setLoading(false);
      }
    };
    void loadProducts();
  }, [mode, routeBase, selectedCountry, selectedTaxonomyId, settings?.pageSize, taxonomyLoadedFromApi, taxonomyOptions]);

  const filteredTaxonomyOptions = useMemo(() => {
    const query = taxonomySearch.trim().toLowerCase();
    if (!query) return taxonomyOptions;
    return taxonomyOptions.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [taxonomyOptions, taxonomySearch]);

  return (
    <div className="min-h-screen bg-[#F8F6F1] text-[#1A1A1A]">
      <section className="relative overflow-hidden" style={{ minHeight: `${heroHeight}px` }}>
        <img src={heroImage} alt={sectionTitle} className="h-full w-full object-cover" style={{ minHeight: `${heroHeight}px` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-[#F8F6F1]/95" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-6 lg:px-10">
            <nav className="mb-4 flex items-center gap-2 text-sm text-white/85">
              <Link to="/" className="inline-flex items-center gap-1 text-white/80 transition hover:text-white">
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>
              <ChevronRight className="h-4 w-4 text-white/65" />
              <span className="text-white">{heroConfig.breadcrumb}</span>
            </nav>
            <h1 className="headline-lg text-[clamp(2rem,5vw,5rem)] text-white">{sectionTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">{heroSubtitle}</p>
          </div>
        </div>
      </section>

      <div className="border-b border-[#1A1A1A]/10 bg-[#F8F6F1]/95">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="headline-lg mt-2 text-[clamp(2rem,4vw,4.5rem)]">{sectionTitle}</h1>
            </div>
            <p className="text-xs uppercase tracking-[0.12em] text-[#6B6B6B]">
              {cardsToDisplay.length} {countLabel}
            </p>
          </div>
          <div className="mt-4 space-y-4">
            {taxonomyFilterMeta ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="label-mono text-[#6B6B6B]">{taxonomyLabel.toUpperCase()}</p>
                  {taxonomyFilterMeta.inputType === 'SUGGESTIVE_SEARCH' ? (
                    <input
                      value={taxonomySearch}
                      onChange={(event) => setTaxonomySearch(event.target.value)}
                      placeholder={`Search ${taxonomyLabel.toLowerCase()}...`}
                      className="w-full max-w-[260px] rounded border border-[#1A1A1A]/15 bg-white px-2.5 py-1.5 text-xs"
                    />
                  ) : null}
                </div>
                {taxonomyFilterMeta.inputType === 'DROPDOWN' ? (
                  <select
                    className="w-full max-w-[340px] rounded border border-[#1A1A1A]/15 bg-white px-3 py-2 text-sm"
                    value={selectedTaxonomyId}
                    onChange={(event) => setSelectedTaxonomyId(event.target.value)}
                  >
                    <option value="">All {taxonomyLabel}</option>
                    {filteredTaxonomyOptions.map((option) => (
                      <option key={`taxonomy-option-${option.id}`} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filteredTaxonomyOptions.slice(0, 16).map((option) => {
                      const active = selectedTaxonomyId === option.id;
                      return (
                        <button
                          key={`taxonomy-filter-${option.id}`}
                          type="button"
                          onClick={() => setSelectedTaxonomyId((previous) => (previous === option.id ? '' : option.id))}
                          className={`border px-3 py-1.5 text-sm transition ${
                            active
                              ? 'border-[#E85A3C] bg-[#E85A3C] text-white'
                              : 'border-[#1A1A1A]/14 bg-white text-[#1A1A1A] hover:border-[#E85A3C]/40'
                          }`}
                        >
                          {option.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {extraFilterDefinitions.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {extraFilterDefinitions.map((filter) => {
                const selected = extraFilterValues[filter.key] || '';
                const options =
                  filter.options && filter.options.length > 0
                    ? filter.options
                    : filterOptionsByKey[filter.key as keyof typeof filterOptionsByKey] || [];
                const datalistId = `filter-suggest-${mode}-${filter.key}`;
                return (
                  <label key={`extra-filter-${filter.id}-${filter.key}`} className="text-xs space-y-1">
                    <span className="text-gray-700">{filter.label}</span>
                    {filter.inputType === 'DROPDOWN' ? (
                      <select
                        className="w-full rounded border border-[#1A1A1A]/15 bg-white px-2.5 py-2 text-sm"
                        value={selected}
                        onChange={(event) =>
                          setExtraFilterValues((prev) => ({ ...prev, [filter.key]: event.target.value }))
                        }
                      >
                        <option value="">All</option>
                        {options.map((option) => (
                          <option key={`option-${filter.key}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <input
                          list={datalistId}
                          value={selected}
                          onChange={(event) =>
                            setExtraFilterValues((prev) => ({ ...prev, [filter.key]: event.target.value }))
                          }
                          placeholder={`Search ${filter.label.toLowerCase()}...`}
                          className="w-full rounded border border-[#1A1A1A]/15 bg-white px-2.5 py-2 text-sm"
                        />
                        <datalist id={datalistId}>
                          {options.map((option) => (
                            <option key={`suggest-${filter.key}-${option}`} value={option} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </label>
                );
              })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-9 w-9 animate-spin text-[#1A1A1A]" />
          </div>
        ) : error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : cardsToDisplay.length === 0 ? (
          <div className="border border-[#d8d4cb] bg-white px-4 py-12 text-center text-sm text-[#6f6a60]">
            No products found for the selected filters.
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${gridColumnsClass}`}>
            {cardsToDisplay.map((product) => {
              return (
                <Link key={product.id} to={product.href} className="product-card group bg-white">
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#ece8df]">
                    <img
                      src={product.image || '/images/placeholder.jpg'}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {product.material ? (
                      <div className="absolute bottom-3 left-3">
                        <span className="bg-white/90 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[#1A1A1A]">
                          {product.material}
                        </span>
                      </div>
                    ) : null}
                    {product.labels.length > 0 ? (
                      <span
                        className="absolute right-3 top-3 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                        style={{
                          color: asText(product.labels[0]?.textColor, '#ffffff'),
                          backgroundColor: asText(product.labels[0]?.backgroundColor, '#E85A3C'),
                        }}
                      >
                        {product.labels[0].name}
                      </span>
                    ) : product.isNew ? (
                      <span className="label-mono absolute right-3 top-3 bg-[#E85A3C] px-2.5 py-1 text-white">NEW</span>
                    ) : null}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/35">
                      <span className="cta-button translate-y-2 px-5 py-2 text-[11px] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                        <span>View Product</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                  <div className="px-4 pb-4 pt-4">
                    <p className="line-clamp-1 text-lg font-medium text-[#1A1A1A] transition-colors group-hover:text-[#E85A3C]">{product.name}</p>
                    <p className="line-clamp-1 text-sm text-[#6B6B6B]">{product.ownerName}</p>
                    <p className="mt-1 font-medium text-[#E85A3C]">{formatFromUsd(product.priceUsd)}</p>
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
