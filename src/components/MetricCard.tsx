import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { ConnectionState } from '../types/incubator';

interface MetricCardProps {
  label: string;
  icon: string;
  value: number | null;
  unit: string;
  target: number;
  tolerance: number;
  minSafe: number;
  maxSafe: number;
  connection: ConnectionState;
  accentColor: string;
}

export const MetricCard: React.FC<MetricCardProps> = React.memo(({
  label,
  icon,
  value,
  unit,
  target,
  tolerance,
  minSafe,
  maxSafe,
  connection,
  accentColor,
}) => {
  const hasValidValue = value !== null && !isNaN(value) && value > -50;
  const isAvailable = connection === 'connected' && hasValidValue;
  const isConnecting = connection === 'connecting';

  // Compute status
  let statusText = 'Optimal';
  let statusColor = colors.emeraldGlow;

  if (!isAvailable) {
    if (isConnecting && !hasValidValue) {
      statusText = 'Reading...';
      statusColor = colors.cyanGlow;
    } else if (connection === 'error' || value === null) {
      statusText = 'Fault / Null';
      statusColor = colors.crimsonGlow;
    } else {
      statusText = 'Cached';
      statusColor = colors.textMuted;
    }
  } else if (value !== null && value > maxSafe) {
    statusText = 'High Alert';
    statusColor = colors.crimsonGlow;
  } else if (value !== null && value < minSafe) {
    statusText = 'Low Alert';
    statusColor = colors.amberGlow;
  }

  // Calculate percentage within visualization range
  const span = Math.max(maxSafe - minSafe + tolerance * 2, 1);
  const offset = hasValidValue && value !== null ? Math.min(Math.max(value - (minSafe - tolerance), 0), span) : span / 2;
  const progressPercent = Math.min(Math.max((offset / span) * 100, 5), 95);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.labelContainer}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: isAvailable ? colors.textPrimary : colors.textMuted }]}>
          {hasValidValue && value !== null ? value.toFixed(1) : '--.-'}
        </Text>
        <Text style={[styles.unit, { color: accentColor }]}>{unit}</Text>
      </View>

      {/* Target and tolerance row */}
      <View style={styles.targetRow}>
        <Text style={styles.targetText}>
          Target: <Text style={styles.targetHighlight}>{target.toFixed(1)}{unit}</Text>
        </Text>
        <Text style={styles.toleranceText}>
          Safe: {minSafe.toFixed(1)} - {maxSafe.toFixed(1)}{unit}
        </Text>
      </View>

      {/* Gauge bar */}
      <View style={styles.gaugeContainer}>
        <View style={styles.gaugeBackground}>
          <View style={[styles.gaugeSafeZone, { left: '20%', width: '60%' }]} />
          {hasValidValue && (
            <View
              style={[
                styles.gaugeCursor,
                {
                  left: `${progressPercent}%`,
                  backgroundColor: isAvailable ? accentColor : colors.textMuted,
                },
              ]}
            />
          )}
        </View>
        <View style={styles.gaugeLabels}>
          <Text style={styles.gaugeMin}>{minSafe.toFixed(0)}{unit}</Text>
          <Text style={styles.gaugeCenter}>{target.toFixed(1)}{unit}</Text>
          <Text style={styles.gaugeMax}>{maxSafe.toFixed(0)}{unit}</Text>
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
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  value: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  unit: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 6,
  },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  targetText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  targetHighlight: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  toleranceText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  gaugeContainer: {
    marginTop: 2,
  },
  gaugeBackground: {
    height: 8,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  gaugeSafeZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 4,
  },
  gaugeCursor: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 6,
    borderRadius: 3,
    marginLeft: -3,
    elevation: 3,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  gaugeMin: {
    fontSize: 10,
    color: colors.textMuted,
  },
  gaugeCenter: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  gaugeMax: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
