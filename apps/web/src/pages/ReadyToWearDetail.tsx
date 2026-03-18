import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Star, MapPin, Truck, Check, Loader2, Sparkles, Ruler, X, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';
import {
  buildMeasurementDropdownOptions,
  normalizeMeasurementKey,
  readMeasurementCache,
  writeMeasurementCache,
} from '../utils/measurementOptions';

const MEASUREMENT_CACHE_KEY = 'af_customer_measurement_profile_v1';

interface ReadyToWearProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: { url: string }[];
  designer: {
    id: string;
    businessName: string;
    country: string;
    rating: number;
    reviewCount: number;
    profileImage?: string;
    user?: { avatar?: string };
  };
  category?: { id: string; name: string };
  sizeVariations?: Array<{ id?: string; size: string; color?: string; variantKey?: string; price: number; stock?: number }>;
  productLabels?: Array<{
    id: string;
    name: string;
    textColor: string;
    backgroundColor: string;
    sizePercent?: number;
    fontSizePx?: number;
    isBold?: boolean;
  }>;
  colors?: string[];
  material?: string;
  careInstructions?: string;
  shippingInfo?: string;
  inStock?: boolean;
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

interface TryOnMeasurements {
  height: number;
  bust: number;
  waist: number;
  hips: number;
  shoulder: number;
}

const DEFAULT_TRY_ON_MEASUREMENTS: TryOnMeasurements = {
  height: 168,
  bust: 90,
  waist: 72,
  hips: 98,
  shoulder: 40,
};
const DEFAULT_VARIANT_COLOR = 'DEFAULT';

