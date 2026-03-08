import Foundation
import AVFoundation
import Accelerate
import React

/**
 * AeroChat Native Audio Engine — iOS
 *
 * Core DSP module for 18.5kHz / 19.5kHz FSK acoustic mesh.
 * Uses AVAudioSession in .measurement mode to disable Apple's
 * voice processing (noise cancellation, AGC, echo cancellation).
 * Leverages the Accelerate framework for hardware-optimized FFT.
 *
 * Architecture:
 *   - AVAudioEngine tap for zero-copy audio input
 *   - vDSP FFT for O(n log n) frequency analysis on Apple silicon
 *   - 50ms guard interval between FSK pulses for echo decay
 */
@objc(AudioEngineModule)
class AudioEngineModule: RCTEventEmitter {

    // ─────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────

    private let FREQ_MARK: Float    = 16500.0   // Binary '1' → 16.5 kHz (better speaker response)
    private let FREQ_SPACE: Float   = 17500.0   // Binary '0' → 17.5 kHz
    private let SAMPLE_RATE: Double = 44100.0
    private let BIT_DURATION_MS: Int = 20        // 20ms per bit → 50 bps (more energy per bit)
    private let GUARD_INTERVAL_MS: Int = 100     // 100ms echo guard (clears room reverb)
    private let FFT_SIZE: Int = 8192             // ~5.4 Hz resolution (sharper bins)
    private let BAND_PASS_LOW_HZ: Float  = 16000.0
    private let BAND_PASS_HIGH_HZ: Float = 18000.0

    // ─────────────────────────────────────────────────────
    // Audio Engine State
    // ─────────────────────────────────────────────────────

    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var isListening = false
    private var isTransmitting = false

    // vDSP FFT setup (created once, reused)
    private var fftSetup: vDSP_DFT_Setup?
    private let log2n: vDSP_Length

