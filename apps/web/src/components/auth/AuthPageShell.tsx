import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AuthPageShellProps = {
  brandName: string;
  sectionLabel?: string;
  heroImage: string;
  heroImageFallback: string;
  heroAlt: string;
  heroCaption: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function AuthPageShell({
  brandName,
  sectionLabel = 'Jenks Authentication',
  heroImage,
  heroImageFallback,
  heroAlt,
  heroCaption,
  title,
  subtitle,
  children,
}: AuthPageShellProps) {
  return (
    <div className="min-h-screen bg-[#f4f1ea] px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto grid max-w-[1240px] overflow-hidden rounded-[24px] border border-[#d8d2c5] bg-[#f8f5ef] shadow-[0_30px_70px_rgba(16,16,16,0.18)] md:grid-cols-[1.03fr_0.97fr]">
        <div className="relative min-h-[360px] border-b border-[#d8d2c5] md:min-h-[760px] md:border-b-0 md:border-r md:border-[#d8d2c5]">
          <img
            src={heroImage}
            alt={heroAlt}
            className="h-full w-full object-cover"
            onError={(event) => {
              if (event.currentTarget.src !== heroImageFallback) {
                event.currentTarget.src = heroImageFallback;
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1116]/80 via-[#0f1116]/35 to-[#0f1116]/15" />
          <div className="absolute left-6 top-6">
            <p className="text-4xl font-black tracking-tight text-[#f6f3ee] sm:text-5xl">{brandName}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-[#f6f3ee]/70">{sectionLabel}</p>
          </div>
          <p className="absolute bottom-6 left-6 right-6 font-serif text-3xl italic text-[#f6f3ee] sm:text-5xl">
            {heroCaption}
          </p>
        </div>

        <div className="bg-[#f7f4ed] px-5 py-8 sm:px-10 md:px-12 md:py-12">
          <div className="mx-auto w-full max-w-md">
            <Link to="/main" className="inline-flex text-sm font-semibold text-[#e85a3c] hover:text-[#c94b30]">
              Back to Home
            </Link>
            <div className="mt-3 border-b border-[#ddd6c8] pb-5">
              <p className="text-4xl font-black tracking-tight text-[#1a1917]">{brandName}</p>
              <h1 className="mt-4 text-[2.15rem] font-black leading-[1.05] tracking-tight text-[#141926]">{title}</h1>
              <p className="mt-2 text-sm text-[#5f5a52]">{subtitle}</p>
            </div>
            <div className="mt-6 space-y-5">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