export default function ReadyToWearDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { formatFromUsd } = useCurrencyStore();
  const { addReadyToWearItem } = useCartStore();
  const [product, setProduct] = useState<ReadyToWearProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewAverage, setReviewAverage] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [discoverProducts, setDiscoverProducts] = useState<DiscoverProduct[]>([]);
  const [addToCartMessage, setAddToCartMessage] = useState('');
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [showSizeGuideModal, setShowSizeGuideModal] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState<'DESCRIPTION' | 'SIZE_GUIDE' | 'SHIPPING' | 'REVIEWS'>('DESCRIPTION');
  const [tryOnMeasurements, setTryOnMeasurements] = useState<TryOnMeasurements>(DEFAULT_TRY_ON_MEASUREMENTS);
  const [tryOnPreviewReady, setTryOnPreviewReady] = useState(false);
  const [measurementSyncing, setMeasurementSyncing] = useState(false);
  const [sizeGuide, setSizeGuide] = useState<{ title: string; content: string }>({
    title: 'Ready-To-Wear Size Guide',
    content: '',
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response = await api.products.getReadyToWearProduct(id);
        if (response.success) {
          setProduct(response.data);
          const firstAvailableVariant = (response.data.sizeVariations || []).find(
            (variation: any) => Number(variation?.stock || 0) > 0
          );
          const firstAvailableSize = firstAvailableVariant?.size;
          if (firstAvailableSize) {
            setSelectedSize(firstAvailableSize);
          }
          const firstAvailableColor = String(firstAvailableVariant?.color || DEFAULT_VARIANT_COLOR);
          if (firstAvailableColor) {
            setSelectedColor(firstAvailableColor);
          } else if (response.data.colors && response.data.colors.length > 0) {
            setSelectedColor(response.data.colors[0]);
          }
        } else {
          setError('Failed to load product details');
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Failed to load product details');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.allSettled([
      api.products.getProductLikes('ready-to-wear', id),
      api.products.getProductReviews('ready-to-wear', id, 12),
      api.products.getDiscoverByCountry('ready-to-wear', id, 12),
    ]).then(([likesResult, reviewsResult, discoverResult]) => {
      if (cancelled) return;
      if (likesResult.status === 'fulfilled' && likesResult.value.success) {
        const count = Number(likesResult.value.data?.count || 0);
        const liked = Boolean(likesResult.value.data?.likedByMe);
        setLikeCount(count);
        setIsWishlisted(liked);
      } else {
        setLikeCount(0);
        setIsWishlisted(false);
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
    let cancelled = false;
    api.products
      .getReadyToWearSizeGuide()
      .then((response) => {
        if (!cancelled && response.success) {
          setSizeGuide({
            title: String(response.data?.title || 'Ready-To-Wear Size Guide'),
            content: String(response.data?.content || ''),
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!addToCartMessage) return;
    const timer = window.setTimeout(() => setAddToCartMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [addToCartMessage]);

  const applyMeasurementSeed = (seed: Record<string, number>) => {
    setTryOnMeasurements((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(previous) as Array<keyof TryOnMeasurements>) {
        const seededValue = Number(seed[normalizeMeasurementKey(key)] || 0);
        if (seededValue > 0) next[key] = seededValue;
      }
      return next;
    });
  };

  useEffect(() => {
    const localSeed = readMeasurementCache(MEASUREMENT_CACHE_KEY);
    if (Object.keys(localSeed).length > 0) {
      applyMeasurementSeed(localSeed);
    }
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
        if (Object.keys(normalized).length === 0) return;
        applyMeasurementSeed(normalized);
        writeMeasurementCache(MEASUREMENT_CACHE_KEY, normalized);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const persistTryOnMeasurements = async (values: TryOnMeasurements) => {
    const normalized = Object.entries(values || {}).reduce((acc, [key, value]) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return acc;
      acc[normalizeMeasurementKey(key)] = Number(parsed.toFixed(2));
      return acc;
    }, {} as Record<string, number>);
    writeMeasurementCache(MEASUREMENT_CACHE_KEY, normalized);
    if (!user || String(user.role || '').toUpperCase() !== 'CUSTOMER') return;
    try {
      setMeasurementSyncing(true);
      await api.customer.saveMeasurements({ measurements: normalized });
    } catch {
      // Keep product flow uninterrupted.
    } finally {
      setMeasurementSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'Product not found'}</p>
          <Link to="/ready-to-wear" className="text-black hover:underline">
            Back to Ready To Wear
          </Link>
        </div>
      </div>
    );
  }

  const flagCode = resolveCountryCode(product.designer?.country);
  const designerProfileImage = String(
    product.designer?.profileImage || product.designer?.user?.avatar || ''
  ).trim();
  const storefrontPath = product.designer?.id
    ? `/store/designer/${product.designer.id}/${encodeURIComponent(
        String(product.designer.businessName || 'designer')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'designer'
      )}`
    : null;
  const inStockVariations = (product.sizeVariations || []).filter((variation) => Number(variation.stock || 0) > 0);
  const availableColors = Array.from(
    new Set(
      [
        ...inStockVariations.map((variation) => String(variation.color || DEFAULT_VARIANT_COLOR).trim().toUpperCase()),
        ...((product.colors || []).map((color) => String(color || '').trim().toUpperCase()).filter(Boolean) as string[]),
      ].filter(Boolean)
    )
  );
  const effectiveSelectedColor = availableColors.includes(String(selectedColor || '').toUpperCase())
    ? String(selectedColor || '').toUpperCase()
    : availableColors[0] || DEFAULT_VARIANT_COLOR;
  const availableSizes = Array.from(
    new Set(
      inStockVariations
        .filter((variation) => String(variation.color || DEFAULT_VARIANT_COLOR).trim().toUpperCase() === effectiveSelectedColor)
        .map((variation) => String(variation.size || '').trim())
        .filter(Boolean)
    )
  );
  const effectiveSelectedSize = availableSizes.includes(selectedSize) ? selectedSize : availableSizes[0] || '';
  const matchingVariation =
    (product.sizeVariations || []).find(
      (variation) =>
        variation.size === effectiveSelectedSize &&
        String(variation.color || DEFAULT_VARIANT_COLOR).trim().toUpperCase() === effectiveSelectedColor
    ) ||
    (product.sizeVariations || []).find((variation) => variation.size === effectiveSelectedSize);
  const selectedUnitPrice = Number(matchingVariation?.price || product.price || 0);
  const hasDiscount = product.originalPrice && product.originalPrice > selectedUnitPrice;
  const selectedVariantStock = Number(matchingVariation?.stock || 0);
  const isSelectedVariantInStock = selectedVariantStock > 0;
  const canGoPrevImage = selectedImage > 0;
  const canGoNextImage = selectedImage < Math.max(0, (product.images?.length || 1) - 1);

  const handleAddToCart = async () => {
    if (!product) return;
    if (!effectiveSelectedSize) {
      setAddToCartMessage('Please select a size before adding to cart.');
      return;
    }
    await persistTryOnMeasurements(tryOnMeasurements);

    addReadyToWearItem({
      readyToWearId: product.id,
      productName: product.name,
      productImage: product.images?.[0]?.url || '/images/placeholder.jpg',
      selectedSize: effectiveSelectedSize,
      selectedColor: effectiveSelectedColor === DEFAULT_VARIANT_COLOR ? undefined : effectiveSelectedColor,
      quantity,
      unitPrice: selectedUnitPrice,
      designerName: product.designer?.businessName || 'Designer',
      categoryName: product.category?.name,
      tryOnMeasurements: tryOnPreviewReady ? { ...tryOnMeasurements } : {},
    });
    setAddToCartMessage(
      user
        ? 'Product added to cart. Use Checkout when you are ready.'
        : 'Product added to cart. Sign in during checkout to complete your order.'
    );
  };

  const handleToggleLike = async () => {
    if (!id) return;
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const response = await api.products.toggleProductLike('ready-to-wear', id);
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
      const response = await api.products.createProductReview('ready-to-wear', id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      if (response.success) {
        setReviewComment('');
        const nextReviews = await api.products.getProductReviews('ready-to-wear', id, 12);
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

  const openTryOnModal = () => {
    setTryOnPreviewReady(false);
    setShowTryOnModal(true);
  };

  const handleGenerateTryOnPreview = async () => {
    setTryOnPreviewReady(false);
    await persistTryOnMeasurements(tryOnMeasurements);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setTryOnPreviewReady(true);
  };

  const handleCloseTryOnModal = () => {
    setShowTryOnModal(false);
  };

  const handleTryOnAddToCart = async () => {
    await handleAddToCart();
    setShowTryOnModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <Link to="/ready-to-wear" className="mb-6 inline-flex items-center text-gray-500 hover:text-black">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Ready to Wear
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="contents">
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl bg-gray-100" style={{ aspectRatio: '3/4' }}>
                <img
                  src={product.images?.[selectedImage]?.url || '/images/placeholder.jpg'}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
                {flagCode ? (
                  <img
                    src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                    alt={`${product.designer?.country || 'Country'} flag`}
                    className="absolute bottom-3 right-3 h-8 w-11 rounded-sm object-cover shadow-lg"
                    loading="lazy"
                  />
                ) : null}

                {(product.images?.length || 0) > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => canGoPrevImage && setSelectedImage((prev) => Math.max(0, prev - 1))}
                      className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-white/90 text-gray-700 shadow-lg hover:bg-white"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => canGoNextImage && setSelectedImage((prev) => Math.min((product.images?.length || 1) - 1, prev + 1))}
                      className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-white/90 text-gray-700 shadow-lg hover:bg-white"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={handleToggleLike}
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center bg-white/90 shadow-lg transition-colors hover:bg-white"
                  aria-label="Save to wishlist"
                >
                  <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                </button>
                <div className="absolute left-4 top-4 rounded-full bg-black/65 px-2 py-1 text-xs font-medium text-white">
                  {likeCount} likes
                </div>
              </div>

              {(product.images?.length || 0) > 1 ? (
                <div className="flex items-center justify-center gap-2">
                  {product.images.map((image, idx) => (
                    <button
                      key={`${image.url}-${idx}`}
                      type="button"
                      onClick={() => setSelectedImage(idx)}
                      className={`h-2.5 w-2.5 border transition ${
                        selectedImage === idx ? 'border-black bg-black' : 'border-gray-300 bg-white'
                      }`}
                    />
                  ))}
                </div>
              ) : null}

              {(product.images?.length || 0) > 1 ? (
                <div className="grid grid-cols-5 gap-2">
                  {product.images.slice(0, 5).map((img, idx) => (
                    <button
                      key={`thumb-${img.url}-${idx}`}
                      type="button"
                      onClick={() => setSelectedImage(idx)}
                      className={`overflow-hidden border ${
                        selectedImage === idx ? 'border-black' : 'border-gray-200'
                      }`}
                    >
                      <img src={img.url} alt="" className="h-20 w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {product.category?.name || 'Ready to Wear'}
                  </span>
                  {flagCode ? (
                    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      <img
                        src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                        alt={`${product.designer?.country || 'Country'} flag`}
                        className="h-3.5 w-5 rounded-sm object-cover"
                        loading="lazy"
                      />
                      {product.designer?.country || 'Africa'}
                    </span>
                  ) : null}
                </div>
                <button type="button" className="p-2 hover:bg-gray-100 transition-colors" aria-label="Share product">
                  <Share2 className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              <div>
                <h1 className="text-3xl font-semibold text-gray-900">{product.name}</h1>
                {(product.productLabels || []).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(product.productLabels || []).map((label) => (
                      <span
                        key={`${product.id}-detail-label-${label.id}`}
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
                ) : null}
                <p className="mt-1 text-xl italic text-gray-700">
                  by{' '}
                  {storefrontPath ? (
                    <Link to={storefrontPath} className="underline hover:text-black">
                      {product.designer?.businessName || 'Designer'}
                    </Link>
                  ) : (
                    <span className="underline">{product.designer?.businessName || 'Designer'}</span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveInfoTab('REVIEWS')}
                className="inline-flex items-center gap-2 text-left"
              >
                <div className="flex items-center gap-0.5 text-yellow-500">
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const value = reviewAverage > 0 ? reviewAverage : Number(product.designer?.rating || 0);
                    return (
                      <Star
                        key={`star-${idx}`}
                        className={`h-4 w-4 ${idx < Math.round(value) ? 'fill-current' : ''}`}
                      />
                    );
                  })}
                </div>
                <span className="text-sm text-black underline">
                  {reviewCount || Number(product.designer?.reviewCount || 0)} reviews
                </span>
              </button>

              <p className="text-base leading-relaxed text-gray-700">{product.description}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-800">Select your size</p>
                  {availableSizes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-none border px-3 text-sm ${
                            effectiveSelectedSize === size
                              ? 'border-black bg-black text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-black'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">No sizes currently available.</p>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">Color</p>
                    <button
                      type="button"
                      onClick={() => setShowSizeGuideModal(true)}
                      className="inline-flex items-center gap-1 text-xs text-black hover:underline"
                    >
                      <Ruler className="h-3.5 w-3.5" />
                      Size Guide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        title={color === DEFAULT_VARIANT_COLOR ? 'Default' : color}
                        className={`h-8 w-8 rounded-none border-2 ${
                          effectiveSelectedColor === color ? 'border-black' : 'border-gray-300'
                        }`}
                        style={{
                          background:
                            color === DEFAULT_VARIANT_COLOR
                              ? 'radial-gradient(circle at 30% 30%, #f4f4f5, #d4d4d8)'
                              : String(color).startsWith('#')
                                ? color
                                : undefined,
                        }}
                      >
                        {color !== DEFAULT_VARIANT_COLOR && !String(color).startsWith('#') ? (
                          <span className="sr-only">{color}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className={`text-sm font-medium ${isSelectedVariantInStock ? 'text-gray-700' : 'text-red-600'}`}>
                {isSelectedVariantInStock
                  ? `Only ${selectedVariantStock} left in stock`
                  : 'Selected variant is currently out of stock'}
              </p>

              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500">The Designer</p>
                  <p className="text-4xl font-semibold text-gray-900">{formatFromUsd(selectedUnitPrice)}</p>
                  {hasDiscount ? (
                    <p className="text-sm text-gray-400 line-through">{formatFromUsd(Number(product.originalPrice || 0))}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 border border-gray-300 bg-white px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    className="h-8 w-8 text-xl text-gray-700 hover:text-black"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-lg font-medium text-gray-900">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => prev + 1)}
                    className="h-8 w-8 text-xl text-gray-700 hover:text-black"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="ghost"
                  className="w-full rounded-none border-0 bg-black py-3 text-white hover:bg-gray-800"
                  onClick={openTryOnModal}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  3D TryOn
                </Button>
                <Button
                  className="w-full rounded-none py-3"
                  onClick={() => void handleAddToCart()}
                  disabled={!effectiveSelectedSize || !isSelectedVariantInStock}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to Cart
                </Button>
              </div>

              <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                <Check className="h-4 w-4" />
                Free shipping on orders over $250
              </div>

              <div className="border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden bg-gray-100">
                    {designerProfileImage ? (
                      <img
                        src={designerProfileImage}
                        alt={product.designer?.businessName || 'Designer'}
                        className="h-full w-full object-cover"
                      />
                    ) : flagCode ? (
                      <img
                        src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                        alt={`${product.designer?.country || 'Country'} flag`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    {storefrontPath ? (
                      <Link to={storefrontPath} className="truncate font-semibold text-gray-900 hover:underline">
                        {product.designer?.businessName || 'Designer'}
                      </Link>
                    ) : (
                      <p className="truncate font-semibold text-gray-900">{product.designer?.businessName || 'Designer'}</p>
                    )}
                    <p className="line-clamp-2 text-xs text-gray-500">
                      Innovative designs crafted with African heritage and modern luxury style.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center border-b border-gray-200 px-4 sm:px-6">
            {[
              { key: 'DESCRIPTION' as const, label: 'Description' },
              { key: 'SIZE_GUIDE' as const, label: 'Size Guide' },
              { key: 'SHIPPING' as const, label: 'Shipping' },
              { key: 'REVIEWS' as const, label: 'Reviews' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveInfoTab(tab.key)}
                className={`mr-6 py-3 text-sm font-medium transition ${
                  activeInfoTab === tab.key
                    ? 'border-b-2 border-black text-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-4 py-5 sm:px-6">
            {activeInfoTab === 'DESCRIPTION' ? (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-gray-700">{product.description}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Material</p>
                    <p className="mt-1 text-sm text-gray-800">{product.material || 'Not specified'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Care Instructions</p>
                    <p className="mt-1 text-sm text-gray-800">{product.careInstructions || 'Handle with care; dry clean recommended.'}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeInfoTab === 'SIZE_GUIDE' ? (
              <p className="whitespace-pre-line text-sm leading-6 text-gray-700">
                {sizeGuide.content || 'Size guide details are not configured yet.'}
              </p>
            ) : null}

            {activeInfoTab === 'SHIPPING' ? (
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-4 w-4 text-gray-500" />
                  <p>{product.shippingInfo || 'Shipping options are calculated at checkout based on destination.'}</p>
                </div>
                <p className="bg-gray-100 px-3 py-2 text-gray-700">
                  Free shipping automatically applies when your order subtotal is above $250.
                </p>
              </div>
            ) : null}

            {activeInfoTab === 'REVIEWS' ? (
              <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Your Rating</label>
                  <select
                    value={reviewRating}
                    onChange={(event) => setReviewRating(Number(event.target.value))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
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
                    className="h-24 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Share your experience with this product..."
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
                      <div key={review.id} className="rounded-lg border p-3">
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
            ) : null}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white px-4 py-5 sm:px-6">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">You May Also Like</h2>
          {discoverProducts.length === 0 ? (
            <p className="text-sm text-gray-500">No recommendations available yet.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {discoverProducts.map((entry) => {
                const href =
                  entry.productType === 'DESIGN'
                    ? `/designs/${entry.id}`
                    : entry.productType === 'FABRIC'
                      ? `/fabrics/${entry.id}`
                      : `/ready-to-wear/${entry.id}`;
                return (
                  <Link
                    key={`${entry.productType}-${entry.id}`}
                    to={href}
                    className="group min-w-[220px] max-w-[220px]"
                  >
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                      <img
                        src={entry.image || '/images/placeholder.jpg'}
                        alt={entry.name}
                        className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="pt-2 text-sm">
                      <p className="line-clamp-1 font-medium text-gray-900">{entry.name}</p>
                      <p className="line-clamp-1 text-gray-500">{formatFromUsd(Number(entry.priceUsd || 0))}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {addToCartMessage ? (
        <div className="fixed right-4 top-24 z-[60] w-[min(92vw,360px)] border border-emerald-200 bg-emerald-50 p-3 shadow-lg">
          <p className="text-sm font-medium text-emerald-800">{addToCartMessage}</p>
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

      {showTryOnModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Virtual Try-On</h3>
                <p className="text-xs text-gray-500">
                  Enter your body measurements. Size selection remains separate from Try-On.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseTryOnModal}
                className="p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                Uses your saved measurement profile so you don&apos;t enter values twice.
              </p>
              {(!user || String(user.role || '').toUpperCase() !== 'CUSTOMER') ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <span>Sign in to keep these measurements synced across products.</span>
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() =>
                      navigate(`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`, {
                        state: { from: location },
                      })
                    }
                  >
                    Sign in
                  </Button>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(tryOnMeasurements) as Array<keyof TryOnMeasurements>).map((key) => (
                  <label key={key} className="space-y-1">
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-600">
                      {key} (cm)
                    </span>
                    <select
                      value={tryOnMeasurements[key]}
                      onChange={(event) => {
                        const value = Number(event.target.value || 0);
                        setTryOnMeasurements((previous) => ({ ...previous, [key]: value }));
                        writeMeasurementCache(MEASUREMENT_CACHE_KEY, { ...tryOnMeasurements, [key]: value });
                        setTryOnPreviewReady(false);
                      }}
                      className="w-full border px-3 py-2 text-sm"
                    >
                      {buildMeasurementDropdownOptions(key, 'cm').map((value) => (
                        <option key={`rtw-tryon-${key}-${value}`} value={value}>
                          {value} cm
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="border bg-gray-50 p-3 text-sm text-gray-700">
                {tryOnPreviewReady
                  ? 'Preview profile generated successfully. Continue shopping and add your selected size to cart.'
                  : 'Generate your preview profile before closing this popup.'}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
              <Button variant="ghost" className="rounded-none border-0 bg-black text-white hover:bg-gray-800" onClick={handleGenerateTryOnPreview}>
                {measurementSyncing ? 'Saving...' : 'Generate 3D Image'}
              </Button>
              <Button className="rounded-none" onClick={() => void handleTryOnAddToCart()} disabled={!tryOnPreviewReady}>
                Add product to cart
              </Button>
              <Button variant="ghost" className="rounded-none border-0 bg-black text-white hover:bg-gray-800" onClick={handleCloseTryOnModal}>
                Back to product
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showSizeGuideModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div className="inline-flex items-center gap-2">
                <Ruler className="h-5 w-5 text-black" />
                <h3 className="text-lg font-semibold text-gray-900">{sizeGuide.title || 'Size Guide'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSizeGuideModal(false)}
                className="p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <p className="whitespace-pre-line text-sm leading-6 text-gray-700">
                {sizeGuide.content || 'Size guide details are not configured yet.'}
              </p>
            </div>
            <div className="border-t px-5 py-4 text-right">
              <Button className="rounded-none" onClick={() => setShowSizeGuideModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-700">
              Size: <span className="font-semibold">{effectiveSelectedSize || 'Not selected'}</span>
            </p>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-black">{formatFromUsd(selectedUnitPrice * quantity)}</p>
          </div>
          <Button variant="ghost" className="flex-1 rounded-none border-0 bg-black text-xs text-white hover:bg-gray-800" onClick={openTryOnModal}>
            Try On
          </Button>
          <Button className="flex-1 rounded-none text-xs" onClick={() => void handleAddToCart()}>
            Add to Bag
          </Button>
        </div>
      </div>
    </div>
  );
}
