import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Heart, 
  Share2, 
  MapPin, 
  Star, 
  Ruler, 
  Shirt,
  ShoppingBag,
  Eye,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

interface Design {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  images: string[];
  category: { id: string; name: string };
  designer: {
    id: string;
    businessName: string;
    country: string;
    city: string;
    profileImage?: string;
  };
  suitableFabrics: Array<{
    fabric: {
      id: string;
      name: string;
      images: string[];
      pricePerMeter: number;
      seller: {
        businessName: string;
        country: string;
      };
    };
    minMeters: number;
    maxMeters: number;
  }>;
  measurements: Array<{
    name: string;
    description: string;
    unit: string;
    isRequired: boolean;
  }>;
  rating: number;
  reviewCount: number;
  orderCount: number;
  productLabels?: Array<{
    id: string;
    name: string;
    textColor: string;
    backgroundColor: string;
    sizePercent?: number;
    fontSizePx?: number;
    isBold?: boolean;
  }>;
}

interface ProductReview {
  id: string;
  rating: number;
  title?: string | null;
  comment: string;
  createdAt: string;
  customer?: { id: string; name: string } | null;
}

interface DiscoverProduct {
  id: string;
  name: string;
  image: string;
  priceUsd: number;
  country: string;
  ownerName: string;
  productType: 'DESIGN' | 'FABRIC' | 'READY_TO_WEAR';
}

