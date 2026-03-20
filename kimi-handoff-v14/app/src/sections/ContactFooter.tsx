import { useState } from 'react';
import { Instagram, Twitter, Facebook, Youtube, Mail, MapPin, Phone, ArrowRight } from 'lucide-react';

const footerLinks = {
  shop: [
    { label: 'Ready to Wear', href: '/ready-to-wear' },
    { label: 'Fabrics', href: '/fabrics' },
    { label: 'Custom to Wear', href: '/custom-to-wear' },
    { label: 'Accessories', href: '#' },
    { label: 'New Arrivals', href: '#' },
  ],
  discover: [
    { label: 'About Us', href: '#' },
    { label: 'Our Story', href: '#' },
    { label: 'Sustainability', href: '#' },
    { label: 'Artisans', href: '#' },
    { label: 'Press', href: '#' },
  ],
  support: [
    { label: 'Contact Us', href: '#' },
    { label: 'FAQs', href: '#' },
    { label: 'Shipping Info', href: '#' },
    { label: 'Returns', href: '#' },
    { label: 'Size Guide', href: '#' },
  ],
};

const socialLinks = [
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Youtube, href: '#', label: 'YouTube' },
];

export default function ContactFooter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  return (
    <footer className="bg-[var(--color-brand-secondary)] text-white" role="contentinfo">
      <div className="border-b border-white/10">
        <div className="container-main py-12 md:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div>
              <h3 className="font-display font-bold text-2xl md:text-3xl mb-2">Join the Movement</h3>
              <p className="text-white/60 max-w-md">Subscribe for exclusive drops, artisan stories, and early access to new collections.</p>
            </div>
            <form onSubmit={handleSubmit} className="flex gap-3 w-full lg:w-auto">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="flex-1 lg:w-80 px-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors" aria-label="Email address for newsletter" />
              <button type="submit" className="px-6 py-3 bg-[var(--color-brand-primary)] text-white font-medium hover:bg-[var(--color-brand-primary-hover)] transition-colors flex items-center gap-2 focus-ring">
                {subscribed ? 'Subscribed!' : 'Subscribe'}<ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
      <div className="container-main py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
            <h2 className="font-display font-extrabold text-2xl mb-4">ZURI KARIBU</h2>
            <p className="text-white/60 text-sm mb-6 max-w-xs">Made by Africans. Worn by the world. Connecting global audiences with authentic African fashion.</p>
            <div className="flex gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a key={social.label} href={social.href} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[var(--color-brand-primary)] transition-colors focus-ring" aria-label={social.label}>
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>
          <nav aria-label="Shop links">
            <h4 className="label-mono text-white/40 mb-4">Shop</h4>
            <ul className="space-y-3">
              {footerLinks.shop.map((link) => (
                <li key={link.label}><a href={link.href} className="text-white/70 hover:text-[var(--color-brand-primary)] transition-colors text-sm focus-ring">{link.label}</a></li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Discover links">
            <h4 className="label-mono text-white/40 mb-4">Discover</h4>
            <ul className="space-y-3">
              {footerLinks.discover.map((link) => (
                <li key={link.label}><a href={link.href} className="text-white/70 hover:text-[var(--color-brand-primary)] transition-colors text-sm focus-ring">{link.label}</a></li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Support links">
            <h4 className="label-mono text-white/40 mb-4">Support</h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.label}><a href={link.href} className="text-white/70 hover:text-[var(--color-brand-primary)] transition-colors text-sm focus-ring">{link.label}</a></li>
              ))}
            </ul>
          </nav>
          <div>
            <h4 className="label-mono text-white/40 mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-white/70 text-sm"><Mail className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>hello@zurikaribu.com</span></li>
              <li className="flex items-start gap-3 text-white/70 text-sm"><Phone className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>+1 (555) 123-4567</span></li>
              <li className="flex items-start gap-3 text-white/70 text-sm"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>Lagos, Nigeria</span></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-main py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">© 2025 Zuri Karibu. All rights reserved.</p>
          <nav className="flex gap-6" aria-label="Legal links">
            <a href="#" className="text-white/40 hover:text-white/70 text-sm transition-colors focus-ring">Privacy Policy</a>
            <a href="#" className="text-white/40 hover:text-white/70 text-sm transition-colors focus-ring">Terms of Service</a>
            <a href="#" className="text-white/40 hover:text-white/70 text-sm transition-colors focus-ring">Cookies</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
