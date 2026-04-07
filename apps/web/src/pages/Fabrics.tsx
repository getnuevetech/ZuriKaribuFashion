import '../styles/jenks-v2.css';
import { ThemeProvider } from './jenks-v14/context/ThemeContext';
import { useState, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Home, ChevronRight, Search, X } from 'lucide-react';
import ContactFooter from './jenks-v14/components/ContactFooter';
import CountryFilter from './jenks-v14/components/CountryFilter';

gsap.registerPlugin(ScrollTrigger);

interface Fabric {
  id: string;
  name: string;
  origin: string;
  originCountry: string;
  price: string;
  image: string;
  countryFlag: string;
  material: string;
  isNew?: boolean;
}

const fabrics: Fabric[] = [
  { id: '1', name: 'Sunburst Ankara', origin: 'Vlisco Netherlands', originCountry: 'nigeria', price: '$45.00/yd', image: '/fabric_product1.jpg', countryFlag: '🇳🇬', material: 'Ankara', isNew: true },
  { id: '2', name: 'Royal Kente', origin: 'Bonwire Weavers', originCountry: 'ghana', price: '$120.00/yd', image: '/fabric_product2.jpg', countryFlag: '🇬🇭', material: 'Kente' },
  { id: '3', name: 'Indigo Adire', origin: 'Abeokuta Masters', originCountry: 'nigeria', price: '$65.00/yd', image: '/fabric_product3.jpg', countryFlag: '🇳🇬', material: 'Adire', isNew: true },
  { id: '4', name: 'Mud Cloth Bogolan', origin: 'Segou Artisans', originCountry: 'mali', price: '$85.00/yd', image: '/fabric_product4.jpg', countryFlag: '🇲🇱', material: 'Mud Cloth' },
  { id: '5', name: 'Imperial Silk', origin: 'Kano Textiles', originCountry: 'nigeria', price: '$150.00/yd', image: '/fabric_product5.jpg', countryFlag: '🇳🇬', material: 'Silk' },
  { id: '6', name: 'Kenyan Kanga', origin: 'Mombasa Textiles', originCountry: 'kenya', price: '$35.00/yd', image: '/fabric_product4.jpg', countryFlag: '🇰🇪', material: 'Kanga' },
  { id: '7', name: 'Moroccan Cactus Silk', origin: 'Marrakech Weavers', originCountry: 'morocco', price: '$180.00/yd', image: '/fabric_product5.jpg', countryFlag: '🇲🇦', material: 'Cactus Silk' },
  { id: '8', name: 'South African Shweshwe', origin: 'Da Gama Textiles', originCountry: 'south-africa', price: '$50.00/yd', image: '/fabric_product1.jpg', countryFlag: '🇿🇦', material: 'Shweshwe' },
  { id: '9', name: 'Cameroon Toghu', origin: 'Bamileke Artisans', originCountry: 'cameroon', price: '$155.00/yd', image: '/fabric_product2.jpg', countryFlag: '🇨🇲', material: 'Toghu', isNew: true },
  { id: '10', name: 'DRC Kuba Cloth', origin: 'Kuba Kingdom', originCountry: 'dr-congo', price: '$200.00/yd', image: '/fabric_product3.jpg', countryFlag: '🇨🇩', material: 'Raffia' },
];

const materialTypes = [
  { id: 'ankara', label: 'Ankara' },
  { id: 'kente', label: 'Kente' },
  { id: 'adire', label: 'Adire' },
  { id: 'mud-cloth', label: 'Mud Cloth' },
  { id: 'silk', label: 'Silk' },
  { id: 'cotton', label: 'Cotton' },
  { id: 'kanga', label: 'Kanga' },
  { id: 'raffia', label: 'Raffia' },
  { id: 'shweshwe', label: 'Shweshwe' },
  { id: 'toghu', label: 'Toghu' },
];

