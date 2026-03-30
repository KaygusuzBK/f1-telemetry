import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { WidgetSize } from '../utils/layoutPrefs';
import { colors, radii, shadows } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  accent?: boolean;
  /** Kart iç boşluk ve köşe — düzen modunda S/M/L */
  size?: WidgetSize;
};

const PAD: Record<WidgetSize, number> = {
  compact: 10,
  normal: 14,
  expanded: 20,
};

const R: Record<WidgetSize, number> = {
  compact: 14,
  normal: radii.card,
  expanded: 26,
};

export function Panel({ children, style, contentStyle, accent = true, size = 'normal' }: Props) {
  const p = PAD[size];
  const r = R[size];
  return (
    <View style={[styles.wrap, shadows.card, { borderRadius: r }, style]}>
      {accent ? <View style={[styles.accentStrip, { borderTopLeftRadius: r, borderBottomLeftRadius: r }]} /> : null}
      <View style={[styles.inner, { padding: p, paddingLeft: p + 4 }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.accent,
    opacity: 0.95,
  },
  inner: {
    /* padding from size */
  },
});
