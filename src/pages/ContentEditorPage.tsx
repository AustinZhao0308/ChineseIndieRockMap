import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, ExternalLink, Eye, ImagePlus, LibraryBig, LoaderCircle, Save, Send, Settings2, Upload, X } from "lucide-react";
import ImageAssetPicker from "../components/ImageAssetPicker";
import { ContentType, EventOption, Post, PostDraft, contentTypeMeta, dateTimeInputValue, emptyDraft, serializeDraft, tokenHeaders } from "../lib/content";

const validType = (value: string | null): value is ContentType => value === "event" || value === "article" || value === "note";
const toISODate = (value: string) => value ? new Date(value).toISOString() : null;

export default function ContentEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedType: ContentType = validType(searchParams.get("type")) ? searchParams.get("type") as ContentType : "note";
  const copyID = searchParams.get("copy");
  const [draft, setDraft] = useState<PostDraft>(() => emptyDraft(requestedType));
  const [tagsInput, setTagsInput] = useState("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(Boolean(id || copyID));
  const [saving, setSaving] = useState(false);
  const [savedState, setSavedState] = useState<"idle" | "local" | "saved">("idle");
  const [error, setError] = useState("");
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const isNew = !id;
  const localDraftKey = useMemo(() => isNew ? `catbeer-content-composer:${copyID || requestedType}` : `catbeer-content-composer:${id}`, [copyID, id, isNew, requestedType]);

  useEffect(() => {
    if (!localStorage.getItem("adminToken")) return;
    let cancelled = false;
    const load = async () => {
      try {
        const eventRequest = fetch("/api/featured_events");
        const contentRequest = id || copyID ? fetch(`/api/admin/posts/${id || copyID}`, { headers: tokenHeaders() }) : null;
        const [eventResponse, contentResponse] = await Promise.all([eventRequest, contentRequest]);
        const eventData = eventResponse.ok ? await eventResponse.json() : [];
        if (!cancelled) setEvents(eventData || []);
        if (contentResponse) {
          const contentData = await contentResponse.json();
          if (!contentResponse.ok) throw new Error(contentData.error || "无法加载内容");
          const post = contentData.post as Post;
          if (!cancelled) {
            setDraft(copyID ? { ...post, status: "draft", publishedAt: null, slug: "" } : post);
            setTagsInput(post.tags.join(", "));
          }
        } else {
          const stored = localStorage.getItem(localDraftKey);
          if (stored) {
            const restored = JSON.parse(stored) as { draft?: PostDraft; tagsInput?: string };
            if (restored.draft && !cancelled) {
              setDraft(restored.draft);
              setTagsInput(restored.tagsInput || "");
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [copyID, id, localDraftKey]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(localDraftKey, JSON.stringify({ draft, tagsInput }));
      setSavedState("local");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, loading, localDraftKey, tagsInput]);

  const updateDraft = (patch: Partial<PostDraft>) => setDraft(current => ({ ...current, ...patch }));

  const validate = (nextDraft: PostDraft) => {
    if (!nextDraft.title.trim()) return "请先填写标题。";
    if (!nextDraft.summary.trim()) return "请为信息流填写一段摘要。";
    if (nextDraft.contentType === "article" && !nextDraft.externalURL?.trim()) return "网页文章需要填写原文链接。";
    if (nextDraft.contentType === "event" && !nextDraft.featuredEventId) return "演出内容需要关联一条已有演出档案。";
    return "";
  };

  const save = async (intent: "draft" | "publish" | "archive" = "draft") => {
    const nextStatus = intent === "archive" ? "archived" : intent === "publish" ? "published" : "draft";
    const nextDraft: PostDraft = {
      ...draft,
      status: nextStatus,
      tags: tagsInput.split(/[,，]/).map(tag => tag.trim()).filter(Boolean),
      publishedAt: nextStatus === "published" ? (draft.publishedAt || null) : draft.publishedAt
    };
    const validationError = validate(nextDraft);
    if (validationError && intent !== "archive") {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(id ? `/api/admin/posts/${id}` : "/api/admin/posts", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...tokenHeaders() },
        body: JSON.stringify(serializeDraft(nextDraft))
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      localStorage.removeItem(localDraftKey);
      setDraft(nextDraft);
      setSavedState("saved");
      setIsPublishing(false);
      if (!id) {
        navigate(`/admin/posts/${data.id}/edit`, { replace: true });
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    const payload = new FormData();
    payload.append("image", file);
    try {
      const response = await fetch("/api/upload", { method: "POST", headers: tokenHeaders(), body: payload });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "封面上传失败");
      updateDraft({ coverImageURL: data.url });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "封面上传失败");
    } finally {
      event.target.value = "";
    }
  };

  if (!localStorage.getItem("adminToken")) return <Navigate to="/login?next=/admin/posts" replace />;
  if (loading) return <main className="grid min-h-[100dvh] place-items-center bg-[#0a0502] text-sm text-white/42">正在打开编辑器...</main>;

  const scheduleValue = dateTimeInputValue(draft.publishedAt);

  return (
    <main className="min-h-[100dvh] bg-[#0a0502] pb-14 pt-[calc(3.2rem+env(safe-area-inset-top))] text-white md:pt-[3.65rem]">
      <header className="sticky top-[calc(3.2rem+env(safe-area-inset-top))] z-30 border-b border-white/[0.09] bg-[#100907]/94 px-4 backdrop-blur-xl sm:px-6 md:top-[3.65rem] md:px-10">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/admin/posts" title="返回内容库" className="grid h-8 w-8 shrink-0 place-items-center border border-white/10 text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white"><ArrowLeft size={16} /></Link>
            <div className="min-w-0"><p className="truncate text-sm font-medium">{isNew ? "新建内容" : "编辑内容"}</p><p className="hidden text-[11px] text-white/38 sm:block">{savedState === "saved" ? "已保存到服务器" : savedState === "local" ? "已在本机暂存" : "正在编辑"}</p></div>
          </div>
          <div className="flex items-center gap-2">
            {id ? <Link to={`/admin/posts/${id}/preview`} title="预览内容" className="grid h-8 w-8 place-items-center border border-white/10 text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white"><Eye size={16} /></Link> : <span title="保存后可预览" className="grid h-8 w-8 place-items-center border border-white/[0.06] text-white/20"><Eye size={16} /></span>}
            <button type="button" disabled={saving} onClick={() => void save("draft")} className="hidden h-8 items-center gap-1.5 border border-white/12 px-3 text-xs text-white/76 transition-colors hover:bg-white/[0.08] disabled:opacity-45 sm:inline-flex"><Save size={14} />保存草稿</button>
            <button type="button" disabled={saving} onClick={() => setIsPublishing(true)} className="inline-flex h-8 items-center gap-1.5 bg-[#ff4e00] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#ff681f] disabled:opacity-45"><Send size={14} />发布</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 pt-8 sm:px-8 md:grid-cols-[minmax(0,1fr)_300px] md:px-10 lg:gap-14">
        <section className="min-w-0 md:max-w-[800px]">
          <div className="border-b border-white/[0.08] pb-7">
            <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#ffb18a]">内容类型</p>
            <div className="mt-3 grid grid-cols-1 gap-px border border-white/[0.09] bg-white/[0.09] sm:grid-cols-3">
              {(Object.entries(contentTypeMeta) as [ContentType, typeof contentTypeMeta[ContentType]][]).map(([type, meta]) => {
                const active = draft.contentType === type;
                return <button type="button" key={type} onClick={() => updateDraft({ contentType: type, sourceName: draft.sourceName || (type === "note" ? "Catbeer 编辑部" : "") })} className={`px-4 py-3 text-left transition-colors ${active ? "bg-[#2a160e] text-white" : "bg-[#100907] text-white/44 hover:bg-white/[0.04] hover:text-white/76"}`}><span className="block text-sm font-medium">{meta.label}</span><span className="mt-1 block text-[11px] leading-4 opacity-65">{meta.description}</span></button>;
              })}
            </div>
          </div>

          <div className="mt-8">
            <input value={draft.title} onChange={event => updateDraft({ title: event.target.value })} placeholder="写下一个清晰、有画面的标题" className="w-full bg-transparent text-[30px] font-serif leading-[1.22] text-white outline-none placeholder:text-white/20 md:text-[42px]" />
            <textarea value={draft.summary} onChange={event => updateDraft({ summary: event.target.value })} placeholder="摘要会出现在首页信息流中，建议用一两句话说清这条内容。" className="mt-5 min-h-20 w-full resize-y border-y border-white/[0.07] bg-transparent py-4 text-[15px] leading-7 text-white/72 outline-none placeholder:text-white/26 focus:border-[#ff4e00]/50" />
            <textarea value={draft.body} onChange={event => updateDraft({ body: event.target.value })} placeholder="开始写正文。空行会作为段落间隔，保留你自己的语气与节奏。" className="mt-7 min-h-[360px] w-full resize-y bg-transparent text-[16px] leading-8 text-white/82 outline-none placeholder:text-white/22" />
          </div>
        </section>

        <aside className="border-t border-white/[0.09] pt-7 md:sticky md:top-[8.4rem] md:h-[calc(100dvh-10rem)] md:overflow-y-auto md:border-t-0 md:pt-0">
          <div className="flex items-center gap-2 text-sm font-medium"><Settings2 size={16} className="text-[#ff8a57]" />内容设置</div>
          <div className="mt-5 space-y-6">
            <section>
              <p className="editor-label">封面</p>
              <div className="mt-2 overflow-hidden border border-white/10 bg-white/[0.035]">
                {draft.coverImageURL ? <div className="group relative aspect-[16/10]"><img src={draft.coverImageURL} alt="内容封面" className="h-full w-full object-cover" /><button type="button" onClick={() => updateDraft({ coverImageURL: "" })} title="移除封面" className="absolute right-2 top-2 grid h-7 w-7 place-items-center bg-black/65 text-white/75 opacity-0 transition-opacity group-hover:opacity-100"><X size={14} /></button></div> : <button type="button" onClick={() => uploadRef.current?.click()} className="grid aspect-[16/10] w-full place-items-center text-center text-xs text-white/36 transition-colors hover:bg-white/[0.04] hover:text-white/72"><span><ImagePlus size={18} className="mx-auto mb-2" />上传一张封面</span></button>}
              </div>
              <input ref={uploadRef} type="file" accept="image/*" onChange={uploadCover} className="hidden" />
              <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => uploadRef.current?.click()} className="editor-utility"><Upload size={13} />上传</button><button type="button" onClick={() => setIsAssetPickerOpen(true)} className="editor-utility"><LibraryBig size={13} />素材库</button></div>
              <input value={draft.coverImageURL || ""} onChange={event => updateDraft({ coverImageURL: event.target.value })} placeholder="或粘贴图片地址" className="editor-input mt-2" />
            </section>

            <section className="space-y-4 border-t border-white/[0.08] pt-5">
              <label className="block"><span className="editor-label">城市</span><input value={draft.city || ""} onChange={event => updateDraft({ city: event.target.value })} placeholder="上海 / 武汉" className="editor-input" /></label>
              <label className="block"><span className="editor-label">标签</span><input value={tagsInput} onChange={event => setTagsInput(event.target.value)} placeholder="演出, 后朋克, 推荐" className="editor-input" /></label>
              <label className="block"><span className="editor-label">来源</span><input value={draft.sourceName || ""} onChange={event => updateDraft({ sourceName: event.target.value })} placeholder={draft.contentType === "note" ? "Catbeer 编辑部" : "媒体或创作者名称"} className="editor-input" /></label>
              <label className="block"><span className="editor-label">原文链接{draft.contentType === "article" && <b className="ml-1 font-normal text-[#ff8a57]">必填</b>}</span><input value={draft.externalURL || ""} onChange={event => updateDraft({ externalURL: event.target.value })} placeholder="https://" className="editor-input" /></label>
            </section>

            <section className="border-t border-white/[0.08] pt-5">
              <label className="block"><span className="editor-label">关联演出{draft.contentType === "event" && <b className="ml-1 font-normal text-[#ff8a57]">必填</b>}</span><div className="relative"><select value={draft.featuredEventId || ""} onChange={event => updateDraft({ featuredEventId: event.target.value ? Number(event.target.value) : null })} className="editor-input appearance-none pr-9"><option value="">不关联演出</option>{events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/35" /></div></label>
            </section>

            <section className="border-t border-white/[0.08] pt-5">
              <p className="editor-label">信息流位置</p>
              <div className="mt-2 relative"><select value={draft.sortOrder || 0} onChange={event => updateDraft({ sortOrder: Number(event.target.value) })} className="editor-input appearance-none pr-9"><option value={0}>标准排序</option><option value={100}>推荐展示</option><option value={200}>置顶展示</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/35" /></div>
            </section>
          </div>
        </aside>
      </div>

      {error && <p className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 border border-red-400/25 bg-[#2e100e] px-4 py-3 text-sm text-red-100 shadow-2xl shadow-black/60">{error}</p>}

      {isPublishing && <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"><div className="w-full border border-white/10 bg-[#160d0a] shadow-2xl shadow-black/65 sm:max-w-md"><div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4"><div><h2 className="text-base font-medium">发布设置</h2><p className="mt-1 text-xs text-white/40">确认信息流的可见时间与排序。</p></div><button type="button" onClick={() => setIsPublishing(false)} title="关闭发布设置" className="grid h-8 w-8 place-items-center text-white/50 hover:bg-white/[0.07] hover:text-white"><X size={16} /></button></div><div className="space-y-5 px-5 py-5"><label className="block"><span className="editor-label">发布时间</span><input type="datetime-local" value={scheduleValue} onChange={event => updateDraft({ publishedAt: toISODate(event.target.value) })} className="editor-input" /><span className="mt-2 block text-[11px] leading-5 text-white/35">留空即立即发布；选择未来时间将自动进入定时发布。</span></label><div className="border border-[#ff4e00]/20 bg-[#ff4e00]/[0.06] px-3 py-3 text-xs leading-5 text-white/62">发布后会进入公开信息流。草稿与定时内容不会在公开接口中展示。</div></div><div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-4"><button type="button" onClick={() => void save("draft")} className="text-sm text-white/55 hover:text-white">保存草稿</button><button type="button" disabled={saving} onClick={() => void save("publish")} className="inline-flex h-9 items-center gap-2 bg-[#ff4e00] px-4 text-sm font-semibold disabled:opacity-45">{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}确认发布</button></div></div></div>}
      <ImageAssetPicker isOpen={isAssetPickerOpen} token={localStorage.getItem("adminToken") || ""} onClose={() => setIsAssetPickerOpen(false)} onSelect={url => updateDraft({ coverImageURL: url })} />
    </main>
  );
}
