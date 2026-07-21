import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Disc3, Search } from "lucide-react";

type AlbumPlayer = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  description: string;
  cover_image_url?: string | null;
  style_label: string;
};

export default function AlbumPlayersPage() {
  const [players, setPlayers] = useState<AlbumPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/album_players")
      .then(res => {
        if (!res.ok) throw new Error(`Album players API failed: ${res.status}`);
        return res.json();
      })
      .then(data => setPlayers(data))
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load album players"))
      .finally(() => setLoading(false));
  }, []);

  const filteredPlayers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return players;
    return players.filter(player => [player.title, player.artist, player.style_label, player.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle));
  }, [players, query]);

  return (
    <div className="min-h-[100dvh] bg-[#0a0502] px-5 pb-16 pt-[calc(4.25rem+env(safe-area-inset-top))] text-white sm:px-6 md:px-10 md:pt-20 lg:px-12 xl:px-14">
      <header className="mx-auto max-w-[1500px] border-b border-white/10 pb-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-xs text-[#ffb18a]">
              <Disc3 size={15} />
              <span className="font-mono uppercase tracking-[0.2em]">Album Player Gallery</span>
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">专辑播放器</h1>
          </div>
          <label className="relative block w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={16} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索专辑、作者或风格"
              className="h-11 w-full border border-white/10 bg-black/45 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-[#ff4e00]/70"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] pt-8">
        {loading ? (
          <div className="py-20 text-center font-mono text-sm text-[#ffb18a]">Loading players...</div>
        ) : error ? (
          <div className="border border-red-400/25 bg-red-400/5 px-5 py-12 text-center text-sm text-red-200">播放器列表加载失败：{error}</div>
        ) : filteredPlayers.length === 0 ? (
          <div className="border border-white/10 bg-white/[0.03] px-5 py-16 text-center text-sm text-white/50">还没有符合条件的播放器。</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,220px))] gap-4">
            {filteredPlayers.map(player => (
              <article key={player.id} className="group overflow-hidden border border-white/10 bg-[#100c09] transition-colors hover:border-[#ff4e00]/60">
                <Link to={`/players/${player.slug}`} className="block">
                  <div className="relative aspect-square overflow-hidden bg-[#b2c6a2]">
                    {player.cover_image_url ? (
                      <img src={player.cover_image_url} alt={`${player.title} cover`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,37,20,0.14)_1px,transparent_1px),linear-gradient(0deg,rgba(20,37,20,0.14)_1px,transparent_1px)] bg-[size:12px_12px]" />
                    )}
                  </div>
                </Link>
                <div className="p-3.5">
                  <h2 className="truncate font-serif text-lg leading-tight"><Link to={`/players/${player.slug}`} className="transition-colors hover:text-[#ffb18a]">{player.title}</Link></h2>
                  {player.artist && <p className="mt-1 truncate text-xs text-white/55">{player.artist}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
