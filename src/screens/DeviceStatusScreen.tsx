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
import { ConnectionState } from '../types/incubator';
import { DeviceStatusResponse } from '../types/api';
import { esp8266Api } from '../services/esp8266Api';
import { deviceConfig } from '../services/deviceConfig';

interface DeviceStatusScreenProps {
  onBackToDashboard: () => void;
  onOpenSettings?: () => void;
  onOpenConfigModal?: () => void;
}

export const DeviceStatusScreen: React.FC<DeviceStatusScreenProps> = ({
  onBackToDashboard,
  onOpenSettings,
  onOpenConfigModal,
}) => {
  const [liveData, setLiveData] = useState<DeviceStatusResponse | null>(null);
  const [liveConnState, setLiveConnState] = useState<ConnectionState>('connecting');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>('Never');
  const [refreshing, setRefreshing] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const isMountedRef = useRef(true);

  const fetchLiveDiagnostics = async () => {
    if (!isMountedRef.current) return;

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
      setLatencyMs(result.latencyMs ?? null);
    } else {
      setLiveConnState('disconnected');
      setLiveError(result.error);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchLiveDiagnostics();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLiveDiagnostics();
    setRefreshing(false);
  };

  const handleManualPing = async () => {
    setIsPinging(true);
    await fetchLiveDiagnostics();
    setIsPinging(false);
  };

  const getOverallHealth = () => {
    if (liveConnState === 'connecting') {
      return {
        label: 'CONNECTING...',
        color: colors.cyanGlow,
        bg: colors.cyanMuted,
        desc: `Polling ${deviceConfig.getBaseUrl()}/api/status...`,
        icon: '🔄',
      };
    }
    if (liveConnState === 'disconnected') {
      return {
        label: 'DEVICE UNREACHABLE',
        color: colors.crimsonGlow,
        bg: colors.crimsonMuted,
        desc: liveError || 'No response from ESP8266.',
        icon: '⚠️',
      };
    }
    if (liveData?.sensorStatus !== 'OK') {
      return {
        label: `SENSOR ALERT (${liveData?.sensorStatus ?? 'FAULT'})`,
        color: colors.amberGlow,
        bg: colors.amberMuted,
        desc: 'DHT11 sensor reported fault. Relay heating is disabled for safety.',
        icon: '⚡',
      };
    }
    return {
      label: 'SYSTEM HEALTHY',
      color: colors.emeraldGlow,
      bg: colors.emeraldMuted,
      desc: `Live telemetry link established with ${deviceConfig.getBaseUrl()}`,
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
      {/* Top Header Row */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackToDashboard}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>ESP8266 Diagnostics</Text>
      </View>

      {/* Primary Link Health Hero Banner */}
      <View style={[styles.heroCard, { backgroundColor: overall.bg, borderColor: overall.color }]}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroIcon}>{overall.icon}</Text>
          <View style={styles.heroTitleWrap}>
            <Text style={[styles.heroTitle, { color: overall.color }]}>
              {overall.label}
            </Text>
            <Text style={styles.heroSub}>{overall.desc}</Text>
          </View>
        </View>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>TARGET IP</Text>
            <Text style={styles.metaValue}>{deviceConfig.getBaseUrl()}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>PING LATENCY</Text>
            <Text style={styles.metaValue}>
              {latencyMs !== null ? `${latencyMs} ms` : '—'}
            </Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>LAST PROBE</Text>
            <Text style={styles.metaValue}>{lastCheckTime}</Text>
          </View>
        </View>
      </View>

      {/* Network & Device Info Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>📡</Text>
          <Text style={styles.sectionTitle}>NETWORK & FIRMWARE</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Hardware Model</Text>
            <Text style={styles.itemValue}>ESP8266 NodeMCU</Text>
            <Text style={styles.itemSub}>ESP-12E Wi-Fi SoC</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>HTTP API State</Text>
            <View style={[styles.chip, { backgroundColor: overall.bg }]}>
              <Text style={[styles.chipText, { color: overall.color }]}>
                {liveConnState.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Device Base URL</Text>
            <Text style={[styles.itemValue, styles.mono]}>
              {deviceConfig.getBaseUrl()}
            </Text>
            <Text style={styles.itemSub}>Port 80 HTTP Server</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Local Subnet</Text>
            <Text style={styles.itemValue}>2.4 GHz Wi-Fi</Text>
            <Text style={styles.itemSub}>Same router required</Text>
          </View>
        </View>
      </View>

      {/* Sensor Diagnostics (DHT11) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🌡️</Text>
          <Text style={styles.sectionTitle}>DHT11 SENSOR DIAGNOSTICS</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Sensor Hardware</Text>
            <Text style={styles.itemValue}>DHT11 Digital</Text>
            <Text style={styles.itemSub}>Single-Bus Digital (Pin D5)</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Sensor Status</Text>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor:
                    liveData?.sensorStatus === 'OK'
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
                      liveData?.sensorStatus === 'OK'
                        ? colors.emeraldGlow
                        : colors.crimsonGlow,
                  },
                ]}
              >
                {liveData?.sensorStatus ?? 'UNKNOWN'}
              </Text>
            </View>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Temperature Reading</Text>
            <Text style={[styles.itemValue, { color: colors.amberGlow }]}>
              {liveData?.temperature !== null && liveData?.temperature !== undefined
                ? `${liveData.temperature}°C`
                : 'Fault / Null'}
            </Text>
            <Text style={styles.itemSub}>Parsed from /api/status</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Humidity Reading</Text>
            <Text style={[styles.itemValue, { color: colors.cyanGlow }]}>
              {liveData?.humidity !== null && liveData?.humidity !== undefined
                ? `${liveData.humidity}%`
                : 'Fault / Null'}
            </Text>
            <Text style={styles.itemSub}>Parsed from /api/status</Text>
          </View>
        </View>
      </View>

      {/* Actuator & Output Diagnostics */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>⚡</Text>
          <Text style={styles.sectionTitle}>ACTUATORS & RELAYS</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Bulb Relay (D7)</Text>
            <Text
              style={[
                styles.itemValue,
                { color: liveData?.bulbOn ? colors.amberGlow : colors.textMuted },
              ]}
            >
              {liveData?.bulbOn ? 'ENERGIZED (HEATING)' : 'OFF (STANDBY)'}
            </Text>
            <Text style={styles.itemSub}>Active-LOW Relay Pin D7</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Buzzer (D6)</Text>
            <Text
              style={[
                styles.itemValue,
                { color: liveData?.buzzerOn ? colors.crimsonGlow : colors.textMuted },
              ]}
            >
              {liveData?.buzzerOn ? 'ALERTING' : 'MUTED'}
            </Text>
            <Text style={styles.itemSub}>Active-HIGH Pin D6</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Circulation Fan</Text>
            <Text style={[styles.itemValue, { color: colors.textMuted }]}>
              {liveData?.fanOn === null ? 'Not Installed' : liveData?.fanOn ? 'ON' : 'OFF'}
            </Text>
            <Text style={styles.itemSub}>API reports null</Text>
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>OLED Display</Text>
            <Text style={[styles.itemValue, { color: colors.emeraldGlow }]}>
              {liveConnState === 'connected' ? 'SSD1306 (0x3C)' : 'Offline'}
            </Text>
            <Text style={styles.itemSub}>I2C Pins D1/D2</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.probeButton}
          onPress={handleManualPing}
          disabled={isPinging}
          activeOpacity={0.7}
        >
          {isPinging ? (
            <ActivityIndicator size="small" color={colors.cyanGlow} />
          ) : (
            <Text style={styles.probeButtonText}>Probe Connection Now ⚡</Text>
          )}
        </TouchableOpacity>

        {onOpenConfigModal && (
          <TouchableOpacity
            style={styles.ipButton}
            onPress={onOpenConfigModal}
            activeOpacity={0.7}
          >
            <Text style={styles.ipButtonText}>Change ESP8266 IP ✏️</Text>
          </TouchableOpacity>
        )}

        {onOpenSettings && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={onOpenSettings}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsButtonText}>Configure Thresholds ⚙️</Text>
          </TouchableOpacity>
        )}
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
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  heroCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  heroIcon: {
    fontSize: 28,
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  metaItem: {
    alignItems: 'center',
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  metaDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '47%',
  },
  itemLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  itemValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  mono: {
    fontFamily: 'monospace',
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 10,
  },
  probeButton: {
    backgroundColor: colors.surfaceSubtle,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.cyanGlow,
  },
  probeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.cyanGlow,
  },
  ipButton: {
    backgroundColor: colors.surfaceElevated,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ipButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  settingsButton: {
    backgroundColor: colors.surfaceElevated,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.amberGlow,
  },
});
