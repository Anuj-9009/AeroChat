/**
 * AeroChat — Mesh Controller
 *
 * High-level API that wires together the native audio bridge
 * and the FSK protocol encoder/decoder.
 *
 * This is the single entry point that the UI layer imports.
 *
 * Usage:
 *   import { MeshController } from './protocol/MeshController';
 *
 *   const mesh = new MeshController();
 *   mesh.onMessage((msg) => console.log('Received:', msg));
 *   await mesh.startListening();
 *   await mesh.sendMessage('Hello from AeroChat');
 */

import { EmitterSubscription } from 'react-native';
import { AudioEngine, AudioEngineEvents, SpectrumEvent } from '../native/AudioEngineBridge';
import { encodeMessage, BitStreamAccumulator, DecodeResult } from './FSKProtocol';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface MeshMessage {
  text: string;
  timestamp: number;
  direction: 'sent' | 'received';
}

export type OnMessageCallback = (message: MeshMessage) => void;
export type OnSpectrumCallback = (spectrum: SpectrumEvent) => void;
export type OnErrorCallback = (error: string) => void;

// ─────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────

export class MeshController {
  private accumulator: BitStreamAccumulator;
  private spectrumSubscription: EmitterSubscription | null = null;
  private errorSubscription: EmitterSubscription | null = null;
  private messageCallbacks: OnMessageCallback[] = [];
  private spectrumCallbacks: OnSpectrumCallback[] = [];
  private errorCallbacks: OnErrorCallback[] = [];
  private _isListening = false;
  private _isTransmitting = false;

  constructor() {
    this.accumulator = new BitStreamAccumulator();
  }

  // ─────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────

  get isListening(): boolean {
    return this._isListening;
  }

  get isTransmitting(): boolean {
    return this._isTransmitting;
  }

  /**
   * Start listening for incoming FSK acoustic signals.
   * Begins emitting spectrum data for the waterfall and
   * automatically decodes complete messages.
   */
  async startListening(): Promise<void> {
    if (this._isListening) return;

    this.accumulator.clear();

    // Subscribe to native spectrum events
    this.spectrumSubscription = AudioEngineEvents.addListener(
      'onSpectrum',
      (event: SpectrumEvent) => this.handleSpectrumEvent(event),
    );

    this.errorSubscription = AudioEngineEvents.addListener(
      'onError',
      (error: string) => {
        this.errorCallbacks.forEach(cb => cb(error));
      },
    );

    await AudioEngine.startListening();
    this._isListening = true;
  }

  /**
   * Stop listening for incoming signals.
   */
  async stopListening(): Promise<void> {
    if (!this._isListening) return;

    await AudioEngine.stopListening();

    this.spectrumSubscription?.remove();
    this.errorSubscription?.remove();
    this.spectrumSubscription = null;
    this.errorSubscription = null;
    this._isListening = false;
  }

  /**
   * Send a text message over the acoustic mesh.
   * Encodes the text into framed binary and transmits as FSK audio.
   *
   * @param text - ASCII message to send (max 255 chars)
   */
  async sendMessage(text: string): Promise<void> {
    if (this._isTransmitting) {
      throw new Error('Already transmitting');
    }

    this._isTransmitting = true;

    try {
      const binaryFrame = encodeMessage(text);
      await AudioEngine.transmit(binaryFrame);

      // Notify UI of sent message
      const msg: MeshMessage = {
        text,
        timestamp: Date.now(),
        direction: 'sent',
      };
      this.messageCallbacks.forEach(cb => cb(msg));
    } finally {
      this._isTransmitting = false;
    }
  }

  // ─────────────────────────────────────────────────
  // Event Subscriptions
  // ─────────────────────────────────────────────────

  /** Register callback for decoded messages */
  onMessage(callback: OnMessageCallback): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }

  /** Register callback for raw spectrum data (waterfall) */
  onSpectrum(callback: OnSpectrumCallback): () => void {
    this.spectrumCallbacks.push(callback);
    return () => {
      this.spectrumCallbacks = this.spectrumCallbacks.filter(cb => cb !== callback);
    };
  }

  /** Register callback for errors */
  onError(callback: OnErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter(cb => cb !== callback);
    };
  }

  /** Tear down all subscriptions and stop engine */
  async destroy(): Promise<void> {
    await this.stopListening();
    this.messageCallbacks = [];
    this.spectrumCallbacks = [];
    this.errorCallbacks = [];
  }

  // ─────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────

  private handleSpectrumEvent(event: SpectrumEvent): void {
    // Forward raw spectrum to waterfall callbacks
    this.spectrumCallbacks.forEach(cb => cb(event));

    // Accumulate detected bits
    this.accumulator.pushBit(event.detectedBit);

    // Attempt decode
    const result = this.accumulator.tryDecode();
    if (result && result.success) {
      const msg: MeshMessage = {
        text: result.message,
        timestamp: Date.now(),
        direction: 'received',
      };
      this.messageCallbacks.forEach(cb => cb(msg));
    }
  }
}
