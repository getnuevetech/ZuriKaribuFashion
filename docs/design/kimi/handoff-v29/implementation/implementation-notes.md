# Implementation Notes

## Technical Stack Recommendations

### Frontend Framework
- **Primary:** Next.js 14+ (App Router)
- **Alternative:** React 18+ with Vite
- **Styling:** Tailwind CSS 3.4+
- **Components:** shadcn/ui or Radix UI primitives

### CMS Integration
- **Headless CMS:** Sanity, Contentful, or Strapi
- **API:** REST or GraphQL
- **Webhooks:** For cache invalidation

### Performance
- **Images:** Next.js Image component with WebP
- **Fonts:** next/font for optimization
- **Analytics:** Vercel Analytics or Plausible

---

## Theme Integration

### CSS Class Approach (Confirmed)

```html
<!-- Light mode (default) -->
<html lang="en">

<!-- Dark mode -->
<html lang="en" class="dark">
```

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#E85A3C',
          dark: '#D14A2C',
          light: '#F07058',
        },
        background: {
          primary: '#FFFFFF',
          secondary: '#F8F7F5',
          dark: '#1A1A1A',
        },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
};
```

### Theme Toggle Implementation

```typescript
// hooks/useTheme.ts
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  return { theme, setTheme };
}
```

---

## Route Aliases

### Critical Alias: /custom → /designs

```typescript
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/custom',
        destination: '/designs',
      },
      {
        source: '/custom/:path*',
        destination: '/designs/:path*',
      },
    ];
  },
};
```

### Navigation Links (Always use /custom)

```typescript
// components/Navigation.tsx
const navLinks = [
  { label: 'Shop', href: '#shop' },
  { label: 'Ready-to-Wear', href: '#ready-to-wear' },
  { label: 'Fabrics', href: '#fabrics' },
  { label: 'Custom', href: '/custom' },  // ← Uses alias
  { label: 'Designers', href: '#designers' },
  { label: 'About', href: '#about' },
];
```

---

## CMS Schema Mapping

### Endpoint-Agnostic Pattern

```typescript
// lib/cms/types.ts
interface CMSProduct {
  id: string;
  name: string;
  price: number;
  // ... other fields
}

// lib/cms/adapters/sanity.ts
export const sanityAdapter = {
  async getProducts(): Promise<CMSProduct[]> {
    const data = await sanityClient.fetch(`
      *[_type == "product"] {
        "id": _id,
        "name": title,
        "price": defaultPrice,
        // ...
      }
    `);
    return data.map(mapSanityProduct);
  },
};

// lib/cms/index.ts
export const cms = sanityAdapter; // Swap adapter here
```

### Field Mapping Table

| Contract Field | Sanity | Contentful | Strapi |
|----------------|--------|------------|--------|
| product.id | `_id` | `sys.id` | `id` |
| product.name | `title` | `fields.name` | `name` |
| product.price | `defaultPrice` | `fields.price` | `price` |
| image.url | `image.asset->url` | `fields.image.fields.file.url` | `image.url` |

---

## Component Architecture

### Section Components

```typescript
// app/sections/Hero.tsx
interface HeroProps {
  headline: string;
  subheadline: string;
  cta: { label: string; href: string };
  backgroundImage: string;
}

export function Hero({ headline, subheadline, cta, backgroundImage }: HeroProps) {
  return (
    <section className="hero-section">
      {/* Implementation */}
    </section>
  );
}
```

### CMS-Driven Sections

```typescript
// app/page.tsx
import { cms } from '@/lib/cms';
import { Hero } from './sections/Hero';

export default async function HomePage() {
  const heroData = await cms.getHero();
  
  return (
    <main>
      <Hero {...heroData} />
      {/* Other sections */}
    </main>
  );
}
```

---

## Performance Optimization

### Image Optimization

```typescript
// next.config.js
module.exports = {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
};
```

```typescript
// Component usage
import Image from 'next/image';

<Image
  src="/images/hero_model.jpg"
  alt="Model wearing African fashion"
  width={1920}
  height={1080}
  priority  // For above-fold images
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

### Font Loading

```typescript
// app/layout.tsx
import { Inter, Playfair_Display } from 'next/font/google';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({ 
  subsets: ['latin'],
  variable: '--font-playfair',
});

export default function RootLayout({ children }) {
  return (
    <html className={`${inter.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

### Code Splitting

```typescript
// Lazy load below-fold sections
import dynamic from 'next/dynamic';

const DesignersSection = dynamic(
  () => import('./sections/Designers'),
  { loading: () => <SectionSkeleton /> }
);
```

---

## Animation Implementation

### Scroll-Triggered Animations

```typescript
// hooks/useInView.ts
import { useEffect, useRef, useState } from 'react';

export function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.2, ...options });
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  
  return { ref, isInView };
}
```

```typescript
// Component usage
export function AnimatedSection({ children }) {
  const { ref, isInView } = useInView();
  
  return (
    <section
      ref={ref}
      className={`transition-all duration-600 ${
        isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {children}
    </section>
  );
}
```

### CSS Animation Classes

```css
/* tokens/animations.css */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

/* Stagger delays */
.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
.stagger-4 { animation-delay: 0.4s; }
```

---

## Error Handling

### Error Boundaries

```typescript
// components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### CMS Error Fallback

```typescript
// components/CMSFallback.tsx
export function CMSFallback({ sectionName }: { sectionName: string }) {
  return (
    <div className="p-8 text-center">
      <p className="text-muted">
        Unable to load {sectionName}. Please try again later.
      </p>
    </div>
  );
}
```

---

## Testing Checklist

### Visual Regression
- [ ] All sections render correctly
- [ ] Responsive breakpoints match specs
- [ ] Dark mode toggles correctly
- [ ] Animations work as specified

### Functional
- [ ] Navigation scrolls to sections
- [ ] Mobile menu opens/closes
- [ ] Form validation works
- [ ] Cart functionality works

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Color contrast passes WCAG
- [ ] Focus indicators visible

### Performance
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1

---

## Deployment Checklist

### Pre-Deploy
- [ ] All contracts reviewed
- [ ] CMS content populated
- [ ] Images optimized
- [ ] Environment variables set

### Post-Deploy
- [ ] Sitemap generated
- [ ] Robots.txt configured
- [ ] Analytics connected
- [ ] SSL certificate active
