import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Ticket } from "lucide-react";
import tingkaozaiPoster from "../pic/停靠在.JPG";

type LabelInfo = {
  id: number;
  username: string;
  display_name: string;
  logo_url?: string;
  status: string;
};

type ArchivePhoto = {
  title?: string;
  caption?: string;
  image_url: string;
};

type ArchiveStop = {
  label?: string;
  start_at?: string;
  venue_id?: string;
  venue?: {
    name?: string;
    name_zh?: string;
    city_zh?: string;
  };
  recap_photos?: ArchivePhoto[];
};

type ArchiveEvent = {
  id: number;
  slug?: string;
  title: string;
  date_str?: string;
  location?: string;
  image_url?: string;
  status?: string;
  stops?: ArchiveStop[];
};

const resolvePosterUrl = (url?: string) => {
  if (!url) return tingkaozaiPoster;
  if (url.includes("停靠在.JPG")) return tingkaozaiPoster;
  return url;
};

const getEventPath = (event: ArchiveEvent) => `/events/${event.slug || event.id}`;

const getEventYear = (event: ArchiveEvent) => {
  const stopYear = event.stops
    ?.map(stop => stop.start_at ? new Date(stop.start_at).getFullYear() : 0)
    .find(year => Number.isFinite(year) && year > 1970);
  if (stopYear) return String(stopYear);

  const dateMatch = event.date_str?.match(/\b(20\d{2}|19\d{2})\b/);
  return dateMatch?.[1] || "未归档";
};

const getEventMeta = (event: ArchiveEvent) => {
  if ((event.stops?.length || 0) > 1) {
    const cities = Array.from(new Set(event.stops?.map(stop => stop.venue?.city_zh).filter(Boolean) || []));
    const cityText = cities.length > 2 ? `${cities.slice(0, 2).join(" / ")} 等 ${cities.length} 城` : cities.join(" / ");
    return [getEventDateLabel(event), cityText, `${event.stops?.length || 0} 站巡演`].filter(Boolean).join(" · ");
  }

  const firstStop = event.stops?.[0];
  const venue = firstStop?.venue?.name_zh || firstStop?.venue?.name || event.location;
  const city = firstStop?.venue?.city_zh;
  return [getEventDateLabel(event), city, venue].filter(Boolean).join(" · ");
};

const getEventDateLabel = (event: ArchiveEvent) => {
  if ((event.stops?.length || 0) <= 1) return event.date_str || "";
  const dates = event.stops
    ?.map(stop => stop.start_at ? new Date(stop.start_at) : null)
    .filter((date): date is Date => !!date && !Number.isNaN(date.getTime())) || [];
  if (dates.length < 2) return event.date_str || `${event.stops?.length || 0} 站巡演`;
  const formatter = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" });
  return `${formatter.format(dates[0])} - ${formatter.format(dates[dates.length - 1])}`;
};

