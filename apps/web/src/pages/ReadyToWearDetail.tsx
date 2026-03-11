import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Star, MapPin, Truck, Check, Loader2, Sparkles, Ruler, X } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';

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
  };
  category?: { id: string; name: string };
  sizeVariations?: Array<{ id?: string; size: string; color?: string; variantKey?: string; price: number; stock?: number }>;
  productLabels?: Array<{ id: string; name: string; textColor: string; backgroundColor: string }>;
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
  const [tryOnMeasurements, setTryOnMeasurements] = useState<TryOnMeasurements>(DEFAULT_TRY_ON_MEASUREMENTS);
  const [tryOnPreviewReady, setTryOnPreviewReady] = useState(false);
  const [sizeGuide, setSizeGuide] = useState<{ title: string; content: string }>({
    title: 'Ready-To-Wear Size Guide',
    content: '',
  });

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-coral-500" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'Product not found'}</p>
          <Link to="/ready-to-wear" className="text-coral-500 hover:underline">
            Back to Ready To Wear
          </Link>
        </div>
      </div>
    );
  }

  const flagCode = resolveCountryCode(product.designer?.country);
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

  const handleAddToCart = () => {
    if (!product) return;
    if (!effectiveSelectedSize) {
      setAddToCartMessage('Please select a size before adding to cart.');
      return;
    }

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
        ? 'Added to cart. You can proceed to checkout.'
        : 'Added to cart. Sign in during checkout to complete your order.'
    );
    navigate('/cart');
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
    await new Promise((resolve) => setTimeout(resolve, 700));
    setTryOnPreviewReady(true);
  };

  const handleContinueToTryOnPage = () => {
    if (!id) return;
    try {
      sessionStorage.setItem(
        `rtwTryOnDraft:${id}`,
        JSON.stringify({
          selectedSize: effectiveSelectedSize || '',
          quantity,
          measurements: tryOnMeasurements,
          generatedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore storage errors; page navigation should still continue.
    }
    setShowTryOnModal(false);
    navigate(`/ready-to-wear/${id}/try-on`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28 pt-32 md:pb-8 md:pt-36">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <Link to="/" className="hover:text-coral-600">
            Home
          </Link>
          <span>/</span>
          <Link to="/ready-to-wear" className="hover:text-coral-600">
            Ready To Wear
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-700">{product.name}</span>
        </div>
        <Link to="/ready-to-wear" className="mb-6 inline-flex items-center text-gray-500 hover:text-coral-500">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Ready to Wear
        </Link>

        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-gray-300 bg-white px-3 py-1">Step 1: Choose size & color</span>
          <span className="rounded-full border border-gray-300 bg-white px-3 py-1">Step 2: Optional virtual try-on</span>
          <span className="rounded-full border border-gray-300 bg-white px-3 py-1">Step 3: Add to cart</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-4">
            <div className="bg-gray-100 overflow-hidden relative" style={{ aspectRatio: '3/4' }}>
              <img
                src={product.images?.[selectedImage]?.url || '/images/placeholder.jpg'}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {(product.productLabels || []).length > 0 ? (
                <div className="absolute left-4 top-4 z-10 flex flex-col gap-1">
                  {(product.productLabels || []).slice(0, 3).map((label) => (
                    <span
                      key={label.id}
                      className="rounded px-2 py-0.5 text-xs font-semibold shadow"
                      style={{ color: label.textColor, backgroundColor: label.backgroundColor }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="absolute bottom-4 right-4 z-10">
                {flagCode ? (
                  <img
                    src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                    alt={`${product.designer?.country || 'Country'} flag`}
                    className="h-8 w-11 rounded-sm object-cover shadow-lg"
                    loading="lazy"
                  />
                ) : null}
              </div>
              {hasDiscount && !((product.productLabels || []).some((label) => String(label.name || '').toUpperCase() === 'SALE')) && (
                <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Sale
                </div>
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, idx) => (
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
                {product.designer?.country || 'Unknown'}
                <span className="mx-2">•</span>
                <span>{product.category?.name || 'Ready To Wear'}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="font-medium">{reviewAverage > 0 ? reviewAverage.toFixed(1) : Number(product.designer?.rating || 0).toFixed(1)}</span>
                  <span className="text-gray-500">({reviewCount || Number(product.designer?.reviewCount || 0)} reviews)</span>
                </div>
                {product.inStock && (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <Check className="w-4 h-4" />
                    In Stock
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-bold text-coral-500">{formatFromUsd(selectedUnitPrice)}</p>
              {hasDiscount && (
                <p className="text-xl text-gray-400 line-through">{formatFromUsd(Number(product.originalPrice || 0))}</p>
              )}
            </div>

            <p className="text-gray-600 leading-relaxed">{product.description}</p>

            {/* Color Selection */}
            {availableColors.length > 0 && (
              <div>
                <span className="font-medium">
                  Color: {effectiveSelectedColor === DEFAULT_VARIANT_COLOR ? 'Default' : effectiveSelectedColor}
                </span>
                <div className="flex gap-2 mt-2">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 border rounded-lg text-sm ${
                        effectiveSelectedColor === color
                          ? 'border-coral-500 bg-coral-50 text-coral-600'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {color === DEFAULT_VARIANT_COLOR ? 'Default' : color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selection + Try On */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Size</span>
                <button
                  type="button"
                  onClick={() => setShowSizeGuideModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-coral-600 hover:underline"
                >
                  <Ruler className="h-3.5 w-3.5" />
                  Size Guide
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {availableSizes.length > 0 ? (
                  <select
                    value={effectiveSelectedSize}
                    onChange={(event) => setSelectedSize(event.target.value)}
                    className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select size</option>
                    {availableSizes.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="min-w-[150px] flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    No standard sizes are currently available for this product.
                  </div>
                )}
                <Button variant="outline" className="px-3 py-2 text-xs" onClick={openTryOnModal}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Try On
                </Button>
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="font-medium">Quantity:</span>
              <div className="flex items-center border rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
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
            </div>

            {/* Total */}
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total:</span>
                <span className="text-2xl font-bold text-coral-500">{formatFromUsd(selectedUnitPrice * quantity)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-coral-200 bg-coral-50 px-3 py-2 text-sm text-coral-700">
                Size selected:{' '}
                <span className="font-semibold text-coral-800">
                  {effectiveSelectedSize || 'Not selected'}
                </span>
              </div>
              <div className="flex gap-4">
                <Button className="flex-1 py-4" onClick={handleAddToCart}>
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Bag
                </Button>
                <Button
                  variant="outline"
                  onClick={handleToggleLike}
                  className={`px-4 ${isWishlisted ? 'text-red-500 border-red-500' : ''}`}
                >
                  <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
                  <span className="ml-2 text-sm">{likeCount}</span>
                </Button>
              </div>
              {addToCartMessage ? (
                <div className="space-y-2">
                  <p className="text-sm text-emerald-700">{addToCartMessage}</p>
                  <Link to="/cart" className="inline-flex text-sm font-medium text-coral-600 hover:underline">
                    Go to Cart & Checkout
                  </Link>
                </div>
              ) : null}
            </div>

            {/* Designer Info */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-3">Designed by</h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-coral-100 rounded-full flex items-center justify-center overflow-hidden">
                  {flagCode ? (
                    <img
                      src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                      alt={`${product.designer?.country || 'Country'} flag`}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  <p className="font-medium">{product.designer?.businessName || 'Unknown Designer'}</p>
                  <p className="text-sm text-gray-500">{product.designer?.country || 'Unknown'}</p>
                </div>
                {storefrontPath ? (
                  <Link to={storefrontPath} className="ml-auto text-sm font-medium text-coral-600 hover:underline">
                    Visit Storefront
                  </Link>
                ) : null}
              </div>
            </div>

            {/* Info */}
            <div className="border-t pt-6 space-y-3">
              {product.material && (
                <div>
                  <p className="font-medium">Material</p>
                  <p className="text-sm text-gray-500">{product.material}</p>
                </div>
              )}
              {product.careInstructions && (
                <div>
                  <p className="font-medium">Care Instructions</p>
                  <p className="text-sm text-gray-500">{product.careInstructions}</p>
                </div>
              )}
              {product.shippingInfo && (
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium">Shipping</p>
                    <p className="text-sm text-gray-500">{product.shippingInfo}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="mt-10 rounded-xl border bg-white p-6">
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
                    <p className="text-xs font-medium text-amber-600">{'★'.repeat(Math.max(1, Math.min(5, Number(review.rating || 0))))}</p>
                    <p className="mt-1 text-sm text-gray-700">{review.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Discover More by Country</h2>
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
                  <Link key={`${entry.productType}-${entry.id}`} to={href} className="group overflow-hidden rounded-lg border bg-white">
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
                      <p className="mt-1 text-sm font-semibold text-coral-600">{formatFromUsd(Number(entry.priceUsd || 0))}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showTryOnModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Virtual Try-On</h3>
                <p className="text-xs text-gray-500">
                  Enter your body measurements. Size selection remains separate from Try-On.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTryOnModal(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="rounded-lg border border-coral-100 bg-coral-50 px-3 py-2 text-xs text-coral-700">
                Use the same measurement profile format as Custom-to-Wear Try-On flow.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(tryOnMeasurements) as Array<keyof TryOnMeasurements>).map((key) => (
                  <label key={key} className="space-y-1">
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-600">
                      {key} (cm)
                    </span>
                    <input
                      type="number"
                      min={key === 'height' ? 145 : 50}
                      max={key === 'height' ? 220 : 180}
                      value={tryOnMeasurements[key]}
                      onChange={(event) => {
                        const value = Math.max(
                          key === 'height' ? 145 : 50,
                          Math.min(key === 'height' ? 220 : 180, Number(event.target.value || 0))
                        );
                        setTryOnMeasurements((previous) => ({ ...previous, [key]: value }));
                        setTryOnPreviewReady(false);
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
              <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                {tryOnPreviewReady
                  ? 'Preview profile generated successfully. Continue shopping and add your selected size to cart.'
                  : 'Generate your preview profile before closing this popup.'}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
              <Button variant="outline" onClick={handleGenerateTryOnPreview}>
                Generate Preview
              </Button>
              <Button onClick={handleContinueToTryOnPage} disabled={!tryOnPreviewReady}>
                Continue to Full Try-On
              </Button>
              <Button variant="outline" onClick={() => setShowTryOnModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showSizeGuideModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div className="inline-flex items-center gap-2">
                <Ruler className="h-5 w-5 text-coral-600" />
                <h3 className="text-lg font-semibold text-gray-900">{sizeGuide.title || 'Size Guide'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSizeGuideModal(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
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
              <Button onClick={() => setShowSizeGuideModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-coral-700">
              Size: <span className="font-semibold">{effectiveSelectedSize || 'Not selected'}</span>
            </p>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-coral-600">{formatFromUsd(selectedUnitPrice * quantity)}</p>
          </div>
          <Button variant="outline" className="flex-1 text-xs" onClick={openTryOnModal}>
            Try On
          </Button>
          <Button className="flex-1 text-xs" onClick={handleAddToCart}>
            Add to Bag
          </Button>
        </div>
      </div>
    </div>
  );
}
