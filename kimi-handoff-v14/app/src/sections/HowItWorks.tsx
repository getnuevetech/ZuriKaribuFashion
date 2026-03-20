import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Search, Eye, Palette, CreditCard, CheckCircle, Truck } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface HowItWorksProps {
  className?: string;
}

const steps = [
  {
    number: '01',
    title: 'Discover',
    description: 'Browse curated designs from top African creators.',
    icon: Search,
  },
  {
    number: '02',
    title: 'Preview',
    description: 'Use virtual preview to visualize your look before checkout.',
    icon: Eye,
  },
  {
    number: '03',
    title: 'Select Fabric',
    description: 'Choose premium textiles that match your design perfectly.',
    icon: Palette,
  },
  {
    number: '04',
    title: 'Pay Securely',
    description: 'Checkout safely with trusted payment options.',
    icon: CreditCard,
  },
  {
    number: '05',
    title: 'Quality Assured',
    description: 'Every order is reviewed by QA before shipment.',
    icon: CheckCircle,
  },
  {
    number: '06',
    title: 'Receive',
    description: 'Track your order and receive it at your doorstep.',
    icon: Truck,
  },
];

export default function HowItWorks({ className = '' }: HowItWorksProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Title animation
      gsap.fromTo(
        titleRef.current,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: titleRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          }
        }
      );

      // Cards animation
      if (cardsRef.current) {
        const cards = cardsRef.current.querySelectorAll('.step-card');
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
              trigger: cardsRef.current,
              start: 'top 75%',
              toggleActions: 'play none none reverse',
            }
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={sectionRef} 
      className={`section-flowing bg-[#F8F6F1] py-24 md:py-32 ${className}`}
    >
      <div className="px-8 md:px-[8vw]">
        {/* Title Block */}
        <div ref={titleRef} className="mb-16">
          <h2 className="headline-lg text-[clamp(34px,4.2vw,72px)] text-[#1A1A1A] mb-4">
            HOW IT WORKS
          </h2>
          <p className="text-base text-[#6B6B6B] max-w-xl leading-relaxed">
            From first browse to final delivery — simple, transparent, and made for you.
          </p>
        </div>

        {/* Steps Grid */}
        <div 
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div 
                key={step.number}
                className="step-card p-8 group hover:border-[#E85A3C] transition-colors bg-white"
              >
                {/* Number */}
                <span className="label-mono text-[#E85A3C] block mb-4">
                  {step.number}
                </span>

                {/* Icon */}
                <div className="mb-4">
                  <Icon 
                    className="w-6 h-6 text-[#1A1A1A]/60 group-hover:text-[#E85A3C] transition-colors" 
                    strokeWidth={1.5} 
                  />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-[#6B6B6B] leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
