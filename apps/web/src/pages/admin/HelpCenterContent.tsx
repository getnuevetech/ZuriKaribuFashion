import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type HelpFaq = {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
};

type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  isActive: boolean;
  sortOrder: number;
};

type HelpContact = {
  id: string;
  label: string;
  value: string;
  type: 'EMAIL' | 'PHONE' | 'WHATSAPP' | 'LINK' | 'OTHER';
  isActive: boolean;
  sortOrder: number;
};

type AudienceContent = {
  heroTitle: string;
  heroSubtitle: string;
  supportHint: string;
  faqs: HelpFaq[];
  articles: HelpArticle[];
  contacts: HelpContact[];
};

type FormState = {
  customer: AudienceContent;
  vendor: AudienceContent;
};

const emptyAudience = (): AudienceContent => ({
  heroTitle: '',
  heroSubtitle: '',
  supportHint: '',
  faqs: [],
  articles: [],
  contacts: [],
});

const defaultState: FormState = {
  customer: emptyAudience(),
  vendor: emptyAudience(),
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function AdminHelpCenterContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeAudience, setActiveAudience] = useState<'customer' | 'vendor'>('customer');
  const [form, setForm] = useState<FormState>(defaultState);

  const audience = useMemo(() => form[activeAudience], [activeAudience, form]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.helpCenter.getAdminContent();
      setForm({
        customer: {
          ...emptyAudience(),
          ...(response?.data?.customer || {}),
          faqs: Array.isArray(response?.data?.customer?.faqs) ? response.data.customer.faqs : [],
          articles: Array.isArray(response?.data?.customer?.articles) ? response.data.customer.articles : [],
          contacts: Array.isArray(response?.data?.customer?.contacts) ? response.data.customer.contacts : [],
        },
        vendor: {
          ...emptyAudience(),
          ...(response?.data?.vendor || {}),
          faqs: Array.isArray(response?.data?.vendor?.faqs) ? response.data.vendor.faqs : [],
          articles: Array.isArray(response?.data?.vendor?.articles) ? response.data.vendor.articles : [],
          contacts: Array.isArray(response?.data?.vendor?.contacts) ? response.data.vendor.contacts : [],
        },
      });
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load Help Center content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patchAudience = (patch: Partial<AudienceContent>) => {
    setForm((prev) => ({
      ...prev,
      [activeAudience]: {
        ...prev[activeAudience],
        ...patch,
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        customer: form.customer,
        vendor: form.vendor,
      };
      const response = await api.helpCenter.updateAdminContent(payload);
      setMessage(response.message || 'Help Center content saved.');
      await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save Help Center content.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Help Center Content</h1>
          <p className="text-sm text-gray-600">
            Manage dynamic FAQs, knowledge articles, and support contacts for Customer and Seller/Designer help pages.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveAudience('customer')}
          className={`rounded-lg px-3 py-2 text-sm ${activeAudience === 'customer' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}
        >
          Customer Page
        </button>
        <button
          type="button"
          onClick={() => setActiveAudience('vendor')}
          className={`rounded-lg px-3 py-2 text-sm ${activeAudience === 'vendor' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}
        >
          Seller/Designer Page
        </button>
      </div>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Hero Section</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">Hero title</span>
            <input
              value={audience.heroTitle}
              onChange={(event) => patchAudience({ heroTitle: event.target.value })}
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">Support hint</span>
            <input
              value={audience.supportHint}
              onChange={(event) => patchAudience({ supportHint: event.target.value })}
              className="w-full rounded border px-3 py-2"
            />
          </label>
        </div>
        <label className="text-sm text-gray-700 block">
          <span className="mb-1 block">Hero subtitle</span>
          <textarea
            value={audience.heroSubtitle}
            onChange={(event) => patchAudience({ heroSubtitle: event.target.value })}
            rows={3}
            className="w-full rounded border px-3 py-2"
          />
        </label>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">FAQs</h2>
          <Button
            variant="outline"
            onClick={() =>
              patchAudience({
                faqs: [
                  ...audience.faqs,
                  { id: makeId('faq'), question: '', answer: '', isActive: true, sortOrder: audience.faqs.length + 1 },
                ],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add FAQ
          </Button>
        </div>
        <div className="space-y-3">
          {audience.faqs.map((faq, index) => (
            <div key={faq.id || `faq-${index}`} className="rounded-lg border p-3 space-y-2">
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_100px_auto]">
                <input
                  value={faq.question}
                  onChange={(event) =>
                    patchAudience({
                      faqs: audience.faqs.map((row, idx) => (idx === index ? { ...row, question: event.target.value } : row)),
                    })
                  }
                  placeholder="Question"
                  className="rounded border px-2 py-1 text-sm"
                />
                <input
                  value={faq.id}
                  onChange={(event) =>
                    patchAudience({
                      faqs: audience.faqs.map((row, idx) => (idx === index ? { ...row, id: event.target.value } : row)),
                    })
                  }
                  placeholder="ID"
                  className="rounded border px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={faq.sortOrder}
                  onChange={(event) =>
                    patchAudience({
                      faqs: audience.faqs.map((row, idx) =>
                        idx === index ? { ...row, sortOrder: Number(event.target.value || 0) } : row
                      ),
                    })
                  }
                  className="rounded border px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  onClick={() => patchAudience({ faqs: audience.faqs.filter((_row, idx) => idx !== index) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={faq.answer}
                onChange={(event) =>
                  patchAudience({
                    faqs: audience.faqs.map((row, idx) => (idx === index ? { ...row, answer: event.target.value } : row)),
                  })
                }
                placeholder="Answer"
                rows={3}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={faq.isActive}
                  onChange={(event) =>
                    patchAudience({
                      faqs: audience.faqs.map((row, idx) => (idx === index ? { ...row, isActive: event.target.checked } : row)),
                    })
                  }
                />
                Active
              </label>
            </div>
          ))}
          {audience.faqs.length === 0 ? <p className="text-sm text-gray-500">No FAQs yet.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Knowledge Articles</h2>
          <Button
            variant="outline"
            onClick={() =>
              patchAudience({
                articles: [
                  ...audience.articles,
                  { id: makeId('article'), title: '', summary: '', body: '', tags: [], isActive: true, sortOrder: audience.articles.length + 1 },
                ],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Article
          </Button>
        </div>
        <div className="space-y-3">
          {audience.articles.map((article, index) => (
            <div key={article.id || `article-${index}`} className="rounded-lg border p-3 space-y-2">
              <div className="grid gap-2 md:grid-cols-[1.5fr_1fr_100px_auto]">
                <input
                  value={article.title}
                  onChange={(event) =>
                    patchAudience({
                      articles: audience.articles.map((row, idx) => (idx === index ? { ...row, title: event.target.value } : row)),
                    })
                  }
                  placeholder="Article title"
                  className="rounded border px-2 py-1 text-sm"
                />
                <input
                  value={article.id}
                  onChange={(event) =>
                    patchAudience({
                      articles: audience.articles.map((row, idx) => (idx === index ? { ...row, id: event.target.value } : row)),
                    })
                  }
                  placeholder="ID"
                  className="rounded border px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={article.sortOrder}
                  onChange={(event) =>
                    patchAudience({
                      articles: audience.articles.map((row, idx) =>
                        idx === index ? { ...row, sortOrder: Number(event.target.value || 0) } : row
                      ),
                    })
                  }
                  className="rounded border px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  onClick={() => patchAudience({ articles: audience.articles.filter((_row, idx) => idx !== index) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input
                value={article.summary}
                onChange={(event) =>
                  patchAudience({
                    articles: audience.articles.map((row, idx) => (idx === index ? { ...row, summary: event.target.value } : row)),
                  })
                }
                placeholder="Summary"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <textarea
                value={article.body}
                onChange={(event) =>
                  patchAudience({
                    articles: audience.articles.map((row, idx) => (idx === index ? { ...row, body: event.target.value } : row)),
                  })
                }
                placeholder="Article body"
                rows={4}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                value={Array.isArray(article.tags) ? article.tags.join(', ') : ''}
                onChange={(event) =>
                  patchAudience({
                    articles: audience.articles.map((row, idx) =>
                      idx === index
                        ? {
                            ...row,
                            tags: event.target.value
                              .split(',')
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          }
                        : row
                    ),
                  })
                }
                placeholder="Tags (comma separated)"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={article.isActive}
                  onChange={(event) =>
                    patchAudience({
                      articles: audience.articles.map((row, idx) => (idx === index ? { ...row, isActive: event.target.checked } : row)),
                    })
                  }
                />
                Active
              </label>
            </div>
          ))}
          {audience.articles.length === 0 ? <p className="text-sm text-gray-500">No articles yet.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Support Contacts</h2>
          <Button
            variant="outline"
            onClick={() =>
              patchAudience({
                contacts: [
                  ...audience.contacts,
                  { id: makeId('contact'), label: '', value: '', type: 'EMAIL', isActive: true, sortOrder: audience.contacts.length + 1 },
                ],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
        <div className="space-y-3">
          {audience.contacts.map((contact, index) => (
            <div key={contact.id || `contact-${index}`} className="rounded-lg border p-3 space-y-2">
              <div className="grid gap-2 md:grid-cols-[1.2fr_1.2fr_150px_100px_auto]">
                <input
                  value={contact.label}
                  onChange={(event) =>
                    patchAudience({
                      contacts: audience.contacts.map((row, idx) => (idx === index ? { ...row, label: event.target.value } : row)),
                    })
                  }
                  placeholder="Label"
                  className="rounded border px-2 py-1 text-sm"
                />
                <input
                  value={contact.value}
                  onChange={(event) =>
                    patchAudience({
                      contacts: audience.contacts.map((row, idx) => (idx === index ? { ...row, value: event.target.value } : row)),
                    })
                  }
                  placeholder="Value"
                  className="rounded border px-2 py-1 text-sm"
                />
                <select
                  value={contact.type}
                  onChange={(event) =>
                    patchAudience({
                      contacts: audience.contacts.map((row, idx) =>
                        idx === index ? { ...row, type: event.target.value as HelpContact['type'] } : row
                      ),
                    })
                  }
                  className="rounded border px-2 py-1 text-sm"
                >
                  <option value="EMAIL">EMAIL</option>
                  <option value="PHONE">PHONE</option>
                  <option value="WHATSAPP">WHATSAPP</option>
                  <option value="LINK">LINK</option>
                  <option value="OTHER">OTHER</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={contact.sortOrder}
                  onChange={(event) =>
                    patchAudience({
                      contacts: audience.contacts.map((row, idx) =>
                        idx === index ? { ...row, sortOrder: Number(event.target.value || 0) } : row
                      ),
                    })
                  }
                  className="rounded border px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  onClick={() => patchAudience({ contacts: audience.contacts.filter((_row, idx) => idx !== index) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={contact.isActive}
                    onChange={(event) =>
                      patchAudience({
                        contacts: audience.contacts.map((row, idx) =>
                          idx === index ? { ...row, isActive: event.target.checked } : row
                        ),
                      })
                    }
                  />
                  Active
                </label>
              </div>
            </div>
          ))}
          {audience.contacts.length === 0 ? <p className="text-sm text-gray-500">No support contacts yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

