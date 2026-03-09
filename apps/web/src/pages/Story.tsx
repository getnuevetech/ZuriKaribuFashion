import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

const hasHtmlTag = (value: string) => /<\/?[a-z][\s\S]*>/i.test(String(value || ''));

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeHtmlForStory = (raw: string) => {
  const source = String(raw || '');
  if (!source.trim()) return '';
  if (!hasHtmlTag(source)) {
    return escapeHtml(source).replace(/\n/g, '<br/>');
  }
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(source, 'text/html');
  const allowedTags = new Set([
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'IMG', 'HR',
  ]);
  const isSafeUrl = (value: string, image = false) => {
    const url = String(value || '').trim().toLowerCase();
    if (!url) return false;
    if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return true;
    if (!image && (url.startsWith('mailto:') || url.startsWith('tel:'))) return true;
    if (image && url.startsWith('data:image/')) return true;
    return false;
  };
  const traverse = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toUpperCase();
      if (!allowedTags.has(tag)) {
        const parent = element.parentNode;
        if (parent) {
          while (element.firstChild) parent.insertBefore(element.firstChild, element);
          parent.removeChild(element);
          return;
        }
      } else {
        Array.from(element.attributes).forEach((attribute) => {
          const name = attribute.name.toLowerCase();
          const value = attribute.value;
          if (tag === 'A') {
            if (name === 'href' && isSafeUrl(value, false)) return;
            if (name === 'target' || name === 'rel') return;
            element.removeAttribute(attribute.name);
          } else if (tag === 'IMG') {
            if (name === 'src' && isSafeUrl(value, true)) return;
            if (name === 'alt' || name === 'title') return;
            element.removeAttribute(attribute.name);
          } else {
            element.removeAttribute(attribute.name);
          }
        });
        if (tag === 'A') {
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }
    Array.from(node.childNodes).forEach(traverse);
  };
  traverse(parsedDoc.body);
  return parsedDoc.body.innerHTML;
};

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
  const safeContentHtml = useMemo(() => sanitizeHtmlForStory(String(data?.content || '')), [data?.content]);

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
        <div
          className="prose prose-gray mt-8 max-w-none leading-8 prose-img:rounded-lg prose-img:max-h-[520px] prose-img:object-cover"
          dangerouslySetInnerHTML={{ __html: safeContentHtml }}
        />
      </div>
    </article>
  );
}
