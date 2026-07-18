import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, FilePlus2, Pencil, Trash2 } from "lucide-react";

type ContentType = "event" | "article" | "note";
type ContentStatus = "draft" | "published" | "archived";

type Post = {
  id: number;
  slug: string;
  contentType: ContentType;
  status: ContentStatus;
  title: string;
  summary: string;
  body: string;
  coverImageURL?: string;
  sourceName?: string;
  externalURL?: string;
  city?: string;
  tags: string[];
  sortOrder?: number;
  featuredEventId?: number | null;
};

type EventOption = { id: number; title: string; slug?: string };

const emptyDraft = (): Omit<Post, "id"> => ({
  slug: "",
  contentType: "note",
  status: "draft",
  title: "",
  summary: "",
  body: "",
  coverImageURL: "",
  sourceName: "Catbeer 编辑部",
  externalURL: "",
  city: "",
  tags: [],
  sortOrder: 0,
  featuredEventId: null
});

const tokenHeaders = () => {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function ContentAdminPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [draft, setDraft] = useState<Omit<Post, "id">>(emptyDraft());
  const [editingID, setEditingID] = useState<number | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [postsResponse, eventsResponse] = await Promise.all([
        fetch("/api/admin/posts", { headers: tokenHeaders() }),
        fetch("/api/featured_events")
      ]);
      if (!postsResponse.ok) throw new Error("没有内容管理权限，请使用管理员账号登录。");
      const postsData = await postsResponse.json();
      const eventsData = eventsResponse.ok ? await eventsResponse.json() : [];
      setPosts(postsData.posts || []);
      setEvents(eventsData || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const reset = () => {
    setDraft(emptyDraft());
    setTagsInput("");
    setEditingID(null);
    setError("");
  };

  const edit = (post: Post) => {
    setDraft({ ...post });
    setTagsInput(post.tags.join(", "));
    setEditingID(post.id);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      ...draft,
      tags: tagsInput.split(/[,，]/).map(tag => tag.trim()).filter(Boolean)
    };
    try {
      const response = await fetch(editingID ? `/api/admin/posts/${editingID}` : "/api/admin/posts", {
        method: editingID ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...tokenHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setMessage(editingID ? "内容已更新" : "内容已创建");
      reset();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    }
  };

  const remove = async (post: Post) => {
    if (!window.confirm(`删除“${post.title}”？此操作不可撤销。`)) return;
    try {
      const response = await fetch(`/api/admin/posts/${post.id}`, { method: "DELETE", headers: tokenHeaders() });
      if (!response.ok) throw new Error("删除失败");
      if (editingID === post.id) reset();
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    }
  };

  if (!localStorage.getItem("adminToken")) return <Navigate to="/login?next=/admin/posts" replace />;

  return (
    <main className="min-h-[100dvh] bg-[#0a0502] px-5 pb-16 pt-[calc(4.5rem+env(safe-area-inset-top))] text-white sm:px-8 md:px-12 md:pt-24">
      <div className="mx-auto max-w-6xl">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white"><ArrowLeft size={16} />返回数据管理</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-[#ffb18a]">Catbeer Editorial</p>
            <h1 className="mt-2 text-3xl font-serif">内容流</h1>
          </div>
          <p className="text-sm text-white/45">{posts.length} 条内容</p>
        </div>

        <form onSubmit={save} className="mt-7 grid gap-5 rounded-lg border border-white/10 bg-white/[0.035] p-4 md:grid-cols-2 md:p-6">
          <div className="md:col-span-2 flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg font-medium"><FilePlus2 size={18} className="text-[#ff4e00]" />{editingID ? "编辑内容" : "新建内容"}</h2>
            {editingID && <button type="button" onClick={reset} className="text-sm text-white/50 hover:text-white">取消编辑</button>}
          </div>
          <label className="md:col-span-2">标题<input required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} className="content-input" placeholder="这条内容想说什么？" /></label>
          <label>类型<select value={draft.contentType} onChange={event => setDraft({ ...draft, contentType: event.target.value as ContentType })} className="content-input"><option value="event">演出</option><option value="article">网页文章</option><option value="note">猫啤推荐</option></select></label>
          <label>状态<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as ContentStatus })} className="content-input"><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select></label>
          <label>城市<input value={draft.city || ""} onChange={event => setDraft({ ...draft, city: event.target.value })} className="content-input" placeholder="上海 / 武汉" /></label>
          <label>排序权重<input type="number" value={draft.sortOrder || 0} onChange={event => setDraft({ ...draft, sortOrder: Number(event.target.value) })} className="content-input" /></label>
          <label className="md:col-span-2">摘要<textarea required value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} className="content-input min-h-20" placeholder="首页信息流中的两三句话" /></label>
          <label className="md:col-span-2">正文<textarea value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} className="content-input min-h-36" placeholder="猫啤原创内容可直接写在这里" /></label>
          <label>封面图 URL<input value={draft.coverImageURL || ""} onChange={event => setDraft({ ...draft, coverImageURL: event.target.value })} className="content-input" placeholder="/uploads/... 或 https://" /></label>
          <label>来源名称<input value={draft.sourceName || ""} onChange={event => setDraft({ ...draft, sourceName: event.target.value })} className="content-input" placeholder="Catbeer 编辑部" /></label>
          <label>原文链接<input value={draft.externalURL || ""} onChange={event => setDraft({ ...draft, externalURL: event.target.value })} className="content-input" placeholder="https://" /></label>
          <label>标签<input value={tagsInput} onChange={event => setTagsInput(event.target.value)} className="content-input" placeholder="城市, 演出, 推荐" /></label>
          <label className="md:col-span-2">关联已有演出<select value={draft.featuredEventId || ""} onChange={event => setDraft({ ...draft, featuredEventId: event.target.value ? Number(event.target.value) : null })} className="content-input"><option value="">不关联</option>{events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
          {error && <p className="md:col-span-2 text-sm text-red-300">{error}</p>}
          {message && <p className="md:col-span-2 text-sm text-green-300">{message}</p>}
          <div className="md:col-span-2"><button type="submit" className="rounded-lg bg-[#ff4e00] px-5 py-3 text-sm font-semibold transition-colors hover:bg-[#ff681f]">{editingID ? "保存修改" : "创建内容"}</button></div>
        </form>

        <section className="mt-10">
          <h2 className="text-lg font-medium">已录入内容</h2>
          {loading ? <p className="mt-5 text-sm text-white/45">加载中...</p> : (
            <div className="mt-4 divide-y divide-white/8 rounded-lg border border-white/10 bg-white/[0.025]">
              {posts.map(post => <article key={post.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/55">{post.contentType}</span><span className={`text-xs ${post.status === "published" ? "text-green-300" : "text-white/40"}`}>{post.status}</span></div><h3 className="mt-2 truncate font-medium">{post.title}</h3><p className="mt-1 truncate text-sm text-white/45">{post.summary}</p></div>
                <button type="button" onClick={() => edit(post)} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white/60 hover:bg-white/10 hover:text-white" aria-label={`编辑 ${post.title}`}><Pencil size={16} /></button>
                <button type="button" onClick={() => remove(post)} className="grid h-10 w-10 place-items-center rounded-lg border border-red-400/20 text-red-300 hover:bg-red-400/10" aria-label={`删除 ${post.title}`}><Trash2 size={16} /></button>
              </article>)}
              {!posts.length && <p className="p-8 text-sm text-white/45">还没有内容。第一条会成为猫啤首页的开始。</p>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
