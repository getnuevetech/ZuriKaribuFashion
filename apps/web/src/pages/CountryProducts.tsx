import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';

type ReadyRow = {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  basePrice?: number;
  sizeVariations?: Array<{ price: number }>;
  designer?: { businessName?: string; country?: string };
};

type DesignRow = {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  finalPrice?: number;
  basePrice?: number;
  designer?: { businessName?: string; country?: string };
};

type FabricRow = {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  finalPrice?: number;
  sellerPrice?: number;
  seller?: { businessName?: string; country?: string };
};

export default function CountryProducts() {
  const [searchParams] = useSearchParams();
  const country = String(searchParams.get('country') || '').trim();
  const flagCode = resolveCountryCode(country);
  const { formatFromUsd } = useCurrencyStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readyRows, setReadyRows] = useState<ReadyRow[]>([]);
  const [designRows, setDesignRows] = useState<DesignRow[]>([]);
  const [fabricRows, setFabricRows] = useState<FabricRow[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!country) {
        setError('Please choose a country from the homepage cards.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [readyResponse, designResponse, fabricResponse] = await Promise.all([
          api.products.getReadyToWear({ country, page: 1, limit: 30 }),
          api.products.getDesigns({ country, page: 1, limit: 30 }),
          api.products.getFabrics({ country, page: 1, limit: 30 }),
        ]);
        if (!mounted) return;
        setReadyRows(Array.isArray(readyResponse?.data?.products) ? readyResponse.data.products : []);
        setDesignRows(Array.isArray(designResponse?.data?.designs) ? designResponse.data.designs : []);
        setFabricRows(Array.isArray(fabricResponse?.data?.fabrics) ? fabricResponse.data.fabrics : []);
      } catch {
        if (!mounted) return;
        setError('Unable to load products for this country.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [country]);

  const total = readyRows.length + designRows.length + fabricRows.length;
  const emptyState = useMemo(() => !loading && !error && total === 0, [loading, error, total]);

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <section className="border-b bg-white">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm text-gray-500">Home &gt; Country Products</p>
          <div className="mt-2 flex items-center gap-3">
            {flagCode ? (
              <img
                src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                alt={`${country || 'Country'} flag`}
                className="h-8 w-11 rounded-sm object-cover shadow"
                loading="lazy"
              />
            ) : null}
            <h1 className="text-3xl font-semibold text-gray-900">{country || 'Country products'}</h1>
          </div>
          <p className="mt-1 text-sm text-gray-600">Explore Ready To Wear, Custom To Wear, and Fabrics from this country.</p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-black" />
          </div>
        ) : null}
        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {emptyState ? (
          <div className="border bg-white px-4 py-12 text-center text-sm text-gray-600">
            No products are currently available for this country.
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Ready To Wear ({readyRows.length})</h2>
                <Link to={`/ready-to-wear?country=${encodeURIComponent(country)}`} className="text-sm font-medium text-black hover:underline">
                  View all
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {readyRows.slice(0, 15).map((row) => {
                  const variationPrices = (Array.isArray(row.sizeVariations) ? row.sizeVariations : [])
                    .map((entry: any) => Number(entry?.price || 0))
                    .filter((value) => Number.isFinite(value) && value > 0);
                  const price = variationPrices.length > 0 ? Math.min(...variationPrices) : Number(row.basePrice || 0);
                  return (
                    <Link key={`country-ready-${row.id}`} to={`/ready-to-wear/${row.id}`} className="group overflow-hidden border bg-white">
                      <div className="relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                        <img
                          src={row.images?.[0]?.url || '/images/placeholder.jpg'}
                          alt={row.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-1 text-sm font-semibold text-gray-900">{row.name}</p>
                        <p className="line-clamp-1 text-xs text-gray-500">{row.designer?.businessName || 'Designer'}</p>
                        <p className="mt-1 text-sm font-semibold text-black">{formatFromUsd(price)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Custom To Wear ({designRows.length})</h2>
                <Link to={`/custom?country=${encodeURIComponent(country)}`} className="text-sm font-medium text-black hover:underline">
                  View all
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {designRows.slice(0, 15).map((row) => (
                  <Link key={`country-design-${row.id}`} to={`/custom/${row.id}`} className="group overflow-hidden border bg-white">
                    <div className="relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                      <img
                        src={row.images?.[0]?.url || '/images/placeholder.jpg'}
                        alt={row.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-sm font-semibold text-gray-900">{row.name}</p>
                      <p className="line-clamp-1 text-xs text-gray-500">{row.designer?.businessName || 'Designer'}</p>
                      <p className="mt-1 text-sm font-semibold text-black">
                        {formatFromUsd(Number(row.finalPrice || row.basePrice || 0))}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Fabrics To Buy ({fabricRows.length})</h2>
                <Link to={`/fabrics?country=${encodeURIComponent(country)}`} className="text-sm font-medium text-black hover:underline">
                  View all
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {fabricRows.slice(0, 15).map((row) => (
                  <Link key={`country-fabric-${row.id}`} to={`/fabrics/${row.id}`} className="group overflow-hidden border bg-white">
                    <div className="relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                      <img
                        src={row.images?.[0]?.url || '/images/placeholder.jpg'}
                        alt={row.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-sm font-semibold text-gray-900">{row.name}</p>
                      <p className="line-clamp-1 text-xs text-gray-500">{row.seller?.businessName || 'Seller'}</p>
                      <p className="mt-1 text-sm font-semibold text-black">
                        {formatFromUsd(Number(row.finalPrice || row.sellerPrice || 0))}/yard
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
