import { Link } from 'react-router-dom';

interface StaticPageProps {
  title: string;
  description: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

export default function StaticPage({
  title,
  description,
  primaryCtaLabel = 'Start Shopping',
  primaryCtaHref = '/ready-to-wear',
  secondaryCtaLabel = 'Contact Support',
  secondaryCtaHref = '/contact',
}: StaticPageProps) {
  return (
    <div className="min-h-[70vh] bg-gray-50 pt-28 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 md:p-10 shadow-sm">
        <p className="text-xs tracking-widest text-coral-500 font-semibold mb-3">ZURIKARIBU</p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
        <p className="mt-4 text-gray-600 leading-relaxed">{description}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={primaryCtaHref}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-coral-500 text-white font-medium hover:bg-coral-600 transition-colors"
          >
            {primaryCtaLabel}
          </Link>
          <Link
            to={secondaryCtaHref}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            {secondaryCtaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
