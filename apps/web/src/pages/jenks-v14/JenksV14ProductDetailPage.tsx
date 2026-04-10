import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Heart, Loader2, Star } from 'lucide-react';
import '../../styles/jenks-v2.css';
import { api } from '../../services/api';
import { useCurrencyStore } from '../../store/currencyStore';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { resolveCountryCode } from '../../data/locationOptions';
import { buildMeasurementDropdownOptions } from '../../utils/measurementOptions';

type DetailMode = 'READY' | 'FABRIC' | 'CUSTOM';
type CategoryPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
type DetailTabKey = 'DETAILS' | 'SPECS' | 'REVIEWS';

type ProductReview = {
  id: string;
  rating: number;
  title?: string | null;
  comment: string;
  createdAt: string;
  customer?: { id: string; name: string } | null;
};

type DiscoverProduct = {
  id: string;
  name: string;
  image: string;
  priceUsd: number;
  country: string;
  ownerName: string;
  productType: 'DESIGN' | 'FABRIC' | 'READY_TO_WEAR';
};

type JenksV14ProductDetailPageProps = {
  mode: DetailMode;
};

type DetailViewSettings = {
  titleFontSize: number;
  titleColor: string;
  ownerFontSize: number;
  ownerColor: string;
  priceLabelColor: string;
  priceValueFontSize: number;
  priceValueColor: string;
  descriptionFontSize: number;
  descriptionColor: string;
  specLabelColor: string;
  specValueColor: string;
  tabOrder: DetailTabKey[];
  defaultTab: DetailTabKey;
  reviewsEnabled: boolean;
  discoverEnabled: boolean;
  likesEnabled: boolean;
};

const MODE_CONFIG: Record<
  DetailMode,
  {
    title: string;
    listHref: '/readytowear' | '/fabricstobuy' | '/customtowear';
    apiType: 'ready-to-wear' | 'fabric' | 'design';
    ownerFallback: string;
  }
> = {
  READY: {
    title: 'Ready To Wear',
    listHref: '/readytowear',
    apiType: 'ready-to-wear',
    ownerFallback: 'Designer',
  },
  FABRIC: {
    title: 'Fabrics To Buy',
    listHref: '/fabricstobuy',
    apiType: 'fabric',
    ownerFallback: 'Seller',
  },
  CUSTOM: {
    title: 'Custom To Wear',
    listHref: '/customtowear',
    apiType: 'design',
    ownerFallback: 'Designer',
  },
};

const DETAIL_PAGE_TYPE_BY_MODE: Record<DetailMode, CategoryPageType> = {
  READY: 'READY_TO_WEAR',
  FABRIC: 'FABRIC_TO_BUY',
  CUSTOM: 'CUSTOM_TO_WEAR',
};

const DETAIL_TABS: DetailTabKey[] = ['DETAILS', 'SPECS', 'REVIEWS'];

const DEFAULT_DETAIL_VIEW_SETTINGS: DetailViewSettings = {
  titleFontSize: 64,
  titleColor: '#1A1A1A',
  ownerFontSize: 16,
  ownerColor: '#6B6B6B',
  priceLabelColor: '#6B6B6B',
  priceValueFontSize: 36,
  priceValueColor: '#E85A3C',
  descriptionFontSize: 14,
  descriptionColor: '#2f2d29',
  specLabelColor: '#6B6B6B',
  specValueColor: '#1A1A1A',
  tabOrder: ['DETAILS', 'SPECS', 'REVIEWS'],
  defaultTab: 'DETAILS',
  reviewsEnabled: true,
  discoverEnabled: true,
  likesEnabled: true,
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const normalizeColor = (value: unknown, fallback: string) => {
  const token = String(value || '').trim();
  return token || fallback;
};

const normalizeDetailTabOrder = (value: unknown): DetailTabKey[] => {
  const source = Array.isArray(value) ? value.map((entry) => String(entry || '').trim().toUpperCase()) : [];
  const next: DetailTabKey[] = [];
  source.forEach((entry) => {
    if (!DETAIL_TABS.includes(entry as DetailTabKey)) return;
    if (!next.includes(entry as DetailTabKey)) next.push(entry as DetailTabKey);
  });
  DETAIL_TABS.forEach((tab) => {
    if (!next.includes(tab)) next.push(tab);
  });
  return next;
};

const normalizeDetailViewSettings = (value: unknown): DetailViewSettings => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const reviewsEnabled = raw.reviewsEnabled !== false;
  const tabOrder = normalizeDetailTabOrder(raw.tabOrder);
  const visibleTabOrder = reviewsEnabled ? tabOrder : tabOrder.filter((tab) => tab !== 'REVIEWS');
  const safeTabOrder: DetailTabKey[] = visibleTabOrder.length > 0 ? visibleTabOrder : ['DETAILS', 'SPECS'];
  const defaultTabRaw = String(raw.defaultTab || '').trim().toUpperCase() as DetailTabKey;
  const safeDefaultTab = safeTabOrder.includes(defaultTabRaw) ? defaultTabRaw : safeTabOrder[0];
  return {
    titleFontSize: clampNumber(raw.titleFontSize, 64, 18, 96),
    titleColor: normalizeColor(raw.titleColor, '#1A1A1A'),
    ownerFontSize: clampNumber(raw.ownerFontSize, 16, 10, 42),
    ownerColor: normalizeColor(raw.ownerColor, '#6B6B6B'),
    priceLabelColor: normalizeColor(raw.priceLabelColor, '#6B6B6B'),
    priceValueFontSize: clampNumber(raw.priceValueFontSize, 36, 18, 96),
    priceValueColor: normalizeColor(raw.priceValueColor, '#E85A3C'),
    descriptionFontSize: clampNumber(raw.descriptionFontSize, 14, 12, 36),
    descriptionColor: normalizeColor(raw.descriptionColor, '#2f2d29'),
    specLabelColor: normalizeColor(raw.specLabelColor, '#6B6B6B'),
    specValueColor: normalizeColor(raw.specValueColor, '#1A1A1A'),
    tabOrder: safeTabOrder,
    defaultTab: safeDefaultTab,
    reviewsEnabled,
    discoverEnabled: raw.discoverEnabled !== false,
    likesEnabled: raw.likesEnabled !== false,
  };
};

