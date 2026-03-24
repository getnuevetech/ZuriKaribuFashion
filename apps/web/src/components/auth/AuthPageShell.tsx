import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AuthPageShellProps = {
  brandName: string;
  heroImage: string;
  heroImageFallback: string;
  heroAlt: string;
  heroTitle: ReactNode;
  heroSubtitle?: ReactNode;
  pageTitle: string;
  pageSubtitle: string;
  topSlot?: ReactNode;
  brandHref?: string;
  footerText?: string;
  children: ReactNode;
};

export default function AuthPageShell({
  brandName,
  heroImage,
  heroImageFallback,
  heroAlt,
  heroTitle,
  heroSubtitle,
  pageTitle,
  pageSubtitle,
  topSlot,
  brandHref = '/',
  footerText = '© 2024 Zuri Karibu. All rights reserved.',
  children,
}: AuthPageShellProps) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e]/80 via-[#16213e]/60 to-transparent z-10" />
        <img
          src={heroImage}
          alt={heroAlt}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(event) => {
            if (event.currentTarget.src !== heroImageFallback) {
              event.currentTarget.src = heroImageFallback;
            }
          }}
        />
        <div className="relative z-20 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <Link to={brandHref} className="text-2xl font-bold tracking-wider">
              {String(brandName || 'ZURIKARIBU').toUpperCase()}
            </Link>
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-bold leading-tight">{heroTitle}</h2>
            {heroSubtitle ? <p className="text-white/80 max-w-md">{heroSubtitle}</p> : null}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#faf9f7]">
        <div className="lg:hidden p-6">
          <Link to={brandHref} className="text-2xl font-bold tracking-wider text-[#1a1a1a]">
            {String(brandName || 'ZURIKARIBU').toUpperCase()}
          </Link>
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24 py-12">
          <div className="max-w-lg w-full mx-auto space-y-8">
            {topSlot}
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-[#1a1a1a]">{pageTitle}</h1>
              <p className="text-base leading-relaxed text-[#666666]">{pageSubtitle}</p>
            </div>
            {children}
          </div>
        </div>

        <div className="py-6 text-center text-base text-[#999999]">{footerText}</div>
      </div>
    </div>
  );
}
