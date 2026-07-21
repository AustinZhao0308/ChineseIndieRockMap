import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

type AlbumPlayer = {
  id: number;
  title: string;
  artist: string;
  description: string;
  site_url: string;
  style_label: string;
};

export default function AlbumPlayerPage() {
  const { slug = "" } = useParams();
  const [player, setPlayer] = useState<AlbumPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/album_players/${encodeURIComponent(slug)}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? "NOT_FOUND" : "LOAD_FAILED");
        return res.json();
      })
      .then(setPlayer)
      .catch(err => setError(err instanceof Error ? err.message : "LOAD_FAILED"));
  }, [slug]);

  if (error) {
    return <div className="grid min-h-[100dvh] place-items-center bg-[#0a0502] px-6 text-center text-white"><div><h1 className="font-serif text-3xl">{error === "NOT_FOUND" ? "播放器不存在" : "播放器加载失败"}</h1><Link to="/players" className="mt-6 inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white"><ArrowLeft size={15} /> 返回 Gallery</Link></div></div>;
  }

  if (!player) return <div className="grid min-h-[100dvh] place-items-center bg-[#0a0502] font-mono text-sm text-[#ffb18a]">Loading player...</div>;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-black">
      <iframe
        src={player.site_url}
        title={`${player.title} player`}
        className="absolute inset-0 h-full w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        allow="autoplay; encrypted-media; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <Link to="/players" className="absolute left-4 top-[calc(1rem+env(safe-area-inset-top))] z-30 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 text-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors hover:border-white/50 hover:bg-black/55" aria-label="返回 Gallery" title="返回 Gallery">
        <ArrowLeft size={18} />
      </Link>
    </div>
  );
}
