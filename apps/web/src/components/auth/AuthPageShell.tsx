import { type ReactNode } from 'react';

type AuthPageShellProps = {
  brandName: string;
  sectionLabel?: string;
  heroImage: string;
  heroImageFallback: string;
  heroAlt: string;
  heroCaption: string;
  heroSupportingText?: string;
  title: string;
  subtitle: string;
  topSlot?: ReactNode;
  rightFooterText?: string;
  children: ReactNode;
};

export default function AuthPageShell({
  brandName,
  sectionLabel = '',
  heroImage,
  heroImageFallback,
  heroAlt,
  heroCaption,
  heroSupportingText,
  title,
  subtitle,
  topSlot,
  rightFooterText = '© 2024 Zuri Karibu. All rights reserved.',
  children,
}: AuthPageShellProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        <div className="relative h-[320px] md:h-auto">
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1116]/78 via-[#0f1116]/28 to-[#0f1116]/15" />
          <div className="absolute left-8 top-8">
            <p className="text-[2rem] font-extrabold tracking-wide text-white sm:text-4xl">
              {String(brandName || 'ZURIKARIBU').toUpperCase()}
            </p>
            {sectionLabel ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-white/70">
                {sectionLabel}
              </p>
            ) : null}
          </div>
          <div className="absolute bottom-8 left-8 right-8">
            <p className="max-w-[18ch] text-4xl font-extrabold leading-[1.06] text-white sm:text-5xl">
              {heroCaption}
            </p>
            {heroSupportingText ? (
              <p className="mt-4 max-w-[38ch] text-lg leading-relaxed text-white/82">
                {heroSupportingText}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-320px)] flex-col bg-[#f7f7f7] px-6 py-8 sm:px-12 md:min-h-screen md:px-16 md:py-10">
          <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col">
            {topSlot ? <div className="mb-8">{topSlot}</div> : <div className="mb-2" />}
            <div>
              <h1 className="text-[2.9rem] font-bold leading-[1.04] tracking-tight text-[#141414]">{title}</h1>
              <p className="mt-3 text-lg text-[#565656]">{subtitle}</p>
            </div>
            <div className="mt-8 space-y-5">{children}</div>
            <p className="mt-auto pt-10 text-center text-xs text-[#999999]">{rightFooterText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
