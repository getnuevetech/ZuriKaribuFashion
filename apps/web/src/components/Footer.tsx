import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, Phone, Twitter } from 'lucide-react';

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
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <ul className="space-y-3">
              <li><Link to="/ready-to-wear" className="text-white/60 hover:text-white transition-colors text-sm">Ready To Wear</Link></li>
              <li><Link to="/designs" className="text-white/60 hover:text-white transition-colors text-sm">Custom To Wear</Link></li>
              <li><Link to="/fabrics" className="text-white/60 hover:text-white transition-colors text-sm">Fabrics To Buy</Link></li>
              <li><Link to="/ready-to-wear" className="text-white/60 hover:text-white transition-colors text-sm">New Arrivals</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              <li><a href="/#about" className="text-white/60 hover:text-white transition-colors text-sm">About Us</a></li>
              <li><a href="/#designers" className="text-white/60 hover:text-white transition-colors text-sm">Our Designers</a></li>
              <li><Link to="/designs" className="text-white/60 hover:text-white transition-colors text-sm">Collections</Link></li>
              <li><Link to="/register" className="text-white/60 hover:text-white transition-colors text-sm">Create Account</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-3">
              <li><a href="mailto:hello@zurikaribu.com" className="text-white/60 hover:text-white transition-colors text-sm">Contact Us</a></li>
              <li><Link to="/cart" className="text-white/60 hover:text-white transition-colors text-sm">FAQs</Link></li>
              <li><Link to="/cart" className="text-white/60 hover:text-white transition-colors text-sm">Shipping Info</Link></li>
              <li><Link to="/cart" className="text-white/60 hover:text-white transition-colors text-sm">Returns</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 py-8 border-t border-white/10 mb-8">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Mail className="w-4 h-4" />
            <span>hello@zurikaribu.com</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Phone className="w-4 h-4" />
            <span>+1 (555) 123-4567</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <MapPin className="w-4 h-4" />
            <span>Lagos, Nigeria</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-white/10">
          <p className="text-white/40 text-sm">© 2026 ZuriKaribu. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Privacy Policy</a>
            <a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
