import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Globe, Loader2 } from 'lucide-react';
import '../../styles/jenks-v2.css';
import { api } from '../../services/api';
import { useCurrencyStore } from '../../store/currencyStore';
import { AFRICAN_COUNTRIES } from '../../data/africanCountries';
import { resolveCountryCode } from '../../data/locationOptions';

type CategoryMode = 'FABRICS' | 'READY' | 'CUSTOM';

type JenksV14CategoryPageProps = {
  mode: CategoryMode;
  routeBase:
    | '/jenks-v14/fabrics'
    | '/jenks-v14/ready-to-wear'
    | '/jenks-v14/custom-to-wear'
    | '/fabricstobuy'
    | '/readytowear'
    | '/customtowear';
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
  material?: string;
  isNew?: boolean;
};

const QUICK_COUNTRY_CODES = ['NG', 'GH', 'KE', 'ZA', 'MA', 'SN', 'ET', 'TZ', 'UG', 'ML', 'EG', 'CM'] as const;

const FABRIC_FALLBACK_FILTERS = [
  'Ankara',
  'Kente',
  'Adire',
  'Mud Cloth',
  'Silk',
  'Cotton',
  'Kanga',
  'Raffia',
  'Shweshwe',
  'Toghu',
];

const READY_FALLBACK_FILTERS = ['Dresses', 'Kaftan', 'Agbada', 'Skirt Sets', 'Shirts', 'Jackets', 'Occasion', 'Casual'];

const CUSTOM_FALLBACK_FILTERS = ['Bridal', 'Traditional', 'Modern', 'Menswear', 'Womenswear', 'Luxury', 'Event', 'Bespoke'];

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

