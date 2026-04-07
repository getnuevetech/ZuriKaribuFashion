import '../styles/jenks-v2.css';
import { ThemeProvider } from './jenks-v14/context/ThemeContext';
import { useState, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Home, ChevronRight, Search, X } from 'lucide-react';
import Navigation from './jenks-v14/components/Navigation';
import ContactFooter from './jenks-v14/components/ContactFooter';
import CountryFilter from './jenks-v14/components/CountryFilter';

gsap.registerPlugin(ScrollTrigger);

interface Product {
  id: string;
  name: string;
  designer: string;
  price: string;
  image: string;
  country: string;
  countryFlag: string;
  isNew?: boolean;
  material?: string;
}

// Products for Ready To Wear
const products: Product[] = [
  { id: '1', name: 'Adire Diamond Gown', designer: 'Amaka Designs', price: '$245.00', image: '/rw_product1.jpg', country: 'nigeria', countryFlag: '🇳🇬', isNew: true, material: 'Adire' },
  { id: '2', name: 'Heritage Power Suit', designer: 'Oluwole Atelier', price: '$380.00', image: '/rw_product2.jpg', country: 'nigeria', countryFlag: '🇳🇬', material: 'Ankara' },
  { id: '3', name: 'Ankara Flow Skirt', designer: 'Nana Kofi', price: '$125.00', image: '/rw_product3.jpg', country: 'ghana', countryFlag: '🇬🇭', isNew: true, material: 'Ankara' },
  { id: '4', name: 'Terracotta Peplum Set', designer: 'Yemisi Studio', price: '$285.00', image: '/rw_product4.jpg', country: 'nigeria', countryFlag: '🇳🇬', material: 'Aso-Oke' },
  { id: '5', name: 'Royal Boubou Gown', designer: 'Babatunde', price: '$420.00', image: '/rw_product5.jpg', country: 'nigeria', countryFlag: '🇳🇬', material: 'Lace' },
  { id: '6', name: 'Kente Maxi Dress', designer: 'Ama Kente House', price: '$350.00', image: '/rw_product2.jpg', country: 'ghana', countryFlag: '🇬🇭', material: 'Kente' },
  { id: '7', name: 'Bogolan Tunic', designer: 'Mali Heritage', price: '$195.00', image: '/rw_product3.jpg', country: 'mali', countryFlag: '🇲🇱', material: 'Mud Cloth' },
  { id: '8', name: 'Senegalese Caftan', designer: 'Dakar Couture', price: '$275.00', image: '/rw_product4.jpg', country: 'senegal', countryFlag: '🇸🇳', material: 'Cotton' },
  { id: '9', name: 'Kitenge Wrap Dress', designer: 'Nairobi Fashion', price: '$165.00', image: '/rw_product1.jpg', country: 'kenya', countryFlag: '🇰🇪', isNew: true, material: 'Kitenge' },
  { id: '10', name: 'Shweshwe Ball Gown', designer: 'Thando Fashion', price: '$265.00', image: '/rw_product2.jpg', country: 'south-africa', countryFlag: '🇿🇦', isNew: true, material: 'Shweshwe' },
  { id: '11', name: 'Moroccan Caftan', designer: 'Marrakech Atelier', price: '$450.00', image: '/rw_product5.jpg', country: 'morocco', countryFlag: '🇲🇦', material: 'Silk' },
  { id: '12', name: 'Toghu Velvet Jacket', designer: 'Yaounde Couture', price: '$380.00', image: '/rw_product4.jpg', country: 'cameroon', countryFlag: '🇨🇲', material: 'Toghu' },
];

// Material options
const materials = [
  { id: 'ankara', label: 'Ankara' },
  { id: 'kente', label: 'Kente' },
  { id: 'adire', label: 'Adire' },
  { id: 'aso-oke', label: 'Aso-Oke' },
  { id: 'lace', label: 'Lace' },
  { id: 'shweshwe', label: 'Shweshwe' },
  { id: 'kitenge', label: 'Kitenge' },
  { id: 'silk', label: 'Silk' },
  { id: 'cotton', label: 'Cotton' },
];

