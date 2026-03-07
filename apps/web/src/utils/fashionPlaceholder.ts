type FashionFallbackOptions = {
  width?: number;
  height?: number;
  label?: string;
  subtitle?: string;
};

const PALETTES = [
  { start: '#1F2937', end: '#111827', accent: '#F97316' },
  { start: '#0F766E', end: '#115E59', accent: '#FB923C' },
  { start: '#7C2D12', end: '#431407', accent: '#FDBA74' },
  { start: '#4C1D95', end: '#312E81', accent: '#FB7185' },
  { start: '#1E3A8A', end: '#1E1B4B', accent: '#F59E0B' },
];

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function toTitleCase(value: string) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function escapeXml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function deriveTitle(seed: string) {
  const cleaned = toTitleCase(seed).replace(/\b(Product|Image|Upload|Hero|Thumb)\b/gi, '').trim();
  if (!cleaned) return 'ZuriKaribu';
  return cleaned.length > 34 ? `${cleaned.slice(0, 34)}...` : cleaned;
}

export function fashionFallbackImage(seed: string, options: FashionFallbackOptions = {}) {
  const width = Math.max(320, Number(options.width || 1200));
  const height = Math.max(320, Number(options.height || 1600));
  const normalizedSeed = String(seed || 'african-fashion').trim().toLowerCase();
  const palette = PALETTES[hashString(normalizedSeed) % PALETTES.length];
  const title = escapeXml(options.label || deriveTitle(seed));
  const subtitle = escapeXml(options.subtitle || 'ZuriKaribu Marketplace');
  const grainCount = 6;
  const grain = Array.from({ length: grainCount })
    .map((_, index) => {
      const top = Math.round((index / grainCount) * height);
      const opacity = 0.03 + ((index + 1) % 3) * 0.015;
      return `<rect x="0" y="${top}" width="${width}" height="${Math.round(height / grainCount)}" fill="#FFFFFF" opacity="${opacity.toFixed(
        3
      )}" />`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.start}" />
        <stop offset="100%" stop-color="${palette.end}" />
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.08" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" />
    ${grain}
    <circle cx="${Math.round(width * 0.84)}" cy="${Math.round(height * 0.18)}" r="${Math.round(width * 0.1)}" fill="${
      palette.accent
    }" opacity="0.26" />
    <circle cx="${Math.round(width * 0.12)}" cy="${Math.round(height * 0.78)}" r="${Math.round(width * 0.15)}" fill="${
      palette.accent
    }" opacity="0.18" />
    <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.12)}" width="${Math.round(width * 0.84)}" height="${Math.round(
      height * 0.76
    )}" rx="${Math.round(width * 0.03)}" fill="url(#card)" stroke="rgba(255,255,255,0.18)" />
    <text x="50%" y="${Math.round(height * 0.44)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(
      width * 0.06
    )}" font-weight="700" fill="#FFFFFF" letter-spacing="1">ZURIKARIBU</text>
    <text x="50%" y="${Math.round(height * 0.51)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(
      width * 0.037
    )}" font-weight="600" fill="${palette.accent}">${title}</text>
    <text x="50%" y="${Math.round(height * 0.58)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(
      width * 0.024
    )}" fill="#E5E7EB">${subtitle}</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
