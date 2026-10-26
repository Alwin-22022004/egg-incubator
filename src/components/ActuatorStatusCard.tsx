import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { ActuatorState, ConnectionState } from '../types/incubator';

interface ActuatorStatusCardProps {
  actuators: ActuatorState;
  connection: ConnectionState;
}

export const ActuatorStatusCard: React.FC<ActuatorStatusCardProps> = React.memo(({
  actuators,
  connection,
}) => {
  const isConnected = connection === 'connected';

  const items = [
    {
      id: 'bulb',
      name: 'Heating Bulb',
      hardware: 'Relay 1 (D1)',
      active: isConnected ? actuators.bulbRelay : false,
      activeLabel: 'HEATING ON',
      inactiveLabel: 'STANDBY',
      activeColor: colors.amberGlow,
      activeBg: colors.amberMuted,
      icon: '🔥',
    },
    {
      id: 'fan',
      name: 'Circulation Fan',
      hardware: actuators.fanRelay === null ? 'Not wired on ESP8266' : 'Relay 2 (Optional)',
      isUnavailable: actuators.fanRelay === null,
      active: isConnected && actuators.fanRelay === true,
      activeLabel: 'RUNNING',
      inactiveLabel: actuators.fanRelay === null ? 'UNAVAILABLE' : 'IDLE',
      activeColor: colors.cyanGlow,
      activeBg: colors.cyanMuted,
      icon: '🌀',
    },
    {
      id: 'buzzer',
      name: 'Alarm Buzzer',
      hardware: 'Buzzer (Pin D6)',
      isUnavailable: false,
      active: isConnected ? actuators.buzzerActive : false,
      activeLabel: 'ALERTING',
      inactiveLabel: 'MUTED',
      activeColor: colors.crimsonGlow,
      activeBg: colors.crimsonMuted,
      icon: '🔔',
    },
    {
      id: 'oled',
      name: 'OLED Display',
      hardware: 'I2C (D2/SDA, D1/SCL)',
      isUnavailable: false,
      active: isConnected ? actuators.oledDisplayActive : false,
      activeLabel: 'LIVE (0x3C)',
      inactiveLabel: 'SLEEP',
      activeColor: colors.emeraldGlow,
      activeBg: colors.emeraldMuted,
      icon: '📟',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>HARDWARE ACTUATORS & RELAYS</Text>

      <View style={styles.grid}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.tile,
              item.active && { borderColor: item.activeColor },
            ]}
          >
            <View style={styles.tileHeader}>
              <Text style={styles.tileIcon}>{item.icon}</Text>
              <View
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: item.active
                      ? item.activeBg
                      : 'rgba(100, 116, 139, 0.1)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: item.active
                        ? item.activeColor
                        : colors.textMuted,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: item.active
                        ? item.activeColor
                        : colors.textMuted,
                    },
                  ]}
                >
                  {item.active ? item.activeLabel : item.inactiveLabel}
                </Text>
              </View>
            </View>

            <Text style={styles.tileName}>{item.name}</Text>
            <Text style={styles.hardwarePin}>{item.hardware}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tileIcon: {
    fontSize: 20,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  tileName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  hardwarePin: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
});