export default function ReadyToWearPage() {
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const heroRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(imageRef.current, {
        yPercent: 15,
        ease: 'none',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        }
      });

      gsap.fromTo(
        contentRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top 60%',
          }
        }
      );

      if (gridRef.current) {
        const cards = gridRef.current.querySelectorAll('.product-card');
        gsap.fromTo(
          cards,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.05,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: gridRef.current,
              start: 'top 80%',
            }
          }
        );
      }
    });

    return () => ctx.revert();
  }, []);

  const toggleMaterial = (materialId: string) => {
    setSelectedMaterials(prev =>
      prev.includes(materialId)
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  const clearFilters = () => {
    setSelectedCountries([]);
    setSelectedMaterials([]);
    setSearchQuery('');
  };

  const filteredProducts = products.filter(product => {
    if (selectedCountries.length > 0 && !selectedCountries.includes(product.country)) return false;
    if (selectedMaterials.length > 0 && product.material && !selectedMaterials.includes(product.material.toLowerCase().replace(/\s+/g, '-'))) return false;
    if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase()) && !product.designer.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeFilterCount = selectedCountries.length + selectedMaterials.length;

  return (
    <ThemeProvider>
      <div className="relative bg-[var(--bg-primary)] min-h-screen">
      <div className="grain-overlay" />
      <Navigation />

      {/* Editorial Hero */}
      <section ref={heroRef} className="relative h-[85vh] min-h-[600px] overflow-hidden">
        <div ref={imageRef} className="absolute inset-0 w-full h-[120%]">
          <img src="/rw_hero.jpg" alt="Ready to Wear Collection" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </div>

        <div ref={contentRef} className="absolute inset-0 flex flex-col justify-end pb-20 px-8 md:px-[8vw]">
          <nav className="flex items-center gap-2 mb-8">
            <Link to="/" className="flex items-center gap-1 text-white/70 hover:text-white transition-colors text-sm">
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <ChevronRight className="w-4 h-4 text-white/40" />
            <span className="text-white text-sm">Ready to Wear</span>
          </nav>

          <span className="label-mono text-white/60 mb-4">COLLECTION</span>
          <h1 className="headline-lg text-[clamp(48px,8vw,120px)] text-white mb-6 max-w-4xl leading-[0.95]">
            Ready to Wear
          </h1>
          <p className="text-lg text-white/80 max-w-xl leading-relaxed mb-8">
            Curated fits built for real life — tailored enough to feel special, versatile enough to wear anywhere.
          </p>

          <div className="flex items-center gap-12">
            <div><span className="text-3xl font-light text-white">{products.length}</span><p className="text-sm text-white/60 mt-1">Pieces</p></div>
            <div><span className="text-3xl font-light text-white">12</span><p className="text-sm text-white/60 mt-1">Countries</p></div>
            <div><span className="text-3xl font-light text-white">9</span><p className="text-sm text-white/60 mt-1">Materials</p></div>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="sticky top-20 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border)]">
        <div className="px-8 md:px-[8vw] py-4">
          {/* Search Row */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collection..."
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors text-sm"
              />
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-4 h-4" /> Clear ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="space-y-3">
            {/* Country Filter - Using new component */}
            <CountryFilter 
              selectedCountries={selectedCountries}
              onChange={setSelectedCountries}
            />

            {/* Material Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="label-mono text-[var(--text-secondary)] text-xs">MATERIAL</span>
              <div className="flex flex-wrap gap-1">
                {materials.map((material) => {
                  const isActive = selectedMaterials.includes(material.id);
                  return (
                    <button
                      key={material.id}
                      onClick={() => toggleMaterial(material.id)}
                      className={`px-2.5 py-1 text-xs border transition-all ${
                        isActive ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {material.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <section className="py-16 px-8 md:px-[8vw]">
        <div className="flex items-center justify-between mb-10">
          <h2 className="headline-lg text-[clamp(24px,3vw,40px)] text-[var(--text-primary)]">
            Collection
          </h2>
          <span className="text-sm text-[var(--text-secondary)]">
            {filteredProducts.length} pieces
          </span>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredProducts.map((product) => (
            <Link to={`/product/${product.id}`} key={product.id} className="product-card group bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div className="relative aspect-[3/4] overflow-hidden bg-[var(--bg-primary)]">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <span className="cta-button transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <span>View Product</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
                <div className="absolute top-3 left-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-lg shadow-lg">
                  {product.countryFlag}
                </div>
                {product.material && (
                  <div className="absolute bottom-3 left-3">
                    <span className="text-xs px-2 py-1 bg-white/90 text-[var(--text-primary)]">{product.material}</span>
                  </div>
                )}
                {product.isNew && (
                  <div className="absolute top-3 right-3">
                    <span className="label-mono bg-[var(--accent)] text-white px-3 py-1 text-xs">NEW</span>
                  </div>
                )}
              </div>
              <div className="pt-4 pb-4 px-4">
                <h3 className="text-[var(--text-primary)] font-medium text-lg mb-1 group-hover:text-[var(--accent)] transition-colors">{product.name}</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-2">{product.designer}</p>
                <p className="text-[var(--accent)] font-medium">{product.price}</p>
              </div>
            </Link>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[var(--text-secondary)] mb-4">No products match your filters.</p>
            <button onClick={clearFilters} className="cta-button-outline">
              <span>Clear Filters</span>
            </button>
          </div>
        )}

        <div className="flex justify-center mt-16">
          <button className="cta-button-outline">
            <span>Load More</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <ContactFooter />
      </div>
    </ThemeProvider>
  );
}
