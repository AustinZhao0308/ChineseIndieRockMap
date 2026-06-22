import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Copy, Lock, ShieldCheck, UserRound } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const next = searchParams.get("next") || "/";

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登录失败，请检查密码");
        return;
      }

      localStorage.setItem("adminToken", data.token);
      window.dispatchEvent(new Event("authchange"));
      navigate(next, { replace: true });
    } catch (err) {
      setError("网络连接失败，请稍后再试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyContact = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText("catbeer_music");
      setMessage("已复制 catbeer_music");
    } catch (err) {
      setMessage("请手动复制：catbeer_music");
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0a0502] pt-[calc(4.25rem+env(safe-area-inset-top))] text-white font-sans md:pt-20">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_10%,rgba(255,78,0,0.13),transparent_26%),radial-gradient(circle_at_85%_85%,rgba(57,166,154,0.06),transparent_26%),linear-gradient(180deg,#100b08_0%,#070504_68%,#050403_100%)]" />

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-[480px] flex-col justify-center px-5 pb-10 md:px-8">
        <Link to="/" className="mb-5 inline-flex w-fit items-center gap-2 text-sm text-white/45 transition-colors hover:text-white">
          <ArrowLeft size={15} />
          返回地图
        </Link>

        <section className="relative">
          <div className="absolute -inset-4 rounded-[1.6rem] bg-[radial-gradient(circle_at_50%_0%,rgba(255,78,0,0.18),transparent_55%)] blur-2xl" />
          <div className="relative rounded-xl border border-white/10 bg-[#0d0a08]/72 p-4 shadow-[0_32px_100px_rgba(0,0,0,0.46)] backdrop-blur-2xl md:p-5">
            <div className="grid grid-cols-2 rounded-lg border border-white/[0.08] bg-black/35 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                }}
                className={`h-10 rounded-md text-sm transition-colors ${mode === "login" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                  setMessage("");
                }}
                className={`h-10 rounded-md text-sm transition-colors ${mode === "register" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}
              >
                注册申请
              </button>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="pt-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff4e00] text-white shadow-[0_0_26px_rgba(255,78,0,0.35)]">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif">账号登录</h2>
                    <p className="mt-1 text-sm text-white/45">登录厂牌账号</p>
                  </div>
                </div>

                <label className="mt-8 block">
                  <span className="text-xs uppercase text-white/40">Username</span>
                  <input
                    type="text"
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    placeholder="输入账号"
                    className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/45 px-4 text-white outline-none transition-colors placeholder:text-white/24 focus:border-[#ff4e00]/70"
                    autoComplete="username"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-xs uppercase text-white/40">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="输入密码"
                    className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/45 px-4 text-white outline-none transition-colors placeholder:text-white/24 focus:border-[#ff4e00]/70"
                    autoComplete="current-password"
                  />
                </label>
                {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-black transition-colors hover:bg-white/88 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "登录中..." : "登录"}
                  <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              <div className="pt-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-white/[0.08] text-white/78">
                    <UserRound size={18} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif">账号注册申请</h2>
                    <p className="mt-1 text-sm text-white/45">厂牌、乐队、场地与合作方</p>
                  </div>
                </div>

                <div className="mt-8 rounded-lg border border-white/10 bg-black/30 p-4">
                  <p className="text-sm leading-7 text-white/60">
                    厂牌账号暂不开放自助注册。请联系 <span className="font-mono text-[#ffb18a]">catbeer_music</span> 申请开通账号。
                  </p>
                </div>
                {message && <p className="mt-4 text-sm leading-6 text-[#ffb18a]">{message}</p>}
                <button type="button" onClick={handleCopyContact} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.08] text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]">
                  <Copy size={16} />
                  复制联系方式
                </button>
                <p className="mt-4 flex gap-2 text-xs leading-5 text-white/38">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                  账号由 Catbeer 审核开通后即可登录。
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
