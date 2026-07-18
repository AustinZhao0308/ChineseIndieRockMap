import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

type LoginResponse = {
  token?: string;
  error?: string;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const next = searchParams.get("next") || "/";

  const requestLogin = async (path: string) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    return { response, data: await response.json() as LoginResponse };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const appLogin = await requestLogin("/api/auth/password/login");
      if (appLogin.response.ok && appLogin.data.token) {
        localStorage.removeItem("adminToken");
        localStorage.setItem("catbeerUserToken", appLogin.data.token);
        window.dispatchEvent(new Event("catbeeruserchange"));
        window.dispatchEvent(new Event("authchange"));
        navigate(next, { replace: true });
        return;
      }

      const mapLogin = await requestLogin("/api/login");
      if (mapLogin.response.ok && mapLogin.data.token) {
        localStorage.removeItem("catbeerUserToken");
        localStorage.setItem("adminToken", mapLogin.data.token);
        window.dispatchEvent(new Event("catbeeruserchange"));
        window.dispatchEvent(new Event("authchange"));
        navigate(next, { replace: true });
        return;
      }

      setError("用户名或密码不正确，请重试。");
    } catch {
      setError("网络连接失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0a0502] pt-[calc(4.25rem+env(safe-area-inset-top))] font-sans text-white md:pt-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,78,0,0.13),transparent_26%),linear-gradient(180deg,#100b08_0%,#070504_68%,#050403_100%)]" />
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-[440px] flex-col justify-center px-5 pb-10 md:px-8">
        <Link to="/" className="mb-5 inline-flex w-fit items-center gap-2 text-sm text-white/45 transition-colors hover:text-white">
          <ArrowLeft size={15} />
          返回地图
        </Link>

        <section className="rounded-xl border border-white/10 bg-[#0d0a08]/72 p-5 shadow-[0_32px_100px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-[#ff4e00] text-white shadow-[0_0_26px_rgba(255,78,0,0.35)]">
              <KeyRound size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-serif">登录</h1>
              <p className="mt-1 text-sm text-white/45">使用你的用户名和密码继续</p>
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
                placeholder="输入用户名"
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/45 px-4 text-white outline-none transition-colors placeholder:text-white/24 focus:border-[#ff4e00]/70"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs uppercase text-white/40">Password</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="输入密码"
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/45 px-4 text-white outline-none transition-colors placeholder:text-white/24 focus:border-[#ff4e00]/70"
              />
            </label>
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-black transition-colors hover:bg-white/88 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? "登录中..." : "登录"}
              <ArrowRight size={16} />
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
