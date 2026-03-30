import { useLiveSummary, formatDate } from "../telemetry-hook";
import { TelemetryLayout, StatCard, GlassPanel, SectionLabel, JsonBlock } from "../telemetry-layout";

const ACCENT = "#f59e0b";

const RESULT_STATUS = {
  1: "INACTIVE", 2: "ACTIVE", 3: "FINISHED",
  4: "DID NOT FINISH", 5: "DISQUALIFIED", 6: "NOT CLASSIFIED", 7: "RETIRED",
};

function fmtMs(ms) {
  if (!ms || ms <= 0) return "-";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

function PodiumBlock({ position, data }) {
  const heights = { 1: "h-28", 2: "h-20", 3: "h-14" };
  const colors = {
    1: { accent: "#f59e0b", label: "WINNER", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
    2: { accent: "#94a3b8", label: "P2", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
    3: { accent: "#c084fc", label: "P3", bg: "rgba(192,132,252,0.08)", border: "rgba(192,132,252,0.2)" },
  };
  const c = colors[position];
  if (!c || !data) return null;

  return (
    <div
      className="flex flex-col items-center"
      style={{ minWidth: 120 }}
    >
      <div
        className="w-full rounded-t-2xl p-4 text-center"
        style={{ background: c.bg, border: `1px solid ${c.border}`, borderBottom: "none" }}
      >
        <div className="text-[9px] uppercase tracking-[0.25em] font-bold mb-1" style={{ color: c.accent + "99" }}>
          {c.label}
        </div>
        <div
          className="text-5xl font-black font-mono"
          style={{ color: c.accent, textShadow: `0 0 30px ${c.accent}80` }}
        >
          {String(position)}
        </div>
        <div className="mt-1 text-sm font-bold text-white">Car #{data.position}</div>
        <div className="text-xs text-zinc-400 mt-0.5">{data.numLaps} laps</div>
        <div className="text-[10px] font-mono mt-1" style={{ color: c.accent }}>
          {fmtMs(data.bestLapTimeMs)}
        </div>
      </div>
      <div
        className={`w-full ${heights[position]} rounded-b-2xl`}
        style={{ background: c.bg, border: `1px solid ${c.border}`, borderTop: "none" }}
      />
    </div>
  );
}

function StatusBadge({ status }) {
  const label = RESULT_STATUS[status] ?? String(status ?? "-");
  const color =
    status === 3 ? "#34d399" :
    status === 4 || status === 7 ? "#f87171" :
    status === 5 ? "#f59e0b" :
    "#6b7280";
  return (
    <span
      className="text-[8px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full"
      style={{ color, background: color + "18", border: `1px solid ${color}30` }}
    >
      {label}
    </span>
  );
}

export default function FinalClassificationPage() {
  const { summary } = useLiveSummary();
  const packet = summary?.latestFinalClassification;
  const rows = packet?.classification || [];
  const top3 = rows.slice(0, 3);

  return (
    <TelemetryLayout
      title="Race Results"
      subtitle="Packet 8 — Official final classification"
      accent={ACCENT}
    >
      {/* hero stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Cars" value={packet?.numCars ?? "-"} accent={ACCENT} glow large />
        <StatCard label="Top 3 Points" value={top3.reduce((a, b) => a + (b.points || 0), 0)} accent={ACCENT} />
        <StatCard label="Pole Points" value={top3[0]?.points ?? "-"} accent={ACCENT} />
        <StatCard label="Last Update" value={formatDate(packet?.receivedAt)} accent={ACCENT} sub="FinalClassification packet" />
      </div>

      {/* podium */}
      {top3.length > 0 && (
        <div className="mt-5">
          <SectionLabel accent={ACCENT}>Podium</SectionLabel>
          <div className="flex items-end justify-center gap-4 max-w-sm mx-auto">
            <PodiumBlock position={2} data={top3[1]} />
            <PodiumBlock position={1} data={top3[0]} />
            <PodiumBlock position={3} data={top3[2]} />
          </div>
        </div>
      )}

      {/* results table */}
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <GlassPanel className="overflow-hidden !p-0">
          <SectionLabel accent={ACCENT} className="px-4 pt-4">Full Classification</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[680px]">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(245,158,11,0.15)", background: "rgba(245,158,11,0.05)" }}>
                  {["POS", "GRID", "LAPS", "PIT", "POINTS", "BEST LAP", "RACE TIME", "PENALTIES", "STATUS"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left font-black tracking-widest"
                      style={{ color: ACCENT + "88" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="transition-colors"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: i === 0 ? "rgba(245,158,11,0.06)" : i === 1 ? "rgba(148,163,184,0.04)" : i === 2 ? "rgba(192,132,252,0.04)" : "transparent",
                    }}
                  >
                    <td className="px-3 py-2.5">
                      <span
                        className="text-xl font-black font-mono"
                        style={{
                          color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#c084fc" : "#fff",
                        }}
                      >
                        P{r.position}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-zinc-400">P{r.gridPosition}</td>
                    <td className="px-3 py-2.5 font-mono text-white font-bold">{r.numLaps}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-300">{r.numPitStops}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-black font-mono text-white">{r.points}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono" style={{ color: ACCENT }}>{fmtMs(r.bestLapTimeMs)}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-300">{r.totalRaceTimeSec?.toFixed(3) ?? "-"}s</td>
                    <td className="px-3 py-2.5 text-zinc-500 font-mono">
                      {r.penaltiesTimeSec > 0 ? `+${r.penaltiesTimeSec}s (${r.numPenalties})` : "-"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.resultStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
        <JsonBlock value={packet} />
      </div>
    </TelemetryLayout>
  );
}
