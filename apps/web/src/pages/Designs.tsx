// Cache bust: v9103
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, ChevronDown, Loader2, SlidersHorizontal, Grid3X3, List, X, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { useCurrencyStore } from '../store/currencyStore';
import { resolveCountryCode } from '../data/locationOptions';

interface Design {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  finalPrice: number;
  images: { url: string }[];
  designer: {
    id: string;
    businessName: string;
    country: string;
    rating: number;
  };
  category: {
    id: string;
    name: string;
  };
  rating: number;
  reviewCount: number;
  orderCount: number;
  flag: string;
}

interface Category {
  id: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Sample designs for demonstration
const sampleDesigns: Design[] = [
  {
    id: '1',
    name: 'Royal Kente Gown',
    description: 'Elegant traditional Kente gown with gold embroidery',
    basePrice: 350,
    finalPrice: 420,
    images: [{ url: '/images/designs/kente-gown.jpg' }],
    designer: { id: 'd1', businessName: 'Amma Designs', country: 'Ghana', rating: 4.8 },
    category: { id: 'c1', name: 'Traditional Wear' },
    rating: 4.9,
    reviewCount: 128,
    orderCount: 245,
    flag: '🇬🇭',
  },
  {
    id: '2',
    name: 'Ankara Maxi Dress',
    description: 'Vibrant Ankara print maxi dress with modern cut',
    basePrice: 180,
    finalPrice: 220,
    images: [{ url: '/images/designs/ankara-maxi.jpg' }],
    designer: { id: 'd2', businessName: 'Lagos Fashion House', country: 'Nigeria', rating: 4.6 },
    category: { id: 'c2', name: 'Dresses' },
    rating: 4.7,
    reviewCount: 89,
    orderCount: 156,
    flag: '🇳🇬',
  },
  {
    id: '3',
    name: 'Dashiki Shirt Set',
    description: 'Classic Dashiki shirt with matching pants',
    basePrice: 120,
    finalPrice: 150,
    images: [{ url: '/images/designs/dashiki-set.jpg' }],
    designer: { id: 'd3', businessName: 'Mali Heritage', country: 'Mali', rating: 4.5 },
    category: { id: 'c3', name: 'Men\'s Wear' },
    rating: 4.6,
    reviewCount: 67,
    orderCount: 98,
    flag: '🇲🇱',
  },
  {
    id: '4',
    name: 'Boubou Evening Wear',
    description: 'Flowing Boubou with intricate beadwork',
    basePrice: 280,
    finalPrice: 340,
    images: [{ url: '/images/designs/boubou-evening.jpg' }],
    designer: { id: 'd4', businessName: 'Senegal Elegance', country: 'Senegal', rating: 4.9 },
    category: { id: 'c1', name: 'Traditional Wear' },
    rating: 4.8,
    reviewCount: 156,
    orderCount: 312,
    flag: '🇸🇳',
  },
  {
    id: '5',
    name: 'Kitenge Wrap Dress',
    description: 'Versatile wrap dress in colorful Kitenge print',
    basePrice: 95,
    finalPrice: 120,
    images: [{ url: '/images/designs/kitenge-wrap.jpg' }],
    designer: { id: 'd5', businessName: 'Tanzania Threads', country: 'Tanzania', rating: 4.4 },
    category: { id: 'c2', name: 'Dresses' },
    rating: 4.5,
    reviewCount: 45,
    orderCount: 78,
    flag: '🇹🇿',
  },
  {
    id: '6',
    name: 'Aso Oke Bridal Gown',
    description: 'Stunning bridal gown in traditional Aso Oke fabric',
    basePrice: 850,
    finalPrice: 980,
    images: [{ url: '/images/designs/asooke-bridal.jpg' }],
    designer: { id: 'd6', businessName: 'Yoruba Royalty', country: 'Nigeria', rating: 5.0 },
    category: { id: 'c4', name: 'Bridal' },
    rating: 5.0,
    reviewCount: 34,
    orderCount: 56,
    flag: '🇳🇬',
  },
  {
    id: '7',
    name: 'Shweshwe Skirt Set',
    description: 'Traditional Shweshwe print skirt and top',
    basePrice: 145,
    finalPrice: 175,
    images: [{ url: '/images/designs/shweshwe-set.jpg' }],
    designer: { id: 'd7', businessName: 'Cape Creations', country: 'South Africa', rating: 4.7 },
    category: { id: 'c5', name: 'Skirts' },
    rating: 4.6,
    reviewCount: 78,
    orderCount: 134,
    flag: '🇿🇦',
  },
  {
    id: '8',
    name: 'Mud Cloth Tunic',
    description: 'Authentic Bogolanfini mud cloth tunic',
    basePrice: 200,
    finalPrice: 240,
    images: [{ url: '/images/designs/mudcloth-tunic.jpg' }],
    designer: { id: 'd8', businessName: 'Mali Artisans', country: 'Mali', rating: 4.8 },
    category: { id: 'c3', name: 'Men\'s Wear' },
    rating: 4.7,
    reviewCount: 52,
    orderCount: 89,
    flag: '🇲🇱',
  },
  {
    id: '9',
    name: 'Adire Off-Shoulder',
    description: 'Trendy off-shoulder top in Adire pattern',
    basePrice: 85,
    finalPrice: 110,
    images: [{ url: '/images/designs/adire-offshoulder.jpg' }],
    designer: { id: 'd9', businessName: 'Abeokuta Styles', country: 'Nigeria', rating: 4.3 },
    category: { id: 'c6', name: 'Tops' },
    rating: 4.4,
    reviewCount: 92,
    orderCount: 167,
    flag: '🇳🇬',
  },
  {
    id: '10',
    name: 'Kente Blazer',
    description: 'Modern blazer in traditional Kente patterns',
    basePrice: 280,
    finalPrice: 320,
    images: [{ url: '/images/designs/kente-blazer.jpg' }],
    designer: { id: 'd10', businessName: 'Accra Elite', country: 'Ghana', rating: 4.9 },
    category: { id: 'c3', name: 'Men\'s Wear' },
    rating: 4.8,
    reviewCount: 45,
    orderCount: 78,
    flag: '🇬🇭',
  },
  {
    id: '11',
    name: 'Zulu Beaded Dress',
    description: 'Traditional Zulu dress with authentic beadwork',
    basePrice: 420,
    finalPrice: 480,
    images: [{ url: '/images/designs/zulu-beaded.jpg' }],
    designer: { id: 'd11', businessName: 'Zulu Heritage', country: 'South Africa', rating: 4.9 },
    category: { id: 'c1', name: 'Traditional Wear' },
    rating: 4.9,
    reviewCount: 67,
    orderCount: 112,
    flag: '🇿🇦',
  },
  {
    id: '12',
    name: 'Maasai Shuka Wrap',
    description: 'Colorful Maasai Shuka wrap dress',
    basePrice: 110,
    finalPrice: 135,
    images: [{ url: '/images/designs/maasai-shuka.jpg' }],
    designer: { id: 'd12', businessName: 'Kenya Crafts', country: 'Kenya', rating: 4.5 },
    category: { id: 'c2', name: 'Dresses' },
    rating: 4.6,
    reviewCount: 34,
    orderCount: 56,
    flag: '🇰🇪',
  },
];

export default function Designs() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Data states
  const [designs, setDesigns] = useState<Design[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const { formatFromUsd } = useCurrencyStore();
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    categoryId: searchParams.get('category') || '',
    country: searchParams.get('country') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    sortBy: searchParams.get('sortBy') || 'newest',
    page: parseInt(searchParams.get('page') || '1'),
  });
  
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Load data on filter change
  useEffect(() => {
    loadFilters();
    loadDesigns();
  }, [filters]);

  // Sample categories and countries
  const sampleCategories: Category[] = [
    { id: 'c1', name: 'Traditional Wear' },
    { id: 'c2', name: 'Dresses' },
    { id: 'c3', name: 'Men\'s Wear' },
    { id: 'c4', name: 'Bridal' },
    { id: 'c5', name: 'Skirts' },
    { id: 'c6', name: 'Tops' },
  ];

  const sampleCountries = ['Ghana', 'Nigeria', 'Mali', 'Senegal', 'Tanzania', 'South Africa', 'Kenya'];

  const loadFilters = async () => {
    try {
      const [categoriesRes, countriesRes] = await Promise.all([
        api.products.getCategories(),
        api.products.getCountries(),
      ]);
      if (categoriesRes.success && categoriesRes.data.length > 0) {
        setCategories(categoriesRes.data);
      } else {
        setCategories(sampleCategories);
      }
      if (countriesRes.success && countriesRes.data.length > 0) {
        setCountries(countriesRes.data);
      } else {
        setCountries(sampleCountries);
      }
    } catch (error) {
      console.error('Failed to load filters:', error);
      setCategories(sampleCategories);
      setCountries(sampleCountries);
    }
  };

  const loadDesigns = async () => {
    setIsLoading(true);
    try {
      const response = await api.products.getDesigns({
        search: filters.search || undefined,
        categoryId: filters.categoryId || undefined,
        country: filters.country || undefined,
        page: filters.page,
        limit: 200, // 4 columns x 50 rows
      });
      if (response.success && response.data.designs.length > 0) {
        setDesigns(response.data.designs);
        setPagination(response.data.pagination);
      } else {
        // Use sample designs if API returns empty
        setDesigns(sampleDesigns);
        setPagination({
          page: 1,
          limit: 12,
          total: sampleDesigns.length,
          pages: 1,
        });
      }
    } catch (error) {
      console.error('Failed to load designs:', error);
      // Use sample designs on error
      setDesigns(sampleDesigns);
      setPagination({
        page: 1,
        limit: 12,
        total: sampleDesigns.length,
        pages: 1,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateFilter = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
    updateURLParams(newFilters);
  };

  const updateURLParams = (newFilters: typeof filters) => {
    const params = new URLSearchParams();
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.categoryId) params.set('category', newFilters.categoryId);
    if (newFilters.country) params.set('country', newFilters.country);
    if (newFilters.minPrice) params.set('minPrice', newFilters.minPrice);
    if (newFilters.maxPrice) params.set('maxPrice', newFilters.maxPrice);
    if (newFilters.sortBy !== 'newest') params.set('sortBy', newFilters.sortBy);
    if (newFilters.page > 1) params.set('page', newFilters.page.toString());
    setSearchParams(params);
  };

  const clearFilters = () => {
    const cleared = {
      search: '',
      categoryId: '',
      country: '',
      minPrice: '',
      maxPrice: '',
      sortBy: 'newest',
      page: 1,
    };
    setFilters(cleared);
    updateURLParams(cleared);
  };

  const goToPage = (page: number) => {
    const newFilters = { ...filters, page };
    setFilters(newFilters);
    updateURLParams(newFilters);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeFiltersCount = [
    filters.categoryId,
    filters.country,
    filters.minPrice,
    filters.maxPrice,
  ].filter(Boolean).length;

  // Filter Bar Component - Single row
  const FilterBar = () => (
    <div className="flex flex-wrap items-center gap-2 md:gap-3">
      {/* Categories Dropdown */}
      <div className="relative">
        <select
          value={filters.categoryId}
          onChange={(e) => updateFilter('categoryId', e.target.value)}
          className="pl-3 pr-8 py-2 text-sm border rounded-lg appearance-none cursor-pointer focus:ring-2 focus:ring-coral-500 focus:border-transparent bg-white"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Countries Dropdown */}
      <div className="relative">
        <select
          value={filters.country}
          onChange={(e) => updateFilter('country', e.target.value)}
          className="pl-3 pr-8 py-2 text-sm border rounded-lg appearance-none cursor-pointer focus:ring-2 focus:ring-coral-500 focus:border-transparent bg-white"
        >
          <option value="">All Countries</option>
          {countries.map((country) => (
            <option key={country} value={country}>{country}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Price Range */}
      <div className="flex items-center gap-1">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => updateFilter('minPrice', e.target.value)}
            className="w-20 pl-5 pr-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-coral-500"
          />
        </div>
        <span className="text-gray-400 text-sm">-</span>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => updateFilter('maxPrice', e.target.value)}
            className="w-20 pl-5 pr-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-coral-500"
          />
        </div>
      </div>

      {/* Sort */}
      <div className="relative">
        <select
          value={filters.sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="pl-3 pr-8 py-2 text-sm border rounded-lg appearance-none cursor-pointer focus:ring-2 focus:ring-coral-500 bg-white"
        >
          <option value="newest">Newest</option>
          <option value="price-low">Price: Low-High</option>
          <option value="price-high">Price: High-Low</option>
          <option value="rating">Rated</option>
          <option value="popular">Popular</option>
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Clear Filters */}
      {activeFiltersCount > 0 && (
        <button
          onClick={clearFilters}
          className="px-3 py-2 text-xs text-coral-500 font-medium hover:bg-coral-50 rounded-lg transition-colors border border-coral-200"
        >
          Clear ({activeFiltersCount})
        </button>
      )}

      {/* Results Count */}
      <div className="ml-auto text-xs text-gray-500">
        {pagination?.total || 0} designs
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Banner with Search */}
      <section className="relative h-72 md:h-80 overflow-hidden">
        <img
          src="/images/hero-designs.jpg"
          alt="African Fashion Designs"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.5), transparent)' }} />
        <div className="absolute inset-0 flex items-center">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="max-w-3xl">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3">
                Designer Collections
              </h1>
              <p className="text-base md:text-lg text-white text-opacity-80 mb-4">
                Discover unique African fashion designs from talented designers across the continent.
              </p>
              
              {/* Search Bar on Banner - Longer */}
              <div className="relative max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Search designs, designers, styles..."
                  className="w-full pl-12 pr-12 py-3.5 rounded-full bg-white shadow-lg focus:ring-2 focus:ring-coral-500 focus:outline-none text-base"
                />
                {filters.search ? (
                  <button
                    onClick={() => updateFilter('search', '')}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  </button>
                ) : (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-coral-500 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-coral-600 transition-colors">
                    Search
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="info" className="bg-white bg-opacity-20 text-white border-0 text-xs">
                  {pagination?.total || 0}+ Designs
                </Badge>
                <Badge variant="info" className="bg-white bg-opacity-20 text-white border-0 text-xs">
                  {countries.length}+ Countries
                </Badge>
                <Badge variant="info" className="bg-white bg-opacity-20 text-white border-0 text-xs">
                  Custom Made
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Bar - Single Row Below Banner */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-3">
          <div className="flex items-center justify-between">
            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowMobileFilters(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 bg-coral-500 text-white text-xs rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Desktop Filter Bar */}
            <div className="hidden lg:block flex-1">
              <FilterBar />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        {/* Mobile Filter Bar */}
        <div className="lg:hidden mb-4">
          <FilterBar />
        </div>

        {/* Products Grid */}
        <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-coral-500" />
              </div>
            ) : designs.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No designs found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters or search terms</p>
                <Button onClick={clearFilters} variant="outline">
                  Clear All Filters
                </Button>
              </div>
            ) : (
              <>
                {/* 4 Column Grid - 50 rows per page (200 items) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {designs.map((design) => {
                    const flagCode = resolveCountryCode(design.designer?.country || '');
                    return (
                    <Link 
                      key={design.id} 
                      to={`/designs/${design.id}`} 
                      className="group"
                    >
                      <div className="bg-white shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                        {/* Image */}
                        <div className="overflow-hidden relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                          <img
                            src={design.images?.[0]?.url || '/placeholder.jpg'}
                            alt={design.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          {/* Country flag - bottom right */}
                          <div className="absolute bottom-3 right-3 z-10">
                            {flagCode ? (
                              <img
                                src={`https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`}
                                alt={`${design.designer?.country || 'Country'} flag`}
                                className="h-7 w-10 rounded-sm object-cover shadow-lg"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-2xl shadow-lg">{design.flag}</span>
                            )}
                          </div>
                          {/* Heart button - top right */}
                          <button 
                            className="absolute top-3 right-3 w-8 h-8 bg-white bg-opacity-90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-coral-500 hover:text-white"
                            onClick={(e) => e.preventDefault()}
                          >
                            <Heart className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 group-hover:text-coral-500 transition-colors">
                            {design.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {design.designer?.businessName}
                          </p>
                          <p className="text-coral-500 font-semibold mt-2">{formatFromUsd(Number(design.finalPrice || 0))}</p>
                        </div>
                      </div>
                    </Link>
                  )})}
                </div>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex justify-center items-center mt-12 gap-2">
                    <button
                      onClick={() => goToPage(filters.page - 1)}
                      disabled={filters.page === 1}
                      className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    {Array.from({ length: Math.min(10, pagination.pages) }, (_, i) => {
                      // Show pages around current page
                      let pageNum;
                      if (pagination.pages <= 10) {
                        pageNum = i + 1;
                      } else if (filters.page <= 5) {
                        pageNum = i + 1;
                      } else if (filters.page >= pagination.pages - 4) {
                        pageNum = pagination.pages - 9 + i;
                      } else {
                        pageNum = filters.page - 4 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium transition-colors ${filters.page === pageNum ? 'bg-coral-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => goToPage(filters.page + 1)}
                      disabled={filters.page === pagination.pages}
                      className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Page Info */}
                {pagination && (
                  <p className="text-center text-gray-500 mt-4">
                    Page {pagination.page} of {pagination.pages} • Showing {designs.length} of {pagination.total} designs
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        {showMobileFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div 
              className="absolute inset-0 bg-black bg-opacity-50"
              onClick={() => setShowMobileFilters(false)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white overflow-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Filters</h2>
                <button onClick={() => setShowMobileFilters(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <FilterBar />
              </div>
            </div>
          </div>
        )}
    </div>
  );
}


