import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Globe, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useCurrencyStore } from '../../store/currencyStore';
import { AFRICAN_COUNTRIES } from '../../data/africanCountries';
import { resolveCountryCode } from '../../data/locationOptions';

type CategoryMode = 'FABRICS' | 'READY' | 'CUSTOM';

type JenksV14CategoryPageProps = {
  mode: CategoryMode;
  routeBase: '/jenks-v14/fabrics' | '/jenks-v14/ready-to-wear' | '/jenks-v14/custom-to-wear';
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
};

const QUICK_COUNTRY_CODES = ['NG', 'GH', 'KE', 'ZA', 'MA', 'SN', 'ET', 'TZ'] as const;

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

const CUSTOM_FALLBACK_FILTERS = [
  'Bridal',
  'Traditional',
  'Modern',
  'Menswear',
  'Womenswear',
  'Luxury',
  'Event',
  'Bespoke',
];

const asText = (value: unknown, fallback = '') => {
  const text = String(value || '').trim();
  return text || fallback;
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
  const [showMoreCountries, setShowMoreCountries] = useState(false);

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

  const visibleCountryChips = useMemo(() => {
    if (showMoreCountries) return countryOptions;
    return quickCountries;
  }, [countryOptions, quickCountries, showMoreCountries]);

  const taxonomyLabel = mode === 'FABRICS' ? 'MATERIAL' : mode === 'READY' ? 'CATEGORY' : 'STYLE';

  const sectionTitle = mode === 'FABRICS' ? 'Fabrics To Buy' : mode === 'READY' ? 'Ready To Wear' : 'Custom To Wear';

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
        // Fallback chips below.
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
            ? String(
                taxonomyOptions.find((entry) => entry.id === selectedTaxonomyId)?.name || selectedTaxonomyId || ''
              )
                .trim()
                .toLowerCase()
            : '';

        if (mode === 'FABRICS') {
          const response = await api.products.getFabrics({
            country: selectedCountry || undefined,
            fabricCategoryId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
            page: 1,
            limit: 24,
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
              priceUsd: Number(row?.pricePerMeter || row?.finalPrice || row?.sellerPrice || 0),
              href: `${routeBase}/${asText(row?.id, '')}`,
              labels: Array.isArray(row?.productLabels) ? row.productLabels : [],
            }))
          );
          return;
        }

        if (mode === 'READY') {
          const response = await api.products.getReadyToWear({
            country: selectedCountry || undefined,
            categoryId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
            page: 1,
            limit: 24,
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
                .map((entry: any) => Number(entry?.price || 0))
                .filter((value: number) => Number.isFinite(value) && value > 0);
              const price = variationPrices.length > 0 ? Math.min(...variationPrices) : Number(row?.basePrice || 0);
              return {
                id: asText(row?.id, ''),
                name: asText(row?.name, 'Ready To Wear'),
                ownerName: asText(row?.designer?.businessName, 'Designer'),
                country: asText(row?.designer?.country, ''),
                image: asText(row?.images?.[0]?.url, '/images/placeholder.jpg'),
                priceUsd: price,
                href: `${routeBase}/${asText(row?.id, '')}`,
                labels: Array.isArray(row?.productLabels) ? row.productLabels : [],
              } satisfies ProductCard;
            })
          );
          return;
        }

        const response = await api.products.getDesigns({
          country: selectedCountry || undefined,
          categoryId: taxonomyLoadedFromApi && selectedTaxonomyId ? selectedTaxonomyId : undefined,
          page: 1,
          limit: 24,
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
            priceUsd: Number(row?.finalPrice || row?.basePrice || 0),
            href: `${routeBase}/${asText(row?.id, '')}`,
            labels: Array.isArray(row?.productLabels) ? row.productLabels : [],
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

  const allCountLabel = mode === 'FABRICS' ? 'fabrics' : 'products';

  return (
    <div className="min-h-screen bg-[#f1efe9] text-[#1a1a1a]">
      <div className="border-b border-[#d8d4cb] bg-[#ece9e2]">
        <div className="mx-auto w-full max-w-[1560px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-['Montserrat'] text-lg font-semibold uppercase tracking-[0.06em]">{sectionTitle}</h1>
            <p className="text-xs uppercase tracking-[0.08em] text-[#6f6a60]">
              {products.length} {allCountLabel}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e776d]">COUNTRY</span>
            {visibleCountryChips.map((country) => {
              const active = selectedCountry === country.name;
              return (
                <button
                  key={`country-filter-${country.code}`}
                  type="button"
                  onClick={() => setSelectedCountry((previous) => (previous === country.name ? '' : country.name))}
                  className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition ${
                    active
                      ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
                      : 'border-[#d3cec4] bg-white text-[#2b2b2b] hover:border-[#a6a093]'
                  }`}
                >
                  <span>{flagEmoji(country.code)}</span>
                  <span>{country.name}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowMoreCountries((previous) => !previous)}
              className="inline-flex items-center gap-2 border border-[#d3cec4] bg-white px-3 py-1.5 text-sm text-[#2b2b2b] hover:border-[#a6a093]"
            >
              <Globe className="h-4 w-4" />
              <span>{showMoreCountries ? 'Less' : 'More'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showMoreCountries ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e776d]">{taxonomyLabel}</span>
            {taxonomyOptions.map((option) => {
              const active = selectedTaxonomyId === option.id;
              return (
                <button
                  key={`taxonomy-filter-${option.id}`}
                  type="button"
                  onClick={() => setSelectedTaxonomyId((previous) => (previous === option.id ? '' : option.id))}
                  className={`border px-3 py-1 text-sm transition ${
                    active
                      ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
                      : 'border-[#d3cec4] bg-white text-[#343434] hover:border-[#a6a093]'
                  }`}
                >
                  {option.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1560px] px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-9 w-9 animate-spin text-[#1a1a1a]" />
          </div>
        ) : error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : products.length === 0 ? (
          <div className="border border-[#d8d4cb] bg-white px-4 py-12 text-center text-sm text-[#6f6a60]">
            No products found for the selected filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => {
              const countryCode = resolveCountryCode(product.country);
              return (
                <Link
                  key={product.id}
                  to={product.href}
                  className="group overflow-hidden border border-[#ddd8cf] bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.12)]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#efede7]">
                    <img
                      src={product.image || '/images/placeholder.jpg'}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-[16px] shadow">
                      {flagEmoji(countryCode || 'NG')}
                    </div>
                    {product.labels.length > 0 ? (
                      <span
                        className="absolute right-3 top-3 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                        style={{
                          color: asText(product.labels[0]?.textColor, '#ffffff'),
                          backgroundColor: asText(product.labels[0]?.backgroundColor, '#e85a3c'),
                        }}
                      >
                        {product.labels[0].name}
                      </span>
                    ) : null}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/24">
                      <span className="translate-y-2 border border-[#e85a3c] bg-[#e85a3c] px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                        View Details →
                      </span>
                    </div>
                  </div>
                  <div className="space-y-0.5 px-4 py-3">
                    <p className="line-clamp-1 text-[30px] font-semibold text-[#202020]">{product.name}</p>
                    <p className="line-clamp-1 text-sm text-[#726f67]">{product.ownerName}</p>
                    <p className="pt-1 text-sm font-semibold text-[#e85a3c]">{formatFromUsd(product.priceUsd)}</p>
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
