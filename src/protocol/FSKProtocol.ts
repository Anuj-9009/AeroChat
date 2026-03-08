/**
 * AeroChat — FSK Protocol Encoder/Decoder
 *
 * Converts ASCII text ↔ framed binary strings for FSK transmission.
 *
 * Frame format per character:
 *   [START_BIT] [8 data bits (LSB first)] [PARITY_BIT] [STOP_BIT]
 *
 *   START_BIT  = 0 (marks beginning of character frame)
 *   DATA       = 8 bits, LSB first (standard UART order)
 *   PARITY     = even parity (error detection)
 *   STOP_BIT   = 1 (marks end of character frame)
 *
 * Full message frame:
 *   [PREAMBLE] [LENGTH_BYTE] [PAYLOAD...] [CHECKSUM]
 *
 *   PREAMBLE   = 10101010 10101010 (16 bits — clock sync for receiver)
 *   LENGTH     = 1 framed byte (payload length, max 255 chars)
 *   PAYLOAD    = N framed bytes (ASCII characters)
 *   CHECKSUM   = 1 framed byte (XOR of all payload bytes)
 */

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────

const PREAMBLE = '1010101010101010';  // 16-bit alternating pattern for clock recovery
const START_BIT = '0';
const STOP_BIT = '1';

// ─────────────────────────────────────────────────────
// Encoder: ASCII Text → Framed Binary String
// ─────────────────────────────────────────────────────

/**
 * Encode a single byte into a framed binary string.
 * Format: [START][D0..D7 LSB-first][EVEN_PARITY][STOP]
 */
function encodeByteToFrame(byte: number): string {
  const bits: string[] = [];

  // Start bit
  bits.push(START_BIT);

  // 8 data bits, LSB first
  let onesCount = 0;
  for (let i = 0; i < 8; i++) {
    const bit = (byte >> i) & 1;
    bits.push(String(bit));
    onesCount += bit;
  }

  // Even parity bit
  bits.push(String(onesCount % 2));

  // Stop bit
  bits.push(STOP_BIT);

  return bits.join('');
}

/**
 * Encode an ASCII text message into a fully framed binary string
 * ready for FSK transmission via the native AudioEngineModule.
 *
 * @param text - ASCII text message (max 255 characters)
 * @returns Framed binary string: PREAMBLE + LENGTH + PAYLOAD + CHECKSUM
 * @throws Error if text exceeds 255 characters or contains non-ASCII
 */
export function encodeMessage(text: string): string {
  if (text.length === 0) {
    throw new Error('[AeroChat] Cannot encode empty message');
  }
  if (text.length > 255) {
    throw new Error(`[AeroChat] Message too long: ${text.length} chars (max 255)`);
  }

  const payload: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 127) {
      throw new Error(`[AeroChat] Non-ASCII character at position ${i}: '${text[i]}'`);
    }
    payload.push(code);
  }

  // Compute XOR checksum
  let checksum = 0;
  for (const byte of payload) {
    checksum ^= byte;
  }

  // Build full frame
  const parts: string[] = [];

  // 1. Preamble (clock sync)
  parts.push(PREAMBLE);

  // 2. Length byte (framed)
  parts.push(encodeByteToFrame(payload.length));

  // 3. Payload bytes (framed)
  for (const byte of payload) {
    parts.push(encodeByteToFrame(byte));
  }

  // 4. Checksum byte (framed)
  parts.push(encodeByteToFrame(checksum));

  return parts.join('');
}

// ─────────────────────────────────────────────────────
// Decoder: Incoming Bit Stream → ASCII Text
// ─────────────────────────────────────────────────────

/** Result of a decode attempt */
export interface DecodeResult {
  success: boolean;
  message: string;
  error?: string;
  bitsConsumed: number;
}

/** Size of one framed byte: START(1) + DATA(8) + PARITY(1) + STOP(1) = 11 bits */
const FRAME_SIZE = 11;

/**
 * Decode a single framed byte from the bit stream.
 * Validates start bit, stop bit, and even parity.
 *
 * @returns The decoded byte value, or null if frame is invalid
 */
function decodeFramedByte(bits: string, offset: number): number | null {
  if (offset + FRAME_SIZE > bits.length) return null;

  // Validate start bit
  if (bits[offset] !== '0') return null;

  // Extract 8 data bits (LSB first)
  let byte = 0;
  let onesCount = 0;
  for (let i = 0; i < 8; i++) {
    const bit = parseInt(bits[offset + 1 + i], 10);
    if (isNaN(bit)) return null;
    byte |= (bit << i);
    onesCount += bit;
  }

  // Validate even parity
  const parityBit = parseInt(bits[offset + 9], 10);
  if (onesCount % 2 !== parityBit) return null;

  // Validate stop bit
  if (bits[offset + 10] !== '1') return null;

  return byte;
}

