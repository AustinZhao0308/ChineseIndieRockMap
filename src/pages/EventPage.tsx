import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Copy, ExternalLink, MapPin, PenLine, QrCode, Ticket, Users } from "lucide-react";
import BandModal from "../components/BandModal";
import VenueModal from "../components/VenueModal";
import { Band, Venue } from "../data";
import tingkaozaiPoster from "../pic/停靠在.JPG";

type EventTicket = {
  label: string;
  url: string;
};

type EventRecapPhoto = {
  title?: string;
  caption?: string;
  image_url: string;
};

type EventRecapVideo = {
  title?: string;
  url?: string;
};

type EventStop = {
  id?: string;
  label: string;
  start_at?: string;
  venue_id?: string;
  guestBandIds?: string[];
  guestBands?: Band[];
  price_text?: string;
  tickets?: EventTicket[];
  recap_photos?: EventRecapPhoto[];
  recap_video?: EventRecapVideo;
  venue?: Venue;
};

type EventLineupDay = {
  day: string;
  bandIds?: string[];
  bands?: Band[];
};

type EventQrCode = {
  title: string;
  image_url: string;
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
  qr_codes?: EventQrCode[];
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

const stopKey = (stop: EventStop, index: number) => stop.id || stop.label || `stop-${index}`;

const hasStopRecap = (stop: EventStop) => {
  return !!stop.recap_photos?.some(photo => photo.image_url) || !!stop.recap_video?.url;
};

const getBilibiliEmbedUrl = (url?: string) => {
  if (!url) return "";
  const playerOptions = "page=1&autoplay=0&high_quality=1&quality=80";
  const bvMatch = url.match(/\/video\/(BV[a-zA-Z0-9]+)/i) || url.match(/[?&]bvid=(BV[a-zA-Z0-9]+)/i);
  if (bvMatch?.[1]) {
    return `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&${playerOptions}`;
  }

  try {
    const parsed = new URL(url);
    const aid = parsed.searchParams.get("aid");
    const cid = parsed.searchParams.get("cid");
    if (aid && cid) {
      return `https://player.bilibili.com/player.html?aid=${aid}&cid=${cid}&${playerOptions}`;
    }
  } catch (err) {
    return "";
  }

  return "";
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
  const [activeRecapKey, setActiveRecapKey] = useState("");
  const [recapPhotoIndexes, setRecapPhotoIndexes] = useState<Record<string, number>>({});

  const isAdmin = typeof window !== "undefined" && !!localStorage.getItem("adminToken");
  const posterUrl = resolvePosterUrl(event?.image_url);
  const stops = event?.stops?.length ? event.stops : [];
  const recapStops = useMemo(() => {
    if (event?.status !== "ended") return [];
    return stops.filter(hasStopRecap);
  }, [event?.status, stops]);
  const activeRecapStop = recapStops.find((stop, index) => stopKey(stop, index) === activeRecapKey) || recapStops[0];
  const activeRecapStopKey = activeRecapStop ? stopKey(activeRecapStop, stops.indexOf(activeRecapStop)) : "";
  const activeRecapPhotos = activeRecapStop?.recap_photos?.filter(photo => photo.image_url) || [];
  const activeRecapPhotoIndex = Math.min(recapPhotoIndexes[activeRecapStopKey] || 0, Math.max(activeRecapPhotos.length - 1, 0));
  const activeRecapPhoto = activeRecapPhotos[activeRecapPhotoIndex];
  const hasActiveRecapPhoto = !!activeRecapPhoto;
  const hasActiveRecapVideo = !!activeRecapStop?.recap_video?.url;
  const recapMediaGridClass = hasActiveRecapPhoto && hasActiveRecapVideo
    ? "grid gap-5 lg:grid-cols-2 lg:items-start"
    : "grid gap-5 max-w-5xl";
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
    if (!recapStops.length) {
      setActiveRecapKey("");
      return;
    }
    if (!recapStops.some((stop, index) => stopKey(stop, index) === activeRecapKey)) {
      setActiveRecapKey(stopKey(recapStops[0], stops.indexOf(recapStops[0])));
    }
  }, [activeRecapKey, recapStops, stops]);

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

  const moveRecapPhoto = (direction: number) => {
    if (!activeRecapStopKey || activeRecapPhotos.length <= 1) return;
    const nextIndex = (activeRecapPhotoIndex + direction + activeRecapPhotos.length) % activeRecapPhotos.length;
    setRecapPhotoIndexes(prev => ({ ...prev, [activeRecapStopKey]: nextIndex }));
  };

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-[#080705] flex items-center justify-center text-[#ff6a2b] font-mono">
        Loading Event...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-[100svh] bg-[#080705] flex flex-col items-center justify-center gap-5 px-6 text-center">
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
      className="min-h-[100svh] bg-[#080705] text-white font-sans overflow-hidden"
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

      <main className="relative z-10 flex flex-col">
        <section className="order-0 min-h-[100svh] px-4 pt-24 pb-8 md:min-h-screen md:px-10 md:pt-28 md:pb-16 flex items-center">
          <div className="mx-auto w-full max-w-7xl grid gap-8 md:grid-cols-[minmax(320px,0.86fr)_minmax(420px,1.14fr)] md:items-center">
            <div className="relative mx-auto w-full max-w-[420px] md:max-w-[520px]">
              <div className="absolute -inset-5 rounded-[2rem] bg-[linear-gradient(135deg,rgba(var(--glow-a),0.42),rgba(var(--glow-b),0.18))] blur-2xl opacity-80" />
              <img
                ref={posterRef}
                src={posterUrl}
                alt={event.title}
                onLoad={extractPosterColors}
                className="relative block mx-auto max-w-full max-h-[68svh] md:max-h-[74vh] rounded-[1.35rem] object-contain shadow-[0_30px_100px_rgba(0,0,0,0.65)] border border-white/12 bg-black/30"
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

              <div className="mt-8 hidden gap-3 md:grid md:grid-cols-2">
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

        <section className="order-2 px-4 pb-10 md:px-10 md:pb-16">
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

        {!!recapStops.length && activeRecapStop && (
          <section className="order-1 px-4 pb-10 md:px-10 md:pb-16">
            <div className="mx-auto max-w-7xl border-t border-white/10 pt-10 md:pt-14">
              <div>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                  <p className="text-sm text-white/45 font-mono uppercase tracking-wider">Recap</p>
                  <h2 className="mt-2 text-3xl md:text-5xl font-serif">演出回顾</h2>
                  <p className="mt-5 max-w-sm text-sm leading-7 text-white/55">
                    现场照片与视频记录，按巡演站点归档。
                  </p>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 lg:justify-end lg:overflow-visible lg:pb-0">
                    {recapStops.map((stop, index) => {
                      const key = stopKey(stop, stops.indexOf(stop));
                      const isActive = key === activeRecapStopKey;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveRecapKey(key)}
                          className={`min-w-[8.5rem] rounded-2xl border px-4 py-3 text-left transition-colors md:min-w-[10rem] ${
                            isActive
                              ? "border-white/25 bg-white/16 text-white"
                              : "border-white/10 bg-white/[0.06] text-white/62 hover:bg-white/[0.1]"
                          }`}
                        >
                          <span className="block text-sm font-medium">{stop.label}</span>
                          <span className="mt-1 block text-xs text-white/45">
                            {[formatStopTime(stop.start_at), stop.venue?.name_zh || stop.venue?.name].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-9">
                  <div className="mb-5">
                    <p className="text-sm text-white/50">{activeRecapStop.venue?.name_zh || activeRecapStop.venue?.name}</p>
                    <h3 className="mt-1 text-2xl md:text-4xl font-serif">{activeRecapStop.label}回顾</h3>
                  </div>

                  <div className={recapMediaGridClass}>
                    {hasActiveRecapPhoto && (
                      <div className="group relative">
                        <div className="absolute -inset-4 rounded-[2rem] bg-[linear-gradient(135deg,rgba(var(--glow-a),0.34),rgba(var(--glow-b),0.16))] blur-2xl opacity-70" />
                        <div className="relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-white/[0.06] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
                          <img
                            src={activeRecapPhoto.image_url}
                            alt={activeRecapPhoto.title || `${activeRecapStop.label}回顾照片`}
                            className="aspect-video w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 to-transparent px-4 pb-16 pt-10 md:px-6 md:pb-16 md:pt-14">
                            {(activeRecapPhoto.title || activeRecapPhoto.caption) && (
                              <div>
                                {activeRecapPhoto.title && <p className="text-base md:text-lg font-medium text-white">{activeRecapPhoto.title}</p>}
                                {activeRecapPhoto.caption && <p className="mt-1 text-sm text-white/65">{activeRecapPhoto.caption}</p>}
                              </div>
                            )}
                          </div>
                          {activeRecapPhotos.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={() => moveRecapPhoto(-1)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/35 p-2 text-white/80 backdrop-blur-xl hover:bg-white/15"
                                aria-label="上一张回顾照片"
                              >
                                <ChevronLeft size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveRecapPhoto(1)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/35 p-2 text-white/80 backdrop-blur-xl hover:bg-white/15"
                                aria-label="下一张回顾照片"
                              >
                                <ChevronRight size={18} />
                              </button>
                            </>
                          )}
                          {activeRecapPhotos.length > 1 && (
                            <div className="absolute left-1/2 bottom-4 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-black/45 px-3 py-2 shadow-[0_10px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl md:bottom-5">
                              <div className="flex items-center justify-center gap-1.5">
                                {activeRecapPhotos.map((photo, index) => (
                                  <button
                                    key={`${photo.image_url}-${index}`}
                                    type="button"
                                    onClick={() => setRecapPhotoIndexes(prev => ({ ...prev, [activeRecapStopKey]: index }))}
                                    className={`h-2.5 rounded-full transition-all ${index === activeRecapPhotoIndex ? "w-8 bg-white shadow-[0_0_14px_rgba(255,255,255,0.5)]" : "w-2.5 bg-white/45 hover:bg-white/75"}`}
                                    aria-label={`查看第 ${index + 1} 张回顾照片`}
                                  />
                                ))}
                              </div>
                              <span className="font-mono text-[11px] leading-none text-white/70">
                                {activeRecapPhotoIndex + 1}/{activeRecapPhotos.length}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {hasActiveRecapVideo && (
                      <div className="relative">
                        <div className="absolute -inset-4 rounded-[2rem] bg-[linear-gradient(135deg,rgba(var(--glow-b),0.28),rgba(var(--glow-c),0.12))] blur-2xl opacity-60" />
                        <div className="relative aspect-video overflow-hidden rounded-[1.6rem] border border-white/12 bg-white/[0.06] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
                          {getBilibiliEmbedUrl(activeRecapStop.recap_video.url) ? (
                            <iframe
                              src={getBilibiliEmbedUrl(activeRecapStop.recap_video.url)}
                              title={activeRecapStop.recap_video.title || `${activeRecapStop.label} B站回顾`}
                              className="h-full w-full"
                              allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
                              allowFullScreen
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="grid h-full place-items-center px-6 text-center text-sm text-white/55">
                              当前视频链接暂不支持内嵌播放
                            </div>
                          )}
                          <a
                            href={activeRecapStop.recap_video.url}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/35 p-2 text-white/70 backdrop-blur-xl transition-colors hover:bg-white/15 hover:text-white"
                            aria-label="打开 B站视频"
                          >
                            <ExternalLink size={17} className="text-white/45" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="order-3 px-4 pb-10 md:px-10 md:pb-16">
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

        <section className="order-4 px-4 pb-20 md:px-10 md:pb-24">
          <div className="mx-auto max-w-7xl grid gap-8 lg:grid-cols-[0.9fr_1.1fr] border-t border-white/10 pt-10 md:pt-14">
            <div>
              <p className="text-sm text-white/45 font-mono uppercase tracking-wider">Story</p>
              <h2 className="mt-2 text-3xl md:text-5xl font-serif">演出介绍</h2>
            </div>
            <div className="whitespace-pre-wrap text-base md:text-lg leading-9 text-white/72">
              {event.description}
            </div>
          </div>
        </section>

        {!!event.qr_codes?.length && (
          <section className="order-5 px-4 pb-20 md:px-10 md:pb-24">
            <div className="mx-auto max-w-7xl grid gap-8 lg:grid-cols-[0.9fr_1.1fr] border-t border-white/10 pt-10 md:pt-14">
              <div>
                <p className="text-sm text-white/45 font-mono uppercase tracking-wider">QR Codes</p>
                <h2 className="mt-2 text-3xl md:text-5xl font-serif">二维码</h2>
                <div className="mt-7 flex items-center gap-3 text-white/55">
                  <QrCode size={18} />
                  <span>微信 / 关注 / 联系</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
                {event.qr_codes.map((qrCode, index) => (
                  <div key={`${qrCode.title}-${index}`} className="group text-center">
                    <div className="relative mx-auto w-full max-w-24 sm:max-w-32 md:max-w-52">
                      <div className="absolute -inset-2 rounded-3xl bg-[linear-gradient(135deg,rgba(var(--glow-a),0.3),rgba(var(--glow-b),0.14))] blur-xl opacity-70 transition-opacity group-hover:opacity-100 md:-inset-4 md:rounded-[2rem] md:blur-2xl" />
                      <div className="relative aspect-square rounded-2xl border border-white/12 bg-white p-1.5 shadow-[0_18px_52px_rgba(0,0,0,0.42)] sm:p-2 md:rounded-[1.35rem] md:p-3 md:shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
                        <img
                          src={qrCode.image_url}
                          alt={qrCode.title}
                          className="h-full w-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-medium leading-snug text-white/85 md:mt-5 md:text-base md:text-white">{qrCode.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <BandModal band={selectedBand} onClose={() => setSelectedBand(null)} />
      <VenueModal venue={selectedVenue} onClose={() => setSelectedVenue(null)} />
    </div>
  );
}
