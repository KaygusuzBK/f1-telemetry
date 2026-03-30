import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Panel } from '../components/Panel';
import { ScreenBackground } from '../components/ScreenBackground';
import { WidgetChrome } from '../components/WidgetChrome';
import { useUdpTelemetry } from '../hooks/useUdpTelemetry';
import { colors, radii, shadows } from '../theme';
import {
  DEFAULT_WIDGET_ORDER,
  type WidgetId,
  chooseTrack,
  getTrackOutlook,
  getWeatherAdvice,
  normalizeDrivers,
} from '../utils/dashboard';
import {
  DEFAULT_WIDGET_SPANS,
  DEFAULT_WIDGET_SIZES,
  HEIGHT_STORAGE_KEY,
  MAX_CARD_HEIGHT,
  MIN_CARD_HEIGHT,
  SIZE_STORAGE_KEY,
  SPAN_STORAGE_KEY,
  type WidgetHeights,
  type WidgetSize,
  type WidgetSpan,
  cycleSpan,
  mergeHeights,
  mergeSpans,
  mergeSizes,
  nextSize,
  spanLabel,
  widgetDimensions,
} from '../utils/layoutPrefs';

const ORDER_KEY = 'f1-mobile-widget-order';
const HIDDEN_KEY = 'f1-mobile-widget-hidden';
const PRESETS_KEY = 'f1-mobile-layout-presets-v1';
const ACTIVE_PRESET_KEY = 'f1-mobile-layout-active-v1';

type SessionLite = {
  sessionType?: string;
  weather?: string;
  trackTemperatureC?: number;
  airTemperatureC?: number;
  sessionTimeLeftSec?: number;
  totalLaps?: number;
  trackLengthM?: number;
  trackId?: number;
};

type LapLite = {
  currentLapNum?: number;
  currentLapTimeMs?: number;
  lastLapTimeMs?: number;
  lapDistanceM?: number;
};

type Telem = {
  index?: number;
  speedKph?: number;
  gear?: number;
  engineRPM?: number;
  throttle?: number;
  brake?: number;
  drsEnabled?: boolean;
  tyres?: Array<{
    temp?: number;
    surfaceTempC?: number;
    pressurePsi?: number;
  }>;
};

type CarStatus = {
  fuelRemainingLaps?: number;
};

type CarDamage = {
  tyresWearPct?: number[];
};

type DashboardPreset = {
  id: string;
  name: string;
  widgetOrder: WidgetId[];
  hidden: Partial<Record<WidgetId, boolean>>;
  widgetSizes: Record<WidgetId, WidgetSize>;
  widgetSpans: Record<WidgetId, WidgetSpan>;
  widgetHeights: WidgetHeights;
  updatedAt: number;
};

type LapReplay = {
  lapNum: number;
  avgSpeed: number;
  maxSpeed: number;
  avgThrottle: number;
  avgBrake: number;
  lastLapMs: number;
  createdAt: number;
};

type LapAgg = {
  lapNum: number;
  speedSum: number;
  throttleSum: number;
  brakeSum: number;
  maxSpeed: number;
  samples: number;
};

function buildDefaultPreset(): DashboardPreset {
  return {
    id: 'default',
    name: 'Varsayilan',
    widgetOrder: DEFAULT_WIDGET_ORDER,
    hidden: {},
    widgetSizes: DEFAULT_WIDGET_SIZES,
    widgetSpans: DEFAULT_WIDGET_SPANS,
    widgetHeights: {},
    updatedAt: Date.now(),
  };
}

function sanitizePreset(preset: DashboardPreset): DashboardPreset {
  return {
    ...preset,
    widgetOrder: mergeOrder(preset.widgetOrder),
    hidden: preset.hidden || {},
    widgetSizes: mergeSizes(preset.widgetSizes),
    widgetSpans: mergeSpans(preset.widgetSpans || {}),
    widgetHeights: mergeHeights(preset.widgetHeights || {}),
  };
}

