import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Star, MapPin, Ruler, Loader2, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { useCurrencyStore } from '../store/currencyStore';
import { useAuthStore } from '../store/authStore';
import { resolveCountryCode } from '../data/locationOptions';
import { useCartStore } from '../store/cartStore';

interface Fabric {
  id: string;
  name: string;
  description: string;
  predominantColor?: string;
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
    storefrontPath?: string;
  };
  materialType: { id: string; name: string };
  materialTypeName?: string;
  fabricCategory?: { id: string; name: string };
  fabricCategoryName?: string;
  productLabels?: Array<{
    id: string;
    name: string;
    textColor: string;
    backgroundColor: string;
    sizePercent?: number;
    fontSizePx?: number;
    isBold?: boolean;
  }>;
  flag?: string;
  careInstructions?: string;
  shippingInfo?: string;
}

interface ProductReview {
  id: string;
  rating: number;
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

export default function FabricDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { addFabricItem } = useCartStore();
  const [fabric, setFabric] = useState<Fabric | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(3);
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
  const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'reviews'>('details');
  const { formatFromUsd } = useCurrencyStore();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id]);

  useEffect(() => {
    const fetchFabric = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response = await api.products.getFabric(id);
        if (response.success) {
          setFabric(response.data);
          setQuantity(Math.max(3, Number(response.data.minOrderMeters || 3)));
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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.allSettled([
      api.products.getProductLikes('fabric', id),
      api.products.getProductReviews('fabric', id, 12),
      api.products.getDiscoverByCountry('fabric', id, 12),
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  if (error || !fabric) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'Fabric not found'}</p>
          <Link to="/jenks-v14/fabrics" className="text-black hover:underline">
            Back to Fabrics To Buy
          </Link>
        </div>
      </div>
    );
  }

  const flagCode = resolveCountryCode(fabric.seller?.country);
  const storefrontPath = fabric.seller?.id
    ? `/store/seller/${fabric.seller.id}/${encodeURIComponent(
        String(fabric.seller.businessName || 'seller')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'seller'
      )}`
    : null;
  const canGoPrevImage = selectedImage > 0;
  const canGoNextImage = selectedImage < Math.max(0, (fabric.images?.length || 1) - 1);
  const minimumYards = Math.max(3, Number(fabric.minOrderMeters || 3));

  const handleAddToCart = () => {
    if (!fabric) return;
    addFabricItem({
      fabricId: fabric.id,
      fabricName: fabric.name,
      fabricImage: fabric.images?.[selectedImage]?.url || fabric.images?.[0]?.url || '/images/placeholder.jpg',
      yards: Math.max(minimumYards, Number(quantity || minimumYards)),
      pricePerYard: Number(fabric.pricePerMeter || 0),
      sellerName: fabric.seller?.businessName || 'Seller',
    });
    setCartMessage('Fabric added to cart.');
    navigate('/cart');
  };

  const navigateToLoginWithReturn = () => {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`, {
      state: { from: location },
    });
  };

  const handleToggleLike = async () => {
    if (!id) return;
    if (!user) {
      navigateToLoginWithReturn();
      return;
    }
    try {
      const response = await api.products.toggleProductLike('fabric', id);
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
      navigateToLoginWithReturn();
      return;
    }
    if (!reviewComment.trim()) return;
    try {
      setReviewSubmitting(true);
      const response = await api.products.createProductReview('fabric', id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      if (response.success) {
        setReviewComment('');
        const nextReviews = await api.products.getProductReviews('fabric', id, 12);
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Breadcrumb */}
        <Link to="/jenks-v14/fabrics" className="mb-6 inline-flex items-center text-gray-500 hover:text-black">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Fabrics To Buy
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Images */}
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-xl bg-gray-100" style={{ aspectRatio: '3/4' }}>
              <img
                src={fabric.images?.[selectedImage]?.url || '/images/placeholder.jpg'}
                alt={fabric.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 right-4 z-10">
                {flagCode ? (
                  <img
                    src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                    alt={`${fabric.seller?.country || 'Country'} flag`}
                    className="h-8 w-11 rounded-sm object-cover shadow-lg"
                    loading="lazy"
                  />
                ) : null}
              </div>
              {fabric.images && fabric.images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => canGoPrevImage && setSelectedImage((prev) => Math.max(0, prev - 1))}
                    className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-white/90 shadow-lg transition-colors hover:bg-white"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => canGoNextImage && setSelectedImage((prev) => Math.min((fabric.images?.length || 1) - 1, prev + 1))}
                    className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-white/90 shadow-lg transition-colors hover:bg-white"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={handleToggleLike}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center bg-white/90 shadow-lg transition-colors hover:bg-white"
              >
                <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
              </button>
              <div className="absolute left-4 top-4 rounded-full bg-black/65 px-2 py-1 text-xs font-medium text-white">
                {likeCount} likes
              </div>
            </div>
            {fabric.images && fabric.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {fabric.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                      selectedImage === idx ? 'border-black' : 'border-transparent'
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
              <div className="mb-2 flex items-start justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    Fabric: {fabric.fabricCategory?.name || fabric.fabricCategoryName || 'General'}
                  </span>
                  <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    Material Type: {fabric.materialType?.name || fabric.materialTypeName || 'Material'}
                  </span>
                  {fabric.predominantColor ? (
                    <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {String(fabric.predominantColor).toUpperCase()}
                    </span>
                  ) : null}
                  {(fabric.productLabels || []).map((label) => (
                    <span
                      key={`${fabric.id}-detail-label-${label.id}`}
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
                <button type="button" className="p-2 hover:bg-gray-100 transition-colors" aria-label="Share fabric">
                  <Share2 className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <h1 className="text-3xl font-semibold text-gray-900">{fabric.name}</h1>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="font-medium">{reviewAverage > 0 ? reviewAverage.toFixed(1) : Number(fabric.seller?.rating || 0).toFixed(1)}</span>
                  <span className="text-gray-500">({reviewCount || Number(fabric.seller?.reviewCount || 0)} reviews)</span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-gray-600">{Number(fabric.stockMeters || 0)} yards available</span>
              </div>
            </div>

            {/* Seller Info */}
            <div className="border border-gray-200 bg-white p-3">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden bg-gray-100">
                  {flagCode ? (
                    <img
                      src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                      alt={`${fabric.seller?.country || 'Country'} flag`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold text-black">
                      {(fabric.seller?.businessName || 'S').charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  {storefrontPath ? (
                    <Link to={storefrontPath} className="font-semibold text-gray-900 hover:underline">
                      {fabric.seller?.businessName || 'Unknown Seller'}
                    </Link>
                  ) : (
                    <h3 className="font-semibold text-gray-900">{fabric.seller?.businessName || 'Unknown Seller'}</h3>
                  )}
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="h-4 w-4" />
                    {fabric.seller?.country || 'Unknown'}
                  </div>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="bg-gray-100 p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-black">
                  {formatFromUsd(fabric.pricePerMeter)}
                </span>
                <span className="text-gray-500">unit price (/ yard)</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Estimated total ({Math.max(minimumYards, Number(quantity || minimumYards))} yd):{' '}
                {formatFromUsd(fabric.pricePerMeter * Math.max(minimumYards, Number(quantity || minimumYards)))}
              </p>
            </div>

            {/* Tabs */}
            <div className="rounded-t-2xl border border-b-0 border-gray-200 bg-white px-4 sm:px-6">
              <div className="flex gap-6">
                {[
                  { key: 'details' as const, label: 'Details' },
                  { key: 'specs' as const, label: 'Specifications' },
                  { key: 'reviews' as const, label: 'Reviews' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative pb-3 text-sm font-medium transition-colors ${
                      activeTab === tab.key ? 'text-black' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.key ? <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" /> : null}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="min-h-[220px] rounded-b-2xl border border-t-0 border-gray-200 bg-white px-4 py-5 sm:px-6">
              {activeTab === 'details' ? (
                <div className="space-y-4">
                  <p className="leading-relaxed text-gray-600">{fabric.description}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 rounded-lg border bg-white p-3">
                      <Ruler className="h-5 w-5 text-black" />
                      <div>
                        <p className="text-sm font-medium">Minimum Order</p>
                        <p className="text-xs text-gray-500">{minimumYards} yards</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border bg-white p-3">
                      <ShoppingCart className="h-5 w-5 text-black" />
                      <div>
                        <p className="text-sm font-medium">Stock Available</p>
                        <p className="text-xs text-gray-500">{Number(fabric.stockMeters || 0)} yards</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'specs' ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Ruler className="mt-0.5 h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Fabric Width</p>
                      <p className="text-sm text-gray-500">120cm (47 inches)</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Fabric</p>
                    <p className="text-sm text-gray-500">
                      {fabric.fabricCategory?.name || fabric.fabricCategoryName || 'General'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Material Type</p>
                    <p className="text-sm text-gray-500">
                      {fabric.materialType?.name || fabric.materialTypeName || 'Material'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Care Instructions</p>
                    <p className="text-sm text-gray-500">
                      {fabric.careInstructions || 'Handle with care; dry clean recommended for premium finish.'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Shipping</p>
                    <p className="text-sm text-gray-500">
                      {fabric.shippingInfo || 'Shipping options are calculated at checkout based on destination.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeTab === 'reviews' ? (
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
                      placeholder="Share your experience with this fabric..."
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
              ) : null}
            </div>

            {/* Quantity Selector + CTA */}
            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-4">
                <span className="font-medium">Quantity (yards):</span>
                <div className="flex items-center border">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(minimumYards, quantity - 1))}
                    className="px-4 py-2 hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="w-16 px-4 py-2 text-center font-medium">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-2 hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm text-gray-500">Min: {minimumYards} yd</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button className="w-full rounded-none py-3" onClick={handleAddToCart}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to Cart
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleToggleLike}
                  className={`w-full rounded-none border-0 bg-black py-3 text-white hover:bg-gray-800 ${isWishlisted ? 'bg-gray-800' : ''}`}
                >
                  <Heart className={`mr-2 h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
                  Save to Wishlist
                </Button>
              </div>
              {cartMessage ? <p className="text-sm text-emerald-700">{cartMessage}</p> : null}
            </div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white px-4 py-5 sm:px-6">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">You May Also Like</h2>
          {discoverProducts.length === 0 ? (
            <p className="text-sm text-gray-500">No recommendations available yet.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {discoverProducts.map((entry) => {
                const href =
                  entry.productType === 'DESIGN'
                    ? `/jenks-v14/custom-to-wear/${entry.id}`
                    : entry.productType === 'FABRIC'
                      ? `/jenks-v14/fabrics/${entry.id}`
                      : `/jenks-v14/ready-to-wear/${entry.id}`;
                return (
                  <Link
                    key={`${entry.productType}-${entry.id}`}
                    to={href}
                    className="group min-w-[220px] max-w-[220px] overflow-hidden rounded-xl border bg-white"
                  >
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
    </div>
  );
}