const getRecapPhotos = (event: ArchiveEvent) => {
  return event.stops
    ?.flatMap(stop => stop.recap_photos || [])
    .filter(photo => photo.image_url)
    .slice(0, 1) || [];
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

const posterOffsets = [
  "",
  "",
  "",
  "",
  ""
];

export default function LabelArchivePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [label, setLabel] = useState<LabelInfo | null>(null);
  const [events, setEvents] = useState<ArchiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/labels/${encodeURIComponent(username || "")}/archive`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? "Label not found" : `Label archive API failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setLabel(data.label);
        setEvents(data.events || []);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load label archive");
      })
      .finally(() => setLoading(false));
  }, [username]);

  const groupedEvents = useMemo(() => {
    const groups = events.reduce<Record<string, ArchiveEvent[]>>((acc, event) => {
      const year = getEventYear(event);
      acc[year] = acc[year] || [];
      acc[year].push(event);
      return acc;
    }, {});

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "未归档") return 1;
      if (b === "未归档") return -1;
      return Number(b) - Number(a);
    });
  }, [events]);

  const handleBack = () => {
    if (location.key && location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0502] flex items-center justify-center text-[#ff4e00] font-mono">
        Loading Archive...
      </div>
    );
  }

  if (error || !label) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0502] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xl text-white font-serif">档案暂未开放</p>
        <p className="mt-3 text-sm text-white/50">{error || "Label not found"}</p>
        <button type="button" onClick={handleBack} className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm text-white/75 hover:bg-white/10 transition-colors">
          <ArrowLeft size={16} />
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0a0502] text-white font-sans">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_8%,rgba(255,78,0,0.13),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(57,166,154,0.08),transparent_22%),linear-gradient(180deg,#17110d_0%,#0f0d0b_48%,#070605_100%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.24] bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.16] bg-[radial-gradient(circle_at_20px_18px,rgba(255,255,255,0.22)_1px,transparent_1.6px)] bg-[size:23px_23px]" />
      <div className="absolute inset-x-0 bottom-0 h-[240px] pointer-events-none bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_30%,rgba(0,0,0,0.82)_100%)]" />
      <div className="absolute bottom-10 left-8 hidden h-24 w-36 rounded-sm border border-white/[0.08] bg-black/35 shadow-[0_20px_50px_rgba(0,0,0,0.55),inset_0_0_0_8px_rgba(255,255,255,0.025)] md:block">
        <div className="absolute left-5 top-5 h-12 w-12 rounded-full border border-white/[0.08] bg-black/25" />
        <div className="absolute bottom-4 left-5 right-5 h-2 rounded-full bg-white/[0.06]" />
      </div>
      <div className="absolute bottom-8 right-20 hidden h-px w-64 rotate-[-7deg] pointer-events-none bg-white/10 shadow-[18px_8px_0_rgba(255,255,255,0.05),42px_14px_0_rgba(255,255,255,0.035)] md:block" />
      <div className="absolute left-[8%] top-[18%] hidden h-8 w-32 -rotate-6 bg-[#d6c6a0]/10 blur-[0.2px] md:block" />
      <div className="absolute right-[13%] top-[28%] hidden h-7 w-24 rotate-3 bg-[#d6c6a0]/10 blur-[0.2px] md:block" />

      <header className="relative z-10 px-5 pt-[calc(4.25rem+env(safe-area-inset-top))] sm:px-6 md:px-10 md:pt-20 lg:px-12 xl:px-14">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[#ff4e00]/35 bg-[#ff4e00]/12 px-3 py-1 text-xs text-[#ffb18a]">已入驻</span>
                <span className="font-mono text-xs uppercase tracking-[0.32em] text-white/40">Poster Archive</span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                {label.logo_url && (
                  <img
                    src={label.logo_url}
                    alt={`${label.display_name} logo`}
                    className="h-14 w-14 rounded-xl border border-white/12 bg-white object-contain p-2 shadow-[0_12px_32px_rgba(0,0,0,0.35)] md:h-16 md:w-16"
                    referrerPolicy="no-referrer"
                  />
                )}
                <h1 className="min-w-0 truncate text-[clamp(1.75rem,3vw,3rem)] leading-tight font-serif tracking-normal">
                  {label.display_name}
                </h1>
              </div>
            </div>
            <div className="rounded-full border border-white/12 bg-black/25 px-5 py-3 text-sm text-white/62 backdrop-blur-xl">
              {events.length} 场演出 · {groupedEvents.length} 个年份
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-5 pb-16 pt-6 sm:px-6 md:px-10 md:pt-7 lg:px-12 xl:px-14">
        <div className="mx-auto max-w-[1500px]">
          {events.length === 0 ? (
            <section className="min-h-[45vh] rounded-[0.5rem] border border-white/10 bg-black/20 p-8 shadow-[inset_0_0_80px_rgba(0,0,0,0.45)] md:p-12">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/35">No Posters</p>
              <h2 className="mt-4 text-3xl font-serif text-white/90">档案墙还空着</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/52">
                当演出绑定到这个厂牌后，海报会按年份自动贴到这里。
              </p>
            </section>
          ) : (
            <div className="space-y-14 md:space-y-18">
              {groupedEvents.map(([year, yearEvents]) => (
                <section key={year} className="relative">
                  <div className="mb-5 flex items-center gap-4 md:mb-6">
                    <h2 className="font-mono text-3xl text-white/80 md:text-3xl">{year}</h2>
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-sm text-white/45">{yearEvents.length} posters</span>
                  </div>

                  <div className="relative rounded-sm border border-white/[0.06] bg-black/[0.08] px-3 py-6 shadow-[inset_0_0_80px_rgba(0,0,0,0.34)] md:px-6 md:py-7">
                    <div className="pointer-events-none absolute inset-0 opacity-[0.18] bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.05)_49%,rgba(0,0,0,0.35)_50%,transparent_52%)] bg-[size:100%_148px]" />
                    <div className="pointer-events-none absolute left-8 top-8 hidden h-2 w-2 rounded-full bg-black/45 shadow-[0_0_0_1px_rgba(255,255,255,0.08),180px_36px_0_rgba(0,0,0,0.35),520px_12px_0_rgba(0,0,0,0.30),860px_54px_0_rgba(0,0,0,0.32)] md:block" />
                    <div className="relative grid grid-cols-1 gap-y-9 sm:grid-cols-2 sm:gap-x-8 md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] md:gap-x-8 md:gap-y-10 xl:grid-cols-[repeat(auto-fill,minmax(185px,1fr))]">
                    {yearEvents.map((event, index) => {
                      const recapPhotos = getRecapPhotos(event);
                      const rotate = ((index % 5) - 2) * 0.45;
                      const tapeRotate = index % 2 === 0 ? -4 : 4;

                      return (
                        <article key={event.id} className={`${posterOffsets[index % posterOffsets.length]} group relative mx-auto flex w-full max-w-[292px] flex-col md:max-w-[178px] xl:max-w-[190px]`}>
                          <div className="relative h-[330px] md:h-[230px] xl:h-[245px]">
                            <Link
                              to={getEventPath(event)}
                              className="absolute inset-x-0 top-0 block origin-center transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-hover:rotate-0"
                              style={{ transform: `rotate(${rotate}deg)` }}
                            >
                              <span
                                className="absolute -top-3 left-1/2 z-20 h-6 w-20 -translate-x-1/2 bg-[#d6c6a0]/75 shadow-[0_2px_8px_rgba(0,0,0,0.25)] backdrop-blur-[1px] before:absolute before:inset-0 before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)] before:opacity-60"
                                style={{ transform: `translateX(-50%) rotate(${tapeRotate}deg)` }}
                              />
                              <span className="absolute inset-0 translate-x-2.5 translate-y-3 rounded-sm bg-black/65 blur-[3px]" />
                              <span className="absolute inset-y-2 -right-1.5 w-1.5 rounded-r-sm bg-[#b9af9e] shadow-[2px_2px_8px_rgba(0,0,0,0.3)]" />
                              <div className="relative overflow-hidden rounded-[0.18rem] border border-white/20 bg-[#e7dfcf] p-[5px] shadow-[0_18px_36px_rgba(0,0,0,0.48)]">
                                <div className="absolute inset-x-[5px] top-[5px] z-10 h-5 bg-gradient-to-b from-white/22 to-transparent" />
                                <img
                                  src={resolvePosterUrl(event.image_url)}
                                  alt={event.title}
                                  className="aspect-[3/4] w-full rounded-[0.08rem] object-cover grayscale-[0.12] contrast-[1.04]"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-[5px] rounded-[0.08rem] ring-1 ring-black/10" />
                              </div>
                            </Link>

                            {recapPhotos.map((photo, photoIndex) => (
                              <Link
                                key={`${photo.image_url}-${photoIndex}`}
                                to={getEventPath(event)}
                                className="absolute -right-5 top-12 z-30 hidden w-12 rotate-5 bg-[#f4ead7] p-1 pb-3 shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:-translate-y-1 md:block xl:w-14"
                              >
                                <img src={photo.image_url} alt={photo.title || event.title} className="aspect-square w-full object-cover" referrerPolicy="no-referrer" />
                              </Link>
                            ))}
                          </div>

                          <div className="mt-3 min-h-[132px] px-1 md:mt-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/46">
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-1">
                                <Ticket size={12} />
                                {statusLabel(event.status)}
                              </span>
                              {getEventDateLabel(event) && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays size={12} />
                                  {getEventDateLabel(event)}
                                </span>
                              )}
                            </div>
                            <h3 className="mt-2 text-xl font-serif leading-tight text-white md:text-base">
                              <Link to={getEventPath(event)} className="hover:text-[#ffb18a] transition-colors">
                                {event.title}
                              </Link>
                            </h3>
                            {getEventMeta(event) && (
                              <p className="mt-2 flex items-start gap-1.5 text-sm leading-6 text-white/50 md:text-xs md:leading-5">
                                <MapPin size={14} className="mt-1 shrink-0" />
                                {getEventMeta(event)}
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
