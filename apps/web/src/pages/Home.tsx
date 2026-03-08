import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Star, Heart, Loader2, MousePointer2, Box, CreditCard, CheckCircle, Truck } from 'lucide-react';
import { api } from '../services/api';
import { useQuery } from '@tanstack/react-query';

// Default countries as fallback
const defaultCountries = [
  { name: 'Ghana', flag: '🇬🇭', image: '/images/ghana-abstract.jpg', fabrics: 'Kente • Adinkra • Batik' },
  { name: 'Nigeria', flag: '🇳🇬', image: '/images/nigeria-abstract.jpg', fabrics: 'Ankara • Aso Oke • Adire' },
  { name: 'Kenya', flag: '🇰🇪', image: '/images/kenya-abstract.jpg', fabrics: 'Kitenge • Kikoy • Shuka' },
  { name: 'Senegal', flag: '🇸🇳', image: '/images/senegal-abstract.jpg', fabrics: 'Bazin • Mud Cloth • Wax Print' },
  { name: 'South Africa', flag: '🇿🇦', image: '/images/south-africa-abstract.jpg', fabrics: 'Shweshwe • Ndebele • Zulu' },
  { name: 'Tanzania', flag: '🇹🇿', image: '/images/tanzania-abstract.jpg', fabrics: 'Kanga • Kitenge • Tie Dye' },
  { name: 'Ethiopia', flag: '🇪🇹', image: '/images/ethiopia-abstract.jpg', fabrics: 'Tibeb • Netela • Cotton' },
  { name: 'Morocco', flag: '🇲🇦', image: '/images/morocco-abstract.jpg', fabrics: 'Caftan • Djellaba • Silk' },
];

// How It Works steps
const howItWorksSteps = [
  { icon: MousePointer2, title: 'SELECT YOUR', subtitle: 'DESIGN' },
  { icon: Box, title: '3D-TRYON', subtitle: 'VIRTUALLY' },
  { icon: Heart, title: 'CHOOSE YOUR', subtitle: 'FABRIC' },
  { icon: CreditCard, title: 'PAY', subtitle: 'SECURELY' },
  { icon: CheckCircle, title: 'QUALITY', subtitle: 'CHECK' },
  { icon: Truck, title: 'FAST', subtitle: 'DELIVERY' },
];

// Shop by Category
const shopCategories = [
  {
    title: 'Ready To Wear',
    description: 'Stunning dresses, elegant sets, and chic separates — expertly crafted for immediate style.',
    image: '/images/category-ready-to-wear.jpg',
    link: '/ready-to-wear',
  },
  {
    title: 'Custom To Wear',
    description: 'Bespoke pieces tailored to your exact measurements — made just for you in 10-14 days.',
    image: '/images/category-custom.jpg',
    link: '/designs',
  },
  {
    title: 'Fabrics To Buy',
    description: 'Premium African textiles by the yard — Kente, Ankara, Kitenge and more direct from artisans.',
    image: '/images/category-fabrics.jpg',
    link: '/fabrics',
  },
];

// Default testimonials as fallback
const defaultTestimonials = [
  {
    id: '1',
    name: 'Amara Johnson',
    location: 'New York, USA',
    avatar: '/images/avatar-1.jpg',
    rating: 5,
    text: 'The quality exceeded my expectations. My dress fits perfectly and the fabric is gorgeous.',
  },
  {
    id: '2',
    name: 'Kwame Asante',
    location: 'London, UK',
    avatar: '/images/avatar-2.jpg',
    rating: 5,
    text: 'Amazing experience from start to finish. The custom tailoring service is a game changer!',
  },
  {
    id: '3',
    name: 'Fatima Mohammed',
    location: 'Dubai, UAE',
    avatar: '/images/avatar-3.jpg',
    rating: 5,
    text: 'Supporting African designers while getting beautiful clothes—this platform is a gem.',
  },
];

// Designer Spotlight
const designerSpotlight = {
  name: 'Amara Okafor',
  quote: 'I design for the woman who wants to feel rooted and free at the same time. Every piece tells a story of heritage and modernity.',
  description: 'Amara blends traditional African prints with modern silhouettes.',
  image: '/images/designer-spotlight.jpg',
};

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

