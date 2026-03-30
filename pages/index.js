import React, { useEffect, useMemo, useState } from "react";
import { Cloud, User } from "lucide-react";

const TRACK_CATALOG = [
  { file: "Sakhir (Bahrain).svg", name: "Bahrain - Sakhir", length: 5412 },
  { file: "Jeddah.svg", name: "Jeddah", length: 6174 },
  { file: "Melbourne.svg", name: "Melbourne", length: 5278 },
  { file: "Imola.svg", name: "Imola", length: 4909 },
  { file: "Miami.svg", name: "Miami", length: 5412 },
  { file: "Catalunya.svg", name: "Catalunya", length: 4657 },
  { file: "Monaco.svg", name: "Monaco", length: 3337 },
  { file: "Baku (Azerbaijan).svg", name: "Baku", length: 6003 },
  { file: "Montreal.svg", name: "Montreal", length: 4361 },
  { file: "Silverstone.svg", name: "Silverstone", length: 5891 },
  { file: "Austria.svg", name: "Austria", length: 4318 },
  { file: "Spa.svg", name: "Spa", length: 7004 },
  { file: "Hungaroring.svg", name: "Hungaroring", length: 4381 },
  { file: "Zandvoort.svg", name: "Zandvoort", length: 4259 },
  { file: "Monza.svg", name: "Monza", length: 5793 },
  { file: "Singapore.svg", name: "Singapore", length: 4940 },
  { file: "Suzuka.svg", name: "Suzuka", length: 5807 },
  { file: "Losail.svg", name: "Losail", length: 5419 },
  { file: "Texas.svg", name: "Austin", length: 5513 },
  { file: "Mexico.svg", name: "Mexico", length: 4304 },
  { file: "Brazil.svg", name: "Sao Paulo", length: 4309 },
  { file: "Abu Dhabi.svg", name: "Abu Dhabi", length: 5281 },
  { file: "Las Vegas.svg", name: "Las Vegas", length: 6201 },
  { file: "Shanghai.svg", name: "Shanghai", length: 5451 }
];

const TRACK_BY_ID = {
  6: "Melbourne.svg"
};

const TEAM_CLASSES = [
  "bg-red-600",
  "bg-blue-800",
  "bg-red-700",
  "bg-teal-500",
  "bg-teal-400",
  "bg-green-700",
  "bg-orange-500",
  "bg-lime-600",
  "bg-red-800",
  "bg-blue-600",
  "bg-white",
  "bg-pink-500",
  "bg-blue-700",
  "bg-gray-200",
  "bg-pink-600",
  "bg-blue-500",
  "bg-indigo-700",
  "bg-orange-600",
  "bg-cyan-600",
  "bg-blue-900"
];

const SECTION_PREFS_KEY = "f1-dashboard-sections";
const SETUP_CONFIRMED_KEY = "f1-dashboard-setup-confirmed";
const DEFAULT_SECTION_PREFS = {
  leaderboard: true,
  trackMap: true,
  weather: true
};

