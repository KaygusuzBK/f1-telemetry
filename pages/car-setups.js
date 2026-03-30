import { useLiveSummary, formatDate } from "../telemetry-hook";
import { TelemetryLayout, StatCard, GlassPanel, SectionLabel, Bar, DualBar, JsonBlock } from "../telemetry-layout";

const ACCENT = "#fbbf24";

function WingLevel({ label, value, max = 50 }) {
  const pct = Math.min(100, Math.max(0, (Number(value || 0) / max) * 100));
  const color = pct > 70 ? "#f87171" : pct > 40 ? ACCENT : "#34d399";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: ACCENT + "88" }}>
          {label}
        </span>
        <span
          className="text-xl font-black font-mono"
          style={{ color, textShadow: `0 0 12px ${color}70` }}
        >
          {value ?? "-"}
        </span>
      </div>
      <Bar value={value} max={max} color={color} h={8} />
    </div>
  );
}

function SetupRow({ label, left, right, leftLabel = "Front", rightLabel = "Rear" }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.1)" }}>
      <div className="text-[9px] uppercase tracking-[0.2em] font-bold mb-2" style={{ color: ACCENT + "88" }}>
        {label}
      </div>
      <DualBar
        leftLabel={leftLabel}
        leftValue={left}
        rightLabel={rightLabel}
        rightValue={right}
        max={100}
        color={ACCENT}
      />
    </div>
  );
}

function TyrePSI({ position, value }) {
  const v = Number(value || 0);
  const color = v < 21 ? "#60a5fa" : v > 24 ? "#f87171" : "#34d399";
  return (
    <div
      className="rounded-xl p-3 text-center flex flex-col items-center gap-1.5"
      style={{
        background: `${color}0c`,
        border: `1px solid ${color}30`,
      }}
    >
      <span className="text-[8px] uppercase tracking-widest font-bold" style={{ color: color + "99" }}>
        {position}
      </span>
      <span
        className="text-2xl font-black font-mono leading-none"
        style={{ color, textShadow: `0 0 16px ${color}60` }}
      >
        {v.toFixed(1)}
      </span>
      <span className="text-[8px] text-zinc-600 font-mono">PSI</span>
    </div>
  );
}

export default function CarSetupsPage() {
  const { summary } = useLiveSummary();
  const packet = summary?.latestCarSetups;
  const s = packet?.player;

  return (
    <TelemetryLayout
      title="Car Setup"
      subtitle="Packet 5 — Aerodynamics, suspension, brakes, tyres"
      accent={ACCENT}
    >
      {/* hero stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Front Wing" value={s?.frontWing ?? "-"} accent={ACCENT} glow />
        <StatCard label="Rear Wing" value={s?.rearWing ?? "-"} accent={ACCENT} glow />
        <StatCard label="Brake Bias" value={s ? `${s.brakeBias}%` : "-"} accent={ACCENT} />
        <StatCard label="Fuel Load" value={s ? `${s.fuelLoad} kg` : "-"} accent={ACCENT} />
        <StatCard label="Last Update" value={formatDate(packet?.receivedAt)} accent={ACCENT} sub="CarSetups packet" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Aero */}
        <GlassPanel>
          <SectionLabel accent={ACCENT}>Aerodynamics</SectionLabel>
          <div className="space-y-5">
            <WingLevel label="Front Wing" value={s?.frontWing} max={50} />
            <WingLevel label="Rear Wing" value={s?.rearWing} max={50} />
          </div>

          <div className="mt-5">
            <SectionLabel accent={ACCENT}>Throttle Differential</SectionLabel>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[9px] uppercase tracking-widest font-bold w-16 shrink-0" style={{ color: ACCENT + "88" }}>ON THR</span>
                <Bar value={s?.onThrottle} max={100} color={ACCENT} h={6} />
                <span className="text-xs font-black font-mono text-white w-10 text-right shrink-0">{s?.onThrottle ?? "-"}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] uppercase tracking-widest font-bold w-16 shrink-0" style={{ color: ACCENT + "88" }}>OFF THR</span>
                <Bar value={s?.offThrottle} max={100} color="#fb923c" h={6} />
                <span className="text-xs font-black font-mono text-white w-10 text-right shrink-0">{s?.offThrottle ?? "-"}%</span>
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* Suspension */}
        <GlassPanel>
          <SectionLabel accent={ACCENT}>Suspension & Geometry</SectionLabel>
          <div className="space-y-3">
            <SetupRow label="Camber" left={s?.frontCamber} right={s?.rearCamber} />
            <SetupRow label="Toe" left={s?.frontToe} right={s?.rearToe} />
            <SetupRow label="Suspension Stiffness" left={s?.frontSuspension} right={s?.rearSuspension} />
            <SetupRow label="Anti-Roll Bar" left={s?.frontAntiRollBar} right={s?.rearAntiRollBar} />
            <SetupRow label="Suspension Height" left={s?.frontSuspensionHeight} right={s?.rearSuspensionHeight} />
          </div>
        </GlassPanel>

        {/* Tyre PSI + Ballast + JSON */}
        <div className="flex flex-col gap-4">
          <GlassPanel>
            <SectionLabel accent={ACCENT}>Tyre Pressures</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <TyrePSI position="FL" value={s?.frontLeftTyrePressure} />
              <TyrePSI position="FR" value={s?.frontRightTyrePressure} />
              <TyrePSI position="RL" value={s?.rearLeftTyrePressure} />
              <TyrePSI position="RR" value={s?.rearRightTyrePressure} />
            </div>
          </GlassPanel>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Ballast" value={s?.ballast ?? "-"} accent={ACCENT} />
            <StatCard label="Brake Pressure" value={s ? `${s.brakePressure}%` : "-"} accent={ACCENT} />
          </div>

          <JsonBlock value={s} />
        </div>
      </div>
    </TelemetryLayout>
  );
}
