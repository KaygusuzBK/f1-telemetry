import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radii } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  rightSlot?: React.ReactNode;
  /** Ek üst şerit (ör. CANLI chip) */
  style?: ViewStyle;
};

/**
 * Yayın grafikleri: ikon + başlık + ince gradient şerit.
 */
export function WidgetChrome({ title, subtitle, icon, rightSlot, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient
        colors={['rgba(239,68,68,0.35)', 'rgba(239,68,68,0.05)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.glowBar}
      />
      <View style={styles.row}>
        <LinearGradient
          colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)']}
          style={styles.iconBubble}
        >
          <MaterialCommunityIcons name={icon} size={22} color={colors.accent} />
        </LinearGradient>
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
      </View>
      <View style={styles.cornerAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    position: 'relative',
  },
  glowBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    borderRadius: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  right: {
    marginLeft: 4,
  },
  cornerAccent: {
    position: 'absolute',
    right: 0,
    bottom: -8,
    width: 40,
    height: 3,
    backgroundColor: 'rgba(34,211,238,0.25)',
    borderRadius: 2,
    opacity: 0.8,
  },
});
