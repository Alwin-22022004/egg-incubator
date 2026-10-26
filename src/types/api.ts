/**
 * Types and validation schemas for ESP8266 HTTP API communication.
 */

export type DataMode = 'mock' | 'device';

/**
 * Expected schema for GET /api/status.
 * Notes:
 * - temperature and humidity are numbers, or null when sensorStatus != 'OK'.
 * - fanOn is null because the current incubator hardware build does not implement a fan relay.
 */
export interface DeviceStatusResponse {
  temperature: number | null;
  humidity: number | null;
  bulbOn: boolean;
  fanOn: boolean | null;
  buzzerOn: boolean;
  sensorStatus: 'OK' | 'ERROR' | 'FAULT' | 'SENSOR_ERROR' | string;
}

/**
 * Expected schema for GET /api/config and POST /api/config
 */
export interface DeviceConfigResponse {
  bulbOnThreshold: number;
  bulbOffThreshold: number;
}

export interface DeviceConfigRequest {
  bulbOnThreshold: number;
  bulbOffThreshold: number;
}

/**
 * Generic API operation outcome
 */
export type ApiResult<T> =
  | {
      success: true;
      data: T;
      status: number;
      timestamp: string;
      latencyMs?: number;
    }
  | {
      success: false;
      error: string;
      status?: number;
      isNetworkError?: boolean;
      isTimeout?: boolean;
      timestamp: string;
    };

/**
 * Type guard to validate GET /api/status responses.
 * Never converts missing or invalid values into fake readings.
 */
export function isValidStatusResponse(data: unknown): data is DeviceStatusResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check temperature: valid finite number OR null (e.g. on SENSOR_ERROR)
  const isTempValid =
    obj.temperature === null ||
    (typeof obj.temperature === 'number' && !isNaN(obj.temperature) && isFinite(obj.temperature));
  if (!isTempValid) {
    return false;
  }

  // Check humidity: valid finite number OR null
  const isHumidityValid =
    obj.humidity === null ||
    (typeof obj.humidity === 'number' && !isNaN(obj.humidity) && isFinite(obj.humidity));
  if (!isHumidityValid) {
    return false;
  }

  // Check bulbOn and buzzerOn are booleans
  if (typeof obj.bulbOn !== 'boolean' || typeof obj.buzzerOn !== 'boolean') {
    return false;
  }

  // fanOn can be boolean OR null (current hardware has no fan relay wired)
  if (obj.fanOn !== null && typeof obj.fanOn !== 'boolean') {
    return false;
  }

  // Check sensorStatus string
  if (typeof obj.sensorStatus !== 'string' || obj.sensorStatus.trim() === '') {
    return false;
  }

  return true;
}

/**
 * Type guard to validate GET /api/config and POST /api/config responses.
 */
export function isValidConfigResponse(data: unknown): data is DeviceConfigResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (
    typeof obj.bulbOnThreshold !== 'number' ||
    isNaN(obj.bulbOnThreshold) ||
    !isFinite(obj.bulbOnThreshold)
  ) {
    return false;
  }

  if (
    typeof obj.bulbOffThreshold !== 'number' ||
    isNaN(obj.bulbOffThreshold) ||
    !isFinite(obj.bulbOffThreshold)
  ) {
    return false;
  }

  return true;
}
