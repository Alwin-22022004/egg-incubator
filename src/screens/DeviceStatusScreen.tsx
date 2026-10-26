import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { IncubatorState, ConnectionState } from '../types/incubator';
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
import { DataMode, DeviceStatusResponse } from '../types/api';
import { esp8266Api } from '../services/esp8266Api';
import { deviceConfig } from '../services/deviceConfig';

interface DeviceStatusScreenProps {
  dataMode: DataMode;
  onBackToDashboard: () => void;
  onOpenSettings?: () => void;
  onOpenConfigModal?: () => void;
}

export const DeviceStatusScreen: React.FC<DeviceStatusScreenProps> = ({
  dataMode,
  onBackToDashboard,
  onOpenSettings,
  onOpenConfigModal,
}) => {
  // Mock Mode state
  const [scenario, setScenario] = useState<SimulatedScenario>('normal');
  const [refreshing, setRefreshing] = useState(false);

  // Device Mode state
  const [liveData, setLiveData] = useState<DeviceStatusResponse | null>(null);
  const [liveConnState, setLiveConnState] = useState<ConnectionState>('connecting');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>('Never');
  const isMountedRef = useRef(true);

  const fetchLiveDiagnostics = async () => {
    if (dataMode !== 'device' || !isMountedRef.current) return;

    setLiveConnState('connecting');
    const result = await esp8266Api.getStatus();
    if (!isMountedRef.current) return;
    if (!result.success && result.error === 'Request was cancelled.') return;

    const timestamp = new Date().toLocaleTimeString();
    setLastCheckTime(timestamp);

    if (result.success) {
      setLiveData(result.data);
      setLiveConnState('connected');
      setLiveError(null);
    } else {
      setLiveConnState('disconnected');
      setLiveError(result.error);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (dataMode === 'device') {
      fetchLiveDiagnostics();
    }
    return () => {
      isMountedRef.current = false;
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

  const mockState = getStateForScenario(scenario);

  const onRefresh = async () => {
    setRefreshing(true);
    if (dataMode === 'device') {
      await fetchLiveDiagnostics();
    } else {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    setRefreshing(false);
  };

  const formatUptime = (seconds: number) => {
    if (seconds <= 0) return '0h 0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  // Overall health calculation
  const getOverallHealth = () => {
    if (dataMode === 'device') {
      if (liveConnState === 'connecting') {
        return {
          label: 'ESTABLISHING LINK',
          color: colors.cyanGlow,
          bg: colors.cyanMuted,
          desc: `Attempting HTTP connection to ${deviceConfig.getBaseUrl()}/api/status...`,
          icon: '🔄',
        };
      }
      if (liveConnState === 'disconnected') {
        return {
          label: 'DEVICE UNREACHABLE (HTTP ERROR)',
          color: colors.crimsonGlow,
          bg: colors.crimsonMuted,
          desc: liveError || 'No HTTP response received from ESP8266.',
          icon: '⚠️',
        };
      }
      if (liveData?.sensorStatus !== 'OK') {
        return {
          label: `SENSOR ALERT: ${liveData?.sensorStatus ?? 'FAULT'}`,
          color: colors.amberGlow,
          bg: colors.amberMuted,
          desc: 'ESP8266 /api/status reports DHT11 sensor is not in OK status.',
          icon: '⚡',
        };
      }
      return {
        label: 'DEVICE CONNECTED (LIVE HTTP)',
        color: colors.emeraldGlow,
        bg: colors.emeraldMuted,
        desc: `Verified live response from ${deviceConfig.getBaseUrl()}/api/status. Hardware decisions are autonomous on ESP8266.`,
        icon: '✓',
      };
    }

    // Mock Mode health logic
    if (mockState.connection === 'disconnected') {
      return {
        label: 'OFFLINE / DISCONNECTED',
        color: colors.textMuted,
        bg: 'rgba(100, 116, 139, 0.15)',
        desc: 'Showing simulated offline state.',
        icon: '📡',
      };
    }
    if (mockState.connection === 'connecting') {
      return {
        label: 'ESTABLISHING LINK',
        color: colors.cyanGlow,
        bg: colors.cyanMuted,
        desc: 'Simulated connection handshake.',
        icon: '🔄',
      };
    }
    if (mockState.connection === 'error' || mockState.device.sensorHealth === 'fault') {
      return {
        label: 'HARDWARE FAULT DETECTED',
        color: colors.crimsonGlow,
        bg: colors.crimsonMuted,
        desc: mockState.errorMessage || 'Simulated sensor fault.',
        icon: '⚠️',
      };
    }
    if (mockState.health === 'warning') {
      return {
        label: 'WARNING / DRIFT DETECTED',
        color: colors.amberGlow,
        bg: colors.amberMuted,
        desc: mockState.errorMessage || 'Simulated environmental drift.',
        icon: '⚡',
      };
    }
    return {
      label: 'SYSTEM NOMINAL (SIMULATED)',
      color: colors.emeraldGlow,
      bg: colors.emeraldMuted,
      desc: 'Simulated telemetry and relay outputs are nominal.',
      icon: '✓',
    };
  };

  const overall = getOverallHealth();

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
      {/* Navigation Bar */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackToDashboard}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Device Status & Diagnostics</Text>
      </View>

      {/* Mode Banner */}
      <View
        style={[
          styles.mockBanner,
          dataMode === 'device' ? styles.deviceBanner : styles.mockBannerStyle,
        ]}
      >
        <Text style={styles.mockBannerIcon}>{dataMode === 'device' ? '📡' : 'ℹ️'}</Text>
        <View style={styles.mockBannerTextContainer}>
          <Text
            style={[
              styles.mockBannerTitle,
              { color: dataMode === 'device' ? colors.cyanGlow : colors.amberGlow },
            ]}
          >
            {dataMode === 'device'
              ? `LIVE HTTP MODE • TARGET: ${deviceConfig.getBaseUrl()}`
              : 'MOCK DIAGNOSTICS (STAGE 3/4)'}
          </Text>
          <Text style={styles.mockBannerSubtitle}>
            {dataMode === 'device'
              ? 'Telemetry reflects live response from /api/status. Fields not returned by the ESP8266 API are explicitly labeled "Not in /api/status" to avoid fabricated data.'
              : 'All diagnostics below reflect simulated scenarios for user interface testing.'}
          </Text>
        </View>

        {onOpenConfigModal && (
          <TouchableOpacity
            style={styles.editConfigButton}
            onPress={onOpenConfigModal}
            activeOpacity={0.7}
          >
            <Text style={styles.editConfigButtonText}>Configure ✏️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Overall Device Health Summary Card */}
      <View style={[styles.healthCard, { borderColor: overall.color }]}>
        <View style={styles.healthHeader}>
          <Text style={styles.healthIcon}>{overall.icon}</Text>
          <View style={styles.healthTitleContainer}>
            <Text style={styles.healthSubtitle}>OVERALL DEVICE HEALTH</Text>
            <Text style={[styles.healthTitle, { color: overall.color }]}>
              {overall.label}
            </Text>
          </View>
        </View>
        <Text style={styles.healthDescription}>{overall.desc}</Text>
      </View>

      {/* SECTION A: Device Connection */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>📡</Text>
          <Text style={styles.sectionTitle}>DEVICE CONNECTION</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Device Name</Text>
            <Text style={styles.itemValue}>Egg Incubator ESP8266</Text>
            <Text style={styles.itemSub}>ESP8266 NodeMCU-12E</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Connection Status</Text>
            <View style={[styles.chip, { backgroundColor: overall.bg }]}>
              <View style={[styles.chipDot, { backgroundColor: overall.color }]} />
              <Text style={[styles.chipText, { color: overall.color }]}>
                {dataMode === 'device'
                  ? liveConnState.toUpperCase()
                  : mockState.connection.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Device IP / URL</Text>
            <Text style={[styles.itemValue, styles.mono]}>
              {dataMode === 'device' ? deviceConfig.getBaseUrl() : mockState.device.ipAddress}
            </Text>
            <Text style={styles.itemSub}>
              {dataMode === 'device' ? 'Configured Target' : 'Simulated IP'}
            </Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Wi-Fi Signal (RSSI)</Text>
            <Text
              style={[
                styles.itemValue,
                dataMode === 'device' ? { color: colors.textMuted } : null,
              ]}
            >
              {dataMode === 'device'
                ? 'Not in /api/status'
                : `${mockState.device.rssi} dBm`}
            </Text>
            <Text style={styles.itemSub}>
              {dataMode === 'device'
                ? 'Unsupported by current endpoint'
                : 'Simulated Wi-Fi signal'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerNote}>
            Last successful probe:{' '}
            <Text style={styles.footerHighlight}>
              {dataMode === 'device' ? lastCheckTime : mockState.device.lastSyncTimestamp}
            </Text>
          </Text>
        </View>
      </View>

      {/* SECTION B: Sensor Diagnostics (DHT11) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🌡️</Text>
          <Text style={styles.sectionTitle}>SENSOR DIAGNOSTICS</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Sensor Hardware</Text>
            <Text style={styles.itemValue}>DHT11 Digital</Text>
            <Text style={styles.itemSub}>Single-Bus Digital (Pin D5)</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Sensor Health</Text>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor:
                    dataMode === 'device'
                      ? liveData?.sensorStatus === 'OK'
                        ? colors.emeraldMuted
                        : colors.crimsonMuted
                      : mockState.device.sensorHealth === 'healthy'
                      ? colors.emeraldMuted
                      : colors.crimsonMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color:
                      dataMode === 'device'
                        ? liveData?.sensorStatus === 'OK'
                          ? colors.emeraldGlow
                          : colors.crimsonGlow
                        : mockState.device.sensorHealth === 'healthy'
                        ? colors.emeraldGlow
                        : colors.crimsonGlow,
                  },
                ]}
              >
                {dataMode === 'device'
                  ? liveData?.sensorStatus ?? 'UNKNOWN'
                  : mockState.device.sensorHealth.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Temperature Status</Text>
            <Text style={[styles.itemValue, { color: colors.amberGlow }]}>
              {dataMode === 'device'
                ? liveData
                  ? liveData.temperature !== null
                    ? `Valid (${liveData.temperature}°C)`
                    : 'Fault / Null'
                  : 'Awaiting Reading'
                : mockState.device.tempReadingStatus}
            </Text>
            <Text style={styles.itemSub}>
              {dataMode === 'device' ? 'HTTP /api/status' : 'Simulated Value'}
            </Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Humidity Status</Text>
            <Text style={[styles.itemValue, { color: colors.cyanGlow }]}>
              {dataMode === 'device'
                ? liveData
                  ? liveData.humidity !== null
                    ? `Valid (${liveData.humidity}%)`
                    : 'Fault / Null'
                  : 'Awaiting Reading'
                : mockState.device.humidityReadingStatus}
            </Text>
            <Text style={styles.itemSub}>
              {dataMode === 'device' ? 'HTTP /api/status' : 'Simulated Value'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerNote}>
            Payload validation:{' '}
            <Text style={styles.footerHighlight}>
              {dataMode === 'device'
                ? liveData
                  ? 'Valid JSON Schema ✓'
                  : 'No Valid Response'
                : 'Simulated Packet'}
            </Text>
          </Text>
        </View>
      </View>

      {/* SECTION C: Actuator Status (Read-Only) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>⚡</Text>
          <Text style={styles.sectionTitle}>ACTUATOR STATUS (READ-ONLY)</Text>
        </View>
        <Text style={styles.readOnlyNotice}>
          Diagnostics view only. In Device Mode, relay decisions are executed exclusively by the ESP8266 firmware.
        </Text>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Bulb Relay (Relay 1)</Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: (dataMode === 'device' ? liveData?.bulbOn : mockState.actuators.bulbRelay)
                    ? colors.amberMuted
                    : 'rgba(100, 116, 139, 0.1)',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: (dataMode === 'device' ? liveData?.bulbOn : mockState.actuators.bulbRelay)
                      ? colors.amberGlow
                      : colors.textMuted,
                  },
                ]}
              >
                {(dataMode === 'device' ? liveData?.bulbOn : mockState.actuators.bulbRelay)
                  ? '🔥 ON (HEATING)'
                  : 'STANDBY (OFF)'}
              </Text>
            </View>
            <Text style={styles.itemSub}>GPIO Pin D7 (Active LOW)</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Fan Relay</Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: 'rgba(100, 116, 139, 0.1)',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                {dataMode === 'device' ? 'NOT INSTALLED' : (mockState.actuators.fanRelay ? '🌀 ON' : 'IDLE')}
              </Text>
            </View>
            <Text style={styles.itemSub}>
              {dataMode === 'device' ? 'No fan wired on ESP8266' : 'Simulated state'}
            </Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Safety Buzzer</Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: (dataMode === 'device' ? liveData?.buzzerOn : mockState.actuators.buzzerActive)
                    ? colors.crimsonMuted
                    : 'rgba(100, 116, 139, 0.1)',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: (dataMode === 'device' ? liveData?.buzzerOn : mockState.actuators.buzzerActive)
                      ? colors.crimsonGlow
                      : colors.textMuted,
                  },
                ]}
              >
                {(dataMode === 'device' ? liveData?.buzzerOn : mockState.actuators.buzzerActive)
                  ? '🔔 ACTIVE ALERT'
                  : 'MUTED (OFF)'}
              </Text>
            </View>
            <Text style={styles.itemSub}>GPIO Pin D6 (Active HIGH)</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>OLED Display (0.96")</Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    dataMode === 'device'
                      ? 'rgba(100, 116, 139, 0.1)'
                      : colors.emeraldMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: dataMode === 'device' ? colors.textMuted : colors.emeraldGlow,
                  },
                ]}
              >
                {dataMode === 'device' ? 'Not in /api/status' : '📟 AVAILABLE'}
              </Text>
            </View>
            <Text style={styles.itemSub}>I2C Bus (D2/SDA, D1/SCL)</Text>
          </View>
        </View>
      </View>

      {/* SECTION D: Runtime Diagnostics */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>⏱️</Text>
          <Text style={styles.sectionTitle}>RUNTIME DIAGNOSTICS</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>System Uptime</Text>
            <Text style={styles.itemValue}>
              {dataMode === 'device'
                ? 'Not in /api/status'
                : formatUptime(mockState.device.uptimeSeconds)}
            </Text>
            <Text style={styles.itemSub}>
              {dataMode === 'device' ? 'Firmware pending' : 'Simulated counter'}
            </Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Sensor Sampling Rate</Text>
            <Text style={[styles.itemValue, styles.mono]}>
              {dataMode === 'device' ? '2,000 ms' : `${mockState.device.samplingIntervalMs} ms`}
            </Text>
            <Text style={styles.itemSub}>
              {dataMode === 'device' ? 'Client polling rate' : 'Simulated rate'}
            </Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Bulb Activations</Text>
            <Text style={styles.itemValue}>
              {dataMode === 'device'
                ? 'Not in /api/status'
                : `${mockState.device.totalBulbActivations} cycles`}
            </Text>
            <Text style={styles.itemSub}>
              {dataMode === 'device' ? 'Firmware pending' : 'Simulated cycles'}
            </Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Fan Activations</Text>
            <Text style={styles.itemValue}>
              {dataMode === 'device'
                ? 'Not in /api/status'
                : `${mockState.device.totalFanActivations} cycles`}
            </Text>
            <Text style={styles.itemSub}>
              {dataMode === 'device' ? 'Firmware pending' : 'Simulated cycles'}
            </Text>
          </View>
        </View>
      </View>

      {/* Simulation Selector in Mock Mode or Device Mode Explanation */}
      {dataMode === 'mock' ? (
        <StateSimulationSelector
          currentScenario={scenario}
          onSelectScenario={setScenario}
        />
      ) : (
        <View style={styles.deviceModeNotice}>
          <Text style={styles.deviceModeNoticeTitle}>📡 Live Device Mode Active</Text>
          <Text style={styles.deviceModeNoticeBody}>
            Diagnostics reflect live responses from {deviceConfig.getBaseUrl()}/api/status. Simulation scenario toggles are disabled in Device Mode. Switch to Mock Mode to preview simulated fault states.
          </Text>
          {onOpenConfigModal && (
            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={onOpenConfigModal}
              activeOpacity={0.7}
            >
              <Text style={styles.switchModeButtonText}>Switch to Mock Mode 🧪</Text>
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
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.amberGlow,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mockBanner: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
    alignItems: 'center',
  },
  mockBannerStyle: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  deviceBanner: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  mockBannerIcon: {
    fontSize: 18,
  },
  mockBannerTextContainer: {
    flex: 1,
  },
  mockBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mockBannerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  editConfigButton: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editConfigButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  healthCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  healthIcon: {
    fontSize: 24,
  },
  healthTitleContainer: {
    flex: 1,
  },
  healthSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  healthTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  healthDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  readOnlyNotice: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '47.5%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
  },
  mono: {
    fontFamily: 'monospace',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
    marginTop: 2,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 2,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerNote: {
    fontSize: 11,
    color: colors.textMuted,
  },
  footerHighlight: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  deviceModeNotice: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  deviceModeNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.cyanGlow,
    marginBottom: 4,
  },
  deviceModeNoticeBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
  },
  switchModeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.amberGlow,
  },
  switchModeButtonText: {
    fontSize: 12,
    color: colors.amberGlow,
    fontWeight: '700',
  },
});
