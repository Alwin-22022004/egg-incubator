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
  TemperatureSettings,
  ConnectionState,
  DEFAULT_INCUBATION_PROGRESS,
} from '../types/incubator';
import { DeviceStatusResponse } from '../types/api';
import { esp8266Api } from '../services/esp8266Api';
import { deviceConfig } from '../services/deviceConfig';

interface DashboardScreenProps {
  settings: TemperatureSettings;
  onOpenSettings: () => void;
  onOpenDiagnostics?: () => void;
  onOpenConfigModal?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  settings,
  onOpenSettings,
  onOpenDiagnostics,
  onOpenConfigModal,
}) => {
  const [deviceData, setDeviceData] = useState<DeviceStatusResponse | null>(null);
  const [deviceConnState, setDeviceConnState] = useState<ConnectionState>('connecting');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [lastSuccessTime, setLastSuccessTime] = useState<Date | null>(null);
  const [readingAgeSeconds, setReadingAgeSeconds] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

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
      if ((!hasHadSuccessRef.current && !deviceDataRef.current) || (isManualRefresh && !hasHadSuccessRef.current)) {
        setDeviceConnState('connecting');
      }

      const result = await esp8266Api.getStatus();
      if (!isComponentActiveRef.current) return;

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

    // 2-second live telemetry poll
    pollingTimerRef.current = setInterval(() => {
      pollDeviceStatus();
    }, 2000);

    // Reading age updater every 1 second
    ageTimerRef.current = setInterval(() => {
      if (lastSuccessTimeRef.current) {
        const age = Math.floor((Date.now() - lastSuccessTimeRef.current.getTime()) / 1000);
        setReadingAgeSeconds((prev) => {
          if (prev <= 2 && age <= 2) return prev;
          return prev === age ? prev : age;
        });
      }
    }, 1000);
  };

  // Polling lifecycle
  useEffect(() => {
    isComponentActiveRef.current = true;
    startPolling();

    // AppState listener: stop polling when app is in background, resume when active
    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState !== 'active') {
        stopPolling();
        esp8266Api.cancelPendingRequests();
      } else {
        startPolling();
      }
    });

    // Subscribe to device config changes (e.g. if user updates IP in modal)
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
  }, []);

  const activeConnection: ConnectionState = deviceConnState;

  const activeError =
    deviceError ||
    (deviceData?.sensorStatus === 'SENSOR_ERROR'
      ? 'DHT11 Sensor Error: Sensor disconnected or pulling low on GPIO pin D5. Heating bulb is in fail-safe OFF mode.'
      : undefined);

  // Live sensor readings
  const currentTemp = deviceData?.temperature ?? null;
  const currentHumidity = deviceData?.humidity ?? null;

  const currentActuators = {
    bulbRelay: deviceData?.bulbOn ?? false,
    fanRelay: deviceData?.fanOn ?? null,
    buzzerActive: deviceData?.buzzerOn ?? false,
    oledDisplayActive: activeConnection === 'connected',
  };

  // Dynamic values driven by configured thresholds
  const targetTemp = (settings.bulbOnThreshold + settings.bulbOffThreshold) / 2;
  const toleranceTemp = (settings.bulbOffThreshold - settings.bulbOnThreshold) / 2;
  const deadbandSpan = settings.bulbOffThreshold - settings.bulbOnThreshold;

  const onRefresh = async () => {
    setRefreshing(true);
    await pollDeviceStatus(true);
    setRefreshing(false);
  };

  const formatAge = (seconds: number) => {
    if (seconds <= 2) return 'Just now (live)';
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ${seconds % 60}s ago (stale)`;
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
      {/* Device Connection Info Card */}
      <View style={styles.deviceConnectionCard}>
        <View style={styles.deviceInfoGroup}>
          <Text style={styles.deviceIcon}>📡</Text>
          <View style={styles.deviceTextWrap}>
            <Text style={styles.deviceTitle}>ESP8266 NodeMCU</Text>
            <Text style={styles.deviceSub}>
              {deviceConfig.getBaseUrl()} • {lastSuccessTime ? formatAge(readingAgeSeconds) : 'Connecting...'}
            </Text>
          </View>
        </View>

        {onOpenConfigModal && (
          <TouchableOpacity
            style={styles.configChangeButton}
            onPress={onOpenConfigModal}
            activeOpacity={0.7}
          >
            <Text style={styles.configChangeButtonText}>Edit IP ✏️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Alert / Loading / Disconnected Status Banner */}
      <ConnectionBanner
        connection={activeConnection}
        health={
          deviceConnState === 'connected'
            ? deviceData?.sensorStatus === 'OK'
              ? 'optimal'
              : 'critical'
            : 'offline'
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
                {settings.lastUpdated || 'Factory Defaults'}
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
        <Text style={styles.sectionSub}>Live readings from {deviceConfig.getBaseUrl()}/api/status</Text>
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
        target={55.0}
        tolerance={5.0}
        minSafe={50.0}
        maxSafe={65.0}
        connection={activeConnection}
        accentColor={colors.cyanGlow}
      />

      {/* Actuators & Relays (Bulb, Fan, Buzzer, OLED) */}
      <ActuatorStatusCard
        actuators={currentActuators}
        connection={activeConnection}
      />

      {/* Incubation Progress Tracker */}
      <IncubationProgressCard progress={DEFAULT_INCUBATION_PROGRESS} />

      {/* Diagnostics Quick Card */}
      <View style={styles.deviceCard}>
        <View style={styles.deviceHeader}>
          <Text style={styles.deviceCardIcon}>📡</Text>
          <Text style={styles.deviceCardTitle}>ESP8266 SYSTEM DIAGNOSTICS</Text>
        </View>

        <View style={styles.diagnosticGrid}>
          <View style={styles.diagnosticItem}>
            <Text style={styles.diagnosticLabel}>Target Device</Text>
            <Text style={styles.diagnosticValue}>{deviceConfig.getBaseUrl()}</Text>
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
              {lastSuccessTime ? formatAge(readingAgeSeconds) : 'Awaiting Response'}
            </Text>
          </View>
          <View style={styles.diagnosticItem}>
            <Text style={styles.diagnosticLabel}>DHT11 Status</Text>
            <Text
              style={[
                styles.diagnosticValue,
                {
                  color:
                    deviceData?.sensorStatus === 'OK'
                      ? colors.emeraldGlow
                      : colors.crimsonGlow,
                },
              ]}
            >
              {deviceData?.sensorStatus ?? 'UNKNOWN'}
            </Text>
          </View>
        </View>

        <View style={styles.deviceFooter}>
          <Text style={styles.firmwareText}>
            Polling Rate: 2.0s • Endpoint: /api/status
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
  deviceConnectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  deviceInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  deviceIcon: {
    fontSize: 20,
  },
  deviceTextWrap: {
    flex: 1,
  },
  deviceTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.cyanGlow,
  },
  deviceSub: {
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
  deviceCardIcon: {
    fontSize: 16,
  },
  deviceCardTitle: {
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
});