    override init() {
        self.log2n = vDSP_Length(log2(Float(FFT_SIZE)))
        self.audioEngine = nil
        self.playerNode = nil
        self.fftSetup = nil
        super.init()
        self.fftSetup = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2))
    }

    deinit {
        if let setup = fftSetup {
            vDSP_destroy_fftsetup(setup)
        }
    }

    @objc override static func moduleName() -> String! {
        return "AudioEngineModule"
    }

    @objc override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func supportedEvents() -> [String]! {
        return ["onSpectrum", "onError"]
    }

    // ─────────────────────────────────────────────────────
    // Audio Session Configuration
    // ─────────────────────────────────────────────────────

    /**
     * Configure AVAudioSession for raw acoustic capture.
     *
     * .measurement mode is critical — it disables:
     *   - Automatic Gain Control (AGC)
     *   - Noise Cancellation
     *   - Echo Cancellation
     *
     * This gives us the raw 18.5–19.5 kHz signal without Apple
     * mistakenly filtering it as "noise."
     */
    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [
            .defaultToSpeaker,
            .allowBluetooth
        ])
        try session.setPreferredSampleRate(SAMPLE_RATE)
        try session.setPreferredIOBufferDuration(Double(FFT_SIZE) / SAMPLE_RATE)
        try session.setActive(true)
        // MAX OUTPUT VOLUME for maximum range
        try session.setOutputVolume(1.0)
    }

    // ─────────────────────────────────────────────────────
    // TRANSMIT: Generate FSK audio from binary data
    // ─────────────────────────────────────────────────────

    @objc func transmit(_ binaryString: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard !isTransmitting else {
            reject("TX_BUSY", "Transmitter is already active", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            do {
                self.isTransmitting = true
                try self.configureAudioSession()

                let samples = self.encodeFSK(binaryString)
                try self.playFSK(samples)

                self.isTransmitting = false
                resolve(true)
            } catch {
                self.isTransmitting = false
                reject("TX_ERROR", error.localizedDescription, error)
            }
        }
    }

    /**
     * Encode binary string into FSK Float samples.
     * Each bit is a tone burst with raised-cosine envelope.
     * 50ms guard silence appended at the end.
     */
    private func encodeFSK(_ binaryString: String) -> [Float] {
        let samplesPerBit = Int(SAMPLE_RATE) * BIT_DURATION_MS / 1000
        let guardSamples = Int(SAMPLE_RATE) * GUARD_INTERVAL_MS / 1000
        let totalSamples = binaryString.count * samplesPerBit + guardSamples

        var samples = [Float](repeating: 0.0, count: totalSamples)
        var sampleIndex = 0

        for bit in binaryString {
            let freq = bit == "1" ? FREQ_MARK : FREQ_SPACE
            for i in 0..<samplesPerBit {
                let t = Float(i) / Float(SAMPLE_RATE)
                let envelope = raisedCosineEnvelope(sampleIndex: i, totalSamples: samplesPerBit)
                samples[sampleIndex] = envelope * sin(2.0 * .pi * freq * t)
                sampleIndex += 1
            }
        }
        // Guard interval: remaining samples are 0 (silence)
        return samples
    }

    private func raisedCosineEnvelope(sampleIndex: Int, totalSamples: Int) -> Float {
        let riseLen = Int(Double(totalSamples) * 0.1)
        if sampleIndex < riseLen {
            return 0.5 * (1.0 - cos(.pi * Float(sampleIndex) / Float(riseLen)))
        } else if sampleIndex > totalSamples - riseLen {
            return 0.5 * (1.0 - cos(.pi * Float(totalSamples - sampleIndex) / Float(riseLen)))
        }
        return 1.0
    }

    private func playFSK(_ samples: [Float]) throws {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        engine.attach(player)

        let format = AVAudioFormat(standardFormatWithSampleRate: SAMPLE_RATE, channels: 1)!
        engine.connect(player, to: engine.mainMixerNode, format: format)

        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count)) else {
            throw NSError(domain: "AeroChat", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to create audio buffer"])
        }

        let channelData = buffer.floatChannelData![0]
        for i in 0..<samples.count {
            channelData[i] = samples[i]
        }
        buffer.frameLength = AVAudioFrameCount(samples.count)

        try engine.start()
        player.play()

        let semaphore = DispatchSemaphore(value: 0)
        player.scheduleBuffer(buffer) {
            semaphore.signal()
        }
        semaphore.wait()

        // Allow guard interval silence to propagate
        Thread.sleep(forTimeInterval: Double(GUARD_INTERVAL_MS) / 1000.0)

        player.stop()
        engine.stop()
    }

    // ─────────────────────────────────────────────────────
    // RECEIVE: Accelerate FFT with 18kHz+ band-pass
    // ─────────────────────────────────────────────────────

    @objc func startListening(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard !isListening else {
            reject("RX_BUSY", "Receiver is already active", nil)
            return
        }

        do {
            try configureAudioSession()

            let engine = AVAudioEngine()
            let inputNode = engine.inputNode
            let inputFormat = inputNode.outputFormat(forBus: 0)

            inputNode.installTap(onBus: 0, bufferSize: AVAudioFrameCount(FFT_SIZE), format: inputFormat) { [weak self] buffer, _ in
                self?.processAudioBuffer(buffer)
            }

            try engine.start()
            self.audioEngine = engine
            self.isListening = true
            resolve(true)
        } catch {
            reject("RX_ERROR", error.localizedDescription, error)
        }
    }

    @objc func stopListening(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        isListening = false
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        resolve(true)
    }

    /**
     * Process incoming audio buffer using Accelerate vDSP FFT.
     *
     * The Accelerate framework runs FFT on Apple's NEON SIMD units,
     * achieving ~10x faster execution than a naive implementation.
     * This is critical for maintaining real-time performance.
     */
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer) {
        guard let fftSetup = self.fftSetup,
              let channelData = buffer.floatChannelData?[0] else { return }

        let frameCount = Int(buffer.frameLength)
        let n = min(frameCount, FFT_SIZE)

        // Apply Hann window
        var windowedData = [Float](repeating: 0.0, count: FFT_SIZE)
        var window = [Float](repeating: 0.0, count: FFT_SIZE)
        vDSP_hann_window(&window, vDSP_Length(FFT_SIZE), Int32(vDSP_HANN_NORM))

        for i in 0..<n {
            windowedData[i] = channelData[i] * window[i]
        }

        // Pack into split complex format for vDSP
        var realPart = [Float](repeating: 0.0, count: FFT_SIZE / 2)
        var imagPart = [Float](repeating: 0.0, count: FFT_SIZE / 2)

        windowedData.withUnsafeBufferPointer { dataPtr in
            dataPtr.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: FFT_SIZE / 2) { complexPtr in
                var splitComplex = DSPSplitComplex(realp: &realPart, imagp: &imagPart)
                vDSP_ctoz(complexPtr, 2, &splitComplex, 1, vDSP_Length(FFT_SIZE / 2))

                // Forward FFT using Accelerate (hardware-optimized)
                vDSP_fft_zrip(fftSetup, &splitComplex, 1, log2n, FFTDirection(FFT_FORWARD))

                // Compute magnitudes
                var magnitudes = [Float](repeating: 0.0, count: FFT_SIZE / 2)
                vDSP_zvmags(&splitComplex, 1, &magnitudes, 1, vDSP_Length(FFT_SIZE / 2))

                // Band-pass filter: only look at 18kHz–20kHz
                let binLow = Int(self.BAND_PASS_LOW_HZ * Float(self.FFT_SIZE) / Float(self.SAMPLE_RATE))
                let binHigh = min(Int(self.BAND_PASS_HIGH_HZ * Float(self.FFT_SIZE) / Float(self.SAMPLE_RATE)), self.FFT_SIZE / 2 - 1)

                var peakMag: Float = 0.0
                var peakBin = binLow

                for i in binLow...binHigh {
                    if magnitudes[i] > peakMag {
                        peakMag = magnitudes[i]
                        peakBin = i
                    }
                }

                let peakFreq = Float(peakBin) * Float(self.SAMPLE_RATE) / Float(self.FFT_SIZE)
                let detectedBit = self.decodeBit(peakFreq: peakFreq, peakMag: peakMag)

                // Build band magnitudes array for waterfall
                var bandMags: [NSNumber] = []
                for i in binLow...binHigh {
                    bandMags.append(NSNumber(value: magnitudes[i]))
                }

                // Emit to React Native
                self.sendEvent(withName: "onSpectrum", body: [
                    "peakFrequency": peakFreq,
                    "peakMagnitude": peakMag,
                    "detectedBit": detectedBit,
                    "bandMagnitudes": bandMags
                ])
            }
        }
    }

    /**
     * Decode a single bit from peak frequency.
     * Returns 1 (mark), 0 (space), or -1 (no valid signal).
     */
    private func decodeBit(peakFreq: Float, peakMag: Float) -> Int {
        let noiseFloor: Float = 300.0  // Lower threshold for weaker signals at distance
        guard peakMag >= noiseFloor else { return -1 }

        let markDelta = abs(peakFreq - FREQ_MARK)
        let spaceDelta = abs(peakFreq - FREQ_SPACE)
        let tolerance: Float = 100.0   // Tighter — 8192 FFT gives sharper bins

        if markDelta < tolerance && markDelta < spaceDelta { return 1 }
        if spaceDelta < tolerance && spaceDelta < markDelta { return 0 }
        return -1
    }
}
