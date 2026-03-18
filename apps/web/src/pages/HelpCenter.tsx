import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronDown, HelpCircle, Mail, MessageCircle, Phone } from 'lucide-react';
import { api } from '../services/api';

function contactIcon(type: string) {
  const token = String(type || '').toUpperCase();
  if (token === 'PHONE') return <Phone className="h-4 w-4" />;
  if (token === 'WHATSAPP') return <MessageCircle className="h-4 w-4" />;
  return <Mail className="h-4 w-4" />;
}

function resolveContactHref(type: string, value: string) {
  const token = String(type || '').toUpperCase();
  const cleaned = String(value || '').trim();
  if (!cleaned) return '#';
  if (token === 'EMAIL') return `mailto:${cleaned}`;
  if (token === 'PHONE') return `tel:${cleaned}`;
  if (token === 'WHATSAPP') return `https://wa.me/${cleaned.replace(/[^\d]/g, '')}`;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return '#';
}

export default function HelpCenterPage() {
  const [openFaqId, setOpenFaqId] = useState<string>('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['help-center', 'customer'],
    queryFn: async () => {
      const response = await api.helpCenter.getPublic('CUSTOMER');
      return response.data;
    },
  });

  const firstFaqId = useMemo(() => (Array.isArray(data?.faqs) && data.faqs[0]?.id ? String(data.faqs[0].id) : ''), [data?.faqs]);

  useEffect(() => {
    if (!openFaqId && firstFaqId) setOpenFaqId(firstFaqId);
  }, [openFaqId, firstFaqId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Failed to load Help Center content. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <section className="rounded-2xl bg-gray-900 px-6 py-10 text-white sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Support</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{data.heroTitle}</h1>
        <p className="mt-3 max-w-3xl text-sm text-white/80 sm:text-base">{data.heroSubtitle}</p>
        <p className="mt-4 text-sm text-white/70">{data.supportHint}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-600" />
            <h2 className="text-xl font-semibold text-gray-900">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-2">
            {(Array.isArray(data.faqs) ? data.faqs : []).map((faq) => {
              const id = String(faq.id || '');
              const open = openFaqId === id;
              return (
                <div key={id} className="rounded-lg border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setOpenFaqId((prev) => (prev === id ? '' : id))}
                  >
                    <span className="text-sm font-medium text-gray-900">{faq.question}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open ? <div className="border-t px-4 py-3 text-sm text-gray-700">{faq.answer}</div> : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-600" />
            <h2 className="text-xl font-semibold text-gray-900">Support Contacts</h2>
          </div>
          <div className="space-y-3">
            {(Array.isArray(data.contacts) ? data.contacts : []).map((contact) => (
              <a
                key={String(contact.id || '')}
                href={resolveContactHref(contact.type, contact.value)}
                target={String(contact.type || '').toUpperCase() === 'LINK' ? '_blank' : undefined}
                rel={String(contact.type || '').toUpperCase() === 'LINK' ? 'noreferrer' : undefined}
                className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  {contactIcon(contact.type)}
                  <span>{contact.label}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{contact.value}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-amber-600" />
          <h2 className="text-xl font-semibold text-gray-900">Knowledge Articles</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(Array.isArray(data.articles) ? data.articles : []).map((article) => (
            <article key={String(article.id || '')} className="rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-gray-900">{article.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{article.summary}</p>
              <p className="mt-3 whitespace-pre-line text-xs leading-6 text-gray-700">{article.body}</p>
              {Array.isArray(article.tags) && article.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {article.tags.map((tag: string) => (
                    <span key={`${article.id}-${tag}`} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

