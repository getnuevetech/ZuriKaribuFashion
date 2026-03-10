import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Star, MapPin, Ruler, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { useCurrencyStore } from '../store/currencyStore';

interface Fabric {
  id: string;
  name: string;
  description: string;
  pricePerMeter: number;
  minOrderMeters: number;
  stockMeters: number;
  images: { url: string }[];
  seller: {
    id: string;
    businessName: string;
    country: string;
    rating: number;
    reviewCount: number;
  };
  materialType: { id: string; name: string };
  flag?: string;
  careInstructions?: string;
  shippingInfo?: string;
}

const countryFlags: Record<string, string> = {
  'Ghana': '🇬🇭',
  'Nigeria': '🇳🇬',
  'Kenya': '🇰🇪',
  'Senegal': '🇸🇳',
  'Ethiopia': '🇪🇹',
  'Morocco': '🇲🇦',
  'Mali': '🇲🇱',
  'South Africa': '🇿🇦',
  'Tanzania': '🇹🇿',
};

export default function FabricDetail() {
  const { id } = useParams();
  const [fabric, setFabric] = useState<Fabric | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(2);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { formatFromUsd } = useCurrencyStore();

  useEffect(() => {
    const fetchFabric = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response = await api.products.getFabric(id);
        if (response.success) {
          setFabric(response.data);
          setQuantity(response.data.minOrderMeters || 2);
        } else {
          setError('Failed to load fabric details');
        }
      } catch (err) {
        console.error('Error fetching fabric:', err);
        setError('Failed to load fabric details');
      } finally {
        setLoading(false);
      }
    };

    fetchFabric();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-coral-500" />
      </div>
    );
  }

  if (error || !fabric) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'Fabric not found'}</p>
          <Link to="/fabrics" className="text-coral-500 hover:underline">
            Back to Fabrics
          </Link>
        </div>
      </div>
    );
  }

  const flag = countryFlags[fabric.seller?.country] || '🌍';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Breadcrumb */}
        <Link to="/fabrics" className="inline-flex items-center text-gray-500 hover:text-coral-500 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Fabrics
        </Link>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative">
              <img
                src={fabric.images?.[selectedImage]?.url || '/images/placeholder.jpg'}
                alt={fabric.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 right-4 w-12 h-12 flex items-center justify-center bg-white bg-opacity-90">
                <span className="text-3xl">{flag}</span>
              </div>
            </div>
            {fabric.images && fabric.images.length > 1 && (
              <div className="flex gap-3">
                {fabric.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-20 h-20 overflow-hidden border-2 ${
                      selectedImage === idx ? 'border-coral-500' : 'border-transparent'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <MapPin className="w-4 h-4" />
                {fabric.seller?.country || 'Unknown'}
                <span className="mx-2">•</span>
                <span>{fabric.materialType?.name || 'Unknown Material'}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{fabric.name}</h1>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="font-medium">{fabric.seller?.rating || 0}</span>
                  <span className="text-gray-500">({fabric.seller?.reviewCount || 0} reviews)</span>
                </div>
              </div>
            </div>

            <p className="text-3xl font-bold text-coral-500">
              {formatFromUsd(fabric.pricePerMeter)}<span className="text-lg text-gray-500 font-normal">/yard</span>
            </p>

            <p className="text-gray-600 leading-relaxed">{fabric.description}</p>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
              <span className="font-medium">Quantity (yards):</span>
              <div className="flex items-center border rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(fabric.minOrderMeters || 1, quantity - 1))}
                  className="px-4 py-2 hover:bg-gray-100"
                >
                  -
                </button>
                <span className="px-4 py-2 font-medium w-16 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-gray-500">Min: {fabric.minOrderMeters || 1} yd</span>
            </div>

            {/* Total */}
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total:</span>
                <span className="text-2xl font-bold text-coral-500">{formatFromUsd(fabric.pricePerMeter * quantity)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button className="flex-1 py-4">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsWishlisted(!isWishlisted)}
                className={`px-6 ${isWishlisted ? 'text-red-500 border-red-500' : ''}`}
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
              </Button>
            </div>

            {/* Seller Info */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-3">Sold by</h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-coral-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">{flag}</span>
                </div>
                <div>
                  <p className="font-medium">{fabric.seller?.businessName || 'Unknown Seller'}</p>
                  <p className="text-sm text-gray-500">{fabric.seller?.country || 'Unknown'}</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="border-t pt-6 space-y-3">
              <div className="flex items-start gap-3">
                <Ruler className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">Fabric Width</p>
                  <p className="text-sm text-gray-500">120cm (47 inches)</p>
                </div>
              </div>
              {fabric.careInstructions && (
                <div>
                  <p className="font-medium">Care Instructions</p>
                  <p className="text-sm text-gray-500">{fabric.careInstructions}</p>
                </div>
              )}
              {fabric.shippingInfo && (
                <div>
                  <p className="font-medium">Shipping</p>
                  <p className="text-sm text-gray-500">{fabric.shippingInfo}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
