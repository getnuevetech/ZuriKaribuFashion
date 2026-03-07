import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type SyntheticEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Star, Heart, Loader2, Search, Eye, CreditCard, CheckCircle, Truck } from 'lucide-react';
import { api, resolveAssetUrl } from '../services/api';
import { fashionFallbackImage } from '../utils/fashionPlaceholder';
import { useQuery } from '@tanstack/react-query';
import { useCurrency } from '../components/ui/CurrencyProvider';

const fallbackImage = (seed: string, width = 1200, height = 1600) =>
  fashionFallbackImage(seed, { width, height });

const handleImageFallback =
  (seed: string, width = 1200, height = 1600) =>
  (event: SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget;
    const fallback = fallbackImage(seed, width, height);
    if (target.src === fallback) return;
    target.src = fallback;
  };

// How It Works steps
const howItWorksSteps = [
  { icon: Search, title: 'Discover Your Style', subtitle: 'Browse curated designs from top African creators.' },
  { icon: Eye, title: 'Preview Virtually', subtitle: 'Use virtual preview to visualize your look before checkout.' },
  { icon: Heart, title: 'Select Your Fabric', subtitle: 'Choose premium textiles that match your design perfectly.' },
  { icon: CreditCard, title: 'Pay Securely', subtitle: 'Checkout safely with trusted payment options.' },
  { icon: CheckCircle, title: 'Quality Assured', subtitle: 'Every order is reviewed by QA before shipment.' },
  { icon: Truck, title: 'Delivered to You', subtitle: 'Track your order and receive it at your doorstep.' },
];

// Shop by Category
const defaultShopCategories = [
  {
    title: 'Ready To Wear',
    description: 'Stunning dresses, elegant sets, and chic separates — expertly crafted for immediate style.',
    image: fallbackImage('shop-category-ready-to-wear'),
    link: '/ready-to-wear',
  },
  {
    title: 'Custom To Wear',
    description: 'Bespoke pieces tailored to your exact measurements — made just for you in 10-14 days.',
    image: fallbackImage('shop-category-custom'),
    link: '/custom-to-wear',
  },
  {
    title: 'Fabrics To Buy',
    description: 'Premium African textiles by the yard — Kente, Ankara, Kitenge and more direct from artisans.',
    image: fallbackImage('shop-category-fabrics'),
    link: '/fabrics-to-sell',
  },
];

// Default testimonials as fallback
const defaultTestimonials = [
  {
    id: '1',
    name: 'Amara Johnson',
    location: 'New York, USA',
    avatar: '',
    rating: 5,
    text: 'The quality exceeded my expectations. My dress fits perfectly and the fabric is gorgeous.',
  },
  {
    id: '2',
    name: 'Kwame Asante',
    location: 'London, UK',
    avatar: '',
    rating: 5,
    text: 'Amazing experience from start to finish. The custom tailoring service is a game changer!',
  },
  {
    id: '3',
    name: 'Fatima Mohammed',
    location: 'Dubai, UAE',
    avatar: '',
    rating: 5,
    text: 'Supporting African designers while getting beautiful clothes—this platform is a gem.',
  },
];

const DEFAULT_HOMEPAGE_VISIBILITY: Record<string, boolean> = {
  hero: true,
  countries: true,
  categories: true,
  howItWorks: true,
  featuredCustomToWear: true,
  bannerOne: true,
  featuredReadyToWear: true,
  bannerTwo: true,
  featuredFabrics: true,
  promoBanner: true,
  designerSpotlight: true,
  heritage: true,
  testimonials: true,
  cta: true,
};

const PAGE_CONTAINER_CLASS = 'w-full px-4 sm:px-6 lg:px-12 xl:px-20';
const SECTION_HEADING_CLASS = "font-['Oswald'] text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight";
const SECTION_SUBHEADING_CLASS = 'text-gray-500 text-sm sm:text-base';

interface SpotlightDesigner {
  id: string;
  name: string;
  country: string;
  image: string;
  bio: string;
}

interface CountryStripItem {
  id?: string;
  name: string;
  flag: string;
  image: string;
  fabrics: string;
  linkType?: 'DEFAULT' | 'INTERNAL_BLOG' | 'EXTERNAL_URL';
  story?: { slug?: string; title?: string } | null;
  externalUrl?: string | null;
}

interface DesignerSpotlightCard {
  id: string;
  name: string;
  country: string;
  image: string;
  quote: string;
  linkType?: 'DEFAULT' | 'INTERNAL_BLOG' | 'EXTERNAL_URL';
  story?: { slug?: string; title?: string } | null;
  externalUrl?: string | null;
}

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  ctaText: string;
  ctaLink: string;
}

interface FeaturedProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  designer: string;
  country: string;
  productType: string;
  badge?: string;
}

const useRevealOnScroll = (threshold = 0.2) => {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || isVisible) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible, threshold]);

  return { ref, isVisible };
};

interface ManagedBanner {
  id: string;
  name: string;
  section: string;
  title?: string | null;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  images?: string[];
  displayImage?: string | null;
}

const normalizeHeroBadge = (value: unknown) => {
  const badge = String(value || '').trim();
  if (!badge) return '';
  if (badge.toUpperCase() === 'FEATURED') return '';
  return badge;
};

const normalizeFeaturedProducts = (
  source: any[] | undefined,
  fallbackType: FeaturedProduct['productType']
): FeaturedProduct[] => {
  const input = Array.isArray(source) ? source : [];
  return input.map((item: any, index: number) => ({
    id: String(item?.id || `${fallbackType.toLowerCase()}-${index}`),
    name: item?.name || 'Featured Product',
    description: item?.description || '',
    price: Number(item?.price ?? 0),
    image: resolveAssetUrl(item?.image) || fallbackImage(`${fallbackType}-${index}`),
    designer: item?.designer || 'African Designer',
    country: item?.country || 'Africa',
    productType: item?.productType || fallbackType,
    badge: item?.badge,
  }));
};

