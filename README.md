# AeroChat 🦇📱

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Kotlin](https://img.shields.io/badge/kotlin-%237F52FF.svg?style=for-the-badge&logo=kotlin&logoColor=white)
![Swift](https://img.shields.io/badge/swift-F54A2A?style=for-the-badge&logo=swift&logoColor=white)
![C++](https://img.shields.io/badge/c++-%2300599C.svg?style=for-the-badge&logo=c%2B%2B&logoColor=white)

AeroChat is an **offline acoustic mesh network** application. It allows devices to send text messages to each other completely offline by transmitting and receiving ultrasonic audio frequencies (FSK modulation at 16.5kHz / 17.5kHz).

![Demo GIF](https://via.placeholder.com/800x400.png?text=Insert+Demo+GIF+Here)

## ✨ Features
* **Completely Offline:** Requires no Wi-Fi, no Bluetooth, and no cellular connection.
* **Ultrasonic FSK Audio:** Uses your device's speaker and microphone to transmit data silently in the near-ultrasonic range.
* **Cross-Platform:** Built with a React Native frontend and deep native integrations (Kotlin for Android, Swift for iOS).
* **Mesh Routing:** (Experimental) Devices can act as nodes to bounce signals and extend range.

## 🏗️ Architecture
AeroChat uses **Frequency-Shift Keying (FSK)** to encode binary data into audio waves. 
1. The **React Native** UI captures user input.
2. The payload is passed via JNI/Native Modules to a custom **C++ / Kotlin** DSP (Digital Signal Processing) engine.
3. The engine converts the text into a byte array, applies error correction, and generates an audio waveform.
4. The receiver's microphone constantly runs an FFT (Fast Fourier Transform) to detect the specific 16.5kHz/17.5kHz frequencies and decode the binary back into text.

## 🚀 Getting Started

### Prerequisites
* Android SDK & NDK (for C++ DSP compilation)
* Xcode (for iOS build)
* Node.js & React Native CLI

### Installation
```bash
git clone https://github.com/Anuj-9009/AeroChat.git
cd AeroChat
npm install
# For iOS:
cd ios && pod install
```

---

<div align="center" style="background: radial-gradient(circle, rgba(127,82,255,0.08) 0%, transparent 80%); padding: 28px; border-radius: 20px;">
  <!-- Ultrasonic Wave / Acoustic Mesh (CSS SVG) -->
  <svg width="220" height="50" viewBox="0 0 220 50" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 8px;">
    <style>
      .sound-wave {
        stroke: #7F52FF;
        stroke-linecap: round;
        animation: audioPulse 1.2s infinite ease-in-out alternate;
        transform-origin: center;
      }
      .sound-node {
        fill: #61DAFB;
        animation: nodeFlash 1.6s infinite alternate ease-in-out;
      }
      @keyframes audioPulse {
        0% { transform: scaleY(0.4); stroke-width: 1.5; stroke: #7F52FF; }
        100% { transform: scaleY(1.2); stroke-width: 2.5; stroke: #61DAFB; filter: drop-shadow(0 0 4px #61DAFB); }
      }
      @keyframes nodeFlash {
        0% { opacity: 0.3; r: 3; }
        100% { opacity: 1; r: 5; fill: #7F52FF; filter: drop-shadow(0 0 5px #7F52FF); }
      }
    </style>
    <!-- Multi-frequency Sound Bars representing FSK Modulation -->
    <line class="sound-wave" x1="40" y1="15" x2="40" y2="35" style="animation-delay: -0.1s;" />
    <line class="sound-wave" x1="60" y1="10" x2="60" y2="40" style="animation-delay: -0.3s;" />
    <line class="sound-wave" x1="80" y1="5" x2="80" y2="45" style="animation-delay: -0.5s;" />
    <line class="sound-wave" x1="100" y1="15" x2="100" y2="35" style="animation-delay: -0.7s;" />
    <line class="sound-wave" x1="120" y1="8" x2="120" y2="42" style="animation-delay: -0.9s;" />
    <line class="sound-wave" x1="140" y1="3" x2="140" y2="47" style="animation-delay: -1.1s;" />
    <line class="sound-wave" x1="160" y1="12" x2="160" y2="38" style="animation-delay: -1.3s;" />
    <line class="sound-wave" x1="180" y1="18" x2="180" y2="32" style="animation-delay: -1.5s;" />
    
    <!-- Acoustic Transmitting Nodes -->
    <circle class="sound-node" cx="20" cy="25" r="4" />
    <circle class="sound-node" cx="200" cy="25" r="4" style="animation-delay: -0.8s;" />
  </svg>
  
  <p style="font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: #7F52FF; margin: 0; letter-spacing: 0.05em;">
    built by anuj with ❤️ to the silent, telepathic frequencies of kali uchis's "telepatía"
  </p>
</div>
