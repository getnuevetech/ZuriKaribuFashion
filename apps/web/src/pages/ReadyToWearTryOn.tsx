import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShoppingBag, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useCartStore } from '../store/cartStore';
import Button from '../components/ui/Button';

interface ReadyToWearProduct {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  category?: { id: string; name: string };
  designer?: { businessName?: string; country?: string };
  sizeVariations?: Array<{ id?: string; size: string; price: number; stock?: number }>;
}

interface TryOnMeasurements {
  height: number;
  bust: number;
  waist: number;
  hips: number;
}

const DEFAULT_MEASUREMENTS: TryOnMeasurements = {
  height: 168,
  bust: 90,
  waist: 72,
  hips: 98,
};

export default function ReadyToWearTryOn() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addReadyToWearItem } = useCartStore();
  const [product, setProduct] = useState<ReadyToWearProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [measurements, setMeasurements] = useState<TryOnMeasurements>(DEFAULT_MEASUREMENTS);
  const [previewGenerated, setPreviewGenerated] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await api.products.getReadyToWearProduct(id);
        if (response.success) {
          setProduct(response.data);
          const firstAvailableSize = (response.data.sizeVariations || [])
            .find((variation: any) => Number(variation?.stock || 0) > 0)?.size;
          if (firstAvailableSize) {
            setSelectedSize(firstAvailableSize);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-coral-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Product not found.</p>
          <Link to="/ready-to-wear" className="text-coral-600 hover:underline">
            Back to Ready to Wear
          </Link>
        </div>
      </div>
    );
  }

  const availableSizes = (product.sizeVariations || [])
    .filter((variation) => Number(variation.stock || 0) > 0)
    .map((variation) => variation.size);
  const selectedVariation = (product.sizeVariations || []).find((variation) => variation.size === selectedSize);
  const unitPrice = Number(selectedVariation?.price || 0);

  const handleGeneratePreview = async () => {
    setPreviewGenerated(false);
    setMessage('');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setPreviewGenerated(true);
  };

  const handleAddToCart = async () => {
    if (!previewGenerated) {
      setMessage('Please generate a preview before adding to cart.');
      return;
    }
    if (!selectedSize) {
      setMessage('Please select a size before adding to cart.');
      return;
    }
    setAdding(true);
    addReadyToWearItem({
      readyToWearId: product.id,
      productName: product.name,
      productImage: product.images?.[0]?.url || '/images/placeholder.jpg',
      selectedSize,
      quantity,
      unitPrice,
      designerName: product.designer?.businessName || 'Designer',
      categoryName: product.category?.name,
      tryOnMeasurements: { ...measurements },
    });
    setMessage('Try-on completed and item added to your cart.');
    setAdding(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 pb-24 md:pb-8">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-gray-500 hover:text-coral-500 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-gray-300 bg-white px-3 py-1">Step 1: Set measurements</span>
          <span className="rounded-full border border-gray-300 bg-white px-3 py-1">Step 2: Generate preview</span>
          <span className="rounded-full border border-gray-300 bg-white px-3 py-1">Step 3: Add to bag</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-coral-600" />
              <h1 className="text-2xl font-bold">Virtual Try-On</h1>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Adjust your measurements, generate a preview, then continue to cart.
            </p>

            <div className="space-y-4">
              {Object.entries(measurements).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{key} (cm)</label>
                  <input
                    type="range"
                    min={key === 'height' ? 145 : 60}
                    max={key === 'height' ? 210 : 140}
                    value={value}
                    onChange={(event) => {
                      setMeasurements((previous) => ({
                        ...previous,
                        [key]: Number(event.target.value),
                      }));
                      setPreviewGenerated(false);
                    }}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">{value} cm</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                <select
                  value={selectedSize}
                  onChange={(event) => {
                    setSelectedSize(event.target.value);
                    setPreviewGenerated(false);
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select size</option>
                  {availableSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(Math.max(1, Number(event.target.value || 1)));
                    setPreviewGenerated(false);
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleGeneratePreview}>
                Step 2: Generate Preview
              </Button>
              <Button onClick={handleAddToCart} disabled={adding || !previewGenerated}>
                <ShoppingBag className="w-4 h-4 mr-2" />
                {adding ? 'Adding...' : 'Step 3: Add to Bag'}
              </Button>
            </div>
            <p className="mt-3 text-xs text-gray-500">For best fit, regenerate preview after changing size, quantity, or measurements.</p>
            {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold mb-4">{product.name}</h2>
            <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '3/4' }}>
              <img
                src={product.images?.[0]?.url || '/images/placeholder.jpg'}
                alt={product.name}
                className={`w-full h-full object-cover transition-all duration-500 ${previewGenerated ? 'scale-105' : 'scale-100'}`}
              />
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {previewGenerated
                ? 'Preview generated using your measurement profile.'
                : 'Generate a preview to simulate the fit on your body profile.'}
            </p>
            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Estimated total</p>
              <p className="text-2xl font-bold text-coral-600">${(unitPrice * quantity).toFixed(2)}</p>
            </div>
            <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/cart')}>
              Go to Cart
            </Button>
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Estimated total</p>
            <p className="text-lg font-bold text-coral-600">${(unitPrice * quantity).toFixed(2)}</p>
          </div>
          <Button variant="outline" className="flex-1 text-xs" onClick={handleGeneratePreview}>
            Preview
          </Button>
          <Button className="flex-1 text-xs" onClick={handleAddToCart} disabled={adding || !previewGenerated}>
            Add to Bag
          </Button>
        </div>
      </div>
    </div>
  );
}
