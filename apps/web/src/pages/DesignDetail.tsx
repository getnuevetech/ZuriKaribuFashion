import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Heart, 
  Share2, 
  MapPin, 
  Star, 
  Ruler, 
  Shirt,
  ShoppingBag,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';
import {
  buildMeasurementDropdownOptions,
  normalizeMeasurementKey,
  readMeasurementCache,
  writeMeasurementCache,
} from '../utils/measurementOptions';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const MEASUREMENT_CACHE_KEY = 'af_customer_measurement_profile_v1';

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
  hasAdditionalMaterialOrFabric?: boolean;
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

type FabricLengthUnit = 'YARDS' | 'METERS' | 'CENTIMETERS';

const YARD_TO_METER = 0.9144;
const YARD_TO_CENTIMETER = 91.44;

const convertYardsToUnit = (yards: number, unit: FabricLengthUnit) => {
  if (unit === 'METERS') return yards * YARD_TO_METER;
  if (unit === 'CENTIMETERS') return yards * YARD_TO_CENTIMETER;
  return yards;
};

const unitLabel = (unit: FabricLengthUnit) => {
  if (unit === 'METERS') return 'meters';
  if (unit === 'CENTIMETERS') return 'cm';
  return 'yards';
};

const clampWithin = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export default function DesignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [fabricUnit, setFabricUnit] = useState<FabricLengthUnit>('YARDS');
  const [fabricPreferenceNotes, setFabricPreferenceNotes] = useState('');
  const [fabricMeters, setFabricMeters] = useState<Record<string, number>>({});
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [measurementSeed, setMeasurementSeed] = useState<Record<string, number>>({});
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showTryOnPopup, setShowTryOnPopup] = useState(false);
  const [tryOnGenerating, setTryOnGenerating] = useState(false);
  const [tryOnGenerated, setTryOnGenerated] = useState(false);
  const [persistingMeasurements, setPersistingMeasurements] = useState(false);
  const [tryOnChoice, setTryOnChoice] = useState<'UNDECIDED' | 'RUN_TRY_ON' | 'SKIP_TRY_ON'>('UNDECIDED');
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
  const [activeTab, setActiveTab] = useState<'details' | 'fabrics' | 'measurements' | 'tryon'>('details');
  const productFlowTabsRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!cartMessage) return;
    const timer = window.setTimeout(() => setCartMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [cartMessage]);

  useEffect(() => {
    const localSeed = readMeasurementCache(MEASUREMENT_CACHE_KEY);
    setMeasurementSeed(localSeed);
  }, []);

  useEffect(() => {
    if (!user || String(user.role || '').toUpperCase() !== 'CUSTOMER') return;
    let cancelled = false;
    api.customer
      .getTryOnSummary()
      .then((response) => {
        if (cancelled || !response?.success) return;
        const source = response.data?.measurements;
        if (!source || typeof source !== 'object') return;
        const normalized = Object.entries(source as Record<string, unknown>).reduce((acc, [key, value]) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed <= 0) return acc;
          acc[normalizeMeasurementKey(key)] = Number(parsed.toFixed(2));
          return acc;
        }, {} as Record<string, number>);
        if (Object.keys(normalized).length > 0) {
          setMeasurementSeed((prev) => ({ ...prev, ...normalized }));
          writeMeasurementCache(MEASUREMENT_CACHE_KEY, normalized);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!design) return;
    if (!measurementSeed || Object.keys(measurementSeed).length === 0) return;
    setMeasurements((previous) => {
      const next = { ...previous };
      for (const measurement of design.measurements || []) {
        const key = normalizeMeasurementKey(measurement.name);
        const existing = Number(next[measurement.name] || 0);
        const seeded = Number(measurementSeed[key] || 0);
        if (existing > 0 || seeded <= 0) continue;
        next[measurement.name] = seeded;
      }
      return next;
    });
  }, [design, measurementSeed]);

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
        const firstFabricId = response.data.suitableFabrics?.[0]?.fabric?.id || null;
        setSelectedFabric(firstFabricId);
      }
    } catch (error) {
      console.error('Failed to fetch design:', error);
    } finally {
      setLoading(false);
    }
  };

  const persistMeasurementProfile = async (values: Record<string, number>) => {
    const normalizedValues = Object.entries(values || {}).reduce((acc, [key, value]) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return acc;
      acc[normalizeMeasurementKey(key)] = Number(parsed.toFixed(2));
      return acc;
    }, {} as Record<string, number>);
    writeMeasurementCache(MEASUREMENT_CACHE_KEY, normalizedValues);
    setMeasurementSeed((prev) => ({ ...prev, ...normalizedValues }));
    if (!user || String(user.role || '').toUpperCase() !== 'CUSTOMER') return;
    try {
      setPersistingMeasurements(true);
      await api.customer.saveMeasurements({ measurements: normalizedValues });
    } catch {
      // Keep the flow non-blocking; local cache still prevents duplicate entry.
    } finally {
      setPersistingMeasurements(false);
    }
  };

  const handleAddToCart = async () => {
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

    await persistMeasurementProfile(measurements);
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
    setCartMessage('Product added to cart. Use the floating Checkout button when ready.');
  };

  const handleStartDesignFlow = () => {
    setActiveTab('measurements');
  };

  const handleTryOn = () => {
    setTryOnChoice('RUN_TRY_ON');
    setActiveTab('tryon');
    window.setTimeout(() => {
      productFlowTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const handleContinueFromMeasurements = async () => {
    if (!areAllRequiredMeasurementsFilled()) {
      return;
    }
    await persistMeasurementProfile(measurements);
    setActiveTab('fabrics');
  };

  const handleContinueFromFabrics = () => {
    if (fabricSelectionMode === 'CUSTOMER_SELECTED' && !selectedFabric) {
      return;
    }
    setActiveTab('tryon');
  };

  const handleContinueToLoginForMeasurementSync = () => {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`, {
      state: { from: location },
    });
  };

  const handleOpenTryOnPopup = async () => {
    if (!areAllRequiredMeasurementsFilled()) {
      setActiveTab('measurements');
      return;
    }
    await persistMeasurementProfile(measurements);
    setTryOnGenerating(false);
    setTryOnGenerated(false);
    setShowTryOnPopup(true);
  };

  const handleGenerateTryOnPreview = async () => {
    setTryOnGenerating(true);
    setTryOnGenerated(false);
    await persistMeasurementProfile(measurements);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setTryOnGenerating(false);
    setTryOnGenerated(true);
  };

  const handleTryOnAddToCart = async () => {
    await handleAddToCart();
    setShowTryOnPopup(false);
  };

  const handleToggleLike = async () => {
    if (!id) return;
    if (!user) {
      navigate('/auth/login');
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
      navigate('/auth/login');
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
    const minYards = Math.max(1, Number(fabric.minMeters || 1));
    const maxYards = Math.max(minYards, Number(fabric.maxMeters || minYards));
    const selectedYards = clampWithin(Number(fabricMeters[selectedFabric] || minYards), minYards, maxYards);
    return design.basePrice + (fabric.fabric.pricePerMeter * selectedYards);
  };

  const handleMeasurementChange = (name: string, value: number) => {
    setMeasurements((prev) => {
      const next = { ...prev, [name]: value };
      writeMeasurementCache(MEASUREMENT_CACHE_KEY, next);
      return next;
    });
  };

  const areAllRequiredMeasurementsFilled = () => {
    if (!design) return false;
    const requiredMeasurements = design.measurements.filter((measurement) => measurement.isRequired !== false);
    if (requiredMeasurements.length === 0) return false;
    return requiredMeasurements.every((measurement) => measurements[measurement.name] && measurements[measurement.name] > 0);
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
          <Button onClick={() => navigate('/custom')}>Browse Custom To Wear</Button>
        </div>
      </div>
    );
  }

  const designerFlagCode = resolveCountryCode(design.designer?.country);
  const designerProfileImage = String(design.designer?.profileImage || '').trim();
  const hasRequiredMeasurementConfig = design.measurements.some((measurement) => measurement.isRequired !== false);
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
            onClick={() => navigate('/custom')}
            className="flex items-center text-gray-600 hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Custom To Wear
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
            <div ref={productFlowTabsRef} className="space-y-4">
            <div className="relative overflow-hidden rounded-xl bg-gray-100" style={{ aspectRatio: '4/5' }}>
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
              {designerFlagCode ? (
                <img
                  src={`https://flagcdn.com/w80/${designerFlagCode.toLowerCase()}.png`}
                  alt={`${design.designer.country} flag`}
                  className="absolute bottom-4 right-4 h-8 w-11 rounded-sm object-cover shadow-lg"
                />
              ) : null}
            </div>
            
            {/* Thumbnails */}
            {design.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {design.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`flex-shrink-0 w-20 h-20 overflow-hidden rounded-lg border-2 transition-colors ${
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
                {designerProfileImage ? (
                  <img
                    src={designerProfileImage}
                    alt={design.designer.businessName}
                    className="h-full w-full object-cover"
                  />
                ) : designerFlagCode ? (
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
                Design Price: {formatFromUsd(design.basePrice)} + Fabric (varies by selection)
              </p>
            </div>

            {/* Tabs */}
            <div className="border-b">
              <div className="flex gap-6">
                {[
                  { key: 'details' as const, label: 'Details' },
                  { key: 'measurements' as const, label: 'Measurements' },
                  { key: 'fabrics' as const, label: 'Fabrics' },
                  { key: 'tryon' as const, label: '3D TryOn' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`pb-3 text-sm font-medium capitalize transition-colors relative ${
                      activeTab === tab.key ? 'text-black' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.key && (
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
                  {design.hasAdditionalMaterialOrFabric ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Additional fabric/material outside of the primary fabric will be used in making this design.
                    </p>
                  ) : null}
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
                  {fabricSelectionMode === 'DESIGNER_DECIDES' ? (
                    <div className="rounded border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
                      Suitable fabrics are hidden because you selected{' '}
                      <span className="font-semibold">Let designer/tailor choose fabric</span>. You can continue below.
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        Select a fabric for your design. All fabrics are from sellers in the same country as your designer.
                      </p>
                      {design.suitableFabrics.length === 0 ? (
                        <div className="rounded border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
                          No suitable fabrics are available for this design yet. You can still continue with
                          &nbsp;<span className="font-semibold">Let designer/tailor choose fabric</span>.
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {design.suitableFabrics.map(({ fabric }) => (
                              <button
                                key={fabric.id}
                                type="button"
                                onClick={() => setSelectedFabric(fabric.id)}
                                className={`flex items-center gap-2 border px-2 py-2 text-left transition-colors ${
                                  selectedFabric === fabric.id
                                    ? 'border-black bg-black text-white'
                                    : 'border-gray-200 bg-white text-gray-800 hover:border-black'
                                }`}
                              >
                                <img
                                  src={fabric.images[0]}
                                  alt={fabric.name}
                                  className="h-10 w-10 flex-shrink-0 object-cover"
                                />
                                <span className="line-clamp-2 text-xs font-medium">{fabric.name}</span>
                              </button>
                            ))}
                          </div>
                          {(() => {
                            const selectedRow = design.suitableFabrics.find((entry) => entry.fabric.id === selectedFabric);
                            if (!selectedRow) {
                              return (
                                <p className="text-sm text-gray-600">
                                  Select a fabric thumbnail to view details and set quantity.
                                </p>
                              );
                            }
                            const { fabric, minMeters, maxMeters } = selectedRow;
                            const minYards = Math.max(1, Number(minMeters || 1));
                            const maxYards = Math.max(minYards, Number(maxMeters || minYards));
                            const currentYards = clampWithin(
                              Number(fabricMeters[fabric.id] || minYards),
                              minYards,
                              maxYards
                            );
                            const minDisplay = convertYardsToUnit(minYards, fabricUnit);
                            const maxDisplay = convertYardsToUnit(maxYards, fabricUnit);
                            const currentDisplay = convertYardsToUnit(currentYards, fabricUnit);
                            const displayDecimals = fabricUnit === 'CENTIMETERS' ? 0 : 2;
                            const pricePerYard = Number(fabric.pricePerMeter || 0);
                            const requiredFabricPrice = pricePerYard * currentYards;
                            return (
                              <div className="border bg-white p-4">
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
                                          {formatFromUsd(pricePerYard)}/yard
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {minYards.toFixed(2)}-{maxYards.toFixed(2)} yards needed
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 border-t border-gray-200 pt-3">
                                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr]">
                                        <div>
                                          <label className="mb-1 block text-xs font-medium text-gray-600">Unit</label>
                                          <select
                                            value={fabricUnit}
                                            onChange={(event) => setFabricUnit(event.target.value as FabricLengthUnit)}
                                            className="w-full border px-2 py-2 text-sm"
                                          >
                                            <option value="YARDS">Yards</option>
                                            <option value="METERS">Meters</option>
                                            <option value="CENTIMETERS">Centimeters</option>
                                          </select>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-gray-600">
                                            Required quantity ({unitLabel(fabricUnit)})
                                          </p>
                                          <p className="border bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
                                            {currentDisplay.toFixed(displayDecimals)} {unitLabel(fabricUnit)}
                                          </p>
                                          <p className="text-xs text-gray-600">
                                            Fabric total: {currentYards.toFixed(2)} yard{currentYards === 1 ? '' : 's'} ×{' '}
                                            {formatFromUsd(pricePerYard)}/yard = <span className="font-semibold">{formatFromUsd(requiredFabricPrice)}</span>
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </>
                  )}
                  <div className="pt-2">
                    <Button className="w-full rounded-none" onClick={handleContinueFromFabrics}>
                      Continue to 3D TryOn options
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'measurements' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Select your measurements to start this design process.
                    </p>
                    <button
                      onClick={() => setShowMeasurementModal(true)}
                      className="text-sm font-medium text-black hover:text-gray-700"
                    >
                      How to measure?
                    </button>
                  </div>
                  {design.measurements.length === 0 ? (
                    <div className="rounded border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
                      Required measurements are not configured for this CTW product yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {design.measurements.map((measurement) => (
                        <div key={measurement.name} className="space-y-1">
                          <label className="text-sm font-medium text-gray-700">
                            {measurement.name} ({measurement.unit || 'cm'})
                            {measurement.isRequired && <span className="text-red-500">*</span>}
                          </label>
                          <select
                            value={measurements[measurement.name] || ''}
                            onChange={(event) => handleMeasurementChange(measurement.name, Number(event.target.value || 0))}
                            className="w-full border px-3 py-2 text-sm focus:border-black focus:ring-2 focus:ring-black/20"
                          >
                            <option value="">Select value</option>
                            {buildMeasurementDropdownOptions(measurement.name, measurement.unit).map((value) => (
                              <option key={`${measurement.name}-${value}`} value={value}>
                                {value} {measurement.unit || 'cm'}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!user || String(user.role || '').toUpperCase() !== 'CUSTOMER') ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border bg-gray-50 p-3 text-xs text-gray-700">
                      <span>Sign in to keep your measurements saved across every product and TryOn flow.</span>
                      <Button
                        variant="outline"
                        className="rounded-none"
                        onClick={handleContinueToLoginForMeasurementSync}
                      >
                        Sign in to sync
                      </Button>
                    </div>
                  ) : null}
                  <Button
                    className="w-full rounded-none"
                    onClick={() => void handleContinueFromMeasurements()}
                    disabled={!areAllRequiredMeasurementsFilled() || persistingMeasurements}
                  >
                    {persistingMeasurements ? 'Saving measurements...' : 'Submit measurements & continue to fabrics'}
                  </Button>
                </div>
              )}

              {activeTab === 'tryon' && (
                <div className="space-y-4">
                  <div className="border bg-gray-50 p-4 text-sm text-gray-700">
                    Keep everything on this page: choose whether to run 3D TryOn before adding to cart.
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setTryOnChoice('RUN_TRY_ON')}
                      className={`border px-3 py-2 text-left text-sm ${
                        tryOnChoice === 'RUN_TRY_ON'
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 bg-white text-gray-800'
                      }`}
                    >
                      Yes, open 3D TryOn popup
                    </button>
                    <button
                      type="button"
                      onClick={() => setTryOnChoice('SKIP_TRY_ON')}
                      className={`border px-3 py-2 text-left text-sm ${
                        tryOnChoice === 'SKIP_TRY_ON'
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 bg-white text-gray-800'
                      }`}
                    >
                      Skip 3D TryOn and continue
                    </button>
                  </div>
                  {tryOnChoice === 'RUN_TRY_ON' ? (
                    <Button className="w-full rounded-none" onClick={() => void handleOpenTryOnPopup()}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Open 3D TryOn popup
                    </Button>
                  ) : null}
                  {tryOnChoice === 'SKIP_TRY_ON' ? (
                    <Button className="w-full rounded-none" onClick={() => void handleAddToCart()}>
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Add product to cart
                    </Button>
                  ) : null}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                className="flex-1 rounded-none"
                onClick={handleTryOn}
              >
                <Eye className="w-4 h-4 mr-2" />
                3D TryOn
              </Button>
              <Button
                className="flex-1 rounded-none"
                onClick={handleStartDesignFlow}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Start Design
              </Button>
            </div>

            {fabricSelectionMode === 'CUSTOMER_SELECTED' && !selectedFabric && (
              <p className="text-sm text-gray-700 text-center">
                Please select a fabric to continue
              </p>
            )}
            {!hasRequiredMeasurementConfig ? (
              <p className="text-sm text-red-700 text-center">
                This design is missing required measurement setup. Please contact support.
              </p>
            ) : !areAllRequiredMeasurementsFilled() ? (
              <p className="text-sm text-gray-700 text-center">
                Complete required measurements to continue through fabrics and 3D TryOn.
              </p>
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
            <div className="flex gap-4 overflow-x-auto pb-2">
              {discoverProducts.map((entry) => {
                const href =
                  entry.productType === 'DESIGN'
                    ? `/custom/${entry.id}`
                    : entry.productType === 'FABRIC'
                      ? `/fabrics/${entry.id}`
                      : `/ready-to-wear/${entry.id}`;
                return (
                  <Link
                    key={`${entry.productType}-${entry.id}`}
                    to={href}
                    className="group min-w-[220px] max-w-[220px] overflow-hidden rounded-xl border bg-white"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden rounded-t-xl bg-gray-100">
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

      {cartMessage ? (
        <div className="fixed right-4 top-24 z-[60] w-[min(92vw,360px)] border border-emerald-200 bg-emerald-50 p-3 shadow-lg">
          <p className="text-sm font-medium text-emerald-800">{cartMessage}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button className="rounded-none text-xs" onClick={() => navigate('/checkout')}>
              Checkout now
            </Button>
            <Button variant="outline" className="rounded-none text-xs" onClick={() => navigate('/cart')}>
              View cart
            </Button>
          </div>
        </div>
      ) : null}

      {showTryOnPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">3D TryOn preview (mimic)</h3>
              <button type="button" onClick={() => setShowTryOnPopup(false)} className="p-1 text-gray-500 hover:bg-gray-100">
                ×
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-gray-700">
                Your measurements are prefilled from this product flow and reused for future TryOn sessions.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {design.measurements.map((measurement) => (
                  <label key={`tryon-popup-${measurement.name}`} className="space-y-1">
                    <span className="text-xs font-medium text-gray-600">
                      {measurement.name} ({measurement.unit || 'cm'})
                    </span>
                    <select
                      value={measurements[measurement.name] || ''}
                      onChange={(event) => handleMeasurementChange(measurement.name, Number(event.target.value || 0))}
                      className="w-full border px-3 py-2 text-sm"
                    >
                      <option value="">Select value</option>
                      {buildMeasurementDropdownOptions(measurement.name, measurement.unit).map((value) => (
                        <option key={`tryon-option-${measurement.name}-${value}`} value={value}>
                          {value} {measurement.unit || 'cm'}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="border bg-gray-50 p-4">
                {tryOnGenerated ? (
                  <div className="space-y-2">
                    <img
                      src={design.images?.[0] || '/images/placeholder.jpg'}
                      alt="TryOn preview"
                      className="h-48 w-full object-cover"
                    />
                    <p className="text-sm text-emerald-700">3D preview generated successfully (mock preview).</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700">
                    Click Generate 3D Image to mimic the try-on preview using your saved measurements.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
              <Button
                className="rounded-none"
                onClick={() => void handleGenerateTryOnPreview()}
                disabled={tryOnGenerating || !areAllRequiredMeasurementsFilled()}
              >
                {tryOnGenerating ? 'Generating...' : 'Generate 3D Image'}
              </Button>
              <Button variant="outline" className="rounded-none" onClick={() => setShowTryOnPopup(false)}>
                Back to product
              </Button>
              <Button
                className="rounded-none"
                onClick={() => void handleTryOnAddToCart()}
                disabled={!tryOnGenerated}
              >
                Add product to cart
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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
