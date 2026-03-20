import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface FeaturedCustomProps {
  className?: string;
}

export default function FeaturedCustom({ className = '' }: FeaturedCustomProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const leftImageRef = useRef<HTMLDivElement>(null);
  const rightImageRef = useRef<HTMLDivElement>(null);
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
      // Left image
      scrollTl.fromTo(
        leftImageRef.current,
        { x: '-60vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'power2.out' },
        0
      );

      // Right image
      scrollTl.fromTo(
        rightImageRef.current,
        { x: '60vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'power2.out' },
        0
      );

      // Label
      scrollTl.fromTo(
        labelRef.current,
        { y: '-6vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'power2.out' },
        0.1
      );

      // Bottom panel
      scrollTl.fromTo(
        panelRef.current,
        { y: '30vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'power2.out' },
        0.1
      );

      // SETTLE (30%-70%): Hold

      // EXIT (70%-100%)
      scrollTl.fromTo(
        [leftImageRef.current, rightImageRef.current],
        { scale: 1, opacity: 1 },
        { scale: 1.05, opacity: 0.6, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        panelRef.current,
        { y: 0, opacity: 1 },
        { y: '12vh', opacity: 0, ease: 'power2.in' },
        0.72
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
      className={`section-pinned bg-[#F8F6F1] ${className}`}
    >
      {/* Left Image */}
      <div 
        ref={leftImageRef}
        className="absolute left-0 top-0 w-1/2 h-full"
      >
        <img 
          src="/featured_custom_left.jpg" 
          alt="Custom fashion left"
          className="w-full h-full object-cover editorial-image"
        />
      </div>

      {/* Right Image */}
      <div 
        ref={rightImageRef}
        className="absolute right-0 top-0 w-1/2 h-full"
      >
        <img 
          src="/featured_custom_right.jpg" 
          alt="Custom fashion right"
          className="w-full h-full object-cover editorial-image"
        />
      </div>

      {/* Top-left Label */}
      <span 
        ref={labelRef}
        className="label-mono text-white/80 absolute left-[4vw] top-[6vh] z-10"
      >
        FEATURED / CUSTOM TO WEAR
      </span>

      {/* Bottom-right Text Panel */}
      <div 
        ref={panelRef}
        className="absolute left-[58vw] top-[62vh] w-[36vw] dark-panel p-8 z-10"
      >
        <h3 className="headline-lg text-[clamp(24px,2.5vw,40px)] text-white mb-4">
          Made to fit by an African, with love.
        </h3>
        <p className="text-sm text-white/70 leading-relaxed mb-6">
          Work one-on-one with a maker. Adjust length, neckline, sleeves — and make it unmistakably yours.
        </p>
        <a 
          href="#explore-custom" 
          className="cta-link group inline-flex items-center gap-2 text-white"
        >
          <span>Explore custom</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>
    </section>
  );
}
