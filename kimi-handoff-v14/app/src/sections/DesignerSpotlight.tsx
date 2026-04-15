import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface DesignerSpotlightProps {
  className?: string;
}

export default function DesignerSpotlight({ className = '' }: DesignerSpotlightProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
        }
      });

      // ENTRANCE (0%-30%)
      // Background image
      scrollTl.fromTo(
        imageRef.current,
        { scale: 1.08, opacity: 0.7 },
        { scale: 1.00, opacity: 1, ease: 'power2.out' },
        0
      );

      // Label
      scrollTl.fromTo(
        labelRef.current,
        { y: '-4vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'power2.out' },
        0.1
      );

      // Bottom panel
      scrollTl.fromTo(
        panelRef.current,
        { y: '35vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'power2.out' },
        0.1
      );

      // SETTLE (30%-70%): Hold

      // EXIT (70%-100%)
      scrollTl.fromTo(
        panelRef.current,
        { y: 0, opacity: 1 },
        { y: '12vh', opacity: 0, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        imageRef.current,
        { scale: 1, opacity: 1 },
        { scale: 1.05, opacity: 0.55, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        labelRef.current,
        { opacity: 1 },
        { opacity: 0, ease: 'power2.in' },
        0.75
      );

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={sectionRef} 
      id="designers"
      className={`section-pinned bg-[#F8F6F1] ${className}`}
    >
      {/* Full-bleed Background Image */}
      <div 
        ref={imageRef}
        className="absolute inset-0 w-full h-full"
      >
        <img 
          src="/designer_spotlight.jpg" 
          alt="Designer spotlight"
          className="w-full h-full object-cover editorial-image"
        />
      </div>

      {/* Top-left Label */}
      <span 
        ref={labelRef}
        className="label-mono text-white/80 absolute left-[4vw] top-[6vh] z-10"
      >
        DESIGNER SPOTLIGHT
      </span>

      {/* Bottom-center Panel */}
      <div 
        ref={panelRef}
        className="absolute left-[18vw] top-[68vh] w-[64vw] dark-panel p-8 z-10"
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h3 className="headline-lg text-[clamp(28px,3vw,48px)] text-white mb-4">
              Meet designers across Africa.
            </h3>
            <p className="text-sm text-white/70 leading-relaxed max-w-lg">
              Showcasing rotating talent from different countries — each piece carries a name, a place, and a story.
            </p>
          </div>
          <a 
            href="#spotlight" 
            className="cta-button flex-shrink-0"
          >
            <span>See the spotlight</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
