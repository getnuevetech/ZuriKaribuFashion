import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Heart,
  Loader2,
  Search,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

const USE_DYNAMIC_HOMEPAGE = import.meta.env.VITE_HOMEPAGE_MODE === 'dynamic';

type HeroSlide = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  badge: string;
  ctaText: string;
  ctaLink: string;
};

type FeaturedProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  designer: string;
  country: string;
  flag?: string;
  productType: string;
};

type CountryCard = {
  name: string;
  flag: string;
  fabrics: string;
};

type ManagedBanner = {
  id: string;
  section: string;
  title?: string | null;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  images?: string[];
  displayImage?: string | null;
};

type HomepageVisibility = Record<
  | 'hero'
  | 'countries'
  | 'categories'
  | 'howItWorks'
  | 'featuredCustomToWear'
  | 'featuredReadyToWear'
  | 'featuredFabrics'
  | 'promoBanner'
  | 'designerSpotlight'
  | 'heritage'
  | 'testimonials'
  | 'cta',
  boolean
>;

const DEFAULT_HOMEPAGE_VISIBILITY: HomepageVisibility = {
  hero: true,
  countries: true,
  categories: true,
  howItWorks: true,
  featuredCustomToWear: true,
  featuredReadyToWear: true,
  featuredFabrics: true,
  promoBanner: true,
  designerSpotlight: true,
  heritage: true,
  testimonials: true,
  cta: true,
};

const countryFlags: Record<string, string> = {
  Ghana: '🇬🇭',
  Nigeria: '🇳🇬',
  Kenya: '🇰🇪',
  Senegal: '🇸🇳',
  Ethiopia: '🇪🇹',
  Morocco: '🇲🇦',
  Mali: '🇲🇱',
  'South Africa': '🇿🇦',
  Tanzania: '🇹🇿',
};

const kimiHeroSlides: HeroSlide[] = [
  {
    id: '1',
    image: 'https://picsum.photos/seed/kimi-hero-1/1920/1080',
    badge: 'NEW COLLECTION',
    title: 'The Elegance of Africa',
    subtitle: 'Discover authentic fashion crafted by African designers',
    ctaText: 'SHOP NOW',
    ctaLink: '/ready-to-wear',
  },
  {
    id: '2',
    image: 'https://picsum.photos/seed/kimi-hero-2/1920/1080',
    badge: 'FRESH DROPS',
    title: 'Timeless Heritage',
    subtitle: 'Wear the story of African craftsmanship',
    ctaText: 'SHOP NOW',
    ctaLink: '/designs',
  },
  {
    id: '3',
    image: 'https://picsum.photos/seed/kimi-hero-3/1920/1080',
    badge: 'TRENDING NOW',
    title: 'Modern African Luxury',
    subtitle: 'Contemporary designs rooted in tradition',
    ctaText: 'SHOP NOW',
    ctaLink: '/ready-to-wear',
  },
];

const kimiCountries: CountryCard[] = [
  { name: 'Angola', flag: '🇦🇴', fabrics: 'Kanari, Masai' },
  { name: 'Algeria', flag: '🇩🇿', fabrics: 'Camru, Kokomo' },
  { name: 'Nigeria', flag: '🇳🇬', fabrics: 'Adire, Ankara, Aso-Oke' },
];

const kimiCategories = [
  {
    id: '1',
    title: 'Ready To Wear',
    description: 'Made by African, Worn by the World',
    image: 'https://picsum.photos/seed/kimi-category-ready/900/1200',
    link: '/ready-to-wear',
  },
  {
    id: '2',
    title: 'Fabrics To Buy',
    description: 'African fabrics across all edges of Africa',
    image: 'https://picsum.photos/seed/kimi-category-fabrics/900/1200',
    link: '/fabrics',
  },
  {
    id: '3',
    title: 'Custom To Wear',
    description: 'Every stitch sewn by an African Designer',
    image: 'https://picsum.photos/seed/kimi-category-custom/900/1200',
    link: '/designs',
  },
];

const kimiHowItWorks = [
  { id: 1, title: 'Discover Your Style', subtitle: 'Explore curated African designs and fabrics.', icon: Search },
  { id: 2, title: 'Preview Virtually', subtitle: 'Visualize your outfit before checkout.', icon: Eye },
  { id: 3, title: 'Select Your Fabric', subtitle: 'Choose textures and colors that match your look.', icon: Sparkles },
  { id: 4, title: 'Pay Securely', subtitle: 'Complete checkout with protected payment flows.', icon: CreditCard },
  { id: 5, title: 'Quality Assured', subtitle: 'Every order passes expert review before dispatch.', icon: Star },
  { id: 6, title: 'Delivered to You', subtitle: 'Receive your order anywhere in the world.', icon: Truck },
];