const flagEmoji = (countryCode: string) => {
  const normalized = String(countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '🌍';
  const base = 127397;
  return String.fromCodePoint(...normalized.split('').map((char) => base + char.charCodeAt(0)));
};

const sortByName = (rows: TaxonomyOption[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

export default function JenksV14CategoryPage({ mode, routeBase }: JenksV14CategoryPageProps) {
  const { formatFromUsd } = useCurrencyStore();

  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedTaxonomyId, setSelectedTaxonomyId] = useState('');
  const [taxonomyOptions, setTaxonomyOptions] = useState<TaxonomyOption[]>([]);
  const [taxonomyLoadedFromApi, setTaxonomyLoadedFromApi] = useState(true);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllCountries, setShowAllCountries] = useState(false);

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

  const quickCountries = useMemo(
    () =>
      QUICK_COUNTRY_CODES.map((code) => countryOptions.find((entry) => entry.code === code)).filter(
        (entry): entry is { code: string; name: string } => Boolean(entry)
      ),
    [countryOptions]
  );

  const visibleCountries = useMemo(
    () => (showAllCountries ? countryOptions : quickCountries),
    [countryOptions, quickCountries, showAllCountries]
  );

  const taxonomyLabel = mode === 'FABRICS' ? 'MATERIAL' : mode === 'READY' ? 'CATEGORY' : 'STYLE';
  const sectionTitle = mode === 'FABRICS' ? 'Fabrics To Buy' : mode === 'READY' ? 'Ready To Wear' : 'Custom To Wear';
  const countLabel = mode === 'FABRICS' ? 'fabrics' : 'products';

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
        // Keep graceful fallback.
      }

      const fallbackNames =
        mode === 'FABRICS' ? FABRIC_FALLBACK_FILTERS : mode === 'READY' ? READY_FALLBACK_FILTERS : CUSTOM_FALLBACK_FILTERS;
      setTaxonomyOptions(fallbackNames.map((name) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name })));
      setTaxonomyLoadedFromApi(false);
    };

    setSelectedTaxonomyId('');
    void loadTaxonomy();
  }, [mode]);

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

        if (mode === 'FABRICS') {
          const response = await api.products.getFabrics({
            country: selectedCountry || undefined,
            fabricCategoryId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
            page: 1,
            limit: 32,
          });
          if (!response.success) throw new Error('Unable to load fabrics.');
          const sourceRows = Array.isArray(response.data?.fabrics) ? response.data.fabrics : [];
          const rows = fallbackTaxonomyToken
            ? sourceRows.filter((row: any) => {
                const haystack = [
                  row?.name,
                  row?.description,
                  row?.fabricCategory?.name,
                  row?.fabricCategoryName,
                  row?.materialType?.name,
                  row?.materialTypeName,
                ]
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
              material: asText(row?.materialType?.name, asText(row?.materialTypeName, '')),
              isNew: true,
            }))
          );
          return;
        }

        if (mode === 'READY') {
          const response = await api.products.getReadyToWear({
            country: selectedCountry || undefined,
            categoryId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
            page: 1,
            limit: 32,
          });
          if (!response.success) throw new Error('Unable to load ready-to-wear products.');
          const sourceRows = Array.isArray(response.data?.products) ? response.data.products : [];
          const rows = fallbackTaxonomyToken
            ? sourceRows.filter((row: any) => {
                const haystack = [row?.name, row?.description, row?.category?.name, row?.categoryName]
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
                material: asText(row?.materialType?.name, asText(row?.materialTypeName, '')),
                isNew: true,
              } satisfies ProductCard;
            })
          );
          return;
        }

        const response = await api.products.getDesigns({
          country: selectedCountry || undefined,
          categoryId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
          page: 1,
          limit: 32,
        });
        if (!response.success) throw new Error('Unable to load custom products.');
        const sourceRows = Array.isArray(response.data?.designs) ? response.data.designs : [];
        const rows = fallbackTaxonomyToken
          ? sourceRows.filter((row: any) => {
              const haystack = [row?.name, row?.description, row?.category?.name, row?.categoryName]
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
            material: asText(row?.materialType?.name, asText(row?.materialTypeName, '')),
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
  }, [mode, routeBase, selectedCountry, selectedTaxonomyId, taxonomyLoadedFromApi, taxonomyOptions]);

  return (
    <div className="min-h-screen bg-[#F8F6F1] text-[#1A1A1A]">
      <div className="sticky top-0 z-30 border-b border-[#1A1A1A]/10 bg-[#F8F6F1]/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-mono text-[#6B6B6B]">{mode === 'FABRICS' ? 'Kimi v14 Category' : 'Kimi v14 Collection'}</p>
              <h1 className="headline-lg mt-2 text-[clamp(2rem,4vw,4.5rem)]">{sectionTitle}</h1>
            </div>
            <p className="text-xs uppercase tracking-[0.12em] text-[#6B6B6B]">
              {products.length} {countLabel}
            </p>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="label-mono text-[#6B6B6B]">COUNTRY</p>
              <button
                type="button"
                onClick={() => setShowAllCountries((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-[#E85A3C] hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                {showAllCountries ? 'Show less' : `View all ${countryOptions.length} countries`}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllCountries ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className={`${showAllCountries ? 'grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12' : 'grid grid-cols-12 gap-2'}`}>
              {visibleCountries.map((country) => {
                const active = selectedCountry === country.name;
                return (
                  <button
                    key={`country-filter-${country.code}`}
                    type="button"
                    onClick={() => setSelectedCountry((previous) => (previous === country.name ? '' : country.name))}
                    className={`group flex flex-col items-center px-1 py-2 text-center transition-colors ${
                      active ? 'text-[#E85A3C]' : 'text-[#1A1A1A] hover:text-[#E85A3C]'
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
                        active ? 'border-[#E85A3C]' : 'border-[#1A1A1A]/12 group-hover:border-[#E85A3C]'
                      }`}
                    >
                      <span className="text-lg">{flagEmoji(country.code)}</span>
                    </span>
                    <span className="mt-1 line-clamp-1 text-[10px] font-medium uppercase tracking-[0.08em]">{country.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <p className="label-mono mb-2 text-[#6B6B6B]">{taxonomyLabel}</p>
            <div className="flex flex-wrap gap-2">
              {taxonomyOptions.map((option) => {
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
        ) : products.length === 0 ? (
          <div className="border border-[#d8d4cb] bg-white px-4 py-12 text-center text-sm text-[#6f6a60]">
            No products found for the selected filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => {
              const countryCode = resolveCountryCode(product.country);
              return (
                <Link
                  key={product.id}
                  to={product.href}
                  className={`product-card group bg-white ${index % 5 === 0 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#ece8df]">
                    <img
                      src={product.image || '/images/placeholder.jpg'}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[16px] shadow">
                      {flagEmoji(countryCode || 'NG')}
                    </div>
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
