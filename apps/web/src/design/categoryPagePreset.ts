export type CategoryPageDesignPreset = 'STANDARD' | 'EDITORIAL' | 'MINIMAL';

export const CATEGORY_PAGE_DESIGN_PRESET_OPTIONS: Array<{
  value: CategoryPageDesignPreset;
  label: string;
  description: string;
}> = [
  {
    value: 'STANDARD',
    label: 'Standard',
    description: 'Balanced product typography and call-to-action emphasis.',
  },
  {
    value: 'EDITORIAL',
    label: 'Editorial',
    description: 'Bolder visual hierarchy for storytelling and premium look.',
  },
  {
    value: 'MINIMAL',
    label: 'Minimal',
    description: 'Cleaner and lighter typography for compact layouts.',
  },
];

const clampTitleSize = (size: number) => Math.max(16, Math.min(64, Math.round(size)));

export const resolveRotatingTitlePresentation = (
  preset: CategoryPageDesignPreset | string | undefined,
  baseSize: number
) => {
  const normalizedPreset = String(preset || 'STANDARD').trim().toUpperCase() as CategoryPageDesignPreset;
  const safeBase = clampTitleSize(baseSize);
  if (normalizedPreset === 'EDITORIAL') {
    return {
      fontSize: clampTitleSize(Math.round(safeBase * 1.12)),
      titleClassName: 'font-semibold leading-tight tracking-wide',
      ctaClassName: 'inline-flex bg-white px-3 py-1.5 text-xs font-bold text-black',
      priceClassName: 'mt-1 font-extrabold leading-none text-[1.35rem]',
    };
  }
  if (normalizedPreset === 'MINIMAL') {
    return {
      fontSize: clampTitleSize(Math.round(safeBase * 0.9)),
      titleClassName: 'font-medium leading-snug',
      ctaClassName: 'inline-flex border border-white/70 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white',
      priceClassName: 'mt-1 font-bold leading-none text-[1.2rem]',
    };
  }
  return {
    fontSize: safeBase,
    titleClassName: 'font-semibold leading-tight',
    ctaClassName: 'inline-flex bg-white px-3 py-1.5 text-xs font-semibold text-black',
    priceClassName: 'mt-1 font-extrabold leading-none text-[1.3rem]',
  };
};