const iconByName: Record<string, any> = {
  Search,
  Eye,
  Sparkles,
  CreditCard,
  Star,
  Truck,
};

const normalizeIconKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const iconByNormalizedName: Record<string, any> = {
  search: Search,
  eye: Eye,
  sparkles: Sparkles,
  sparkle: Sparkles,
  creditcard: CreditCard,
  card: CreditCard,
  star: Star,
  truck: Truck,
  delivery: Truck,
  shipped: Truck,
};

const kimiFeaturedDesigns: FeaturedProduct[] = [
  { id: '1', name: 'Exclusive Gorgeous', price: 1428.57, image: 'https://picsum.photos/seed/kimi-custom-1/800/1000', designer: 'Asante Designs', country: 'Ghana', productType: 'DESIGN' },
  { id: '2', name: 'My Skkentele', price: 714.29, image: 'https://picsum.photos/seed/kimi-custom-2/800/1000', designer: 'Asante Designs', country: 'Ghana', productType: 'DESIGN' },
  { id: '3', name: 'Ankara Gbasibe', price: 857.14, image: 'https://picsum.photos/seed/kimi-custom-3/800/1000', designer: 'Asante Designs', country: 'Ghana', productType: 'DESIGN' },
];

const kimiReadyToWear: FeaturedProduct[] = [
  { id: 'r1', name: 'Bridal Traditional', price: 2285.71, image: 'https://picsum.photos/seed/kimi-ready-1/800/1000', designer: 'Asante Designs', country: 'Ghana', productType: 'READY_TO_WEAR' },
  { id: 'r2', name: 'Afigan', price: 1642.86, image: 'https://picsum.photos/seed/kimi-ready-2/800/1000', designer: 'Asante Designs', country: 'Ghana', productType: 'READY_TO_WEAR' },
  { id: 'r3', name: 'Kakaki Africa', price: 1507.14, image: 'https://picsum.photos/seed/kimi-ready-3/800/1000', designer: 'Asante Designs', country: 'Ghana', productType: 'READY_TO_WEAR' },
];

const kimiFabrics: FeaturedProduct[] = [
  { id: 'f1', name: 'Ankara Mummy', price: 2142.86, image: 'https://picsum.photos/seed/kimi-fabric-1/800/1000', designer: 'Diallo Fabrics', country: 'Nigeria', productType: 'FABRIC' },
  { id: 'f2', name: 'Dancing Queen Adire', price: 785.71, image: 'https://picsum.photos/seed/kimi-fabric-2/800/1000', designer: 'Diallo Fabrics', country: 'Nigeria', productType: 'FABRIC' },
  { id: 'f3', name: 'Ankara Party', price: 928.57, image: 'https://picsum.photos/seed/kimi-fabric-3/800/1000', designer: 'Diallo Fabrics', country: 'Nigeria', productType: 'FABRIC' },
  { id: 'f4', name: 'Awon Da', price: 1428.57, image: 'https://picsum.photos/seed/kimi-fabric-4/800/1000', designer: 'Diallo Fabrics', country: 'Nigeria', productType: 'FABRIC' },
];

const kimiDesigners = [
  {
    id: '1',
    name: 'Asante Designs',
    country: 'Ghana',
    flag: '🇬🇭',
    quote: 'When we sew, it is from the heart. Every stitch tells a story.',
    image: 'https://picsum.photos/seed/kimi-designer-1/800/1000',
  },
  {
    id: '2',
    name: 'Ngozi Couture',
    country: 'Nigeria',
    flag: '🇳🇬',
    quote: 'Bringing the vibrant spirit of Africa to the world through fashion.',
    image: 'https://picsum.photos/seed/kimi-designer-2/800/1000',
  },
  {
    id: '3',
    name: 'Kente Masters',
    country: 'Ghana',
    flag: '🇬🇭',
    quote: 'Kente to the world. Preserving tradition while embracing modernity.',
    image: 'https://picsum.photos/seed/kimi-designer-3/800/1000',
  },
];

