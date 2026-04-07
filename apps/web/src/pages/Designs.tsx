import '../styles/jenks-v2.css';
import { ThemeProvider } from './jenks-v14/context/ThemeContext';
import { useState, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Home, ChevronRight, Search, X, Sparkles } from 'lucide-react';
import ContactFooter from './jenks-v14/components/ContactFooter';
import CountryFilter from './jenks-v14/components/CountryFilter';

gsap.registerPlugin(ScrollTrigger);

interface CustomPiece {
  id: string;
  name: string;
  designer: string;
  price: string;
  image: string;
  country: string;
  countryFlag: string;
  specialty: string;
  isNew?: boolean;
}

const customPieces: CustomPiece[] = [
  { id: '1', name: 'Embroidered Mermaid Gown', designer: 'Amaka Designs', price: 'From $850.00', image: '/custom_product1.jpg', country: 'nigeria', countryFlag: '🇳🇬', specialty: 'Bridal' },
  { id: '2', name: 'Bespoke Heritage Suit', designer: 'Oluwole Atelier', price: 'From $680.00', image: '/custom_product2.jpg', country: 'nigeria', countryFlag: '🇳🇬', specialty: 'Formal' },
  { id: '3', name: 'Royal Wedding Ensemble', designer: 'Yemisi Studio', price: 'From $2,400.00', image: '/custom_product3.jpg', country: 'nigeria', countryFlag: '🇳🇬', specialty: 'Bridal', isNew: true },
  { id: '4', name: 'Handwoven Dashiki', designer: 'Nana Kofi', price: 'From $320.00', image: '/custom_product4.jpg', country: 'ghana', countryFlag: '🇬🇭', specialty: 'Traditional' },
  { id: '5', name: 'Kitenge Bridal Gown', designer: 'Nairobi Bridal', price: 'From $1,200.00', image: '/custom_product1.jpg', country: 'kenya', countryFlag: '🇰🇪', specialty: 'Bridal' },
  { id: '6', name: 'Moroccan Wedding Caftan', designer: 'Marrakech Royal', price: 'From $3,200.00', image: '/custom_product3.jpg', country: 'morocco', countryFlag: '🇲🇦', specialty: 'Bridal' },
  { id: '7', name: 'Shweshwe Wedding Dress', designer: 'Johannesburg Bridal', price: 'From $1,600.00', image: '/custom_product2.jpg', country: 'south-africa', countryFlag: '🇿🇦', specialty: 'Bridal', isNew: true },
  { id: '8', name: 'Toghu Royal Attire', designer: 'Bamileke Royal', price: 'From $2,800.00', image: '/custom_product4.jpg', country: 'cameroon', countryFlag: '🇨🇲', specialty: 'Traditional', isNew: true },
];

const specialties = [
  { id: 'bridal', label: 'Bridal' },
  { id: 'formal', label: 'Formal' },
  { id: 'traditional', label: 'Traditional' },
  { id: 'contemporary', label: 'Contemporary' },
];

