import { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';
import { getFlagById } from '../data/africanCountries';

gsap.registerPlugin(ScrollTrigger);

export interface Product {
  id: string;
  name: string;
  designer: string;
  price: string;
  image: string;
  country: string;
  countryFlag?: string;
  isNew?: boolean;
  material?: string;
}

interface ProductGridProps {
  products: Product[];
  title?: string;
}

export default function ProductGrid({ products, title }: ProductGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gridRef.current?.querySelectorAll('.product-card');
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 40, opacity: 0, scale: 0.98 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: gridRef.current,
              start: 'top 80%',
              toggleActions: 'play none none reverse',
            }
          }
        );
      }
    }, gridRef);

    return () => ctx.revert();
  }, [products]);

  return (
    <section className="py-12 px-8 md:px-[8vw] bg-[#F8F6F1]">
      {/* Section Title */}
      {title && (
        <div className="flex items-center justify-between mb-8">
          <h2 className="headline-lg text-[clamp(24px,3vw,40px)] text-[#1A1A1A]">
            {title}
          </h2>
          <span className="text-sm text-[#6B6B6B]">
            {products.length} products
          </span>
        </div>
      )}

      {/* Masonry Grid */}
      <div 
        ref={gridRef}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        {products.map((product, index) => (
          <Link
            to={`/product/${product.id}`}
            key={product.id}
            className={`product-card group bg-white ${
              index % 5 === 0 ? 'sm:col-span-2 lg:col-span-1' : ''
            }`}
          >
            {/* Image Container */}
            <div className="relative aspect-[3/4] overflow-hidden bg-[#F8F6F1]">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              
              {/* Overlay on Hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <span className="cta-button transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <span>View Product</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>

              {/* Country Flag */}
              <div className="absolute top-3 left-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-lg shadow-lg">
                {product.countryFlag || getFlagById(product.country) || '🌍'}
              </div>

              {/* Material Badge (if available) */}
              {product.material && (
                <div className="absolute bottom-3 left-3">
                  <span className="text-xs px-2 py-1 bg-white/90 text-[#1A1A1A]">
                    {product.material}
                  </span>
                </div>
              )}

              {/* New Badge */}
              {product.isNew && (
                <div className="absolute top-3 right-3">
                  <span className="label-mono bg-[#E85A3C] text-white px-3 py-1">
                    NEW
                  </span>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="pt-4 pb-4 px-4">
              <h3 className="text-[#1A1A1A] font-medium text-lg mb-1 group-hover:text-[#E85A3C] transition-colors">
                {product.name}
              </h3>
              <p className="text-sm text-[#6B6B6B] mb-2">
                {product.designer}
              </p>
              <p className="text-[#E85A3C] font-medium">
                {product.price}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Load More */}
      {products.length > 8 && (
        <div className="flex justify-center mt-12">
          <button className="cta-button-outline">
            <span>Load More</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
}
