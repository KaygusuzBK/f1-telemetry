import { useMemo } from "react";
import { useLiveSummary, formatDate } from "../telemetry-hook";
import { TelemetryLayout, StatCard, GlassPanel, SectionLabel, Bar, JsonBlock } from "../telemetry-layout";

const ACCENT = "#22d3ee";

function GForceMeter({ label, value = 0, max = 5 }) {
  const clamped = Math.max(-max, Math.min(max, value));
  const pct = ((clamped + max) / (max * 2)) * 100;
  const absRatio = Math.abs(clamped) / max;
  const color = absRatio > 0.75 ? "#f87171" : absRatio > 0.4 ? "#fbbf24" : ACCENT;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: ACCENT + "99" }}>
          {label}
        </span>
        <span
          className="text-sm font-black font-mono"
          style={{ color, textShadow: `0 0 12px ${color}80` }}
        >
          {clamped.toFixed(2)}
          <span className="text-[9px] ml-0.5 text-zinc-500">G</span>
        </span>
      </div>
      <div
        className="relative h-[6px] rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="absolute inset-y-0 w-px bg-white/20 z-10"
          style={{ left: "50%" }}
        />
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-150"
          style={{
            left: clamped < 0 ? `${pct}%` : "50%",
            width: `${absRatio * 50}%`,
            background: `linear-gradient(${clamped < 0 ? "270deg" : "90deg"}, ${color}, ${color}55)`,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
      <div className="flex justify-between text-[8px] font-mono text-zinc-700">
        <span>-{max}G</span>
        <span>0</span>
        <span>+{max}G</span>
      </div>
    </div>
  );
}

function AttitudeBlock({ yaw, pitch, roll }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: "YAW", value: yaw, symbol: "⟳" },
        { label: "PITCH", value: pitch, symbol: "⤢" },
        { label: "ROLL", value: roll, symbol: "↔" },
      ].map((a) => (
        <div
          key={a.label}
          className="rounded-xl p-3 text-center flex flex-col items-center gap-1"
          style={{
            background: "rgba(34,211,238,0.05)",
            border: "1px solid rgba(34,211,238,0.12)",
          }}
        >
          <span className="text-base font-mono text-zinc-500">{a.symbol}</span>
          <span
            className="text-xl font-black font-mono leading-none text-white"
            style={{ textShadow: `0 0 12px ${ACCENT}60` }}
          >
            {(Number(a.value) || 0).toFixed(3)}
          </span>
          <span className="text-[8px] uppercase tracking-[0.2em] font-bold" style={{ color: ACCENT + "88" }}>
            {a.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MotionPage() {
  const { summary } = useLiveSummary();
  const motion = summary?.latestMotion;
  const player = motion?.player;

  const speed3d = useMemo(() => {
    if (!player) return null;
    return Math.sqrt(
      (player.worldVelocityX || 0) ** 2 +
        (player.worldVelocityY || 0) ** 2 +
        (player.worldVelocityZ || 0) ** 2
    );
  }, [player]);

  return (
    <TelemetryLayout
      title="Motion Data"
      subtitle="Packet 0 — 3D world position, G-forces, attitude"
      accent={ACCENT}
    >
      {/* hero row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="3D Velocity" value={speed3d ? `${speed3d.toFixed(1)} m/s` : "-"} accent={ACCENT} glow large />
        <StatCard label="World X" value={player?.worldPositionX ?? "-"} accent={ACCENT} />
        <StatCard label="World Z" value={player?.worldPositionZ ?? "-"} accent={ACCENT} />
        <StatCard label="Last Update" value={formatDate(motion?.receivedAt)} accent={ACCENT} sub={`${motion?.allCars?.length ?? 0} cars tracked`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* G-Force panel */}
        <GlassPanel>
          <SectionLabel accent={ACCENT}>G-Force Meters</SectionLabel>
          <div className="space-y-6">
            <GForceMeter label="Lateral" value={player?.gForceLateral} max={5} />
            <GForceMeter label="Longitudinal" value={player?.gForceLongitudinal} max={5} />
            <GForceMeter label="Vertical" value={player?.gForceVertical} max={3} />
          </div>
        </GlassPanel>

        {/* Attitude + Velocity */}
        <GlassPanel>
          <SectionLabel accent={ACCENT}>Attitude (Yaw / Pitch / Roll)</SectionLabel>
          <AttitudeBlock yaw={player?.yaw} pitch={player?.pitch} roll={player?.roll} />

          <div className="mt-5">
            <SectionLabel accent={ACCENT}>World Velocity (m/s)</SectionLabel>
            <div className="space-y-3">
              {[
                { k: "VX", v: player?.worldVelocityX },
                { k: "VY", v: player?.worldVelocityY },
                { k: "VZ", v: player?.worldVelocityZ },
              ].map((r) => (
                <div key={r.k} className="flex items-center gap-3">
                  <span
                    className="text-[9px] font-black uppercase tracking-widest w-6 shrink-0"
                    style={{ color: ACCENT + "88" }}
                  >
                    {r.k}
                  </span>
                  <Bar value={Math.abs(r.v || 0)} max={60} color={ACCENT} h={5} />
                  <span className="text-xs font-black font-mono text-white w-16 text-right shrink-0">
                    {(r.v || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>

        {/* Raw JSON */}
        <div className="flex flex-col gap-4">
          <GlassPanel>
            <SectionLabel accent={ACCENT}>World Position</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {["X", "Y", "Z"].map((axis, i) => {
                const keys = ["worldPositionX", "worldPositionY", "worldPositionZ"];
                return (
                  <div
                    key={axis}
                    className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}
                  >
                    <div className="text-[9px] font-black tracking-widest mb-1" style={{ color: ACCENT + "88" }}>
                      {axis}
                    </div>
                    <div className="text-base font-black font-mono text-white">
                      {(player?.[keys[i]] || 0).toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
          <JsonBlock value={motion?.player} />
        </div>
      </div>
    </TelemetryLayout>
  );
}
