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
  const cardsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (!cardsRef.current) return;
      const cards = cardsRef.current.querySelectorAll('.designer-card');
      gsap.fromTo(
        cards,
        { y: 0, opacity: 0.65, scale: 1.02 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.65,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top 78%',
            toggleActions: 'play none none reverse',
          }
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={sectionRef} 
      id="designers"
      className={`relative w-full h-[200svh] lg:h-screen overflow-hidden bg-[#F8F6F1] ${className}`}
    >
      <div ref={cardsRef} className="grid grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1 h-full w-full">
          {spotlightDesigners.map((designer) => (
            <article key={designer.id} className="designer-card relative h-full w-full overflow-hidden">
              <img
                src={designer.image}
                alt={designer.title}
                className="absolute inset-0 w-full h-full object-cover editorial-image"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

              <div className="absolute left-[6%] right-[6%] bottom-[6%] dark-panel p-6 md:p-8 z-10">
                <h3 className="headline-lg text-[clamp(26px,2.8vw,44px)] text-white mb-4">
                  {designer.title}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed max-w-xl mb-5">
                  {designer.description}
                </p>
                <a href="#spotlight" className="cta-button inline-flex">
                  <span>{designer.cta}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}
