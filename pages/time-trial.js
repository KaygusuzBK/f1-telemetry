import { useLiveSummary, formatDate } from "../telemetry-hook";
import { TelemetryLayout, GlassPanel, SectionLabel, JsonBlock } from "../telemetry-layout";

const ACCENT = "#c084fc";

function fmtMs(ms) {
  if (!ms || ms <= 0) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${String(m).padStart(2, "0")}:${s}`;
}

function DeltaDisplay({ label, delta, positive = false }) {
  const isPos = Number(delta) > 0;
  const color = positive ? (isPos ? "#34d399" : "#f87171") : (isPos ? "#f87171" : "#34d399");
  const sign = isPos ? "+" : "";

  return (
    <div
      className="rounded-2xl p-5 text-center"
      style={{
        background: `${color}0a`,
        border: `1px solid ${color}30`,
        boxShadow: `0 0 24px ${color}14`,
      }}
    >
      <div className="text-[9px] font-black uppercase tracking-[0.25em] mb-2" style={{ color: color + "99" }}>
        {label}
      </div>
      <div
        className="text-4xl font-black font-mono leading-none"
        style={{ color, textShadow: `0 0 24px ${color}70` }}
      >
        {delta != null ? `${sign}${Number(delta).toFixed(0)}ms` : "-"}
      </div>
    </div>
  );
}

function BigTimer({ label, value, accent, glow = false }) {
  return (
    <div
      className="rounded-2xl p-6 relative overflow-hidden"
      style={{
        background: glow ? `${accent}0a` : "rgba(255,255,255,0.025)",
        border: `1px solid ${accent}${glow ? "40" : "20"}`,
        boxShadow: glow ? `0 0 40px ${accent}25, inset 0 1px 0 ${accent}30` : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent}80, transparent)` }}
      />
      <div
        className="text-[9px] font-black uppercase tracking-[0.25em] mb-4"
        style={{ color: accent + "88" }}
      >
        {label}
      </div>
      <div
        className="text-5xl font-black font-mono leading-none tracking-tight"
        style={{
          color: "#fff",
          textShadow: glow ? `0 0 30px ${accent}80` : "none",
        }}
      >
        {fmtMs(value)}
      </div>
      <div className="mt-2 text-xs font-mono text-zinc-600">{value} ms raw</div>
    </div>
  );
}

export default function TimeTrialPage() {
  const { summary } = useLiveSummary();
  const pkt = summary?.latestTimeTrial;

  const deltaSessionVsPersonal =
    pkt?.playerSessionBestLapTimeMs && pkt?.playerPersonalBestLapTimeMs
      ? pkt.playerSessionBestLapTimeMs - pkt.playerPersonalBestLapTimeMs
      : null;

  const deltaCurrent =
    pkt?.playerCurrentLapTimeMs && pkt?.playerSessionBestLapTimeMs
      ? pkt.playerCurrentLapTimeMs - pkt.playerSessionBestLapTimeMs
      : null;

  const deltaCurrentPersonal =
    pkt?.playerCurrentLapTimeMs && pkt?.playerPersonalBestLapTimeMs
      ? pkt.playerCurrentLapTimeMs - pkt.playerPersonalBestLapTimeMs
      : null;

  return (
    <TelemetryLayout
      title="Time Trial"
      subtitle="Packet 14 — Session & personal best comparison"
      accent={ACCENT}
    >
      {/* 3 big timer blocks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BigTimer label="Session Best" value={pkt?.playerSessionBestLapTimeMs} accent={ACCENT} glow />
        <BigTimer label="Personal Best" value={pkt?.playerPersonalBestLapTimeMs} accent="#a78bfa" />
        <BigTimer label="Current Lap" value={pkt?.playerCurrentLapTimeMs} accent="#60a5fa" />
      </div>

      {/* delta section */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <DeltaDisplay
          label="Session vs Personal Best"
          delta={deltaSessionVsPersonal}
          positive={false}
        />
        <DeltaDisplay
          label="Current vs Session Best"
          delta={deltaCurrent}
          positive={false}
        />
        <DeltaDisplay
          label="Current vs Personal Best"
          delta={deltaCurrentPersonal}
          positive={false}
        />
      </div>

      {/* progress bar: current lap vs session best */}
      {pkt?.playerSessionBestLapTimeMs > 0 && pkt?.playerCurrentLapTimeMs > 0 && (
        <GlassPanel className="mt-4">
          <SectionLabel accent={ACCENT}>Current Lap Progress vs Session Best</SectionLabel>
          <div className="space-y-3">
            {[
              { label: "Session Best", v: pkt.playerSessionBestLapTimeMs, color: ACCENT },
              { label: "Personal Best", v: pkt.playerPersonalBestLapTimeMs, color: "#a78bfa" },
              { label: "Current", v: pkt.playerCurrentLapTimeMs, color: "#60a5fa" },
            ].map((row) => {
              const max = Math.max(pkt.playerSessionBestLapTimeMs, pkt.playerPersonalBestLapTimeMs, pkt.playerCurrentLapTimeMs);
              const pct = (row.v / max) * 100;
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest w-24 shrink-0" style={{ color: row.color + "99" }}>
                    {row.label}
                  </span>
                  <div
                    className="relative flex-1 h-6 rounded-lg overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${row.color}55, ${row.color})`,
                        boxShadow: `0 0 8px ${row.color}55`,
                      }}
                    />
                    <span
                      className="absolute inset-0 flex items-center justify-end pr-3 text-xs font-black font-mono"
                      style={{ color: row.color }}
                    >
                      {fmtMs(row.v)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassPanel>
          <SectionLabel accent={ACCENT}>Packet Info</SectionLabel>
          <div className="space-y-2 text-sm text-zinc-400">
            <div className="flex justify-between">
              <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-600">Packet Size</span>
              <span className="font-mono text-white">{pkt?.packetSize ?? "-"} bytes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-600">Last Update</span>
              <span className="font-mono text-white">{formatDate(pkt?.receivedAt)}</span>
            </div>
          </div>
        </GlassPanel>
        <JsonBlock value={pkt} />
      </div>
    </TelemetryLayout>
  );
}
