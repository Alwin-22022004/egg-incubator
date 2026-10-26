import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { IncubatorProgress } from '../types/incubator';

interface IncubationProgressCardProps {
  progress: IncubatorProgress;
}

export const IncubationProgressCard: React.FC<IncubationProgressCardProps> = React.memo(({
  progress,
}) => {
  const percent = Math.min(
    Math.max((progress.currentDay / progress.totalDays) * 100, 0),
    100
  );
  const daysLeft = Math.max(progress.totalDays - progress.currentDay, 0);
  const isLockdown = progress.currentDay >= progress.lockdownDay;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.cycleTitle}>{progress.cycleName}</Text>
          <Text style={styles.cycleSubtitle}>
            Day {progress.currentDay} of {progress.totalDays} • {daysLeft} days to hatch
          </Text>
        </View>
        <View
          style={[
            styles.phaseBadge,
            {
              backgroundColor: isLockdown ? colors.crimsonMuted : colors.amberMuted,
            },
          ]}
        >
          <Text
            style={[
              styles.phaseText,
              { color: isLockdown ? colors.crimsonGlow : colors.amberGlow },
            ]}
          >
            {isLockdown ? 'LOCKDOWN' : 'INCUBATION'}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>

      {/* Milestones */}
      <View style={styles.milestonesRow}>
        <Text style={styles.milestoneLabel}>Day 1 (Set)</Text>
        <Text style={styles.milestoneLabel}>Day 18 (Lockdown)</Text>
        <Text style={styles.milestoneLabel}>Day 21 (Hatch)</Text>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.footerItem}>
          <Text style={styles.footerIcon}>🔄</Text>
          <Text style={styles.footerText}>
            Auto-Turning:{' '}
            <Text style={{ color: progress.eggTurningActive ? colors.emeraldGlow : colors.textMuted }}>
              {progress.eggTurningActive ? 'Active (Every 2h)' : 'Stopped (Lockdown)'}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cycleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cycleSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  phaseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  phaseText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.amberGlow,
    borderRadius: 4,
  },
  milestonesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  milestoneLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerIcon: {
    fontSize: 14,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