function formatLap(ms) {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return "-";
  const minutes = Math.floor(t / 60000);
  const seconds = ((t % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}

function chooseTrack(trackId, trackLengthM) {
  if (TRACK_BY_ID[trackId]) {
    const found = TRACK_CATALOG.find((x) => x.file === TRACK_BY_ID[trackId]);
    if (found) return found;
  }
  if (!trackLengthM) {
    return TRACK_CATALOG[0];
  }
  return TRACK_CATALOG.reduce((best, item) => {
    const diff = Math.abs(item.length - trackLengthM);
    if (!best || diff < best.diff) {
      return { ...item, diff };
    }
    return best;
  }, null);
}

function normalizeDrivers(summary) {
  const raw = summary?.driversOverview || [];
  const session = summary?.latestSession || {};
  const trackLength = Number(session.trackLengthM || 5000);
  const withScore = raw.map((d, i) => {
    const lap = Number(d.currentLapNum || 0);
    const lapDist = Number.isFinite(Number(d.lapDistanceM)) ? Number(d.lapDistanceM) : 0;
    const totalDist = Number.isFinite(Number(d.totalDistanceM)) ? Number(d.totalDistanceM) : 0;
    const score = Math.max(lap * trackLength + Math.max(0, lapDist), totalDist);
    return { ...d, score, _i: i };
  });

  withScore.sort((a, b) => b.score - a.score);
  const leaderScore = withScore[0]?.score || 1;

  return withScore.map((d, idx) => {
    const gapSecs = idx === 0 ? "Leader" : `+${((leaderScore - d.score) / 80).toFixed(2)}`;
    return {
      pos: idx + 1,
      num: d.raceNumber || d._i + 1,
      name: d.name || `Driver ${d._i + 1}`,
      team: TEAM_CLASSES[d.teamId ?? (d._i % TEAM_CLASSES.length)] || "bg-blue-700",
      gap: gapSecs,
      pit: d.pitStatus ? "01.00" : "00.00",
      best: formatLap(d.lastLapTimeMs),
      last: formatLap(d.currentLapTimeMs || d.lastLapTimeMs),
      fastest: idx === 0 && Number(d.lastLapTimeMs) > 0,
      highlight: d.index === summary?.latestTelemetry?.index
    };
  });
}

function getWeatherAdvice(session) {
  const weather = String(session?.weather || "").toLowerCase();
  const trackTemp = Number(session?.trackTemperatureC || 0);

  if (weather.includes("rain") || weather.includes("storm")) {
    return "5-10 dk: Islak zemin riski. Fren mesafesini uzat, pitte inter/wet degerlendir.";
  }
  if (weather.includes("cloud")) {
    return "5-10 dk: Sicaklik dalgalanabilir. Lastik penceresini koru, on aksi fazla isitma.";
  }
  if (trackTemp >= 35) {
    return "5-10 dk: Lastik asinmasi artabilir. Daha yumusak cikis ve cekis kontrolu onerilir.";
  }
  return "5-10 dk: Kosullar stabil. Mevcut stint planiyla devam etmek uygun gorunuyor.";
}

function getTrackOutlook(session) {
  const weather = String(session?.weather || "").toLowerCase();
  const trackTemp = Number(session?.trackTemperatureC || 0);

  if (weather.includes("rain") || weather.includes("storm")) {
    return "Harita/Pist: Islak bolgeler artabilir, dusuk tutus beklenir.";
  }
  if (weather.includes("cloud")) {
    return "Harita/Pist: Sektor bazli grip dalgalanabilir.";
  }
  if (trackTemp >= 35) {
    return "Harita/Pist: Sicak asfalt, arka lastik asinmasi yukselebilir.";
  }
  return "Harita/Pist: Cizgi disinda normal, grip dengeli.";
}

export default function App() {
  const [time, setTime] = useState("09:01:20");
  const [summary, setSummary] = useState(null);
  const [viewport, setViewport] = useState({ w: 1920, h: 1080 });
  const [isMobileClient, setIsMobileClient] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [sectionPrefs, setSectionPrefs] = useState(DEFAULT_SECTION_PREFS);
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    gear: 0,
    rpm: 0,
    maxRpm: 12000,
    throttle: 0,
    brake: 0,
    fuelLaps: 0,
    drs: false,
    tires: {
      fl: { temp: 0, wear: 0, psi: 0 },
      fr: { temp: 0, wear: 0, psi: 0 },
      rl: { temp: 0, wear: 0, psi: 0 },
      rr: { temp: 0, wear: 0, psi: 0 }
    },
    car: {
      engineTemp: 0,
      engineWear: 0,
      gearboxWear: 0
    }
  });

  useEffect(() => {
    const clock = setInterval(() => {
      setTime(new Date().toLocaleTimeString("tr-TR", { hour12: false }));
    }, 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    function handleResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      const ua = window.navigator.userAgent || "";
      const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
      const touchLikeDevice = (window.navigator.maxTouchPoints || 0) > 1;
      const phoneLikeViewport = Math.max(window.innerWidth, window.innerHeight) <= 1400;
      setIsMobileClient(mobileUA || (touchLikeDevice && phoneLikeViewport));
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  useEffect(() => {
    const source = new EventSource("/events");
    const onMessage = (event) => {
      const payload = JSON.parse(event.data);
      setSummary(payload);
      const t = payload?.latestTelemetry;
      const status = payload?.latestCarStatus;
      const damage = payload?.latestCarDamage;
      if (!t) return;

      const tyreRL = t.tyres?.[0] || {};
      const tyreRR = t.tyres?.[1] || {};
      const tyreFL = t.tyres?.[2] || {};
      const tyreFR = t.tyres?.[3] || {};
      const wear = damage?.tyresWearPct || [0, 0, 0, 0];

      setTelemetry((prev) => ({
        ...prev,
        speed: Number(t.speedKph || 0),
        gear: Number(t.gear || 0),
        rpm: Number(t.engineRPM || 0),
        throttle: Math.round(Number(t.throttle || 0) * 100),
        brake: Math.round(Number(t.brake || 0) * 100),
        fuelLaps: Number(status?.fuelRemainingLaps || prev.fuelLaps),
        drs: Boolean(t.drsEnabled),
        tires: {
          fl: { temp: Number(tyreFL.surfaceTempC || 0), wear: Number(wear[2] || 0), psi: Number(tyreFL.pressurePsi || 0) },
          fr: { temp: Number(tyreFR.surfaceTempC || 0), wear: Number(wear[3] || 0), psi: Number(tyreFR.pressurePsi || 0) },
          rl: { temp: Number(tyreRL.surfaceTempC || 0), wear: Number(wear[0] || 0), psi: Number(tyreRL.pressurePsi || 0) },
          rr: { temp: Number(tyreRR.surfaceTempC || 0), wear: Number(wear[1] || 0), psi: Number(tyreRR.pressurePsi || 0) }
        },
        car: {
          engineTemp: Number(t.engineTemperatureC || 0),
          engineWear: Number(damage?.powerUnitWearPct?.engine || 0),
          gearboxWear: Number(damage?.powerUnitWearPct?.gearbox || 0)
        }
      }));
    };

    source.addEventListener("summary", onMessage);
    source.addEventListener("snapshot", onMessage);
    source.onerror = () => {};
    return () => source.close();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedPrefs = window.localStorage.getItem(SECTION_PREFS_KEY);
      if (savedPrefs) {
        const parsedPrefs = JSON.parse(savedPrefs);
        setSectionPrefs((prev) => ({ ...prev, ...parsedPrefs }));
      }
      const setupConfirmed = window.localStorage.getItem(SETUP_CONFIRMED_KEY) === "true";
      setShowSetupModal(!setupConfirmed);
    } catch {
      setShowSetupModal(true);
    }
  }, []);

  const drivers = useMemo(() => normalizeDrivers(summary), [summary]);
  const session = summary?.latestSession || {};
  const serverInfo = summary?.server || {};
  const wifiIps = Array.isArray(serverInfo.localIps) ? serverInfo.localIps : [];
  const lap = summary?.latestLapData || {};
  const fastest = drivers.find((d) => d.fastest) || drivers[0];
  const selectedTrack = chooseTrack(session.trackId, session.trackLengthM);
  const trackImageUrl = selectedTrack
    ? `https://raw.githubusercontent.com/coggs/f1_svg/main/${encodeURIComponent(selectedTrack.file)}`
    : null;

  const isPortrait = viewport.h > viewport.w;
  const BASE_WIDTH = isPortrait ? 1080 : 1920;
  const BASE_HEIGHT = isPortrait ? 1920 : 980;
  const scale = Math.min(viewport.w / BASE_WIDTH, viewport.h / BASE_HEIGHT);
  const scaledWidth = BASE_WIDTH * scale;
  const scaledHeight = BASE_HEIGHT * scale;
  const offsetX = Math.max(0, (viewport.w - scaledWidth) / 2);
  const offsetY = Math.max(0, (viewport.h - scaledHeight) / 2);
  const isMobileDevice = isMobileClient;
  const highlightedDriver = drivers.find((x) => x.highlight);
  const userPos = highlightedDriver?.pos || "-";
  const frontDriver = highlightedDriver ? drivers[Math.max(0, userPos - 2)] : drivers[0];
  const behindDriver = highlightedDriver ? drivers[Math.min(drivers.length - 1, userPos)] : drivers[2];
  const deltaText =
    highlightedDriver && typeof highlightedDriver.gap === "string" && highlightedDriver.gap !== "Leader"
      ? highlightedDriver.gap
      : "-";
  const hasCarStatus = Boolean(summary?.latestCarStatus);
  const fuelLapsText = hasCarStatus ? `+${telemetry.fuelLaps.toFixed(2)}` : "-";
  const weatherAdvice = getWeatherAdvice(session);
  const trackOutlook = getTrackOutlook(session);
  const weatherLower = String(session.weather || "").toLowerCase();
  const outlookTone = weatherLower.includes("rain") || weatherLower.includes("storm")
    ? "text-blue-300 border-blue-400/40 bg-blue-500/10"
    : weatherLower.includes("cloud")
      ? "text-amber-200 border-amber-400/40 bg-amber-500/10"
      : "text-emerald-200 border-emerald-400/40 bg-emerald-500/10";
  const showLeaderboard = sectionPrefs.leaderboard;
  const showTrackMap = sectionPrefs.trackMap;
  const showWeather = sectionPrefs.weather;

  function toggleSection(key) {
    setSectionPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openSetupModal() {
    setShowSetupModal(true);
  }

  function confirmSetup() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SECTION_PREFS_KEY, JSON.stringify(sectionPrefs));
      window.localStorage.setItem(SETUP_CONFIRMED_KEY, "true");
    }
    setShowSetupModal(false);
  }

  if (isMobileDevice) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden bg-[radial-gradient(circle_at_15%_-5%,#2b3158_0%,#101223_40%,#05060a_100%)] text-white font-sans">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(239,68,68,0.1),transparent_42%,rgba(56,189,248,0.1))]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(244,63,94,0.12),transparent_35%)]" />
        <header className="relative h-[70px] px-3 flex items-center justify-between border-b border-white/15 bg-black/35 backdrop-blur-lg shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="text-red-500 font-black italic tracking-tight text-[24px] drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
            <span className="text-white mr-1">F1</span>TV
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[52vw]">
            <div className="text-sm font-bold truncate">{selectedTrack?.name || "Track"}</div>
            <div className={`mt-1 px-2 py-0.5 rounded-full border text-[9px] truncate ${outlookTone}`}>{trackOutlook}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase text-slate-400 tracking-widest">Live • Local</div>
            <div className="text-xs font-mono">{time}</div>
          </div>
        </header>
        <button
          type="button"
          onClick={openSetupModal}
          className="absolute right-3 top-20 z-20 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-200 backdrop-blur hover:bg-black/70"
        >
          Ayarlar
        </button>

        {isPortrait ? (
          <main className="relative h-[calc(100dvh-70px)] grid grid-rows-[30%_36%_34%] gap-2 p-2">
            <section className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md p-3 shadow-[0_12px_30px_rgba(0,0,0,0.45)] ring-1 ring-white/5">
              <div className="grid grid-cols-[1fr_auto] gap-3 h-full">
                <div className="flex flex-col justify-between min-w-0">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Race Pace</div>
                    <div className="text-5xl leading-none font-black font-mono text-white">{telemetry.speed}</div>
                    <div className="text-xs text-slate-300 -mt-1">km/h • Gear {telemetry.gear} • {telemetry.rpm} rpm</div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-400/30 text-[9px] text-red-200 font-semibold">DRS {telemetry.drs ? "ON" : "OFF"}</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/30 text-[9px] text-sky-200 font-semibold">Fuel {fuelLapsText}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-1.5 shadow-inner shadow-black/20">
                      <div className="text-[9px] uppercase text-slate-400">Lap</div>
                      <div className="text-sm font-black">{lap.currentLapNum || "-"}/{session.totalLaps || "-"}</div>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-1.5 shadow-inner shadow-black/20">
                      <div className="text-[9px] uppercase text-slate-400">Position</div>
                      <div className="text-sm font-black">P{userPos}</div>
                    </div>
                    <div className="rounded-xl bg-red-500/12 border border-red-400/35 px-2 py-1.5 shadow-inner shadow-black/20">
                      <div className="text-[9px] uppercase text-red-300">Delta</div>
                      <div className="text-sm font-black font-mono text-red-300">{deltaText}</div>
                    </div>
                  </div>
                </div>
                <div className="w-[108px] flex flex-col justify-between">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-2 shadow-inner shadow-black/20">
                    <div className="text-[9px] uppercase text-slate-400">Fastest</div>
                    <div className="text-sm font-mono font-black text-purple-300">{fastest?.best || "-"}</div>
                    <div className="text-[10px] text-slate-300 truncate">{fastest?.name || "-"}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-2 shadow-inner shadow-black/20">
                    <div className="text-[9px] uppercase text-slate-400 mb-1">Throttle</div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${telemetry.throttle}%` }} /></div>
                    <div className="text-[9px] uppercase text-slate-400 mb-1 mt-2">Brake</div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${telemetry.brake}%` }} /></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-[57%_43%] gap-2 min-h-0">
              {showLeaderboard && (
              <div className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md overflow-hidden min-h-0 ring-1 ring-white/5">
                <div className="h-8 px-3 flex items-center justify-between border-b border-white/10 text-[10px] uppercase tracking-widest text-slate-400">
                  <span>Leaderboard</span>
                  <span>{session.weather || "Unknown"}</span>
                </div>
                <div className="h-[calc(100%-32px)] overflow-y-auto">
                  {drivers.slice(0, 10).map((d) => (
                    <div key={d.pos} className={`grid grid-cols-[22px_1fr_52px] items-center gap-1 px-2.5 py-1.5 text-[11px] border-b border-white/5 ${d.highlight ? "bg-cyan-500/10" : ""}`}>
                      <div className="font-bold text-slate-300">{d.pos}</div>
                      <div className="truncate flex items-center gap-1.5">
                        <span className={`w-1.5 h-3 rounded-full ${d.team}`} />
                        <span className="truncate">{d.name}</span>
                      </div>
                      <div className="text-right font-mono text-emerald-300">{d.best}</div>
                    </div>
                  ))}
                </div>
              </div>
              )}
              <div className="grid grid-rows-[58%_42%] gap-2 min-h-0">
                {showTrackMap && (
                <div className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md p-2 min-h-0 ring-1 ring-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Track Map</div>
                  <div className="h-[calc(100%-18px)] rounded-xl bg-black/35 overflow-hidden">
                    {trackImageUrl && <img src={trackImageUrl} alt="Track" className="w-full h-full object-contain filter invert opacity-70 p-1" />}
                  </div>
                </div>
                )}
                {showWeather && (
                <div className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md p-2 ring-1 ring-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-sky-300">Weather Call</div>
                  <div className="text-[11px] leading-tight text-slate-200 mt-1 line-clamp-3">{weatherAdvice}</div>
                  <div className="text-[10px] text-slate-400 mt-1.5">Track {session.trackTemperatureC ?? "-"}C / Air {session.airTemperatureC ?? "-"}C</div>
                </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md p-2.5 ring-1 ring-white/5">
              <div className="grid grid-cols-2 gap-2 h-full">
                <div className="rounded-xl bg-white/5 border border-white/10 p-2 shadow-inner shadow-black/20">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Front Driver</div>
                  <div className="text-sm font-semibold truncate">{frontDriver?.name || "-"}</div>
                  <div className="text-base font-mono text-slate-300">{frontDriver?.last || "-"}</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2 shadow-inner shadow-black/20">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Behind Driver</div>
                  <div className="text-sm font-semibold truncate">{behindDriver?.name || "-"}</div>
                  <div className="text-base font-mono text-slate-300">{behindDriver?.last || "-"}</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2 col-span-2 shadow-inner shadow-black/20">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Tyre Surface Temp / Wear</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <TireData psi={telemetry.tires.fl.psi} temp={telemetry.tires.fl.temp} wear={telemetry.tires.fl.wear} />
                    <TireData align="right" psi={telemetry.tires.fr.psi} temp={telemetry.tires.fr.temp} wear={telemetry.tires.fr.wear} />
                    <TireData psi={telemetry.tires.rl.psi} temp={telemetry.tires.rl.temp} wear={telemetry.tires.rl.wear} />
                    <TireData align="right" psi={telemetry.tires.rr.psi} temp={telemetry.tires.rr.temp} wear={telemetry.tires.rr.wear} />
                  </div>
                </div>
              </div>
            </section>
          </main>
        ) : (
          <main className="relative h-[calc(100dvh-70px)] grid grid-cols-[31%_34%_35%] gap-2 p-2">
            <section className="grid grid-rows-[48%_52%] gap-2 min-h-0">
              <div className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md p-2.5 flex flex-col justify-between ring-1 ring-white/5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Pace</div>
                  <div className="text-4xl font-black font-mono leading-none">{telemetry.speed}</div>
                  <div className="text-[11px] text-slate-300">km/h • G{telemetry.gear} • {telemetry.rpm} rpm</div>
                  <div className="mt-1.5 inline-flex px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-400/30 text-[9px] text-red-200 font-semibold">DRS {telemetry.drs ? "ON" : "OFF"}</div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-1">Lap {lap.currentLapNum || "-"}/{session.totalLaps || "-"}</div>
                  <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-1">Pos P{userPos}</div>
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-2 py-1 col-span-2 text-red-200 font-mono">Delta {deltaText}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md p-2.5 ring-1 ring-white/5">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Driver Gap</div>
                <div className="text-[12px] truncate">{frontDriver?.name || "-"} <span className="text-slate-400">ahead</span></div>
                <div className="text-[12px] truncate mb-2">{behindDriver?.name || "-"} <span className="text-slate-400">behind</span></div>
                <div className="text-[10px] text-slate-400 mb-1">Throttle</div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${telemetry.throttle}%` }} /></div>
                <div className="text-[10px] text-slate-400 mt-2 mb-1">Brake</div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${telemetry.brake}%` }} /></div>
              </div>
            </section>

            <section className="grid grid-rows-[52%_18%_30%] gap-2 min-h-0">
              {showTrackMap && (
              <div className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md p-2 min-h-0 ring-1 ring-white/5">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Track Map</div>
                <div className="h-[calc(100%-18px)] rounded-xl bg-black/35 overflow-hidden">
                  {trackImageUrl && <img src={trackImageUrl} alt="Track" className="w-full h-full object-contain filter invert opacity-70 p-1" />}
                </div>
              </div>
              )}
              <div className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md px-2.5 py-2 flex items-center justify-between ring-1 ring-white/5">
                <div>
                  <div className="text-[10px] text-slate-400">Fastest</div>
                  <div className="text-sm font-mono text-purple-300">{fastest?.best || "-"}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-sky-300">Weather</div>
                  <div className="text-xs text-slate-200">{session.weather || "Unknown"}</div>
                </div>
              </div>
              {showWeather && (
              <div className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md p-2.5 ring-1 ring-white/5">
                <div className="text-[10px] uppercase tracking-widest text-sky-300">Track Outlook</div>
                <div className="text-[11px] leading-tight text-slate-200 mt-1 line-clamp-3">{weatherAdvice}</div>
              </div>
              )}
            </section>

            {showLeaderboard && (
            <section className="rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-md overflow-hidden min-h-0 ring-1 ring-white/5">
              <div className="h-8 px-2.5 flex items-center justify-between border-b border-white/10 text-[10px] uppercase tracking-widest text-slate-400">
                <span>Live Leaderboard</span>
                <span className="font-mono text-purple-300">{fastest?.best || "-"}</span>
              </div>
              <div className="h-[calc(100%-32px)] overflow-y-auto">
                {drivers.slice(0, 16).map((d) => (
                  <div key={d.pos} className={`grid grid-cols-[20px_1fr_58px_42px] items-center gap-1 px-2.5 py-1.5 text-[10px] border-b border-white/5 ${d.highlight ? "bg-cyan-500/10" : ""}`}>
                    <div className="font-bold text-slate-300">{d.pos}</div>
                    <div className="truncate flex items-center gap-1">
                      <span className={`w-1.5 h-2.5 rounded-full ${d.team}`} />
                      <span className="truncate">{d.name}</span>
                    </div>
                    <div className="text-right font-mono text-emerald-300">{d.best}</div>
                    <div className="text-right font-mono text-slate-300">{d.gap}</div>
                  </div>
                ))}
              </div>
            </section>
            )}
          </main>
        )}
        <SetupModal
          isOpen={showSetupModal}
          sectionPrefs={sectionPrefs}
          onToggle={toggleSection}
          onConfirm={confirmSetup}
          wifiIps={wifiIps}
          udpHost={serverInfo.udpHost || "0.0.0.0"}
          udpPort={serverInfo.udpPort || 20777}
        />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-black text-white font-sans">
      <div
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: "top left"
        }}
        className="overflow-hidden"
      >
      <header className={`relative flex items-center justify-between bg-zinc-950 border-b-2 border-red-600 ${isPortrait ? "px-4 py-3" : "px-6 py-3"} shadow-md z-10`}>
        <div className="flex items-center space-x-3 md:space-x-6 min-w-[220px]">
          <div className={`text-red-600 font-black italic tracking-tighter flex items-center ${isPortrait ? "text-2xl" : "text-4xl"}`}>
            <span className="text-white mr-1">F1</span>TV
          </div>
        </div>
        <h1 className={`${isPortrait ? "text-xl" : "text-3xl"} font-bold tracking-wide truncate absolute left-1/2 -translate-x-1/2 max-w-[55%] text-center`}>
          {selectedTrack?.name || "Track"}
        </h1>
        <div
          className={`absolute left-1/2 -translate-x-1/2 text-center text-amber-300 truncate max-w-[58%] ${
            isPortrait ? "top-[42px] text-[11px]" : "top-[56px] text-xs"
          }`}
        >
          {trackOutlook}
        </div>
        <div className="flex items-center space-x-4 md:space-x-8 text-xs md:text-sm font-semibold">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-slate-300">
              Track: {session.trackTemperatureC ?? "-"}C / Air: {session.airTemperatureC ?? "-"}C
            </span>
            <span className="flex items-center text-blue-400 mt-1">
              <Cloud size={14} className="mr-1" /> {session.weather || "Unknown"}
            </span>
          </div>
          <div className="flex flex-col items-end md:items-center min-w-[160px]">
            <span className="text-slate-400 text-[10px] md:text-xs uppercase tracking-widest">
              Local Time
            </span>
            <span className="text-sm md:text-xl font-mono text-white mt-1">{time}</span>
          </div>
          <User size={24} className="text-slate-300 hover:text-white cursor-pointer transition-colors md:w-[28px] md:h-[28px]" />
        </div>
      </header>
      <button
        type="button"
        onClick={openSetupModal}
        className="absolute right-4 top-20 z-20 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-200 backdrop-blur hover:bg-black"
      >
        Ayarlar
      </button>

      {isPortrait ? (
      <div className="grid grid-cols-6 grid-rows-12 gap-3 p-3 h-[calc(1920px-76px)] overflow-hidden bg-[#050505]">
        <div className={`col-span-6 row-span-5 flex flex-col bg-zinc-950 border border-slate-900 rounded-lg overflow-hidden shadow-xl h-full min-h-0 ${showLeaderboard ? "" : "hidden"}`}>
          <div className="flex justify-between items-center bg-zinc-900 p-2 md:p-3 border-b border-slate-800 shrink-0">
            <span className="text-lg md:text-xl xl:text-2xl font-black tracking-widest text-slate-100">LAP</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl md:text-2xl xl:text-3xl font-black text-white">{lap.currentLapNum || "-"}</span>
              <span className="text-xs md:text-sm xl:text-lg font-bold text-slate-500">/{session.totalLaps || "-"}</span>
            </div>
          </div>

          <div className="grid grid-cols-[25px_1fr_45px_45px_50px_50px] md:grid-cols-[30px_1fr_50px_50px_60px_60px] xl:grid-cols-[30px_1fr_60px_60px_65px_65px] gap-1 md:gap-2 px-2 py-2 text-[8px] md:text-[9px] xl:text-[10px] text-slate-400 uppercase font-black tracking-wider border-b border-slate-800 bg-zinc-950/50 shrink-0">
            <div className="text-center">Pos</div>
            <div>Driver</div>
            <div className="text-right">Gap</div>
            <div className="text-right">Int</div>
            <div className="text-center">Best</div>
            <div className="text-center">Last</div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 #000" }}>
            {drivers.map((d, i) => (
              <div
                key={i}
                className={`grid grid-cols-[25px_1fr_45px_45px_50px_50px] md:grid-cols-[30px_1fr_50px_50px_60px_60px] xl:grid-cols-[30px_1fr_60px_60px_65px_65px] gap-1 md:gap-2 px-2 py-1.5 text-[9px] md:text-[10px] xl:text-xs items-center border-b border-slate-900 hover:bg-zinc-900 transition-colors ${d.highlight ? "bg-blue-900/20" : ""}`}
              >
                <div className="flex justify-center items-center space-x-1">
                  <span className={`w-4 text-right font-bold ${d.highlight ? "text-blue-400" : "text-slate-300"}`}>{d.pos}</span>
                </div>
                <div className="font-semibold flex items-center space-x-1.5 md:space-x-2 truncate">
                  <div className={`w-1 h-3 xl:h-4 ${d.team} rounded-sm shrink-0`}></div>
                  <span className="text-slate-500 text-[8px] md:text-[9px] xl:text-[10px] w-3 xl:w-4 shrink-0">{d.num}</span>
                  <span className={`truncate ${d.highlight ? "text-blue-300" : "text-white"}`}>{d.name}</span>
                </div>
                <div className="text-right font-mono text-slate-300">{d.gap}</div>
                <div className="text-right font-mono text-slate-400">{d.pit}</div>
                <div className={`text-center font-mono py-0.5 rounded ${d.fastest ? "bg-purple-900/40 text-purple-400 font-bold" : "text-green-500"}`}>{d.best}</div>
                <div className={`text-center font-mono py-0.5 rounded ${d.fastest ? "bg-purple-900/40 text-purple-400 font-bold" : "text-green-500"}`}>{d.last}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-6 row-span-4 flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-zinc-950 border border-slate-900 rounded-lg p-3 md:p-4 flex flex-col items-center justify-center shadow-xl">
              <h2 className="text-[10px] md:text-xs xl:text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Fastest Lap</h2>
              <div className="text-4xl md:text-3xl xl:text-5xl font-mono font-black text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                {fastest?.best || "-"}
              </div>
              <div className="text-sm md:text-base xl:text-lg font-bold text-purple-400 mt-1 tracking-wider">
                {fastest?.name || "-"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 flex flex-col items-center justify-center shadow-xl">
                <div className="text-yellow-500 font-black text-[9px] md:text-[10px] xl:text-xs uppercase tracking-widest mb-1 text-center">Position</div>
                <div className="text-5xl md:text-4xl xl:text-6xl font-black text-white leading-none">
                  {drivers.find((x) => x.highlight)?.pos || "-"}
                </div>
              </div>
              <div className="bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 flex flex-col items-center justify-center shadow-xl">
                <div className="text-yellow-500 font-black text-[8px] md:text-[9px] xl:text-[10px] uppercase tracking-widest mb-1 text-center leading-tight">Pos Gained/Lost</div>
                <div className="bg-slate-100 text-black text-xl md:text-2xl xl:text-3xl font-black py-0.5 w-10 md:w-12 xl:w-16 text-center rounded shadow-inner leading-none mt-1">0</div>
                <div className="text-red-500 font-black text-sm md:text-base xl:text-lg mt-1">-</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 md:gap-2 bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 shadow-xl shrink-0">
            <div className="text-center flex flex-col items-center border-r border-slate-800 px-1 w-full overflow-hidden">
              <div className="text-slate-400 text-[8px] md:text-[9px] xl:text-[10px] font-black uppercase tracking-widest">Current Lap</div>
              <div className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-mono font-black mt-2 text-white truncate w-full">{formatLap(lap.currentLapTimeMs)}</div>
            </div>
            <div className="text-center flex flex-col items-center border-r border-slate-800 px-1 w-full overflow-hidden">
              <div className="text-slate-400 text-[8px] md:text-[9px] xl:text-[10px] font-black uppercase tracking-widest">Last Lap</div>
              <div className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-mono font-black text-yellow-500 mt-2 truncate w-full">{formatLap(lap.lastLapTimeMs)}</div>
            </div>
            <div className="text-center flex flex-col items-center px-1 w-full overflow-hidden">
              <div className="text-slate-400 text-[8px] md:text-[9px] xl:text-[10px] font-black uppercase tracking-widest">Best Lap</div>
              <div className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-mono font-black text-green-500 mt-2 truncate w-full">{fastest?.best || "-"}</div>
            </div>
          </div>

          <div className={`bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 shadow-xl shrink-0 ${showWeather ? "" : "hidden"}`}>
            <div className="text-sky-400 font-black text-[9px] md:text-[10px] xl:text-xs uppercase tracking-widest mb-1">
              Next Minutes Weather Advice
            </div>
            <div className="text-[10px] md:text-xs xl:text-sm text-slate-200 leading-relaxed">
              {weatherAdvice}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 xl:p-4 shadow-xl flex flex-col justify-between">
              <div className="text-yellow-500 font-black text-[9px] md:text-[10px] xl:text-xs uppercase tracking-widest border-b border-slate-800 pb-1.5">Driver In Front</div>
              <div className="mt-2 xl:mt-3">
                <div className="text-xs md:text-sm xl:text-base font-bold text-white leading-tight">{frontDriver?.name || "-"}</div>
                <div className="text-lg md:text-xl xl:text-2xl font-mono font-black text-slate-300">Last: {frontDriver?.last || "-"}</div>
              </div>
            </div>
            <div className="bg-zinc-950 border border-red-700/50 rounded-lg p-2 md:p-3 xl:p-4 shadow-xl flex flex-col justify-center items-center text-center">
              <div className="text-red-400 font-black text-[9px] md:text-[10px] xl:text-xs uppercase tracking-widest">Your Delta</div>
              <div className="text-3xl md:text-4xl xl:text-5xl font-mono font-black text-red-400 mt-1">
                {deltaText}
              </div>
              <div className="text-slate-400 text-[9px] md:text-[10px] xl:text-xs mt-1">
                P{userPos} | Front gap realtime
              </div>
            </div>
            <div className="bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 xl:p-4 shadow-xl flex flex-col justify-between text-right">
              <div className="text-yellow-500 font-black text-[9px] md:text-[10px] xl:text-xs uppercase tracking-widest border-b border-slate-800 pb-1.5">Driver Behind</div>
              <div className="mt-2 xl:mt-3">
                <div className="text-xs md:text-sm xl:text-base font-bold text-white leading-tight">{behindDriver?.name || "-"}</div>
                <div className="text-lg md:text-xl xl:text-2xl font-mono font-black text-white my-0.5">{behindDriver?.gap || "-"}</div>
                <div className="text-base md:text-lg xl:text-xl font-mono font-black text-slate-300">{behindDriver?.last || "-"}</div>
              </div>
            </div>
          </div>

          <div className={`mt-3 bg-zinc-950 border border-slate-900 rounded-lg p-2 shadow-xl shrink-0 flex-1 min-h-[220px] flex items-center justify-center relative overflow-hidden ${showTrackMap ? "" : "hidden"}`}>
            <span className="absolute top-2 left-3 text-[8px] md:text-[9px] xl:text-[10px] text-slate-500 font-black uppercase tracking-widest z-10">Track Layout</span>
            {trackImageUrl && (
              <img
                src={trackImageUrl}
                className="w-full h-full object-contain filter invert opacity-60 p-2"
                alt={`${selectedTrack?.name || "Track"} Layout`}
              />
            )}
          </div>
        </div>

        <div className="col-span-6 row-span-3 flex flex-col bg-zinc-950 border border-slate-900 rounded-lg p-3 shadow-xl overflow-hidden min-h-0 h-full">
          <div className="flex justify-between items-center bg-zinc-900 p-2 xl:p-3 rounded-md border border-slate-800 mb-3 md:mb-4 shrink-0">
            <div className="flex items-center space-x-1.5 md:space-x-2 xl:space-x-3">
              <div className="relative w-8 h-8 md:w-10 md:h-10 xl:w-12 xl:h-12 rounded-full border-[3px] xl:border-4 border-red-600 bg-zinc-950 flex items-center justify-center shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                <div className="w-3 h-3 md:w-4 md:h-4 xl:w-5 xl:h-5 rounded-full border-2 border-slate-700 bg-zinc-800"></div>
                <span className="absolute -bottom-2 bg-red-600 text-white text-[7px] md:text-[9px] xl:text-[10px] font-black px-1 rounded-sm">{summary?.latestCarStatus?.tyreCompoundLabel || "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[7px] md:text-[9px] xl:text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tyres Laps</span>
                <span className="font-black text-sm md:text-lg xl:text-xl text-white">{summary?.latestCarStatus?.tyresAgeLaps ?? 0}</span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[7px] md:text-[8px] xl:text-[10px] uppercase font-black text-slate-400 tracking-wider mb-0.5 xl:mb-1">Pit Speed Lim</span>
              <div className="bg-slate-100 text-black rounded-full w-8 h-8 md:w-10 md:h-10 xl:w-12 xl:h-12 flex items-center justify-center border-[2px] md:border-[3px] xl:border-4 border-red-600 font-black text-sm md:text-lg xl:text-xl shadow-inner">
                {summary?.latestSession?.pitSpeedLimitKph ?? "-"}
              </div>
            </div>

            <div className="flex flex-col items-end w-16 md:w-20 xl:w-24">
              <div className="w-full flex items-center bg-zinc-950 border border-slate-700 rounded p-0.5 xl:p-1">
                <div className="h-1.5 md:h-2 xl:h-3 bg-green-500 rounded-sm" style={{ width: `${Math.round((summary?.latestCarStatus?.ersStoreEnergyPct || 0))}%` }}></div>
                <div className="h-1.5 md:h-2 xl:h-3 flex-1"></div>
              </div>
              <span className="text-[7px] md:text-[9px] xl:text-[10px] font-black bg-orange-500 text-white px-1 md:px-1.5 py-0.5 rounded-sm mt-1">{Math.round(summary?.latestCarStatus?.ersStoreEnergyPct || 0)}%</span>
            </div>
          </div>

          <div className="flex-1 flex justify-between items-center w-full px-1 xl:px-2 py-2 min-h-[220px] lg:min-h-0 overflow-hidden relative">
            <div className="flex flex-col justify-around h-full py-2 space-y-4 xl:space-y-8 z-10 w-16 md:w-20">
              <TireData psi={telemetry.tires.fl.psi} temp={telemetry.tires.fl.temp} wear={telemetry.tires.fl.wear} />
              <TireData psi={telemetry.tires.rl.psi} temp={telemetry.tires.rl.temp} wear={telemetry.tires.rl.wear} />
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80px] md:w-[90px] xl:w-[110px] h-[180px] md:h-[200px] xl:h-[240px] flex-shrink-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-2 xl:h-3 border border-green-400 bg-green-500/20 rounded-sm"></div>
              <div className="absolute top-2 xl:top-3 left-1/2 -translate-x-1/2 border-l-[8px] md:border-l-[10px] border-l-transparent border-r-[8px] md:border-r-[10px] border-r-transparent border-b-[20px] md:border-b-[25px] xl:border-b-[30px] border-b-green-500/80"></div>
              <div className="absolute top-6 md:top-8 left-1 right-1 h-1 bg-green-500/60"></div>
              <div className="absolute top-5 md:top-6 -left-2 w-2.5 md:w-3 xl:w-4 h-7 md:h-8 xl:h-10 bg-green-500 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="absolute top-5 md:top-6 -right-2 w-2.5 md:w-3 xl:w-4 h-7 md:h-8 xl:h-10 bg-green-500 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>

              <div className="absolute top-10 md:top-12 xl:top-14 left-1/2 -translate-x-1/2 w-[60%] h-[80px] md:h-[90px] xl:h-[110px] border border-green-400 bg-green-500/10 rounded-t-xl flex flex-col items-center justify-center p-1 z-10 backdrop-blur-sm">
                <div className="text-[6px] md:text-[7px] xl:text-[9px] text-green-400 font-bold uppercase">EngineT</div>
                <div className="text-[8px] md:text-[10px] xl:text-xs font-black text-white">{telemetry.car.engineTemp}°</div>
                <div className="w-full h-px bg-green-500/30 my-0.5 xl:my-1"></div>
                <div className="text-[6px] md:text-[7px] xl:text-[9px] text-green-400 font-bold uppercase">EngineL</div>
                <div className="text-[8px] md:text-[10px] xl:text-xs font-black text-white">{telemetry.car.engineWear}%</div>
                <div className="w-full h-px bg-green-500/30 my-0.5 xl:my-1"></div>
                <div className="text-[6px] md:text-[7px] xl:text-[9px] text-green-400 font-bold uppercase">GearBox</div>
                <div className="text-[8px] md:text-[10px] xl:text-xs font-black text-white">{telemetry.car.gearboxWear}%</div>
              </div>

              <div className="absolute bottom-8 md:bottom-10 left-1 right-1 h-1 bg-green-500/60"></div>
              <div className="absolute bottom-5 md:bottom-6 -left-2 w-3 md:w-4 xl:w-5 h-8 md:h-10 xl:h-12 bg-green-500 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="absolute bottom-5 md:bottom-6 -right-2 w-3 md:w-4 xl:w-5 h-8 md:h-10 xl:h-12 bg-green-500 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] h-2 md:h-3 xl:h-4 border border-green-400 bg-green-500/20 rounded-sm"></div>
            </div>

            <div className="flex flex-col justify-around h-full py-2 space-y-4 xl:space-y-8 z-10 w-16 md:w-20">
              <TireData align="right" psi={telemetry.tires.fr.psi} temp={telemetry.tires.fr.temp} wear={telemetry.tires.fr.wear} />
              <TireData align="right" psi={telemetry.tires.rr.psi} temp={telemetry.tires.rr.temp} wear={telemetry.tires.rr.wear} />
            </div>
          </div>

          <div className="pt-2 md:pt-3 xl:pt-5 border-t border-slate-800 flex justify-between items-end shrink-0 h-24 md:h-32 xl:h-48">
            <div className="flex space-x-1 md:space-x-2 xl:space-x-3 pb-1 xl:pb-2 h-full items-end">
              <div className="flex flex-col items-center justify-end h-full">
                <div className="w-2.5 md:w-3 xl:w-4 h-[75%] md:h-[80%] bg-zinc-900 rounded-sm border border-slate-800 flex items-end overflow-hidden mb-1 md:mb-1.5">
                  <div className="w-full bg-red-600 transition-all duration-75 shadow-[0_0_8px_rgba(220,38,38,0.8)]" style={{ height: `${telemetry.brake}%` }}></div>
                </div>
                <span className="text-[7px] md:text-[9px] xl:text-[11px] font-black text-red-500">BRK</span>
              </div>
              <div className="flex flex-col items-center justify-end h-full">
                <div className="w-2.5 md:w-3 xl:w-4 h-[75%] md:h-[80%] bg-zinc-900 rounded-sm border border-slate-800 flex items-end overflow-hidden mb-1 md:mb-1.5">
                  <div className="w-full bg-green-500 transition-all duration-75 shadow-[0_0_8px_rgba(34,197,94,0.8)]" style={{ height: `${telemetry.throttle}%` }}></div>
                </div>
                <span className="text-[7px] md:text-[9px] xl:text-[11px] font-black text-green-500">THR</span>
              </div>
            </div>

            <div className="w-32 md:w-48 xl:w-64 h-full relative flex justify-center items-end pb-1 md:pb-2 flex-1 max-w-[16rem]">
              <svg viewBox="0 0 200 120" className="absolute bottom-0 w-full drop-shadow-lg max-h-full">
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#27272a" strokeWidth="8" strokeLinecap="round" />
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - ((telemetry.rpm / telemetry.maxRpm) * 251.2)}
                  className="transition-all duration-150"
                />
                <text x="20" y="115" fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="middle">0</text>
                <text x="50" y="45" fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="middle">4k</text>
                <text x="100" y="18" fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="middle">8k</text>
                <text x="150" y="45" fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="middle">12k</text>
              </svg>

              <div className="absolute bottom-1 md:bottom-2 xl:bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center w-full">
                <div className="text-[8px] md:text-[10px] xl:text-xs font-mono font-bold text-slate-400 mb-0.5 md:mb-1">{telemetry.rpm} RPM</div>
                <div className="flex items-baseline space-x-0.5 md:space-x-1 leading-none">
                  <span className="text-3xl md:text-5xl xl:text-6xl font-mono font-black text-white">{telemetry.speed}</span>
                  <span className="text-[8px] md:text-[10px] xl:text-xs font-black text-slate-500">KM/H</span>
                </div>
              </div>

              <div className="absolute bottom-0 md:bottom-1 xl:bottom-2 right-1 md:right-2 flex items-center space-x-1">
                <span className="text-[7px] md:text-[9px] xl:text-[10px] font-black text-slate-500 uppercase">Gear</span>
                <span className="text-xl md:text-2xl xl:text-3xl font-mono font-black text-red-500">{telemetry.gear}</span>
              </div>
            </div>

            <div className="flex flex-col items-end justify-end pb-1 xl:pb-2">
              <span className="text-[8px] md:text-[10px] xl:text-[11px] font-black uppercase text-green-500 tracking-wider">Fuel</span>
              <div className="bg-green-500/10 border border-green-500/30 px-1.5 md:px-2 xl:px-3 py-0.5 md:py-1 xl:py-1.5 rounded mt-0.5 md:mt-1">
                <span className="text-[10px] md:text-sm xl:text-base font-mono font-bold text-green-400">{fuelLapsText} Laps</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : (
      <div className="grid grid-cols-12 gap-3 p-3 h-[calc(980px-76px)] overflow-hidden bg-[#050505]">
        <div className={`col-span-3 flex flex-col bg-zinc-950 border border-slate-900 rounded-lg overflow-hidden shadow-xl h-full min-h-0 ${showLeaderboard ? "" : "hidden"}`}>
          <div className="flex justify-between items-center bg-zinc-900 p-2 md:p-3 border-b border-slate-800 shrink-0">
            <span className="text-lg md:text-xl xl:text-2xl font-black tracking-widest text-slate-100">LAP</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl md:text-2xl xl:text-3xl font-black text-white">{lap.currentLapNum || "-"}</span>
              <span className="text-xs md:text-sm xl:text-lg font-bold text-slate-500">/{session.totalLaps || "-"}</span>
            </div>
          </div>

          <div className="grid grid-cols-[25px_1fr_45px_45px_50px_50px] md:grid-cols-[30px_1fr_50px_50px_60px_60px] xl:grid-cols-[30px_1fr_60px_60px_65px_65px] gap-1 md:gap-2 px-2 py-2 text-[8px] md:text-[9px] xl:text-[10px] text-slate-400 uppercase font-black tracking-wider border-b border-slate-800 bg-zinc-950/50 shrink-0">
            <div className="text-center">Pos</div>
            <div>Driver</div>
            <div className="text-right">Gap</div>
            <div className="text-right">Int</div>
            <div className="text-center">Best</div>
            <div className="text-center">Last</div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 #000" }}>
            {drivers.map((d, i) => (
              <div
                key={i}
                className={`grid grid-cols-[25px_1fr_45px_45px_50px_50px] md:grid-cols-[30px_1fr_50px_50px_60px_60px] xl:grid-cols-[30px_1fr_60px_60px_65px_65px] gap-1 md:gap-2 px-2 py-1.5 text-[9px] md:text-[10px] xl:text-xs items-center border-b border-slate-900 hover:bg-zinc-900 transition-colors ${d.highlight ? "bg-blue-900/20" : ""}`}
              >
                <div className="flex justify-center items-center space-x-1">
                  <span className={`w-4 text-right font-bold ${d.highlight ? "text-blue-400" : "text-slate-300"}`}>{d.pos}</span>
                </div>
                <div className="font-semibold flex items-center space-x-1.5 md:space-x-2 truncate">
                  <div className={`w-1 h-3 xl:h-4 ${d.team} rounded-sm shrink-0`}></div>
                  <span className="text-slate-500 text-[8px] md:text-[9px] xl:text-[10px] w-3 xl:w-4 shrink-0">{d.num}</span>
                  <span className={`truncate ${d.highlight ? "text-blue-300" : "text-white"}`}>{d.name}</span>
                </div>
                <div className="text-right font-mono text-slate-300">{d.gap}</div>
                <div className="text-right font-mono text-slate-400">{d.pit}</div>
                <div className={`text-center font-mono py-0.5 rounded ${d.fastest ? "bg-purple-900/40 text-purple-400 font-bold" : "text-green-500"}`}>{d.best}</div>
                <div className={`text-center font-mono py-0.5 rounded ${d.fastest ? "bg-purple-900/40 text-purple-400 font-bold" : "text-green-500"}`}>{d.last}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5 flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-zinc-950 border border-slate-900 rounded-lg p-3 md:p-4 flex flex-col items-center justify-center shadow-xl">
              <h2 className="text-[10px] md:text-xs xl:text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Fastest Lap</h2>
              <div className="text-4xl md:text-3xl xl:text-5xl font-mono font-black text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                {fastest?.best || "-"}
              </div>
              <div className="text-sm md:text-base xl:text-lg font-bold text-purple-400 mt-1 tracking-wider">
                {fastest?.name || "-"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 flex flex-col items-center justify-center shadow-xl">
                <div className="text-yellow-500 font-black text-[9px] md:text-[10px] xl:text-xs uppercase tracking-widest mb-1 text-center">Position</div>
                <div className="text-5xl md:text-4xl xl:text-6xl font-black text-white leading-none">
                  {drivers.find((x) => x.highlight)?.pos || "-"}
                </div>
              </div>
              <div className="bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 flex flex-col items-center justify-center shadow-xl">
                <div className="text-yellow-500 font-black text-[8px] md:text-[9px] xl:text-[10px] uppercase tracking-widest mb-1 text-center leading-tight">Pos Gained/Lost</div>
                <div className="bg-slate-100 text-black text-xl md:text-2xl xl:text-3xl font-black py-0.5 w-10 md:w-12 xl:w-16 text-center rounded shadow-inner leading-none mt-1">0</div>
                <div className="text-red-500 font-black text-sm md:text-base xl:text-lg mt-1">-</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 md:gap-2 bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 shadow-xl shrink-0">
            <div className="text-center flex flex-col items-center border-r border-slate-800 px-1 w-full overflow-hidden">
              <div className="text-slate-400 text-[8px] md:text-[9px] xl:text-[10px] font-black uppercase tracking-widest">Current Lap</div>
              <div className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-mono font-black mt-2 text-white truncate w-full">{formatLap(lap.currentLapTimeMs)}</div>
            </div>
            <div className="text-center flex flex-col items-center border-r border-slate-800 px-1 w-full overflow-hidden">
              <div className="text-slate-400 text-[8px] md:text-[9px] xl:text-[10px] font-black uppercase tracking-widest">Last Lap</div>
              <div className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-mono font-black text-yellow-500 mt-2 truncate w-full">{formatLap(lap.lastLapTimeMs)}</div>
            </div>
            <div className="text-center flex flex-col items-center px-1 w-full overflow-hidden">
              <div className="text-slate-400 text-[8px] md:text-[9px] xl:text-[10px] font-black uppercase tracking-widest">Best Lap</div>
              <div className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-mono font-black text-green-500 mt-2 truncate w-full">{fastest?.best || "-"}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 xl:p-4 shadow-xl flex flex-col justify-between">
              <div className="text-yellow-500 font-black text-[9px] md:text-[10px] xl:text-xs uppercase tracking-widest border-b border-slate-800 pb-1.5">Driver In Front</div>
              <div className="mt-2 xl:mt-3">
                <div className="text-xs md:text-sm xl:text-base font-bold text-white leading-tight">{drivers[0]?.name || "-"}</div>
                <div className="text-lg md:text-xl xl:text-2xl font-mono font-black text-slate-300">Last: {drivers[0]?.last || "-"}</div>
              </div>
            </div>
            <div className="bg-zinc-950 border border-slate-900 rounded-lg p-2 md:p-3 xl:p-4 shadow-xl flex flex-col justify-between text-right">
              <div className="text-yellow-500 font-black text-[9px] md:text-[10px] xl:text-xs uppercase tracking-widest border-b border-slate-800 pb-1.5">Driver Behind</div>
              <div className="mt-2 xl:mt-3">
                <div className="text-xs md:text-sm xl:text-base font-bold text-white leading-tight">{drivers[2]?.name || "-"}</div>
                <div className="text-lg md:text-xl xl:text-2xl font-mono font-black text-white my-0.5">{drivers[2]?.gap || "-"}</div>
                <div className="text-base md:text-lg xl:text-xl font-mono font-black text-slate-300">{drivers[2]?.last || "-"}</div>
              </div>
            </div>
          </div>

          <div className={`mt-3 bg-zinc-950 border border-slate-900 rounded-lg p-2 shadow-xl shrink-0 flex-1 min-h-[220px] flex items-center justify-center relative overflow-hidden ${showTrackMap ? "" : "hidden"}`}>
            <span className="absolute top-2 left-3 text-[8px] md:text-[9px] xl:text-[10px] text-slate-500 font-black uppercase tracking-widest z-10">Track Layout</span>
            {trackImageUrl && (
              <img
                src={trackImageUrl}
                className="w-full h-full object-contain filter invert opacity-60 p-2"
                alt={`${selectedTrack?.name || "Track"} Layout`}
              />
            )}
          </div>
        </div>

        <div className="col-span-4 flex flex-col bg-zinc-950 border border-slate-900 rounded-lg p-3 shadow-xl overflow-hidden min-h-0 h-full">
          <div className="flex justify-between items-center bg-zinc-900 p-2 xl:p-3 rounded-md border border-slate-800 mb-3 md:mb-4 shrink-0">
            <div className="flex items-center space-x-1.5 md:space-x-2 xl:space-x-3">
              <div className="relative w-8 h-8 md:w-10 md:h-10 xl:w-12 xl:h-12 rounded-full border-[3px] xl:border-4 border-red-600 bg-zinc-950 flex items-center justify-center shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                <div className="w-3 h-3 md:w-4 md:h-4 xl:w-5 xl:h-5 rounded-full border-2 border-slate-700 bg-zinc-800"></div>
                <span className="absolute -bottom-2 bg-red-600 text-white text-[7px] md:text-[9px] xl:text-[10px] font-black px-1 rounded-sm">{summary?.latestCarStatus?.tyreCompoundLabel || "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[7px] md:text-[9px] xl:text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tyres Laps</span>
                <span className="font-black text-sm md:text-lg xl:text-xl text-white">{summary?.latestCarStatus?.tyresAgeLaps ?? 0}</span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[7px] md:text-[8px] xl:text-[10px] uppercase font-black text-slate-400 tracking-wider mb-0.5 xl:mb-1">Pit Speed Lim</span>
              <div className="bg-slate-100 text-black rounded-full w-8 h-8 md:w-10 md:h-10 xl:w-12 xl:h-12 flex items-center justify-center border-[2px] md:border-[3px] xl:border-4 border-red-600 font-black text-sm md:text-lg xl:text-xl shadow-inner">
                {summary?.latestSession?.pitSpeedLimitKph ?? "-"}
              </div>
            </div>

            <div className="flex flex-col items-end w-16 md:w-20 xl:w-24">
              <div className="w-full flex items-center bg-zinc-950 border border-slate-700 rounded p-0.5 xl:p-1">
                <div className="h-1.5 md:h-2 xl:h-3 bg-green-500 rounded-sm" style={{ width: `${Math.round((summary?.latestCarStatus?.ersStoreEnergyPct || 0))}%` }}></div>
                <div className="h-1.5 md:h-2 xl:h-3 flex-1"></div>
              </div>
              <span className="text-[7px] md:text-[9px] xl:text-[10px] font-black bg-orange-500 text-white px-1 md:px-1.5 py-0.5 rounded-sm mt-1">{Math.round(summary?.latestCarStatus?.ersStoreEnergyPct || 0)}%</span>
            </div>
          </div>

          <div className="flex-1 flex justify-between items-center w-full px-1 xl:px-2 py-2 min-h-[220px] lg:min-h-0 overflow-hidden relative">
            <div className="flex flex-col justify-around h-full py-2 space-y-4 xl:space-y-8 z-10 w-16 md:w-20">
              <TireData psi={telemetry.tires.fl.psi} temp={telemetry.tires.fl.temp} wear={telemetry.tires.fl.wear} />
              <TireData psi={telemetry.tires.rl.psi} temp={telemetry.tires.rl.temp} wear={telemetry.tires.rl.wear} />
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80px] md:w-[90px] xl:w-[110px] h-[180px] md:h-[200px] xl:h-[240px] flex-shrink-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-2 xl:h-3 border border-green-400 bg-green-500/20 rounded-sm"></div>
              <div className="absolute top-2 xl:top-3 left-1/2 -translate-x-1/2 border-l-[8px] md:border-l-[10px] border-l-transparent border-r-[8px] md:border-r-[10px] border-r-transparent border-b-[20px] md:border-b-[25px] xl:border-b-[30px] border-b-green-500/80"></div>
              <div className="absolute top-6 md:top-8 left-1 right-1 h-1 bg-green-500/60"></div>
              <div className="absolute top-5 md:top-6 -left-2 w-2.5 md:w-3 xl:w-4 h-7 md:h-8 xl:h-10 bg-green-500 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="absolute top-5 md:top-6 -right-2 w-2.5 md:w-3 xl:w-4 h-7 md:h-8 xl:h-10 bg-green-500 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>

              <div className="absolute top-10 md:top-12 xl:top-14 left-1/2 -translate-x-1/2 w-[60%] h-[80px] md:h-[90px] xl:h-[110px] border border-green-400 bg-green-500/10 rounded-t-xl flex flex-col items-center justify-center p-1 z-10 backdrop-blur-sm">
                <div className="text-[6px] md:text-[7px] xl:text-[9px] text-green-400 font-bold uppercase">EngineT</div>
                <div className="text-[8px] md:text-[10px] xl:text-xs font-black text-white">{telemetry.car.engineTemp}°</div>
                <div className="w-full h-px bg-green-500/30 my-0.5 xl:my-1"></div>
                <div className="text-[6px] md:text-[7px] xl:text-[9px] text-green-400 font-bold uppercase">EngineL</div>
                <div className="text-[8px] md:text-[10px] xl:text-xs font-black text-white">{telemetry.car.engineWear}%</div>
                <div className="w-full h-px bg-green-500/30 my-0.5 xl:my-1"></div>
                <div className="text-[6px] md:text-[7px] xl:text-[9px] text-green-400 font-bold uppercase">GearBox</div>
                <div className="text-[8px] md:text-[10px] xl:text-xs font-black text-white">{telemetry.car.gearboxWear}%</div>
              </div>

              <div className="absolute bottom-8 md:bottom-10 left-1 right-1 h-1 bg-green-500/60"></div>
              <div className="absolute bottom-5 md:bottom-6 -left-2 w-3 md:w-4 xl:w-5 h-8 md:h-10 xl:h-12 bg-green-500 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="absolute bottom-5 md:bottom-6 -right-2 w-3 md:w-4 xl:w-5 h-8 md:h-10 xl:h-12 bg-green-500 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] h-2 md:h-3 xl:h-4 border border-green-400 bg-green-500/20 rounded-sm"></div>
            </div>

            <div className="flex flex-col justify-around h-full py-2 space-y-4 xl:space-y-8 z-10 w-16 md:w-20">
              <TireData align="right" psi={telemetry.tires.fr.psi} temp={telemetry.tires.fr.temp} wear={telemetry.tires.fr.wear} />
              <TireData align="right" psi={telemetry.tires.rr.psi} temp={telemetry.tires.rr.temp} wear={telemetry.tires.rr.wear} />
            </div>
          </div>

          <div className="pt-2 md:pt-3 xl:pt-5 border-t border-slate-800 flex justify-between items-end shrink-0 h-24 md:h-32 xl:h-48">
            <div className="flex space-x-1 md:space-x-2 xl:space-x-3 pb-1 xl:pb-2 h-full items-end">
              <div className="flex flex-col items-center justify-end h-full">
                <div className="w-2.5 md:w-3 xl:w-4 h-[75%] md:h-[80%] bg-zinc-900 rounded-sm border border-slate-800 flex items-end overflow-hidden mb-1 md:mb-1.5">
                  <div className="w-full bg-red-600 transition-all duration-75 shadow-[0_0_8px_rgba(220,38,38,0.8)]" style={{ height: `${telemetry.brake}%` }}></div>
                </div>
                <span className="text-[7px] md:text-[9px] xl:text-[11px] font-black text-red-500">BRK</span>
              </div>
              <div className="flex flex-col items-center justify-end h-full">
                <div className="w-2.5 md:w-3 xl:w-4 h-[75%] md:h-[80%] bg-zinc-900 rounded-sm border border-slate-800 flex items-end overflow-hidden mb-1 md:mb-1.5">
                  <div className="w-full bg-green-500 transition-all duration-75 shadow-[0_0_8px_rgba(34,197,94,0.8)]" style={{ height: `${telemetry.throttle}%` }}></div>
                </div>
                <span className="text-[7px] md:text-[9px] xl:text-[11px] font-black text-green-500">THR</span>
              </div>
            </div>

            <div className="w-32 md:w-48 xl:w-64 h-full relative flex justify-center items-end pb-1 md:pb-2 flex-1 max-w-[16rem]">
              <svg viewBox="0 0 200 120" className="absolute bottom-0 w-full drop-shadow-lg max-h-full">
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#27272a" strokeWidth="8" strokeLinecap="round" />
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - ((telemetry.rpm / telemetry.maxRpm) * 251.2)}
                  className="transition-all duration-150"
                />
                <text x="20" y="115" fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="middle">0</text>
                <text x="50" y="45" fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="middle">4k</text>
                <text x="100" y="18" fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="middle">8k</text>
                <text x="150" y="45" fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="middle">12k</text>
              </svg>

              <div className="absolute bottom-1 md:bottom-2 xl:bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center w-full">
                <div className="text-[8px] md:text-[10px] xl:text-xs font-mono font-bold text-slate-400 mb-0.5 md:mb-1">{telemetry.rpm} RPM</div>
                <div className="flex items-baseline space-x-0.5 md:space-x-1 leading-none">
                  <span className="text-3xl md:text-5xl xl:text-6xl font-mono font-black text-white">{telemetry.speed}</span>
                  <span className="text-[8px] md:text-[10px] xl:text-xs font-black text-slate-500">KM/H</span>
                </div>
              </div>

              <div className="absolute bottom-0 md:bottom-1 xl:bottom-2 right-1 md:right-2 flex items-center space-x-1">
                <span className="text-[7px] md:text-[9px] xl:text-[10px] font-black text-slate-500 uppercase">Gear</span>
                <span className="text-xl md:text-2xl xl:text-3xl font-mono font-black text-red-500">{telemetry.gear}</span>
              </div>
            </div>

            <div className="flex flex-col items-end justify-end pb-1 xl:pb-2">
              <span className="text-[8px] md:text-[10px] xl:text-[11px] font-black uppercase text-green-500 tracking-wider">Fuel</span>
              <div className="bg-green-500/10 border border-green-500/30 px-1.5 md:px-2 xl:px-3 py-0.5 md:py-1 xl:py-1.5 rounded mt-0.5 md:mt-1">
                <span className="text-[10px] md:text-sm xl:text-base font-mono font-bold text-green-400">{fuelLapsText} Laps</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
      <SetupModal
        isOpen={showSetupModal}
        sectionPrefs={sectionPrefs}
        onToggle={toggleSection}
        onConfirm={confirmSetup}
        wifiIps={wifiIps}
        udpHost={serverInfo.udpHost || "0.0.0.0"}
        udpPort={serverInfo.udpPort || 20777}
      />
      </div>
    </div>
  );
}

function SetupModal({ isOpen, sectionPrefs, onToggle, onConfirm, wifiIps, udpHost, udpPort }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-zinc-950/95 p-5 text-white shadow-2xl">
        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Ilk Kurulum</div>
        <h2 className="text-xl font-black tracking-wide">Wi-Fi ve Panel Ayarlari</h2>
        <p className="mt-2 text-sm text-slate-300">
          Oyunda telemetry ayarinda UDP host olarak asagidaki IP'lerden birini, port olarak da
          <span className="font-mono text-sky-300"> {udpPort}</span> kullan.
        </p>

        <div className="mt-3 rounded-xl border border-slate-700 bg-black/30 p-3">
          <div className="text-xs uppercase tracking-widest text-slate-400">Ag Bilgileri</div>
          <div className="mt-2 text-sm text-slate-200">UDP Host: <span className="font-mono">{udpHost}</span></div>
          <div className="text-sm text-slate-200">UDP Port: <span className="font-mono">{udpPort}</span></div>
          <div className="mt-2 text-xs text-slate-400">Ayni Wi-Fi icin IP listesi:</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {(wifiIps.length > 0 ? wifiIps : ["IP bekleniyor"]).map((ip) => (
              <span key={ip} className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 font-mono text-xs text-sky-200">
                {ip}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-700 bg-black/30 p-3">
          <div className="text-xs uppercase tracking-widest text-slate-400">Gorunecek Bolumler</div>
          <div className="mt-3 space-y-2 text-sm">
            <label className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
              <span>Leaderboard</span>
              <input type="checkbox" checked={sectionPrefs.leaderboard} onChange={() => onToggle("leaderboard")} />
            </label>
            <label className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
              <span>Track Map</span>
              <input type="checkbox" checked={sectionPrefs.trackMap} onChange={() => onToggle("trackMap")} />
            </label>
            <label className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
              <span>Weather Advice</span>
              <input type="checkbox" checked={sectionPrefs.weather} onChange={() => onToggle("weather")} />
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold uppercase tracking-widest text-white hover:bg-red-500"
          >
            Onayla ve Baslat
          </button>
        </div>
      </div>
    </div>
  );
}

function TireData({ align = "left", psi, temp, wear }) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"} bg-zinc-900/50 p-1 md:p-1.5 xl:p-2 rounded border border-slate-800/50 w-full`}>
      <span className="text-[7px] md:text-[8px] xl:text-[10px] font-mono text-slate-400 mb-0.5 xl:mb-1">{Number(psi || 0).toFixed(2)} PSI</span>
      <span className="text-sm md:text-base xl:text-lg font-black text-white leading-none">{Math.round(Number(temp || 0))}°C</span>
      <span className="text-[8px] md:text-[10px] xl:text-xs font-bold text-slate-300 mt-0.5 md:mt-1">{Math.round(Number(wear || 0))}%</span>
    </div>
  );
}
