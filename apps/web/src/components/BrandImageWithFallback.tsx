import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { stripLegacyFallbackImage } from '../utils/imageFallback';

type BrandImageWithFallbackProps = {
  src?: string | null;
  alt: string;
  className?: string;
  spinnerClassName?: string;
};

export default function BrandImageWithFallback({
  src,
  alt,
  className = '',
  spinnerClassName = 'h-8 w-8',
}: BrandImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = useMemo(() => stripLegacyFallbackImage(src), [src]);
  const shouldRenderImage = normalizedSrc.length > 0 && !failed;

  if (shouldRenderImage) {
    return (
      <img
        src={normalizedSrc}
        alt={alt}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`${className} flex flex-col items-center justify-center gap-3 bg-[#0a0a0a] text-white`}>
      <Loader2 className={`${spinnerClassName} animate-spin text-[#e66045]`} />
      <p className="font-['Oswald'] text-2xl font-bold uppercase tracking-[0.08em] sm:text-3xl">
        ZURIKARIBU
      </p>
    </div>
  );
}
