# AeroChat

> Offline acoustic mesh network — transmit text via ultrasonic FSK audio.

![React Native](https://img.shields.io/badge/React_Native-0.73-61DAFB?logo=react)
![Platforms](https://img.shields.io/badge/Platforms-iOS_%7C_Android-lightgrey)
![License](https://img.shields.io/badge/License-MIT-green)

## What It Does

AeroChat sends text messages between phones using **inaudible sound waves** — no WiFi, no Bluetooth, no cell network. Two carrier frequencies (16.5kHz and 17.5kHz) encode binary 1s and 0s through FSK (Frequency-Shift Keying) modulation.

**Use cases:** disaster communication, off-grid messaging, stealth chat, mesh relay in buildings, educational DSP demo.

## Architecture

```
┌──────────────────────────────────────────────┐
│                  App.tsx                     │
│     WaterfallSpectrogram + TerminalChat      │
├──────────────────────────────────────────────┤
│              MeshController.ts               │
│         FSKProtocol.ts (encoder/decoder)     │
│          AudioEngineBridge.ts (typed API)     │
├──────────────┬───────────────────────────────┤
│   Android    │           iOS                 │
│  Kotlin FFT  │  Swift + Accelerate vDSP      │
│  AudioRecord │  AVAudioEngine               │
│  AudioTrack  │  AVAudioPlayerNode           │
└──────────────┴───────────────────────────────┘
```

## DSP Specifications

| Parameter | Value |
|---|---|
| Mark frequency (bit 1) | 16,500 Hz |
| Space frequency (bit 0) | 17,500 Hz |
| Bit rate | 50 bps |
| Symbol duration | 20 ms |
| FFT size | 8,192 samples |
| Sample rate | 44,100 Hz |
| Frequency resolution | ~5.4 Hz |
| Guard interval | 100 ms |
| Band-pass filter | 16–18 kHz |
| Decode tolerance | ±100 Hz |
| Reliable indoor range | ~8–12 meters |

## Protocol

Each character is framed as:
```
[PREAMBLE] [START_BIT] [8 data bits LSB-first] [PARITY] [STOP_BIT] ... [XOR_CHECKSUM]
```

## Project Structure

```
AeroChat/
├── App.tsx                             ← Main app (waterfall + terminal)
├── app.json / package.json             ← RN config
├── src/
│   ├── native/
│   │   └── AudioEngineBridge.ts        ← Typed native bridge
│   ├── protocol/
│   │   ├── FSKProtocol.ts              ← UART framing + checksum
│   │   └── MeshController.ts           ← High-level mesh API
│   ├── components/
│   │   ├── WaterfallSpectrogram.tsx     ← Real-time FFT waterfall
│   │   └── TerminalChat.tsx            ← Terminal-style chat log
│   └── styles/
│       └── theme.ts                    ← Design tokens (obsidian/white)
├── android/
│   └── app/src/main/java/com/aerochat/
│       └── AudioEngineModule.kt        ← Kotlin DSP engine
├── ios/
│   └── AeroChat/
│       ├── AudioEngineModule.swift      ← Swift + Accelerate DSP
│       ├── AudioEngineModule.m          ← ObjC bridge macro
│       └── AeroChat-Bridging-Header.h   ← Swift↔ObjC bridge
└── fastlane/
    └── Fastfile                        ← CI/CD for TestFlight + Play Console
```

## Quick Start

```bash
# Install dependencies
npm install

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

## Design

Expedition Tech aesthetic — obsidian black (#0A0A0A) and stark white (#F5F5F5). Monospaced typography (Courier). Zero border-radius. No gradients. No purple.

## License

MIT
