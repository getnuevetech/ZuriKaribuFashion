import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

type BlogAudienceType = 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  audienceType: BlogAudienceType;
  targetName?: string | null;
  targetEntityId?: string | null;
  coverImage?: string | null;
  isPublished: boolean;
  link: string;
  updatedAt: string;
}

const audienceLabels: Record<BlogAudienceType, string> = {
  SELLER: 'Seller',
  DESIGNER: 'Designer',
  COUNTRY: 'Country',
  OTHER: 'Other',
};

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);

export default function AdminBlogs() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    audienceType: 'OTHER' as BlogAudienceType,
    targetName: '',
    targetEntityId: '',
    coverImage: '',
    isPublished: false,
  });

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const blogLinkPreview = useMemo(() => {
    const slug = slugify(form.slug || form.title);
    return slug ? `${siteOrigin}/stories/${slug}` : '';
  }, [form.slug, form.title, siteOrigin]);

  useEffect(() => {
    void fetchBlogs();
  }, [audienceFilter, statusFilter]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const response = await api.blogs.getAdminBlogs({
        search: search || undefined,
        audienceType: audienceFilter || undefined,
        status: (statusFilter as 'PUBLISHED' | 'DRAFT') || undefined,
      });
      if (response.success) {
        setBlogs(Array.isArray(response.data) ? response.data : []);
      }
    } catch (fetchError) {
      console.error('Failed to fetch blogs:', fetchError);
      setError('Failed to load blogs.');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      audienceType: 'OTHER',
      targetName: '',
      targetEntityId: '',
      coverImage: '',
      isPublished: false,
    });
    setShowModal(true);
  };

  const openEditModal = (blog: BlogPost) => {
    setEditing(blog);
    setForm({
      title: blog.title || '',
      slug: blog.slug || '',
      excerpt: blog.excerpt || '',
      content: blog.content || '',
      audienceType: blog.audienceType || 'OTHER',
      targetName: blog.targetName || '',
      targetEntityId: blog.targetEntityId || '',
      coverImage: blog.coverImage || '',
      isPublished: Boolean(blog.isPublished),
    });
    setShowModal(true);
  };

  const saveBlog = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        excerpt: form.excerpt || undefined,
        content: form.content,
        audienceType: form.audienceType,
        targetName: form.targetName || undefined,
        targetEntityId: form.targetEntityId || undefined,
        coverImage: form.coverImage || undefined,
        isPublished: form.isPublished,
      };
      if (editing) {
        await api.blogs.updateAdminBlog(editing.id, payload);
        setSuccess('Blog updated successfully.');
      } else {
        await api.blogs.createAdminBlog(payload);
        setSuccess('Blog created successfully.');
      }
      setShowModal(false);
      await fetchBlogs();
    } catch (saveError: any) {
      console.error('Failed to save blog:', saveError);
      setError(saveError?.response?.data?.message || 'Failed to save blog.');
    } finally {
      setSaving(false);
    }
  };

  const deleteBlog = async (id: string) => {
    if (!window.confirm('Delete this blog post?')) return;
    try {
      setError('');
      setSuccess('');
      await api.blogs.deleteAdminBlog(id);
      setSuccess('Blog deleted.');
      await fetchBlogs();
    } catch (deleteError: any) {
      console.error('Failed to delete blog:', deleteError);
      setError(deleteError?.response?.data?.message || 'Failed to delete blog.');
    }
  };

  const copyLink = async (path: string) => {
    const absolute = `${siteOrigin}${path}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setSuccess('Story link copied.');
    } catch {
      window.prompt('Copy link:', absolute);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create reusable story links for Seller, Designer, Country, or Other posts.
          </p>
        </div>
        <Button onClick={openCreateModal} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Blog Post
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="text"
            placeholder="Search title or slug"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border px-3 py-2"
          />
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="">All audiences</option>
            {Object.entries(audienceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>
          <Button onClick={() => void fetchBlogs()}>Refresh</Button>
        </div>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div> : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Audience</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Link</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={5}>
                  Loading blogs...
                </td>
              </tr>
            ) : blogs.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={5}>
                  No blog posts found.
                </td>
              </tr>
            ) : (
              blogs.map((blog) => (
                <tr key={blog.id}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{blog.title}</p>
                    <p className="text-xs text-gray-500">/{blog.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {audienceLabels[blog.audienceType] || blog.audienceType}
                    {blog.targetName ? <span className="block text-xs text-gray-500">{blog.targetName}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={blog.isPublished ? 'success' : 'secondary'}>
                      {blog.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <button
                      type="button"
                      onClick={() => copyLink(blog.link)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      Copy Link <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button className="rounded p-1.5 text-blue-600 hover:bg-blue-50" onClick={() => openEditModal(blog)}>
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button className="rounded p-1.5 text-red-600 hover:bg-red-50" onClick={() => deleteBlog(blog.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Blog Post' : 'Create Blog Post'}</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveBlog} className="space-y-4 px-6 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Slug (optional)</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full rounded border px-3 py-2"
                    placeholder="auto-generated-from-title"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Audience Type</label>
                  <select
                    value={form.audienceType}
                    onChange={(e) => setForm((prev) => ({ ...prev, audienceType: e.target.value as BlogAudienceType }))}
                    className="w-full rounded border px-3 py-2"
                  >
                    <option value="SELLER">Seller</option>
                    <option value="DESIGNER">Designer</option>
                    <option value="COUNTRY">Country</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Target Name (optional)</label>
                  <input
                    type="text"
                    value={form.targetName}
                    onChange={(e) => setForm((prev) => ({ ...prev, targetName: e.target.value }))}
                    className="w-full rounded border px-3 py-2"
                    placeholder="e.g. Ama Kente / Ghana"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Target Entity ID (optional)</label>
                  <input
                    type="text"
                    value={form.targetEntityId}
                    onChange={(e) => setForm((prev) => ({ ...prev, targetEntityId: e.target.value }))}
                    className="w-full rounded border px-3 py-2"
                    placeholder="reference ID in your system"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Excerpt (optional)</label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  rows={2}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  rows={8}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Cover Image URL (optional)</label>
                <input
                  type="url"
                  value={form.coverImage}
                  onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                Standalone Link: <span className="font-medium">{blogLinkPreview || '(enter title first)'}</span>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm((prev) => ({ ...prev, isPublished: e.target.checked }))}
                />
                Publish now
              </label>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update Blog' : 'Create Blog'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