export default function CustomToWearPage() {
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const heroRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLElement>(null);

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
        const cards = gridRef.current.querySelectorAll('.custom-card');
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

      if (processRef.current) {
        const steps = processRef.current.querySelectorAll('.process-step');
        gsap.fromTo(
          steps,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.15,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: processRef.current,
              start: 'top 75%',
            }
          }
        );
      }
    });

    return () => ctx.revert();
  }, []);

  const toggleSpecialty = (specialtyId: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(specialtyId)
        ? prev.filter(id => id !== specialtyId)
        : [...prev, specialtyId]
    );
  };

  const clearFilters = () => {
    setSelectedCountries([]);
    setSelectedSpecialties([]);
    setSearchQuery('');
  };

  const filteredPieces = customPieces.filter(piece => {
    if (selectedCountries.length > 0 && !selectedCountries.includes(piece.country)) return false;
    if (selectedSpecialties.length > 0 && !selectedSpecialties.includes(piece.specialty.toLowerCase())) return false;
    if (searchQuery && !piece.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeFilterCount = selectedCountries.length + selectedSpecialties.length;

  return (
    <ThemeProvider>
      <div className="relative bg-[#F8F6F1] min-h-screen">
      <div className="grain-overlay" />

      {/* Editorial Hero */}
      <section ref={heroRef} className="relative h-[85vh] min-h-[600px] overflow-hidden">
        <div ref={imageRef} className="absolute inset-0 w-full h-[120%]">
          <img src="/custom_hero.jpg" alt="Custom Design Collection" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </div>

        <div ref={contentRef} className="absolute inset-0 flex flex-col justify-end pb-20 px-8 md:px-[8vw]">
          <nav className="flex items-center gap-2 mb-8">
            <Link to="/" className="flex items-center gap-1 text-white/70 hover:text-white transition-colors text-sm">
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <ChevronRight className="w-4 h-4 text-white/40" />
            <span className="text-white text-sm">Custom to Wear</span>
          </nav>

          <span className="label-mono text-white/60 mb-4">BESPOKE</span>
          <h1 className="headline-lg text-[clamp(48px,8vw,120px)] text-white mb-6 max-w-4xl leading-[0.95]">
            Custom to Wear
          </h1>
          <p className="text-lg text-white/80 max-w-xl leading-relaxed mb-8">
            Every stitch sewn by an African designer. Submit your measurements, choose your fabric, and work directly with a maker who understands the details.
          </p>

          <div className="flex items-center gap-12">
            <div><span className="text-3xl font-light text-white">{customPieces.length}</span><p className="text-sm text-white/60 mt-1">Master Tailors</p></div>
            <div><span className="text-3xl font-light text-white">6</span><p className="text-sm text-white/60 mt-1">Countries</p></div>
            <div><span className="text-3xl font-light text-white">6</span><p className="text-sm text-white/60 mt-1">Weeks Avg.</p></div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section ref={processRef} className="py-20 px-8 md:px-[8vw] bg-[#1A1A1A]">
        <div className="text-center mb-16">
          <span className="label-mono text-white/50 mb-4 block">THE PROCESS</span>
          <h2 className="headline-lg text-[clamp(32px,4vw,56px)] text-white">How It Works</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Consultation', desc: 'Share your vision with our designers' },
            { step: '02', title: 'Measurements', desc: 'Submit your precise measurements' },
            { step: '03', title: 'Creation', desc: 'Your piece is handcrafted with care' },
            { step: '04', title: 'Delivery', desc: 'Receive your bespoke garment' },
          ].map((item) => (
            <div key={item.step} className="process-step text-center">
              <span className="text-5xl font-light text-[#E85A3C]/30 block mb-4">{item.step}</span>
              <h3 className="text-xl text-white mb-2">{item.title}</h3>
              <p className="text-white/60 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-12">
          <button className="cta-button">
            <Sparkles className="w-4 h-4" />
            <span>Start Your Order</span>
          </button>
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
                placeholder="Search designers..."
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
              <span className="label-mono text-[#6B6B6B] text-xs">SPECIALTY</span>
              <div className="flex flex-wrap gap-1">
                {specialties.map((specialty) => {
                  const isActive = selectedSpecialties.includes(specialty.id);
                  return (
                    <button
                      key={specialty.id}
                      onClick={() => toggleSpecialty(specialty.id)}
                      className={`px-2.5 py-1 text-xs border transition-all ${
                        isActive ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white' : 'bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:border-[#E85A3C]/40'
                      }`}
                    >
                      {specialty.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Pieces Grid */}
      <section className="py-16 px-8 md:px-[8vw]">
        <div className="flex items-center justify-between mb-10">
          <h2 className="headline-lg text-[clamp(24px,3vw,40px)] text-[#1A1A1A]">Master Artisans</h2>
          <span className="text-sm text-[#6B6B6B]">{filteredPieces.length} designers</span>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredPieces.map((piece) => (
            <div key={piece.id} className="custom-card group cursor-pointer bg-white">
              <div className="relative aspect-[3/4] overflow-hidden bg-[#F8F6F1]">
                <img src={piece.image} alt={piece.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <button className="cta-button transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <span>View Portfolio</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute top-3 left-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-lg shadow-lg">
                  {piece.countryFlag}
                </div>
                {piece.isNew && (
                  <div className="absolute top-3 right-3">
                    <span className="label-mono bg-[#E85A3C] text-white px-3 py-1 text-xs">NEW</span>
                  </div>
                )}
              </div>
              <div className="pt-4 pb-4 px-4">
                <h3 className="text-[#1A1A1A] font-medium text-lg mb-1 group-hover:text-[#E85A3C] transition-colors">{piece.name}</h3>
                <p className="text-sm text-[#6B6B6B] mb-2">by {piece.designer}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[#E85A3C] font-medium">{piece.price}</p>
                  <span className="text-xs text-[#6B6B6B] bg-[#F8F6F1] px-2 py-1">{piece.specialty}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredPieces.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[#6B6B6B] mb-4">No designers match your filters.</p>
            <button onClick={clearFilters} className="cta-button-outline"><span>Clear Filters</span></button>
          </div>
        )}

        <div className="flex justify-center mt-16">
          <button className="cta-button-outline">
            <span>View All Designers</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <ContactFooter />
      </div>
    </ThemeProvider>
  );
}