const kimiTestimonials = [
  {
    id: '1',
    name: 'Amara Johnson',
    location: 'New York, USA',
    avatar: 'https://picsum.photos/seed/kimi-testimonial-1/120/120',
    quote: 'The quality exceeded my expectations. My dress fits perfectly and the fabric is gorgeous.',
  },
  {
    id: '2',
    name: 'Kwame Asante',
    location: 'London, UK',
    avatar: 'https://picsum.photos/seed/kimi-testimonial-2/120/120',
    quote: 'Amazing experience from start to finish. The custom tailoring service is a game changer!',
  },
  {
    id: '3',
    name: 'Fatima Mohammed',
    location: 'Dubai, UAE',
    avatar: 'https://picsum.photos/seed/kimi-testimonial-3/120/120',
    quote: 'Supporting African designers while getting beautiful clothes—this platform is a gem.',
  },
];

const asText = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

const normalizeCategoryCtaText = (value: unknown) => {
  const text = asText(value, 'SHOP NOW');
  return text.replace(/\s*>\s*$/g, '').trim() || 'SHOP NOW';
};

const productBasePath = (productType: string) => {
  if (productType === 'DESIGN') return '/designs';
  if (productType === 'FABRIC') return '/fabrics';
  return '/ready-to-wear';
};

