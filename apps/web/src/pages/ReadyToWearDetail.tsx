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
  const [activeInfoTab, setActiveInfoTab] = useState<'DESCRIPTION' | 'SIZE_GUIDE' | 'SHIPPING' | 'REVIEWS'>('DESCRIPTION');
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
  const selectedVariantStock = Number(matchingVariation?.stock || 0);
  const isSelectedVariantInStock = selectedVariantStock > 0;
  const canGoPrevImage = selectedImage > 0;
  const canGoNextImage = selectedImage < Math.max(0, (product.images?.length || 1) - 1);

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
    <div className="min-h-screen bg-gray-50 pb-28 pt-28 md:pb-8 md:pt-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <Link to="/" className="hover:text-coral-600">
            Home
          </Link>
          <span>&gt;</span>
          <Link to="/ready-to-wear" className="hover:text-coral-600">
            Shop
          </Link>
          <span>&gt;</span>
          <span className="text-gray-700">Ready to Wear</span>
          <span>&gt;</span>
          <span className="font-medium text-gray-800">{product.name}</span>
        </div>

        <Link to="/ready-to-wear" className="mb-5 inline-flex items-center text-sm text-gray-500 hover:text-coral-500">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Ready to Wear
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 lg:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl bg-gray-100" style={{ aspectRatio: '3/4' }}>
                <img
                  src={product.images?.[selectedImage]?.url || '/images/placeholder.jpg'}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />

                {(product.images?.length || 0) > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => canGoPrevImage && setSelectedImage((prev) => Math.max(0, prev - 1))}
                      className="absolute left-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => canGoNextImage && setSelectedImage((prev) => Math.min((product.images?.length || 1) - 1, prev + 1))}
                      className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white"
                    >
                      ›
                    </button>
                  </>
                ) : null}
              </div>

              {(product.images?.length || 0) > 1 ? (
                <div className="flex items-center justify-center gap-2">
                  {product.images.map((image, idx) => (
                    <button
                      key={`${image.url}-${idx}`}
                      type="button"
                      onClick={() => setSelectedImage(idx)}
                      className={`h-2.5 w-2.5 rounded-full border transition ${
                        selectedImage === idx ? 'border-coral-500 bg-coral-500' : 'border-gray-300 bg-white'
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
                      className={`overflow-hidden rounded-md border ${
                        selectedImage === idx ? 'border-coral-500' : 'border-gray-200'
                      }`}
                    >
                      <img src={img.url} alt="" className="h-20 w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {flagCode ? (
                  <img
                    src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                    alt={`${product.designer?.country || 'Country'} flag`}
                    className="h-4 w-6 rounded-sm object-cover"
                    loading="lazy"
                  />
                ) : null}
                <span>Made in {product.designer?.country || 'Africa'}</span>
              </div>

              <div>
                <h1 className="text-3xl font-semibold text-gray-900">{product.name}</h1>
                <p className="mt-1 text-xl italic text-gray-700">
                  by{' '}
                  {storefrontPath ? (
                    <Link to={storefrontPath} className="underline hover:text-coral-600">
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
                <div className="flex items-center gap-0.5 text-amber-500">
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
                <span className="text-sm text-coral-600 underline">
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
                          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm ${
                            effectiveSelectedSize === size
                              ? 'border-coral-500 bg-coral-50 text-coral-700'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-coral-300'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-amber-700">No sizes currently available.</p>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">Color</p>
                    <button
                      type="button"
                      onClick={() => setShowSizeGuideModal(true)}
                      className="inline-flex items-center gap-1 text-xs text-coral-600 hover:underline"
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
                        className={`h-8 w-8 rounded-full border-2 ${
                          effectiveSelectedColor === color ? 'border-coral-500' : 'border-gray-300'
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

              <p className={`text-sm font-medium ${isSelectedVariantInStock ? 'text-amber-700' : 'text-red-600'}`}>
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
                <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    className="h-8 w-8 text-xl text-gray-700 hover:text-coral-600"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-lg font-medium text-gray-900">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => prev + 1)}
                    className="h-8 w-8 text-xl text-gray-700 hover:text-coral-600"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button className="w-full py-3" onClick={handleAddToCart} disabled={!effectiveSelectedSize || !isSelectedVariantInStock}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to Cart
                </Button>
                <Button
                  variant="outline"
                  onClick={handleToggleLike}
                  className={`w-full py-3 ${isWishlisted ? 'border-red-500 text-red-500' : ''}`}
                >
                  <Heart className={`mr-2 h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
                  {isWishlisted ? 'Saved' : 'Save to Wishlist'}
                </Button>
              </div>

              <Button variant="outline" className="w-full py-2.5 text-sm" onClick={openTryOnModal}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Virtual Try-On
              </Button>

              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <Check className="h-4 w-4" />
                Free shipping on orders over $250
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                    {flagCode ? (
                      <img
                        src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                        alt={`${product.designer?.country || 'Country'} flag`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{product.designer?.businessName || 'Designer'}</p>
                    <p className="line-clamp-2 text-xs text-gray-500">
                      Innovative designs crafted with African heritage and modern luxury style.
                    </p>
                  </div>
                </div>
                {storefrontPath ? (
                  <Link to={storefrontPath} className="mt-2 inline-flex text-xs font-medium text-coral-600 hover:underline">
                    View Profile
                  </Link>
                ) : null}
              </div>

              {addToCartMessage ? (
                <p className="text-sm text-emerald-700">{addToCartMessage}</p>
              ) : null}
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
                    ? 'border-b-2 border-coral-500 text-coral-600'
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
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
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
                        <p className="text-xs font-medium text-amber-600">{'★'.repeat(Math.max(1, Math.min(5, Number(review.rating || 0))))}</p>
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
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">You may also love</h2>
          {discoverProducts.length === 0 ? (
            <p className="text-sm text-gray-500">No recommendations available yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {discoverProducts.slice(0, 4).map((entry) => {
                const href =
                  entry.productType === 'DESIGN'
                    ? `/designs/${entry.id}`
                    : entry.productType === 'FABRIC'
                      ? `/fabrics/${entry.id}`
                      : `/ready-to-wear/${entry.id}`;
                return (
                  <Link key={`${entry.productType}-${entry.id}`} to={href} className="group">
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
