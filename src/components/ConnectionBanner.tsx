import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { ConnectionState, IncubatorHealthStatus } from '../types/incubator';

interface ConnectionBannerProps {
  connection: ConnectionState;
  health: IncubatorHealthStatus;
  errorMessage?: string;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = React.memo(({
  connection,
  health,
  errorMessage,
}) => {
  if (connection === 'connected' && health === 'optimal') {
    return null;
  }

  if (connection === 'connecting') {
    return (
      <View style={[styles.container, styles.connectingBanner]}>
        <ActivityIndicator size="small" color={colors.cyanGlow} />
        <View style={styles.textWrap}>
          <Text style={styles.connectingTitle}>Connecting to ESP8266...</Text>
          <Text style={styles.connectingSubtitle}>Negotiating handshake on local network</Text>
        </View>
      </View>
    );
  }

  if (connection === 'error' || health === 'critical') {
    return (
      <View style={[styles.container, styles.errorBanner]}>
        <Text style={styles.icon}>⚠️</Text>
        <View style={styles.textWrap}>
          <Text style={styles.errorTitle}>Hardware Warning / Alert</Text>
          <Text style={styles.errorSubtitle}>
            {errorMessage || 'Critical threshold reached or DHT11 sensor read failed.'}
          </Text>
        </View>
      </View>
    );
  }

  if (connection === 'disconnected') {
    return (
      <View style={[styles.container, styles.disconnectedBanner]}>
        <Text style={styles.icon}>📡</Text>
        <View style={styles.textWrap}>
          <Text style={styles.disconnectedTitle}>Incubator Offline</Text>
          <Text style={styles.disconnectedSubtitle}>
            {errorMessage || 'Displaying last cached reading. Relays in failsafe mode.'}
          </Text>
        </View>
      </View>
    );
  }

  if (health === 'warning') {
    return (
      <View style={[styles.container, styles.warningBanner]}>
        <Text style={styles.icon}>⚡</Text>
        <View style={styles.textWrap}>
          <Text style={styles.warningTitle}>Environment Alert</Text>
          <Text style={styles.warningSubtitle}>
            {errorMessage || 'Temperature or humidity is drifting from target window.'}
          </Text>
        </View>
      </View>
    );
  }

  return null;
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  textWrap: {
    flex: 1,
  },
  icon: {
    fontSize: 20,
  },
  connectingBanner: {
    backgroundColor: colors.cyanMuted,
    borderColor: colors.cyanGlow,
  },
  connectingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.cyanGlow,
  },
  connectingSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: colors.crimsonMuted,
    borderColor: colors.crimsonGlow,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.crimsonGlow,
  },
  errorSubtitle: {
    fontSize: 12,
    color: '#FCA5A5',
    marginTop: 2,
    lineHeight: 16,
  },
  disconnectedBanner: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderLight,
  },
  disconnectedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  disconnectedSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  warningBanner: {
    backgroundColor: colors.amberMuted,
    borderColor: colors.amberGlow,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.amberGlow,
  },
  warningSubtitle: {
    fontSize: 12,
    color: '#FDE68A',
    marginTop: 2,
    lineHeight: 16,
  },
});
