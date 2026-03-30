import Link from "next/link";
import { useRouter } from "next/router";

const NAV = [
  { href: "/", label: "DASHBOARD", color: "#e10600" },
  { href: "/motion", label: "MOTION", badge: "PKT 0", color: "#22d3ee" },
  { href: "/car-setups", label: "CAR SETUP", badge: "PKT 5", color: "#fbbf24" },
  { href: "/final-classification", label: "RESULTS", badge: "PKT 8", color: "#f59e0b" },
  { href: "/lobby-info", label: "LOBBY", badge: "PKT 9", color: "#a78bfa" },
  { href: "/session-history", label: "LAP LOG", badge: "PKT 11", color: "#34d399" },
  { href: "/tyre-sets", label: "TYRE SETS", badge: "PKT 12", color: "#fb923c" },
  { href: "/motion-extended", label: "DYNAMICS", badge: "PKT 13", color: "#60a5fa" },
  { href: "/time-trial", label: "TIME TRIAL", badge: "PKT 14", color: "#c084fc" },
  { href: "/lap-positions", label: "POSITIONS", badge: "PKT 15", color: "#fb7185" },
];

export function TelemetryLayout({ title, subtitle, accent = "#e10600", children }) {
  const router = useRouter();
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          "radial-gradient(ellipse 120% 60% at 15% -10%, rgba(18,22,40,1) 0%, rgba(4,5,10,1) 55%, #000 100%)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* top accent stripe */}
      <div
        className="h-[3px] w-full"
        style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent}44 60%, transparent 100%)` }}
      />

      {/* sticky header */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: "rgba(4,5,10,0.88)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <div className="mx-auto max-w-[1600px] px-5 pt-3 pb-0">
          {/* brand + title row */}
          <div className="flex items-center gap-4 mb-3">
            <Link href="/" className="flex items-baseline gap-1 shrink-0">
              <span
                className="font-black italic text-3xl tracking-tighter leading-none"
                style={{ color: "#e10600", textShadow: "0 0 30px rgba(225,6,0,0.6)" }}
              >
                F1
              </span>
              <span className="font-black italic text-xl text-white tracking-tight leading-none">
                TELEMETRY
              </span>
            </Link>
            <div
              className="h-8 w-px mx-1"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <div>
              <div className="text-sm font-bold tracking-wide text-white leading-none">{title}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 leading-none uppercase tracking-widest">
                {subtitle}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase"
                style={{ color: accent }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: accent }}
                />
                LIVE
              </span>
            </div>
          </div>

          {/* nav tabs */}
          <nav
            className="flex gap-0.5 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {NAV.map((n) => {
              const active = router.pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="shrink-0 flex flex-col items-center px-3 pt-2 pb-2.5 text-[9px] font-black tracking-[0.18em] uppercase transition-all duration-150 relative"
                  style={{
                    color: active ? n.color : "#444455",
                    background: active ? `${n.color}14` : "transparent",
                  }}
                >
                  {active && (
                    <div
                      className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-t"
                      style={{ background: n.color, boxShadow: `0 0 8px ${n.color}` }}
                    />
                  )}
                  <span
                    className="text-[7px] font-mono mb-0.5"
                    style={{ color: active ? n.color + "88" : "#2a2a38" }}
                  >
                    {n.badge}
                  </span>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-5 py-6">{children}</main>
    </div>
  );
}

export function StatCard({ label, value, sub, accent = "#e10600", glow = false, large = false }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden p-4"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${accent}28`,
        boxShadow: glow ? `0 0 32px ${accent}18, inset 0 1px 0 ${accent}20` : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent}70 0%, transparent 80%)` }}
      />
      <div
        className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2"
        style={{ color: accent + "88" }}
      >
        {label}
      </div>
      <div
        className={`font-black font-mono leading-none ${large ? "text-4xl" : "text-2xl"}`}
        style={{
          color: "#fff",
          textShadow: glow ? `0 0 24px ${accent}70` : "none",
        }}
      >
        {value ?? "-"}
      </div>
      {sub && <div className="mt-1.5 text-[10px] text-zinc-600 font-mono">{sub}</div>}
    </div>
  );
}

export function GlassPanel({ children, className = "", accent }) {
  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, accent = "#e10600" }) {
  return (
    <div
      className="text-[9px] font-black uppercase tracking-[0.25em] mb-3 flex items-center gap-2"
      style={{ color: accent }}
    >
      <span
        className="inline-block w-4 h-[1.5px]"
        style={{ background: accent }}
      />
      {children}
    </div>
  );
}

export function Bar({ value = 0, max = 100, color = "#e10600", h = 5 }) {
  const pct = Math.min(100, Math.max(0, (Number(value) / Number(max)) * 100));
  return (
    <div
      className="relative rounded-full overflow-hidden w-full"
      style={{ height: h, background: "rgba(255,255,255,0.07)" }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          boxShadow: `0 0 8px ${color}55`,
        }}
      />
    </div>
  );
}

export function DualBar({ leftLabel, leftValue, rightLabel, rightValue, max = 100, color = "#e10600" }) {
  const lp = Math.min(100, Math.max(0, (Number(leftValue) / max) * 100));
  const rp = Math.min(100, Math.max(0, (Number(rightValue) / max) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[9px] font-mono text-zinc-400">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="flex gap-1 items-center">
        <div className="flex-1 h-[5px] bg-white/5 rounded-full overflow-hidden flex justify-end">
          <div
            className="h-full rounded-full"
            style={{
              width: `${lp}%`,
              background: `linear-gradient(270deg, ${color}, ${color}55)`,
            }}
          />
        </div>
        <div className="flex-1 h-[5px] bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${rp}%`,
              background: `linear-gradient(90deg, ${color}, ${color}55)`,
            }}
          />
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-black font-mono text-white">
        <span>{Number(leftValue || 0).toFixed(1)}</span>
        <span>{Number(rightValue || 0).toFixed(1)}</span>
      </div>
    </div>
  );
}

export function JsonBlock({ value }) {
  return (
    <pre
      className="rounded-2xl p-4 text-[10px] font-mono overflow-auto max-h-[440px]"
      style={{
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.05)",
        color: "#3a7fff",
        lineHeight: 1.6,
        scrollbarWidth: "thin",
        scrollbarColor: "#1e1e2e #000",
      }}
    >
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}
