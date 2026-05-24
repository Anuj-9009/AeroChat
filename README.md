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
  <img src="assets/banner.svg" width="220" alt="banner">
  
  <p style="font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: #7F52FF; margin: 0; letter-spacing: 0.05em;">
    built by ANUJ with ❤️ to the silent, telepathic frequencies of kali uchis's "telepatía"
  </p>
</div>
