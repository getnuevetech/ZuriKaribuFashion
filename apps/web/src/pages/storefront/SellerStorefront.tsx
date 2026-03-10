import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';

interface StoreFabric {
  id: string;
  name: string;
  finalPrice: number;
  images: Array<{ url?: string }>;
}

export default function SellerStorefront() {
  const { profileId = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState('Seller Store');
  const [items, setItems] = useState<StoreFabric[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!profileId) return;
      setLoading(true);
      try {
        const response = await api.products.getFabrics({ sellerId: profileId, limit: 100 });
        if (response.success) {
          const rows = Array.isArray(response.data?.fabrics) ? response.data.fabrics : [];
          setItems(rows);
          const derivedName = rows[0]?.seller?.businessName;
          if (derivedName) setStoreName(String(derivedName));
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [profileId]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-gray-900">{storeName}</h1>
        <p className="mt-2 text-gray-600">Storefront collection</p>

        {loading ? (
          <p className="mt-8 text-gray-500">Loading storefront...</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-gray-500">No products published yet.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <Link key={item.id} to={`/fabrics/${item.id}`} className="rounded-xl border bg-white p-3 hover:shadow-sm">
                <img
                  src={item.images?.[0]?.url || '/images/placeholder.jpg'}
                  alt={item.name}
                  className="h-48 w-full rounded-lg object-cover"
                />
                <p className="mt-3 text-sm font-semibold text-gray-900">{item.name}</p>
                <p className="text-sm text-amber-700">${Number(item.finalPrice || 0).toFixed(2)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
