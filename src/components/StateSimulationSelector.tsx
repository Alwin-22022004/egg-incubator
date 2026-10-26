import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '../theme/colors';

export type SimulatedScenario = 'normal' | 'overheat' | 'loading' | 'disconnected' | 'sensor_error';

interface StateSimulationSelectorProps {
  currentScenario: SimulatedScenario;
  onSelectScenario: (scenario: SimulatedScenario) => void;
}

export const StateSimulationSelector: React.FC<StateSimulationSelectorProps> = ({
  currentScenario,
  onSelectScenario,
}) => {
  const scenarios: { id: SimulatedScenario; label: string; icon: string; color: string }[] = [
    { id: 'normal', label: 'Normal (37.6°C)', icon: '🟢', color: colors.emeraldGlow },
    { id: 'overheat', label: 'Overheat Alert', icon: '🔥', color: colors.crimsonGlow },
    { id: 'loading', label: 'Connecting...', icon: '🔄', color: colors.cyanGlow },
    { id: 'disconnected', label: 'Offline / Disconnected', icon: '📡', color: colors.textMuted },
    { id: 'sensor_error', label: 'DHT11 Sensor Fault', icon: '⚠️', color: colors.crimsonGlow },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>SIMULATION CONTROLS (STAGE 1 TESTING)</Text>
      </View>
      <Text style={styles.hint}>
        Tap below to preview how the monitor handles each IoT device state:
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {scenarios.map((s) => {
          const isSelected = currentScenario === s.id;
          return (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.button,
                isSelected && {
                  backgroundColor: `${s.color}20`,
                  borderColor: s.color,
                },
              ]}
              onPress={() => onSelectScenario(s.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonIcon}>{s.icon}</Text>
              <Text
                style={[
                  styles.buttonText,
                  isSelected && { color: s.color, fontWeight: '700' },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 10,
  },
  scrollList: {
    gap: 8,
    paddingVertical: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  buttonIcon: {
    fontSize: 14,
  },
  buttonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
