import React, { useEffect, useState } from "react";
import { Disc3, Edit2, ExternalLink, Image as ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import ImageAssetPicker from "./ImageAssetPicker";

type AlbumPlayer = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  description: string;
  github_url: string;
  site_url: string;
  cover_image_url?: string | null;
  style_label: string;
  status: "draft" | "published" | "archived";
  sort_order: number;
};

type FormState = Omit<AlbumPlayer, "id">;

const emptyForm = (): FormState => ({ slug: "", title: "", artist: "", description: "", github_url: "", site_url: "", cover_image_url: "", style_label: "", status: "draft", sort_order: 0 });

const inferPagesUrl = (githubUrl: string) => {
  const match = githubUrl.trim().match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)\/?(?:[#?].*)?$/i);
  return match ? `https://${match[1]}.github.io/${match[2]}/` : "";
};

export default function AlbumPlayersAdminPanel({ token }: { token: string }) {
  const [players, setPlayers] = useState<AlbumPlayer[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/album_players", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load players");
      setPlayers(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load players");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlayers(); }, [token]);

  const setGithubUrl = (github_url: string) => {
    setForm(current => ({ ...current, github_url, site_url: current.site_url || inferPagesUrl(github_url) }));
  };

  const reset = () => { setEditingId(null); setForm(emptyForm()); };

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setMessage("请上传图片文件。");
      return;
    }
    setIsUploadingCover(true);
    setMessage(null);
    try {
      const upload = new FormData();
      upload.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: upload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "封面上传失败");
      setForm(current => ({ ...current, cover_image_url: data.url }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "封面上传失败");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const endpoint = editingId ? `/api/album_players/${editingId}` : "/api/album_players";
    const res = await fetch(endpoint, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "保存失败"); return; }
    reset();
    setMessage(editingId ? "播放器已更新" : "播放器已添加");
    loadPlayers();
  };

  const edit = (player: AlbumPlayer) => {
    setEditingId(player.id);
    setForm({ ...player });
    setMessage(null);
  };

  const remove = async (id: number) => {
    const res = await fetch(`/api/album_players/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setMessage("删除失败"); return; }
    setDeletingId(null);
    if (editingId === id) reset();
    setMessage("播放器已删除");
    loadPlayers();
  };

  return <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
    <section className="border border-white/10 bg-[#1a1a1a] p-5 md:p-7">
      <div className="mb-6 flex items-center justify-between gap-4"><div><h2 className="flex items-center gap-2 text-xl font-medium"><Disc3 size={20} className="text-[#ff4e00]" /> {editingId ? "编辑专辑播放器" : "添加专辑播放器"}</h2><p className="mt-1 text-sm text-white/45">先配置专辑信息，播放器站点是它的播放入口。</p></div>{editingId && <button type="button" onClick={reset} className="grid h-8 w-8 place-items-center border border-white/10 text-white/55 hover:text-white" aria-label="取消编辑"><X size={16} /></button>}</div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="专辑名"><input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className={inputClass} placeholder="例如 window of vulnerability" /></Field>
          <Field label="歌手 / 乐队名"><input required value={form.artist} onChange={event => setForm({ ...form, artist: event.target.value })} className={inputClass} placeholder="自由填写，不关联乐队库" /></Field>
        </div>
        <Field label="专辑封面">
          <div className="mt-1.5 grid gap-3 border border-white/10 bg-black/25 p-3 sm:grid-cols-[120px_1fr]">
            <div className="aspect-square overflow-hidden bg-white/[0.04]">
              {form.cover_image_url ? <img src={form.cover_image_url} alt="专辑封面预览" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-white/25"><ImageIcon size={25} /></div>}
            </div>
            <div className="flex flex-col justify-center gap-2">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 border border-white/15 px-3 text-sm text-white/75 transition-colors hover:border-[#ff4e00] hover:text-white"><Upload size={14} /> {isUploadingCover ? "上传中..." : "上传封面"}<input type="file" accept="image/*" className="sr-only" disabled={isUploadingCover} onChange={event => { const file = event.target.files?.[0]; if (file) uploadCover(file); event.target.value = ""; }} /></label>
                <button type="button" onClick={() => setIsImagePickerOpen(true)} className="inline-flex h-9 items-center gap-2 border border-white/15 px-3 text-sm text-white/75 transition-colors hover:border-[#ff4e00] hover:text-white"><ImageIcon size={14} /> 从资源库选择</button>
                {form.cover_image_url && <button type="button" onClick={() => setForm(current => ({ ...current, cover_image_url: "" }))} className="inline-flex h-9 items-center gap-2 border border-red-400/30 px-3 text-sm text-red-200 transition-colors hover:bg-red-400/10"><X size={14} /> 移除</button>}
              </div>
              <p className="text-xs leading-5 text-white/38">建议使用正方形封面。歌手或乐队名只作为专辑信息保存，不会关联现有乐队库。</p>
            </div>
          </div>
        </Field>
        <Field label="页面路径 slug"><input value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value })} className={inputClass} placeholder="留空时由名称生成" /></Field>
        <div className="border-t border-white/10 pt-4"><p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-white/42">播放器站点</p><div className="space-y-4"><Field label="GitHub 仓库链接"><input required type="url" value={form.github_url} onChange={event => setGithubUrl(event.target.value)} className={inputClass} placeholder="https://github.com/owner/repository" /></Field><Field label="部署后的播放器链接"><input required type="url" value={form.site_url} onChange={event => setForm({ ...form, site_url: event.target.value })} className={inputClass} placeholder="https://owner.github.io/repository/" /><p className="pt-1 text-xs leading-5 text-white/38">填写 GitHub 链接时会自动推导 GitHub Pages 地址，仍可改成 Vercel、Netlify 或自定义域名。</p></Field></div></div>
        <div className="grid gap-4 md:grid-cols-2"><Field label="风格标签"><input value={form.style_label} onChange={event => setForm({ ...form, style_label: event.target.value })} className={inputClass} placeholder="例如 Game Boy" /></Field><Field label="排序（数值大者靠前）"><input type="number" value={form.sort_order} onChange={event => setForm({ ...form, sort_order: Number(event.target.value) })} className={inputClass} /></Field></div>
        <Field label="简介"><textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className={`${inputClass} min-h-24 resize-y`} placeholder="简短介绍这个独立播放器。" /></Field>
        <Field label="发布状态"><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as FormState["status"] })} className={inputClass}><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select></Field>
        {message && <p className="border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">{message}</p>}
        <button type="submit" className="inline-flex h-10 items-center gap-2 bg-[#ff4e00] px-4 text-sm font-medium text-white hover:bg-[#ff6a2b]"><Plus size={16} /> {editingId ? "保存修改" : "添加到 Gallery"}</button>
      </form>
    </section>
    <section className="border border-white/10 bg-[#1a1a1a] p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-medium">当前播放器</h2><span className="text-sm text-white/42">{players.length}</span></div>{loading ? <p className="py-8 text-center text-sm text-white/45">Loading...</p> : <div className="space-y-3">{players.map(player => <article key={player.id} className="border border-white/10 bg-black/25 p-4"><div className="flex gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-medium">{player.title}</h3><span className={`shrink-0 px-1.5 py-0.5 text-[10px] ${player.status === "published" ? "bg-green-500/15 text-green-300" : "bg-white/10 text-white/50"}`}>{player.status === "published" ? "已发布" : player.status === "draft" ? "草稿" : "已归档"}</span></div><p className="mt-1 truncate text-xs text-white/45">{player.artist || "未注明作者"}{player.style_label ? ` · ${player.style_label}` : ""}</p><a href={player.site_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-xs text-[#ffb18a] hover:text-white"><ExternalLink size={12} /> <span className="truncate">打开播放器</span></a></div><div className="flex gap-1"><button type="button" onClick={() => edit(player)} className="grid h-8 w-8 place-items-center border border-white/10 text-white/55 hover:text-white" aria-label="编辑"><Edit2 size={14} /></button>{deletingId === player.id ? <div className="flex gap-1"><button type="button" onClick={() => remove(player.id)} className="h-8 bg-red-500 px-2 text-xs text-white">删除</button><button type="button" onClick={() => setDeletingId(null)} className="grid h-8 w-8 place-items-center border border-white/10 text-white/55" aria-label="取消删除"><X size={14} /></button></div> : <button type="button" onClick={() => setDeletingId(player.id)} className="grid h-8 w-8 place-items-center border border-white/10 text-red-300 hover:bg-red-500/10" aria-label="删除"><Trash2 size={14} /></button>}</div></div></article>)}{players.length === 0 && <p className="py-8 text-center text-sm text-white/45">还没有播放器。</p>}</div>}</section>
    <ImageAssetPicker isOpen={isImagePickerOpen} token={token} onClose={() => setIsImagePickerOpen(false)} onSelect={url => setForm(current => ({ ...current, cover_image_url: url }))} />
  </div>;
}

const inputClass = "mt-1.5 w-full border border-white/10 bg-black/45 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#ff4e00]/70";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs text-white/55"><span>{label}</span>{children}</label>;
}
