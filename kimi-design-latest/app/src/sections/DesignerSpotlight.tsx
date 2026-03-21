import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface DesignerSpotlightProps {
  className?: string;
}

const spotlightDesigners = [
  {
    id: 'west-africa-edit',
    image: '/designer_spotlight.jpg',
    title: 'Meet designers across Africa.',
    description:
      'Showcasing rotating talent from different countries — each piece carries a name, a place, and a story.',
    cta: 'See the spotlight'
  },
  {
    id: 'east-africa-edit',
    image: '/featured_custom_right.jpg',
    title: 'Discover emerging signatures.',
    description:
      'A second spotlight lane highlights rising labels and artisan houses shaping modern African style.',
    cta: 'View featured designers'
  }
];

export default function DesignerSpotlight({ className = '' }: DesignerSpotlightProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const leftCardRef = useRef<HTMLDivElement>(null);
  const rightCardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const cards = [leftCardRef.current, rightCardRef.current].filter(Boolean);
      
      // Set initial state
      gsap.set(cards, { opacity: 0, y: 40 });
      
      // Animate left card
      gsap.to(leftCardRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        }
      });
      
      // Animate right card with delay
      gsap.to(rightCardRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        delay: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={sectionRef} 
      id="designers"
      className={`relative w-full min-h-screen bg-[#F8F6F1] ${className}`}
    >
      <div className="flex flex-col lg:flex-row w-full min-h-screen">
        {/* Left Column */}
        <div 
          ref={leftCardRef}
          className="relative w-full lg:w-1/2 h-[60vh] lg:h-screen overflow-hidden"
        >
          <div className="absolute inset-0 bg-gray-800">
            <img
              src={spotlightDesigners[0].image}
              alt={spotlightDesigners[0].title}
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute left-6 right-6 lg:left-10 lg:right-10 bottom-8 lg:bottom-12 bg-black/60 backdrop-blur-sm rounded-xl p-6 lg:p-8 z-10 border border-white/10">
            <h3 className="text-2xl lg:text-4xl font-semibold text-white mb-3 leading-tight">
              {spotlightDesigners[0].title}
            </h3>
            <p className="text-sm lg:text-base text-white/80 leading-relaxed max-w-lg mb-5">
              {spotlightDesigners[0].description}
            </p>
            <a 
              href="#spotlight" 
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
            >
              <span>{spotlightDesigners[0].cta}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Right Column */}
        <div 
          ref={rightCardRef}
          className="relative w-full lg:w-1/2 h-[60vh] lg:h-screen overflow-hidden"
        >
          <div className="absolute inset-0 bg-gray-800">
            <img
              src={spotlightDesigners[1].image}
              alt={spotlightDesigners[1].title}
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute left-6 right-6 lg:left-10 lg:right-10 bottom-8 lg:bottom-12 bg-black/60 backdrop-blur-sm rounded-xl p-6 lg:p-8 z-10 border border-white/10">
            <h3 className="text-2xl lg:text-4xl font-semibold text-white mb-3 leading-tight">
              {spotlightDesigners[1].title}
            </h3>
            <p className="text-sm lg:text-base text-white/80 leading-relaxed max-w-lg mb-5">
              {spotlightDesigners[1].description}
            </p>
            <a 
              href="#featured" 
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
            >
              <span>{spotlightDesigners[1].cta}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
