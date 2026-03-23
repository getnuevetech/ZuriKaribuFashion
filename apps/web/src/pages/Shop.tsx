import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

type ShopCategoryItem = {
  id: string;
  title: string;
  description: string;
  image: string;
  ctaLink: string;
};

const asText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

const FALLBACK_CATEGORIES: ShopCategoryItem[] = [
  {
    id: 'ready-to-wear',
    title: 'Ready To Wear',
    description: 'Standard sizes with premium finishing and immediate purchase.',
    image: '/kimi/rw_full.jpg',
    ctaLink: '/ready-to-wear',
  },
  {
    id: 'custom-to-wear',
    title: 'Custom To Wear',
    description: 'Made-to-measure pieces produced by African designers.',
    image: '/kimi/custom_full.jpg',
    ctaLink: '/custom',
  },
  {
    id: 'fabrics-to-buy',
    title: 'Fabrics To Buy',
    description: 'Source artisan fabrics and heritage textiles from across Africa.',
    image: '/kimi/fabrics_full.jpg',
    ctaLink: '/fabrics',
  },
];

export default function ShopPage() {
  const { data: categoriesData } = useQuery({
    queryKey: ['homepageCategoriesShopHub'],
    queryFn: async () => {
      const response = await api.homepageSections.getCategories();
      return response.success ? response.data : null;
    },
  });

  const categories = useMemo<ShopCategoryItem[]>(
    () =>
      (Array.isArray(categoriesData) && categoriesData.length > 0 ? categoriesData : FALLBACK_CATEGORIES)
        .slice(0, 3)
        .map((item: any, index: number) => {
          const fallback = FALLBACK_CATEGORIES[index % FALLBACK_CATEGORIES.length];
          return {
            id: String(item.id ?? fallback.id),
            title: asText(item.title, fallback.title),
            description: asText(item.description, item.subtitle, fallback.description),
            image: asText(item.image, fallback.image),
            ctaLink: asText(item.ctaLink, item.link, fallback.ctaLink),
          };
        }),
    [categoriesData]
  );

  return (
    <div className="min-h-screen bg-white py-24">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold tracking-[0.28em] text-gray-500">SHOP</p>
          <h1 className="mt-3 font-['Oswald'] text-4xl font-bold text-gray-900 sm:text-5xl">Discover African Fashion</h1>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600">
            Browse all three core categories in one place, then continue to detailed product discovery and checkout.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={category.ctaLink}
              className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={category.image}
                  alt={category.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <h2 className="font-['Oswald'] text-2xl font-bold">{category.title}</h2>
                <p className="mt-2 text-sm text-white/85">{category.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                  Shop now <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Link
            to="/ready-to-wear"
            className="group rounded-xl border border-gray-200 bg-gray-50 p-6 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            <p className="text-xs font-semibold tracking-[0.24em] text-gray-500">ROW 2</p>
            <h3 className="mt-2 text-2xl font-semibold text-gray-900">Fresh Drops</h3>
            <p className="mt-2 text-sm text-gray-600">
              Fast access to latest ready-to-wear arrivals for conversion-focused shoppers.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
              View arrivals <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
          <Link
            to="/custom"
            className="group rounded-xl border border-gray-200 bg-gray-50 p-6 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            <p className="text-xs font-semibold tracking-[0.24em] text-gray-500">ROW 2</p>
            <h3 className="mt-2 text-2xl font-semibold text-gray-900">Designer Spotlight</h3>
            <p className="mt-2 text-sm text-gray-600">
              Jump straight to signature creators for story-led discovery without sacrificing shopping utility.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
              Explore designers <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