// Default hero slides as fallback
const defaultHeroSlides: HeroSlide[] = [
  {
    id: '1',
    image: '/images/hero-1.jpg',
    badge: 'NEW COLLECTION',
    title: 'Ready To Wear',
    subtitle: 'Dresses, sets, and separates — tailored fits finished by hand',
    ctaText: 'Shop Now',
    ctaLink: '/ready-to-wear',
  },
  {
    id: '2',
    image: '/images/hero-2.jpg',
    badge: 'FRESH DROPS',
    title: 'New Arrivals',
    subtitle: 'New arrivals from the most talented designers across the continent',
    ctaText: 'Explore',
    ctaLink: '/designs',
  },
  {
    id: '3',
    image: '/images/hero-3.jpg',
    badge: 'TRENDING NOW',
    title: 'Trending Styles',
    subtitle: 'The pieces everyone is talking about this season',
    ctaText: 'View Trending',
    ctaLink: '/ready-to-wear',
  },
];

// Default featured products as fallback
const defaultFeaturedDesigns: FeaturedProduct[] = [
  { id: '1', name: 'Royal Kente Gown', description: '', price: 299, image: '/images/design-1.jpg', designer: 'Amara Designs', country: 'Ghana', productType: 'DESIGN', badge: 'NEW' },
  { id: '2', name: 'Ankara Maxi Dress', description: '', price: 189, image: '/images/design-2.jpg', designer: 'Lagos Luxe', country: 'Nigeria', productType: 'DESIGN', badge: 'SALE' },
  { id: '3', name: 'Kitenge Two-Piece', description: '', price: 159, image: '/images/design-3.jpg', designer: 'Nairobi Styles', country: 'Kenya', productType: 'DESIGN', badge: 'PROMO' },
];

const defaultReadyToWear: FeaturedProduct[] = [
  { id: 'r1', name: 'Kente Midi Dress', description: '', price: 189, image: '/images/rtw-1.jpg', designer: 'Ghana • Ships in 3-5 days', country: 'Ghana', productType: 'READY_TO_WEAR', badge: 'BEST SELLER' },
  { id: 'r2', name: 'Ankara Two-Piece Set', description: '', price: 145, image: '/images/rtw-2.jpg', designer: 'Nigeria • Ships in 2-4 days', country: 'Nigeria', productType: 'READY_TO_WEAR', badge: 'SALE' },
  { id: 'r3', name: 'Batik Shift Dress', description: '', price: 120, image: '/images/rtw-3.jpg', designer: 'Senegal • Ships in 3-5 days', country: 'Senegal', productType: 'READY_TO_WEAR', badge: 'PROMO' },
  { id: 'r4', name: 'Wax Print Midi', description: '', price: 135, image: '/images/rtw-4.jpg', designer: 'Kenya • Ships in 2-4 days', country: 'Kenya', productType: 'READY_TO_WEAR', badge: 'NEW' },
];

