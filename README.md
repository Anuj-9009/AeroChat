# AeroChat 🦇📱

<p>
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/kotlin-%237F52FF.svg?style=for-the-badge&logo=kotlin&logoColor=white" alt="Kotlin" />
  <img src="https://img.shields.io/badge/swift-F54A2A?style=for-the-badge&logo=swift&logoColor=white" alt="Swift" />
  <img src="https://img.shields.io/badge/c++-%2300599C.svg?style=for-the-badge&logo=c%2B%2B&logoColor=white" alt="C++" />
</p>

AeroChat is a highly optimized, cross-platform **offline acoustic mesh network** application. It enables zero-connectivity text communication between mobile devices completely offline by transmitting and receiving near-ultrasonic frequency-modulated sound waves. By leveraging the physical speaker and microphone hardware, it constructs a localized ad-hoc communications grid without relying on cellular towers, Wi-Fi routers, or Bluetooth pairings.

---

## ✨ Features

- **📶 True Offline Mesh Grid:** Requires zero radio frequency (RF) connectivity. Communicates purely via physical audio channels, ideal for deep-underground, hyper-secure, or emergency disaster response situations.
- **🔊 Near-Ultrasonic FSK Audio:** Uses Frequency-Shift Keying (FSK) modulation at 16.5kHz and 17.5kHz, transmitting data silently just beyond the standard human hearing range.
- **⚡ Native DSP Engine:** Incorporates a deep native Digital Signal Processing (DSP) core written in optimized C++ for instantaneous Fast Fourier Transform (FFT) analysis and audio synthesis.
- **📱 High-Performance Bridges:** Seamlessly connects a React Native UI to high-fidelity native platforms (Kotlin CoreAudio/AudioRecord for Android and Swift AudioUnits for iOS) via synchronous JNI and Native Module channels.
- **🔗 Ad-Hoc Mesh Routing:** Bounces encrypted text packets between intermediate node devices to multiply transmission distances dynamically.

---

## 🧠 FSK Audio DSP Details

AeroChat utilizes custom-built audio modulation and demodulation layers:
1. **Modulator (Transmitter):**
   - Converts standard text packets into a binary byte array.
   - Applies Hamming (7, 4) forward error correction (FEC) to reconstruct lost bits caused by room reverberation, echoes, or background chatter.
   - Generates a continuous sinusoidal wave sampled at `44.1kHz` (CD standard).
   - Performs FSK shifting: a `0` bit maps to a `16.5kHz` sine frequency (Mark), and a `1` bit maps to a `17.5kHz` sine frequency (Space).
   - Smooths transitions using a raised-cosine windowing function to minimize sharp clicks or high-frequency pops, maintaining a transmission rate of approximately `100 bps`.

2. **Demodulator (Receiver):**
   - Spawns a high-priority background record loop grabbing `512` sample buffers.
   - Runs a real-time **Goertzel algorithm / FFT** centered at the target `16.5kHz` and `17.5kHz` bins.
   - Evaluates power spectra thresholds; if power surpasses ambient noise bounds, the channel registers the dominant bin, decodes the bit stream, applies error-correction decoding, and constructs the string packet.

---

## 🏗️ Technical Architecture & Native Bridges

AeroChat separates heavy mathematical computations and low-latency hardware controls from the main JavaScript thread to avoid UI stuttering:

```
                  ┌─────────────────────────────────────┐
                  │          React Native UI            │
                  └──────────────────┬──────────────────┘
                                     │ (JSON Packets)
                                     ▼
                  ┌─────────────────────────────────────┐
                  │         Native Bridge Layer         │
                  │   (Kotlin Android / Swift iOS)      │
                  └──────────────────┬──────────────────┘
                                     │ (JNI / direct C++ bindings)
                                     ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │                    Custom C++ DSP Core Engine                    │
     │  ┌──────────────────────────────┐  ┌──────────────────────────┐  │
     │  │       Modulator (FSK)        │  │     Demodulator (FFT)    │  │
     │  └──────────────┬───────────────┘  └─────────────▲────────────┘  │
     └─────────────────┼────────────────────────────────┼───────────────┘
                       │ (PCM Buffers)                  │ (Mic Ingestion)
                       ▼                                │
     ┌─────────────────────────────────┐  ┌─────────────────────────────┐
     │      Kotlin AudioTrack API      │  │    Swift AudioUnit Core     │
     └─────────────────────────────────┘  └─────────────────────────────┘
```

- **Android Bridging**: High-speed communication is maintained through custom `JNI` (Java Native Interface) layers linking Java arrays directly to native `float*` pointers in the C++ memory pool.
- **iOS Bridging**: Bridges React Native’s `RCTBridge` directly to low-latency Swift native `AudioToolbox` modules, executing memory-safe pointer access for hardware operations.

---

## 🚀 Complete Setup & Installation Guide

### Prerequisites
- **Node.js** v18+ and `npm`
- **Android Studio** (with SDK 34 and NDK configured)
- **Xcode** 15+ (running on a macOS host)
- Physical testing devices (emulators/simulators generally lack accurate microphone array and physical speaker loops)

### 💻 Local Installation

1. **Clone the project:**
   ```bash
   git clone https://github.com/Anuj-9009/AeroChat.git
   cd AeroChat
   ```

2. **Install JavaScript dependencies:**
   ```bash
   npm install
   ```

3. **Android Client Compilation:**
   ```bash
   # Run directly on your connected Android device
   npx react-native run-android
   ```
   *Note: Ensure USB debugging is active and permissions are granted for `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` in your `AndroidManifest.xml`.*

4. **iOS Client Compilation:**
   ```bash
   cd ios
   pod install
   cd ..
   # Run directly on your connected iOS device
   npx react-native run-ios --device "My iPhone"
   ```

---

<div align="center" style="margin-top: 40px;">
  <img src="assets/footer-v2.svg" width="100%" alt="footer">
</div>
<p style="font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: #7F52FF; margin: 0; text-align: center;">
  built by ANUJ with ❤️ to the silent, telepathic frequencies of kali uchis
</p>
