export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export type IncubatorHealthStatus = 'optimal' | 'warning' | 'critical' | 'offline';

export interface ActuatorState {
  bulbRelay: boolean;          // Heating lamp relay
  fanRelay: boolean | null;    // Air circulation / cooling relay (null if hardware not installed)
  buzzerActive: boolean;       // Alarm buzzer
  oledDisplayActive: boolean;  // On-board I2C 0.96" OLED
}

export interface EnvironmentTelemetry {
  temperature: number;      // Current DHT11 temperature in °C
  humidity: number;         // Current DHT11 relative humidity in %
  targetTemperature: number; // Configured target temp (e.g., 37.5 °C)
  targetHumidity: number;    // Configured target humidity (e.g., 55 %)
  tempTolerance: number;    // Allowed variance (+/- 0.5 °C)
  humidityTolerance: number;// Allowed variance (+/- 5 %)
  minSafeTemp: number;      // e.g. 36.5 °C
  maxSafeTemp: number;      // e.g. 38.5 °C
}

export interface IncubatorProgress {
  cycleName: string;        // e.g. "Chicken Eggs (21 Days)"
  currentDay: number;       // e.g. 12
  totalDays: number;        // e.g. 21
  lockdownDay: number;      // e.g. Day 18 (stop turning, raise humidity)
  eggTurningActive: boolean;// Whether automatic turning is active
}

export interface DeviceDiagnostics {
  deviceName: string;        // e.g. "Egg Incubator ESP8266"
  firmwareVersion: string;   // e.g. "ESP-INCUBATOR v1.4.2"
  chipModel: string;         // "ESP8266 NodeMCU-12E"
  wifiSsid: string;
  ipAddress: string;
  rssi: number;              // Signal strength in dBm e.g. -58 dBm
  uptimeSeconds: number;
  lastSyncTimestamp: string;
  sensorHealth: 'healthy' | 'degraded' | 'fault';
  sensorName: string;        // "DHT11"
  tempReadingStatus: string; // e.g. "Valid (37.6°C)"
  humidityReadingStatus: string; // e.g. "Valid (56.4%)"
  lastSensorUpdate: string;
  totalBulbActivations: number;
  totalFanActivations: number;
  samplingIntervalMs: number;// e.g. 2000 ms
  oledDisplayState: 'available' | 'unknown';
}

export interface TemperatureSettings {
  bulbOnThreshold: number;   // Bulb turns ON at or below this value (default 36.0 °C)
  bulbOffThreshold: number;  // Bulb turns OFF at or above this value (default 38.0 °C)
  lastUpdated?: string;
}

export const DEFAULT_TEMPERATURE_SETTINGS: TemperatureSettings = {
  bulbOnThreshold: 36.0,
  bulbOffThreshold: 38.0,
  lastUpdated: 'Default (36.0°C / 38.0°C)',
};

export const DEFAULT_INCUBATION_PROGRESS: IncubatorProgress = {
  cycleName: 'Chicken Eggs Hatching',
  currentDay: 1,
  totalDays: 21,
  lockdownDay: 18,
  eggTurningActive: true,
};

export interface IncubatorState {
  connection: ConnectionState;
  health: IncubatorHealthStatus;
  telemetry: EnvironmentTelemetry;
  actuators: ActuatorState;
  progress: IncubatorProgress;
  device: DeviceDiagnostics;
  settings?: TemperatureSettings;
  errorMessage?: string;
}