const defaultFabrics: FeaturedProduct[] = [
  { id: 'f1', name: 'Premium Kente Cloth', description: '', price: 45, image: '/images/fabric-1.jpg', designer: 'Ghana Textiles', country: 'Ghana', productType: 'FABRIC', badge: 'SALE' },
  { id: 'f2', name: 'Luxury Ankara Print', description: '', price: 35, image: '/images/fabric-2.jpg', designer: 'Nigerian Fabrics', country: 'Nigeria', productType: 'FABRIC', badge: 'PROMO' },
  { id: 'f3', name: 'Authentic Mud Cloth', description: '', price: 55, image: '/images/fabric-3.jpg', designer: 'Mali Traditions', country: 'Mali', productType: 'FABRIC', badge: 'NEW' },
  { id: 'f4', name: 'Kitenge Wax Print', description: '', price: 30, image: '/images/fabric-4.jpg', designer: 'Kenya Fabrics', country: 'Kenya', productType: 'FABRIC', badge: 'SALE' },
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

export default function Home() {
  // Fetch hero slides
  const { data: heroSlidesData, isLoading: heroLoading } = useQuery({
    queryKey: ['heroSlides'],
    queryFn: async () => {
      const response = await api.homepage.getHeroSlides();
      return response.success ? response.data : defaultHeroSlides;
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

  const heroSlides = heroSlidesData || defaultHeroSlides;
  const featuredDesigns = featuredData?.FEATURED_DESIGNS || defaultFeaturedDesigns;
  const featuredFabrics = featuredData?.FEATURED_FABRICS || defaultFabrics;
  const featuredRTW = featuredData?.FEATURED_READY_TO_WEAR || defaultReadyToWear;

  // Fetch countries dynamically
  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const response = await api.homepageSections.getCountries();
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

  // Use dynamic data or fallback to defaults
  const countries = countriesData?.length > 0 
    ? countriesData.map((c: any) => ({ 
        name: c.name, 
        flag: c.flag, 
        image: c.image, 
        fabrics: c.fabrics 
      })) 
    : defaultCountries;
    
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

  // Hero carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const customStripRef = useRef<HTMLDivElement | null>(null);
  const rtwStripRef = useRef<HTMLDivElement | null>(null);
  const fabricStripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  const scrollStrip = (stripRef: { current: HTMLDivElement | null }, direction: 'left' | 'right') => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  };

  // Product card component
  const ProductCard = ({ product }: { product: FeaturedProduct }) => (
    <Link
      to={`/${product.productType === 'DESIGN' ? 'designs' : product.productType === 'FABRIC' ? 'fabrics' : 'ready-to-wear'}/${product.id}`}
      className="group block"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 mb-4 img-zoom">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 bg-white/90 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
          <span>{countryFlags[product.country] || '🌍'}</span>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">{product.name}</h3>
        <p className="text-sm text-gray-500 mt-1">{product.designer}</p>
        <p className="font-semibold mt-1 text-gray-900">${Number(product.price || 0).toFixed(2)}</p>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Hero Carousel */}
      <section className="relative h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden">
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
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.4), transparent)' }} />
            </div>
            <div className="relative h-full flex items-center">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-xl text-white">
                  <span className="inline-block px-3 py-1 bg-coral-500 text-white text-xs font-semibold tracking-wider mb-4">
                    {slide.badge}
                  </span>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-4 leading-tight">
                    {slide.title}
                  </h1>
                  <p className="text-lg md:text-xl text-white text-opacity-90 mb-8">
                    {slide.subtitle}
                  </p>
                  <Link
                    to={slide.ctaLink}
                    className="inline-flex items-center gap-2 bg-white text-navy-600 px-8 py-4 rounded font-semibold transition-all hover:bg-gray-100"
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
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white bg-opacity-20 hover:bg-white bg-opacity-30 backdrop-blur-sm rounded text-white transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white bg-opacity-20 hover:bg-white bg-opacity-30 backdrop-blur-sm rounded text-white transition-all"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
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

      {/* Countries Marquee */}
      <section className="py-8 bg-[#F5F5F0] overflow-hidden">
        <div className="flex animate-marquee">
          {[...countries, ...countries].map((country, index) => (
            <Link
              key={`${country.name}-${index}`}
              to={`/designs?country=${country.name}`}
              className="group relative flex-shrink-0 w-64 h-40 mx-2 overflow-hidden"
            >
              <img
                src={country.image}
                alt={country.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent)' }} />
              <div className="absolute bottom-3 left-3 text-white">
                <span className="text-xl">{country.flag}</span>
                <h3 className="font-semibold text-sm mt-1">{country.name}</h3>
                <p className="text-xs text-white text-opacity-70">{country.fabrics}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-[#F5F5F0]">
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">How It Works</h2>
            <p className="text-gray-500">Your journey to African fashion in 6 simple steps</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8">
            {howItWorksSteps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-coral-500 rounded flex items-center justify-center mb-2">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-gray-900 text-center">{step.title}</p>
                  <p className="text-xs font-semibold text-gray-900 text-center">{step.subtitle}</p>
                </div>
                {index < howItWorksSteps.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-coral-500 mx-2 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section className="py-16 bg-[#F5F5F0]">
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Shop by Category</h2>
            <p className="text-gray-500">Choose what fits your moment—ready pieces, custom fits, or raw fabrics.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {shopCategories.map((category, index) => (
              <Link
                key={index}
                to={category.link}
                className="group relative h-[400px] md:h-[500px] overflow-hidden"
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
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    Shop Now <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Now Banner */}
      <section className="py-16 bg-[#F5F5F0]">
        <div className="relative h-[300px] md:h-[350px] overflow-hidden">
          <img
            src="/images/trending-banner.jpg"
            alt="Trending Now"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-navy-600 bg-opacity-80" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-2">Trending Now</h2>
            <p className="text-white text-opacity-80 mb-6">The prints everyone is talking about this season.</p>
            <div className="flex gap-4">
              <Link
                to="/ready-to-wear"
                className="inline-flex items-center gap-2 bg-coral-500 hover:bg-coral-600 text-white px-6 py-3 rounded font-semibold transition-colors"
              >
                Shop New Arrivals
              </Link>
              <Link
                to="/designs"
                className="inline-flex items-center gap-2 bg-transparent border-2 border-white text-white px-6 py-3 rounded font-semibold hover:bg-white hover:bg-opacity-10 transition-colors"
              >
                Explore Collections
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Custom To Wear */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-10">
            <div>
              <p className="inline-flex mb-3 px-2 py-1 border border-black text-xs tracking-wider font-semibold">FEATURED</p>
              <h2 className="font-['Oswald'] text-3xl sm:text-4xl font-bold text-gray-900">Custom To Wear</h2>
              <p className="text-gray-600 mt-2">Made To Fit by an African with Love</p>
            </div>
            <div className="flex gap-2 mt-4 sm:mt-0">
              <button
                type="button"
                onClick={() => scrollStrip(customStripRef, 'left')}
                className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollStrip(customStripRef, 'right')}
                className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <Link to="/designs" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium ml-2">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {featuredLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
            </div>
          ) : (
            <div
              ref={customStripRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 sm:-mx-0 sm:px-0"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {featuredDesigns.map((product) => (
                <div key={product.id} className="flex-shrink-0 w-72">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Ready To Wear */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-10">
            <div>
              <p className="inline-flex mb-3 px-2 py-1 border border-black text-xs tracking-wider font-semibold">FEATURED</p>
              <h2 className="font-['Oswald'] text-3xl sm:text-4xl font-bold text-gray-900">Ready To Wear</h2>
              <p className="text-gray-600 mt-2">Made To Standard sizes for all</p>
            </div>
            <div className="flex gap-2 mt-4 sm:mt-0">
              <button
                type="button"
                onClick={() => scrollStrip(rtwStripRef, 'left')}
                className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollStrip(rtwStripRef, 'right')}
                className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <Link to="/ready-to-wear" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium ml-2">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {featuredLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
            </div>
          ) : (
            <div
              ref={rtwStripRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 sm:-mx-0 sm:px-0"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {featuredRTW.map((product) => (
                <div key={product.id} className="flex-shrink-0 w-72">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Fabrics */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-10">
            <div>
              <p className="inline-flex mb-3 px-2 py-1 border border-black text-xs tracking-wider font-semibold">FEATURED</p>
              <h2 className="font-['Oswald'] text-3xl sm:text-4xl font-bold text-gray-900">Fabrics To Buy</h2>
              <p className="text-gray-600 mt-2">Fabrics from all across the edges of Africa</p>
            </div>
            <div className="flex gap-2 mt-4 sm:mt-0">
              <button
                type="button"
                onClick={() => scrollStrip(fabricStripRef, 'left')}
                className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollStrip(fabricStripRef, 'right')}
                className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <Link to="/fabrics" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium ml-2">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {featuredLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
            </div>
          ) : (
            <div
              ref={fabricStripRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 sm:-mx-0 sm:px-0"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {featuredFabrics.map((product) => (
                <div key={product.id} className="flex-shrink-0 w-72">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Fresh Drops Banner */}
      <section className="py-16 lg:py-20 bg-[#F2F2F2]">
        <div className="w-full px-0 sm:px-0 lg:px-0 xl:px-0">
          <div className="relative grid grid-cols-1 md:grid-cols-2">
            <div className="px-6 sm:px-8 lg:px-12 xl:px-16 py-10 md:py-16 flex items-center bg-[#F2F2F2]">
              <div className="max-w-xl">
                <p className="inline-flex mb-5 px-2 py-0.5 border border-black text-[11px] tracking-wide font-semibold">
                  FRESH DROPS
                </p>
                <h2 className="font-['Oswald'] text-5xl lg:text-6xl leading-[0.95] font-bold text-black mb-8">
                  New arrivals from the most talented designers across the continent.
                </h2>
                <Link
                  to="/ready-to-wear"
                  className="inline-flex items-center gap-3 bg-black text-white px-6 py-3 text-xs font-semibold tracking-wider hover:bg-black/90 transition-colors"
                >
                  SHOP NEW ARRIVALS <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="relative min-h-[420px] md:min-h-[640px] bg-gray-200">
              <img
                src="/images/fresh-drops-banner.jpg"
                alt="Fresh Drops"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-7 bg-black text-white px-6 py-3 text-center">
              <p className="font-['Oswald'] text-4xl font-bold leading-none">50+</p>
              <p className="text-xs text-white/70 mt-1">New Arrivals</p>
            </div>
          </div>
        </div>
      </section>

      {/* Designer Spotlight & Heritage */}
      <section className="py-16 bg-[#F5F5F0]">
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Designer Spotlight */}
            <div className="bg-white overflow-hidden">
              <div className="h-[250px] overflow-hidden">
                <img
                  src={designerSpotlight.image}
                  alt={designerSpotlight.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <p className="text-coral-500 text-sm font-semibold mb-2">DESIGNER SPOTLIGHT</p>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Meet {designerSpotlight.name}</h3>
                <p className="text-gray-600 mb-4">"{designerSpotlight.quote}" {designerSpotlight.description}</p>
                <Link
                  to="/designers"
                  className="inline-flex items-center gap-2 bg-coral-500 hover:bg-coral-600 text-white px-6 py-3 rounded font-semibold transition-colors"
                >
                  Meet All Designers
                </Link>
              </div>
            </div>

            {/* Heritage */}
            <div className="bg-navy-600 overflow-hidden">
              <div className="h-[250px] overflow-hidden">
                <img
                  src="/images/heritage.jpg"
                  alt="Heritage"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <p className="text-coral-500 text-sm font-semibold mb-2">HERITAGE</p>
                <h3 className="text-2xl font-bold text-white mb-3">Rooted in Culture</h3>
                <p className="text-white text-opacity-80 mb-4">
                  Every pattern carries meaning. From Kente's bold geometry to Ankara's intricate motifs, 
                  African textiles tell stories of history, identity, and tradition passed through generations.
                </p>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 bg-coral-500 hover:bg-coral-600 text-white px-6 py-3 rounded font-semibold transition-colors"
                >
                  Read Our Story
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-navy-600">
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">What Our Customers Say</h2>
            <p className="text-white text-opacity-70">Join thousands of happy customers worldwide.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-white bg-opacity-10 backdrop-blur-sm p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-coral-500 text-coral-500" />
                  ))}
                </div>
                <p className="text-white text-opacity-90 mb-6">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-coral-500 rounded flex items-center justify-center text-white font-semibold">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{testimonial.name}</p>
                    <p className="text-sm text-white text-opacity-60">{testimonial.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-['Oswald'] text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Ready to Wear African Fashion?
            </h2>
            <p className="text-gray-600 text-lg mb-10">
              Join our community of fashion lovers and discover unique pieces from talented African designers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/ready-to-wear"
                className="inline-flex items-center justify-center bg-black text-white hover:bg-black/90 btn-hover rounded-none px-8 py-6 text-sm font-semibold tracking-wider"
              >
                Shop Now
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center border border-black rounded-none px-8 py-6 text-sm font-semibold tracking-wider hover:bg-black hover:text-white transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 lg:py-24 bg-white border-t border-gray-100">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-['Oswald'] text-2xl sm:text-3xl font-bold mb-3">Join the Movement</h2>
            <p className="text-gray-600 mb-6">
              Subscribe to our newsletter for exclusive offers, new arrivals, and stories from the continent.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 rounded-none border border-black/20 focus:border-black h-12 px-4 text-gray-900 placeholder:text-gray-500 focus:outline-none"
              />
              <button className="bg-black text-white hover:bg-black/90 rounded-none h-12 px-8 transition-colors">
                SUBSCRIBE
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
