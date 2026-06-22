import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Search, Tags } from "lucide-react";
import tingkaozaiPoster from "../pic/停靠在.JPG";

type LabelSummary = {
  id: number;
  username: string;
  display_name: string;
  logo_url?: string;
  status: string;
};

type ArchiveStop = {
  label?: string;
  start_at?: string;
  venue?: {
    name?: string;
    name_zh?: string;
    city_zh?: string;
  };
};

type ArchiveEvent = {
  id: number;
  slug?: string;
  title: string;
  date_str?: string;
  location?: string;
  image_url?: string;
  organizer?: string;
  status?: string;
  stops?: ArchiveStop[];
  label?: LabelSummary | null;
};

const statusOptions = [
  { value: "all", label: "全部状态" },
  { value: "on_sale", label: "售票中" },
  { value: "upcoming", label: "即将开始" },
  { value: "sold_out", label: "已售罄" },
  { value: "ended", label: "已结束" },
  { value: "cancelled", label: "已取消" },
  { value: "postponed", label: "已延期" }
];

const statusLabel = (status?: string) => {
  return statusOptions.find(option => option.value === status)?.label || "演出";
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

const getEventCity = (event: ArchiveEvent) => {
  return event.stops?.find(stop => stop.venue?.city_zh)?.venue?.city_zh || "";
};

const getEventVenue = (event: ArchiveEvent) => {
  const firstStop = event.stops?.[0];
  return firstStop?.venue?.name_zh || firstStop?.venue?.name || event.location || "";
};

const isTourEvent = (event: ArchiveEvent) => (event.stops?.length || 0) > 1;

const getEventDateLabel = (event: ArchiveEvent) => {
  if (!isTourEvent(event)) return event.date_str || "";
  const dates = event.stops
    ?.map(stop => stop.start_at ? new Date(stop.start_at) : null)
    .filter((date): date is Date => !!date && !Number.isNaN(date.getTime())) || [];
  if (dates.length < 2) return event.date_str || `${event.stops?.length || 0} 站巡演`;
  const formatter = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" });
  return `${formatter.format(dates[0])} - ${formatter.format(dates[dates.length - 1])}`;
};

const getEventPlaceLabel = (event: ArchiveEvent) => {
  if (!isTourEvent(event)) {
    return [getEventCity(event), getEventVenue(event)].filter(Boolean).join(" · ") || event.location || "地点待补充";
  }

  const cities = Array.from(new Set(event.stops?.map(stop => stop.venue?.city_zh).filter(Boolean) || []));
  if (cities.length <= 2) return `${cities.join(" / ")} · ${event.stops?.length || 0} 站巡演`;
  return `${cities.slice(0, 2).join(" / ")} 等 ${cities.length} 城 · ${event.stops?.length || 0} 站巡演`;
};

const sortYearDesc = (left: string, right: string) => {
  if (left === "未归档") return 1;
  if (right === "未归档") return -1;
  return Number(right) - Number(left);
};

export default function EventsArchivePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState<ArchiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [labelId, setLabelId] = useState("all");
  const [year, setYear] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetch("/api/events/archive")
      .then(res => {
        if (!res.ok) throw new Error(`Events archive API failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setEvents(data.events || []);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load events");
      })
      .finally(() => setLoading(false));
  }, []);

  const labelOptions = useMemo(() => {
    const labels = new Map<number, LabelSummary>();
    events.forEach(event => {
      if (event.label) labels.set(event.label.id, event.label);
    });
    return Array.from(labels.values()).sort((a, b) => a.display_name.localeCompare(b.display_name, "zh-Hans-CN"));
  }, [events]);

  const yearOptions = useMemo(() => {
    return Array.from(new Set(events.map(getEventYear))).sort(sortYearDesc);
  }, [events]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return events.filter(event => {
      if (status !== "all" && event.status !== status) return false;
      if (labelId !== "all" && String(event.label?.id || "") !== labelId) return false;
      if (year !== "all" && getEventYear(event) !== year) return false;

      if (!normalizedQuery) return true;
      const haystack = [
        event.title,
        event.date_str,
        event.location,
        event.organizer,
        event.label?.display_name,
        getEventCity(event),
        getEventVenue(event),
        getEventPlaceLabel(event)
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [events, labelId, query, status, year]);

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
        Loading Events...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0502] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xl text-white font-serif">演出档案加载失败</p>
        <p className="mt-3 text-sm text-white/50">{error}</p>
        <button type="button" onClick={handleBack} className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm text-white/75 hover:bg-white/10 transition-colors">
          <ArrowLeft size={16} />
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0a0502] text-white font-sans">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_6%,rgba(255,78,0,0.14),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(57,166,154,0.09),transparent_22%),linear-gradient(180deg,#17110d_0%,#0f0d0b_46%,#070605_100%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.22] bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.14] bg-[radial-gradient(circle_at_20px_18px,rgba(255,255,255,0.22)_1px,transparent_1.6px)] bg-[size:23px_23px]" />

      <header className="relative z-10 px-5 pt-[calc(4.25rem+env(safe-area-inset-top))] sm:px-6 md:px-10 md:pt-20 lg:px-12 xl:px-14">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[#ff4e00]/35 bg-[#ff4e00]/12 px-3 py-1 text-xs text-[#ffb18a]">Events</span>
                <span className="font-mono text-xs uppercase tracking-[0.32em] text-white/40">Archive Wall</span>
              </div>
              <h1 className="mt-2 text-[clamp(2rem,4vw,3.8rem)] leading-tight font-serif tracking-normal">演出档案</h1>
            </div>
            <div className="rounded-full border border-white/12 bg-black/25 px-5 py-3 text-sm text-white/62 backdrop-blur-xl">
              {filteredEvents.length} / {events.length} 场演出
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-5 pb-16 pt-6 sm:px-6 md:px-10 md:pt-7 lg:px-12 xl:px-14">
        <div className="mx-auto max-w-[1500px]">
          <section className="rounded-sm border border-white/[0.08] bg-black/20 p-3 shadow-[inset_0_0_80px_rgba(0,0,0,0.25)] md:p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(150px,0.7fr))]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={16} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="搜索演出、城市、场地、厂牌..."
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/45 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-[#ff4e00]/70"
                />
              </label>
              <select value={status} onChange={event => setStatus(event.target.value)} className="h-11 rounded-lg border border-white/10 bg-black/45 px-3 text-sm text-white outline-none focus:border-[#ff4e00]/70">
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select value={year} onChange={event => setYear(event.target.value)} className="h-11 rounded-lg border border-white/10 bg-black/45 px-3 text-sm text-white outline-none focus:border-[#ff4e00]/70">
                <option value="all">全部年份</option>
                {yearOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select value={labelId} onChange={event => setLabelId(event.target.value)} className="h-11 rounded-lg border border-white/10 bg-black/45 px-3 text-sm text-white outline-none focus:border-[#ff4e00]/70">
                <option value="all">全部厂牌</option>
                {labelOptions.map(label => (
                  <option key={label.id} value={label.id}>{label.display_name}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="relative mt-6 rounded-sm border border-white/[0.06] bg-black/[0.08] px-3 py-6 shadow-[inset_0_0_80px_rgba(0,0,0,0.34)] md:px-6 md:py-7">
            <div className="pointer-events-none absolute inset-0 opacity-[0.16] bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.05)_49%,rgba(0,0,0,0.35)_50%,transparent_52%)] bg-[size:100%_148px]" />
            {filteredEvents.length === 0 ? (
              <div className="relative py-16 text-center text-white/50">没有符合筛选条件的演出。</div>
            ) : (
              <div className="relative grid grid-cols-1 gap-y-9 sm:grid-cols-2 sm:gap-x-8 md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] md:gap-x-8 md:gap-y-10 xl:grid-cols-[repeat(auto-fill,minmax(185px,1fr))]">
                {filteredEvents.map((event, index) => {
                  const rotate = ((index % 5) - 2) * 0.35;

                  return (
                    <article key={event.id} className="group mx-auto flex w-full max-w-[292px] flex-col md:max-w-[178px] xl:max-w-[190px]">
                      <Link
                        to={getEventPath(event)}
                        className="relative block origin-center transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-hover:rotate-0"
                        style={{ transform: `rotate(${rotate}deg)` }}
                      >
                        <span className="absolute -top-3 left-1/2 z-20 h-6 w-20 -translate-x-1/2 bg-[#d6c6a0]/75 shadow-[0_2px_8px_rgba(0,0,0,0.25)] backdrop-blur-[1px]" />
                        <span className="absolute inset-0 translate-x-2.5 translate-y-3 rounded-sm bg-black/65 blur-[3px]" />
                        <span className="absolute inset-y-2 -right-1.5 w-1.5 rounded-r-sm bg-[#b9af9e] shadow-[2px_2px_8px_rgba(0,0,0,0.3)]" />
                        <div className="relative overflow-hidden rounded-[0.18rem] border border-white/20 bg-[#e7dfcf] p-[5px] shadow-[0_18px_36px_rgba(0,0,0,0.48)]">
                          <img src={resolvePosterUrl(event.image_url)} alt={event.title} className="aspect-[3/4] w-full rounded-[0.08rem] object-cover grayscale-[0.08] contrast-[1.04]" referrerPolicy="no-referrer" />
                        </div>
                      </Link>

                      <div className="mt-3 min-h-[142px] px-1 md:mt-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-white/46">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-1">
                            <Tags size={12} />
                            {statusLabel(event.status)}
                          </span>
                          {getEventDateLabel(event) && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={12} />
                              {getEventDateLabel(event)}
                            </span>
                          )}
                        </div>
                        <h2 className="mt-2 text-xl font-serif leading-tight text-white md:text-base">
                          <Link to={getEventPath(event)} className="hover:text-[#ffb18a] transition-colors">
                            {event.title}
                          </Link>
                        </h2>
                        <p className="mt-2 flex items-start gap-1.5 text-sm leading-6 text-white/50 md:text-xs md:leading-5">
                          <MapPin size={14} className="mt-1 shrink-0" />
                          {getEventPlaceLabel(event)}
                        </p>
                        {event.label && (
                          <Link to={`/labels/${event.label.username}`} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/7 px-2.5 py-1 text-xs text-white/60 hover:bg-white/12 hover:text-white transition-colors">
                            {event.label.logo_url && <img src={event.label.logo_url} alt="" className="h-4 w-4 rounded-full bg-white object-contain" referrerPolicy="no-referrer" />}
                            <span className="truncate">{event.label.display_name}</span>
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
