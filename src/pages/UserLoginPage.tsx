import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Beer, KeyRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function UserLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const next = searchParams.get("next") || "/";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "登录失败，请检查用户名和密码。");
        return;
      }
      localStorage.setItem("catbeerUserToken", data.token);
      window.dispatchEvent(new Event("catbeeruserchange"));
      navigate(next, { replace: true });
    } catch {
      setError("网络连接失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0a0502] pt-[calc(4.25rem+env(safe-area-inset-top))] text-white font-sans md:pt-20">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_10%,rgba(255,180,0,0.12),transparent_28%),linear-gradient(180deg,#100b08_0%,#070504_68%,#050403_100%)]" />
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-[440px] flex-col justify-center px-5 pb-10 md:px-8">
        <Link to="/" className="mb-5 inline-flex w-fit items-center gap-2 text-sm text-white/45 transition-colors hover:text-white">
          <ArrowLeft size={15} />
          返回地图
        </Link>
        <section className="rounded-xl border border-white/10 bg-[#0d0a08]/72 p-5 shadow-[0_32px_100px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-[#ffb400] text-black shadow-[0_0_26px_rgba(255,180,0,0.3)]">
              <Beer size={21} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-serif">乐迷登录</h1>
              <p className="mt-1 text-sm text-white/45">登录后为喜欢的乐队干杯</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-8">
            <label className="block">
              <span className="text-xs uppercase text-white/40">Username</span>
              <input
                value={username}
                onChange={event => setUsername(event.target.value)}
                autoCapitalize="none"
                autoComplete="username"
                placeholder="你的猫啤用户名"
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/45 px-4 text-white outline-none transition-colors placeholder:text-white/24 focus:border-[#ffb400]/70"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs uppercase text-white/40">Password</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="你的密码"
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/45 px-4 text-white outline-none transition-colors placeholder:text-white/24 focus:border-[#ffb400]/70"
              />
            </label>
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#ffb400] text-sm font-semibold text-black transition-colors hover:bg-[#ffcc3b] disabled:cursor-not-allowed disabled:opacity-60">
              <KeyRound size={16} />
              {isSubmitting ? "登录中..." : "登录并继续"}
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-6 border-t border-white/8 pt-5 text-xs leading-5 text-white/38">
            猫啤账号由 App 内首次使用 Apple 登录后创建。忘记密码时，请在 App 的“我的”中重新设置。
          </p>
        </section>
      </main>
    </div>
  );
}
