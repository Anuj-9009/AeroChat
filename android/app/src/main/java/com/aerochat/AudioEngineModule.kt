package com.aerochat

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.*

/**
 * AeroChat Native Audio Engine — Android
 *
 * Core DSP module for 18.5kHz / 19.5kHz FSK acoustic mesh.
 * Uses AudioSource.UNPROCESSED to bypass OS noise cancellation.
 * Implements radix-2 Cooley-Tukey FFT with strict 18kHz+ band-pass.
 *
 * Hardware tuning:
 *   - Buffer size auto-scaled to device capability
 *   - CPU affinity hints for sustained DSP on mid-range SoCs (e.g. Helio G80)
 *   - Duty-cycle management to prevent thermal throttle on Galaxy A14 class devices
 */
class AudioEngineModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "AeroChat_DSP"
        const val NAME = "AudioEngineModule"

        // FSK carrier frequencies (lowered for better speaker/mic response → more range)
        const val FREQ_MARK = 16500.0   // Binary '1' → 16.5 kHz
        const val FREQ_SPACE = 17500.0  // Binary '0' → 17.5 kHz

        // Audio config
        const val SAMPLE_RATE = 44100
        const val CHANNEL_IN = AudioFormat.CHANNEL_IN_MONO
        const val CHANNEL_OUT = AudioFormat.CHANNEL_OUT_MONO
        const val ENCODING = AudioFormat.ENCODING_PCM_16BIT

        // FSK timing (slower = more energy per bit = better SNR at distance)
        const val BIT_DURATION_MS = 20          // 20ms per bit → 50 bps
        const val GUARD_INTERVAL_MS = 100       // 100ms silence (clears room reverb)

        // FFT config (larger = sharper frequency resolution)
        const val FFT_SIZE = 8192               // ~5.4 Hz resolution at 44.1kHz
        const val BAND_PASS_LOW_HZ = 16000.0    // 16kHz–18kHz band-pass
        const val BAND_PASS_HIGH_HZ = 18000.0

        // Thermal management
        const val DSP_DUTY_CYCLE_MS = 5L        // Yield 5ms per FFT cycle to reduce thermal load
    }

    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var isListening = false
    private var isTransmitting = false

    // Pre-allocated FFT buffers (avoid GC pressure in hot loop)
    private val fftReal = DoubleArray(FFT_SIZE)
    private val fftImag = DoubleArray(FFT_SIZE)
    private val magnitudes = DoubleArray(FFT_SIZE / 2)
    private val hannWindow = DoubleArray(FFT_SIZE).also { w ->
        for (i in w.indices) {
            w[i] = 0.5 * (1.0 - cos(2.0 * PI * i / (FFT_SIZE - 1)))
        }
    }

    override fun getName(): String = NAME

    // ─────────────────────────────────────────────────────
    // TRANSMIT: Generate FSK audio from binary data
    // ─────────────────────────────────────────────────────

    @ReactMethod
    fun transmit(binaryString: String, promise: Promise) {
        if (isTransmitting) {
            promise.reject("TX_BUSY", "Transmitter is already active")
            return
        }

        Thread {
            try {
                isTransmitting = true
                val samples = encodeFSK(binaryString)
                playAudio(samples)
                isTransmitting = false
                promise.resolve(true)
            } catch (e: Exception) {
                isTransmitting = false
                promise.reject("TX_ERROR", e.message, e)
            }
        }.apply {
            priority = Thread.MAX_PRIORITY
            name = "AeroChat-TX"
            start()
        }
    }

    /**
     * Encode a binary string into FSK audio samples.
     * Each bit is a tone burst at FREQ_MARK (1) or FREQ_SPACE (0).
     * A 50ms guard interval of silence is appended after the entire frame
     * to allow room echo to decay before the next device listens.
     */
    private fun encodeFSK(binaryString: String): ShortArray {
        val samplesPerBit = (SAMPLE_RATE * BIT_DURATION_MS) / 1000
        val guardSamples = (SAMPLE_RATE * GUARD_INTERVAL_MS) / 1000
        val totalSamples = (binaryString.length * samplesPerBit) + guardSamples
        val samples = ShortArray(totalSamples)

        var sampleIndex = 0
        for (bit in binaryString) {
            val freq = if (bit == '1') FREQ_MARK else FREQ_SPACE
            for (i in 0 until samplesPerBit) {
                val t = i.toDouble() / SAMPLE_RATE
                // Apply raised-cosine envelope to reduce spectral splatter
                val envelope = raisedCosineEnvelope(i, samplesPerBit)
                val sample = (Short.MAX_VALUE * envelope * sin(2.0 * PI * freq * t)).toInt()
                samples[sampleIndex++] = sample.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
            }
        }
        // Guard interval: remaining samples are 0 (silence) by default
        return samples
    }

    /**
     * Raised cosine envelope — smooths the attack/release of each tone burst
     * to reduce inter-symbol interference and spectral leakage.
     * 10% rise, 80% sustain, 10% fall.
     */
    private fun raisedCosineEnvelope(sampleIndex: Int, totalSamples: Int): Double {
        val riseLen = (totalSamples * 0.1).toInt()
        return when {
            sampleIndex < riseLen -> 0.5 * (1.0 - cos(PI * sampleIndex / riseLen))
            sampleIndex > totalSamples - riseLen -> 0.5 * (1.0 - cos(PI * (totalSamples - sampleIndex) / riseLen))
            else -> 1.0
        }
    }

    private fun playAudio(samples: ShortArray) {
        val bufferSize = AudioTrack.getMinBufferSize(SAMPLE_RATE, CHANNEL_OUT, ENCODING)
        audioTrack = AudioTrack(
            AudioManager.STREAM_MUSIC,
            SAMPLE_RATE,
            CHANNEL_OUT,
            ENCODING,
            maxOf(bufferSize, samples.size * 2),
            AudioTrack.MODE_STATIC
        )
        audioTrack?.let { track ->
            // MAX VOLUME for maximum range
            track.setStereoVolume(1.0f, 1.0f)
            // Also set system media volume to max
            val audioManager = reactApplicationContext.getSystemService(android.content.Context.AUDIO_SERVICE) as? AudioManager
            audioManager?.setStreamVolume(
                AudioManager.STREAM_MUSIC,
                audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC),
                0
            )
            track.write(samples, 0, samples.size)
            track.play()
            val durationMs = (samples.size.toLong() * 1000) / SAMPLE_RATE
            Thread.sleep(durationMs + 50)
            track.stop()
            track.release()
        }
        audioTrack = null
    }

    // ─────────────────────────────────────────────────────
    // RECEIVE: FFT analysis with 18kHz+ band-pass filter
    // ─────────────────────────────────────────────────────

    @ReactMethod
    fun startListening(promise: Promise) {
        if (isListening) {
            promise.reject("RX_BUSY", "Receiver is already active")
            return
        }

        val ctx = reactApplicationContext
        if (ActivityCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            promise.reject("PERM_DENIED", "RECORD_AUDIO permission not granted")
            return
        }

        Thread {
            try {
                isListening = true
                runReceiver()
            } catch (e: Exception) {
                Log.e(TAG, "Receiver error: ${e.message}", e)
                emitEvent("onError", e.message ?: "Unknown receiver error")
            } finally {
                isListening = false
            }
        }.apply {
            priority = Thread.MAX_PRIORITY
            name = "AeroChat-RX"
            start()
        }

        promise.resolve(true)
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        isListening = false
        promise.resolve(true)
    }

    /**
     * Core DSP receive loop.
     *
     * Uses AudioSource.UNPROCESSED (API 24+) to bypass Android's
     * automatic noise cancellation, echo cancellation, and AGC.
     * Falls back to VOICE_RECOGNITION on older devices (closest to raw).
     *
     * Hardware tuning for mid-range devices (Galaxy A14 / Helio G80):
     *   - Yields DSP_DUTY_CYCLE_MS per FFT cycle to prevent thermal throttle
     *   - Uses minimum viable buffer size to reduce latency
     *   - Pre-allocated arrays to eliminate GC stalls in the hot path
     */
    private fun runReceiver() {
        val audioSource = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            MediaRecorder.AudioSource.UNPROCESSED
        } else {
            MediaRecorder.AudioSource.VOICE_RECOGNITION
        }

        val minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_IN, ENCODING)
        val bufferSize = maxOf(minBuffer, FFT_SIZE * 2)

        val record = AudioRecord(audioSource, SAMPLE_RATE, CHANNEL_IN, ENCODING, bufferSize)
        if (record.state != AudioRecord.STATE_INITIALIZED) {
            emitEvent("onError", "AudioRecord failed to initialize. Device may not support UNPROCESSED source.")
            return
        }

        audioRecord = record
        record.startRecording()

        val readBuffer = ShortArray(FFT_SIZE)

        while (isListening) {
            val read = record.read(readBuffer, 0, FFT_SIZE)
            if (read > 0) {
                // Apply Hann window and load into FFT buffer
                for (i in 0 until minOf(read, FFT_SIZE)) {
                    fftReal[i] = readBuffer[i].toDouble() * hannWindow[i]
                    fftImag[i] = 0.0
                }
                // Zero-pad if read < FFT_SIZE
                for (i in read until FFT_SIZE) {
                    fftReal[i] = 0.0
                    fftImag[i] = 0.0
                }

                // Run FFT
                fft(fftReal, fftImag, FFT_SIZE)

                // Compute magnitudes and apply 18kHz+ band-pass
                val binLow = (BAND_PASS_LOW_HZ * FFT_SIZE / SAMPLE_RATE).toInt()
                val binHigh = (BAND_PASS_HIGH_HZ * FFT_SIZE / SAMPLE_RATE).toInt()

                var peakMag = 0.0
                var peakBin = binLow

                for (i in binLow..minOf(binHigh, FFT_SIZE / 2 - 1)) {
                    magnitudes[i] = sqrt(fftReal[i] * fftReal[i] + fftImag[i] * fftImag[i])
                    if (magnitudes[i] > peakMag) {
                        peakMag = magnitudes[i]
                        peakBin = i
                    }
                }

                val peakFreq = peakBin.toDouble() * SAMPLE_RATE / FFT_SIZE

                // Emit spectrum data for waterfall visualization
                val spectrumData = Arguments.createMap().apply {
                    putDouble("peakFrequency", peakFreq)
                    putDouble("peakMagnitude", peakMag)
                    putInt("detectedBit", decodeBit(peakFreq, peakMag))
                }

                // Also emit raw band magnitudes for waterfall
                val bandMags = Arguments.createArray()
                for (i in binLow..minOf(binHigh, FFT_SIZE / 2 - 1)) {
                    bandMags.pushDouble(magnitudes[i])
                }
                spectrumData.putArray("bandMagnitudes", bandMags)

                emitEvent("onSpectrum", spectrumData)

                // Thermal management: yield CPU to prevent throttling on mid-range SoCs
                Thread.sleep(DSP_DUTY_CYCLE_MS)
            }
        }

        record.stop()
        record.release()
        audioRecord = null
    }

    /**
     * Decode a single bit from peak frequency.
     * Returns 1 (mark), 0 (space), or -1 (no valid signal).
     */
    private fun decodeBit(peakFreq: Double, peakMag: Double): Int {
        val noiseFloor = 300.0 // Lower threshold to catch weaker signals at distance
        if (peakMag < noiseFloor) return -1

        val markDelta = abs(peakFreq - FREQ_MARK)
        val spaceDelta = abs(peakFreq - FREQ_SPACE)
        val tolerance = 100.0 // ±100 Hz (tighter — 8192 FFT gives sharper bins)

        return when {
            markDelta < tolerance && markDelta < spaceDelta -> 1
            spaceDelta < tolerance && spaceDelta < markDelta -> 0
            else -> -1
        }
    }

    // ─────────────────────────────────────────────────────
    // FFT: In-place radix-2 Cooley-Tukey
    // ─────────────────────────────────────────────────────

    /**
     * In-place radix-2 Cooley-Tukey FFT.
     * Operates on pre-allocated arrays to avoid GC pressure.
     * N must be a power of 2.
     */
    private fun fft(real: DoubleArray, imag: DoubleArray, n: Int) {
        // Bit-reversal permutation
        var j = 0
        for (i in 0 until n) {
            if (i < j) {
                var temp = real[i]; real[i] = real[j]; real[j] = temp
                temp = imag[i]; imag[i] = imag[j]; imag[j] = temp
            }
            var m = n / 2
            while (m >= 1 && j >= m) {
                j -= m
                m /= 2
            }
            j += m
        }

        // Butterfly stages
        var mLen = 2
        while (mLen <= n) {
            val halfM = mLen / 2
            val wReal = cos(PI / halfM)
            val wImag = -sin(PI / halfM)

            for (k in 0 until n step mLen) {
                var urReal = 1.0
                var urImag = 0.0

                for (l in 0 until halfM) {
                    val tReal = urReal * real[k + l + halfM] - urImag * imag[k + l + halfM]
                    val tImag = urReal * imag[k + l + halfM] + urImag * real[k + l + halfM]

                    real[k + l + halfM] = real[k + l] - tReal
                    imag[k + l + halfM] = imag[k + l] - tImag
                    real[k + l] += tReal
                    imag[k + l] += tImag

                    val newUrReal = urReal * wReal - urImag * wImag
                    urImag = urReal * wImag + urImag * wReal
                    urReal = newUrReal
                }
            }
            mLen *= 2
        }
    }

    // ─────────────────────────────────────────────────────
    // React Native Event Emitter
    // ─────────────────────────────────────────────────────

    private fun emitEvent(eventName: String, data: Any?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, data)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }
}
