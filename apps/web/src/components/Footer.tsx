import { Facebook, Instagram, Mail, MapPin, Phone, Twitter } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { mapFooterContent } from '../mappers/homepage/footerMapper';

export default function Footer() {
  const { data: footerContent } = useQuery({
    queryKey: ['homepageFooterContent'],
    queryFn: async () => {
      const response = await api.homepageSections.getFooter();
      return response.success ? response.data : null;
    },
  });

  const mappedFooter = useMemo(() => mapFooterContent(footerContent), [footerContent]);

  return (
    <footer className="bg-black text-white py-16 lg:py-20">
      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-12">
          <div className="lg:col-span-2">
            <h3 className="font-['Oswald'] text-2xl font-bold mb-4">{mappedFooter.companyName.toUpperCase()}</h3>
            <p className="text-white/60 mb-6 max-w-sm">{mappedFooter.tagline}</p>
            <div className="flex items-center gap-4">
              <div className="flex gap-4">
                <a href={mappedFooter.socialLinks.instagram} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href={mappedFooter.socialLinks.facebook} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href={mappedFooter.socialLinks.twitter} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <ul className="space-y-3">
              {mappedFooter.menus.shop.map((item, index) => (
                <li key={`shop-${index}`}>
                  <a href={item.href} className="text-white/60 hover:text-white transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {mappedFooter.menus.company.map((item, index) => (
                <li key={`company-${index}`}>
                  <a href={item.href} className="text-white/60 hover:text-white transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-3">
              {mappedFooter.menus.support.map((item, index) => (
                <li key={`support-${index}`}>
                  <a href={item.href} className="text-white/60 hover:text-white transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 py-8 border-t border-white/10 mb-8">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Mail className="w-4 h-4" />
            <span>{mappedFooter.email}</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Phone className="w-4 h-4" />
            <span>{mappedFooter.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <MapPin className="w-4 h-4" />
            <span>{mappedFooter.address}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-white/10">
          <p className="text-white/40 text-sm">{mappedFooter.copyright}</p>
          <div className="flex gap-6">
            <a href={mappedFooter.policies.privacy.href} className="text-white/40 hover:text-white text-sm transition-colors">
              {mappedFooter.policies.privacy.label}
            </a>
            <a href={mappedFooter.policies.terms.href} className="text-white/40 hover:text-white text-sm transition-colors">
              {mappedFooter.policies.terms.label}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
