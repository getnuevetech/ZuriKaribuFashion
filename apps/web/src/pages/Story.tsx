import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

export default function StoryPage() {
  const { slug = '' } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['story', slug],
    queryFn: async () => {
      const response = await api.blogs.getBySlug(slug);
      return response.success ? response.data : null;
    },
    enabled: slug.trim().length > 0,
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading story...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8">
          <h1 className="text-2xl font-bold text-gray-900">Story not found</h1>
          <p className="mt-3 text-gray-600">The story link may be unpublished or no longer available.</p>
        </div>
      </div>
    );
  }

  return (
    <article className="w-full px-4 sm:px-6 lg:px-12 xl:px-20 py-12 lg:py-16">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>

      <div className="mx-auto mt-8 max-w-4xl">
        {data.coverImage ? (
          <img src={data.coverImage} alt={data.title} className="w-full rounded-xl object-cover max-h-[480px]" />
        ) : null}
        <h1 className="mt-6 text-3xl md:text-4xl font-bold text-gray-900">{data.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="rounded border border-gray-300 px-2 py-1">{String(data.audienceType || 'OTHER')}</span>
          {data.targetName ? <span className="rounded border border-gray-300 px-2 py-1">{data.targetName}</span> : null}
          {data.publishedAt ? (
            <span className="rounded border border-gray-300 px-2 py-1">
              {new Date(data.publishedAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        {data.excerpt ? <p className="mt-6 text-lg text-gray-700">{data.excerpt}</p> : null}
        <div className="mt-8 whitespace-pre-wrap leading-8 text-gray-800">{data.content}</div>
      </div>
    </article>
  );
}
