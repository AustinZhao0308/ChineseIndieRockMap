import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Copy, ExternalLink, MapPin, Music2, PenLine, Ticket, Users } from "lucide-react";
import BandModal from "../components/BandModal";
import VenueModal from "../components/VenueModal";
import { Band, Venue } from "../data";
import tingkaozaiPoster from "../pic/停靠在.JPG";

type EventTicket = {
  label: string;
  url: string;
};

type EventStop = {
  label: string;
  start_at?: string;
  venue_id?: string;
  guestBandIds?: string[];
  guestBands?: Band[];
  price_text?: string;
  tickets?: EventTicket[];
  venue?: Venue;
};

type EventLineupDay = {
  day: string;
  bandIds?: string[];
  bands?: Band[];
};

type EventDetail = {
  id: number;
  slug?: string;
  title: string;
  date_str: string;
  location: string;
  address: string;
  description: string;
  image_url?: string;
  ticket_url?: string;
  organizer?: string;
  status?: string;
  is_active?: number;
  stops: EventStop[];
  lineup: EventLineupDay[];
};

const fallbackColors = {
  a: "245, 98, 63",
  b: "57, 166, 154",
  c: "251, 204, 126"
};

const resolvePosterUrl = (url?: string) => {
  if (!url) return tingkaozaiPoster;
  if (url.includes("停靠在.JPG")) return tingkaozaiPoster;
  return url;
};

const formatStopTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
};

const statusLabel = (status?: string) => {
  const labels: Record<string, string> = {
    on_sale: "售票中",
    upcoming: "即将开始",
    sold_out: "已售罄",
    ended: "已结束",
    cancelled: "已取消",
    postponed: "已延期"
  };
  return labels[status || ""] || "演出";
};

const ticketLabel = (ticket: EventTicket) => {
  if (ticket.url?.startsWith("weixin://")) return ticket.label || "微信小程序打开";
  return ticket.label || "购票";
};

