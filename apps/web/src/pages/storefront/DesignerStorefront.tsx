import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useCurrencyStore } from '../../store/currencyStore';

interface StoreDesign {
  id: string;
  name: string;
  finalPrice?: number;
  basePrice?: number;
  images: Array<{ url?: string }>;
}

interface StoreReady {
  id: string;
  name: string;
  basePrice?: number;
  images: Array<{ url?: string }>;
}

export default function DesignerStorefront() {
  const { profileId = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState('Designer Store');
  const [designs, setDesigns] = useState<StoreDesign[]>([]);
  const [ready, setReady] = useState<StoreReady[]>([]);
  const { formatFromUsd } = useCurrencyStore();

  useEffect(() => {
    const load = async () => {
      if (!profileId) return;
      setLoading(true);
      try {
        const [designRes, readyRes] = await Promise.all([
          api.products.getDesigns({ designerId: profileId, limit: 100 }),
          api.products.getReadyToWear({ designerId: profileId, limit: 100 }),
        ]);
        let derivedStoreName = '';
        if (designRes.success) {
          const rows = Array.isArray(designRes.data?.designs) ? designRes.data.designs : [];
          setDesigns(rows);
          const derivedName = rows[0]?.designer?.businessName;
          if (derivedName) derivedStoreName = String(derivedName);
        }
        if (readyRes.success) {
          const rows = Array.isArray(readyRes.data?.products) ? readyRes.data.products : [];
          setReady(rows);
          if (!derivedStoreName && rows[0]?.designer?.businessName) {
            derivedStoreName = String(rows[0].designer.businessName);
          }
        }
        if (derivedStoreName) setStoreName(derivedStoreName);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [profileId]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{storeName}</h1>
          <p className="mt-2 text-gray-600">Storefront collection</p>
        </div>

        {loading ? <p className="text-gray-500">Loading storefront...</p> : null}

        {!loading && designs.length === 0 && ready.length === 0 ? (
          <p className="text-gray-500">No products published yet.</p>
        ) : null}

        {!loading && designs.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-gray-900">Custom To Wear</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {designs.map((item) => (
                <Link key={item.id} to={`/custom/${item.id}`} className="rounded-xl border bg-white p-3 hover:shadow-sm">
                  <img
                    src={item.images?.[0]?.url || '/images/placeholder.jpg'}
                    alt={item.name}
                    className="h-48 w-full rounded-lg object-cover"
                  />
                  <p className="mt-3 text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-sm text-amber-700">
                    {formatFromUsd(Number(item.finalPrice ?? item.basePrice ?? 0))}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && ready.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-gray-900">Ready To Wear</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {ready.map((item) => (
                <Link key={item.id} to={`/ready-to-wear/${item.id}`} className="rounded-xl border bg-white p-3 hover:shadow-sm">
                  <img
                    src={item.images?.[0]?.url || '/images/placeholder.jpg'}
                    alt={item.name}
                    className="h-48 w-full rounded-lg object-cover"
                  />
                  <p className="mt-3 text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-sm text-amber-700">{formatFromUsd(Number(item.basePrice || 0))}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
