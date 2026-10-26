import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  AppState,
  AppStateStatus,
} from 'react-native';
import { colors } from '../theme/colors';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { MetricCard } from '../components/MetricCard';
import { ActuatorStatusCard } from '../components/ActuatorStatusCard';
import { IncubationProgressCard } from '../components/IncubationProgressCard';
import {
  StateSimulationSelector,
  SimulatedScenario,
} from '../components/StateSimulationSelector';
import {
  mockNormalState,
  mockWarningState,
  mockLoadingState,
  mockDisconnectedState,
  mockErrorState,
} from '../mock/mockData';
import { IncubatorState, TemperatureSettings, ConnectionState } from '../types/incubator';
import { DataMode, DeviceStatusResponse } from '../types/api';
import { esp8266Api } from '../services/esp8266Api';
import { deviceConfig } from '../services/deviceConfig';

interface DashboardScreenProps {
  settings: TemperatureSettings;
  dataMode: DataMode;
  onOpenSettings: () => void;
  onOpenDiagnostics?: () => void;
  onOpenConfigModal?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  settings,
  dataMode,
  onOpenSettings,
  onOpenDiagnostics,
  onOpenConfigModal,
}) => {
  // Mock Mode state
  const [scenario, setScenario] = useState<SimulatedScenario>('normal');
  const [refreshing, setRefreshing] = useState(false);

  // Device Mode state
  const [deviceData, setDeviceData] = useState<DeviceStatusResponse | null>(null);
  const [deviceConnState, setDeviceConnState] = useState<ConnectionState>('connecting');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [lastSuccessTime, setLastSuccessTime] = useState<Date | null>(null);
  const [readingAgeSeconds, setReadingAgeSeconds] = useState<number>(0);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isComponentActiveRef = useRef(true);
  const isPollingRef = useRef(false);
  const lastSuccessTimeRef = useRef<Date | null>(null);
  const hasHadSuccessRef = useRef(false);
  const deviceDataRef = useRef<DeviceStatusResponse | null>(null);
  const currentBaseUrlRef = useRef(deviceConfig.getBaseUrl());

  const isSameDeviceStatus = (
    a: DeviceStatusResponse | null,
    b: DeviceStatusResponse | null
  ): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
      a.temperature === b.temperature &&
      a.humidity === b.humidity &&
      a.bulbOn === b.bulbOn &&
      a.fanOn === b.fanOn &&
      a.buzzerOn === b.buzzerOn &&
      a.sensorStatus === b.sensorStatus
    );
  };

  // Function to poll the real ESP8266 /api/status endpoint
  const pollDeviceStatus = async (isManualRefresh = false) => {
    if (!isComponentActiveRef.current) return;
    if (isPollingRef.current) return; // Prevent overlapping requests

    isPollingRef.current = true;
    try {
      // Show connecting state only if we have not had a successful packet yet
      if ((!hasHadSuccessRef.current && !deviceDataRef.current) || (isManualRefresh && !hasHadSuccessRef.current)) {
        setDeviceConnState('connecting');
      }

      const result = await esp8266Api.getStatus();
      if (!isComponentActiveRef.current) return;

      // Ignore intentionally cancelled requests (e.g. unmount or background navigation)
      if (!result.success && result.error === 'Request was cancelled.') {
        return;
      }

      if (result.success) {
        hasHadSuccessRef.current = true;
        const now = new Date();
        lastSuccessTimeRef.current = now;

        setDeviceData((prev) => {
          if (isSameDeviceStatus(prev, result.data)) {
            return prev;
          }
          deviceDataRef.current = result.data;
          return result.data;
        });

        setDeviceConnState((prev) => (prev === 'connected' ? prev : 'connected'));
        setDeviceError((prev) => (prev === null ? prev : null));
        setLastSuccessTime((prev) => (prev ? prev : now));
        setReadingAgeSeconds((prev) => (prev === 0 ? prev : 0));
      } else {
        // Genuine error or disconnect - preserve existing readings so screen doesn't clear
        setDeviceConnState((prev) => {
          const nextState: ConnectionState = hasHadSuccessRef.current ? 'disconnected' : 'error';
          return prev === nextState ? prev : nextState;
        });
        setDeviceError((prev) => (prev === result.error ? prev : result.error));
      }
    } finally {
      isPollingRef.current = false;
    }
  };

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (ageTimerRef.current) {
      clearInterval(ageTimerRef.current);
      ageTimerRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    // Fire immediate poll
    pollDeviceStatus();

    // 2-second background live telemetry poll
    pollingTimerRef.current = setInterval(() => {
      pollDeviceStatus();
    }, 2000);

    // Reading age updater every 1 second
    ageTimerRef.current = setInterval(() => {
      if (lastSuccessTimeRef.current) {
        const age = Math.floor((Date.now() - lastSuccessTimeRef.current.getTime()) / 1000);
        setReadingAgeSeconds((prev) => {
          // Both 0, 1, 2 format to "Just now (live)" - avoid re-renders when displayed string is unchanged
          if (prev <= 2 && age <= 2) return prev;
          return prev === age ? prev : age;
        });
      }
    }, 1000);
  };

  // Device Mode polling lifecycle
  useEffect(() => {
    isComponentActiveRef.current = true;

    if (dataMode === 'device') {
      startPolling();

      // AppState listener: stop polling when app is in background, resume when active
      const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        if (nextAppState !== 'active') {
          stopPolling();
          esp8266Api.cancelPendingRequests();
        } else if (dataMode === 'device') {
          startPolling();
        }
      });

      // Subscribe to device config service changes (e.g. if user updates IP in modal)
      const configSub = deviceConfig.subscribe((configState) => {
        if (configState.baseUrl !== currentBaseUrlRef.current) {
          currentBaseUrlRef.current = configState.baseUrl;
          hasHadSuccessRef.current = false;
          deviceDataRef.current = null;
          lastSuccessTimeRef.current = null;
          setDeviceData(null);
          setLastSuccessTime(null);
          setDeviceConnState('connecting');
          startPolling();
        }
      });

      return () => {
        isComponentActiveRef.current = false;
        stopPolling();
        appStateSub.remove();
        configSub();
        esp8266Api.cancelPendingRequests();
      };
    } else {
      // In Mock Mode, clear device timers
      stopPolling();
      esp8266Api.cancelPendingRequests();
    }

    return () => {
      isComponentActiveRef.current = false;
      stopPolling();
    };
  }, [dataMode]);

  const getStateForScenario = (s: SimulatedScenario): IncubatorState => {
    switch (s) {
      case 'overheat':
        return mockWarningState;
      case 'loading':
        return mockLoadingState;
      case 'disconnected':
        return mockDisconnectedState;
      case 'sensor_error':
        return mockErrorState;
      case 'normal':
      default:
        return mockNormalState;
    }
  };

  // Determine active state depending on whether Mock Mode or Device Mode is active
  const mockState = getStateForScenario(scenario);

  const activeConnection: ConnectionState =
    dataMode === 'device' ? deviceConnState : mockState.connection;

  const activeError =
    dataMode === 'device'
      ? deviceError ||
        (deviceData?.sensorStatus === 'SENSOR_ERROR'
          ? 'DHT11 Sensor Error: Sensor disconnected or pulling low on GPIO pin D5. Bulb is in fail-safe OFF mode.'
          : undefined)
      : mockState.errorMessage;

  // Temperature and Humidity values (never converting missing values into fake 0s)
  const currentTemp =
    dataMode === 'device'
      ? deviceData?.temperature ?? null
      : mockState.telemetry.temperature;

  const currentHumidity =
    dataMode === 'device'
      ? deviceData?.humidity ?? null
      : mockState.telemetry.humidity;

  const currentActuators =
    dataMode === 'device'
      ? {
          bulbRelay: deviceData?.bulbOn ?? false,
          fanRelay: deviceData?.fanOn ?? null,
          buzzerActive: deviceData?.buzzerOn ?? false,
          oledDisplayActive: activeConnection === 'connected',
        }
      : mockState.actuators;

  // Dynamic values driven by user-configured thresholds
  const targetTemp = (settings.bulbOnThreshold + settings.bulbOffThreshold) / 2;
  const toleranceTemp = (settings.bulbOffThreshold - settings.bulbOnThreshold) / 2;
  const deadbandSpan = settings.bulbOffThreshold - settings.bulbOnThreshold;

  const onRefresh = async () => {
    setRefreshing(true);
    if (dataMode === 'device') {
      await pollDeviceStatus(true);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    setRefreshing(false);
  };

  const formatAge = (seconds: number) => {
    if (seconds <= 2) return 'Just now (live)';
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ${seconds % 60}s ago (stale)`;
  };

  const formatUptime = (seconds: number) => {
    if (seconds <= 0) return '0h 0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.amberGlow}
          colors={[colors.amberGlow, colors.cyanGlow]}
        />
      }
    >
      {/* Mode Banner & IP Information */}
      <View
        style={[
          styles.modeIndicatorCard,
          dataMode === 'device' ? styles.modeDeviceCard : styles.modeMockCard,
        ]}
      >
        <View style={styles.modeTextGroup}>
          <Text style={styles.modeIndicatorIcon}>
            {dataMode === 'device' ? '📡' : '🧪'}
          </Text>
          <View>
            <Text
              style={[
                styles.modeIndicatorTitle,
                { color: dataMode === 'device' ? colors.cyanGlow : colors.amberGlow },
              ]}
            >
              {dataMode === 'device' ? 'LIVE DEVICE MODE' : 'MOCK SIMULATION MODE'}
            </Text>
            <Text style={styles.modeIndicatorSub}>
              {dataMode === 'device'
                ? `Polling ${deviceConfig.getBaseUrl()}/api/status • ${
                    lastSuccessTime ? formatAge(readingAgeSeconds) : 'Connecting...'
                  }`
                : 'Using simulated telemetry scenarios for local testing'}
            </Text>
          </View>
        </View>

        {onOpenConfigModal && (
          <TouchableOpacity
            style={styles.configChangeButton}
            onPress={onOpenConfigModal}
            activeOpacity={0.7}
          >
            <Text style={styles.configChangeButtonText}>
              {dataMode === 'device' ? 'Edit IP ✏️' : 'Switch Mode'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Alert / Loading / Disconnected Status Banner */}
      <ConnectionBanner
        connection={activeConnection}
        health={
          dataMode === 'device'
            ? deviceConnState === 'connected'
              ? deviceData?.sensorStatus === 'OK'
                ? 'optimal'
                : 'critical'
              : 'offline'
            : mockState.health
        }
        errorMessage={activeError ?? undefined}
      />

      {/* Configured Thresholds Quick Summary Card */}
      <View style={styles.thresholdsCard}>
        <View style={styles.thresholdsHeader}>
          <View style={styles.thresholdsTitleGroup}>
            <Text style={styles.thresholdsIcon}>⚙️</Text>
            <View>
              <Text style={styles.thresholdsTitle}>CONFIGURED BULB THRESHOLDS</Text>
              <Text style={styles.thresholdsSubtitle}>
                {settings.lastUpdated || 'Factory Defaults'} {settings.isMock ? '(Local)' : '(Device)'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editSettingsButton}
            onPress={onOpenSettings}
            activeOpacity={0.7}
          >
            <Text style={styles.editSettingsButtonText}>Edit ⚙️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.thresholdsMetricsRow}>
          <View style={styles.thresholdItem}>
            <Text style={styles.thresholdItemLabel}>BULB ON (HEAT)</Text>
            <Text style={[styles.thresholdItemValue, { color: colors.amberGlow }]}>
              ≤ {settings.bulbOnThreshold.toFixed(1)}°C
            </Text>
          </View>
          <View style={styles.thresholdDivider} />
          <View style={styles.thresholdItem}>
            <Text style={styles.thresholdItemLabel}>DEADBAND</Text>
            <Text style={styles.thresholdItemValue}>
              {deadbandSpan.toFixed(1)}°C Span
            </Text>
          </View>
          <View style={styles.thresholdDivider} />
          <View style={styles.thresholdItem}>
            <Text style={styles.thresholdItemLabel}>BULB OFF (CUTOFF)</Text>
            <Text style={[styles.thresholdItemValue, { color: colors.cyanGlow }]}>
              ≥ {settings.bulbOffThreshold.toFixed(1)}°C
            </Text>
          </View>
        </View>
      </View>

      {/* Main Sensor Metrics (DHT11) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>DHT11 SENSOR TELEMETRY</Text>
        <Text style={styles.sectionSub}>
          {dataMode === 'device'
            ? `Live readings from ${deviceConfig.getBaseUrl()}`
            : 'Simulated Chamber Readings'}
        </Text>
      </View>

      <MetricCard
        label="Chamber Temperature"
        icon="🌡️"
        value={currentTemp}
        unit="°C"
        target={targetTemp}
        tolerance={toleranceTemp}
        minSafe={settings.bulbOnThreshold}
        maxSafe={settings.bulbOffThreshold}
        connection={activeConnection}
        accentColor={colors.amberGlow}
      />

      <MetricCard
        label="Relative Humidity"
        icon="💧"
        value={currentHumidity}
        unit="%"
        target={mockState.telemetry.targetHumidity}
        tolerance={mockState.telemetry.humidityTolerance}
        minSafe={mockState.telemetry.targetHumidity - mockState.telemetry.humidityTolerance}
        maxSafe={mockState.telemetry.targetHumidity + mockState.telemetry.humidityTolerance}
        connection={activeConnection}
        accentColor={colors.cyanGlow}
      />

      {/* Actuators & Relays (Bulb, Fan, Buzzer, OLED) */}
      <ActuatorStatusCard
        actuators={currentActuators}
        connection={activeConnection}
      />

      {/* Incubation Progress Tracker */}
      <IncubationProgressCard progress={mockState.progress} />

      {/* Device Info & Network Diagnostics Card */}
      <View style={styles.deviceCard}>
        <View style={styles.deviceHeader}>
          <Text style={styles.deviceIcon}>📡</Text>
          <Text style={styles.deviceTitle}>ESP8266 SYSTEM DIAGNOSTICS</Text>
        </View>

        <View style={styles.diagnosticGrid}>
          <View style={styles.diagnosticItem}>
            <Text style={styles.diagnosticLabel}>Target Device</Text>
            <Text style={styles.diagnosticValue}>
              {dataMode === 'device' ? deviceConfig.getBaseUrl() : mockState.device.wifiSsid}
            </Text>
          </View>
          <View style={styles.diagnosticItem}>
            <Text style={styles.diagnosticLabel}>Connection Status</Text>
            <Text
              style={[
                styles.diagnosticValue,
                { color: activeConnection === 'connected' ? colors.emeraldGlow : colors.crimsonGlow },
              ]}
            >
              {activeConnection.toUpperCase()}
            </Text>
          </View>
          <View style={styles.diagnosticItem}>
            <Text style={styles.diagnosticLabel}>Last Status Packet</Text>
            <Text style={styles.diagnosticValue}>
              {dataMode === 'device'
                ? lastSuccessTime
                  ? formatAge(readingAgeSeconds)
                  : 'Awaiting Response'
                : mockState.device.lastSyncTimestamp}
            </Text>
          </View>
          <View style={styles.diagnosticItem}>
            <Text style={styles.diagnosticLabel}>System Uptime</Text>
            <Text style={styles.diagnosticValue}>
              {dataMode === 'device' ? 'Not in /api/status' : formatUptime(mockState.device.uptimeSeconds)}
            </Text>
          </View>
        </View>

        <View style={styles.deviceFooter}>
          <Text style={styles.firmwareText}>
            Mode: {dataMode === 'device' ? 'HTTP Polling (2.0s)' : 'Mock Telemetry'} • DHT11:{' '}
            {dataMode === 'device'
              ? deviceData?.sensorStatus ?? 'UNKNOWN'
              : mockState.device.sensorHealth.toUpperCase()}
          </Text>
          {onOpenDiagnostics && (
            <TouchableOpacity
              style={styles.viewDiagnosticsButton}
              onPress={onOpenDiagnostics}
              activeOpacity={0.7}
            >
              <Text style={styles.viewDiagnosticsButtonText}>View Full Diagnostics 🩺 →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Simulation Selector or Device Mode Status Card */}
      {dataMode === 'mock' ? (
        <StateSimulationSelector
          currentScenario={scenario}
          onSelectScenario={setScenario}
        />
      ) : (
        <View style={styles.deviceActiveBanner}>
          <Text style={styles.deviceActiveIcon}>📡</Text>
          <View style={styles.deviceActiveTextWrap}>
            <Text style={styles.deviceActiveTitle}>Device Mode Active</Text>
            <Text style={styles.deviceActiveSub}>
              Dashboard is polling live HTTP telemetry from {deviceConfig.getBaseUrl()}/api/status every 2 seconds. Mock scenarios are disabled to protect genuine telemetry.
            </Text>
          </View>
          {onOpenConfigModal && (
            <TouchableOpacity
              style={styles.switchMockButton}
              onPress={onOpenConfigModal}
              activeOpacity={0.7}
            >
              <Text style={styles.switchMockButtonText}>Switch Mode</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  modeIndicatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  modeMockCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  modeDeviceCard: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  modeTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modeIndicatorIcon: {
    fontSize: 20,
  },
  modeIndicatorTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  modeIndicatorSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  configChangeButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configChangeButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  thresholdsCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 14,
  },
  thresholdsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  thresholdsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  thresholdsIcon: {
    fontSize: 16,
  },
  thresholdsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  thresholdsSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  editSettingsButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.amberMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.amberGlow,
  },
  editSettingsButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.amberGlow,
  },
  thresholdsMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  thresholdItem: {
    alignItems: 'center',
    flex: 1,
  },
  thresholdItemLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  thresholdItemValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  thresholdDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  sectionHeaderRow: {
    marginBottom: 10,
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  sectionSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  deviceCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  deviceIcon: {
    fontSize: 16,
  },
  deviceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  diagnosticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  diagnosticItem: {
    width: '47%',
  },
  diagnosticLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  diagnosticValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  deviceFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  firmwareText: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 8,
  },
  viewDiagnosticsButton: {
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewDiagnosticsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.cyanGlow,
  },
  deviceActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cyanGlow,
    gap: 12,
    marginBottom: 20,
  },
  deviceActiveIcon: {
    fontSize: 22,
  },
  deviceActiveTextWrap: {
    flex: 1,
  },
  deviceActiveTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.cyanGlow,
  },
  deviceActiveSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  switchMockButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchMockButtonText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
