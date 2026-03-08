/**
 * AeroChat — Native Bridge Interface
 *
 * TypeScript type declarations for the native AudioEngineModule
 * exposed by Kotlin (Android) and Swift (iOS).
 *
 * Both platforms expose identical method signatures through
 * React Native's bridge, so a single interface covers both.
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

// ─────────────────────────────────────────────────────
// Native Module Type Interface
// ─────────────────────────────────────────────────────

export interface IAudioEngineModule {
  /**
   * Transmit a binary string as FSK audio.
   * Each '1' → 18.5kHz tone burst, each '0' → 19.5kHz tone burst.
   * A 50ms guard interval of silence is appended automatically.
   *
   * @param binaryString - String of '0' and '1' characters (framed payload)
   * @returns Promise<boolean> - Resolves true when transmission completes
   */
  transmit(binaryString: string): Promise<boolean>;

  /**
   * Start the FFT receiver loop.
   * Begins emitting 'onSpectrum' events with decoded bit data
   * and band magnitude arrays for waterfall visualization.
   *
   * @returns Promise<boolean> - Resolves true when receiver starts
   */
  startListening(): Promise<boolean>;

  /**
   * Stop the FFT receiver loop.
   * Tears down AudioRecord (Android) or AVAudioEngine tap (iOS).
   *
   * @returns Promise<boolean> - Resolves true when receiver stops
   */
  stopListening(): Promise<boolean>;

  /**
   * Required by NativeEventEmitter.
   */
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

// ─────────────────────────────────────────────────────
// Spectrum Event Types
// ─────────────────────────────────────────────────────

export interface SpectrumEvent {
  /** Dominant frequency in the 18–20kHz band (Hz) */
  peakFrequency: number;
  /** Magnitude of the peak (arbitrary linear units) */
  peakMagnitude: number;
  /** Decoded bit: 1 (mark), 0 (space), -1 (no signal) */
  detectedBit: number;
  /** Raw magnitude array for the 18kHz–20kHz band (waterfall data) */
  bandMagnitudes: number[];
}

// ─────────────────────────────────────────────────────
// Module Export
// ─────────────────────────────────────────────────────

const { AudioEngineModule } = NativeModules;

// Graceful fallback when native module isn't available (e.g. simulator)
const AudioEngineStub: IAudioEngineModule = {
  async transmit(_: string) {
    console.warn('[AeroChat] AudioEngineModule not available — transmit is a no-op');
    return false;
  },
  async startListening() {
    console.warn('[AeroChat] AudioEngineModule not available — startListening is a no-op');
    return false;
  },
  async stopListening() {
    return true;
  },
  addListener() {},
  removeListeners() {},
};

export const AudioEngine: IAudioEngineModule = AudioEngineModule || AudioEngineStub;
export const AudioEngineEvents = new NativeEventEmitter(
  AudioEngineModule || undefined
);
