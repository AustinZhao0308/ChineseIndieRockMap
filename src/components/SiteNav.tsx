import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Music2, X } from "lucide-react";

type NavUser = {
  role?: string;
  username?: string;
  displayName?: string;
  logoUrl?: string;
};

const baseNavItems = [
  { to: "/", label: "地图", match: (path: string) => path === "/" },
  { to: "/events", label: "演出档案", match: (path: string) => path.startsWith("/events") || path.startsWith("/labels") }
];

const getStoredUser = (): NavUser | null => {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("adminToken");
  if (!token) return null;
  try {
    const payload = token.split(".")[1] || "";
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(atob(normalizedPayload));
  } catch (err) {
    return null;
  }
};

const fetchCurrentUser = async () => {
  const token = localStorage.getItem("adminToken");
  if (!token) return null;

  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    localStorage.removeItem("adminToken");
    return null;
  }

  const data = await res.json();
  return data.user as NavUser;
};

export default function SiteNav() {
  const { pathname } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<NavUser | null>(() => getStoredUser());
  const navItems = user
    ? [
      ...baseNavItems,
      { to: "/admin", label: "数据管理", match: (path: string) => path === "/admin" },
      ...(user.role === "admin"
        ? [{ to: "/admin/posts", label: "内容流", match: (path: string) => path.startsWith("/admin/posts") }]
        : [])
    ]
    : [
      ...baseNavItems,
      { to: "/user-login", label: "乐迷登录", match: (path: string) => path.startsWith("/user-login") },
      { to: "/login", label: "合作方登录", match: (path: string) => path.startsWith("/login") }
    ];

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const syncUser = () => {
      const storedUser = getStoredUser();
      setUser(storedUser);
      if (!storedUser) return;
      fetchCurrentUser()
        .then(nextUser => {
          if (!cancelled) setUser(nextUser);
        })
        .catch(() => {
          if (!cancelled) setUser(null);
        });
    };
    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("authchange", syncUser);
    window.addEventListener("focus", syncUser);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("authchange", syncUser);
      window.removeEventListener("focus", syncUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setUser(null);
    window.dispatchEvent(new Event("authchange"));
  };

  const displayName = user?.displayName || user?.username || "";
  const avatarText = Array.from(displayName.trim())[0]?.toUpperCase() || "C";
  const avatar = (sizeClass: string) => user?.logoUrl ? (
    <img
      src={user.logoUrl}
      alt={`${displayName} logo`}
      className={`${sizeClass} rounded-full border border-white/10 bg-white object-contain p-0.5`}
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className={`${sizeClass} grid place-items-center rounded-full border border-white/10 bg-white/[0.08] text-xs font-semibold text-white`}>
      {avatarText}
    </span>
  );

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 pointer-events-none">
      <div className="absolute inset-x-0 top-0 h-[calc(5.3rem+env(safe-area-inset-top))] bg-[linear-gradient(180deg,rgba(10,5,2,0.94)_0%,rgba(10,5,2,0.6)_50%,rgba(10,5,2,0)_100%)]" />
      <div className="pointer-events-auto relative flex h-[calc(3.2rem+env(safe-area-inset-top))] items-end justify-between border-b border-white/[0.045] px-5 pb-2.5 backdrop-blur-[18px] sm:px-6 md:h-[3.65rem] md:items-center md:px-10 md:pb-0 lg:px-12 xl:px-14">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-3 text-white transition-colors"
          aria-label="回到地图主页"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ff4e00] text-white shadow-[0_0_20px_rgba(255,78,0,0.32)] transition-transform group-hover:scale-105 md:h-10 md:w-10">
            <Music2 size={18} className="md:h-5 md:w-5" />
          </span>
          <span className="min-w-0 md:flex md:items-baseline md:gap-3">
            <span className="block truncate font-serif text-[18px] leading-none tracking-normal text-white md:text-[24px]">
              独立摇滚地图
            </span>
            <span className="mt-1 hidden font-mono text-[9px] uppercase leading-none text-white/36 sm:block md:mt-0 md:text-[12px] md:tracking-[0.12em]">
              Indie Rock Map
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {navItems.map(item => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`relative py-2 text-[12px] font-medium transition-colors md:font-mono md:text-[13px] md:font-semibold md:uppercase ${
                  active ? "text-white" : "text-white/42 hover:text-white/82"
                }`}
              >
                {item.label}
                <span className={`absolute inset-x-0 -bottom-[0.62rem] mx-auto h-px max-w-9 bg-[#ff6a2b] shadow-[0_0_14px_rgba(255,78,0,0.8)] transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
              </Link>
            );
          })}
          {user && (
            <div className="ml-1 flex items-center gap-3 border-l border-white/[0.08] pl-5">
              <Link to="/admin" className="flex items-center gap-2 text-white/76 transition-colors hover:text-white">
                {avatar("h-7 w-7")}
                <span className="max-w-28 truncate text-sm font-medium">{displayName}</span>
              </Link>
              <button type="button" onClick={handleLogout} className="text-xs text-white/38 transition-colors hover:text-white/72">
                退出
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.09] bg-black/28 text-white/78 shadow-[0_0_24px_rgba(255,78,0,0.1)] transition-colors hover:bg-white/[0.08] hover:text-white md:hidden"
          onClick={() => setIsMenuOpen(open => !open)}
          aria-label={isMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      <div
        className={`pointer-events-auto absolute inset-x-0 top-[calc(3.2rem+env(safe-area-inset-top))] overflow-hidden border-b border-white/[0.06] bg-[#0a0502]/88 px-5 backdrop-blur-2xl transition-[max-height,opacity] duration-300 md:hidden ${
          isMenuOpen ? "max-h-72 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-1 py-4">
          {user && (
            <div className="mb-2 flex items-center gap-3 border-b border-white/[0.055] pb-4 text-white">
              {avatar("h-8 w-8")}
              <span className="min-w-0 truncate text-sm">{displayName}</span>
            </div>
          )}
          {navItems.map(item => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-between border-b border-white/[0.055] py-4 text-base transition-colors ${
                  active ? "text-white" : "text-white/52"
                }`}
              >
                <span>{item.label}</span>
                <span className={`h-1.5 w-1.5 rounded-full bg-[#ff4e00] shadow-[0_0_16px_rgba(255,78,0,0.75)] transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
              </Link>
            );
          })}
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-between border-b border-white/[0.055] py-4 text-base text-white/52 transition-colors hover:text-white"
            >
              <span>退出登录</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
