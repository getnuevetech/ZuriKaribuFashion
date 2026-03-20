import { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface FabricsToBuyProps {
  className?: string;
}

export default function FabricsToBuy({ className = '' }: FabricsToBuyProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=120%',
          pin: true,
          scrub: 0.6,
        }
      });

      // ENTRANCE (0%-30%)
      // Background image (from left this time)
      scrollTl.fromTo(
        imageRef.current,
        { scale: 1.10, x: '-6vw', opacity: 0.6 },
        { scale: 1.00, x: 0, opacity: 1, ease: 'power2.out' },
        0
      );

      // Left panel
      scrollTl.fromTo(
        panelRef.current,
        { x: '-40vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'power2.out' },
        0.05
      );

      // Label
      scrollTl.fromTo(
        labelRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, ease: 'power2.out' },
        0.1
      );

      // Headline words
      if (headlineRef.current) {
        const words = headlineRef.current.querySelectorAll('.word');
        scrollTl.fromTo(
          words,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.03, ease: 'power2.out' },
          0.12
        );
      }

      // Body
      scrollTl.fromTo(
        bodyRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, ease: 'power2.out' },
        0.2
      );

      // CTA
      scrollTl.fromTo(
        ctaRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, ease: 'power2.out' },
        0.25
      );

      // SETTLE (30%-70%): Hold

      // EXIT (70%-100%)
      scrollTl.fromTo(
        panelRef.current,
        { x: 0, opacity: 1 },
        { x: '-12vw', opacity: 0, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        imageRef.current,
        { scale: 1, opacity: 1 },
        { scale: 1.06, opacity: 0.55, ease: 'power2.in' },
        0.7
      );

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={sectionRef} 
      id="fabrics"
      className={`section-pinned bg-[#F8F6F1] ${className}`}
    >
      {/* Full-bleed Background Image */}
      <div 
        ref={imageRef}
        className="absolute inset-0 w-full h-full"
      >
        <img 
          src="/fabrics_full.jpg" 
          alt="African fabrics"
          className="w-full h-full object-cover editorial-image"
        />
      </div>

      {/* Left-side Dark Panel */}
      <div 
        ref={panelRef}
        className="absolute left-0 top-0 w-[38vw] h-full dark-panel"
      >
        <div className="absolute left-[6vw] top-[22vh] w-[28vw]">
          {/* Label */}
          <span 
            ref={labelRef}
            className="label-mono text-white/60 block mb-6"
          >
            FABRICS TO BUY
          </span>

          {/* Headline */}
          <h2 
            ref={headlineRef}
            className="headline-lg text-[clamp(28px,3.5vw,56px)] text-white mb-8"
          >
            <span className="word inline-block">African</span>{' '}
            <span className="word inline-block">fabrics</span>{' '}
            <span className="word inline-block">across</span>{' '}
            <span className="word inline-block">all</span>{' '}
            <span className="word inline-block">edges</span>{' '}
            <span className="word inline-block">of</span>{' '}
            <span className="word inline-block">Africa.</span>
          </h2>

          {/* Body */}
          <p 
            ref={bodyRef}
            className="text-base text-white/70 leading-relaxed mb-10"
          >
            Source the same textiles artisans use — wax prints, hand-dyed adire, woven kente, and more.
          </p>

          {/* CTA */}
          <Link 
            ref={ctaRef}
            to="/fabrics" 
            className="cta-link group inline-flex items-center gap-2 text-white"
          >
            <span>Browse fabrics</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
