import type { WidgetId } from './dashboard';

export type WidgetSize = 'compact' | 'normal' | 'expanded';
export type WidgetSpan = 'full' | 'half' | 'third' | 'quarter';

export const SIZE_STORAGE_KEY = 'f1-mobile-widget-sizes';
export const SPAN_STORAGE_KEY = 'f1-mobile-widget-spans';
export const HEIGHT_STORAGE_KEY = 'f1-mobile-widget-heights';

export type WidgetHeights = Partial<Record<WidgetId, number>>;

export const MIN_CARD_HEIGHT = 72;
export const MAX_CARD_HEIGHT = 640;

export function mergeHeights(parsed: WidgetHeights): WidgetHeights {
  const out: WidgetHeights = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      const clamped = Math.max(MIN_CARD_HEIGHT, Math.min(MAX_CARD_HEIGHT, v));
      out[k as WidgetId] = clamped;
    }
  }
  return out;
}

/** Default boyut: tüm kartlar normal */
export const DEFAULT_WIDGET_SIZES: Record<WidgetId, WidgetSize> = {
  session: 'normal',
  pace: 'normal',
  replay: 'normal',
  gaps: 'normal',
  leaderboard: 'normal',
  track: 'normal',
  weather: 'normal',
  tyres: 'normal',
  debug: 'compact',
};

export const DEFAULT_WIDGET_SPANS: Record<WidgetId, WidgetSpan> = {
  session: 'full',
  pace: 'full',
  replay: 'full',
  gaps: 'half',
  leaderboard: 'full',
  track: 'full',
  weather: 'half',
  tyres: 'half',
  debug: 'quarter',
};

export const SPAN_CYCLE: WidgetSpan[] = ['full', 'half', 'third', 'quarter'];

export function cycleSpan(current: WidgetSpan): WidgetSpan {
  const idx = SPAN_CYCLE.indexOf(current);
  return SPAN_CYCLE[(idx + 1) % SPAN_CYCLE.length];
}

export function spanLabel(span: WidgetSpan): string {
  switch (span) {
    case 'full':    return '1/1';
    case 'half':    return '1/2';
    case 'third':   return '1/3';
    case 'quarter': return '1/4';
  }
}

export function mergeSizes(
  parsed: Partial<Record<WidgetId, WidgetSize>>
): Record<WidgetId, WidgetSize> {
  return { ...DEFAULT_WIDGET_SIZES, ...parsed };
}

export function mergeSpans(
  parsed: Partial<Record<WidgetId, WidgetSpan>>
): Record<WidgetId, WidgetSpan> {
  return { ...DEFAULT_WIDGET_SPANS, ...parsed };
}

/** Boyuta göre tipografi ölçekleri — yükseklikler içerik tabanlı */
export function widgetDimensions(size: WidgetSize) {
  switch (size) {
    case 'compact':
      return {
        speed: 40,
        tyrePad: 6,
        gapPad: 8,
        label: 9,
        body: 12,
        radius: 14,
        barH: 6,
        miniVal: 12,
        mapAspect: 1.6 as number,
      };
    case 'expanded':
      return {
        speed: 68,
        tyrePad: 12,
        gapPad: 14,
        label: 11,
        body: 15,
        radius: 24,
        barH: 10,
        miniVal: 16,
        mapAspect: 1.6 as number,
      };
    default:
      return {
        speed: 56,
        tyrePad: 10,
        gapPad: 10,
        label: 10,
        body: 13,
        radius: 20,
        barH: 8,
        miniVal: 14,
        mapAspect: 1.6 as number,
      };
  }
}

export function nextSize(current: WidgetSize): WidgetSize {
  if (current === 'compact') return 'normal';
  if (current === 'normal') return 'expanded';
  return 'compact';
}