// Default hero slides as fallback
const defaultHeroSlides: HeroSlide[] = [
  {
    id: '1',
    image: fallbackImage('hero-1', 1920, 1080),
    badge: 'NEW COLLECTION',
    title: 'Ready To Wear',
    subtitle: 'Dresses, sets, and separates — tailored fits finished by hand',
    ctaText: 'Shop Now',
    ctaLink: '/ready-to-wear',
  },
  {
    id: '2',
    image: fallbackImage('hero-2', 1920, 1080),
    badge: 'FRESH DROPS',
    title: 'New Arrivals',
    subtitle: 'New arrivals from the most talented designers across the continent',
    ctaText: 'Explore',
    ctaLink: '/custom-to-wear',
  },
  {
    id: '3',
    image: fallbackImage('hero-3', 1920, 1080),
    badge: 'TRENDING NOW',
    title: 'Trending Styles',
    subtitle: 'The pieces everyone is talking about this season',
    ctaText: 'View Trending',
    ctaLink: '/ready-to-wear',
  },
];


// Country flag mapping
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

const flagFromCountryCode = (countryCode?: string) => {
  const normalized = String(countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '';
  const [first, second] = normalized;
  return String.fromCodePoint(127397 + first.charCodeAt(0), 127397 + second.charCodeAt(0));
};

const resolveCardDestination = ({
  linkType,
  storySlug,
  externalUrl,
  fallbackTo,
}: {
  linkType?: string;
  storySlug?: string | null;
  externalUrl?: string | null;
  fallbackTo: string;
}) => {
  if (linkType === 'EXTERNAL_URL' && externalUrl) {
    return { href: externalUrl, external: true };
  }
  if (linkType === 'INTERNAL_BLOG' && storySlug) {
    return { href: `/stories/${storySlug}`, external: false };
  }
  return { href: fallbackTo, external: false };
};

export default function Home() {
  const { formatFromUsd } = useCurrency();
  // Fetch hero slides
  const { data: heroSlidesData } = useQuery({
    queryKey: ['heroSlides'],
    queryFn: async () => {
      const response = await api.homepage.getHeroSlides();
      return response.success ? response.data : defaultHeroSlides;
    },
  });

  const { data: managedBanners } = useQuery({
    queryKey: ['homepageBanners'],
    queryFn: async () => {
      const response = await api.banners.getBanners();
      return response.success ? (response.data as ManagedBanner[]) : [];
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['homepageShopCategories'],
    queryFn: async () => {
      const response = await api.homepageSections.getCategories();
      return response.success ? response.data : null;
    },
  });

  // Fetch all featured sections
  const { data: featuredData, isLoading: featuredLoading } = useQuery({
    queryKey: ['featuredProducts'],
    queryFn: async () => {
      const response = await api.homepage.getAllFeatured();
      return response.success ? response.data : null;
    },
  });

  const heroBanner = managedBanners?.find((item) => item.section === 'HERO');
  const bannerOne = managedBanners?.find((item) => item.section === 'BANNER_1');
  const bannerTwo = managedBanners?.find((item) => item.section === 'BANNER_2');
  const promoBanner = managedBanners?.find((item) => item.section === 'PROMO');

  const heroSlides: HeroSlide[] = useMemo(() => {
    const normalized = (Array.isArray(heroSlidesData) && heroSlidesData.length > 0 ? heroSlidesData : defaultHeroSlides).map(
      (slide: any, index: number) => ({
        id: String(slide?.id || `hero-${index}`),
        image: resolveAssetUrl(slide?.image),
        badge: normalizeHeroBadge(slide?.badge),
        title: slide?.title || 'African Fashion',
        subtitle: slide?.subtitle || '',
        ctaText: slide?.ctaText || 'Shop Now',
        ctaLink: slide?.ctaLink || '/custom-to-wear',
      })
    );

    if (!heroBanner) {
      return normalized;
    }

    const heroBannerImage = resolveAssetUrl(heroBanner.displayImage || heroBanner.images?.[0]);
    if (!heroBannerImage) {
      return normalized;
    }

    return [
      {
        id: `banner-hero-${heroBanner.id}`,
        image: heroBannerImage,
        badge: normalizeHeroBadge(heroBanner.name),
        title: heroBanner.title || normalized[0]?.title || 'African Fashion',
        subtitle: heroBanner.subtitle || normalized[0]?.subtitle || '',
        ctaText: heroBanner.ctaText || normalized[0]?.ctaText || 'Shop Now',
        ctaLink: heroBanner.ctaLink || normalized[0]?.ctaLink || '/custom-to-wear',
      },
      ...normalized,
    ];
  }, [heroBanner, heroSlidesData]);

  const featuredDesigns = useMemo(
    () => normalizeFeaturedProducts(featuredData?.FEATURED_DESIGNS, 'DESIGN'),
    [featuredData?.FEATURED_DESIGNS]
  );
  const featuredFabrics = useMemo(
    () => normalizeFeaturedProducts(featuredData?.FEATURED_FABRICS, 'FABRIC'),
    [featuredData?.FEATURED_FABRICS]
  );
  const featuredRTW = useMemo(
    () => normalizeFeaturedProducts(featuredData?.FEATURED_READY_TO_WEAR, 'READY_TO_WEAR'),
    [featuredData?.FEATURED_READY_TO_WEAR]
  );
  const fashionCountryImageMap = useMemo(() => {
    const map = new Map<string, string>();
    const candidates = [...featuredDesigns, ...featuredRTW, ...featuredFabrics];
    for (const product of candidates) {
      if (!product?.country || !product?.image || map.has(product.country)) {
        continue;
      }
      map.set(product.country, resolveAssetUrl(product.image));
    }
    return map;
  }, [featuredDesigns, featuredFabrics, featuredRTW]);

  // Fetch countries dynamically
  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const response = await api.homepageSections.getCountries();
      return response.success ? response.data : null;
    },
  });

  const { data: homepageVisibilityData } = useQuery({
    queryKey: ['homepageVisibility'],
    queryFn: async () => {
      const response = await api.homepageSections.getVisibility();
      return response.success ? response.data : null;
    },
  });

  const { data: designerSpotlightsData } = useQuery({
    queryKey: ['homepageDesignerSpotlights'],
    queryFn: async () => {
      const response = await api.homepageSections.getDesignerSpotlights();
      return response.success ? response.data : null;
    },
  });

  // Fetch testimonials dynamically
  const { data: testimonialsData } = useQuery({
    queryKey: ['testimonials'],
    queryFn: async () => {
      const response = await api.homepageSections.getTestimonials();
      return response.success ? response.data : null;
    },
  });

  const countriesFromFeatured = useMemo(() => {
    const byCountry = new Map<string, CountryStripItem>();
    for (const product of [...featuredDesigns, ...featuredRTW, ...featuredFabrics]) {
      if (!product.country || byCountry.has(product.country)) continue;
      byCountry.set(product.country, {
        id: product.country,
        name: product.country,
        flag: countryFlags[product.country] || '🌍',
        image: resolveAssetUrl(product.image) || fallbackImage(`country-${product.country}`, 640, 360),
        fabrics: 'Featured styles and fabrics',
        linkType: 'DEFAULT',
      });
    }
    return Array.from(byCountry.values());
  }, [featuredDesigns, featuredFabrics, featuredRTW]);

  // Use dynamic data or fallback to featured-derived countries
  const countries: CountryStripItem[] = countriesData?.length > 0
    ? countriesData.map((c: any) => ({
        id: c.id || c.name,
        name: c.name,
        flag: c.flag || flagFromCountryCode(c.countryCode) || countryFlags[c.name] || '🌍',
        image:
          resolveAssetUrl(c.image) ||
          fashionCountryImageMap.get(c.name) ||
          fallbackImage(`country-${c.name}`, 640, 360),
        fabrics: c.fabrics || 'Featured styles and fabrics',
        linkType: c.linkType || 'DEFAULT',
        story: c.story || null,
        externalUrl: c.externalUrl || null,
      }))
    : countriesFromFeatured.map((country) => ({ ...country, id: country.name }));
    
  const testimonials = testimonialsData?.length > 0 
    ? testimonialsData.map((t: any) => ({ 
        id: t.id, 
        name: t.name, 
        location: t.location, 
        avatar: t.avatar, 
        rating: t.rating, 
        text: t.text 
      })) 
    : defaultTestimonials;

  const sectionVisibility = useMemo(
    () => ({
      ...DEFAULT_HOMEPAGE_VISIBILITY,
      ...(homepageVisibilityData || {}),
    }),
    [homepageVisibilityData]
  );

  // Hero carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);
  const [customFeaturedStart, setCustomFeaturedStart] = useState(0);
  const [isCountryStripHovered, setIsCountryStripHovered] = useState(false);
  const [isCountryStripDragging, setIsCountryStripDragging] = useState(false);
  const customFeaturedPageSize = 3;
  const countryStripRef = useRef<HTMLDivElement | null>(null);
  const rtwStripRef = useRef<HTMLDivElement | null>(null);
  const fabricStripRef = useRef<HTMLDivElement | null>(null);
  const countryStripDragRef = useRef({ isDragging: false, startX: 0, startScrollLeft: 0 });
  const countryStripMovedRef = useRef(false);
  const categoriesReveal = useRevealOnScroll(0.15);
  const howItWorksReveal = useRevealOnScroll(0.15);
  const featuredCustomReveal = useRevealOnScroll(0.1);
  const featuredRtwReveal = useRevealOnScroll(0.1);
  const featuredFabricReveal = useRevealOnScroll(0.1);
  const designerReveal = useRevealOnScroll(0.15);
  const heritageReveal = useRevealOnScroll(0.2);
  const testimonialsReveal = useRevealOnScroll(0.15);
  const ctaReveal = useRevealOnScroll(0.15);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    if (testimonials.length <= 1) {
      setActiveTestimonialIndex(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setActiveTestimonialIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);

  const customFeaturedItems = useMemo(() => {
    if (featuredDesigns.length <= customFeaturedPageSize) {
      return featuredDesigns;
    }
    const end = customFeaturedStart + customFeaturedPageSize;
    if (end <= featuredDesigns.length) {
      return featuredDesigns.slice(customFeaturedStart, end);
    }
    return [
      ...featuredDesigns.slice(customFeaturedStart),
      ...featuredDesigns.slice(0, end - featuredDesigns.length),
    ];
  }, [featuredDesigns, customFeaturedStart]);

  useEffect(() => {
    setCustomFeaturedStart((previous) => {
      if (featuredDesigns.length === 0) return 0;
      return Math.min(previous, featuredDesigns.length - 1);
    });
  }, [featuredDesigns.length]);

  const fallbackSpotlightDesigners = useMemo(() => {
    const mappedDesigners = [...featuredDesigns, ...featuredRTW]
      .map((item) => {
        const cleanedName = (item.designer || '').split('•')[0].trim();
        const country = (item.country || '').trim();
        if (!cleanedName || !country || !item.image) return null;
        return {
          id: `${cleanedName}-${country}`,
          name: cleanedName,
          country,
          image: resolveAssetUrl(item.image),
          bio: `Signature styles from ${country}.`,
        } satisfies SpotlightDesigner;
      })
      .filter((item): item is SpotlightDesigner => Boolean(item));

    const designerMap = new Map<string, SpotlightDesigner>();
    for (const item of mappedDesigners) {
      if (designerMap.has(item.id)) continue;
      designerMap.set(item.id, item);
    }

    return Array.from(designerMap.values()).slice(0, 3);
  }, [featuredDesigns, featuredRTW]);

  const designerSpotlightCards: DesignerSpotlightCard[] = useMemo(() => {
    if (Array.isArray(designerSpotlightsData) && designerSpotlightsData.length > 0) {
      return designerSpotlightsData.slice(0, 3).map((item: any, index: number) => ({
        id: String(item?.id || `spotlight-${index}`),
        name: item?.designer?.businessName || 'Featured Designer',
        country: item?.designer?.country || 'Africa',
        image: resolveAssetUrl(item?.image) || fallbackImage(`spotlight-${index}`, 900, 1200),
        quote: item?.quote || item?.headline || item?.description || item?.bio || 'Discover this designer story.',
        linkType: item?.linkType || 'DEFAULT',
        story: item?.story || null,
        externalUrl: item?.externalUrl || null,
      }));
    }
    return fallbackSpotlightDesigners.map((designer) => ({
      id: designer.id,
      name: designer.name,
      country: designer.country,
      image: designer.image,
      quote: designer.bio,
      linkType: 'DEFAULT',
      story: null,
      externalUrl: null,
    }));
  }, [designerSpotlightsData, fallbackSpotlightDesigners]);

  const shopCategories = useMemo(() => {
    if (Array.isArray(categoriesData) && categoriesData.length > 0) {
      return categoriesData.map((category: any, index: number) => ({
        id: String(category?.id || `category-${index}`),
        title: category?.title || 'Category',
        description: category?.subtitle || category?.description || 'Explore this collection',
        image:
          resolveAssetUrl(category?.image) ||
          fallbackImage(`shop-category-${String(category?.title || index).toLowerCase()}`),
        link: category?.link || category?.ctaLink || '/custom-to-wear',
      }));
    }
    return defaultShopCategories.map((category, index) => ({
      ...category,
      id: `default-category-${index}`,
    }));
  }, [categoriesData]);

  useEffect(() => {
    const strip = countryStripRef.current;
    if (!strip || countries.length === 0) {
      return undefined;
    }

    let frameId = 0;
    const animate = () => {
      const dragging = countryStripDragRef.current.isDragging;
      if (!isCountryStripHovered && !dragging) {
        const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
        if (maxScrollLeft > 0) {
          strip.scrollLeft += 0.45;
          if (strip.scrollLeft >= maxScrollLeft) {
            strip.scrollLeft = 0;
          }
        }
      }
      frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(frameId);
  }, [countries.length, isCountryStripHovered]);

  useEffect(() => {
    const handleMouseUp = () => {
      countryStripDragRef.current.isDragging = false;
      setIsCountryStripDragging(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const goToPrevCustomFeatured = () => {
    if (featuredDesigns.length <= customFeaturedPageSize) return;
    setCustomFeaturedStart((prev) => (prev - 1 + featuredDesigns.length) % featuredDesigns.length);
  };

  const goToNextCustomFeatured = () => {
    if (featuredDesigns.length <= customFeaturedPageSize) return;
    setCustomFeaturedStart((prev) => (prev + 1) % featuredDesigns.length);
  };

  const scrollStripBy = (stripRef: { current: HTMLDivElement | null }, direction: 'left' | 'right') => {
    const strip = stripRef.current;
    if (!strip) return;
    const amount = Math.max(260, Math.round(strip.clientWidth * 0.72));
    strip.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  const handleCountryStripMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const strip = countryStripRef.current;
    if (!strip) return;
    countryStripDragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: strip.scrollLeft,
    };
    countryStripMovedRef.current = false;
    setIsCountryStripDragging(true);
    setIsCountryStripHovered(true);
  };

  const handleCountryStripMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const strip = countryStripRef.current;
    const drag = countryStripDragRef.current;
    if (!strip || !drag.isDragging) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) {
      countryStripMovedRef.current = true;
    }
    strip.scrollLeft = drag.startScrollLeft - delta;
  };

  const handleCountryStripMouseUp = () => {
    countryStripDragRef.current.isDragging = false;
    setIsCountryStripDragging(false);
    setIsCountryStripHovered(false);
  };

  const handleCountryStripWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const strip = countryStripRef.current;
    if (!strip) return;
    const primaryDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (primaryDelta === 0) return;
    event.preventDefault();
    strip.scrollLeft += primaryDelta;
  };

  // Product card component
  const ProductCard = ({ product }: { product: FeaturedProduct }) => (
    <Link
      to={`/${product.productType === 'DESIGN' ? 'custom-to-wear' : product.productType === 'FABRIC' ? 'fabrics-to-sell' : 'ready-to-wear'}/${product.id}`}
      className="group block bg-white overflow-hidden rounded-lg transition-all duration-500 border border-black/10 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)]"
    >
      <div className="relative overflow-hidden bg-gray-100" style={{ aspectRatio: '3/4' }}>
        <img
          src={product.image}
          alt={product.name}
          onError={handleImageFallback(`product-${product.id}`)}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        {product.badge && (
          <div className={`absolute top-3 left-3 px-2 py-1 text-xs font-semibold text-white rounded ${
            product.badge === 'SALE' ? 'bg-red-500' : 
            product.badge === 'NEW' ? 'bg-green-500' : 
            product.badge === 'PROMO' ? 'bg-purple-500' : 
            product.badge === 'BEST SELLER' ? 'bg-amber-500' : 'bg-black'
          }`}>
            {product.badge}
          </div>
        )}
        <button className="absolute top-3 right-3 p-2 bg-white/90 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
          <Heart className="w-4 h-4 text-gray-600" />
        </button>
        <div className="absolute bottom-3 right-3 text-2xl">
          {countryFlags[product.country] || '🌍'}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-black transition-colors line-clamp-1">
          {product.name}
        </h3>
        <p className="text-sm text-gray-500 mt-1">{product.designer}</p>
        <p className="font-bold text-black mt-2">
          {formatFromUsd(product.price)}
          {product.productType === 'FABRIC' && <span className="text-sm font-normal text-gray-500">/yard</span>}
        </p>
      </div>
    </Link>
  );

  const renderManagedBanner = ({
    banner,
    fallbackImage,
    fallbackTitle,
    fallbackSubtitle,
    fallbackCtaText,
    fallbackCtaLink,
  }: {
    banner?: ManagedBanner;
    fallbackImage?: string;
    fallbackTitle?: string;
    fallbackSubtitle?: string;
    fallbackCtaText?: string;
    fallbackCtaLink?: string;
  }) => {
    if (!banner && !fallbackImage) return null;

    const image = resolveAssetUrl(banner?.displayImage || banner?.images?.[0] || fallbackImage);
    if (!image) return null;

    const title = banner?.title || fallbackTitle || '';
    const subtitle = banner?.subtitle || fallbackSubtitle || '';
    const ctaText = banner?.ctaText || fallbackCtaText;
    const ctaLink = banner?.ctaLink || fallbackCtaLink || '#';

    return (
      <section className="py-10 md:py-12 bg-[#F5F5F2]">
        <div className="relative h-[250px] md:h-[320px] overflow-hidden">
          <img src={image} alt={title || 'Promotional banner'} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">
            {title && <h2 className="font-['Oswald'] text-3xl md:text-4xl lg:text-5xl font-bold mb-2">{title}</h2>}
            {subtitle && <p className="text-white/85 mb-6">{subtitle}</p>}
            {ctaText && (
              <Link
                to={ctaLink}
                className="inline-flex items-center gap-2 border border-white text-white px-6 py-3 rounded-none text-xs sm:text-sm font-semibold tracking-[0.16em] hover:bg-white hover:text-black transition-colors"
              >
                {ctaText}
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  };

  const activeTestimonial = testimonials[activeTestimonialIndex] ?? testimonials[0];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Carousel */}
      {sectionVisibility.hero ? (
      <section className="relative h-[86vh] min-h-[620px] md:min-h-[760px] lg:min-h-[840px] overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${slide.image})` }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(100deg, rgba(0,0,0,0.78) 10%, rgba(0,0,0,0.52) 45%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0.62) 100%)',
                }}
              />
            </div>
            <div className="relative h-full flex items-end pb-24 md:pb-28">
              <div className={PAGE_CONTAINER_CLASS}>
                <div className="max-w-xl text-white">
                  {slide.badge ? (
                    <span className="inline-block px-3 py-1 border border-white/80 text-white text-[11px] font-semibold tracking-[0.18em] mb-4">
                      {slide.badge}
                    </span>
                  ) : null}
                  <h1 className="font-['Oswald'] text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold mb-3 leading-tight">
                    {slide.title}
                  </h1>
                  <p className="text-base sm:text-lg md:text-xl text-white text-opacity-90 mb-7 max-w-lg">
                    {slide.subtitle}
                  </p>
                  <Link
                    to={slide.ctaLink}
                  className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-none text-xs sm:text-sm font-semibold tracking-[0.16em] shadow-lg transition-all hover:bg-white/90"
                  >
                    {slide.ctaText}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/25 hover:bg-black/40 backdrop-blur-sm rounded-full border border-white/20 text-white transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/25 hover:bg-black/40 backdrop-blur-sm rounded-full border border-white/20 text-white transition-all"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 flex gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentSlide ? 'bg-white w-6' : 'bg-white bg-opacity-50'
              }`}
            />
          ))}
        </div>
      </section>
      ) : null}

      {/* Countries Marquee */}
      {sectionVisibility.countries && countries.length > 0 && (
        <section
          className={`relative ${
            sectionVisibility.hero ? '-mt-24 md:-mt-28 lg:-mt-32 z-20' : 'mt-0'
          } pb-8 bg-transparent overflow-hidden`}
        >
          <div className={PAGE_CONTAINER_CLASS}>
            <div
              ref={countryStripRef}
              onMouseEnter={() => setIsCountryStripHovered(true)}
              onMouseLeave={() => {
                countryStripDragRef.current.isDragging = false;
                setIsCountryStripDragging(false);
                setIsCountryStripHovered(false);
              }}
              onMouseDown={handleCountryStripMouseDown}
              onMouseMove={handleCountryStripMouseMove}
              onMouseUp={handleCountryStripMouseUp}
              onWheel={handleCountryStripWheel}
              className={`flex overflow-x-auto gap-5 select-none [&::-webkit-scrollbar]:hidden ${
                isCountryStripDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              style={{ scrollbarWidth: 'none' }}
            >
              {countries.map((country, index) => (
                (() => {
                const destination = resolveCardDestination({
                  linkType: country.linkType,
                  storySlug: country.story?.slug,
                  externalUrl: country.externalUrl,
                  fallbackTo: `/custom-to-wear?country=${country.name}`,
                });
                const cardClassName =
                  'group relative flex-shrink-0 w-[11.5rem] h-[6.4rem] overflow-hidden rounded-lg border border-black/10 shadow-[0_14px_28px_rgba(0,0,0,0.16)]';
                const onCardClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
                  if (countryStripMovedRef.current) {
                    event.preventDefault();
                    countryStripMovedRef.current = false;
                  }
                };
                const cardContent = (
                  <>
                    <img
                      src={country.image}
                      alt={country.name}
                      onError={handleImageFallback(`country-${country.name}`, 640, 360)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent)' }} />
                    <div className="absolute bottom-3 left-3 text-white">
                      <span className="text-xl">{country.flag}</span>
                      <h3 className="font-semibold text-sm mt-1">{country.name}</h3>
                      <p className="text-xs text-white text-opacity-70">{country.fabrics}</p>
                    </div>
                  </>
                );

                return destination.external ? (
                  <a
                    key={country.id || `${country.name}-${index}`}
                    href={destination.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onCardClick}
                    className={cardClassName}
                  >
                    {cardContent}
                  </a>
                ) : (
                  <Link
                    key={country.id || `${country.name}-${index}`}
                    to={destination.href}
                    onClick={onCardClick}
                    className={cardClassName}
                  >
                    {cardContent}
                  </Link>
                );
                })()
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Shop by Category */}
      {sectionVisibility.categories ? (
      <section
        ref={categoriesReveal.ref}
        className={`py-12 md:py-14 bg-white transition-all duration-700 ${
          categoriesReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className={PAGE_CONTAINER_CLASS}>
          <div className="text-center mb-7 md:mb-8">
            <h2 className={`${SECTION_HEADING_CLASS} text-gray-900 mb-3`}>Shop by Category</h2>
            <p className={SECTION_SUBHEADING_CLASS}>Choose what fits your moment—ready pieces, custom fits, or raw fabrics.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {shopCategories.map((category, index) => (
              <Link
                key={category.id || index}
                to={category.link}
                className={`group relative h-[320px] md:h-[520px] overflow-hidden rounded-xl shadow-sm border border-black/10 transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] ${
                  categoriesReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${120 + index * 90}ms` }}
              >
                <img
                  src={category.image}
                  alt={category.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.2), transparent)' }} />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <h3 className="text-2xl font-bold mb-2">{category.title}</h3>
                  <p className="text-sm text-white text-opacity-80 mb-4">{category.description}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all">
                    Shop Now <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {/* How It Works */}
      {sectionVisibility.howItWorks ? (
      <section
        ref={howItWorksReveal.ref}
        className={`py-10 md:py-12 bg-[#F5F5F2] transition-all duration-700 ${
          howItWorksReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className={PAGE_CONTAINER_CLASS}>
          <div className="text-center mb-8">
            <h2 className={`${SECTION_HEADING_CLASS} text-gray-900 mb-3`}>How It Works</h2>
            <p className={`${SECTION_SUBHEADING_CLASS} max-w-2xl mx-auto`}>
              Your journey to authentic African fashion in six simple steps.
            </p>
          </div>
          <div className="flex items-start lg:items-stretch justify-between gap-4 md:gap-5 lg:gap-6 overflow-x-auto pb-2">
            {howItWorksSteps.map((step, index) => (
              <div
                key={index}
                className={`min-w-[160px] sm:min-w-[180px] lg:min-w-0 flex-1 text-center bg-white rounded-xl border border-black/10 p-4 shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-md ${
                  howItWorksReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${80 + index * 70}ms` }}
              >
                <div className="w-12 h-12 md:w-14 md:h-14 bg-black rounded-full flex items-center justify-center mx-auto mb-3">
                  <step.icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-xs md:text-sm text-gray-600 leading-snug">{step.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {/* Featured Custom To Wear */}
      {sectionVisibility.featuredCustomToWear ? (
      <section
        ref={featuredCustomReveal.ref}
        className={`py-12 md:py-14 bg-white transition-all duration-700 ${
          featuredCustomReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className={PAGE_CONTAINER_CLASS}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="inline-flex border border-black px-2 py-1 text-[11px] tracking-[0.18em] font-semibold mb-2">FEATURED</p>
              <h2 className="font-['Oswald'] text-3xl md:text-4xl font-bold text-gray-900">Custom To Wear</h2>
              <p className="text-gray-500 mt-1">Made To Fit by an African with Love</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="p-2 border border-black/20 rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={goToPrevCustomFeatured}
                disabled={featuredDesigns.length <= customFeaturedPageSize}
                aria-label="Previous custom products"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                className="p-2 border border-black/20 rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={goToNextCustomFeatured}
                disabled={featuredDesigns.length <= customFeaturedPageSize}
                aria-label="Next custom products"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <Link
                to="/custom-to-wear"
                className="hidden sm:inline-flex items-center gap-2 text-gray-700 hover:text-black font-medium ml-4"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {featuredLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-black" />
            </div>
          ) : customFeaturedItems.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-5">
              {customFeaturedItems.map((product, index) => (
                <div
                  key={product.id}
                  className={`transition-all duration-700 ${
                    featuredCustomReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                  }`}
                  style={{ transitionDelay: `${120 + index * 80}ms` }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 p-6 text-sm text-gray-600">
              No featured custom designs yet.
            </div>
          )}
        </div>
      </section>
      ) : null}

      {sectionVisibility.bannerOne ? renderManagedBanner({
        banner: bannerOne,
      }) : null}

      {/* Featured Ready To Wear */}
      {sectionVisibility.featuredReadyToWear ? (
      <section
        ref={featuredRtwReveal.ref}
        className={`py-12 md:py-14 bg-[#F5F5F2] transition-all duration-700 ${
          featuredRtwReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className={PAGE_CONTAINER_CLASS}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="inline-flex border border-black px-2 py-1 text-[11px] tracking-[0.18em] font-semibold mb-2">FEATURED</p>
              <h2 className="font-['Oswald'] text-3xl md:text-4xl font-bold text-gray-900">Ready To Wear</h2>
              <p className="text-gray-500 mt-1">Made To Standard sizes for all</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="p-2 border border-black/20 rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                onClick={() => scrollStripBy(rtwStripRef, 'left')}
                disabled={featuredRTW.length <= 2}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                className="p-2 border border-black/20 rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                onClick={() => scrollStripBy(rtwStripRef, 'right')}
                disabled={featuredRTW.length <= 2}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <Link
                to="/ready-to-wear"
                className="hidden sm:inline-flex items-center gap-2 text-gray-700 hover:text-black font-medium ml-4"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {featuredLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-black" />
            </div>
          ) : featuredRTW.length > 0 ? (
            <div
              ref={rtwStripRef}
              className="flex gap-4 md:gap-5 overflow-x-auto pb-2 scrollbar-hide"
            >
              {featuredRTW.map((product, index) => (
                <div
                  key={product.id}
                  className={`w-[13.5rem] sm:w-[14.5rem] md:w-[15.5rem] flex-shrink-0 transition-all duration-700 ${
                    featuredRtwReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                  }`}
                  style={{ transitionDelay: `${100 + index * 70}ms` }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 p-6 text-sm text-gray-600">
              No featured ready-to-wear products yet.
            </div>
          )}
        </div>
      </section>
      ) : null}

      {sectionVisibility.bannerTwo ? renderManagedBanner({
        banner: bannerTwo,
      }) : null}

      {/* Featured Fabrics */}
      {sectionVisibility.featuredFabrics ? (
      <section
        ref={featuredFabricReveal.ref}
        className={`py-12 md:py-14 bg-white transition-all duration-700 ${
          featuredFabricReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className={PAGE_CONTAINER_CLASS}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="inline-flex border border-black px-2 py-1 text-[11px] tracking-[0.18em] font-semibold mb-2">FEATURED</p>
              <h2 className="font-['Oswald'] text-3xl md:text-4xl font-bold text-gray-900">Fabrics To Buy</h2>
              <p className="text-gray-500 mt-1">Fabrics from all across the edges of Africa</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="p-2 border border-black/20 rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                onClick={() => scrollStripBy(fabricStripRef, 'left')}
                disabled={featuredFabrics.length <= 2}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                className="p-2 border border-black/20 rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                onClick={() => scrollStripBy(fabricStripRef, 'right')}
                disabled={featuredFabrics.length <= 2}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <Link
                to="/fabrics-to-sell"
                className="hidden sm:inline-flex items-center gap-2 text-gray-700 hover:text-black font-medium ml-4"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {featuredLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-black" />
            </div>
          ) : featuredFabrics.length > 0 ? (
            <div
              ref={fabricStripRef}
              className="flex gap-4 md:gap-5 overflow-x-auto pb-2 scrollbar-hide"
            >
              {featuredFabrics.map((product, index) => (
                <div
                  key={product.id}
                  className={`w-[13.5rem] sm:w-[14.5rem] md:w-[15.5rem] flex-shrink-0 transition-all duration-700 ${
                    featuredFabricReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                  }`}
                  style={{ transitionDelay: `${100 + index * 70}ms` }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 p-6 text-sm text-gray-600">
              No featured fabrics yet.
            </div>
          )}
        </div>
      </section>
      ) : null}

      {sectionVisibility.promoBanner ? renderManagedBanner({
        banner: promoBanner,
        fallbackImage: fallbackImage('promo-fresh-drops', 1600, 900),
        fallbackTitle: 'Fresh Drops',
        fallbackSubtitle: 'New arrivals from the most talented designers across the continent.',
        fallbackCtaText: 'Shop New Arrivals',
        fallbackCtaLink: '/ready-to-wear',
      }) : null}

      {/* Designer Spotlight */}
      {sectionVisibility.designerSpotlight ? (
      <section
        ref={designerReveal.ref}
        className={`py-12 md:py-14 bg-white transition-all duration-700 ${
          designerReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className={PAGE_CONTAINER_CLASS}>
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="inline-flex border border-black px-2 py-1 text-[11px] tracking-[0.18em] font-semibold mb-2">DESIGNER SPOTLIGHT</p>
              <h2 className="font-['Oswald'] text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900">Meet Designers Across Africa</h2>
              <p className="text-gray-500 mt-1">Showcasing featured talent from different countries.</p>
            </div>
            <Link
              to="/designers"
              className="hidden sm:inline-flex items-center gap-2 text-gray-700 hover:text-black font-medium"
            >
              Meet All Designers <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {designerSpotlightCards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {designerSpotlightCards.map((designer) => {
                const destination = resolveCardDestination({
                  linkType: designer.linkType,
                  storySlug: designer.story?.slug,
                  externalUrl: designer.externalUrl,
                  fallbackTo: `/custom-to-wear?country=${encodeURIComponent(designer.country)}`,
                });
                const cardContent = (
                  <>
                    <div className="relative h-[440px] md:h-[500px] overflow-hidden bg-gray-100">
                      <img
                        src={designer.image}
                        alt={`${designer.name} from ${designer.country}`}
                        onError={handleImageFallback(`designer-${designer.id}`, 900, 1200)}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                        <p className="text-xs tracking-wider text-white/75 mb-1">DESIGNER SPOTLIGHT</p>
                        <h3 className="font-['Oswald'] text-2xl font-bold leading-tight">{designer.name}</h3>
                        <p className="text-sm text-white/80 mt-1">
                          {countryFlags[designer.country] || '🌍'} {designer.country}
                        </p>
                        <p className="text-sm text-white/80 mt-3 italic">"{designer.quote}"</p>
                      </div>
                    </div>
                  </>
                );

                return destination.external ? (
                  <a
                    key={designer.id}
                    href={destination.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group bg-white overflow-hidden rounded-xl shadow-sm border border-black/10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] transition-all duration-700 hover:-translate-y-2 ${
                      designerReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                    }`}
                    style={{
                      transitionDelay: `${120 + designerSpotlightCards.findIndex((entry) => entry.id === designer.id) * 90}ms`,
                    }}
                  >
                    {cardContent}
                  </a>
                ) : (
                  <Link
                    key={designer.id}
                    to={destination.href}
                    className={`group bg-white overflow-hidden rounded-xl shadow-sm border border-black/10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] transition-all duration-700 hover:-translate-y-2 ${
                      designerReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                    }`}
                    style={{
                      transitionDelay: `${120 + designerSpotlightCards.findIndex((entry) => entry.id === designer.id) * 90}ms`,
                    }}
                  >
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 p-6 text-sm text-gray-600">
              Designer spotlight will appear once cards are configured in admin.
            </div>
          )}
        </div>
      </section>
      ) : null}

      {/* Heritage Story */}
      {sectionVisibility.heritage ? (
      <section
        ref={heritageReveal.ref}
        className={`py-12 md:py-14 bg-[#F5F5F2] transition-all duration-700 ${
          heritageReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="w-full">
          <div className="relative overflow-hidden rounded-none min-h-[380px] md:min-h-[520px]">
            <div className="absolute inset-0">
              <img
                src={fallbackImage('heritage-story', 1400, 900)}
                alt="African textile heritage"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/20" />
            <div className="relative z-10 flex min-h-[380px] md:min-h-[520px] items-center justify-center px-6 py-10 md:px-16 text-center">
              <div className="max-w-3xl text-white">
                <p className="text-white text-xs md:text-sm tracking-[0.24em] font-semibold mb-3 border border-white/70 px-3 py-1 inline-flex">HERITAGE STORY</p>
                <h2 className="font-['Oswald'] text-4xl md:text-6xl font-bold mb-4">Rooted in Culture</h2>
                <p className="text-white/85 text-base md:text-lg mb-7">
                  Every pattern carries meaning. From Kente&apos;s bold geometry to Ankara&apos;s vibrant motifs,
                  African textiles tell stories of identity, celebration, and legacy passed through generations.
                </p>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 border border-white text-white px-7 py-3 rounded-none text-xs sm:text-sm tracking-[0.16em] font-semibold hover:bg-white hover:text-black transition-colors"
                >
                  Read Our Story <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {/* Testimonials */}
      {sectionVisibility.testimonials ? (
      <section
        ref={testimonialsReveal.ref}
        className={`py-12 md:py-14 bg-white transition-all duration-700 ${
          testimonialsReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className={PAGE_CONTAINER_CLASS}>
          <div className="text-center mb-8">
            <h2 className="font-['Oswald'] text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2">What Our Customers Say</h2>
            <p className="text-gray-600">Join thousands of happy customers worldwide.</p>
          </div>
          <div
            className={`mx-auto max-w-3xl bg-[#F5F5F2] p-7 md:p-10 rounded-xl border border-black/10 transition-all duration-700 ${
              testimonialsReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="flex items-center justify-center gap-1 mb-4">
              {[...Array(activeTestimonial?.rating ?? 5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-gray-900 text-lg md:text-2xl text-center leading-relaxed mb-8">
              "{activeTestimonial?.text}"
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-11 h-11 bg-black rounded-full flex items-center justify-center text-white font-semibold">
                {String(activeTestimonial?.name || 'A')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">{activeTestimonial?.name}</p>
                <p className="text-sm text-gray-600">{activeTestimonial?.location}</p>
              </div>
            </div>
            {testimonials.length > 1 ? (
              <div className="mt-7 flex items-center justify-center gap-2">
                {testimonials.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTestimonialIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      index === activeTestimonialIndex ? 'w-7 bg-black' : 'w-2.5 bg-black/25 hover:bg-black/45'
                    }`}
                    aria-label={`Show testimonial ${index + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      {/* CTA Section */}
      {sectionVisibility.cta ? (
      <section
        ref={ctaReveal.ref}
        className={`py-12 md:py-14 bg-[#F5F5F2] transition-all duration-700 ${
          ctaReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className={PAGE_CONTAINER_CLASS}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Shop CTA */}
            <div
              className={`bg-black rounded-xl p-7 md:p-10 text-center text-white shadow-sm transition-all duration-700 ${
                ctaReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: '120ms' }}
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to Wear African Fashion?</h2>
              <p className="text-white/85 mb-6">
                Join our community of fashion lovers and discover unique pieces from talented African designers.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/custom-to-wear"
                  className="inline-flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-none text-xs tracking-[0.16em] font-semibold hover:bg-white/90 transition-colors"
                >
                  Shop Now
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-transparent border border-white text-white px-6 py-3 rounded-none text-xs tracking-[0.16em] font-semibold hover:bg-white hover:text-black transition-colors"
                >
                  Create Account
                </Link>
              </div>
            </div>

            {/* Newsletter CTA */}
            <div
              className={`bg-white rounded-xl p-7 md:p-10 text-center text-gray-900 shadow-sm border border-black/10 transition-all duration-700 ${
                ctaReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: '220ms' }}
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Join the Movement</h2>
              <p className="text-gray-600 mb-6">
                Subscribe to our newsletter for exclusive offers, new arrivals, and stories from the continent.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-none border border-black/20 text-gray-900 focus:border-black focus:outline-none"
                />
                <button className="px-6 py-3 bg-black text-white rounded-none text-xs tracking-[0.16em] font-semibold hover:bg-black/85 transition-colors">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}
    </div>
  );
}