export default function EventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const posterRef = useRef<HTMLImageElement | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [colors, setColors] = useState(fallbackColors);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [ticketMessage, setTicketMessage] = useState("");

  const isAdmin = typeof window !== "undefined" && !!localStorage.getItem("adminToken");
  const posterUrl = resolvePosterUrl(event?.image_url);
  const stops = event?.stops?.length ? event.stops : [];
  const lineupBands = useMemo(() => {
    const bandMap = new Map<string, { band: Band; notes: Set<string>; isGuest: boolean }>();

    event?.lineup?.forEach(day => {
      day.bands?.forEach(band => {
        const entry = bandMap.get(band.id) || { band, notes: new Set<string>(), isGuest: false };
        if (day.day && day.day !== '全站阵容') entry.notes.add(day.day);
        entry.isGuest = false;
        bandMap.set(band.id, entry);
      });
    });

    event?.stops?.forEach(stop => {
      stop.guestBands?.forEach(band => {
        const entry = bandMap.get(band.id) || { band, notes: new Set<string>(), isGuest: true };
        entry.notes.add(stop.label);
        if (!bandMap.has(band.id)) entry.isGuest = true;
        bandMap.set(band.id, entry);
      });
    });

    return Array.from(bandMap.values()).map(entry => ({
      ...entry,
      notes: Array.from(entry.notes)
    }));
  }, [event]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/featured_events/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error(`Event API failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setEvent(data);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load event");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const extractPosterColors = () => {
    const img = posterRef.current;
    if (!img) return;

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = 18;
      canvas.height = 18;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const buckets: number[][] = [];

      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        if (brightness > 35 && brightness < 235 && saturation > 18) {
          buckets.push([r, g, b]);
        }
      }

      if (!buckets.length) return;
      const ranked = buckets
        .sort((left, right) => {
          const leftScore = Math.max(...left) - Math.min(...left) + (left[0] + left[1] + left[2]) / 10;
          const rightScore = Math.max(...right) - Math.min(...right) + (right[0] + right[1] + right[2]) / 10;
          return rightScore - leftScore;
        })
        .slice(0, 3);

      setColors({
        a: ranked[0]?.join(", ") || fallbackColors.a,
        b: ranked[1]?.join(", ") || fallbackColors.b,
        c: ranked[2]?.join(", ") || fallbackColors.c
      });
    } catch (err) {
      setColors(fallbackColors);
    }
  };

  const handleTicket = async (ticket: EventTicket) => {
    if (!ticket.url) return;
    if (ticket.url.startsWith("weixin://")) {
      window.location.href = ticket.url;
      try {
        await navigator.clipboard.writeText(ticket.url);
        setTicketMessage("已尝试打开微信，并复制了小程序链接");
      } catch (err) {
        setTicketMessage("已尝试打开微信；如未唤起，请手动复制链接");
      }
      setTimeout(() => setTicketMessage(""), 3200);
      return;
    }
    window.open(ticket.url, "_blank", "noopener,noreferrer");
  };

  const copyTicket = async (ticket: EventTicket) => {
    if (!ticket.url) return;
    try {
      await navigator.clipboard.writeText(ticket.url);
      setTicketMessage("购票链接已复制");
    } catch (err) {
      setTicketMessage("复制失败，请手动复制链接");
    }
    setTimeout(() => setTicketMessage(""), 2600);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#080705] flex items-center justify-center text-[#ff6a2b] font-mono">
        Loading Event...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-[100dvh] bg-[#080705] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-xl text-white font-serif">没有找到这场演出</p>
        <p className="text-sm text-gray-400">{error}</p>
        <button onClick={() => navigate("/")} className="px-5 py-2 rounded-full bg-white text-black text-sm font-medium">
          回到地图
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] bg-[#080705] text-white font-sans overflow-hidden"
      style={{
        ["--glow-a" as string]: colors.a,
        ["--glow-b" as string]: colors.b,
        ["--glow-c" as string]: colors.c
      }}
    >
      <div className="fixed inset-0 pointer-events-none">
        <img src={posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-110" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(var(--glow-a),0.34),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(var(--glow-b),0.25),transparent_30%),radial-gradient(circle_at_65%_92%,rgba(var(--glow-c),0.24),transparent_38%),linear-gradient(180deg,rgba(8,7,5,0.18),#080705_78%)]" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-30 px-4 py-4 md:px-8 md:py-6 flex items-center justify-between pointer-events-none">
        <Link to="/" className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm text-white/85 backdrop-blur-xl hover:bg-white/10 transition-colors">
          <ArrowLeft size={16} />
          地图
        </Link>
        {isAdmin && (
          <Link to={`/admin?tab=events&edit=${encodeURIComponent(event.slug || String(event.id))}`} className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/85 backdrop-blur-xl hover:bg-white/15 transition-colors">
            <PenLine size={16} />
            编辑
          </Link>
        )}
      </header>

      <main className="relative z-10">
        <section className="min-h-[100dvh] px-4 pt-24 pb-12 md:px-10 md:pt-28 md:pb-16 flex items-center">
          <div className="mx-auto w-full max-w-7xl grid gap-8 md:grid-cols-[minmax(320px,0.86fr)_minmax(420px,1.14fr)] md:items-center">
            <div className="relative mx-auto w-full max-w-[420px] md:max-w-[520px]">
              <div className="absolute -inset-5 rounded-[2rem] bg-[linear-gradient(135deg,rgba(var(--glow-a),0.42),rgba(var(--glow-b),0.18))] blur-2xl opacity-80" />
              <img
                ref={posterRef}
                src={posterUrl}
                alt={event.title}
                onLoad={extractPosterColors}
                className="relative block mx-auto max-w-full max-h-[74dvh] rounded-[1.35rem] object-contain shadow-[0_30px_100px_rgba(0,0,0,0.65)] border border-white/12 bg-black/30"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="md:pl-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur-xl">
                <Ticket size={14} />
                {statusLabel(event.status)}
              </div>
              <h1 className="mt-5 max-w-3xl text-[clamp(2.2rem,7vw,5.8rem)] leading-[0.95] font-serif tracking-normal text-white">
                {event.title}
              </h1>
              <p className="mt-6 max-w-xl text-base md:text-lg leading-8 text-white/68">
                {event.organizer ? `${event.organizer} 呈现` : "Catbeer Presents"} · {stops.length ? `${stops.length}站巡演` : event.location}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {stops.map((stop, index) => (
                  <a
                    key={`${stop.label}-${index}`}
                    href={`#stop-${index}`}
                    className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-2xl hover:bg-white/[0.11] transition-colors"
                  >
                    <p className="text-sm text-white/55">{stop.label}</p>
                    <p className="mt-2 text-xl font-medium text-white">{formatStopTime(stop.start_at)}</p>
                    <p className="mt-1 text-sm text-white/62">{stop.venue?.name_zh || stop.venue?.name || stop.venue_id}</p>
                    {!!stop.guestBands?.length && (
                      <p className="mt-2 text-xs text-white/52">with {stop.guestBands.map(band => band.name_zh || band.name).join(' / ')}</p>
                    )}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 md:px-10 md:pb-16">
          <div className="mx-auto max-w-7xl border-t border-white/10 pt-10 md:pt-14">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="text-sm text-white/45 font-mono uppercase tracking-wider">Stops</p>
                <h2 className="mt-2 text-3xl md:text-5xl font-serif">巡演站点</h2>
              </div>
              {ticketMessage && <p className="text-sm text-white/70">{ticketMessage}</p>}
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {stops.map((stop, index) => (
                <article id={`stop-${index}`} key={`${stop.label}-${index}`} className="rounded-3xl border border-white/12 bg-white/[0.07] p-5 md:p-6 backdrop-blur-2xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-white/55">{stop.venue?.city_zh}</p>
                      <h3 className="mt-1 text-2xl md:text-3xl font-serif">{stop.label}</h3>
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                      {formatStopTime(stop.start_at)}
                    </div>
                  </div>

                  <div className="mt-6 space-y-4 text-sm text-white/68">
                    <div className="flex gap-3">
                      <MapPin size={18} className="mt-0.5 text-white/55 shrink-0" />
                      <div>
                        <button
                          type="button"
                          disabled={!stop.venue}
                          onClick={() => stop.venue && setSelectedVenue(stop.venue)}
                          className="text-left text-white font-medium hover:text-[rgb(var(--glow-c))] disabled:hover:text-white"
                        >
                          {stop.venue?.name_zh || stop.venue?.name || stop.venue_id}
                        </button>
                        <p className="mt-1">{stop.venue?.address || '请先在场地库补充地址'}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <CalendarDays size={18} className="mt-0.5 text-white/55 shrink-0" />
                      <p>{stop.price_text}</p>
                    </div>
                    {!!stop.guestBands?.length && (
                      <div className="flex gap-3">
                        <Users size={18} className="mt-0.5 text-white/55 shrink-0" />
                        <p>with {stop.guestBands.map(band => band.name_zh || band.name).join(' / ')}</p>
                      </div>
                    )}
                  </div>

                  {!!stop.tickets?.length && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      {stop.tickets.map((ticket, ticketIndex) => (
                        <div key={`${ticket.label}-${ticketIndex}`} className="flex overflow-hidden rounded-full border border-white/12 bg-white text-black">
                          <button type="button" onClick={() => handleTicket(ticket)} className="px-5 py-2 text-sm font-semibold hover:bg-white/85 transition-colors">
                            {ticketLabel(ticket)}
                          </button>
                          <button type="button" onClick={() => copyTicket(ticket)} className="border-l border-black/10 px-3 hover:bg-black/5 transition-colors" aria-label="复制购票链接">
                            {ticket.url.startsWith("weixin://") ? <Copy size={16} /> : <ExternalLink size={16} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 md:px-10 md:pb-16">
          <div className="mx-auto max-w-7xl grid gap-8 lg:grid-cols-[0.9fr_1.1fr] border-t border-white/10 pt-10 md:pt-14">
            <div>
              <p className="text-sm text-white/45 font-mono uppercase tracking-wider">Lineup</p>
              <h2 className="mt-2 text-3xl md:text-5xl font-serif">演出阵容</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {lineupBands.map(({ band, notes, isGuest }) => (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => setSelectedBand(band)}
                  className="group text-left rounded-3xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-2xl hover:bg-white/[0.11] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={band.imageUrl || `https://picsum.photos/seed/${band.id}/400/300?grayscale`}
                      alt={band.name_zh}
                      className="h-16 w-16 rounded-2xl object-cover grayscale group-hover:grayscale-0 transition"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <p className="text-lg font-medium text-white">{band.name_zh || band.name}</p>
                      <p className="mt-1 text-sm text-white/55">{band.genre}</p>
                      {notes.length > 0 ? (
                        <p className="mt-2 text-xs text-white/45">{isGuest ? '嘉宾 · ' : ''}{notes.join(' / ')}</p>
                      ) : (
                        <p className="mt-2 text-xs text-white/45">全站阵容</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 md:px-10 md:pb-24">
          <div className="mx-auto max-w-7xl grid gap-8 lg:grid-cols-[0.9fr_1.1fr] border-t border-white/10 pt-10 md:pt-14">
            <div>
              <p className="text-sm text-white/45 font-mono uppercase tracking-wider">Story</p>
              <h2 className="mt-2 text-3xl md:text-5xl font-serif">演出介绍</h2>
              <div className="mt-7 flex items-center gap-3 text-white/55">
                <Music2 size={18} />
                <span>{event.organizer || "Catbeer"}</span>
              </div>
            </div>
            <div className="whitespace-pre-wrap text-base md:text-lg leading-9 text-white/72">
              {event.description}
            </div>
          </div>
        </section>
      </main>

      <BandModal band={selectedBand} onClose={() => setSelectedBand(null)} />
      <VenueModal venue={selectedVenue} onClose={() => setSelectedVenue(null)} />
    </div>
  );
}