function ProductCard({ product }: { product: FeaturedProduct }) {
  return (
    <Link to={`${productBasePath(product.productType)}/${product.id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 mb-4 img-zoom">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        <button className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
          <Heart className="w-4 h-4" />
        </button>
        <div className="absolute top-3 left-3 bg-white/90 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
          <span>{product.flag || countryFlags[product.country] || '🌍'}</span>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-lg group-hover:text-gray-600 transition-colors">{product.name}</h3>
        <p className="text-gray-500 text-sm line-clamp-1">{product.designer}</p>
        <p className="font-semibold mt-1">${Number(product.price || 0).toFixed(2)}</p>
      </div>
    </Link>
  );
}

function ProductCarousel({
  title,
  subtitle,
  products,
  stripRef,
  onLeft,
  onRight,
  viewAllLink,
  loading,
}: {
  title: string;
  subtitle: string;
  products: FeaturedProduct[];
  stripRef: { current: HTMLDivElement | null };
  onLeft: () => void;
  onRight: () => void;
  viewAllLink: string;
  loading: boolean;
}) {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-10">
          <div>
            <p className="inline-flex mb-3 px-2 py-1 border border-black text-xs tracking-wider font-semibold">FEATURED</p>
            <h2 className="font-['Oswald'] text-3xl sm:text-4xl font-bold">{title}</h2>
            <p className="text-gray-600 mt-2">{subtitle}</p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <button onClick={onLeft} className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={onRight} className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
            <Link to={viewAllLink} className="hidden sm:flex items-center gap-1 text-sm font-medium">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div
            ref={stripRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 sm:-mx-0 sm:px-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {products.map((product) => (
              <div key={product.id} className="flex-shrink-0 w-72">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const customStripRef = useRef<HTMLDivElement>(null);
  const rtwStripRef = useRef<HTMLDivElement>(null);
  const fabricsStripRef = useRef<HTMLDivElement>(null);

  const { data: heroSlidesData } = useQuery({
    queryKey: ['heroSlides'],
    queryFn: async () => {
      const response = await api.homepage.getHeroSlides();
      return response.success ? response.data : null;
    },
  });

  const { data: featuredData, isLoading: featuredLoading } = useQuery({
    queryKey: ['featuredProducts'],
    enabled: USE_DYNAMIC_HOMEPAGE,
    queryFn: async () => {
      const response = await api.homepage.getAllFeatured();
      return response.success ? response.data : null;
    },
  });

  const { data: managedBannersData } = useQuery({
    queryKey: ['homepageManagedBanners'],
    queryFn: async () => {
      const response = await api.banners.getBanners();
      return response.success ? response.data : null;
    },
  });

  const { data: countriesData } = useQuery({
    queryKey: ['homepageCountries'],
    queryFn: async () => {
      const response = await api.homepageSections.getCountries();
      return response.success ? response.data : null;
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['homepageCategories'],
    queryFn: async () => {
      const response = await api.homepageSections.getCategories();
      return response.success ? response.data : null;
    },
  });

  const { data: howItWorksData } = useQuery({
    queryKey: ['homepageHowItWorks'],
    queryFn: async () => {
      const response = await api.homepageSections.getHowItWorks();
      return response.success ? response.data : null;
    },
  });

  const { data: designerSpotlightsData } = useQuery({
    queryKey: ['designerSpotlightsPublic'],
    enabled: USE_DYNAMIC_HOMEPAGE,
    queryFn: async () => {
      const response = await api.homepageSections.getDesignerSpotlights();
      return response.success ? response.data : null;
    },
  });

  const { data: heritageData } = useQuery({
    queryKey: ['heritagePublic'],
    enabled: USE_DYNAMIC_HOMEPAGE,
    queryFn: async () => {
      const response = await api.homepageSections.getHeritage();
      return response.success ? response.data : null;
    },
  });

  const { data: testimonialsData } = useQuery({
    queryKey: ['testimonialsPublic'],
    enabled: USE_DYNAMIC_HOMEPAGE,
    queryFn: async () => {
      const response = await api.homepageSections.getTestimonials();
      return response.success ? response.data : null;
    },
  });

  const { data: visibilityData } = useQuery({
    queryKey: ['homepageVisibility'],
    enabled: USE_DYNAMIC_HOMEPAGE,
    queryFn: async () => {
      const response = await api.homepageSections.getVisibility();
      return response.success ? response.data : null;
    },
  });

  const sectionVisibility = useMemo<HomepageVisibility>(() => {
    if (!USE_DYNAMIC_HOMEPAGE || !visibilityData) {
      return DEFAULT_HOMEPAGE_VISIBILITY;
    }
    return {
      ...DEFAULT_HOMEPAGE_VISIBILITY,
      ...visibilityData,
    };
  }, [visibilityData]);

  const heroSlides = useMemo(
    () => {
      const heroBanners =
        Array.isArray(managedBannersData)
          ? managedBannersData
              .filter((row: any) => String(row?.section || '').toUpperCase() === 'HERO')
              .map((row: any, index: number) => ({
                id: String(row?.id ?? `hero-banner-${index}`),
                image: asText(row?.displayImage, row?.images?.[0], kimiHeroSlides[index % kimiHeroSlides.length].image),
                title: asText(row?.title, kimiHeroSlides[index % kimiHeroSlides.length].title),
                subtitle: asText(row?.subtitle, kimiHeroSlides[index % kimiHeroSlides.length].subtitle),
                badge: kimiHeroSlides[index % kimiHeroSlides.length].badge,
                ctaText: asText(row?.ctaText, kimiHeroSlides[index % kimiHeroSlides.length].ctaText),
                ctaLink: asText(row?.ctaLink, kimiHeroSlides[index % kimiHeroSlides.length].ctaLink),
              }))
          : [];
      const source =
        heroBanners.length > 0
          ? heroBanners
          : Array.isArray(heroSlidesData) && heroSlidesData.length > 0
            ? heroSlidesData
            : kimiHeroSlides;
      return source.map((slide: any, index: number) => ({
        id: String(slide.id ?? index),
        image: asText(slide.image, kimiHeroSlides[index % kimiHeroSlides.length].image),
        title: asText(slide.title, kimiHeroSlides[index % kimiHeroSlides.length].title),
        subtitle: asText(slide.subtitle, kimiHeroSlides[index % kimiHeroSlides.length].subtitle),
        badge: asText(slide.badge, kimiHeroSlides[index % kimiHeroSlides.length].badge),
        ctaText: asText(slide.ctaText, kimiHeroSlides[index % kimiHeroSlides.length].ctaText),
        ctaLink: asText(slide.ctaLink, kimiHeroSlides[index % kimiHeroSlides.length].ctaLink),
      }));
    },
    [heroSlidesData, managedBannersData],
  );

  const featuredDesigns = ((USE_DYNAMIC_HOMEPAGE ? featuredData?.FEATURED_DESIGNS : null) || kimiFeaturedDesigns) as FeaturedProduct[];
  const featuredRTW = ((USE_DYNAMIC_HOMEPAGE ? featuredData?.FEATURED_READY_TO_WEAR : null) || kimiReadyToWear) as FeaturedProduct[];
  const featuredFabrics = ((USE_DYNAMIC_HOMEPAGE ? featuredData?.FEATURED_FABRICS : null) || kimiFabrics) as FeaturedProduct[];
  const managedBannersBySection = useMemo(() => {
    const map = new Map<string, ManagedBanner>();
    if (!USE_DYNAMIC_HOMEPAGE || !Array.isArray(managedBannersData)) return map;
    for (const row of managedBannersData) {
      const key = String(row?.section || '').toUpperCase();
      if (!key || map.has(key)) continue;
      map.set(key, row);
    }
    return map;
  }, [managedBannersData]);

  const countries = useMemo<CountryCard[]>(
    () =>
      (Array.isArray(countriesData) && countriesData.length > 0 ? countriesData : kimiCountries)
        .map((country: any) => ({
          name: asText(country.name, 'Country'),
          flag: asText(country.flag, countryFlags[country?.name], '🌍'),
          fabrics: asText(country.fabrics, 'African textiles'),
        })),
    [countriesData],
  );

  const categories = useMemo(
    () =>
      (Array.isArray(categoriesData) && categoriesData.length > 0 ? categoriesData : kimiCategories).slice(0, 3).map((item: any, index: number) => ({
        id: String(item.id ?? index),
        title: asText(item.title, kimiCategories[index % kimiCategories.length].title),
        description: asText(item.description, kimiCategories[index % kimiCategories.length].description),
        image: asText(item.image, kimiCategories[index % kimiCategories.length].image),
        link: asText(item.ctaLink, item.link, kimiCategories[index % kimiCategories.length].link),
        ctaText: normalizeCategoryCtaText(item.ctaText),
      })),
    [categoriesData],
  );

  const howItWorks = useMemo(
    () =>
      (Array.isArray(howItWorksData) && howItWorksData.length > 0 ? howItWorksData : kimiHowItWorks).slice(0, 6).map((item: any, index: number) => ({
        id: Number(item.id ?? index + 1),
        title: asText(item.title, kimiHowItWorks[index % kimiHowItWorks.length].title),
        subtitle: asText(item.subtitle, item.description, kimiHowItWorks[index % kimiHowItWorks.length].subtitle),
        icon:
          iconByName[asText(item.icon, '')] ||
          iconByNormalizedName[normalizeIconKey(item.icon)] ||
          kimiHowItWorks[index % kimiHowItWorks.length].icon,
      })),
    [howItWorksData],
  );
  const designers = useMemo(() => {
    if (!USE_DYNAMIC_HOMEPAGE) return kimiDesigners;
    if (Array.isArray(designerSpotlightsData) && designerSpotlightsData.length > 0) {
      return designerSpotlightsData.slice(0, 3).map((item: any, index: number) => ({
        id: String(item.id ?? index),
        name: asText(item.name, item.designer?.businessName, kimiDesigners[index % kimiDesigners.length].name),
        country: asText(item.country, item.designer?.country, kimiDesigners[index % kimiDesigners.length].country),
        flag: asText(item.flag, countryFlags[item?.country], '🌍'),
        quote: asText(item.quote, kimiDesigners[index % kimiDesigners.length].quote),
        image: asText(item.image, kimiDesigners[index % kimiDesigners.length].image),
      }));
    }
    return kimiDesigners;
  }, [designerSpotlightsData]);

  const testimonials = useMemo(
    () =>
      (USE_DYNAMIC_HOMEPAGE && Array.isArray(testimonialsData) && testimonialsData.length > 0 ? testimonialsData : kimiTestimonials).map((item: any, index: number) => ({
        id: String(item.id ?? index),
        name: asText(item.name, kimiTestimonials[index % kimiTestimonials.length].name),
        location: asText(item.location, kimiTestimonials[index % kimiTestimonials.length].location),
        avatar: asText(item.avatar, kimiTestimonials[index % kimiTestimonials.length].avatar),
        quote: asText(item.quote, item.text, kimiTestimonials[index % kimiTestimonials.length].quote),
      })),
    [testimonialsData],
  );

  const heritage = useMemo(
    () => ({
      title: asText(USE_DYNAMIC_HOMEPAGE ? heritageData?.title : null, 'Rooted in Culture'),
      content: asText(
        USE_DYNAMIC_HOMEPAGE ? heritageData?.subtitle : null,
        USE_DYNAMIC_HOMEPAGE ? heritageData?.description : null,
        "Every pattern carries meaning. From Kente's bold geometry to Ankara's vibrant motifs, African textiles tell stories of identity, celebration, and legacy passed through generations.",
      ),
      image: asText(USE_DYNAMIC_HOMEPAGE ? heritageData?.image : null, 'https://picsum.photos/seed/kimi-heritage/1920/1080'),
      ctaText: asText(USE_DYNAMIC_HOMEPAGE ? heritageData?.ctaText : null, 'READ OUR STORY'),
      ctaLink: asText(USE_DYNAMIC_HOMEPAGE ? heritageData?.ctaLink : null, '/about'),
    }),
    [heritageData],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const scrollStrip = (stripRef: { current: HTMLDivElement | null }, direction: 'left' | 'right') => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {sectionVisibility.hero ? (
      <section className="relative h-screen w-full overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
          </div>
        ))}

        <div className="relative h-full flex items-center">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="max-w-2xl">
              {heroSlides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`transition-all duration-700 ${
                    index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 absolute'
                  }`}
                >
                  {index === currentSlide && (
                    <>
                      <h1 className="font-['Oswald'] text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold text-white mb-6 leading-tight">
                        {slide.title}
                      </h1>
                      <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-lg">{slide.subtitle}</p>
                      <Link to={slide.ctaLink || '/ready-to-wear'} className="inline-flex items-center">
                        <span className="bg-white text-black hover:bg-white/90 btn-hover rounded-none px-8 py-6 text-sm font-semibold tracking-wider">
                          {(slide.ctaText || 'SHOP NOW').toUpperCase()}
                          <ArrowRight className="ml-2 w-4 h-4 inline" />
                        </span>
                      </Link>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {sectionVisibility.countries ? (
          <div className="absolute bottom-8 left-4 sm:left-6 lg:left-12 xl:left-20 right-4 sm:right-6 lg:right-12 xl:right-20">
            <div className="flex flex-wrap gap-4 justify-start">
              {countries.map((country) => (
                <Link
                  key={country.name}
                  to={`/designs?country=${encodeURIComponent(country.name)}`}
                  className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg flex items-center gap-3 card-hover cursor-pointer"
                >
                  <span className="text-2xl">{country.flag}</span>
                  <div>
                    <p className="font-semibold text-sm">{country.name}</p>
                    <p className="text-xs text-gray-500">{country.fabrics}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-8 right-4 sm:right-6 lg:right-12 xl:right-20 flex gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentSlide ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      </section>
      ) : null}

      {sectionVisibility.categories ? (
      <section className="py-20 lg:py-32 bg-white">
        <div className="w-full px-2 sm:px-4 lg:px-8 xl:px-12">
          <div className="text-center mb-16">
            <h2 className="font-['Oswald'] text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">Shop by Category</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Choose what fits your moment, ready pieces, custom fits, or raw fabrics.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            {categories.map((category) => (
              <Link key={category.id} to={category.link} className="group relative overflow-hidden rounded-xl cursor-pointer card-hover">
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={category.image} alt={category.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="font-['Oswald'] text-2xl font-bold mb-2">{category.title}</h3>
                  <p className="text-white/80 text-sm mb-4">{category.description}</p>
                  <span className="inline-flex items-center border border-white text-white rounded-none text-xs tracking-wider px-4 py-2 transition-colors duration-200 group-hover:bg-white group-hover:text-black">
                    {category.ctaText || 'SHOP NOW'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.howItWorks ? (
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {howItWorks.map((step, index) => (
              <div key={step.id} className="group flex flex-col items-center text-center relative">
                <div className="relative w-20 h-20 bg-white rounded-full border border-gray-200 flex items-center justify-center card-hover group-hover:bg-black group-hover:border-black transition-all duration-300 mb-4">
                  <step.icon className="w-8 h-8 text-black/80 group-hover:text-white transition-colors duration-300" />
                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1 text-xs text-gray-500 max-w-[180px]">{step.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.featuredCustomToWear ? (
        <ProductCarousel
          title="Custom To Wear"
          subtitle="Made To Fit by an African with Love"
          products={featuredDesigns}
          stripRef={customStripRef}
          onLeft={() => scrollStrip(customStripRef, 'left')}
          onRight={() => scrollStrip(customStripRef, 'right')}
          viewAllLink="/designs"
          loading={featuredLoading}
        />
      ) : null}

      {USE_DYNAMIC_HOMEPAGE && managedBannersBySection.get('BANNER_1') ? (
        <section className="py-12 bg-white">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="relative overflow-hidden rounded-xl">
              <img
                src={asText(managedBannersBySection.get('BANNER_1')?.displayImage, managedBannersBySection.get('BANNER_1')?.images?.[0], 'https://picsum.photos/seed/banner-1/1600/700')}
                alt={asText(managedBannersBySection.get('BANNER_1')?.title, 'Homepage Banner')}
                className="h-[340px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/45" />
              <div className="absolute inset-0 flex flex-col items-start justify-center p-8 text-white lg:p-12">
                <h3 className="font-['Oswald'] text-3xl font-bold lg:text-4xl">
                  {asText(managedBannersBySection.get('BANNER_1')?.title, 'Discover New African Fashion')}
                </h3>
                <p className="mt-2 max-w-xl text-white/85">
                  {asText(managedBannersBySection.get('BANNER_1')?.subtitle, 'Curated looks and handcrafted pieces from across the continent.')}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sectionVisibility.featuredReadyToWear ? (
        <ProductCarousel
          title="Ready To Wear"
          subtitle="Made To Standard sizes for all"
          products={featuredRTW}
          stripRef={rtwStripRef}
          onLeft={() => scrollStrip(rtwStripRef, 'left')}
          onRight={() => scrollStrip(rtwStripRef, 'right')}
          viewAllLink="/ready-to-wear"
          loading={featuredLoading}
        />
      ) : null}

      {USE_DYNAMIC_HOMEPAGE && managedBannersBySection.get('BANNER_2') ? (
        <section className="py-12 bg-white">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="relative overflow-hidden rounded-xl">
              <img
                src={asText(managedBannersBySection.get('BANNER_2')?.displayImage, managedBannersBySection.get('BANNER_2')?.images?.[0], 'https://picsum.photos/seed/banner-2/1600/700')}
                alt={asText(managedBannersBySection.get('BANNER_2')?.title, 'Homepage Banner')}
                className="h-[340px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/45" />
              <div className="absolute inset-0 flex flex-col items-start justify-center p-8 text-white lg:p-12">
                <h3 className="font-['Oswald'] text-3xl font-bold lg:text-4xl">
                  {asText(managedBannersBySection.get('BANNER_2')?.title, 'Fresh Collections')}
                </h3>
                <p className="mt-2 max-w-xl text-white/85">
                  {asText(managedBannersBySection.get('BANNER_2')?.subtitle, 'Limited releases and standout pieces from trusted African vendors.')}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sectionVisibility.featuredFabrics ? (
        <ProductCarousel
          title="Fabrics To Buy"
          subtitle="Fabrics from all across the edges of Africa"
          products={featuredFabrics}
          stripRef={fabricsStripRef}
          onLeft={() => scrollStrip(fabricsStripRef, 'left')}
          onRight={() => scrollStrip(fabricsStripRef, 'right')}
          viewAllLink="/fabrics"
          loading={featuredLoading}
        />
      ) : null}

      {sectionVisibility.promoBanner ? (
      <section className="py-20 lg:py-32 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="mb-4 rounded-none border-black text-xs tracking-wider inline-flex border px-2.5 py-0.5 font-medium">
                FRESH DROPS
              </span>
              <h2 className="font-['Oswald'] text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                {asText(
                  managedBannersBySection.get('PROMO')?.title,
                  managedBannersBySection.get('HERO')?.title,
                  'New arrivals from the most talented designers across the continent.'
                )}
              </h2>
              <Link
                to={asText(
                  managedBannersBySection.get('PROMO')?.ctaLink,
                  managedBannersBySection.get('HERO')?.ctaLink,
                  '/ready-to-wear'
                )}
                className="inline-flex items-center"
              >
                <span className="bg-black text-white hover:bg-black/90 btn-hover rounded-none px-8 py-6 text-sm font-semibold tracking-wider">
                  {asText(
                    managedBannersBySection.get('PROMO')?.ctaText,
                    managedBannersBySection.get('HERO')?.ctaText,
                    'SHOP NEW ARRIVALS'
                  )}{' '}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </span>
              </Link>
            </div>
            <div>
              <div className="relative">
                <img
                  src={asText(
                    managedBannersBySection.get('PROMO')?.displayImage,
                    managedBannersBySection.get('PROMO')?.images?.[0],
                    managedBannersBySection.get('HERO')?.displayImage,
                    managedBannersBySection.get('HERO')?.images?.[0],
                    'https://picsum.photos/seed/kimi-fresh-drops/1200/1600'
                  )}
                  alt="Fresh Drops"
                  className="w-full aspect-[3/4] object-cover rounded-xl"
                />
                <div className="absolute -bottom-6 -left-6 bg-black text-white p-6 rounded-xl">
                  <p className="font-['Oswald'] text-3xl font-bold">50+</p>
                  <p className="text-sm text-white/70">New Arrivals</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.designerSpotlight ? (
      <section className="py-20 lg:py-32 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="text-center mb-16">
            <span className="mb-4 rounded-none border-black text-xs tracking-wider inline-flex border px-2.5 py-0.5 font-medium">
              DESIGNER SPOTLIGHT
            </span>
            <h2 className="font-['Oswald'] text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">Meet Designers Across Africa</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Showcasing rotating talent from different countries.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {designers.map((designer) => (
              <div key={designer.id} className="group relative overflow-hidden rounded-xl">
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={designer.image} alt={designer.name} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 grayscale group-hover:grayscale-0" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{designer.flag}</span>
                    <span className="text-white/70 text-sm">{designer.country}</span>
                  </div>
                  <h3 className="font-['Oswald'] text-2xl font-bold text-white mb-2">{designer.name}</h3>
                  <p className="text-white/80 text-sm italic">&ldquo;{designer.quote}&rdquo;</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to="/designs" className="inline-flex items-center px-8 py-3" style={{ border: '1px solid currentColor' }}>
              <span className="rounded-none border-black text-sm tracking-wider hover:bg-black hover:text-white">
                MEET ALL DESIGNERS <ArrowRight className="ml-2 w-4 h-4 inline" />
              </span>
            </Link>
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.heritage ? (
      <section
        className="relative py-32 lg:py-48 bg-fixed bg-cover bg-center"
        style={{ backgroundImage: `url(${heritage.image})` }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="max-w-2xl mx-auto text-center">
            <span className="mb-4 rounded-none border-white text-white text-xs tracking-wider inline-flex border px-2.5 py-0.5 font-medium">
              HERITAGE STORY
            </span>
            <h2 className="font-['Oswald'] text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">{heritage.title}</h2>
            <p className="text-white/80 text-lg leading-relaxed mb-8">{heritage.content}</p>
            <Link to={heritage.ctaLink} className="inline-flex items-center px-8 py-3" style={{ border: '1px solid currentColor' }}>
              <span className="rounded-none border-white text-white hover:bg-white hover:text-black text-sm tracking-wider">
                {heritage.ctaText} <ArrowRight className="ml-2 w-4 h-4 inline" />
              </span>
            </Link>
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.testimonials ? (
      <section className="py-20 lg:py-32 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="text-center mb-16">
            <h2 className="font-['Oswald'] text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">What Our Customers Say</h2>
            <p className="text-gray-600">Join thousands of happy customers worldwide.</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {testimonials.map((testimonial, index) => (
                <div
                  key={testimonial.id}
                  className={`transition-all duration-500 ${
                    index === activeTestimonial ? 'opacity-100 translate-x-0' : 'opacity-0 absolute inset-0 translate-x-8'
                  }`}
                >
                  {index === activeTestimonial && (
                    <div className="text-center">
                      <div className="flex justify-center gap-1 mb-6">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <blockquote className="text-2xl sm:text-3xl lg:text-4xl font-light italic text-gray-800 mb-8 leading-relaxed">
                        &ldquo;{testimonial.quote}&rdquo;
                      </blockquote>
                      <div className="flex items-center justify-center gap-4">
                        <img src={testimonial.avatar} alt={testimonial.name} className="w-14 h-14 rounded-full object-cover" />
                        <div className="text-left">
                          <p className="font-semibold">{testimonial.name}</p>
                          <p className="text-gray-500 text-sm">{testimonial.location}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-2 mt-10">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === activeTestimonial ? 'bg-black w-8' : 'bg-black/20 hover:bg-black/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.cta ? (
      <section className="py-20 lg:py-32 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-['Oswald'] text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">Ready to Wear African Fashion?</h2>
            <p className="text-gray-600 text-lg mb-10">
              Join our community of fashion lovers and discover unique pieces from talented African designers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/ready-to-wear" className="inline-flex items-center justify-center">
                <span className="bg-black text-white hover:bg-black/90 btn-hover rounded-none px-8 py-6 text-sm font-semibold tracking-wider">
                  SHOP NOW
                </span>
              </Link>
              <Link to="/register" className="inline-flex items-center justify-center px-8 py-6" style={{ border: '1px solid currentColor' }}>
                <span className="border-black rounded-none px-8 py-6 text-sm font-semibold tracking-wider hover:bg-black hover:text-white">
                  CREATE ACCOUNT
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.cta ? (
      <section className="py-16 lg:py-24 bg-white border-t border-gray-100">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-['Oswald'] text-2xl sm:text-3xl font-bold mb-3">Join the Movement</h2>
            <p className="text-gray-600 mb-6">
              Subscribe to our newsletter for exclusive offers, new arrivals, and stories from the continent.
            </p>
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={(event) => event.preventDefault()}>
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 rounded-none border-black/20 focus:border-black h-12"
              />
              <button type="submit" className="bg-black text-white hover:bg-black/90 rounded-none h-12 px-8">
                SUBSCRIBE
              </button>
            </form>
          </div>
        </div>
      </section>
      ) : null}
    </div>
  );
}
