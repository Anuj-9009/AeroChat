/**
 * AeroChat — Waterfall Spectrogram
 *
 * Real-time monochromatic waterfall + grid overlay.
 * Each row is one FFT frame scrolling downward.
 * When idle, shows a subtle grid with frequency markers.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Colors, Fonts, Layout } from '../styles/theme';
import type { SpectrumEvent } from '../native/AudioEngineBridge';

// ─────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────

const WATERFALL_ROWS = 32;
const WATERFALL_COLS = 24;
const CELL_HEIGHT = 5;

interface WaterfallProps {
  isActive: boolean;
}

// ─────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────

const WaterfallSpectrogram: React.FC<WaterfallProps> = ({ isActive }) => {
  const [rows, setRows] = useState<number[][]>(() =>
    Array.from({ length: WATERFALL_ROWS }, () =>
      new Array(WATERFALL_COLS).fill(0)
    )
  );

  const pushSpectrum = useCallback((event: SpectrumEvent) => {
    const mags = event.bandMagnitudes || [];
    const normalized = new Array(WATERFALL_COLS).fill(0);
    const step = Math.max(1, Math.floor(mags.length / WATERFALL_COLS));
    for (let i = 0; i < WATERFALL_COLS; i++) {
      const srcIndex = i * step;
      if (srcIndex < mags.length) {
        normalized[i] = Math.min(1.0, Math.log1p(mags[srcIndex]) / 10.0);
      }
    }
    setRows(prev => {
      const next = [...prev];
      next.pop();
      next.unshift(normalized);
      return next;
    });
  }, []);

  const pushSpectrumRef = useRef(pushSpectrum);
  pushSpectrumRef.current = pushSpectrum;

  React.useEffect(() => {
    (WaterfallSpectrogram as any)._pushSpectrum = pushSpectrumRef;
  }, []);

  // ─── Frequency axis labels ───
  const freqLabels = ['16.0', '16.5', '17.0', '17.5', '18.0'];

  // ─── Grid column markers (every 6th column = 1 per freq label) ───
  const gridCols = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < freqLabels.length; i++) {
      set.add(Math.round((i / (freqLabels.length - 1)) * (WATERFALL_COLS - 1)));
    }
    return set;
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>SPECTRUM</Text>
        <View style={styles.statusRow}>
          <View style={[
            styles.dot,
            { backgroundColor: isActive ? '#FFFFFF' : '#333333' },
          ]} />
          <Text style={[
            styles.statusText,
            { color: isActive ? '#FFFFFF' : '#444444' },
          ]}>
            {isActive ? 'RX ACTIVE' : 'RX IDLE'}
          </Text>
        </View>
      </View>

      {/* Grid + waterfall area */}
      <View style={styles.gridOuter}>
        {/* Horizontal grid lines behind the waterfall */}
        <View style={StyleSheet.absoluteFill}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View
              key={`hg-${i}`}
              style={[
                styles.gridLineH,
                { top: `${(i + 1) * 10}%` },
              ]}
            />
          ))}
        </View>

        {/* Vertical grid lines */}
        <View style={StyleSheet.absoluteFill}>
          {Array.from(gridCols).map((col) => (
            <View
              key={`vg-${col}`}
              style={[
                styles.gridLineV,
                { left: `${(col / (WATERFALL_COLS - 1)) * 100}%` },
              ]}
            />
          ))}
        </View>

        {/* Waterfall cells */}
        <View style={styles.grid}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {row.map((intensity, colIdx) => {
                if (intensity === 0) return <View key={colIdx} style={styles.cellEmpty} />;
                return (
                  <View
                    key={colIdx}
                    style={[
                      styles.cell,
                      { backgroundColor: `rgba(245,245,245,${intensity})` },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Center crosshair when idle */}
        {!isActive && (
          <View style={styles.idleOverlay}>
            <Text style={styles.idleText}>■ AWAITING SIGNAL</Text>
            <Text style={styles.idleSubText}>TAP START RX TO LISTEN</Text>
          </View>
        )}
      </View>

      {/* Frequency axis */}
      <View style={styles.freqAxis}>
        {freqLabels.map((f) => (
          <Text key={f} style={styles.axisLabel}>{f}kHz</Text>
        ))}
      </View>

      {/* dB scale */}
      <View style={styles.dbScale}>
        <View style={styles.dbBar}>
          <View style={[styles.dbSegment, { backgroundColor: '#111111' }]} />
          <View style={[styles.dbSegment, { backgroundColor: '#222222' }]} />
          <View style={[styles.dbSegment, { backgroundColor: '#444444' }]} />
          <View style={[styles.dbSegment, { backgroundColor: '#777777' }]} />
          <View style={[styles.dbSegment, { backgroundColor: '#AAAAAA' }]} />
          <View style={[styles.dbSegment, { backgroundColor: '#F5F5F5' }]} />
        </View>
        <View style={styles.dbLabels}>
          <Text style={styles.dbText}>-∞</Text>
          <Text style={styles.dbText}>0dB</Text>
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────
export function pushSpectrumData(event: SpectrumEvent): void {
  const ref = (WaterfallSpectrogram as any)._pushSpectrum;
  if (ref?.current) ref.current(event);
}

export default React.memo(WaterfallSpectrogram);

// ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.BLACK,
    paddingHorizontal: Layout.PADDING,
    paddingTop: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLabel: {
    fontFamily: Fonts.MONO,
    fontSize: 10,
    color: '#444444',
    letterSpacing: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    marginRight: 6,
  },
  statusText: {
    fontFamily: Fonts.MONO,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  gridOuter: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    overflow: 'hidden',
    position: 'relative',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1A1A1A',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#1A1A1A',
  },
  grid: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    height: CELL_HEIGHT,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
  },
  cellEmpty: {
    flex: 1,
    height: CELL_HEIGHT,
  },
  idleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idleText: {
    fontFamily: Fonts.MONO,
    fontSize: 12,
    color: '#333333',
    letterSpacing: 2,
  },
  idleSubText: {
    fontFamily: Fonts.MONO,
    fontSize: 9,
    color: '#222222',
    letterSpacing: 1,
    marginTop: 6,
  },
  freqAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 2,
  },
  axisLabel: {
    fontFamily: Fonts.MONO,
    fontSize: 8,
    color: '#444444',
    letterSpacing: 0.5,
  },
  dbScale: {
    paddingTop: 2,
    paddingBottom: 4,
  },
  dbBar: {
    flexDirection: 'row',
    height: 3,
  },
  dbSegment: {
    flex: 1,
    height: 3,
  },
  dbLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  dbText: {
    fontFamily: Fonts.MONO,
    fontSize: 7,
    color: '#333333',
  },
});