export function DashboardScreen() {
  const { summary, listening, error, localIp, udpPort } = useUdpTelemetry();
  const { width: viewportWidth } = useWindowDimensions();
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('tr-TR', { hour12: false })
  );
  const [tick, setTick] = useState(0);
  const [editLayout, setEditLayout] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(DEFAULT_WIDGET_ORDER);
  const [hidden, setHidden] = useState<Partial<Record<WidgetId, boolean>>>({});
  const [widgetSizes, setWidgetSizes] =
    useState<Record<WidgetId, WidgetSize>>(DEFAULT_WIDGET_SIZES);
  const [widgetSpans, setWidgetSpans] =
    useState<Record<WidgetId, WidgetSpan>>(DEFAULT_WIDGET_SPANS);
  const [widgetHeights, setWidgetHeights] = useState<WidgetHeights>({});
  const [presets, setPresets] = useState<DashboardPreset[]>([buildDefaultPreset()]);
  const [activePresetId, setActivePresetId] = useState('default');
  const [lapReplay, setLapReplay] = useState<LapReplay[]>([]);
  const [replayMode, setReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [presetHint, setPresetHint] = useState('');
  const [draggingAny, setDraggingAny] = useState(false);
  const lapAggRef = useRef<LapAgg | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString('tr-TR', { hour12: false }));
      setTick((v) => v + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [rawPresets, activeRaw] = await Promise.all([
          AsyncStorage.getItem(PRESETS_KEY),
          AsyncStorage.getItem(ACTIVE_PRESET_KEY),
        ]);
        if (rawPresets) {
          const parsed = JSON.parse(rawPresets) as DashboardPreset[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed.map(sanitizePreset);
            setPresets(cleaned);
            const activeId =
              activeRaw && cleaned.some((x) => x.id === activeRaw) ? activeRaw : cleaned[0].id;
            const active = cleaned.find((x) => x.id === activeId) || cleaned[0];
            setActivePresetId(active.id);
            setWidgetOrder(active.widgetOrder);
            setHidden(active.hidden);
            setWidgetSizes(active.widgetSizes);
            setWidgetSpans(active.widgetSpans);
            setWidgetHeights(active.widgetHeights);
            return;
          }
        }

        // Tek presetli eski yapidan migration.
        const raw = await AsyncStorage.getItem(ORDER_KEY);
        const hid = await AsyncStorage.getItem(HIDDEN_KEY);
        const [sz, sp, ht] = await Promise.all([
          AsyncStorage.getItem(SIZE_STORAGE_KEY),
          AsyncStorage.getItem(SPAN_STORAGE_KEY),
          AsyncStorage.getItem(HEIGHT_STORAGE_KEY),
        ]);
        const migratedOrder =
          raw && Array.isArray(JSON.parse(raw)) ? mergeOrder(JSON.parse(raw) as WidgetId[]) : DEFAULT_WIDGET_ORDER;
        const migratedHidden = hid ? (JSON.parse(hid) as Partial<Record<WidgetId, boolean>>) : {};
        const migratedSizes = sz
          ? mergeSizes(JSON.parse(sz) as Partial<Record<WidgetId, WidgetSize>>)
          : DEFAULT_WIDGET_SIZES;
        const migratedSpans = sp
          ? mergeSpans(JSON.parse(sp) as Partial<Record<WidgetId, WidgetSpan>>)
          : DEFAULT_WIDGET_SPANS;
        const migratedHeights = ht ? mergeHeights(JSON.parse(ht) as WidgetHeights) : {};
        const migrated: DashboardPreset = {
          id: 'default',
          name: 'Varsayilan',
          widgetOrder: migratedOrder,
          hidden: migratedHidden,
          widgetSizes: migratedSizes,
          widgetSpans: migratedSpans,
          widgetHeights: migratedHeights,
          updatedAt: Date.now(),
        };
        setPresets([migrated]);
        setActivePresetId('default');
        setWidgetOrder(migratedOrder);
        setHidden(migratedHidden);
        setWidgetSizes(migratedSizes);
        setWidgetSpans(migratedSpans);
        setWidgetHeights(migratedHeights);
        await Promise.all([
          AsyncStorage.setItem(PRESETS_KEY, JSON.stringify([migrated])),
          AsyncStorage.setItem(ACTIVE_PRESET_KEY, 'default'),
        ]);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const persistPresets = useCallback(async (next: DashboardPreset[], nextActiveId: string) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next)),
        AsyncStorage.setItem(ACTIVE_PRESET_KEY, nextActiveId),
      ]);
    } catch {
      /* ignore */
    }
  }, []);

  const setActivePreset = useCallback(
    (preset: DashboardPreset) => {
      const clean = sanitizePreset(preset);
      setActivePresetId(clean.id);
      setWidgetOrder(clean.widgetOrder);
      setHidden(clean.hidden);
      setWidgetSizes(clean.widgetSizes);
      setWidgetSpans(clean.widgetSpans);
      setWidgetHeights(clean.widgetHeights);
      AsyncStorage.setItem(ACTIVE_PRESET_KEY, clean.id).catch(() => {});
    },
    []
  );

  const updateActivePreset = useCallback(
    (
      nextState: Partial<
        Pick<DashboardPreset, 'widgetOrder' | 'hidden' | 'widgetSizes' | 'widgetSpans' | 'widgetHeights'> & {
          name: string;
        }
      >
    ) => {
      setPresets((prev) => {
        const idx = Math.max(
          0,
          prev.findIndex((p) => p.id === activePresetId)
        );
        const current = prev[idx] || buildDefaultPreset();
        const nextPreset = sanitizePreset({
          ...current,
          ...nextState,
          updatedAt: Date.now(),
        });
        const next = [...prev];
        next[idx] = nextPreset;
        persistPresets(next, nextPreset.id).catch(() => {});
        AsyncStorage.multiSet([
          [ORDER_KEY, JSON.stringify(nextPreset.widgetOrder)],
          [HIDDEN_KEY, JSON.stringify(nextPreset.hidden)],
          [SIZE_STORAGE_KEY, JSON.stringify(nextPreset.widgetSizes)],
          [SPAN_STORAGE_KEY, JSON.stringify(nextPreset.widgetSpans)],
          [HEIGHT_STORAGE_KEY, JSON.stringify(nextPreset.widgetHeights)],
        ]).catch(() => {});
        return next;
      });
    },
    [activePresetId, persistPresets]
  );

  const persistOrder = useCallback(
    (order: WidgetId[]) => {
      setWidgetOrder(order);
      updateActivePreset({ widgetOrder: order });
    },
    [updateActivePreset]
  );

  const toggleHidden = useCallback(
    (id: WidgetId) => {
      const next = { ...hidden, [id]: !hidden[id] };
      setHidden(next);
      updateActivePreset({ hidden: next });
    },
    [hidden, updateActivePreset]
  );

  const moveWidget = useCallback(
    (index: number, delta: number) => {
      const next = [...widgetOrder];
      const to = index + delta;
      if (to < 0 || to >= next.length) return;
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      persistOrder(mergeOrder(next));
    },
    [widgetOrder, persistOrder]
  );

  const setWidgetSize = useCallback(
    (id: WidgetId, size: WidgetSize) => {
      setWidgetSizes((prev) => {
        const next = { ...prev, [id]: size };
        updateActivePreset({ widgetSizes: next });
        return next;
      });
    },
    [updateActivePreset]
  );

  const setWidgetSpan = useCallback(
    (id: WidgetId, span: WidgetSpan) => {
      setWidgetSpans((prev) => {
        const next = { ...prev, [id]: span };
        updateActivePreset({ widgetSpans: next });
        return next;
      });
    },
    [updateActivePreset]
  );

  const setWidgetHeight = useCallback(
    (id: WidgetId, height: number | null) => {
      setWidgetHeights((prev) => {
        const next = { ...prev };
        if (height === null) {
          delete next[id];
        } else {
          next[id] = Math.max(MIN_CARD_HEIGHT, Math.min(MAX_CARD_HEIGHT, Math.round(height)));
        }
        updateActivePreset({ widgetHeights: next });
        return next;
      });
    },
    [updateActivePreset]
  );

  const createPresetFromCurrent = useCallback(() => {
    const id = `preset-${Date.now().toString(36)}`;
    const nextPreset: DashboardPreset = sanitizePreset({
      id,
      name: `Tasarim ${presets.length + 1}`,
      widgetOrder,
      hidden,
      widgetSizes,
      widgetSpans,
      widgetHeights,
      updatedAt: Date.now(),
    });
    const next = [...presets, nextPreset];
    setPresets(next);
    setActivePreset(nextPreset);
    persistPresets(next, nextPreset.id).catch(() => {});
    setPresetHint(`Kaydedildi: ${nextPreset.name}`);
  }, [hidden, persistPresets, presets, setActivePreset, widgetHeights, widgetOrder, widgetSizes, widgetSpans]);

  const deleteActivePreset = useCallback(() => {
    if (presets.length <= 1) {
      setPresetHint('En az bir tasarim kalmali');
      return;
    }
    const idx = presets.findIndex((x) => x.id === activePresetId);
    const next = presets.filter((x) => x.id !== activePresetId);
    const fallback = next[Math.max(0, idx - 1)] || next[0];
    setPresets(next);
    setActivePreset(fallback);
    persistPresets(next, fallback.id).catch(() => {});
    setPresetHint(`Silindi, aktif: ${fallback.name}`);
  }, [activePresetId, persistPresets, presets, setActivePreset]);

  useEffect(() => {
    if (!presetHint) return;
    const timer = setTimeout(() => setPresetHint(''), 2000);
    return () => clearTimeout(timer);
  }, [presetHint]);

  const session = (summary.latestSession || {}) as SessionLite;
  const trackLengthM = Number(session.trackLengthM || 0);
  const trackId = Number(session.trackId ?? 0);
  const selectedTrack = chooseTrack(trackId, trackLengthM);
  const trackImageUrl = selectedTrack
    ? `https://raw.githubusercontent.com/coggs/f1_svg/main/${encodeURIComponent(selectedTrack.file)}`
    : null;

  const drivers = useMemo(() => normalizeDrivers(summary), [summary]);
  const lap = (summary.latestLapData || {}) as LapLite;
  const t = (summary.latestTelemetry || null) as Telem | null;
  const status = (summary.latestCarStatus || null) as CarStatus | null;
  const damage = (summary.latestCarDamage || null) as CarDamage | null;

  const tyreRL = t?.tyres?.[0] || {};
  const tyreRR = t?.tyres?.[1] || {};
  const tyreFL = t?.tyres?.[2] || {};
  const tyreFR = t?.tyres?.[3] || {};
  const wear = damage?.tyresWearPct || [0, 0, 0, 0];

  const telemetry = {
    speed: Number(t?.speedKph || 0),
    gear: Number(t?.gear || 0),
    rpm: Number(t?.engineRPM || 0),
    throttle: Math.round(Number(t?.throttle || 0) * 100),
    brake: Math.round(Number(t?.brake || 0) * 100),
    fuelLaps: Number(status?.fuelRemainingLaps || 0),
    drs: Boolean(t?.drsEnabled),
    tires: {
      fl: {
        temp: Number(tyreFL.surfaceTempC ?? tyreFL.temp ?? 0),
        wear: Number(wear[2] || 0),
        psi: Number(tyreFL.pressurePsi || 0),
      },
      fr: {
        temp: Number(tyreFR.surfaceTempC ?? tyreFR.temp ?? 0),
        wear: Number(wear[3] || 0),
        psi: Number(tyreFR.pressurePsi || 0),
      },
      rl: {
        temp: Number(tyreRL.surfaceTempC ?? tyreRL.temp ?? 0),
        wear: Number(wear[0] || 0),
        psi: Number(tyreRL.pressurePsi || 0),
      },
      rr: {
        temp: Number(tyreRR.surfaceTempC ?? tyreRR.temp ?? 0),
        wear: Number(wear[1] || 0),
        psi: Number(tyreRR.pressurePsi || 0),
      },
    },
  };

  useEffect(() => {
    const lapNum = Number(lap.currentLapNum || 0);
    if (!lapNum) return;

    const speed = Number(telemetry.speed || 0);
    const throttle = Number(telemetry.throttle || 0);
    const brake = Number(telemetry.brake || 0);
    const existing = lapAggRef.current;

    if (!existing) {
      lapAggRef.current = {
        lapNum,
        speedSum: speed,
        throttleSum: throttle,
        brakeSum: brake,
        maxSpeed: speed,
        samples: 1,
      };
      return;
    }

    if (existing.lapNum !== lapNum) {
      const samples = Math.max(existing.samples, 1);
      const item: LapReplay = {
        lapNum: existing.lapNum,
        avgSpeed: existing.speedSum / samples,
        maxSpeed: existing.maxSpeed,
        avgThrottle: existing.throttleSum / samples,
        avgBrake: existing.brakeSum / samples,
        lastLapMs: Number(lap.lastLapTimeMs || 0),
        createdAt: Date.now(),
      };
      setLapReplay((prev) => {
        const deduped = prev.filter((x) => x.lapNum !== item.lapNum);
        const next = [...deduped, item].slice(-5);
        return next;
      });
      lapAggRef.current = {
        lapNum,
        speedSum: speed,
        throttleSum: throttle,
        brakeSum: brake,
        maxSpeed: speed,
        samples: 1,
      };
      return;
    }

    lapAggRef.current = {
      ...existing,
      speedSum: existing.speedSum + speed,
      throttleSum: existing.throttleSum + throttle,
      brakeSum: existing.brakeSum + brake,
      maxSpeed: Math.max(existing.maxSpeed, speed),
      samples: existing.samples + 1,
    };
  }, [lap.currentLapNum, lap.lastLapTimeMs, telemetry.brake, telemetry.speed, telemetry.throttle]);

  useEffect(() => {
    if (!lapReplay.length) {
      setReplayIndex(0);
      setReplayMode(false);
      return;
    }
    setReplayIndex((prev) => Math.min(prev, lapReplay.length - 1));
  }, [lapReplay.length]);

  const highlightedDriver = drivers.find((x) => x.highlight);
  const userPos = highlightedDriver?.pos || '-';
  const frontDriver = highlightedDriver ? drivers[Math.max(0, Number(userPos) - 2)] : drivers[0];
  const behindDriver = highlightedDriver
    ? drivers[Math.min(drivers.length - 1, Number(userPos))]
    : drivers[2];
  const deltaText =
    highlightedDriver && typeof highlightedDriver.gap === 'string' && highlightedDriver.gap !== 'Leader'
      ? highlightedDriver.gap
      : '-';
  const fastest = drivers.find((d) => d.fastest) || drivers[0];
  const weatherAdvice = getWeatherAdvice(session);
  const trackOutlook = getTrackOutlook(session);
  const outlookTone =
    String(session.weather || '')
      .toLowerCase()
      .includes('rain') || String(session.weather || '').toLowerCase().includes('storm')
      ? styles.outlookRain
      : String(session.weather || '').toLowerCase().includes('cloud')
        ? styles.outlookCloud
        : styles.outlookClear;
  const selectedReplay = lapReplay[replayIndex] || null;
  const paceSpeed = replayMode && selectedReplay ? Math.round(selectedReplay.avgSpeed) : telemetry.speed;
  const paceThrottle =
    replayMode && selectedReplay ? Math.round(selectedReplay.avgThrottle) : telemetry.throttle;
  const paceBrake = replayMode && selectedReplay ? Math.round(selectedReplay.avgBrake) : telemetry.brake;
  const lapDistance = Number(lap.lapDistanceM || 0);
  const liveTrackProgress =
    trackLengthM > 0 && Number.isFinite(lapDistance)
      ? Math.max(0, Math.min(1, lapDistance / trackLengthM))
      : null;
  const simulatedTrackProgress = ((tick % 75) + 1) / 75;
  const trackProgress = liveTrackProgress ?? simulatedTrackProgress;
  const usingSimulatedTrack = liveTrackProgress === null;

  const isNarrow = viewportWidth < 420;

  const renderWidget = useCallback(
    (id: WidgetId) => {
      const sz = widgetSizes[id] ?? 'normal';
      const dim = widgetDimensions(sz);

      switch (id) {
        case 'session':
          return (
            <Panel size={sz}>
              <WidgetChrome
                icon="flag-checkered"
                title="Oturum"
                subtitle={`${String(session.sessionType || '—')} · ${String(session.weather || '—')}`}
              />
              <View style={styles.sessionGrid}>
                <View style={styles.sessionCell}>
                  <Text style={[styles.label, { fontSize: dim.label }]}>Pist / hava</Text>
                  <Text style={[styles.valueSmall, { fontSize: dim.body }]}>
                    {session.trackTemperatureC ?? '—'}°C / {session.airTemperatureC ?? '—'}°C
                  </Text>
                </View>
                <View style={styles.sessionCell}>
                  <Text style={[styles.label, { fontSize: dim.label }]}>Kalan süre</Text>
                  <Text style={[styles.sessionBig, { fontSize: dim.body + 6 }]}>
                    {session.sessionTimeLeftSec ?? '—'} sn
                  </Text>
                </View>
              </View>
            </Panel>
          );
        case 'pace':
          return (
            <Panel size={sz}>
              <WidgetChrome
                icon="speedometer"
                title="Race pace"
                subtitle={replayMode && selectedReplay ? `Replay · Tur ${selectedReplay.lapNum}` : 'Canlı telemetri'}
                rightSlot={
                  <View style={styles.liveChip}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveChipText}>
                      {replayMode && selectedReplay ? 'REPLAY' : 'CANLI'}
                    </Text>
                  </View>
                }
              />
              <View style={[styles.speedRing, { borderRadius: dim.radius + 4 }]}>
                <LinearGradient
                  colors={['rgba(239,68,68,0.35)', 'rgba(239,68,68,0.02)']}
                  style={[styles.speedRingGrad, { borderRadius: dim.radius + 4 }]}
                />
                <Text style={[styles.huge, { fontSize: dim.speed }]}>{paceSpeed}</Text>
                <Text style={[styles.speedUnit, { fontSize: dim.label + 2 }]}>km/h</Text>
              </View>
              <Text style={[styles.sub, { fontSize: dim.body }]}>
                Vites {telemetry.gear} · {telemetry.rpm} rpm
              </Text>
              <View style={styles.row}>
                <View style={[styles.badge, telemetry.drs && styles.badgeActive]}>
                  <Text style={[styles.badgeText, { fontSize: dim.label }]}>DRS {telemetry.drs ? 'ON' : 'OFF'}</Text>
                </View>
                <View style={styles.badgeSky}>
                  <Text style={[styles.badgeSkyText, { fontSize: dim.label }]}>Yakıt +{telemetry.fuelLaps.toFixed(2)}</Text>
                </View>
              </View>
              <View style={styles.triGrid}>
                <MiniStat
                  label="Tur"
                  value={`${lap.currentLapNum ?? '—'}/${session.totalLaps ?? '—'}`}
                  valSize={dim.miniVal}
                />
                <MiniStat label="Pozisyon" value={`P${userPos}`} valSize={dim.miniVal} />
                <MiniStat label="Delta" value={deltaText} accent valSize={dim.miniVal} />
              </View>
              <View style={styles.barBlock}>
                <Text style={[styles.barLabel, { fontSize: dim.label }]}>Gaz</Text>
                <View style={[styles.barTrack, { height: dim.barH }]}>
                  <LinearGradient
                    colors={['#064e3b', '#34d399', '#6ee7b7']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.barFillGrad, { width: `${Math.max(4, paceThrottle)}%` }]}
                  />
                </View>
                <Text style={[styles.barLabel, { fontSize: dim.label }]}>Fren</Text>
                <View style={[styles.barTrack, { height: dim.barH }]}>
                  <LinearGradient
                    colors={['#881337', '#fb7185', '#fda4af']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.barFillGrad, { width: `${Math.max(4, paceBrake)}%` }]}
                  />
                </View>
              </View>
            </Panel>
          );
        case 'replay':
          return (
            <Panel size={sz}>
              <WidgetChrome
                icon="history"
                title="Replay modu"
                subtitle="Son 5 tur analizi"
                rightSlot={
                  <TouchableOpacity
                    style={[styles.replayToggle, replayMode && styles.replayToggleOn]}
                    onPress={() => setReplayMode((v) => !v)}
                  >
                    <Text style={[styles.replayToggleText, replayMode && styles.replayToggleTextOn]}>
                      {replayMode ? 'ACIK' : 'KAPALI'}
                    </Text>
                  </TouchableOpacity>
                }
              />
              {lapReplay.length ? (
                <>
                  <View style={styles.replayMainRow}>
                    <View style={styles.replayStat}>
                      <Text style={[styles.label, { fontSize: dim.label }]}>Tur</Text>
                      <Text style={[styles.replayMainValue, { fontSize: dim.body + 8 }]}>
                        #{selectedReplay?.lapNum ?? '-'}
                      </Text>
                    </View>
                    <View style={styles.replayStat}>
                      <Text style={[styles.label, { fontSize: dim.label }]}>Ort hiz</Text>
                      <Text style={[styles.replayMainValue, { fontSize: dim.body + 8 }]}>
                        {Math.round(selectedReplay?.avgSpeed || 0)}
                      </Text>
                    </View>
                    <View style={styles.replayStat}>
                      <Text style={[styles.label, { fontSize: dim.label }]}>Tur suresi</Text>
                      <Text style={[styles.replayMainValue, { fontSize: dim.body + 5 }]}>
                        {selectedReplay?.lastLapMs ? `${(selectedReplay.lastLapMs / 1000).toFixed(3)}s` : '-'}
                      </Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.replayStrip}>
                    {lapReplay.map((x, idx) => (
                      <TouchableOpacity
                        key={x.lapNum}
                        style={[styles.replayChip, replayIndex === idx && styles.replayChipOn]}
                        onPress={() => {
                          setReplayIndex(idx);
                          setReplayMode(true);
                        }}
                      >
                        <Text style={[styles.replayChipTop, replayIndex === idx && styles.replayChipTopOn]}>
                          TUR {x.lapNum}
                        </Text>
                        <Text style={[styles.replayChipBottom, replayIndex === idx && styles.replayChipBottomOn]}>
                          {Math.round(x.avgSpeed)} km/h
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <Text style={styles.muted}>Replay icin en az iki tur verisi bekleniyor.</Text>
              )}
            </Panel>
          );
        case 'gaps':
          return (
            <Panel size={sz}>
              <WidgetChrome icon="account-group" title="Mesafeler" subtitle="Ön / arka sürücü" />
              <View style={styles.gapRow}>
                <View style={[styles.gapCol, { padding: dim.gapPad }]}>
                  <Text style={[styles.muted, { fontSize: dim.label }]}>Önde</Text>
                  <Text style={[styles.name, { fontSize: dim.body }]} numberOfLines={1}>
                    {frontDriver?.name || '—'}
                  </Text>
                  <Text style={[styles.mono, { fontSize: dim.body + 2 }]}>{frontDriver?.last || '—'}</Text>
                </View>
                <View style={[styles.gapCol, { padding: dim.gapPad }]}>
                  <Text style={[styles.muted, { fontSize: dim.label }]}>Arkada</Text>
                  <Text style={[styles.name, { fontSize: dim.body }]} numberOfLines={1}>
                    {behindDriver?.name || '—'}
                  </Text>
                  <Text style={[styles.mono, { fontSize: dim.body + 2 }]}>{behindDriver?.last || '—'}</Text>
                </View>
              </View>
              <View style={styles.fastRow}>
                <Text style={[styles.muted, { fontSize: dim.label }]}>En hızlı tur</Text>
                <Text style={[styles.fastMono, { fontSize: dim.body + 6 }]}>{fastest?.best || '—'}</Text>
                <Text style={[styles.fastName, { fontSize: dim.body - 1 }]} numberOfLines={1}>
                  {fastest?.name || ''}
                </Text>
              </View>
            </Panel>
          );
        case 'leaderboard':
          return (
            <Panel size={sz} contentStyle={styles.panelFlush}>
              <View style={styles.lbChromePad}>
                <WidgetChrome icon="trophy" title="Canlı sıralama" subtitle="Tur zamanı · gap" />
              </View>
              <ScrollView nestedScrollEnabled>
                {drivers.slice(0, 16).map((d) => (
                  <View
                    key={d.pos}
                    style={[styles.lbRow, d.highlight && styles.lbRowHi]}
                  >
                    <Text style={[styles.lbPos, { fontSize: dim.label + 1 }]}>{d.pos}</Text>
                    <View style={[styles.lbDot, { backgroundColor: d.team }]} />
                    <Text style={[styles.lbName, { fontSize: dim.body }]} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={[styles.lbTime, { fontSize: dim.label + 1 }]}>{d.best}</Text>
                    <Text style={[styles.lbGap, { fontSize: dim.label }]}>{d.gap}</Text>
                  </View>
                ))}
              </ScrollView>
            </Panel>
          );
        case 'track':
          return (
            <Panel size={sz}>
              <WidgetChrome icon="map-outline" title="Pist haritası" subtitle={selectedTrack?.name || ''} />
              <View style={[styles.mapBox, { aspectRatio: dim.mapAspect, borderRadius: dim.radius }]}>
                {trackImageUrl ? (
                  <Image
                    source={{ uri: trackImageUrl }}
                    style={styles.mapImg}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.muted}>Veri bekleniyor</Text>
                )}
              </View>
              <View style={styles.trackSimWrap}>
                <View style={styles.trackSimRail}>
                  <LinearGradient
                    colors={['rgba(34,211,238,0.2)', 'rgba(239,68,68,0.35)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.trackSimFill, { width: `${Math.max(4, trackProgress * 100)}%` }]}
                  />
                </View>
                <Text style={styles.trackSimText}>
                  {usingSimulatedTrack ? 'Simulasyon konumu' : 'Canli konum'} · %{Math.round(trackProgress * 100)}
                </Text>
              </View>
            </Panel>
          );
        case 'weather':
          return (
            <Panel size={sz}>
              <WidgetChrome icon="weather-partly-cloudy" title="Hava & pist" subtitle="Strateji özeti" />
              <Text style={[styles.quoteText, { fontSize: dim.body + 1 }]}>{weatherAdvice}</Text>
              <View style={styles.weatherStrip}>
                <Text style={[styles.muted, { fontSize: dim.label }]}>
                  Pist {session.trackTemperatureC ?? '—'}°C · Hava {session.airTemperatureC ?? '—'}°C
                </Text>
              </View>
            </Panel>
          );
        case 'tyres':
          return (
            <Panel size={sz}>
              <WidgetChrome icon="tire" title="Lastikler" subtitle="Sıcaklık · aşınma · psi" />
              <View style={styles.tyreGrid}>
                <TireCell
                  label="FL"
                  {...telemetry.tires.fl}
                  pad={dim.tyrePad}
                  fontLabel={dim.label}
                  fontMain={dim.body}
                />
                <TireCell
                  label="FR"
                  {...telemetry.tires.fr}
                  alignRight
                  pad={dim.tyrePad}
                  fontLabel={dim.label}
                  fontMain={dim.body}
                />
                <TireCell
                  label="RL"
                  {...telemetry.tires.rl}
                  pad={dim.tyrePad}
                  fontLabel={dim.label}
                  fontMain={dim.body}
                />
                <TireCell
                  label="RR"
                  {...telemetry.tires.rr}
                  alignRight
                  pad={dim.tyrePad}
                  fontLabel={dim.label}
                  fontMain={dim.body}
                />
              </View>
            </Panel>
          );
        case 'debug':
          return (
            <Panel size={sz}>
              <WidgetChrome icon="console-line" title="Bağlantı" subtitle="UDP · paketler" />
              <View style={styles.debugBox}>
                <Text style={[styles.muted, { fontSize: dim.body }]}>
                  UDP {listening ? 'dinleniyor' : 'başlatılıyor'} — {udpPort}
                </Text>
                <Text style={[styles.muted, { fontSize: dim.body }]}>Paket: {summary.receivedPackets}</Text>
                <Text style={[styles.muted, { fontSize: dim.label + 1 }]}>
                  Son: {summary.latestHeader?.packetName || '—'} ({summary.latestSender || '—'})
                </Text>
                {error ? <Text style={styles.err}>{error}</Text> : null}
              </View>
            </Panel>
          );
        default:
          return null;
      }
    },
    [
      widgetSizes,
      session,
      telemetry,
      lap,
      replayMode,
      selectedReplay,
      paceSpeed,
      paceThrottle,
      paceBrake,
      lapReplay,
      replayIndex,
      userPos,
      deltaText,
      frontDriver,
      behindDriver,
      fastest,
      drivers,
      trackImageUrl,
      weatherAdvice,
      listening,
      udpPort,
      summary,
      error,
      selectedTrack?.name,
      trackProgress,
      usingSimulatedTrack,
    ]
  );

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* ── HEADER ─────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerAccent} />
          <View style={styles.headerRow}>
            <View style={styles.brand}>
              <Text style={styles.brandF1}>F1</Text>
              <Text style={styles.brandDot}>·</Text>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTrack} numberOfLines={1}>
                {selectedTrack?.name || 'Veri bekleniyor'}
              </Text>
              <Text style={[styles.headerSub, outlookTone]} numberOfLines={1}>
                {String(session.weather || '—')} · {session.trackTemperatureC ?? '—'}°C
              </Text>
            </View>
            <View style={styles.headerEnd}>
              <TouchableOpacity
                style={[styles.editBtn, editLayout && styles.editBtnOn]}
                onPress={() => setEditLayout((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.editBtnIcon, editLayout && styles.editBtnIconOn]}>
                  {editLayout ? '✓' : '⊞'}
                </Text>
              </TouchableOpacity>
              <View style={styles.liveRow}>
                <View style={[styles.liveBullet, listening && styles.liveBulletOn]} />
                <Text style={styles.liveLabel}>LIVE</Text>
              </View>
              <Text style={styles.clock}>{time}</Text>
            </View>
          </View>
        </View>

        {/* ── GRID ───────────────────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={!draggingAny}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.grid}>
            {widgetOrder.map((id, idx) => {
              if (hidden[id] && !editLayout) return null;
              return (
                <DraggableCard
                  key={id}
                  id={id}
                  index={idx}
                  isEditMode={editLayout}
                  isHidden={Boolean(hidden[id])}
                  span={widgetSpans[id] ?? 'full'}
                  isNarrow={isNarrow}
                  size={widgetSizes[id] ?? 'normal'}
                  onMoveBy={(delta) => moveWidget(idx, delta)}
                  onToggleHidden={() => toggleHidden(id)}
                  onCycleSize={() => setWidgetSize(id, nextSize(widgetSizes[id] ?? 'normal'))}
                  onToggleSpan={() =>
                    setWidgetSpan(id, cycleSpan(widgetSpans[id] ?? 'full'))
                  }
                  height={widgetHeights[id] ?? null}
                  onSetHeight={(h) => setWidgetHeight(id, h)}
                  onDragStart={() => setDraggingAny(true)}
                  onDragEnd={() => setDraggingAny(false)}
                >
                  {renderWidget(id)}
                </DraggableCard>
              );
            })}
          </View>
          <View style={{ height: editLayout ? 180 : 40 }} />
        </ScrollView>

        {/* ── PRESET DOTS (normal mode) ──────────────────── */}
        {!editLayout && presets.length > 1 && (
          <View style={styles.presetDotBar}>
            {presets.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.presetDot, p.id === activePresetId && styles.presetDotOn]}
                onPress={() => setActivePreset(p)}
              />
            ))}
          </View>
        )}

        {/* ── EDIT BAR (edit mode, slides from bottom) ──── */}
        {editLayout && (
          <View style={styles.editBar}>
            {presetHint ? (
              <Text style={styles.editBarHint}>{presetHint}</Text>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.editBarPresets}
            >
              {presets.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.editBarChip, p.id === activePresetId && styles.editBarChipOn]}
                  onPress={() => setActivePreset(p)}
                >
                  <Text
                    style={[
                      styles.editBarChipText,
                      p.id === activePresetId && styles.editBarChipTextOn,
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.editBarActions}>
              <TouchableOpacity style={styles.editBarSecBtn} onPress={deleteActivePreset}>
                <Text style={styles.editBarSecBtnText}>Sil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editBarSecBtn} onPress={createPresetFromCurrent}>
                <Text style={styles.editBarSecBtnText}>Kaydet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editBarDoneBtn}
                onPress={() => setEditLayout(false)}
              >
                <Text style={styles.editBarDoneBtnText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function mergeOrder(order: WidgetId[]): WidgetId[] {
  const set = new Set(order);
  const merged = [...order];
  for (const id of DEFAULT_WIDGET_ORDER) {
    if (!set.has(id)) merged.push(id);
  }
  return merged;
}

// ── DraggableCard ────────────────────────────────────────────────────────────
function DraggableCard({
  id: _id,
  index: _index,
  isEditMode,
  isHidden,
  span,
  isNarrow,
  size,
  height,
  children,
  onMoveBy,
  onToggleHidden,
  onCycleSize,
  onToggleSpan,
  onSetHeight,
  onDragStart,
  onDragEnd,
}: {
  id: WidgetId;
  index: number;
  isEditMode: boolean;
  isHidden: boolean;
  span: WidgetSpan;
  isNarrow: boolean;
  size: WidgetSize;
  height: number | null;
  children: React.ReactNode;
  onMoveBy: (delta: number) => void;
  onToggleHidden: () => void;
  onCycleSize: () => void;
  onToggleSpan: () => void;
  onSetHeight: (h: number | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const lift = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const cooldown = useRef(0);
  const [dragging, setDragging] = useState(false);
  // Resize state
  const baseHeightRef = useRef<number>(height ?? 0);
  const renderedHeightRef = useRef<number>(0); // onLayout ile güncellenir
  const [liveHeight, setLiveHeight] = useState<number | null>(height);
  const [resizing, setResizing] = useState(false);

  // Keep liveHeight in sync when external height prop changes
  useEffect(() => {
    setLiveHeight(height);
    baseHeightRef.current = height ?? 0;
  }, [height]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          isEditMode && (Math.abs(g.dy) > 6 || Math.abs(g.dx) > 6),
        onPanResponderGrant: () => {
          setDragging(true);
          onDragStart();
          Animated.spring(lift, { toValue: 1.05, useNativeDriver: true, speed: 30 }).start();
        },
        onPanResponderMove: (_, g) => {
          translateY.setValue(g.dy);
          translateX.setValue(g.dx * 0.05);
          const now = Date.now();
          if (now - cooldown.current < 190) return;
          if (Math.abs(g.dy) > 60) {
            cooldown.current = now;
            onMoveBy(g.dy > 0 ? 1 : -1);
            translateY.setValue(0);
            translateX.setValue(0);
          }
        },
        onPanResponderRelease: (_, g) => {
          setDragging(false);
          onDragEnd();
          if (!isNarrow && Math.abs(g.dx) > 24) {
            onToggleSpan();
          }
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 5 }),
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 22 }),
            Animated.spring(lift, { toValue: 1, useNativeDriver: true, speed: 28 }),
          ]).start();
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          onDragEnd();
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
            Animated.spring(lift, { toValue: 1, useNativeDriver: true }),
          ]).start();
        },
      }),
    [isEditMode, isNarrow, lift, onDragEnd, onDragStart, onMoveBy, onToggleSpan, translateX, translateY]
  );

  const resizeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isEditMode,
        onMoveShouldSetPanResponder: () => isEditMode,
        onPanResponderGrant: () => {
          setResizing(true);
          // İlk sürüklemede gerçek render yüksekliğini başlangıç olarak kullan
          baseHeightRef.current = liveHeight ?? (renderedHeightRef.current || 120);
        },
        onPanResponderMove: (_, g) => {
          const next = Math.max(
            MIN_CARD_HEIGHT,
            Math.min(MAX_CARD_HEIGHT, baseHeightRef.current + g.dy)
          );
          setLiveHeight(next);
        },
        onPanResponderRelease: (_, g) => {
          setResizing(false);
          const finalH = Math.max(
            MIN_CARD_HEIGHT,
            Math.min(MAX_CARD_HEIGHT, baseHeightRef.current + g.dy)
          );
          baseHeightRef.current = finalH;
          setLiveHeight(finalH);
          onSetHeight(finalH);
        },
        onPanResponderTerminate: () => {
          setResizing(false);
          setLiveHeight(baseHeightRef.current || null);
        },
      }),
    [isEditMode, liveHeight, onSetHeight, renderedHeightRef]
  );

  const effectiveSpan: WidgetSpan = isNarrow && span !== 'full' ? 'half' : span;
  const spanStyle =
    effectiveSpan === 'quarter' ? styles.cardQuarter
    : effectiveSpan === 'third' ? styles.cardThird
    : effectiveSpan === 'half'  ? styles.cardHalf
    : styles.cardFull;

  // Kullanıcı yüksekliği elle ayarladıysa tam yükseklik, ayarlamadıysa içerik boyutuna göre doğal akış
  const heightStyle = liveHeight != null ? { height: liveHeight, overflow: 'hidden' as const } : undefined;

  return (
    <Animated.View
      onLayout={(e) => {
        renderedHeightRef.current = e.nativeEvent.layout.height;
      }}
      style={[
        styles.cardOuter,
        spanStyle,
        isEditMode && styles.cardEditMode,
        resizing && styles.cardResizing,
        isHidden && isEditMode && styles.cardDimmed,
        dragging && styles.cardLifted,
        heightStyle,
        {
          transform: [{ translateX }, { translateY }, { scale: lift }],
          zIndex: dragging ? 99 : resizing ? 98 : 1,
        },
      ]}
      {...(isEditMode ? panResponder.panHandlers : {})}
    >
      {children}

      {isEditMode && (
        <>
          {/* × / + top-left */}
          <TouchableOpacity
            style={styles.badgeX}
            onPress={onToggleHidden}
            hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
          >
            <LinearGradient
              colors={isHidden ? ['#22d3ee', '#0891b2'] : ['#ef4444', '#b91c1c']}
              style={styles.badgeXGrad}
            >
              <Text style={styles.badgeXIcon}>{isHidden ? '+' : '×'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Size + Span badges top-right */}
          <View style={styles.badgesRight}>
            <TouchableOpacity
              style={styles.badgePill}
              onPress={onCycleSize}
              hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}
            >
              <Text style={styles.badgePillText}>
                {size === 'compact' ? 'S' : size === 'normal' ? 'M' : 'L'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.badgePill, styles.badgePillSpan]}
              onPress={onToggleSpan}
              hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}
            >
              <Text style={styles.badgePillText}>{spanLabel(span)}</Text>
            </TouchableOpacity>
          </View>

          {/* Resize grip — bottom-right */}
          <View style={styles.resizeGripWrap} {...resizeResponder.panHandlers}>
            <View style={[styles.resizeGrip, resizing && styles.resizeGripActive]}>
              <Text style={styles.resizeGripIcon}>⤡</Text>
              {liveHeight != null && (
                <Text style={styles.resizeGripLabel}>{Math.round(liveHeight)}</Text>
              )}
            </View>
          </View>

          {/* Reset height pill — only when custom height set */}
          {liveHeight != null && (
            <TouchableOpacity
              style={styles.resetHeightBtn}
              onPress={() => {
                setLiveHeight(null);
                baseHeightRef.current = 0;
                onSetHeight(null);
              }}
              hitSlop={{ top: 6, left: 6, bottom: 6, right: 6 }}
            >
              <Text style={styles.resetHeightText}>↺</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </Animated.View>
  );
}

