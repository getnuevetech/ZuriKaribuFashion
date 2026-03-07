import { Link } from 'react-router-dom';
import { Instagram, Facebook, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-black text-white py-16 lg:py-20">
      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-12">
          <div className="lg:col-span-2">
            <h3 className="font-['Oswald'] text-2xl font-bold mb-4">ZURIKARIBU</h3>
            <p className="text-white/60 mb-6 max-w-sm">
              Wear the story of Africa. Discover authentic fashion crafted by talented African designers.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <ul className="space-y-3">
              <li><Link to="/ready-to-wear" className="text-white/60 hover:text-white transition-colors text-sm">Ready To Wear</Link></li>
              <li><Link to="/custom-to-wear" className="text-white/60 hover:text-white transition-colors text-sm">Custom To Wear</Link></li>
              <li><Link to="/fabrics-to-sell" className="text-white/60 hover:text-white transition-colors text-sm">Fabrics To Sell</Link></li>
              <li><Link to="/ready-to-wear" className="text-white/60 hover:text-white transition-colors text-sm">New Arrivals</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link to="/about" className="text-white/60 hover:text-white transition-colors text-sm">About Us</Link></li>
              <li><Link to="/designers" className="text-white/60 hover:text-white transition-colors text-sm">Our Designers</Link></li>
              <li><Link to="/sustainability" className="text-white/60 hover:text-white transition-colors text-sm">Sustainability</Link></li>
              <li><Link to="/careers" className="text-white/60 hover:text-white transition-colors text-sm">Careers</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-3">
              <li><Link to="/contact" className="text-white/60 hover:text-white transition-colors text-sm">Contact Us</Link></li>
              <li><Link to="/faqs" className="text-white/60 hover:text-white transition-colors text-sm">FAQs</Link></li>
              <li><Link to="/shipping" className="text-white/60 hover:text-white transition-colors text-sm">Shipping Info</Link></li>
              <li><Link to="/returns" className="text-white/60 hover:text-white transition-colors text-sm">Returns</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 py-8 border-t border-white/10 mb-8">
          <p className="text-white/60 text-sm">hello@zurikaribu.com</p>
          <p className="text-white/60 text-sm">+1 (555) 123-4567</p>
          <p className="text-white/60 text-sm">Lagos, Nigeria</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-white/10">
          <p className="text-white/40 text-sm">© 2026 ZuriKaribu. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-white/40 hover:text-white text-sm transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-white/40 hover:text-white text-sm transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
