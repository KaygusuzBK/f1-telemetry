import { useLiveSummary, formatDate } from "../telemetry-hook";
import { TelemetryLayout, StatCard, GlassPanel, SectionLabel, JsonBlock } from "../telemetry-layout";

const ACCENT = "#a78bfa";

const READY_CONFIG = {
  0: { label: "NOT READY", color: "#f87171", dot: "#f87171" },
  1: { label: "READY", color: "#34d399", dot: "#34d399" },
  2: { label: "SPECTATING", color: "#60a5fa", dot: "#60a5fa" },
};

const TEAM_COLORS = [
  "#e10600", "#1e3a8a", "#b91c1c", "#0f766e",
  "#99f6e4", "#15803d", "#ea580c", "#65a30d",
  "#7f1d1d", "#1d4ed8", "#f1f5f9", "#ec4899",
  "#1e40af", "#d1d5db", "#db2777", "#2563eb",
  "#4338ca", "#c2410c", "#0891b2", "#1e3a8a",
];

function PlayerCard({ player }) {
  const readyCfg = READY_CONFIG[player.readyStatus] ?? READY_CONFIG[0];
  const teamColor = TEAM_COLORS[player.teamId % TEAM_COLORS.length] ?? "#4a5568";

  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${ACCENT}20`,
        boxShadow: player.readyStatus === 1 ? `0 0 20px ${ACCENT}14` : "none",
      }}
    >
      {/* left team color stripe */}
      <div
        className="absolute left-0 inset-y-0 w-[3px] rounded-l-2xl"
        style={{ background: teamColor }}
      />

      {/* ready status top-right */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase px-2 py-1 rounded-full"
        style={{
          color: readyCfg.color,
          background: readyCfg.color + "18",
          border: `1px solid ${readyCfg.color}30`,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: readyCfg.dot,
            boxShadow: player.readyStatus === 1 ? `0 0 6px ${readyCfg.dot}` : "none",
            animation: player.readyStatus === 1 ? "pulse 2s infinite" : "none",
          }}
        />
        {readyCfg.label}
      </div>

      <div className="pl-3">
        <div className="text-base font-black text-white leading-tight">{player.name}</div>
        <div className="flex items-center gap-3 mt-2">
          <div
            className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-black"
            style={{ background: teamColor + "33", border: `1px solid ${teamColor}60`, color: teamColor }}
          >
            {player.carNumber}
          </div>
          <span className="text-[10px] text-zinc-500">Team #{player.teamId}</span>
          <span className="text-[10px] text-zinc-600">NAT {player.nationality}</span>
        </div>
      </div>
    </div>
  );
}

export default function LobbyInfoPage() {
  const { summary } = useLiveSummary();
  const packet = summary?.latestLobbyInfo;
  const players = packet?.players || [];
  const ready = players.filter((p) => p.readyStatus === 1).length;
  const notReady = players.filter((p) => p.readyStatus === 0).length;
  const spectating = players.filter((p) => p.readyStatus === 2).length;

  return (
    <TelemetryLayout
      title="Lobby Info"
      subtitle="Packet 9 — Online session player list"
      accent={ACCENT}
    >
      {/* hero */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Players" value={packet?.numPlayers ?? "-"} accent={ACCENT} glow large />
        <StatCard label="Ready" value={ready} accent="#34d399" glow={ready > 0} />
        <StatCard label="Not Ready" value={notReady} accent="#f87171" />
        <StatCard label="Spectating" value={spectating} accent="#60a5fa" sub={formatDate(packet?.receivedAt)} />
      </div>

      {/* readiness bar */}
      {packet?.numPlayers > 0 && (
        <GlassPanel className="mt-4">
          <SectionLabel accent={ACCENT}>Lobby Readiness</SectionLabel>
          <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${(ready / packet.numPlayers) * 100}%`,
                background: "linear-gradient(90deg, #34d39999, #34d399)",
                boxShadow: "0 0 12px #34d39960",
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${(spectating / packet.numPlayers) * 100}%`,
                background: "rgba(96,165,250,0.5)",
              }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-[9px] font-bold uppercase tracking-widest">
            <span style={{ color: "#34d39988" }}>Ready {Math.round((ready / packet.numPlayers) * 100)}%</span>
            <span style={{ color: "#f8717188" }}>Not Ready {Math.round((notReady / packet.numPlayers) * 100)}%</span>
            <span style={{ color: "#60a5fa88" }}>Spectating {Math.round((spectating / packet.numPlayers) * 100)}%</span>
          </div>
        </GlassPanel>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div>
          <SectionLabel accent={ACCENT}>Players ({players.length})</SectionLabel>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {players.map((p) => (
              <PlayerCard key={`${p.carIndex}-${p.name}`} player={p} />
            ))}
          </div>
        </div>
        <JsonBlock value={packet} />
      </div>
    </TelemetryLayout>
  );
}