export default function DesignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const { formatFromUsd } = useCurrencyStore();
  
  const [design, setDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedFabric, setSelectedFabric] = useState<string | null>(null);
  const [fabricSelectionMode, setFabricSelectionMode] = useState<'CUSTOMER_SELECTED' | 'DESIGNER_DECIDES'>(
    'CUSTOMER_SELECTED'
  );
  const [fabricPreferenceNotes, setFabricPreferenceNotes] = useState('');
  const [fabricMeters, setFabricMeters] = useState<Record<string, number>>({});
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewAverage, setReviewAverage] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [discoverProducts, setDiscoverProducts] = useState<DiscoverProduct[]>([]);
  const [cartMessage, setCartMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'fabrics' | 'measurements'>('details');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id]);

  useEffect(() => {
    fetchDesign();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.allSettled([
      api.products.getProductLikes('design', id),
      api.products.getProductReviews('design', id, 12),
      api.products.getDiscoverByCountry('design', id, 12),
    ]).then(([likesResult, reviewsResult, discoverResult]) => {
      if (cancelled) return;
      if (likesResult.status === 'fulfilled' && likesResult.value.success) {
        const liked = Boolean(likesResult.value.data?.likedByMe);
        setIsWishlisted(liked);
        setLikeCount(Number(likesResult.value.data?.count || 0));
      } else {
        setIsWishlisted(false);
        setLikeCount(0);
      }
      if (reviewsResult.status === 'fulfilled' && reviewsResult.value.success) {
        setReviews(Array.isArray(reviewsResult.value.data?.reviews) ? reviewsResult.value.data.reviews : []);
        setReviewAverage(Number(reviewsResult.value.data?.summary?.averageRating || 0));
        setReviewCount(Number(reviewsResult.value.data?.summary?.count || 0));
      } else {
        setReviews([]);
        setReviewAverage(0);
        setReviewCount(0);
      }
      if (discoverResult.status === 'fulfilled' && discoverResult.value.success) {
        setDiscoverProducts(Array.isArray(discoverResult.value.data) ? discoverResult.value.data : []);
      } else {
        setDiscoverProducts([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const fetchDesign = async () => {
    try {
      setLoading(true);
      const response = await api.products.getDesign(id!);
      if (response.success) {
        setDesign(response.data);
        // Initialize fabric meters
        const initialMeters: Record<string, number> = {};
        response.data.suitableFabrics.forEach((sf: any) => {
          initialMeters[sf.fabric.id] = sf.minMeters;
        });
        setFabricMeters(initialMeters);
      }
    } catch (error) {
      console.error('Failed to fetch design:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!areAllRequiredMeasurementsFilled()) {
      setActiveTab('measurements');
      return;
    }
    if (fabricSelectionMode === 'CUSTOMER_SELECTED' && !selectedFabric) {
      setActiveTab('fabrics');
      return;
    }

    if (!design) return;

    const fabric = selectedFabric ? design.suitableFabrics.find(sf => sf.fabric.id === selectedFabric) : null;
    if (fabricSelectionMode === 'CUSTOMER_SELECTED' && !fabric) return;

    const cartItem = {
      designId: design.id,
      designName: design.name,
      designImage: design.images[0],
      fabricId: fabricSelectionMode === 'CUSTOMER_SELECTED' ? fabric?.fabric.id : undefined,
      fabricName: fabricSelectionMode === 'CUSTOMER_SELECTED' ? fabric?.fabric.name : undefined,
      fabricImage: fabricSelectionMode === 'CUSTOMER_SELECTED' ? fabric?.fabric.images?.[0] : undefined,
      fabricMeters: fabricSelectionMode === 'CUSTOMER_SELECTED' ? fabricMeters[selectedFabric!] : undefined,
      fabricPrice: fabricSelectionMode === 'CUSTOMER_SELECTED' ? fabric?.fabric.pricePerMeter : undefined,
      fabricSelectionMode,
      fabricPreferenceNotes: fabricSelectionMode === 'DESIGNER_DECIDES' ? fabricPreferenceNotes.trim() || undefined : undefined,
      designerId: design.designer.id,
      designerName: design.designer.businessName,
      measurements,
      basePrice: design.basePrice,
      totalPrice: calculateTotal(),
    };

    addItem(cartItem);
    setCartMessage('Added to cart. Continue to checkout when ready.');
    navigate('/cart');
  };

  const handleTryOn = () => {
    const tryOnFabricId = selectedFabric || design?.suitableFabrics?.[0]?.fabric?.id;
    if (!tryOnFabricId) {
      setActiveTab('fabrics');
      return;
    }
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/try-on/${id}?fabric=${tryOnFabricId}`);
  };

  const handleToggleLike = async () => {
    if (!id) return;
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const response = await api.products.toggleProductLike('design', id);
      if (response.success) {
        const liked = Boolean(response.data?.likedByMe);
        setIsWishlisted(liked);
        setLikeCount(Number(response.data?.count || 0));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleSubmitReview = async () => {
    if (!id) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (!reviewComment.trim()) return;
    try {
      setReviewSubmitting(true);
      const response = await api.products.createProductReview('design', id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      if (response.success) {
        setReviewComment('');
        const nextReviews = await api.products.getProductReviews('design', id, 12);
        if (nextReviews.success) {
          setReviews(Array.isArray(nextReviews.data?.reviews) ? nextReviews.data.reviews : []);
          setReviewAverage(Number(nextReviews.data?.summary?.averageRating || 0));
          setReviewCount(Number(nextReviews.data?.summary?.count || 0));
        }
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const calculateTotal = () => {
    if (!design) return 0;
    if (fabricSelectionMode === 'DESIGNER_DECIDES' || !selectedFabric) return Number(design.basePrice || 0);
    const fabric = design.suitableFabrics.find(sf => sf.fabric.id === selectedFabric);
    if (!fabric) return design.basePrice;
    const meters = fabricMeters[selectedFabric] || fabric.minMeters;
    return design.basePrice + (fabric.fabric.pricePerMeter * meters);
  };

  const handleMeasurementChange = (name: string, value: number) => {
    setMeasurements(prev => ({ ...prev, [name]: value }));
  };

  const areAllRequiredMeasurementsFilled = () => {
    if (!design) return false;
    return design.measurements
      .filter(m => m.isRequired)
      .every(m => measurements[m.name] && measurements[m.name] > 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Design Not Found</h2>
          <p className="text-gray-600 mb-4">The design you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/designs')}>Browse Designs</Button>
        </div>
      </div>
    );
  }

  const designerFlagCode = resolveCountryCode(design.designer?.country);
  const storefrontPath = design.designer?.id
    ? `/store/designer/${design.designer.id}/${encodeURIComponent(
        String(design.designer.businessName || 'designer')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'designer'
      )}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button 
            onClick={() => navigate('/designs')}
            className="flex items-center text-gray-600 hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Designs
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative bg-gray-100 overflow-hidden" style={{ aspectRatio: '4/5' }}>
              <img
                src={design.images[selectedImage]}
                alt={design.name}
                className="w-full h-full object-cover"
              />
              {design.images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage(prev => prev === 0 ? design.images.length - 1 : prev - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white bg-opacity-90 flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedImage(prev => prev === design.images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white bg-opacity-90 flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              <button
                onClick={handleToggleLike}
                className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-90 flex items-center justify-center shadow-lg hover:bg-white transition-colors"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
              </button>
              <div className="absolute top-4 left-4 rounded-full bg-black/65 px-2 py-1 text-xs font-medium text-white">
                {likeCount} likes
              </div>
            </div>
            
            {/* Thumbnails */}
            {design.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {design.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`flex-shrink-0 w-20 h-20 overflow-hidden border-2 transition-colors ${
                      selectedImage === idx ? 'border-black' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{design.category.name}</Badge>
                  {(design.productLabels || []).map((label) => (
                    <span
                      key={`${design.id}-detail-label-${label.id}`}
                      className="inline-flex items-center"
                      style={{
                        backgroundColor: label.backgroundColor || '#111827',
                        color: label.textColor || '#ffffff',
                        fontSize: `${Math.max(8, Math.min(36, Number(label.fontSizePx || 12)))}px`,
                        fontWeight: label.isBold === false ? 500 : 700,
                        padding: `${0.125 * (Math.max(60, Math.min(300, Number(label.sizePercent || 120))) / 100)}rem ${
                          0.5 * (Math.max(60, Math.min(300, Number(label.sizePercent || 120))) / 100)
                        }rem`,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-gray-100 transition-colors">
                    <Share2 className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{design.name}</h1>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{reviewAverage > 0 ? reviewAverage.toFixed(1) : Number(design.rating || 0).toFixed(1)}</span>
                  <span className="text-gray-500">({reviewCount || Number(design.reviewCount || 0)} reviews)</span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">{design.orderCount} orders</span>
              </div>
            </div>

            {/* Designer Info */}
            <div className="flex items-center gap-4 border bg-white p-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden bg-gray-100">
                {designerFlagCode ? (
                  <img
                    src={`https://flagcdn.com/w80/${designerFlagCode.toLowerCase()}.png`}
                    alt={`${design.designer.country} flag`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-black">
                    {design.designer.businessName.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1">
                {storefrontPath ? (
                  <Link to={storefrontPath} className="font-semibold text-gray-900 hover:underline">
                    {design.designer.businessName}
                  </Link>
                ) : (
                  <h3 className="font-semibold text-gray-900">{design.designer.businessName}</h3>
                )}
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="w-4 h-4" />
                  {design.designer.city}, {design.designer.country}
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="bg-gray-100 p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-black">
                  {formatFromUsd(calculateTotal())}
                </span>
                <span className="text-gray-500">total price</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Base: {formatFromUsd(design.basePrice)} + Fabric (varies by selection)
              </p>
            </div>

            {/* Tabs */}
            <div className="border-b">
              <div className="flex gap-6">
                {(['details', 'fabrics', 'measurements'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-sm font-medium capitalize transition-colors relative ${
                      activeTab === tab ? 'text-black' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[200px]">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <p className="text-gray-600 leading-relaxed">{design.description}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                      <Shirt className="w-5 h-5 text-black" />
                      <div>
                        <p className="text-sm font-medium">Custom Made</p>
                        <p className="text-xs text-gray-500">To your measurements</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                      <Ruler className="w-5 h-5 text-black" />
                      <div>
                        <p className="text-sm font-medium">Perfect Fit</p>
                        <p className="text-xs text-gray-500">Guaranteed fit policy</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'fabrics' && (
                <div className="space-y-4">
                  <div className="border bg-gray-50 p-3">
                    <p className="mb-2 text-sm font-semibold text-gray-900">Fabric selection option</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setFabricSelectionMode('CUSTOMER_SELECTED')}
                        className={`border px-3 py-2 text-left text-sm ${
                          fabricSelectionMode === 'CUSTOMER_SELECTED'
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        I will choose fabric now
                      </button>
                      <button
                        type="button"
                        onClick={() => setFabricSelectionMode('DESIGNER_DECIDES')}
                        className={`border px-3 py-2 text-left text-sm ${
                          fabricSelectionMode === 'DESIGNER_DECIDES'
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        Let designer/tailor choose fabric
                      </button>
                    </div>
                    {fabricSelectionMode === 'DESIGNER_DECIDES' ? (
                      <textarea
                        value={fabricPreferenceNotes}
                        onChange={(event) => setFabricPreferenceNotes(event.target.value)}
                        placeholder="Optional: Share your preferred fabric style, texture, or color."
                        className="mt-3 h-20 w-full border px-3 py-2 text-sm"
                      />
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-600">
                    Select a fabric for your design. All fabrics are from sellers in the same country as your designer.
                  </p>
                  <div className="space-y-3">
                    {design.suitableFabrics.map(({ fabric, minMeters, maxMeters }) => (
                      <div
                        key={fabric.id}
                        onClick={() => setSelectedFabric(fabric.id)}
                        className={`border-2 p-4 cursor-pointer transition-all ${
                          selectedFabric === fabric.id && fabricSelectionMode === 'CUSTOMER_SELECTED'
                            ? 'border-black bg-gray-50' 
                            : 'border-gray-200 hover:border-black'
                        }`}
                      >
                        <div className="flex gap-4">
                          <img
                            src={fabric.images[0]}
                            alt={fabric.name}
                            className="h-20 w-20 object-cover"
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900">{fabric.name}</h4>
                                <p className="text-sm text-gray-500">{fabric.seller.businessName}</p>
                                <p className="text-sm text-gray-500">{fabric.seller.country}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-black">
                                  {formatFromUsd(fabric.pricePerMeter)}/meter
                                </p>
                                <p className="text-xs text-gray-500">
                                  {minMeters}-{maxMeters} meters needed
                                </p>
                              </div>
                            </div>
                            {selectedFabric === fabric.id && (
                              <div className="mt-3 border-t border-gray-200 pt-3">
                                <label className="text-sm font-medium text-gray-700">
                                  Meters: {fabricMeters[fabric.id]}
                                </label>
                                <input
                                  type="range"
                                  min={minMeters}
                                  max={maxMeters}
                                  step={0.5}
                                  value={fabricMeters[fabric.id] || minMeters}
                                  onChange={(e) => setFabricMeters(prev => ({
                                    ...prev,
                                    [fabric.id]: parseFloat(e.target.value)
                                  }))}
                                  className="w-full mt-1"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'measurements' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Enter your measurements for a perfect fit.
                    </p>
                    <button
                      onClick={() => setShowMeasurementModal(true)}
                      className="text-sm font-medium text-black hover:text-gray-700"
                    >
                      How to measure?
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {design.measurements.map((measurement) => (
                      <div key={measurement.name} className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {measurement.name}
                          {measurement.isRequired && <span className="text-red-500">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={measurements[measurement.name] || ''}
                            onChange={(e) => handleMeasurementChange(measurement.name, parseFloat(e.target.value))}
                            placeholder={measurement.description}
                            className="w-full border px-3 py-2 text-sm focus:border-black focus:ring-2 focus:ring-black/20"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                            {measurement.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
                <Button
                  className="flex-1 rounded-none"
                onClick={handleTryOn}
                disabled={design.suitableFabrics.length === 0}
              >
                <Eye className="w-4 h-4 mr-2" />
                Virtual Try-On
              </Button>
                <Button
                  className="flex-1 rounded-none"
                onClick={handleAddToCart}
                disabled={!areAllRequiredMeasurementsFilled() || (fabricSelectionMode === 'CUSTOMER_SELECTED' && !selectedFabric)}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Make Your Own Design
              </Button>
            </div>

            {fabricSelectionMode === 'CUSTOMER_SELECTED' && !selectedFabric && (
              <p className="text-sm text-gray-700 text-center">
                Please select a fabric to continue
              </p>
            )}
            {!areAllRequiredMeasurementsFilled() ? (
              <p className="text-sm text-gray-700 text-center">
                Complete required measurements before adding to cart.
              </p>
            ) : null}
            {cartMessage ? (
              <p className="text-sm text-emerald-700 text-center">{cartMessage}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="rounded-xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Customer Reviews</h2>
            <p className="text-sm text-gray-500">
              {reviewCount} reviews • {reviewAverage > 0 ? reviewAverage.toFixed(1) : '0.0'} avg
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Your Rating</label>
              <select
                value={reviewRating}
                onChange={(event) => setReviewRating(Number(event.target.value))}
                className="w-full border px-3 py-2 text-sm"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} Star{value > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                className="h-24 w-full border px-3 py-2 text-sm"
                placeholder="Share your experience with this design..."
              />
              <Button onClick={handleSubmitReview} disabled={reviewSubmitting || !reviewComment.trim()} className="w-full">
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-gray-500">No reviews yet. Be the first to review this product.</p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="border p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{review.customer?.name || 'Customer'}</p>
                      <p className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                    <p className="text-xs font-medium text-gray-700">{'★'.repeat(Math.max(1, Math.min(5, Number(review.rating || 0))))}</p>
                    <p className="mt-1 text-sm text-gray-700">{review.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 pb-4">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">You May Also Like</h2>
          {discoverProducts.length === 0 ? (
            <p className="text-sm text-gray-500">No recommendations available yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {discoverProducts.map((entry) => {
                const href =
                  entry.productType === 'DESIGN'
                    ? `/designs/${entry.id}`
                    : entry.productType === 'FABRIC'
                      ? `/fabrics/${entry.id}`
                      : `/ready-to-wear/${entry.id}`;
                return (
                  <Link key={`${entry.productType}-${entry.id}`} to={href} className="group overflow-hidden border bg-white">
                    <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                      <img
                        src={entry.image || '/images/placeholder.jpg'}
                        alt={entry.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
                        {entry.country}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-sm font-semibold text-gray-900">{entry.name}</p>
                      <p className="line-clamp-1 text-xs text-gray-500">{entry.ownerName}</p>
                      <p className="mt-1 text-sm font-semibold text-black">{formatFromUsd(Number(entry.priceUsd || 0))}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Measurement Guide Modal */}
      {showMeasurementModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl bg-white max-h-[92vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">How to Measure</h3>
                <button 
                  onClick={() => setShowMeasurementModal(false)}
                  className="p-2 hover:bg-gray-100"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                {design.measurements.map((m) => (
                  <div key={m.name} className="bg-gray-50 p-4">
                    <h4 className="font-semibold mb-1">{m.name}</h4>
                    <p className="text-sm text-gray-600">{m.description}</p>
                    <p className="mt-1 text-sm text-gray-700">Unit: {m.unit}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
