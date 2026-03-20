import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronRight, Home } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface CategoryHeroProps {
  title: string;
  subtitle: string;
  image: string;
  breadcrumb: string[];
}

export default function CategoryHero({ title, subtitle, image, breadcrumb }: CategoryHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax effect on scroll
      gsap.to(imageRef.current, {
        yPercent: 20,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        }
      });

      // Content fade in
      gsap.fromTo(
        contentRef.current,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
          }
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={sectionRef}
      className="relative h-[70vh] min-h-[500px] overflow-hidden"
    >
      {/* Background Image */}
      <div 
        ref={imageRef}
        className="absolute inset-0 w-full h-[120%]"
      >
        <img 
          src={image} 
          alt={title}
          className="w-full h-full object-cover editorial-image"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#F8F6F1]" />
      </div>

      {/* Content */}
      <div 
        ref={contentRef}
        className="absolute inset-0 flex flex-col justify-end pb-16 px-8 md:px-[8vw]"
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-6">
          <a href="/" className="flex items-center gap-1 text-white/70 hover:text-white transition-colors text-sm">
            <Home className="w-4 h-4" />
            <span>Home</span>
          </a>
          {breadcrumb.map((item, index) => (
            <div key={item} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-white/40" />
              <span className={index === breadcrumb.length - 1 ? 'text-white text-sm' : 'text-white/70 text-sm'}>
                {item}
              </span>
            </div>
          ))}
        </nav>

        {/* Title */}
        <h1 className="headline-lg text-[clamp(40px,6vw,80px)] text-white mb-4">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-white/80 max-w-xl leading-relaxed">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
