import { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface ReadyToWearProps {
  className?: string;
}

export default function ReadyToWear({ className = '' }: ReadyToWearProps) {
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
      // Background image
      scrollTl.fromTo(
        imageRef.current,
        { scale: 1.10, x: '6vw', opacity: 0.6 },
        { scale: 1.00, x: 0, opacity: 1, ease: 'power2.out' },
        0
      );

      // Right panel
      scrollTl.fromTo(
        panelRef.current,
        { x: '40vw', opacity: 0 },
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
        { x: '12vw', opacity: 0, ease: 'power2.in' },
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
      id="ready-to-wear"
      className={`section-pinned bg-[#F8F6F1] ${className}`}
    >
      {/* Full-bleed Background Image */}
      <div 
        ref={imageRef}
        className="absolute inset-0 w-full h-full"
      >
        <img 
          src="/rw_full.jpg" 
          alt="Ready to wear African fashion"
          className="w-full h-full object-cover editorial-image"
        />
      </div>

      {/* Right-side Dark Panel */}
      <div 
        ref={panelRef}
        className="absolute left-[62vw] top-0 w-[38vw] h-full dark-panel"
      >
        <div className="absolute left-[4vw] top-[22vh] w-[28vw]">
          {/* Label */}
          <span 
            ref={labelRef}
            className="label-mono text-white/60 block mb-6"
          >
            READY TO WEAR
          </span>

          {/* Headline */}
          <h2 
            ref={headlineRef}
            className="headline-lg text-[clamp(28px,3.5vw,56px)] text-white mb-8"
          >
            <span className="word inline-block">Standardized</span>{' '}
            <span className="word inline-block">African</span>{' '}
            <span className="word inline-block">attire</span>{' '}
            <span className="word inline-block">made</span>{' '}
            <span className="word inline-block">to</span>{' '}
            <span className="word inline-block">buy.</span>
          </h2>

          {/* Body */}
          <p 
            ref={bodyRef}
            className="text-base text-white/70 leading-relaxed mb-10"
          >
            Curated fits built for real life — tailored enough to feel special, versatile enough to wear anywhere.
          </p>

          {/* CTA */}
          <Link 
            ref={ctaRef}
            to="/ready-to-wear" 
            className="cta-link group inline-flex items-center gap-2 text-white"
          >
            <span>Shop ready to wear</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
