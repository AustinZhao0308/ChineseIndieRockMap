import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin, Pencil, Tag } from "lucide-react";
import { Post, contentTypeMeta, formatPostDate, postStatus, statusMeta, tokenHeaders } from "../lib/content";

export default function ContentPreviewPage() {
  const { id } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/posts/${id}`, { headers: tokenHeaders() })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "无法加载预览");
        setPost(data.post);
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : "无法加载预览"));
  }, [id]);

  if (!localStorage.getItem("adminToken")) return <Navigate to="/login?next=/admin/posts" replace />;
  if (error) return <main className="grid min-h-[100dvh] place-items-center bg-[#0a0502] px-5 text-sm text-red-200">{error}</main>;
  if (!post) return <main className="grid min-h-[100dvh] place-items-center bg-[#0a0502] text-sm text-white/42">正在生成预览...</main>;

  const status = statusMeta[postStatus(post)];
  const paragraphs = post.body.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);

  return (
    <main className="min-h-[100dvh] bg-[#0a0502] pb-16 pt-[calc(5.2rem+env(safe-area-inset-top))] text-white sm:px-8 md:pt-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-0">
        <header className="flex items-center justify-between border-b border-white/[0.09] pb-5"><Link to={`/admin/posts/${post.id}/edit`} className="inline-flex items-center gap-2 text-sm text-white/52 transition-colors hover:text-white"><ArrowLeft size={16} />返回编辑</Link><Link to={`/admin/posts/${post.id}/edit`} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/[0.07]"><Pencil size={14} />继续编辑</Link></header>
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_220px]">
          <article>
            <div className="flex items-center gap-3"><span className={`border px-2 py-1 text-[11px] ${status.className}`}>{status.label}</span><span className="text-xs text-white/36">{contentTypeMeta[post.contentType].label}</span></div>
            <h1 className="mt-5 max-w-3xl text-[38px] font-serif leading-[1.2] md:text-6xl">{post.title}</h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-8 text-white/62">{post.summary}</p>
            {post.coverImageURL && <img src={post.coverImageURL} alt="" className="mt-9 aspect-[16/9] w-full border border-white/10 object-cover" />}
            <div className="mt-10 max-w-2xl space-y-7 text-[16px] leading-8 text-white/78">{paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="text-white/30">正文还没有内容。</p>}</div>
            {post.externalURL && <a href={post.externalURL} target="_blank" rel="noreferrer" className="mt-10 inline-flex items-center gap-2 border-b border-[#ff4e00]/60 pb-1 text-sm text-[#ffb18a] transition-colors hover:text-white">查看原文 <ExternalLink size={14} /></a>}
          </article>
          <aside className="h-fit border-t border-white/[0.09] pt-5 text-sm lg:sticky lg:top-28"><p className="text-xs font-mono uppercase tracking-[0.12em] text-white/32">预览信息</p><dl className="mt-5 space-y-5 text-white/55"><div><dt className="mb-1 text-[11px] text-white/30">来源</dt><dd>{post.sourceName || "Catbeer 编辑部"}</dd></div><div className="flex gap-2"><CalendarDays size={15} className="mt-0.5 text-[#ff8a57]" /><div><dt className="text-[11px] text-white/30">发布时间</dt><dd className="mt-1">{formatPostDate(post.publishedAt, true)}</dd></div></div>{post.city && <div className="flex gap-2"><MapPin size={15} className="mt-0.5 text-[#ff8a57]" /><div><dt className="text-[11px] text-white/30">城市</dt><dd className="mt-1">{post.city}</dd></div></div>}{post.tags.length > 0 && <div className="flex gap-2"><Tag size={15} className="mt-0.5 text-[#ff8a57]" /><div className="flex flex-wrap gap-1.5">{post.tags.map(tag => <span key={tag} className="border border-white/10 px-1.5 py-0.5 text-xs text-white/55">{tag}</span>)}</div></div>}</dl></aside>
        </div>
      </div>
    </main>
  );
}
