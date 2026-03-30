import { useLiveSummary, formatDate } from "../telemetry-hook";
import { TelemetryLayout, StatCard, GlassPanel, SectionLabel, Bar, JsonBlock } from "../telemetry-layout";

const ACCENT = "#60a5fa";

const CORNER_LABELS = ["RL", "RR", "FL", "FR"];

function SuspCard({ label, values = [], color = ACCENT, unit = "" }) {
  const corners = CORNER_LABELS;
  const max = Math.max(...values.map(Math.abs), 0.001);

  return (
    <GlassPanel>
      <SectionLabel accent={color}>{label}</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {corners.map((c, i) => {
          const v = Number(values[i] ?? 0);
          const pct = Math.abs(v) / max;
          const barColor = pct > 0.8 ? "#f87171" : pct > 0.5 ? "#fbbf24" : color;
          return (
            <div
              key={c}
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: color + "88" }}>
                  {c}
                </span>
                <span className="text-sm font-black font-mono" style={{ color: barColor }}>
                  {v.toFixed(2)}{unit}
                </span>
              </div>
              <Bar value={Math.abs(v)} max={max} color={barColor} h={4} />
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function VectorBlock({ label, v = {}, color = ACCENT }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}
    >
      <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: color + "88" }}>
        {label}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["x", "y", "z"].map((axis) => (
          <div key={axis} className="text-center">
            <div className="text-[8px] uppercase font-bold text-zinc-600">{axis}</div>
            <div className="text-sm font-black font-mono text-white">{(v[axis] ?? 0).toFixed(3)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MotionExtendedPage() {
  const { summary } = useLiveSummary();
  const pkt = summary?.latestMotionExtended;

  const avg = (arr) => {
    if (!Array.isArray(arr) || !arr.length) return 0;
    return arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length;
  };

  return (
    <TelemetryLayout
      title="Motion Extended"
      subtitle="Packet 13 — Suspension dynamics, wheel slip, local velocity"
      accent={ACCENT}
    >
      {/* hero */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Avg Wheel Speed" value={avg(pkt?.wheelSpeed).toFixed(1)} accent={ACCENT} glow large sub="m/s (4 corners)" />
        <StatCard label="Front Wheels Angle" value={pkt?.frontWheelsAngle?.toFixed(4) ?? "-"} accent={ACCENT} sub="rad" />
        <StatCard label="Avg Susp Pos" value={avg(pkt?.suspensionPosition).toFixed(2)} accent={ACCENT} />
        <StatCard label="Last Update" value={formatDate(pkt?.receivedAt)} accent={ACCENT} sub="MotionExtended" />
      </div>

      {/* 4-corner panels row 1 */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SuspCard label="Suspension Position" values={pkt?.suspensionPosition} color={ACCENT} unit=" mm" />
        <SuspCard label="Suspension Velocity" values={pkt?.suspensionVelocity} color="#a78bfa" unit=" m/s" />
        <SuspCard label="Wheel Speed" values={pkt?.wheelSpeed} color="#34d399" unit=" m/s" />
        <SuspCard label="Wheel Slip Ratio" values={pkt?.wheelSlipRatio} color="#fbbf24" />
      </div>

      {/* velocity + angular + json */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassPanel>
          <SectionLabel accent={ACCENT}>Local Velocity (m/s)</SectionLabel>
          <VectorBlock label="Linear" v={pkt?.localVelocity} color={ACCENT} />
          <div className="mt-3">
            <VectorBlock label="Angular (rad/s)" v={pkt?.angularVelocity} color="#a78bfa" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: ACCENT + "88" }}>
              Front Wheels Angle
            </span>
            <span className="text-base font-black font-mono text-white">
              {(pkt?.frontWheelsAngle ?? 0).toFixed(4)} <span className="text-xs text-zinc-500">rad</span>
            </span>
          </div>
        </GlassPanel>

        <GlassPanel>
          <SectionLabel accent={ACCENT}>Suspension Acceleration</SectionLabel>
          <div className="space-y-3">
            {CORNER_LABELS.map((c, i) => {
              const v = Number(pkt?.suspensionAcceleration?.[i] ?? 0);
              const max = 50;
              const color = Math.abs(v) > max * 0.7 ? "#f87171" : ACCENT;
              return (
                <div key={c} className="flex items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest w-6 shrink-0" style={{ color: ACCENT + "88" }}>
                    {c}
                  </span>
                  <Bar value={Math.abs(v)} max={max} color={color} h={5} />
                  <span className="text-xs font-black font-mono text-white w-20 text-right shrink-0">
                    {v.toFixed(2)} m/s²
                  </span>
                </div>
              );
            })}
          </div>
        </GlassPanel>

        <JsonBlock value={pkt} />
      </div>
    </TelemetryLayout>
  );
}
