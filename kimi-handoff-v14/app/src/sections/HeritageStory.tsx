import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface HeritageStoryProps {
  className?: string;
}

const stats = [
  { value: '120+', label: 'Countries' },
  { value: '50K+', label: 'Designers' },
  { value: '1M+', label: 'Fabrics' },
];

export default function HeritageStory({ className = '' }: HeritageStoryProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=140%',
          pin: true,
          scrub: 0.6,
        }
      });

      // ENTRANCE (0%-30%)
      // Background image
      scrollTl.fromTo(
        imageRef.current,
        { scale: 1.10, opacity: 0.6 },
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

      // Right text panel
      scrollTl.fromTo(
        textRef.current,
        { x: '40vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'power2.out' },
        0.05
      );

      // Stats
      if (statsRef.current) {
        const statItems = statsRef.current.querySelectorAll('.stat-item');
        scrollTl.fromTo(
          statItems,
          { y: '10vh', opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.04, ease: 'power2.out' },
          0.15
        );
      }

      // SETTLE (30%-70%): Hold

      // EXIT (70%-100%)
      scrollTl.fromTo(
        textRef.current,
        { x: 0, opacity: 1 },
        { x: '10vw', opacity: 0, ease: 'power2.in' },
        0.7
      );

      if (statsRef.current) {
        const statItems = statsRef.current.querySelectorAll('.stat-item');
        scrollTl.fromTo(
          statItems,
          { y: 0, opacity: 1 },
          { y: '8vh', opacity: 0, stagger: 0.02, ease: 'power2.in' },
          0.72
        );
      }

      scrollTl.fromTo(
        imageRef.current,
        { scale: 1, opacity: 1 },
        { scale: 1.06, opacity: 0.55, ease: 'power2.in' },
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
      id="about"
      className={`section-pinned bg-[#F8F6F1] ${className}`}
    >
      {/* Full-bleed Background Image */}
      <div 
        ref={imageRef}
        className="absolute inset-0 w-full h-full"
      >
        <img 
          src="/heritage_story.jpg" 
          alt="Heritage story"
          className="w-full h-full object-cover editorial-image"
        />
      </div>

      {/* Top-left Label */}
      <span 
        ref={labelRef}
        className="label-mono text-white/80 absolute left-[4vw] top-[6vh] z-10"
      >
        HERITAGE STORY
      </span>

      {/* Right-side Text Panel */}
      <div 
        ref={textRef}
        className="absolute left-[58vw] top-[18vh] w-[36vw] z-10"
        style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
      >
        <h2 className="headline-lg text-[clamp(34px,4vw,64px)] text-white mb-6">
          Rooted in culture.
        </h2>
        <p className="text-base text-white/80 leading-relaxed mb-8">
          The world is yet to experience Africa's fashion. We're building the bridge — connecting heritage craft to modern wardrobes everywhere.
        </p>
        <a 
          href="#story" 
          className="cta-link group inline-flex items-center gap-2 text-white"
        >
          <span>Read our story</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>

      {/* Stats (bottom-left) */}
      <div 
        ref={statsRef}
        className="absolute left-[6vw] top-[72vh] flex gap-12 z-10"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="stat-item">
            <span className="headline-lg text-[clamp(32px,3.5vw,56px)] text-white block">
              {stat.value}
            </span>
            <span className="label-mono text-white/60">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
