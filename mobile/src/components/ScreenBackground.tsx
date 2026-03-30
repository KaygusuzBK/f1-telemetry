import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Layered mesh + gradient behind the dashboard (broadcast look).
 */
export function ScreenBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#12152a', '#080a12', '#05060a']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbRed]} />
      <View style={[styles.orb, styles.orbBlue]} />
      <View style={[styles.orb, styles.orbViolet]} />
      <LinearGradient
        colors={['rgba(5,6,10,0)', 'rgba(5,6,10,0.85)', '#05060a']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.scanline} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.55,
  },
  orbRed: {
    top: -90,
    left: -100,
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  orbBlue: {
    top: 140,
    right: -120,
    backgroundColor: 'rgba(56,189,248,0.1)',
  },
  orbViolet: {
    bottom: 40,
    left: -80,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  scanline: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
});
