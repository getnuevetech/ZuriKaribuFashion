import { useRef, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Instagram, Twitter, Facebook, Linkedin } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface ContactFooterProps {
  className?: string;
}

export default function ContactFooter({ className = '' }: ContactFooterProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const newsletterRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Newsletter animation
      gsap.fromTo(
        newsletterRef.current,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: newsletterRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          }
        }
      );

      // Footer columns animation
      if (footerRef.current) {
        const columns = footerRef.current.querySelectorAll('.footer-column');
        gsap.fromTo(
          columns,
          { y: 18, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: footerRef.current,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            }
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <section 
      ref={sectionRef} 
      className={`section-flowing bg-[var(--bg-secondary)] ${className}`}
    >
      {/* Newsletter Block */}
      <div 
        ref={newsletterRef}
        className="px-8 md:px-[8vw] py-24 md:py-32"
      >
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-12">
          <div className="max-w-xl">
            <h2 className="headline-lg text-[clamp(34px,4.2vw,72px)] text-[var(--text-primary)] mb-4">
              Join the movement.
            </h2>
            <p className="text-base text-[var(--text-secondary)] leading-relaxed">
              Subscribe for drops, designer stories, and early access to limited pieces.
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="w-full lg:w-auto">
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="px-6 py-4 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors w-full sm:w-80"
                disabled={subscribed}
              />
              <button 
                type="submit"
                className="cta-button bg-[var(--text-primary)] hover:bg-[var(--accent)] transition-colors"
                disabled={subscribed}
              >
                {subscribed ? (
                  <span>Subscribed!</span>
                ) : (
                  <>
                    <span>Subscribe</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer Block */}
      <footer 
        ref={footerRef}
        className="px-8 md:px-[8vw] py-16 border-t border-[var(--border)] bg-[var(--bg-primary)]"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="footer-column">
            <span className="font-display font-bold text-lg tracking-[0.2em] text-[var(--text-primary)] block mb-4">
              ZURIKARIBU
            </span>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
              Made by Africans, worn by the world.
            </p>
            {/* Social Icons */}
            <div className="flex gap-4">
              <a href="#instagram" className="text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                <Instagram className="w-5 h-5" strokeWidth={1.5} />
              </a>
              <a href="#twitter" className="text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                <Twitter className="w-5 h-5" strokeWidth={1.5} />
              </a>
              <a href="#facebook" className="text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                <Facebook className="w-5 h-5" strokeWidth={1.5} />
              </a>
              <a href="#linkedin" className="text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                <Linkedin className="w-5 h-5" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Shop Column */}
          <div className="footer-column">
            <span className="label-mono text-[var(--text-secondary)] block mb-4">SHOP</span>
            <ul className="space-y-3">
              {['Ready To Wear', 'Custom To Wear', 'Fabrics To Buy', 'New Arrivals'].map((item) => (
                <li key={item}>
                  <Link 
                    to={`/${item.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-sm text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div className="footer-column">
            <span className="label-mono text-[var(--text-secondary)] block mb-4">COMPANY</span>
            <ul className="space-y-3">
              {['About Us', 'Our Designers', 'Sustainability', 'Careers'].map((item) => (
                <li key={item}>
                  <a 
                    href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-sm text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Column */}
          <div className="footer-column">
            <span className="label-mono text-[var(--text-secondary)] block mb-4">SUPPORT</span>
            <ul className="space-y-3">
              {['Contact Us', 'Shipping & Returns', 'FAQs', 'Size Guide'].map((item) => (
                <li key={item}>
                  <a 
                    href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-sm text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <p className="text-sm text-[var(--text-secondary)]">help@zurikaribu.com</p>
              <p className="text-sm text-[var(--text-secondary)]">+1 (555) 013-2247</p>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pt-8 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-secondary)] mb-4 md:mb-0">
            © 2026 ZuriKaribu - African Fashion Global Network. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#privacy" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Privacy Policy
            </a>
            <a href="#terms" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </section>
  );
}