function MiniStat({
  label,
  value,
  accent,
  valSize = 14,
}: {
  label: string;
  value: string;
  accent?: boolean;
  valSize?: number;
}) {
  return (
    <View style={[styles.mini, accent && styles.miniAccent]}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniVal, { fontSize: valSize }, accent && { color: '#fecaca' }]}>{value}</Text>
    </View>
  );
}

function TireCell({
  label,
  temp,
  wear,
  psi,
  alignRight,
  pad = 10,
  fontLabel = 10,
  fontMain = 11,
}: {
  label: string;
  temp: number;
  wear: number;
  psi: number;
  alignRight?: boolean;
  pad?: number;
  fontLabel?: number;
  fontMain?: number;
}) {
  return (
    <View
      style={[
        styles.tyreCell,
        { padding: pad },
        alignRight && { alignItems: 'flex-end' },
      ]}
    >
      <Text style={[styles.tyreLabel, { fontSize: fontLabel }]}>{label}</Text>
      <Text style={[styles.tyreMain, { fontSize: fontMain }]}>
        {temp.toFixed(0)}° / {wear.toFixed(0)}%
      </Text>
      <Text style={[styles.muted, { fontSize: fontLabel, marginTop: 4 }]}>{psi.toFixed(1)} psi</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── root / safe ────────────────────────────────────────────
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: 'transparent' },

  // ── header ─────────────────────────────────────────────────
  header: {
    backgroundColor: 'rgba(8,9,14,0.98)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerAccent: { height: 3, backgroundColor: colors.accent },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  brand: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  brandF1: {
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#fff',
    letterSpacing: -1,
  },
  brandDot: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.accent,
    textShadowColor: colors.accentGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTrack: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  // reuse for outlook tone
  outlookRain: { color: '#60a5fa' },
  outlookCloud: { color: colors.gold },
  outlookClear: { color: colors.emerald },
  headerEnd: { alignItems: 'flex-end', gap: 4 },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  editBtnIcon: { color: colors.muted, fontSize: 16, fontWeight: '700' },
  editBtnIconOn: { color: '#fca5a5' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveBullet: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  liveBulletOn: {
    backgroundColor: colors.emerald,
    shadowColor: colors.emerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 3,
  },
  liveLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  clock: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },

  // ── scroll / grid ───────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-start',
  },

  // ── card wrapper ────────────────────────────────────────────
  cardOuter: { marginBottom: 2 },
  cardFull: { width: '100%' },
  cardHalf: { width: '47.5%' },
  cardThird: { width: '31%' },
  cardQuarter: { width: '22.5%' },
  cardEditMode: {
    borderColor: 'rgba(239,68,68,0.25)',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  cardResizing: {
    borderColor: colors.cyan,
    shadowColor: colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  cardDimmed: { opacity: 0.38 },
  // resize grip
  resizeGripWrap: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    padding: 4,
    zIndex: 20,
  },
  resizeGrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(8,9,14,0.88)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  resizeGripActive: {
    borderColor: colors.cyan,
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  resizeGripIcon: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  resizeGripLabel: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
  },
  resetHeightBtn: {
    position: 'absolute',
    bottom: 0,
    right: 72,
    zIndex: 20,
    padding: 6,
    backgroundColor: 'rgba(8,9,14,0.75)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetHeightText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  cardLifted: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 18,
  },

  // ── edit badges ─────────────────────────────────────────────
  badgeX: {
    position: 'absolute',
    top: -9,
    left: -9,
    zIndex: 20,
  },
  badgeXGrad: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeXIcon: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 18,
  },
  badgesRight: {
    position: 'absolute',
    top: -9,
    right: -9,
    flexDirection: 'row',
    gap: 4,
    zIndex: 20,
  },
  badgePill: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderBright,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  badgePillSpan: { borderColor: colors.border },
  badgePillText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },

  // ── preset dot bar (normal mode) ────────────────────────────
  presetDotBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(8,9,14,0.6)',
  },
  presetDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  presetDotOn: {
    backgroundColor: colors.accent,
    width: 16,
    borderRadius: 3,
  },

  // ── edit bar (bottom) ───────────────────────────────────────
  editBar: {
    backgroundColor: 'rgba(8,9,14,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.09)',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  editBarHint: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  editBarPresets: { gap: 8 },
  editBarChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  editBarChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  editBarChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  editBarChipTextOn: { color: '#fca5a5' },
  editBarActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editBarSecBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  editBarSecBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  editBarDoneBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.accent,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  editBarDoneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ── widget internals ────────────────────────────────────────
  label: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 5,
    fontWeight: '700',
  },
  valueSmall: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  huge: {
    color: '#ffffff',
    fontSize: 56,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    textShadowColor: 'rgba(239,68,68,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: Platform.OS === 'ios' ? 28 : 18,
  },
  speedUnit: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  speedRing: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    paddingVertical: 16,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  speedRingGrad: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  sub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  muted: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeActive: {
    borderColor: 'rgba(74,222,128,0.5)',
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  badgeText: { color: '#fecaca', fontSize: 10, fontWeight: '700' },
  badgeSky: {
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.4)',
    backgroundColor: 'rgba(14,165,233,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeSkyText: { color: colors.sky, fontSize: 10, fontWeight: '800' },
  triGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  mini: {
    flex: 1,
    backgroundColor: colors.bgPanelInner,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  miniAccent: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(248,113,113,0.45)',
  },
  miniLabel: {
    color: colors.muted,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  miniVal: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  barBlock: { marginTop: 12 },
  barLabel: {
    color: colors.muted,
    fontSize: 9,
    marginBottom: 4,
    marginTop: 6,
  },
  barTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barFillGrad: { height: '100%', borderRadius: 4, minWidth: 2 },
  sessionGrid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sessionCell: {
    flex: 1,
    backgroundColor: colors.bgPanelInner,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  sessionBig: {
    color: colors.cyan,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  gapRow: { flexDirection: 'row', gap: 12 },
  gapCol: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  name: { color: colors.text, fontWeight: '600', fontSize: 13 },
  mono: {
    fontFamily: 'monospace',
    color: colors.text,
    fontSize: 16,
    marginTop: 4,
  },
  fastRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fastMono: {
    color: colors.purple,
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  fastName: { color: colors.muted, fontSize: 12, marginTop: 2 },
  lbChromePad: { paddingHorizontal: 4, marginBottom: 4 },
  panelFlush: { paddingHorizontal: 0, paddingBottom: 0, paddingTop: 4 },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  lbRowHi: { backgroundColor: 'rgba(34,211,238,0.08)' },
  lbPos: { width: 22, color: colors.muted, fontWeight: '800' },
  lbDot: { width: 6, height: 10, borderRadius: 2 },
  lbName: { flex: 1, color: colors.text, fontSize: 12 },
  lbTime: {
    fontFamily: 'monospace',
    color: colors.emerald,
    fontSize: 11,
    width: 64,
    textAlign: 'right',
  },
  lbGap: {
    fontFamily: 'monospace',
    color: colors.muted,
    fontSize: 10,
    width: 52,
    textAlign: 'right',
  },
  mapBox: {
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.15)',
  },
  mapImg: { width: '100%', height: '100%', opacity: 0.75 },
  trackSimWrap: { marginTop: 10 },
  trackSimRail: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  trackSimFill: { height: '100%', borderRadius: 999 },
  trackSimText: { marginTop: 6, color: colors.muted, fontSize: 11, fontWeight: '600' },
  quoteText: {
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: 4,
    fontWeight: '500',
  },
  weatherStrip: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tyreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tyreCell: {
    width: '47%',
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  tyreLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  tyreMain: {
    color: colors.text,
    fontSize: 11,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  debugBox: { marginTop: 6, gap: 6 },
  err: { color: colors.accent, marginTop: 6, fontSize: 11 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  liveChipText: {
    color: '#86efac',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  replayToggle: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  replayToggleOn: {
    borderColor: 'rgba(52,211,153,0.5)',
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  replayToggleText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  replayToggleTextOn: { color: colors.emerald },
  replayMainRow: { flexDirection: 'row', gap: 8 },
  replayStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.bgPanelInner,
  },
  replayMainValue: {
    color: colors.text,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  replayStrip: { marginTop: 12 },
  replayChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    minWidth: 90,
  },
  replayChipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  replayChipTop: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  replayChipTopOn: { color: '#fecaca' },
  replayChipBottom: {
    color: colors.text,
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  replayChipBottomOn: { color: colors.text },
});
