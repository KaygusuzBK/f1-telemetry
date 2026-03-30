import { useLiveSummary, formatDate } from "../telemetry-hook";
import { TelemetryLayout, StatCard, GlassPanel, SectionLabel, JsonBlock } from "../telemetry-layout";

const ACCENT = "#fb7185";

function positionColor(pos) {
  if (pos === 1) return { color: "#fbbf24", bg: "#fbbf2420", border: "#fbbf2450" };
  if (pos === 2) return { color: "#94a3b8", bg: "#94a3b815", border: "#94a3b840" };
  if (pos === 3) return { color: "#c084fc", bg: "#c084fc15", border: "#c084fc40" };
  if (pos <= 5) return { color: "#34d399", bg: "#34d39912", border: "#34d39930" };
  if (pos <= 10) return { color: "#60a5fa", bg: "#60a5fa10", border: "#60a5fa25" };
  return { color: "#6b7280", bg: "transparent", border: "#6b728030" };
}

function PositionCell({ lapNum, pos }) {
  if (pos == null) return null;
  const { color, bg, border } = positionColor(pos);
  return (
    <div
      className="rounded-lg flex flex-col items-center justify-center py-2 px-1 transition-all"
      style={{ background: bg, border: `1px solid ${border}`, minWidth: 48 }}
    >
      <span className="text-[8px] font-mono text-zinc-600 leading-none mb-1">L{lapNum}</span>
      <span
        className="text-lg font-black font-mono leading-none"
        style={{ color, textShadow: pos === 1 ? `0 0 12px ${color}80` : "none" }}
      >
        {pos}
      </span>
    </div>
  );
}

function PositionTrend({ positions }) {
  if (!positions.length) return null;
  const start = positions[0];
  const end = positions[positions.length - 1];
  const gained = start - end;

  const minP = Math.min(...positions);
  const maxP = Math.max(...positions);

  return (
    <div className="flex flex-col gap-2">
      {/* mini sparkline */}
      <div className="relative h-16 flex items-end gap-[3px]">
        {positions.map((p, i) => {
          const normalized = 1 - (p - 1) / (maxP > 1 ? maxP - 1 : 1);
          const { color } = positionColor(p);
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-all"
              style={{
                height: `${Math.max(10, normalized * 100)}%`,
                background: color,
                opacity: 0.7 + normalized * 0.3,
              }}
            />
          );
        })}
      </div>
      {/* trend summary */}
      <div className="flex gap-4 text-sm">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Start</span>
          <span className="text-2xl font-black font-mono" style={{ color: positionColor(start).color }}>P{start}</span>
        </div>
        <div className="flex items-center text-zinc-700 text-xl font-bold">→</div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Current</span>
          <span className="text-2xl font-black font-mono" style={{ color: positionColor(end).color }}>P{end}</span>
        </div>
        <div className="ml-auto flex flex-col items-end">
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Net</span>
          <span
            className="text-2xl font-black font-mono"
            style={{ color: gained > 0 ? "#34d399" : gained < 0 ? "#f87171" : "#6b7280" }}
          >
            {gained > 0 ? `+${gained}` : gained}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LapPositionsPage() {
  const { summary } = useLiveSummary();
  const pkt = summary?.latestLapPositions;
  const positions = pkt?.positions || [];
  const last = positions[positions.length - 1];

  return (
    <TelemetryLayout
      title="Lap Positions"
      subtitle="Packet 15 — Position history per lap"
      accent={ACCENT}
    >
      {/* hero */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Current Position" value={last ? `P${last}` : "-"} accent={positionColor(last ?? 99).color} glow large />
        <StatCard label="Total Laps" value={pkt?.numLaps ?? "-"} accent={ACCENT} />
        <StatCard label="Car Index" value={pkt?.carIndex ?? "-"} accent={ACCENT} />
        <StatCard label="Last Update" value={formatDate(pkt?.receivedAt)} accent={ACCENT} sub="LapPositions packet" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Trend sparkline */}
          {positions.length > 1 && (
            <GlassPanel>
              <SectionLabel accent={ACCENT}>Position Trend</SectionLabel>
              <PositionTrend positions={positions} />
            </GlassPanel>
          )}

          {/* Position grid */}
          <GlassPanel>
            <SectionLabel accent={ACCENT}>Lap-by-Lap Grid ({positions.length} laps)</SectionLabel>
            <div
              className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[320px]"
              style={{ scrollbarWidth: "thin" }}
            >
              {positions.map((p, i) => (
                <PositionCell key={i} lapNum={i + 1} pos={p} />
              ))}
            </div>
          </GlassPanel>

          {/* position distribution */}
          {positions.length > 0 && (
            <GlassPanel>
              <SectionLabel accent={ACCENT}>Position Distribution</SectionLabel>
              <div className="space-y-2">
                {Array.from({ length: Math.max(...positions) }, (_, i) => i + 1)
                  .filter((pos) => positions.includes(pos))
                  .map((pos) => {
                    const count = positions.filter((p) => p === pos).length;
                    const pct = (count / positions.length) * 100;
                    const { color } = positionColor(pos);
                    return (
                      <div key={pos} className="flex items-center gap-3">
                        <span
                          className="text-sm font-black font-mono w-6 shrink-0 text-right"
                          style={{ color }}
                        >
                          P{pos}
                        </span>
                        <div
                          className="relative flex-1 h-5 rounded overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          <div
                            className="h-full rounded transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${color}55, ${color})`,
                              boxShadow: pos === 1 ? `0 0 8px ${color}60` : "none",
                            }}
                          />
                          <span
                            className="absolute inset-0 flex items-center px-2 text-[9px] font-black font-mono"
                            style={{ color }}
                          >
                            {count} laps ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </GlassPanel>
          )}
        </div>
        <JsonBlock value={pkt} />
      </div>
    </TelemetryLayout>
  );
}
