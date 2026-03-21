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
      if (!cards.length) return;

      // Keep spotlight panels anchored to avoid perceived top gaps.
      gsap.set(cards, { opacity: 0 });
      gsap.to(cards, {
        opacity: 1,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 78%',
          toggleActions: 'play none none reverse',
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const leftDesigner = spotlightDesigners[0];
  const rightDesigner = spotlightDesigners[1];

  return (
    <section 
      ref={sectionRef} 
      id="designers"
      className={`relative w-full bg-[#F8F6F1] ${className}`}
    >
      <div className="flex flex-col lg:flex-row w-full min-h-screen">
        <article
          ref={leftCardRef}
          className="designer-card relative w-full lg:w-1/2 h-[60vh] lg:h-screen overflow-hidden"
        >
          <img
            src={leftDesigner.image}
            alt={leftDesigner.title}
            className="absolute inset-0 w-full h-full object-cover editorial-image"
            onError={(event) => {
              // Avoid broken-image icon if asset path is unavailable at runtime.
              (event.currentTarget as HTMLImageElement).style.opacity = '0';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

          <div className="absolute left-[6%] right-[6%] bottom-[6%] dark-panel p-6 md:p-8 z-10">
            <h3 className="headline-lg text-[clamp(26px,2.8vw,44px)] text-white mb-4">
              {leftDesigner.title}
            </h3>
            <p className="text-sm text-white/70 leading-relaxed max-w-xl mb-5">
              {leftDesigner.description}
            </p>
            <a href="#spotlight" className="cta-button inline-flex">
              <span>{leftDesigner.cta}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </article>

        <article
          ref={rightCardRef}
          className="designer-card relative w-full lg:w-1/2 h-[60vh] lg:h-screen overflow-hidden"
        >
          <img
            src={rightDesigner.image}
            alt={rightDesigner.title}
            className="absolute inset-0 w-full h-full object-cover editorial-image"
            onError={(event) => {
              // Avoid broken-image icon if asset path is unavailable at runtime.
              (event.currentTarget as HTMLImageElement).style.opacity = '0';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

          <div className="absolute left-[6%] right-[6%] bottom-[6%] dark-panel p-6 md:p-8 z-10">
            <h3 className="headline-lg text-[clamp(26px,2.8vw,44px)] text-white mb-4">
              {rightDesigner.title}
            </h3>
            <p className="text-sm text-white/70 leading-relaxed max-w-xl mb-5">
              {rightDesigner.description}
            </p>
            <a href="#spotlight" className="cta-button inline-flex">
              <span>{rightDesigner.cta}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