const asText = (value: unknown, fallback = '') => {
  const token = String(value || '').trim();
  return token || fallback;
};

const toNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const flagEmoji = (countryCode: string) => {
  const normalized = String(countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '🌍';
  const base = 127397;
  return String.fromCodePoint(...normalized.split('').map((char) => base + char.charCodeAt(0)));
};

const discoverHref = (entry: DiscoverProduct) =>
  entry.productType === 'DESIGN'
    ? `/customtowear/${entry.id}`
    : entry.productType === 'FABRIC'
      ? `/fabricstobuy/${entry.id}`
      : `/readytowear/${entry.id}`;

const uniqueNonEmpty = (rows: string[]) => Array.from(new Set(rows.map((entry) => asText(entry, '')).filter(Boolean)));

export default function JenksV14ProductDetailPage({ mode }: JenksV14ProductDetailPageProps) {
  const config = MODE_CONFIG[mode];
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { formatFromUsd } = useCurrencyStore();
  const { addReadyToWearItem, addFabricItem, addItem } = useCartStore();

  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [readySize, setReadySize] = useState('');
  const [readyColor, setReadyColor] = useState('');
  const [customFabricMode, setCustomFabricMode] = useState<'CUSTOMER_SELECTED' | 'DESIGNER_DECIDES'>('CUSTOMER_SELECTED');
  const [customFabricId, setCustomFabricId] = useState('');
  const [customFabricMeters, setCustomFabricMeters] = useState(1);
  const [customNotes, setCustomNotes] = useState('');
  const [customMeasurements, setCustomMeasurements] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<DetailTabKey>('DETAILS');
  const [detailViewSettings, setDetailViewSettings] = useState<DetailViewSettings>(DEFAULT_DETAIL_VIEW_SETTINGS);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewAverage, setReviewAverage] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [discoverProducts, setDiscoverProducts] = useState<DiscoverProduct[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id, mode]);

  useEffect(() => {
    let cancelled = false;
    setDetailViewSettings(DEFAULT_DETAIL_VIEW_SETTINGS);
    const loadDetailViewSettings = async () => {
      try {
        const pageType = DETAIL_PAGE_TYPE_BY_MODE[mode];
        const response = await api.products.getCategoryPageSettings(pageType);
        if (cancelled) return;
        const next = normalizeDetailViewSettings(response?.data?.settings?.detailView);
        setDetailViewSettings(next);
      } catch {
        if (cancelled) return;
        setDetailViewSettings(DEFAULT_DETAIL_VIEW_SETTINGS);
      }
    };
    void loadDetailViewSettings();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!id) return;
    const loadProduct = async () => {
      setLoading(true);
      setError('');
      try {
        const response =
          mode === 'READY'
            ? await api.products.getReadyToWearProduct(id)
            : mode === 'FABRIC'
              ? await api.products.getFabric(id)
              : await api.products.getDesign(id);
        if (!response?.success) {
          throw new Error('Product not found.');
        }
        const payload = response.data;
        setProduct(payload);
        setSelectedImage(0);
        setQuantity(Math.max(1, mode === 'FABRIC' ? toNumber(payload?.minOrderMeters, 1) : 1));

        if (mode === 'READY') {
          const variations = asArray<any>(payload?.sizeVariations);
          const firstInStock = variations.find((entry) => toNumber(entry?.stock, 0) > 0) || variations[0];
          setReadySize(asText(firstInStock?.size, ''));
          setReadyColor(asText(firstInStock?.color, asText(payload?.colors?.[0], '')));
        }

        if (mode === 'CUSTOM') {
          const firstFabric = asArray<any>(payload?.suitableFabrics)[0];
          const firstFabricId = asText(firstFabric?.fabric?.id, '');
          setCustomFabricId(firstFabricId);
          setCustomFabricMeters(Math.max(1, toNumber(firstFabric?.minMeters, 1)));
          const seed: Record<string, number> = {};
          asArray<any>(payload?.measurements).forEach((entry) => {
            const key = asText(entry?.name, '');
            if (!key) return;
            seed[key] = 0;
          });
          setCustomMeasurements(seed);
        }
      } catch (loadError) {
        setError(String((loadError as Error)?.message || 'Unable to load product details.'));
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    void loadProduct();
  }, [id, mode]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const likesRequest = detailViewSettings.likesEnabled ? api.products.getProductLikes(config.apiType, id) : Promise.resolve(null);
    const reviewsRequest = detailViewSettings.reviewsEnabled
      ? api.products.getProductReviews(config.apiType, id, 12)
      : Promise.resolve(null);
    const discoverRequest = detailViewSettings.discoverEnabled
      ? api.products.getDiscoverByCountry(config.apiType, id, 12)
      : Promise.resolve(null);
    Promise.allSettled([likesRequest, reviewsRequest, discoverRequest]).then(([likesResult, reviewsResult, discoverResult]) => {
      if (cancelled) return;
      if (detailViewSettings.likesEnabled && likesResult.status === 'fulfilled' && likesResult.value?.success) {
        setLikeCount(toNumber(likesResult.value.data?.count, 0));
        setIsWishlisted(Boolean(likesResult.value.data?.likedByMe));
      } else {
        setLikeCount(0);
        setIsWishlisted(false);
      }
      if (detailViewSettings.reviewsEnabled && reviewsResult.status === 'fulfilled' && reviewsResult.value?.success) {
        setReviews(asArray<ProductReview>(reviewsResult.value.data?.reviews));
        setReviewAverage(toNumber(reviewsResult.value.data?.summary?.averageRating, 0));
        setReviewCount(toNumber(reviewsResult.value.data?.summary?.count, 0));
      } else {
        setReviews([]);
        setReviewAverage(0);
        setReviewCount(0);
      }
      if (detailViewSettings.discoverEnabled && discoverResult.status === 'fulfilled' && discoverResult.value?.success) {
        setDiscoverProducts(asArray<DiscoverProduct>(discoverResult.value.data));
      } else {
        setDiscoverProducts([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    config.apiType,
    detailViewSettings.discoverEnabled,
    detailViewSettings.likesEnabled,
    detailViewSettings.reviewsEnabled,
    id,
  ]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const detailTabs = useMemo(() => {
    const ordered = normalizeDetailTabOrder(detailViewSettings.tabOrder);
    if (detailViewSettings.reviewsEnabled) return ordered;
    const filtered = ordered.filter((tab) => tab !== 'REVIEWS');
    return filtered.length > 0 ? filtered : ['DETAILS', 'SPECS'];
  }, [detailViewSettings.reviewsEnabled, detailViewSettings.tabOrder]);

  const detailDefaultTab = useMemo<DetailTabKey>(() => {
    if (detailTabs.includes(detailViewSettings.defaultTab)) return detailViewSettings.defaultTab;
    return detailTabs[0] || 'DETAILS';
  }, [detailTabs, detailViewSettings.defaultTab]);

  useEffect(() => {
    setActiveTab(detailDefaultTab);
  }, [detailDefaultTab, id, mode]);

  useEffect(() => {
    if (!detailTabs.includes(activeTab)) {
      setActiveTab(detailDefaultTab);
    }
  }, [activeTab, detailDefaultTab, detailTabs]);

  const ownerName = useMemo(() => {
    if (mode === 'FABRIC') return asText(product?.seller?.businessName, config.ownerFallback);
    return asText(product?.designer?.businessName, config.ownerFallback);
  }, [config.ownerFallback, mode, product]);

  const countryName = useMemo(() => {
    if (mode === 'FABRIC') return asText(product?.seller?.country, '');
    return asText(product?.designer?.country, '');
  }, [mode, product]);

  const countryCode = resolveCountryCode(countryName);
  const countryFlag = flagEmoji(countryCode || 'NG');

  const images = useMemo(() => {
    if (mode === 'CUSTOM') return asArray<string>(product?.images);
    if (mode === 'FABRIC') return asArray<any>(product?.images).map((entry) => asText(entry?.url, ''));
    return asArray<any>(product?.images).map((entry) => asText(entry?.url, ''));
  }, [mode, product]);

  const safeImages = images.filter(Boolean);
  const currentImage = safeImages[selectedImage] || safeImages[0] || '/images/placeholder.jpg';

  const readyVariations = useMemo(() => {
    if (mode !== 'READY') return [];
    return asArray<any>(product?.sizeVariations).map((entry) => ({
      size: asText(entry?.size, ''),
      color: asText(entry?.color, ''),
      stock: toNumber(entry?.stock, 0),
      price: toNumber(entry?.price, product?.finalPrice, product?.basePrice, product?.price),
    }));
  }, [mode, product]);

  const readyColors = useMemo(() => {
    if (mode !== 'READY') return [];
    const fromVariations = readyVariations.map((entry) => asText(entry.color, '')).filter(Boolean);
    const fromProduct = asArray<string>(product?.colors).map((entry) => asText(entry, '')).filter(Boolean);
    return Array.from(new Set([...fromVariations, ...fromProduct]));
  }, [mode, product, readyVariations]);

  const effectiveReadyColor = readyColors.includes(readyColor) ? readyColor : readyColors[0] || '';

  const readySizes = useMemo(() => {
    if (mode !== 'READY') return [];
    const filtered = readyVariations.filter(
      (entry) => (!effectiveReadyColor || !entry.color || entry.color === effectiveReadyColor) && entry.stock > 0
    );
    return Array.from(new Set(filtered.map((entry) => entry.size).filter(Boolean)));
  }, [effectiveReadyColor, mode, readyVariations]);

  const effectiveReadySize = readySizes.includes(readySize) ? readySize : readySizes[0] || '';

  const readySelectedVariation = useMemo(() => {
    if (mode !== 'READY') return null;
    return (
      readyVariations.find(
        (entry) =>
          entry.size === effectiveReadySize &&
          (!effectiveReadyColor || !entry.color || entry.color === effectiveReadyColor)
      ) || null
    );
  }, [effectiveReadyColor, effectiveReadySize, mode, readyVariations]);

  const readyUnitPrice = toNumber(
    readySelectedVariation?.price,
    product?.price,
    product?.finalPrice,
    product?.basePrice
  );
  const readyStock = toNumber(readySelectedVariation?.stock, 0);

  const fabricUnitPrice = toNumber(product?.pricePerMeter, product?.finalPrice, product?.sellerPrice, product?.price);
  const fabricMinYards = Math.max(1, toNumber(product?.minOrderMeters, 1));
  const fabricStock = toNumber(product?.stockMeters, 0);
  const safeFabricQty = Math.max(fabricMinYards, quantity);

  const customBasePrice = toNumber(product?.basePrice, product?.finalPrice, product?.price);
  const customFabricRows = asArray<any>(product?.suitableFabrics);
  const selectedCustomFabricRow =
    customFabricRows.find((entry) => asText(entry?.fabric?.id, '') === customFabricId) || customFabricRows[0] || null;
  const selectedCustomFabricPrice = toNumber(selectedCustomFabricRow?.fabric?.pricePerMeter, 0);
  const customFabricMin = Math.max(1, toNumber(selectedCustomFabricRow?.minMeters, 1));
  const customFabricMax = Math.max(customFabricMin, toNumber(selectedCustomFabricRow?.maxMeters, customFabricMin));
  const safeCustomFabricMeters = Math.min(customFabricMax, Math.max(customFabricMin, customFabricMeters || customFabricMin));
  const customMeasurementRows = asArray<any>(product?.measurements);
  const customRequiredRows = customMeasurementRows.filter((entry) => entry?.isRequired !== false);
  const customMeasurementsComplete =
    customRequiredRows.length === 0 ||
    customRequiredRows.every((entry) => toNumber(customMeasurements[asText(entry?.name, '')], 0) > 0);
  const customTotalPrice =
    customFabricMode === 'CUSTOMER_SELECTED'
      ? customBasePrice + selectedCustomFabricPrice * safeCustomFabricMeters
      : customBasePrice;

  const displayPrice =
    mode === 'READY'
      ? readyUnitPrice
      : mode === 'FABRIC'
        ? fabricUnitPrice * safeFabricQty
        : customTotalPrice;

  const customTryOnFabricId =
    customFabricMode === 'CUSTOMER_SELECTED'
      ? asText(selectedCustomFabricRow?.fabric?.id, '')
      : asText(customFabricRows[0]?.fabric?.id, '');

  const productDetailRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    const categoryLabel =
      mode === 'FABRIC'
        ? asText(product?.fabricCategory?.name, asText(product?.fabricCategoryName, 'Fabric'))
        : asText(product?.category?.name, config.title);
    const materialLabel = asText(product?.materialType?.name, asText(product?.materialTypeName, 'Material'));
    const city = mode === 'FABRIC' ? asText(product?.seller?.city, '') : asText(product?.designer?.city, '');
    rows.push(
      { label: 'Product ID', value: asText(product?.id, 'N/A') },
      { label: 'Type', value: config.title },
      { label: 'Category', value: categoryLabel || 'N/A' },
      { label: 'Material', value: materialLabel || 'N/A' },
      { label: mode === 'FABRIC' ? 'Seller' : 'Designer', value: ownerName || 'N/A' },
      { label: 'Origin', value: countryName || 'Africa' }
    );
    if (city) rows.push({ label: 'City', value: city });

    if (mode === 'READY') {
      const totalStock = readyVariations.reduce((sum, entry) => sum + Math.max(0, toNumber(entry?.stock, 0)), 0);
      const sizes = uniqueNonEmpty(readySizes);
      const colors = uniqueNonEmpty(readyColors);
      rows.push(
        { label: 'Sizes', value: sizes.length > 0 ? sizes.join(', ') : 'N/A' },
        { label: 'Colors', value: colors.length > 0 ? colors.join(', ') : 'N/A' },
        { label: 'Total Stock', value: `${totalStock}` }
      );
    } else if (mode === 'FABRIC') {
      const color = asText(product?.predominantColor, '');
      rows.push(
        { label: 'Min Order', value: `${fabricMinYards} yards` },
        { label: 'Stock', value: `${fabricStock} yards` }
      );
      if (color) rows.push({ label: 'Color', value: color });
    } else {
      const requiredMeasurements = uniqueNonEmpty(customRequiredRows.map((entry) => asText(entry?.name, '')));
      rows.push(
        { label: 'Fabric Choices', value: `${customFabricRows.length}` },
        {
          label: 'Required Measurements',
          value: requiredMeasurements.length > 0 ? requiredMeasurements.join(', ') : 'None',
        }
      );
    }
    return rows;
  }, [
    config.title,
    countryName,
    customFabricRows.length,
    customRequiredRows,
    fabricMinYards,
    fabricStock,
    mode,
    ownerName,
    product,
    readyColors,
    readySizes,
    readyVariations,
  ]);

  const handleOpenVirtualTryOn = () => {
    const productId = asText(product?.id, '');
    if (!productId) return;
    if (mode === 'READY') {
      const draft = {
        selectedSize: effectiveReadySize,
        selectedColor: effectiveReadyColor || '',
        quantity: Math.max(1, quantity),
        measurements: {},
      };
      try {
        window.sessionStorage.setItem(`rtwTryOnDraft:${productId}`, JSON.stringify(draft));
      } catch {
        // Ignore storage errors and continue via route state.
      }
      navigate(`/readytowear/${productId}/try-on`, { state: { tryOnDraft: draft } });
      return;
    }
    if (mode !== 'CUSTOM') return;
    if (!customTryOnFabricId) {
      setNotice('Please add at least one suitable fabric for this design before using Virtual Try-On.');
      return;
    }
    const query = `?fabric=${encodeURIComponent(customTryOnFabricId)}`;
    navigate(`/try-on/${productId}${query}`, {
      state: {
        tryOnDraft: {
          measurements: customMeasurements,
          fabricMeters: safeCustomFabricMeters,
          fabricMode: customFabricMode,
        },
      },
    });
  };

  const loginRedirect = () => {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`, { state: { from: location } });
  };

  const handleToggleLike = async () => {
    if (!detailViewSettings.likesEnabled) return;
    if (!id) return;
    if (!user) {
      loginRedirect();
      return;
    }
    try {
      const response = await api.products.toggleProductLike(config.apiType, id);
      if (response.success) {
        setIsWishlisted(Boolean(response.data?.likedByMe));
        setLikeCount(toNumber(response.data?.count, 0));
      }
    } catch {
      // Ignore to keep product flow uninterrupted.
    }
  };

  const handleSubmitReview = async () => {
    if (!id || !reviewComment.trim()) return;
    if (!user) {
      loginRedirect();
      return;
    }
    try {
      setReviewSubmitting(true);
      const response = await api.products.createProductReview(config.apiType, id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      if (!response.success) return;
      setReviewComment('');
      const nextReviews = await api.products.getProductReviews(config.apiType, id, 12);
      if (!nextReviews.success) return;
      setReviews(asArray<ProductReview>(nextReviews.data?.reviews));
      setReviewAverage(toNumber(nextReviews.data?.summary?.averageRating, 0));
      setReviewCount(toNumber(nextReviews.data?.summary?.count, 0));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (mode === 'READY') {
      if (!effectiveReadySize) {
        setNotice('Please select a size first.');
        return;
      }
      if (readyStock <= 0) {
        setNotice('Selected variation is out of stock.');
        return;
      }
      addReadyToWearItem({
        readyToWearId: asText(product?.id, ''),
        productName: asText(product?.name, 'Ready To Wear'),
        productImage: currentImage,
        selectedSize: effectiveReadySize,
        selectedColor: effectiveReadyColor || undefined,
        quantity: Math.max(1, quantity),
        unitPrice: readyUnitPrice,
        designerName: ownerName,
        categoryName: asText(product?.category?.name, 'Ready To Wear'),
        tryOnMeasurements: {},
      });
      setNotice('Ready-to-wear item added to cart.');
      return;
    }

    if (mode === 'FABRIC') {
      addFabricItem({
        fabricId: asText(product?.id, ''),
        fabricName: asText(product?.name, 'Fabric'),
        fabricImage: currentImage,
        yards: safeFabricQty,
        pricePerYard: fabricUnitPrice,
        sellerName: ownerName,
      });
      setNotice('Fabric added to cart.');
      return;
    }

    if (!customMeasurementsComplete) {
      setActiveTab('SPECS');
      setNotice('Please complete required measurements.');
      return;
    }
    if (customFabricMode === 'CUSTOMER_SELECTED' && !selectedCustomFabricRow) {
      setNotice('Please choose a suitable fabric.');
      return;
    }
    addItem({
      designId: asText(product?.id, ''),
      designName: asText(product?.name, 'Custom Design'),
      designImage: currentImage,
      fabricId: customFabricMode === 'CUSTOMER_SELECTED' ? asText(selectedCustomFabricRow?.fabric?.id, '') : undefined,
      fabricName:
        customFabricMode === 'CUSTOMER_SELECTED' ? asText(selectedCustomFabricRow?.fabric?.name, 'Fabric') : undefined,
      fabricImage:
        customFabricMode === 'CUSTOMER_SELECTED'
          ? asText(selectedCustomFabricRow?.fabric?.images?.[0], '/images/placeholder.jpg')
          : undefined,
      fabricMeters: customFabricMode === 'CUSTOMER_SELECTED' ? safeCustomFabricMeters : undefined,
      fabricPrice: customFabricMode === 'CUSTOMER_SELECTED' ? selectedCustomFabricPrice : undefined,
      fabricSelectionMode: customFabricMode,
      fabricPreferenceNotes:
        customFabricMode === 'DESIGNER_DECIDES' && customNotes.trim().length > 0 ? customNotes.trim() : undefined,
      designerId: asText(product?.designer?.id, ''),
      designerName: ownerName,
      measurements: customMeasurements,
      basePrice: customBasePrice,
      totalPrice: customTotalPrice,
    });
    setNotice('Custom design added to cart.');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F6F1] text-[#1A1A1A]">
        <Loader2 className="h-9 w-9 animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F6F1] px-4 text-[#1A1A1A]">
        <div className="max-w-lg text-center">
          <p className="text-base text-[#6B6B6B]">{error || 'Product not found.'}</p>
          <Link to={config.listHref} className="cta-link mt-4 inline-block">
            Back to {config.title}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F1] text-[#1A1A1A]">
      <div className="mx-auto w-full max-w-[1580px] px-4 py-6 sm:px-6 lg:px-10">
        <Link to={config.listHref} className="cta-link inline-flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to {config.title}
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="relative aspect-[3/4] overflow-hidden bg-[#ece8df]">
              <img src={currentImage} alt={asText(product?.name, 'Product')} className="h-full w-full object-cover" />
              {safeImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedImage((prev) => Math.max(0, prev - 1))}
                    className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-white/90 text-[#1A1A1A] shadow"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedImage((prev) => Math.min(safeImages.length - 1, prev + 1))}
                    className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-white/90 text-[#1A1A1A] shadow"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
              {detailViewSettings.likesEnabled ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleToggleLike()}
                    className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center bg-white/90 text-[#1A1A1A] shadow"
                    aria-label="Toggle wishlist"
                  >
                    <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-[#E85A3C] text-[#E85A3C]' : ''}`} />
                  </button>
                  <div className="absolute left-3 top-3 rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-white">
                    {likeCount} likes
                  </div>
                </>
              ) : null}
              <div className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-lg shadow">
                {countryFlag}
              </div>
            </div>
            {safeImages.length > 1 ? (
              <div className="grid grid-cols-5 gap-2">
                {safeImages.slice(0, 10).map((image, idx) => (
                  <button
                    key={`${image}-${idx}`}
                    type="button"
                    onClick={() => setSelectedImage(idx)}
                    className={`aspect-square overflow-hidden border ${
                      selectedImage === idx ? 'border-[#1A1A1A]' : 'border-[#d7d3ca]'
                    }`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-mono bg-white px-2 py-1 text-[#6B6B6B]">
                {mode === 'FABRIC' ? 'FABRIC' : mode === 'READY' ? 'READY TO WEAR' : 'CUSTOM TO WEAR'}
              </span>
              <span className="label-mono bg-white px-2 py-1 text-[#6B6B6B]">{countryName || 'Africa'}</span>
            </div>

            <div>
              <h1
                className="headline-lg"
                style={{ fontSize: `${detailViewSettings.titleFontSize}px`, color: detailViewSettings.titleColor }}
              >
                {asText(product?.name, 'Product')}
              </h1>
              <p className="mt-2" style={{ fontSize: `${detailViewSettings.ownerFontSize}px`, color: detailViewSettings.ownerColor }}>
                By {ownerName}
              </p>
              {detailViewSettings.reviewsEnabled ? (
                <div className="mt-3 flex items-center gap-2 text-[#E85A3C]">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={`rating-${idx}`} className={`h-4 w-4 ${idx < Math.round(reviewAverage) ? 'fill-current' : ''}`} />
                    ))}
                  </div>
                  <span className="text-sm text-[#6B6B6B]">
                    {reviewCount} review{reviewCount === 1 ? '' : 's'}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="border border-[#d7d3ca] bg-white p-4">
              <p className="label-mono" style={{ color: detailViewSettings.priceLabelColor }}>
                {mode === 'FABRIC' ? 'ESTIMATED TOTAL' : mode === 'CUSTOM' ? 'ESTIMATED TOTAL' : 'UNIT PRICE'}
              </p>
              <p
                className="mt-2 font-semibold"
                style={{ fontSize: `${detailViewSettings.priceValueFontSize}px`, color: detailViewSettings.priceValueColor }}
              >
                {formatFromUsd(displayPrice)}
              </p>
            </div>

            {mode === 'READY' ? (
              <div className="space-y-4 border border-[#d7d3ca] bg-white p-4">
                <div>
                  <p className="label-mono text-[#6B6B6B]">SIZE</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {readySizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setReadySize(size)}
                        className={`border px-4 py-2 text-sm ${
                          effectiveReadySize === size ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white' : 'border-[#d7d3ca] bg-white'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="label-mono text-[#6B6B6B]">COLOR</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {readyColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setReadyColor(color)}
                        className={`border px-3 py-1.5 text-xs uppercase tracking-[0.08em] ${
                          effectiveReadyColor === color
                            ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                            : 'border-[#d7d3ca] bg-white text-[#1A1A1A]'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${readyStock > 0 ? 'text-[#6B6B6B]' : 'text-red-600'}`}>
                    {readyStock > 0 ? `${readyStock} in stock` : 'Out of stock'}
                  </p>
                  <div className="inline-flex items-center border border-[#d7d3ca]">
                    <button type="button" onClick={() => setQuantity((prev) => Math.max(1, prev - 1))} className="px-3 py-2">
                      -
                    </button>
                    <span className="w-10 text-center text-sm">{Math.max(1, quantity)}</span>
                    <button type="button" onClick={() => setQuantity((prev) => prev + 1)} className="px-3 py-2">
                      +
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {mode === 'FABRIC' ? (
              <div className="space-y-4 border border-[#d7d3ca] bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="label-mono text-[#6B6B6B]">PRICE PER YARD</p>
                  <p className="text-sm font-semibold">{formatFromUsd(fabricUnitPrice)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="label-mono text-[#6B6B6B]">STOCK</p>
                  <p className="text-sm font-semibold">{fabricStock} yards</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="label-mono text-[#6B6B6B]">QUANTITY (YARDS)</p>
                  <div className="inline-flex items-center border border-[#d7d3ca]">
                    <button type="button" onClick={() => setQuantity((prev) => Math.max(fabricMinYards, prev - 1))} className="px-3 py-2">
                      -
                    </button>
                    <span className="w-12 text-center text-sm">{safeFabricQty}</span>
                    <button type="button" onClick={() => setQuantity((prev) => prev + 1)} className="px-3 py-2">
                      +
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#6B6B6B]">Minimum order: {fabricMinYards} yards</p>
              </div>
            ) : null}

            {mode === 'CUSTOM' ? (
              <div className="space-y-4 border border-[#d7d3ca] bg-white p-4">
                <div>
                  <p className="label-mono text-[#6B6B6B]">FABRIC OPTION</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setCustomFabricMode('CUSTOMER_SELECTED')}
                      className={`border px-3 py-2 text-left text-sm ${
                        customFabricMode === 'CUSTOMER_SELECTED'
                          ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                          : 'border-[#d7d3ca] bg-white text-[#1A1A1A]'
                      }`}
                    >
                      I will choose fabric
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomFabricMode('DESIGNER_DECIDES')}
                      className={`border px-3 py-2 text-left text-sm ${
                        customFabricMode === 'DESIGNER_DECIDES'
                          ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                          : 'border-[#d7d3ca] bg-white text-[#1A1A1A]'
                      }`}
                    >
                      Let designer choose fabric
                    </button>
                  </div>
                </div>

                {customFabricMode === 'CUSTOMER_SELECTED' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {customFabricRows.map((entry) => {
                        const fabricId = asText(entry?.fabric?.id, '');
                        const active = customFabricId === fabricId;
                        return (
                          <button
                            key={fabricId}
                            type="button"
                            onClick={() => {
                              setCustomFabricId(fabricId);
                              setCustomFabricMeters(Math.max(1, toNumber(entry?.minMeters, 1)));
                            }}
                            className={`border p-2 text-left ${active ? 'border-[#1A1A1A]' : 'border-[#d7d3ca]'}`}
                          >
                            <img
                              src={asText(entry?.fabric?.images?.[0], '/images/placeholder.jpg')}
                              alt={asText(entry?.fabric?.name, 'Fabric')}
                              className="h-16 w-full object-cover"
                            />
                            <p className="mt-1 line-clamp-1 text-xs font-medium">{asText(entry?.fabric?.name, 'Fabric')}</p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="label-mono text-[#6B6B6B]">FABRIC YARDS</p>
                      <div className="inline-flex items-center border border-[#d7d3ca]">
                        <button
                          type="button"
                          onClick={() => setCustomFabricMeters((prev) => Math.max(customFabricMin, prev - 1))}
                          className="px-3 py-2"
                        >
                          -
                        </button>
                        <span className="w-12 text-center text-sm">{safeCustomFabricMeters}</span>
                        <button
                          type="button"
                          onClick={() => setCustomFabricMeters((prev) => Math.min(customFabricMax, prev + 1))}
                          className="px-3 py-2"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={customNotes}
                    onChange={(event) => setCustomNotes(event.target.value)}
                    placeholder="Tell the designer your preferred texture, style, or color..."
                    className="h-24 w-full border border-[#d7d3ca] px-3 py-2 text-sm outline-none focus:border-[#1A1A1A]"
                  />
                )}
              </div>
            ) : null}

            <div className={`grid gap-3 ${mode === 'FABRIC' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
              {mode === 'READY' || mode === 'CUSTOM' ? (
                <button type="button" onClick={() => handleOpenVirtualTryOn()} className="cta-button-outline justify-center">
                  Virtual Try-On
                </button>
              ) : null}
              <button type="button" onClick={() => void handleAddToCart()} className="cta-button justify-center">
                Add to Cart
              </button>
              <Link to="/cart" className="cta-button-outline justify-center text-center">
                View Cart
              </Link>
            </div>
            {notice ? <p className="text-sm text-[#E85A3C]">{notice}</p> : null}
          </div>
        </div>

        <section className="mt-10 border border-[#d7d3ca] bg-white">
          <div className="flex flex-wrap items-center gap-6 border-b border-[#e4e0d7] px-4 py-3 sm:px-6">
            {detailTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`label-mono border-b-2 pb-2 ${activeTab === tab ? 'border-[#E85A3C] text-[#1A1A1A]' : 'border-transparent text-[#6B6B6B]'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="space-y-5 px-4 py-5 sm:px-6">
            {activeTab === 'DETAILS' ? (
              <div className="space-y-4 leading-relaxed" style={{ fontSize: `${detailViewSettings.descriptionFontSize}px` }}>
                <p style={{ color: detailViewSettings.descriptionColor }}>{asText(product?.description, 'No description available yet.')}</p>
              </div>
            ) : null}

            {activeTab === 'SPECS' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {productDetailRows.map((row) => (
                  <div key={`${row.label}-${row.value}`} className="border border-[#e4e0d7] p-3">
                    <p className="label-mono" style={{ color: detailViewSettings.specLabelColor }}>
                      {row.label}
                    </p>
                    <p className="mt-2 text-sm font-medium" style={{ color: detailViewSettings.specValueColor }}>
                      {row.value || 'N/A'}
                    </p>
                  </div>
                ))}
                {mode === 'CUSTOM' ? (
                  <div className="border border-[#e4e0d7] p-3 sm:col-span-2 lg:col-span-3">
                    <p className="label-mono" style={{ color: detailViewSettings.specLabelColor }}>
                      Measurements
                    </p>
                    {customMeasurementRows.length === 0 ? (
                      <p className="mt-2 text-sm" style={{ color: detailViewSettings.specLabelColor }}>
                        No measurement variables are configured for this design.
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {customMeasurementRows.map((entry) => {
                          const key = asText(entry?.name, '');
                          return (
                            <label key={key} className="space-y-1">
                              <span
                                className="text-xs font-medium uppercase tracking-[0.08em]"
                                style={{ color: detailViewSettings.specLabelColor }}
                              >
                                {key}
                                {entry?.isRequired !== false ? ' *' : ''}
                              </span>
                              <select
                                value={toNumber(customMeasurements[key], 0) || ''}
                                onChange={(event) =>
                                  setCustomMeasurements((prev) => ({
                                    ...prev,
                                    [key]: toNumber(event.target.value, 0),
                                  }))
                                }
                                className="w-full border border-[#d7d3ca] px-2 py-2 text-sm outline-none focus:border-[#1A1A1A]"
                              >
                                <option value="">Select</option>
                                {buildMeasurementDropdownOptions(key, asText(entry?.unit, 'cm')).map((value) => (
                                  <option key={`${key}-${value}`} value={value}>
                                    {value} {asText(entry?.unit, 'cm')}
                                  </option>
                                ))}
                              </select>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {detailViewSettings.reviewsEnabled && activeTab === 'REVIEWS' ? (
              <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
                <div className="space-y-2">
                  <p className="label-mono text-[#6B6B6B]">Leave a review</p>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const value = idx + 1;
                      const active = value <= reviewRating;
                      return (
                        <button
                          key={`review-rating-${value}`}
                          type="button"
                          onClick={() => setReviewRating(value)}
                          className="inline-flex h-8 w-8 items-center justify-center"
                          aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                        >
                          <Star className={`h-5 w-5 ${active ? 'fill-[#E85A3C] text-[#E85A3C]' : 'text-[#c5bfb2]'}`} />
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[#6B6B6B]">
                    Selected rating: {reviewRating} star{reviewRating > 1 ? 's' : ''}
                  </p>
                  <textarea
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Share your experience..."
                    className="h-24 w-full border border-[#d7d3ca] px-3 py-2 text-sm outline-none focus:border-[#1A1A1A]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSubmitReview()}
                    disabled={reviewSubmitting || !reviewComment.trim()}
                    className="cta-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reviewSubmitting ? 'Submitting...' : 'Submit review'}
                  </button>
                </div>
                <div className="space-y-3">
                  {reviews.length === 0 ? (
                    <p className="text-sm text-[#6B6B6B]">No reviews yet.</p>
                  ) : (
                    reviews.map((review) => (
                      <article key={review.id} className="border border-[#e4e0d7] p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#1A1A1A]">{asText(review.customer?.name, 'Customer')}</p>
                          <p className="text-xs text-[#6B6B6B]">{new Date(review.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={`review-${review.id}-star-${idx}`}
                              className={`h-3.5 w-3.5 ${
                                idx < Math.max(1, Math.min(5, toNumber(review.rating, 0)))
                                  ? 'fill-[#E85A3C] text-[#E85A3C]'
                                  : 'text-[#cfc8bc]'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="mt-1 text-sm text-[#2f2d29]">{asText(review.comment, '')}</p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {detailViewSettings.discoverEnabled ? (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="headline-lg text-[clamp(1.7rem,3vw,2.6rem)]">You May Also Like</h2>
              <p className="text-xs uppercase tracking-[0.12em] text-[#6B6B6B]">{discoverProducts.length} products</p>
            </div>
            {discoverProducts.length === 0 ? (
              <div className="border border-[#d7d3ca] bg-white px-4 py-8 text-sm text-[#6B6B6B]">No recommendations available.</div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {discoverProducts.map((entry) => (
                  <Link key={`${entry.productType}-${entry.id}`} to={discoverHref(entry)} className="product-card group bg-white">
                    <div className="relative aspect-[3/4] overflow-hidden bg-[#ece8df]">
                      <img
                        src={asText(entry.image, '/images/placeholder.jpg')}
                        alt={asText(entry.name, 'Product')}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[16px] shadow">
                        {flagEmoji(resolveCountryCode(entry.country) || 'NG')}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/30">
                        <span className="translate-y-2 border border-[#E85A3C] bg-[#E85A3C] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                          View Product
                        </span>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <p className="line-clamp-1 text-base font-semibold text-[#1A1A1A]">{asText(entry.name, 'Product')}</p>
                      <p className="line-clamp-1 text-sm text-[#6B6B6B]">{asText(entry.ownerName, config.ownerFallback)}</p>
                      <p className="mt-1 text-sm font-semibold text-[#E85A3C]">{formatFromUsd(toNumber(entry.priceUsd, 0))}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>

      {notice ? (
        <div className="fixed right-4 top-20 z-50 w-[min(92vw,360px)] border border-[#E85A3C]/30 bg-[#fff4f1] p-3 shadow">
          <p className="text-sm text-[#c44b30]">{notice}</p>
          <div className="mt-2 flex items-center gap-2">
            <Link to="/cart" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#1A1A1A]">
              Go to cart
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
