# Smart IoT Egg Incubator 🐣

A complete IoT-based smart egg incubator monitoring and automated climate control system. This repository contains both the **ESP8266 NodeMCU firmware** (C++/Arduino) and the cross-platform **React Native (Expo) mobile control application** (TypeScript).

---

## 🌟 Key Features

- **Automated Climate Regulation**: Precision temperature and humidity monitoring and closed-loop actuator control using DHT sensors.
- **Automated Egg Turning**: Timed egg turning tray mechanism via servo/relay to ensure uniform embryo development.
- **OLED Local Display**: Real-time stats, Wi-Fi IP address, and system status displayed on an SSD1306 128x64 I2C display.
- **RESTful HTTP Telemetry & Control API**: Built-in HTTP web server on the ESP8266 offering endpoints for telemetry, threshold configurations, and manual overrides.
- **Cross-Platform Mobile App (Expo & React Native)**:
  - Real-time telemetry monitoring (Temperature, Humidity, Days left, Next turn countdown).
  - Target temperature & humidity threshold configuration synchronized over `/api/config`.
  - Diagnostics screen with connection health, ping response latency, and memory stats.
  - Dual operational modes: **Live Device Mode** (direct HTTP to ESP8266) & **Simulation Mode** (test UI without hardware).

---

## 📁 Repository Structure

```text
├── firmware/
│   └── EggIncubator/
│       └── EggIncubator.ino    # ESP8266 NodeMCU Arduino firmware
├── src/
│   ├── components/            # Reusable UI cards, headers, modals
│   ├── mock/                  # Simulated telemetry & state generator
│   ├── screens/               # Dashboard, Settings, & Diagnostics screens
│   ├── services/              # ESP8266 HTTP client & configuration storage
│   ├── theme/                 # Dark-mode color palette and design tokens
│   └── types/                 # TypeScript interfaces for API & incubator data
├── assets/                    # Icons and splash screen graphics
├── App.tsx                    # Main mobile application entrypoint
├── app.json                   # Expo configuration
├── package.json               # Mobile app dependencies & scripts
└── tsconfig.json              # TypeScript compiler configuration
```

---

## 🛠️ Hardware Requirements

- **Microcontroller**: ESP8266 NodeMCU (or ESP32)
- **Sensors**: DHT11 or DHT22 (Temperature & Humidity)
- **Display**: 0.96" I2C OLED Display (SSD1306, 128x64)
- **Actuators & Relays**:
  - Heating Element / Incandescent Bulb Relay
  - Circulation / Exhaust Fan Relay
  - Ultrasonic Humidifier / Mister Relay
  - Egg Turning Motor / Servo
- **Power Supply**: 5V / 12V DC power source

---

## 🔌 ESP8266 REST API Endpoints

The ESP8266 serves JSON over HTTP on port 80:

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | `GET` | Fetches live temperature, humidity, actuator states, and uptime |
| `/api/config` | `GET` / `POST` | Gets or updates target climate thresholds & calibration values |
| `/api/control` | `POST` | Manual actuator toggle overrides (heater, fan, humidifier, turner) |
| `/api/restart` | `POST` | Triggers a software reboot of the ESP8266 |

---

## 🚀 Mobile App Setup & Development

### Prerequisites
- Node.js (v18 or higher recommended)
- [Expo Go](https://expo.dev/go) app installed on your physical iOS or Android device (or an emulator)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the Expo development server:
   ```bash
   npx expo start
   ```

3. Scan the QR code with **Expo Go** (Android) or the **Camera app** (iOS) to launch the app.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
