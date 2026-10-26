import { DataMode } from '../types/api';

/**
 * Service for managing ESP8266 device address configuration and operational data mode.
 * Centralizes address validation and event emission so UI components react immediately
 * to user configuration changes without requiring code edits.
 */

export const DEFAULT_DEVICE_URL = 'http://192.168.1.142';

export interface DeviceConfigState {
  baseUrl: string;
  dataMode: DataMode;
  lastChanged: string;
}

type ConfigChangeListener = (state: DeviceConfigState) => void;

class DeviceConfigService {
  private baseUrl: string = DEFAULT_DEVICE_URL;
  private dataMode: DataMode = 'mock';
  private listeners: Set<ConfigChangeListener> = new Set();

  /**
   * Retrieves the current device base URL.
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Retrieves the active data mode ('mock' | 'device').
   */
  public getDataMode(): DataMode {
    return this.dataMode;
  }

  /**
   * Returns current snapshot of configuration state.
   */
  public getState(): DeviceConfigState {
    return {
      baseUrl: this.baseUrl,
      dataMode: this.dataMode,
      lastChanged: new Date().toLocaleTimeString(),
    };
  }

  /**
   * Validates and normalizes an input URL.
   * Ensures protocol (http/https), valid IPv4 or hostname, and optional port.
   */
  public validateUrl(rawUrl: string): { valid: boolean; normalized?: string; error?: string } {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return { valid: false, error: 'Device URL cannot be empty.' };
    }

    // Auto-prefix with http:// if protocol omitted
    let candidate = trimmed;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `http://${candidate}`;
    }

    // Strip trailing slashes
    candidate = candidate.replace(/\/+$/, '');

    try {
      // Basic structure validation: protocol + host + optional port
      const urlRegex = /^https?:\/\/([a-zA-Z0-9.-]+)(:\d{1,5})?$/;
      if (!urlRegex.test(candidate)) {
        return {
          valid: false,
          error: 'Invalid URL format. Use format: http://192.168.1.xxx or http://device-hostname',
        };
      }

      // If IPv4 pattern, check octet ranges
      const ipv4Match = candidate.match(/^https?:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(:\d+)?$/);
      if (ipv4Match) {
        const octets = [ipv4Match[1], ipv4Match[2], ipv4Match[3], ipv4Match[4]].map(Number);
        for (const octet of octets) {
          if (octet < 0 || octet > 255) {
            return { valid: false, error: `Invalid IP octet (${octet}). Must be 0–255.` };
          }
        }
      }

      return { valid: true, normalized: candidate };
    } catch {
      return { valid: false, error: 'Unable to parse URL.' };
    }
  }

  /**
   * Updates the device base URL if valid.
   */
  public setBaseUrl(newUrl: string): { success: boolean; error?: string } {
    const validation = this.validateUrl(newUrl);
    if (!validation.valid || !validation.normalized) {
      return { success: false, error: validation.error || 'Invalid URL' };
    }

    this.baseUrl = validation.normalized;
    this.notify();
    return { success: true };
  }

  /**
   * Switches operational data mode between 'mock' and 'device'.
   */
  public setDataMode(mode: DataMode): void {
    if (this.dataMode !== mode) {
      this.dataMode = mode;
      this.notify();
    }
  }

  /**
   * Subscribe to configuration changes. Returns unsubscribe callback.
   */
  public subscribe(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in config change listener:', err);
      }
    });
  }
}

export const deviceConfig = new DeviceConfigService();
