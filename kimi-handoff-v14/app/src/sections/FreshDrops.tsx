import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, ArrowLeft } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface FreshDropsProps {
  className?: string;
}

const products = [
  {
    id: 1,
    name: 'Awon Da',
    designer: 'Diallo Fabrics',
    price: '$230.00',
    image: '/product1.jpg',
    tag: 'New',
  },
  {
    id: 2,
    name: 'Kakaki Kentus',
    designer: 'Diallo Fabrics',
    price: '$115.00',
    image: '/product2.jpg',
    tag: 'New',
  },
  {
    id: 3,
    name: 'Ankara Agege',
    designer: 'Diallo Fabrics',
    price: '$0.13/yd',
    image: '/product3.jpg',
    tag: 'New',
  },
  {
    id: 4,
    name: 'Ankara Mummy',
    designer: 'Diallo Fabrics',
    price: '$8.31',
    image: '/product4.jpg',
    tag: 'New',
  },
  {
    id: 5,
    name: 'Ankara Kwara',
    designer: 'Diallo Fabrics',
    price: '$25.30',
    image: '/product5.jpg',
    tag: 'New',
  },
  {
    id: 6,
    name: 'Dancing Queen Adire',
    designer: 'Diallo Fabrics',
    price: '$62.36',
    image: '/product6.jpg',
    tag: 'New',
  },
];

export default function FreshDrops({ className = '' }: FreshDropsProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Header animation
      gsap.fromTo(
        headerRef.current,
        { y: 18, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: headerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          }
        }
      );

      // Cards animation
      if (carouselRef.current) {
        const cards = carouselRef.current.querySelectorAll('.product-card');
        gsap.fromTo(
          cards,
          { y: 60, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            stagger: 0.06,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: carouselRef.current,
              start: 'top 75%',
              toggleActions: 'play none none reverse',
            }
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 400;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section 
      ref={sectionRef} 
      className={`section-flowing bg-[#F8F6F1] py-24 md:py-32 ${className}`}
    >
      <div className="px-8 md:px-[8vw]">
        {/* Header */}
        <div ref={headerRef} className="flex items-end justify-between mb-12">
          <div>
            <h2 className="headline-lg text-[clamp(34px,4.2vw,72px)] text-[#1A1A1A] mb-2">
              FRESH DROPS
            </h2>
            <p className="text-base text-[#6B6B6B]">
              New arrivals from the most talented designers across the continent.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="#view-all" 
              className="cta-link group inline-flex items-center gap-2 hidden md:flex"
            >
              <span>View all new arrivals</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
            
            {/* Navigation Arrows */}
            <div className="flex gap-2">
              <button 
                onClick={() => scrollCarousel('left')}
                className="p-3 border border-[#1A1A1A]/10 hover:border-[#E85A3C]/40 transition-colors bg-white"
                aria-label="Scroll left"
              >
                <ArrowLeft className="w-4 h-4 text-[#1A1A1A]" />
              </button>
              <button 
                onClick={() => scrollCarousel('right')}
                className="p-3 border border-[#1A1A1A]/10 hover:border-[#E85A3C]/40 transition-colors bg-white"
                aria-label="Scroll right"
              >
                <ArrowRight className="w-4 h-4 text-[#1A1A1A]" />
              </button>
            </div>
          </div>
        </div>

        {/* Product Carousel */}
        <div 
          ref={carouselRef}
          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product) => (
            <div 
              key={product.id}
              className="product-card flex-shrink-0 w-[280px] md:w-[320px] snap-start bg-white"
            >
              {/* Image */}
              <div className="relative aspect-[3/4] overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover editorial-image"
                />
                {/* Tag */}
                <span className="absolute top-4 left-4 label-mono bg-[#E85A3C] text-white px-3 py-1">
                  {product.tag}
                </span>
              </div>
              
              {/* Info */}
              <div className="p-4">
                <h3 className="text-[#1A1A1A] font-medium mb-1">{product.name}</h3>
                <p className="text-sm text-[#6B6B6B] mb-2">{product.designer}</p>
                <p className="text-[#E85A3C] font-medium">{product.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
