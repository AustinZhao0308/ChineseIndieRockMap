import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Archive, ArrowLeft, ChevronRight, Copy, Eye, FilePlus2, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { ContentType, Post, contentTypeMeta, formatPostDate, postStatus, statusMeta, tokenHeaders } from "../lib/content";

type ContentFilter = "all" | "draft" | "published" | "scheduled" | "archived";

const filters: { value: ContentFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "scheduled", label: "定时发布" },
  { value: "archived", label: "已归档" }
];

const typeFilters: { value: "all" | ContentType; label: string }[] = [
  { value: "all", label: "所有类型" },
  ...Object.entries(contentTypeMeta).map(([value, meta]) => ({ value: value as ContentType, label: meta.label }))
];

export default function ContentAdminPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ContentType>("all");
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [openActionID, setOpenActionID] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/posts", { headers: tokenHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "没有内容管理权限，请使用管理员账号登录。");
      setPosts(data.posts || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return posts.filter(post => {
      const derivedStatus = postStatus(post);
      const matchesStatus = statusFilter === "all" || derivedStatus === statusFilter;
      const matchesType = typeFilter === "all" || post.contentType === typeFilter;
      const haystack = [post.title, post.summary, post.sourceName, post.city, ...post.tags].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && matchesType && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [posts, query, statusFilter, typeFilter]);

  const archive = async (post: Post) => {
    setOpenActionID(null);
    try {
      const response = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...tokenHeaders() },
        body: JSON.stringify({ ...post, status: "archived" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "归档失败");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "归档失败");
    }
  };

  const remove = async (post: Post) => {
    setOpenActionID(null);
    if (!window.confirm(`删除“${post.title}”？此操作不可撤销。`)) return;
    try {
      const response = await fetch(`/api/admin/posts/${post.id}`, { method: "DELETE", headers: tokenHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除失败");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "删除失败");
    }
  };

  if (!localStorage.getItem("adminToken")) return <Navigate to="/login?next=/admin/posts" replace />;

  return (
    <main className="min-h-[100dvh] bg-[#0a0502] px-5 pb-16 pt-[calc(5.2rem+env(safe-area-inset-top))] text-white sm:px-8 md:px-12 md:pt-28">
      <div className="mx-auto max-w-7xl">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-white/42 transition-colors hover:text-white"><ArrowLeft size={16} />返回数据管理</Link>

        <header className="mt-6 flex flex-wrap items-end justify-between gap-5 border-b border-white/[0.09] pb-7">
          <div>
            <h1 className="text-[30px] font-serif leading-none md:text-4xl">内容库</h1>
            <p className="mt-3 text-sm text-white/44">管理猫啤的信息流、演出与外部文章。</p>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setIsCreateMenuOpen(open => !open)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff4e00] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#ff681f]">
              <FilePlus2 size={16} />新建内容
            </button>
            {isCreateMenuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-64 border border-white/10 bg-[#17100d] p-1.5 shadow-2xl shadow-black/60">
                {(Object.entries(contentTypeMeta) as [ContentType, typeof contentTypeMeta[ContentType]][]).map(([type, meta]) => (
                  <Link key={type} to={`/admin/posts/new?type=${type}`} onClick={() => setIsCreateMenuOpen(false)} className="block px-3 py-3 transition-colors hover:bg-white/[0.06]">
                    <span className="block text-sm font-medium">{meta.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">{meta.description}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        <section className="mt-6 border-b border-white/[0.08] pb-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="scrollbar-hide -mx-1 flex gap-1 overflow-x-auto px-1">
              {filters.map(filter => {
                const active = statusFilter === filter.value;
                const count = filter.value === "all" ? posts.length : posts.filter(post => postStatus(post) === filter.value).length;
                return <button type="button" key={filter.value} onClick={() => setStatusFilter(filter.value)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${active ? "border-[#ff5a19] text-white" : "border-transparent text-white/42 hover:text-white/75"}`}>{filter.label}<span className="ml-2 font-mono text-[11px] text-white/32">{count}</span></button>;
              })}
            </div>
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1 lg:w-64"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、标签、来源" className="h-9 w-full border border-white/10 bg-white/[0.025] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/24 focus:border-[#ff4e00]/70" /></label>
              <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as "all" | ContentType)} className="h-9 border border-white/10 bg-[#17100d] px-2 text-sm text-white/72 outline-none focus:border-[#ff4e00]/70">
                {typeFilters.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
        </section>

        {error && <p className="mt-5 border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">{error}</p>}

        <section className="mt-5">
          <div className="hidden grid-cols-[68px_minmax(0,1fr)_120px_112px_92px_34px] gap-4 border-b border-white/[0.08] px-3 pb-3 text-[11px] font-mono uppercase tracking-[0.12em] text-white/30 md:grid">
            <span>封面</span><span>内容</span><span>状态</span><span>发布时间</span><span>类型</span><span />
          </div>
          {loading ? <p className="py-16 text-center text-sm text-white/38">正在载入内容库...</p> : visiblePosts.length ? (
            <div>
              {visiblePosts.map(post => {
                const currentStatus = postStatus(post);
                const status = statusMeta[currentStatus];
                return (
                  <article key={post.id} className="group relative grid gap-4 border-b border-white/[0.075] px-0 py-4 transition-colors hover:bg-white/[0.025] md:grid-cols-[68px_minmax(0,1fr)_120px_112px_92px_34px] md:px-3 md:py-4">
                    <Link to={`/admin/posts/${post.id}/edit`} className="absolute inset-0 z-0" aria-label={`编辑 ${post.title}`} />
                    <div className="relative z-[1] h-16 w-[86px] overflow-hidden border border-white/10 bg-white/[0.04] md:w-[68px]">
                      {post.coverImageURL ? <img src={post.coverImageURL} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] font-mono text-white/24">NO IMG</div>}
                    </div>
                    <div className="relative z-[1] min-w-0 self-center pr-8 md:pr-0">
                      <div className="flex items-center gap-2 md:hidden"><span className={`border px-1.5 py-0.5 text-[10px] ${status.className}`}>{status.label}</span><span className="text-[11px] text-white/35">{contentTypeMeta[post.contentType].label}</span></div>
                      <h2 className="mt-1 truncate text-[15px] font-medium text-white group-hover:text-[#ffb18a] md:mt-0">{post.title}</h2>
                      <p className="mt-1 truncate text-sm text-white/38">{post.summary || "尚未填写摘要"}</p>
                      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-white/30 md:hidden"><span>{formatPostDate(post.publishedAt, true)}</span>{post.city && <span>{post.city}</span>}{post.tags.slice(0, 2).map(tag => <span key={tag}>#{tag}</span>)}</div>
                    </div>
                    <div className="relative z-[1] hidden self-center md:block"><span className={`inline-flex border px-2 py-1 text-[11px] ${status.className}`}>{status.label}</span></div>
                    <div className="relative z-[1] hidden self-center text-xs text-white/42 md:block">{formatPostDate(post.publishedAt, true)}</div>
                    <div className="relative z-[1] hidden self-center text-xs text-white/42 md:block">{contentTypeMeta[post.contentType].label}</div>
                    <div className="relative z-[2] self-center text-right">
                      <button type="button" title="更多操作" onClick={() => setOpenActionID(id => id === post.id ? null : post.id)} className="grid h-8 w-8 place-items-center text-white/42 transition-colors hover:bg-white/[0.08] hover:text-white"><MoreHorizontal size={17} /></button>
                      {openActionID === post.id && <div className="absolute right-0 top-9 z-30 w-36 border border-white/10 bg-[#1a110e] p-1.5 text-left shadow-2xl shadow-black/65">
                        <Link to={`/admin/posts/${post.id}/edit`} className="flex items-center gap-2 px-2.5 py-2 text-xs text-white/72 hover:bg-white/[0.07]"><Pencil size={13} />编辑</Link>
                        <Link to={`/admin/posts/${post.id}/preview`} className="flex items-center gap-2 px-2.5 py-2 text-xs text-white/72 hover:bg-white/[0.07]"><Eye size={13} />预览</Link>
                        <Link to={`/admin/posts/new?type=${post.contentType}&copy=${post.id}`} className="flex items-center gap-2 px-2.5 py-2 text-xs text-white/72 hover:bg-white/[0.07]"><Copy size={13} />复制为新草稿</Link>
                        {post.status !== "archived" && <button type="button" onClick={() => void archive(post)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-white/72 hover:bg-white/[0.07]"><Archive size={13} />归档</button>}
                        <button type="button" onClick={() => void remove(post)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-red-200 hover:bg-red-400/[0.08]"><Trash2 size={13} />删除</button>
                      </div>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border-b border-white/[0.08] py-20 text-center">
              <p className="text-base text-white/66">没有找到对应内容</p>
              <p className="mt-2 text-sm text-white/34">调整筛选条件，或创建一条新的内容。</p>
            </div>
          )}
        </section>
        {!loading && <p className="mt-5 flex items-center gap-1 text-xs text-white/30">正在显示 {visiblePosts.length} / {posts.length} 条 <ChevronRight size={13} /></p>}
      </div>
    </main>
  );
}
