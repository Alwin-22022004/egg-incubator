import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { ConnectionState } from '../types/incubator';

export type AppScreen = 'dashboard' | 'temperatureSettings' | 'deviceStatus';

interface HeaderProps {
  connection: ConnectionState;
  chipModel: string;
  lastSync: string;
  currentScreen?: AppScreen;
  onNavigate?: (screen: AppScreen) => void;
  onOpenSettings?: () => void;
  onBackToDashboard?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenConfigModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connection,
  chipModel,
  lastSync,
  currentScreen = 'dashboard',
  onNavigate,
  onOpenSettings,
  onBackToDashboard,
  onOpenDiagnostics,
  onOpenConfigModal,
}) => {
  const getBadgeStyle = () => {
    switch (connection) {
      case 'connected':
        return { bg: colors.emeraldMuted, text: colors.emeraldGlow, label: 'ONLINE' };
      case 'connecting':
        return { bg: colors.cyanMuted, text: colors.cyanGlow, label: 'SYNCING' };
      case 'error':
        return { bg: colors.crimsonMuted, text: colors.crimsonGlow, label: 'FAULT' };
      case 'disconnected':
      default:
        return { bg: 'rgba(100, 116, 139, 0.2)', text: colors.textMuted, label: 'OFFLINE' };
    }
  };

  const badge = getBadgeStyle();

  const handleNav = (screen: AppScreen) => {
    if (onNavigate) {
      onNavigate(screen);
    } else {
      if (screen === 'dashboard' && onBackToDashboard) onBackToDashboard();
      if (screen === 'temperatureSettings' && onOpenSettings) onOpenSettings();
      if (screen === 'deviceStatus' && onOpenDiagnostics) onOpenDiagnostics();
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Branding Row */}
      <View style={styles.topRow}>
        <View style={styles.leftColumn}>
          <View style={styles.titleRow}>
            <Text style={styles.eggEmoji}>🥚</Text>
            <Text style={styles.title}>Egg Incubator</Text>
          </View>
          <Text style={styles.subtitle}>{chipModel} • {lastSync}</Text>
        </View>

        <View style={styles.badgeGroup}>
          {onOpenConfigModal && (
            <TouchableOpacity
              style={styles.ipConfigBadge}
              onPress={onOpenConfigModal}
              activeOpacity={0.7}
            >
              <Text style={styles.ipBadgeIcon}>📡</Text>
              <Text style={styles.ipBadgeText}>IP CONFIG</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <View style={[styles.dot, { backgroundColor: badge.text }]} />
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>
      </View>

      {/* Navigation Segmented Tab Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navTab, currentScreen === 'dashboard' && styles.navTabActive]}
          onPress={() => handleNav('dashboard')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.navTabText,
              currentScreen === 'dashboard' && styles.navTabTextActive,
            ]}
          >
            📊 Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, currentScreen === 'temperatureSettings' && styles.navTabActive]}
          onPress={() => handleNav('temperatureSettings')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.navTabText,
              currentScreen === 'temperatureSettings' && styles.navTabTextActive,
            ]}
          >
            ⚙️ Thresholds
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, currentScreen === 'deviceStatus' && styles.navTabActive]}
          onPress={() => handleNav('deviceStatus')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.navTabText,
              currentScreen === 'deviceStatus' && styles.navTabTextActive,
            ]}
          >
            🩺 Diagnostics
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  leftColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eggEmoji: {
    fontSize: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ipConfigBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    gap: 4,
  },
  ipBadgeIcon: {
    fontSize: 11,
  },
  ipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.cyanGlow,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  navTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  navTabActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  navTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  navTabTextActive: {
    color: colors.amberGlow,
    fontWeight: '700',
  },
});