export default function FabricsPage() {
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
        const cards = gridRef.current.querySelectorAll('.fabric-card');
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

  const filteredFabrics = fabrics.filter(fabric => {
    if (selectedCountries.length > 0 && !selectedCountries.includes(fabric.originCountry)) return false;
    if (selectedMaterials.length > 0 && !selectedMaterials.includes(fabric.material.toLowerCase().replace(/\s+/g, '-'))) return false;
    if (searchQuery && !fabric.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeFilterCount = selectedCountries.length + selectedMaterials.length;

  return (
    <ThemeProvider>
      <div className="relative bg-[#F8F6F1] min-h-screen">
      <div className="grain-overlay" />

      {/* Editorial Hero */}
      <section ref={heroRef} className="relative h-[85vh] min-h-[600px] overflow-hidden">
        <div ref={imageRef} className="absolute inset-0 w-full h-[120%]">
          <img src="/fabrics_hero.jpg" alt="African Fabrics Collection" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </div>

        <div ref={contentRef} className="absolute inset-0 flex flex-col justify-end pb-20 px-8 md:px-[8vw]">
          <nav className="flex items-center gap-2 mb-8">
            <Link to="/" className="flex items-center gap-1 text-white/70 hover:text-white transition-colors text-sm">
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <ChevronRight className="w-4 h-4 text-white/40" />
            <span className="text-white text-sm">Fabrics</span>
          </nav>

          <span className="label-mono text-white/60 mb-4">TEXTILES</span>
          <h1 className="headline-lg text-[clamp(48px,8vw,120px)] text-white mb-6 max-w-4xl leading-[0.95]">
            Fabrics
          </h1>
          <p className="text-lg text-white/80 max-w-xl leading-relaxed mb-8">
            Source the same textiles artisans use — wax prints, hand-dyed adire, woven kente, and more.
          </p>

          <div className="flex items-center gap-12">
            <div><span className="text-3xl font-light text-white">{fabrics.length}</span><p className="text-sm text-white/60 mt-1">Varieties</p></div>
            <div><span className="text-3xl font-light text-white">10</span><p className="text-sm text-white/60 mt-1">Countries</p></div>
            <div><span className="text-3xl font-light text-white">10</span><p className="text-sm text-white/60 mt-1">Materials</p></div>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="sticky top-20 z-40 bg-[#F8F6F1]/95 backdrop-blur-md border-b border-[#1A1A1A]/10">
        <div className="px-8 md:px-[8vw] py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fabrics..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] placeholder:text-[#9A9A9A] focus:outline-none focus:border-[#E85A3C] transition-colors text-sm"
              />
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors">
                <X className="w-4 h-4" /> Clear ({activeFilterCount})
              </button>
            )}
          </div>

          <div className="space-y-3">
            <CountryFilter 
              selectedCountries={selectedCountries}
              onChange={setSelectedCountries}
            />

            <div className="flex items-center gap-2 flex-wrap">
              <span className="label-mono text-[#6B6B6B] text-xs">MATERIAL</span>
              <div className="flex flex-wrap gap-1">
                {materialTypes.map((material) => {
                  const isActive = selectedMaterials.includes(material.id);
                  return (
                    <button
                      key={material.id}
                      onClick={() => toggleMaterial(material.id)}
                      className={`px-2.5 py-1 text-xs border transition-all ${
                        isActive ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white' : 'bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:border-[#E85A3C]/40'
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

      {/* Fabric Grid */}
      <section className="py-16 px-8 md:px-[8vw]">
        <div className="flex items-center justify-between mb-10">
          <h2 className="headline-lg text-[clamp(24px,3vw,40px)] text-[#1A1A1A]">Collection</h2>
          <span className="text-sm text-[#6B6B6B]">{filteredFabrics.length} fabrics</span>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredFabrics.map((fabric) => (
            <div key={fabric.id} className="fabric-card group cursor-pointer bg-white">
              <div className="relative aspect-[3/4] overflow-hidden bg-[#F8F6F1]">
                <img src={fabric.image} alt={fabric.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <button className="cta-button transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <span>View Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute top-3 left-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-lg shadow-lg">
                  {fabric.countryFlag}
                </div>
                {fabric.isNew && (
                  <div className="absolute top-3 right-3">
                    <span className="label-mono bg-[#E85A3C] text-white px-3 py-1 text-xs">NEW</span>
                  </div>
                )}
              </div>
              <div className="pt-4 pb-4 px-4">
                <h3 className="text-[#1A1A1A] font-medium text-lg mb-1 group-hover:text-[#E85A3C] transition-colors">{fabric.name}</h3>
                <p className="text-sm text-[#6B6B6B] mb-2">{fabric.origin}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[#E85A3C] font-medium">{fabric.price}</p>
                  <span className="text-xs text-[#6B6B6B] bg-[#F8F6F1] px-2 py-1">{fabric.material}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredFabrics.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[#6B6B6B] mb-4">No fabrics match your filters.</p>
            <button onClick={clearFilters} className="cta-button-outline"><span>Clear Filters</span></button>
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
