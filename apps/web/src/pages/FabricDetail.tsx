import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Star, MapPin, Ruler, Loader2 } from 'lucide-react';
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
  productLabels?: Array<{ id: string; name: string; textColor: string; backgroundColor: string }>;
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
          <Link to="/fabrics" className="text-black hover:underline">
            Back to Fabrics
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

  const handleAddToCart = () => {
    if (!fabric) return;
    addFabricItem({
      fabricId: fabric.id,
      fabricName: fabric.name,
      fabricImage: fabric.images?.[selectedImage]?.url || fabric.images?.[0]?.url || '/images/placeholder.jpg',
      yards: Math.max(3, Number(quantity || 3)),
      pricePerYard: Number(fabric.pricePerMeter || 0),
      sellerName: fabric.seller?.businessName || 'Seller',
    });
    setCartMessage('Fabric added to cart.');
    navigate('/cart');
  };

  const handleToggleLike = async () => {
    if (!id) return;
    if (!user) {
      navigate('/login');
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
      navigate('/login');
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
        <Link to="/fabrics" className="mb-6 inline-flex items-center text-gray-500 hover:text-black">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Fabrics
        </Link>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden bg-gray-100">
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
            </div>
            {fabric.images && fabric.images.length > 1 && (
              <div className="flex gap-3">
                {fabric.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`h-20 w-20 overflow-hidden border-2 ${
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
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <MapPin className="w-4 h-4" />
                {fabric.seller?.country || 'Unknown'}
                <span className="mx-2">•</span>
                <span>{fabric.materialType?.name || 'Unknown Material'}</span>
                {fabric.predominantColor ? (
                  <>
                    <span className="mx-2">•</span>
                    <span>{String(fabric.predominantColor).toUpperCase()}</span>
                  </>
                ) : null}
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{fabric.name}</h1>
              {(fabric.productLabels || []).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(fabric.productLabels || []).map((label) => (
                    <span
                      key={`${fabric.id}-detail-label-${label.id}`}
                      className="px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: label.backgroundColor || '#111827',
                        color: label.textColor || '#ffffff',
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="font-medium">{reviewAverage > 0 ? reviewAverage.toFixed(1) : Number(fabric.seller?.rating || 0).toFixed(1)}</span>
                  <span className="text-gray-500">({reviewCount || Number(fabric.seller?.reviewCount || 0)} reviews)</span>
                </div>
              </div>
            </div>

            <p className="text-3xl font-bold text-black">
              {formatFromUsd(fabric.pricePerMeter)}<span className="text-lg text-gray-500 font-normal">/yard</span>
            </p>

            <p className="text-gray-600 leading-relaxed">{fabric.description}</p>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
              <span className="font-medium">Quantity (yards):</span>
              <div className="flex items-center border">
                <button
                  onClick={() => setQuantity(Math.max(Math.max(3, Number(fabric.minOrderMeters || 3)), quantity - 1))}
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
              <span className="text-sm text-gray-500">Min: {Math.max(3, Number(fabric.minOrderMeters || 3))} yd</span>
            </div>

            {/* Total */}
            <div className="bg-gray-100 p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total:</span>
                <span className="text-2xl font-bold text-black">{formatFromUsd(fabric.pricePerMeter * quantity)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button className="flex-1 rounded-none py-4" onClick={handleAddToCart}>
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </Button>
              <Button
                variant="ghost"
                onClick={handleToggleLike}
                className={`border-0 bg-black px-4 text-white hover:bg-gray-800 ${isWishlisted ? 'bg-gray-800' : ''}`}
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
                <span className="ml-2 text-sm">{likeCount}</span>
              </Button>
            </div>
            {cartMessage ? <p className="text-sm text-emerald-700">{cartMessage}</p> : null}

            {/* Seller Info */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-3">Sold by</h3>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden bg-gray-100">
                  {flagCode ? (
                    <img
                      src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                      alt={`${fabric.seller?.country || 'Country'} flag`}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  {storefrontPath ? (
                    <Link to={storefrontPath} className="font-medium text-black hover:underline">
                      {fabric.seller?.businessName || 'Unknown Seller'}
                    </Link>
                  ) : (
                    <p className="font-medium">{fabric.seller?.businessName || 'Unknown Seller'}</p>
                  )}
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
        </section>

        <section className="mt-8">
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
    </div>
  );
}
