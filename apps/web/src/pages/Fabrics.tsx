import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Loader2, Heart } from 'lucide-react';
import { api } from '../services/api';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';

interface Fabric {
  id: string;
  name: string;
  description: string;
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
}

interface Material {
  id: string;
  name: string;
}

function resolveMaterialId(queryValue: string, materials: Material[]) {
  const normalized = queryValue.trim().toLowerCase();
  if (!normalized) return undefined;
  const matched = materials.find(
    (entry) => entry.id.toLowerCase() === normalized || entry.name.toLowerCase() === normalized
  );
  return matched?.id;
}

export default function Fabrics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { formatFromUsd } = useCurrencyStore();
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    material: searchParams.get('material') || '',
    page: Number.parseInt(searchParams.get('page') || '1', 10) || 1,
  });

  const selectedMaterialId = useMemo(
    () => resolveMaterialId(filters.material, materials),
    [filters.material, materials]
  );

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
    loadMaterials();
  }, []);

  useEffect(() => {
    const loadFabrics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.products.getFabrics({
          search: filters.search || undefined,
          materialTypeId: selectedMaterialId,
          page: filters.page,
          limit: 80,
        });
        if (!response.success) {
          setFabrics([]);
          setError('Unable to load fabrics.');
          return;
        }
        const rows = Array.isArray(response.data?.fabrics) ? response.data.fabrics : [];
        setFabrics(rows);
      } catch {
        setFabrics([]);
        setError('Unable to load fabrics.');
      } finally {
        setIsLoading(false);
      }
    };
    loadFabrics();
  }, [filters.page, filters.search, selectedMaterialId]);

  const updateUrl = (next: typeof filters) => {
    const params = new URLSearchParams();
    if (next.search.trim()) params.set('search', next.search.trim());
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Banner */}
      <section className="relative h-64 md:h-80 overflow-hidden">
        <img
          src="/images/hero-fabrics.jpg"
          alt="African Fabrics"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.5), transparent)' }} />
        <div className="absolute inset-0 flex items-center">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3">
                African Fabrics
              </h1>
              <p className="text-lg text-white text-opacity-80">
                Browse by material category, choose your yardage, and checkout.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/20 px-3 py-1 text-white">1. Choose fabric</span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-white">2. Select yards</span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-white">3. Add to cart & checkout</span>
              </div>
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
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="Search fabrics..."
                className="w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-coral-500"
              />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => updateFilter('material', '')}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                !filters.material ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
              }`}
            >
              All Materials
            </button>
            {materials.map((material) => {
              const isActive =
                Boolean(filters.material) &&
                (filters.material.toLowerCase() === material.id.toLowerCase() ||
                  filters.material.toLowerCase() === material.name.toLowerCase());
              return (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => updateFilter('material', material.id)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                  }`}
                >
                  {material.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-gray-600">
            Showing <span className="font-semibold text-gray-900">{fabrics.length}</span> fabric
            {fabrics.length === 1 ? '' : 's'}
          </p>
          {(filters.search || filters.material) ? (
            <button
              type="button"
              onClick={() => {
                const next = { search: '', material: '', page: 1 };
                setFilters(next);
                updateUrl(next);
              }}
              className="text-coral-600 hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {fabrics.map((fabric) => {
              const flagCode = resolveCountryCode(fabric.seller?.country || '');
              return (
              <Link key={fabric.id} to={`/fabrics/${fabric.id}`} className="group">
                <div className="bg-white shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                  <div className="overflow-hidden relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                    <img
                      src={fabric.images?.[0]?.url || '/placeholder.jpg'}
                      alt={fabric.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute bottom-3 right-3 w-10 h-10 flex items-center justify-center z-10">
                      {flagCode ? (
                        <img
                          src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                          alt={`${fabric.seller?.country || 'Country'} flag`}
                          className="h-7 w-10 rounded-sm object-cover shadow-lg"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <button 
                      className="absolute top-3 right-3 w-8 h-8 bg-white bg-opacity-90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-coral-500 hover:text-white"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4">
                    {fabric.materialType?.name ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          updateFilter('material', fabric.materialType?.id || fabric.materialType?.name || '');
                        }}
                        className="inline-flex text-xs font-medium text-coral-600 hover:underline"
                      >
                        {fabric.materialType.name}
                      </button>
                    ) : null}
                    <h3 className="font-semibold text-gray-900 group-hover:text-coral-500 transition-colors">
                      {fabric.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{fabric.seller?.businessName}</p>
                    <p className="text-coral-500 font-semibold mt-2">{formatFromUsd(Number(fabric.pricePerMeter || 0))}/yard</p>
                  </div>
                </div>
              </Link>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
