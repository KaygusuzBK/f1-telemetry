import type { TelemetrySummary } from '../telemetry/engine';

const TRACK_CATALOG = [
  { file: 'Sakhir (Bahrain).svg', name: 'Bahrain - Sakhir', length: 5412 },
  { file: 'Jeddah.svg', name: 'Jeddah', length: 6174 },
  { file: 'Melbourne.svg', name: 'Melbourne', length: 5278 },
  { file: 'Imola.svg', name: 'Imola', length: 4909 },
  { file: 'Miami.svg', name: 'Miami', length: 5412 },
  { file: 'Catalunya.svg', name: 'Catalunya', length: 4657 },
  { file: 'Monaco.svg', name: 'Monaco', length: 3337 },
  { file: 'Monza.svg', name: 'Monza', length: 5793 },
  { file: 'Spa.svg', name: 'Spa', length: 7004 },
  { file: 'Silverstone.svg', name: 'Silverstone', length: 5891 },
  { file: 'Las Vegas.svg', name: 'Las Vegas', length: 6201 },
  { file: 'Abu Dhabi.svg', name: 'Abu Dhabi', length: 5281 },
];

const TRACK_BY_ID: Record<number, string> = {
  6: 'Melbourne.svg',
};

const TEAM_COLORS = [
  '#dc2626',
  '#1e3a8a',
  '#b91c1c',
  '#14b8a6',
  '#2dd4bf',
  '#15803d',
  '#f97316',
  '#65a30d',
  '#991b1b',
  '#2563eb',
  '#e5e7eb',
  '#ec4899',
  '#1d4ed8',
  '#d1d5db',
  '#db2777',
  '#3b82f6',
  '#4338ca',
  '#ea580c',
  '#0891b2',
  '#1e40af',
  '#737373',
  '#be185d',
];

export function formatLap(ms: number) {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return '-';
  const minutes = Math.floor(t / 60000);
  const seconds = ((t % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${String(minutes).padStart(2, '0')}:${seconds}`;
}

export function chooseTrack(trackId: number, trackLengthM: number) {
  if (TRACK_BY_ID[trackId]) {
    const found = TRACK_CATALOG.find((x) => x.file === TRACK_BY_ID[trackId]);
    if (found) return found;
  }
  if (!trackLengthM) {
    return TRACK_CATALOG[0];
  }
  return TRACK_CATALOG.reduce(
    (best, item) => {
      const diff = Math.abs(item.length - trackLengthM);
      if (!best || diff < best.diff) {
        return { ...item, diff };
      }
      return best;
    },
    null as (typeof TRACK_CATALOG)[0] & { diff: number } | null
  );
}

export type NormalizedDriver = {
  pos: number;
  num: number;
  name: string;
  team: string;
  gap: string;
  best: string;
  last: string;
  fastest: boolean;
  highlight: boolean;
};

export function normalizeDrivers(summary: TelemetrySummary | null): NormalizedDriver[] {
  const raw = summary?.driversOverview || [];
  const session = summary?.latestSession || ({} as { trackLengthM?: number });
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
    const gapSecs = idx === 0 ? 'Leader' : `+${((leaderScore - d.score) / 80).toFixed(2)}`;
    return {
      pos: idx + 1,
      num: d.raceNumber || d._i + 1,
      name: d.name || `Driver ${d._i + 1}`,
      team: TEAM_COLORS[d.teamId ?? (d._i % TEAM_COLORS.length)] || '#1d4ed8',
      gap: gapSecs,
      best: formatLap(d.lastLapTimeMs),
      last: formatLap(d.currentLapTimeMs || d.lastLapTimeMs),
      fastest: idx === 0 && Number(d.lastLapTimeMs) > 0,
      highlight: d.index === summary?.latestTelemetry?.index,
    };
  });
}

export function getWeatherAdvice(session: { weather?: string; trackTemperatureC?: number }) {
  const weather = String(session?.weather || '').toLowerCase();
  const trackTemp = Number(session?.trackTemperatureC || 0);

  if (weather.includes('rain') || weather.includes('storm')) {
    return 'Islak zemin riski. Fren mesafesini uzat, pitte inter/wet değerlendir.';
  }
  if (weather.includes('cloud')) {
    return 'Sıcaklık dalgalanabilir. Lastik penceresini koru.';
  }
  if (trackTemp >= 35) {
    return 'Lastik aşınması artabilir. Yumuşak çıkış ve çekiş kontrolü.';
  }
  return 'Koşullar stabil. Mevcut stint planıyla devam uygun.';
}

export function getTrackOutlook(session: { weather?: string; trackTemperatureC?: number }) {
  const weather = String(session?.weather || '').toLowerCase();
  const trackTemp = Number(session?.trackTemperatureC || 0);

  if (weather.includes('rain') || weather.includes('storm')) {
    return 'Islak bölgeler; düşük tutuş.';
  }
  if (weather.includes('cloud')) {
    return 'Sektör bazlı grip dalgalanabilir.';
  }
  if (trackTemp >= 35) {
    return 'Sıcak asfalt; arka lastik aşınması yükselebilir.';
  }
  return 'Grip dengeli.';
}

export type WidgetId =
  | 'session'
  | 'pace'
  | 'replay'
  | 'gaps'
  | 'leaderboard'
  | 'track'
  | 'weather'
  | 'tyres'
  | 'debug';

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'session',
  'pace',
  'replay',
  'gaps',
  'leaderboard',
  'track',
  'weather',
  'tyres',
  'debug',
];
