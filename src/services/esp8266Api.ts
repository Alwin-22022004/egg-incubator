import {
  DeviceStatusResponse,
  DeviceConfigResponse,
  DeviceConfigRequest,
  ApiResult,
  isValidStatusResponse,
  isValidConfigResponse,
} from '../types/api';
import { deviceConfig } from './deviceConfig';

const DEFAULT_TIMEOUT_MS = 4000;

class Esp8266ApiService {
  private activeStatusAbortController: AbortController | null = null;
  private inFlightStatusPromise: Promise<ApiResult<DeviceStatusResponse>> | null = null;

  /**
   * Helper to execute fetch with timeout and error handling.
   */
  private async executeFetch<T>(
    endpoint: string,
    options: RequestInit = {},
    validator: (data: unknown) => data is T,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    abortSignal?: AbortSignal
  ): Promise<ApiResult<T>> {
    const baseUrl = deviceConfig.getBaseUrl();
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const timestamp = new Date().toLocaleTimeString();
    const startTime = Date.now();

    const controller = new AbortController();
    let onAbortListener: (() => void) | null = null;

    if (abortSignal) {
      if (abortSignal.aborted) {
        controller.abort();
      } else {
        onAbortListener = () => {
          controller.abort();
        };
        abortSignal.addEventListener('abort', onAbortListener);
      }
    }

    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      clearTimeout(timeoutTimer);
      if (abortSignal && onAbortListener) {
        abortSignal.removeEventListener('abort', onAbortListener);
      }
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          error: `ESP8266 responded with HTTP ${response.status} (${response.statusText || 'Error'})`,
          status: response.status,
          timestamp,
        };
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        return {
          success: false,
          error: 'Failed to parse JSON response from ESP8266.',
          status: response.status,
          timestamp,
        };
      }

      if (!validator(json)) {
        return {
          success: false,
          error: `Malformed response schema from ${endpoint}. Unexpected data types or missing fields.`,
          status: response.status,
          timestamp,
        };
      }

      return {
        success: true,
        data: json,
        status: response.status,
        timestamp,
        latencyMs,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      if (abortSignal && onAbortListener) {
        abortSignal.removeEventListener('abort', onAbortListener);
      }
      const latencyMs = Date.now() - startTime;

      if (err instanceof Error) {
        if (abortSignal?.aborted) {
          return {
            success: false,
            error: 'Request was cancelled.',
            timestamp,
          };
        }

        if (err.name === 'AbortError' || latencyMs >= timeoutMs) {
          return {
            success: false,
            error: `Connection timed out after ${timeoutMs / 1000}s. Check if ESP8266 is powered on at ${baseUrl}.`,
            isTimeout: true,
            timestamp,
          };
        }

        // Network failure (device offline, wrong subnet, or connection refused)
        return {
          success: false,
          error: `Cannot reach ESP8266 at ${baseUrl}. Ensure phone and ESP8266 are on the same Wi-Fi network.`,
          isNetworkError: true,
          timestamp,
        };
      }

      return {
        success: false,
        error: 'Unknown communication error occurred.',
        timestamp,
      };
    }
  }

  /**
   * GET /api/status
   * Reads real-time telemetry and relay outputs.
   * Protects against overlapping polling requests by sharing in-flight fetch.
   */
  public async getStatus(): Promise<ApiResult<DeviceStatusResponse>> {
    // If a status fetch is already running, reuse the existing promise so we don't bombard the ESP8266
    if (this.inFlightStatusPromise) {
      return this.inFlightStatusPromise;
    }

    const controller = new AbortController();
    this.activeStatusAbortController = controller;

    this.inFlightStatusPromise = (async () => {
      try {
        const result = await this.executeFetch<DeviceStatusResponse>(
          '/api/status',
          { method: 'GET' },
          isValidStatusResponse,
          DEFAULT_TIMEOUT_MS,
          controller.signal
        );
        return result;
      } finally {
        if (this.activeStatusAbortController === controller) {
          this.activeStatusAbortController = null;
        }
        this.inFlightStatusPromise = null;
      }
    })();

    return this.inFlightStatusPromise;
  }

  /**
   * GET /api/config
   * Reads configured bulb threshold settings from the ESP8266.
   */
  public async getConfig(): Promise<ApiResult<DeviceConfigResponse>> {
    return this.executeFetch<DeviceConfigResponse>(
      '/api/config',
      { method: 'GET' },
      isValidConfigResponse,
      DEFAULT_TIMEOUT_MS
    );
  }

  /**
   * POST /api/config
   * Sends updated bulb threshold settings to the ESP8266.
   */
  public async postConfig(config: DeviceConfigRequest): Promise<ApiResult<DeviceConfigResponse>> {
    return this.executeFetch<DeviceConfigResponse>(
      '/api/config',
      {
        method: 'POST',
        body: JSON.stringify(config),
      },
      isValidConfigResponse,
      DEFAULT_TIMEOUT_MS
    );
  }

  /**
   * Quick connection probe to verify connectivity to base URL.
   */
  public async ping(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const result = await this.getStatus();
    if (result.success) {
      return {
        success: true,
        message: `Connected successfully! Latency: ${result.latencyMs ?? 0}ms`,
        latencyMs: result.latencyMs,
      };
    }
    return {
      success: false,
      message: result.error,
    };
  }

  /**
   * Cancels any pending in-flight status requests (useful when unmounting or switching screens).
   */
  public cancelPendingRequests(): void {
    if (this.activeStatusAbortController) {
      this.activeStatusAbortController.abort();
      this.activeStatusAbortController = null;
    }
    this.inFlightStatusPromise = null;
  }
}

export const esp8266Api = new Esp8266ApiService();
