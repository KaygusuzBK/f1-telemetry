import { useMemo } from "react";
import { useLiveSummary, formatDate } from "../telemetry-hook";
import { TelemetryLayout, StatCard, GlassPanel, SectionLabel, JsonBlock } from "../telemetry-layout";

const ACCENT = "#34d399";

function fmtMs(ms) {
  if (!ms || ms <= 0) return "-";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

function fmtSectorMs(ms) {
  if (!ms || ms <= 0) return "-";
  return `${(ms / 1000).toFixed(3)}s`;
}

export default function SessionHistoryPage() {
  const { summary } = useLiveSummary();
  const packet = summary?.latestSessionHistory;
  const laps = packet?.lapHistoryData || [];

  const bestLapTime = useMemo(() => {
    if (!laps.length) return null;
    const valid = laps.filter((l) => l.lapTimeMs > 0);
    if (!valid.length) return null;
    return Math.min(...valid.map((l) => l.lapTimeMs));
  }, [laps]);

  const maxLapTime = useMemo(() => {
    if (!laps.length) return 1;
    return Math.max(...laps.map((l) => l.lapTimeMs || 0), 1);
  }, [laps]);

  return (
    <TelemetryLayout
      title="Session History"
      subtitle="Packet 11 — Lap-by-lap history, sector times"
      accent={ACCENT}
    >
      {/* hero */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Best Lap" value={fmtMs(bestLapTime)} accent={ACCENT} glow large />
        <StatCard label="Total Laps" value={packet?.numLaps ?? "-"} accent={ACCENT} />
        <StatCard label="Best Lap #" value={packet?.bestLapTimeLapNum ?? "-"} accent={ACCENT} />
        <StatCard label="Tyre Stints" value={packet?.numTyreStints ?? "-"} accent={ACCENT} />
        <StatCard label="Last Update" value={formatDate(packet?.receivedAt)} accent={ACCENT} sub={`Car #${packet?.carIndex ?? "-"}`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Lap chart + table */}
        <GlassPanel>
          <SectionLabel accent={ACCENT}>Lap History ({laps.length} laps)</SectionLabel>

          {/* Visual lap time bars */}
          {laps.length > 0 && (
            <div className="mb-5 space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {laps.map((lap, i) => {
                const isBest = lap.lapTimeMs === bestLapTime && lap.lapTimeMs > 0;
                const pct = lap.lapTimeMs > 0 ? Math.min(100, (lap.lapTimeMs / maxLapTime) * 100) : 0;
                const color = isBest ? "#34d399" : pct > 90 ? "#f87171" : pct > 75 ? "#fbbf24" : ACCENT + "88";
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="text-[8px] font-mono text-zinc-600 w-8 shrink-0 text-right"
                    >
                      L{i + 1}
                    </span>
                    <div
                      className="relative flex-1 h-[18px] rounded overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          background: isBest
                            ? `linear-gradient(90deg, ${ACCENT}88, ${ACCENT})`
                            : `linear-gradient(90deg, ${color}55, ${color})`,
                          boxShadow: isBest ? `0 0 10px ${ACCENT}60` : "none",
                        }}
                      />
                      <span
                        className="absolute inset-y-0 right-1 flex items-center text-[8px] font-black font-mono"
                        style={{ color: isBest ? ACCENT : "#ffffff88" }}
                      >
                        {fmtMs(lap.lapTimeMs)}
                        {isBest && <span className="ml-1 text-[7px]">★</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(52,211,153,0.15)" }}>
                  {["LAP", "TIME", "SECTOR 1", "SECTOR 2", "SECTOR 3", "VALID"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-black tracking-widest"
                      style={{ color: ACCENT + "77" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {laps.slice(0, 40).map((lap, idx) => {
                  const isBest = lap.lapTimeMs === bestLapTime && lap.lapTimeMs > 0;
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: isBest ? "rgba(52,211,153,0.08)" : "transparent",
                      }}
                    >
                      <td className="px-3 py-1.5 font-mono text-zinc-500">L{idx + 1}</td>
                      <td
                        className="px-3 py-1.5 font-black font-mono"
                        style={{ color: isBest ? ACCENT : "#fff" }}
                      >
                        {fmtMs(lap.lapTimeMs)}
                        {isBest && <span className="ml-1 text-[8px]">★</span>}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-zinc-400">{fmtSectorMs(lap.sector1TimeMs)}</td>
                      <td className="px-3 py-1.5 font-mono text-zinc-400">{fmtSectorMs(lap.sector2TimeMs)}</td>
                      <td className="px-3 py-1.5 font-mono text-zinc-400">{fmtSectorMs(lap.sector3TimeMs)}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{
                            color: lap.lapValidBitFlags === 15 ? "#34d399" : "#f87171",
                            background: lap.lapValidBitFlags === 15 ? "#34d39918" : "#f8717118",
                          }}
                        >
                          {lap.lapValidBitFlags === 15 ? "VALID" : "INVALID"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassPanel>
        <JsonBlock value={packet} />
      </div>
    </TelemetryLayout>
  );
}
