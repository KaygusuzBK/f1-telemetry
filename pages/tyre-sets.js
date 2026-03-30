import { useLiveSummary, formatDate } from "../telemetry-hook";
import { TelemetryLayout, StatCard, GlassPanel, SectionLabel, JsonBlock } from "../telemetry-layout";

const ACCENT = "#fb923c";

const COMPOUND_META = {
  16: { label: "C5", color: "#ef4444", sub: "Soft+" },
  17: { label: "C4", color: "#f87171", sub: "Soft" },
  18: { label: "C3", color: "#fb923c", sub: "Medium" },
  19: { label: "C2", color: "#fbbf24", sub: "Hard" },
  20: { label: "C1", color: "#e5e7eb", sub: "Hard+" },
  7:  { label: "INT", color: "#22c55e", sub: "Inter" },
  8:  { label: "WET", color: "#3b82f6", sub: "Full Wet" },
  9:  { label: "DRY", color: "#f97316", sub: "Dry" },
  10: { label: "SS", color: "#dc2626", sub: "Super Soft" },
  11: { label: "S", color: "#ef4444", sub: "Soft" },
  12: { label: "M", color: "#fbbf24", sub: "Medium" },
  13: { label: "H", color: "#d1d5db", sub: "Hard" },
};

function WearCircle({ wear = 0, size = 64, color }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, Number(wear)));
  const remaining = 100 - pct;
  const dashFill = (remaining / 100) * circ;
  const trackColor = pct > 70 ? "#f87171" : pct > 40 ? "#fbbf24" : color;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${dashFill} ${circ}`}
        style={{ filter: `drop-shadow(0 0 4px ${trackColor}80)` }}
      />
    </svg>
  );
}

function TyreCard({ set }) {
  const compound = COMPOUND_META[set.visualTyreCompound] ?? COMPOUND_META[set.actualTyreCompound] ?? { label: "?", color: ACCENT, sub: "" };
  const wearColor = set.wearPct > 70 ? "#f87171" : set.wearPct > 40 ? "#fbbf24" : "#34d399";

  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden transition-all duration-200"
      style={{
        background: set.fitted ? `${compound.color}0d` : "rgba(255,255,255,0.02)",
        border: set.fitted
          ? `1px solid ${compound.color}50`
          : set.available
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(255,255,255,0.03)",
        opacity: set.available ? 1 : 0.4,
        boxShadow: set.fitted ? `0 0 24px ${compound.color}20` : "none",
      }}
    >
      {set.fitted && (
        <div
          className="absolute top-2.5 right-2.5 text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ color: compound.color, background: compound.color + "20", border: `1px solid ${compound.color}40` }}
        >
          FITTED
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <WearCircle wear={set.wearPct} color={compound.color} size={52} />
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
          >
            <span
              className="text-[10px] font-black leading-none"
              style={{ color: compound.color }}
            >
              {compound.label}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black font-mono leading-none" style={{ color: wearColor }}>
              {set.wearPct}
            </span>
            <span className="text-[10px] text-zinc-500">% worn</span>
          </div>
          <div className="text-[9px] text-zinc-500 mt-0.5">{compound.sub}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-2 text-[9px] text-zinc-500 font-mono">
            <span>Life {set.lifeSpanLaps}L</span>
            <span>Use {set.usableLifeLaps}L</span>
            <span>Δ {set.lapDeltaTimeMs}ms</span>
            <span>Set #{set.index}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TyreSetsPage() {
  const { summary } = useLiveSummary();
  const packet = summary?.latestTyreSets;
  const sets = packet?.tyreSets || [];
  const fitted = sets.find((s) => s.fitted);
  const available = sets.filter((s) => s.available && !s.fitted);

  return (
    <TelemetryLayout
      title="Tyre Sets"
      subtitle="Packet 12 — All available tyre sets & wear"
      accent={ACCENT}
    >
      {/* hero */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Fitted Compound"
          value={fitted ? (COMPOUND_META[fitted.visualTyreCompound]?.label ?? `C${fitted.actualTyreCompound}`) : "-"}
          accent={fitted ? (COMPOUND_META[fitted.visualTyreCompound]?.color ?? ACCENT) : ACCENT}
          glow
          large
        />
        <StatCard label="Total Sets" value={sets.length} accent={ACCENT} />
        <StatCard label="Available" value={available.length} accent="#34d399" />
        <StatCard label="Last Update" value={formatDate(packet?.receivedAt)} accent={ACCENT} sub={`Car #${packet?.carIndex ?? "-"}`} />
      </div>

      {/* fitted set highlight */}
      {fitted && (
        <div className="mt-4">
          <SectionLabel accent={ACCENT}>Currently Fitted</SectionLabel>
          <div className="max-w-xs">
            <TyreCard set={fitted} />
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div>
          <SectionLabel accent={ACCENT}>All Sets ({sets.length})</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sets.map((s) => (
              <TyreCard key={s.index} set={s} />
            ))}
          </div>
        </div>
        <JsonBlock value={packet} />
      </div>
    </TelemetryLayout>
  );
}