/**
 * Decode a fully framed binary string back into ASCII text.
 *
 * Searches for the preamble, then extracts length, payload, and checksum.
 * Validates parity on every byte and XOR checksum on the full payload.
 *
 * @param bitStream - Raw binary string from accumulated detected bits
 * @returns DecodeResult with message or error details
 */
export function decodeMessage(bitStream: string): DecodeResult {
  // 1. Find preamble
  const preambleIndex = bitStream.indexOf(PREAMBLE);
  if (preambleIndex === -1) {
    return {
      success: false,
      message: '',
      error: 'No preamble found in bit stream',
      bitsConsumed: 0,
    };
  }

  let cursor = preambleIndex + PREAMBLE.length;

  // 2. Decode length byte
  const length = decodeFramedByte(bitStream, cursor);
  if (length === null) {
    return {
      success: false,
      message: '',
      error: 'Failed to decode length byte (frame error)',
      bitsConsumed: cursor,
    };
  }
  cursor += FRAME_SIZE;

  // 3. Decode payload bytes
  const payloadBytes: number[] = [];
  for (let i = 0; i < length; i++) {
    const byte = decodeFramedByte(bitStream, cursor);
    if (byte === null) {
      return {
        success: false,
        message: '',
        error: `Failed to decode payload byte ${i} (frame/parity error)`,
        bitsConsumed: cursor,
      };
    }
    payloadBytes.push(byte);
    cursor += FRAME_SIZE;
  }

  // 4. Decode checksum byte
  const receivedChecksum = decodeFramedByte(bitStream, cursor);
  if (receivedChecksum === null) {
    return {
      success: false,
      message: '',
      error: 'Failed to decode checksum byte (frame error)',
      bitsConsumed: cursor,
    };
  }
  cursor += FRAME_SIZE;

  // 5. Validate XOR checksum
  let computedChecksum = 0;
  for (const byte of payloadBytes) {
    computedChecksum ^= byte;
  }

  if (computedChecksum !== receivedChecksum) {
    return {
      success: false,
      message: '',
      error: `Checksum mismatch: computed 0x${computedChecksum.toString(16)} vs received 0x${receivedChecksum.toString(16)}`,
      bitsConsumed: cursor,
    };
  }

  // 6. Convert to ASCII
  const message = payloadBytes.map(b => String.fromCharCode(b)).join('');

  return {
    success: true,
    message,
    bitsConsumed: cursor,
  };
}

// ─────────────────────────────────────────────────────
// Bit Stream Accumulator
// ─────────────────────────────────────────────────────

/**
 * Accumulates incoming detected bits from the native FFT receiver
 * and attempts to decode complete messages.
 *
 * Usage:
 *   const accumulator = new BitStreamAccumulator();
 *   // On each 'onSpectrum' event:
 *   accumulator.pushBit(event.detectedBit);
 *   const result = accumulator.tryDecode();
 *   if (result?.success) handleMessage(result.message);
 */
export class BitStreamAccumulator {
  private buffer: string = '';
  private readonly maxBufferSize: number;

  constructor(maxBufferSize = 8192) {
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Push a detected bit into the accumulator.
   * Ignores -1 (no signal) values from the native module.
   */
  pushBit(bit: number): void {
    if (bit !== 0 && bit !== 1) return;
    this.buffer += String(bit);

    // Prevent unbounded growth
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(this.buffer.length - this.maxBufferSize);
    }
  }

  /**
   * Attempt to decode a complete message from the accumulated bits.
   * If successful, consumed bits are removed from the buffer.
   */
  tryDecode(): DecodeResult | null {
    if (this.buffer.length < PREAMBLE.length + FRAME_SIZE * 2) {
      return null; // Not enough bits for even the smallest message
    }

    const result = decodeMessage(this.buffer);

    if (result.success && result.bitsConsumed > 0) {
      // Remove consumed bits
      this.buffer = this.buffer.slice(result.bitsConsumed);
    }

    return result.success ? result : null;
  }

  /** Get current buffer length (for debug/UI) */
  getBufferLength(): number {
    return this.buffer.length;
  }

  /** Clear the bit buffer */
  clear(): void {
    this.buffer = '';
  }
}
