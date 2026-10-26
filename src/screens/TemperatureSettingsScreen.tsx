import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { TemperatureSettings, DEFAULT_TEMPERATURE_SETTINGS } from '../types/incubator';
import { esp8266Api } from '../services/esp8266Api';
import { deviceConfig } from '../services/deviceConfig';

interface TemperatureSettingsScreenProps {
  currentSettings: TemperatureSettings;
  onSaveSettings: (settings: TemperatureSettings) => void;
  onClose: () => void;
}

export const TemperatureSettingsScreen: React.FC<TemperatureSettingsScreenProps> = ({
  currentSettings,
  onSaveSettings,
  onClose,
}) => {
  const [onInput, setOnInput] = useState<string>(
    currentSettings.bulbOnThreshold.toString()
  );
  const [offInput, setOffInput] = useState<string>(
    currentSettings.bulbOffThreshold.toString()
  );

  const [onFocused, setOnFocused] = useState(false);
  const [offFocused, setOffFocused] = useState(false);

  const [onErrorMessage, setOnErrorMessage] = useState<string | null>(null);
  const [offErrorMessage, setOffErrorMessage] = useState<string | null>(null);
  const [generalErrorMessage, setGeneralErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Fetch live configuration from ESP8266 via GET /api/config on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingConfig(true);
    setDeviceNotice('Fetching current configuration from ESP8266 (/api/config)...');

    esp8266Api
      .getConfig()
      .then((result) => {
        if (!isMounted) return;
        setIsLoadingConfig(false);
        if (result.success) {
          setOnInput(result.data.bulbOnThreshold.toString());
          setOffInput(result.data.bulbOffThreshold.toString());
          setDeviceNotice(
            `Live thresholds loaded from ${deviceConfig.getBaseUrl()}: ON ${result.data.bulbOnThreshold}°C / OFF ${result.data.bulbOffThreshold}°C`
          );
        } else {
          setDeviceNotice(
            `Device unreachable at ${deviceConfig.getBaseUrl()}. Showing current cached thresholds.`
          );
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoadingConfig(false);
          setDeviceNotice('Failed to communicate with device. Showing current cached thresholds.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const validate = (): { onNum: number; offNum: number } | null => {
    setOnErrorMessage(null);
    setOffErrorMessage(null);
    setGeneralErrorMessage(null);

    const trimmedOn = onInput.trim();
    const trimmedOff = offInput.trim();

    let hasError = false;

    // Validate Bulb ON
    if (!trimmedOn) {
      setOnErrorMessage('Bulb ON threshold cannot be empty.');
      hasError = true;
    }
    const onNum = parseFloat(trimmedOn);
    if (isNaN(onNum)) {
      setOnErrorMessage('Enter a valid numeric value (e.g. 36.0).');
      hasError = true;
    } else if (onNum < 20 || onNum > 45) {
      setOnErrorMessage('Value must be between 20.0°C and 45.0°C.');
      hasError = true;
    }

    // Validate Bulb OFF
    if (!trimmedOff) {
      setOffErrorMessage('Bulb OFF threshold cannot be empty.');
      hasError = true;
    }
    const offNum = parseFloat(trimmedOff);
    if (isNaN(offNum)) {
      setOffErrorMessage('Enter a valid numeric value (e.g. 38.0).');
      hasError = true;
    } else if (offNum < 20 || offNum > 45) {
      setOffErrorMessage('Value must be between 20.0°C and 45.0°C.');
      hasError = true;
    }

    if (hasError) {
      return null;
    }

    // Comparative validation (ON must be lower than OFF)
    if (onNum >= offNum) {
      setGeneralErrorMessage(
        `Invalid Hysteresis: Bulb ON threshold (${onNum.toFixed(1)}°C) must be lower than Bulb OFF threshold (${offNum.toFixed(1)}°C).`
      );
      return null;
    }

    if (offNum - onNum < 0.2) {
      setGeneralErrorMessage(
        'Difference between thresholds must be at least 0.2°C to prevent rapid relay switching.'
      );
      return null;
    }

    return { onNum, offNum };
  };

  const handleSave = async () => {
    if (isSaving) return;
    setSuccessMessage(null);
    setGeneralErrorMessage(null);

    const validResult = validate();
    if (!validResult) {
      return;
    }

    setIsSaving(true);
    const now = new Date();
    const timestamp = now.toLocaleTimeString();

    // POST /api/config to ESP8266
    try {
      const response = await esp8266Api.postConfig({
        bulbOnThreshold: validResult.onNum,
        bulbOffThreshold: validResult.offNum,
      });

      setIsSaving(false);

      if (response.success) {
        const updated: TemperatureSettings = {
          bulbOnThreshold: response.data.bulbOnThreshold,
          bulbOffThreshold: response.data.bulbOffThreshold,
          lastUpdated: `Saved to ESP8266 at ${timestamp}`,
        };
        onSaveSettings(updated);
        setSuccessMessage(
          `Successfully updated ESP8266 thresholds via POST /api/config! (${response.data.bulbOnThreshold}°C / ${response.data.bulbOffThreshold}°C)`
        );
      } else {
        // Keep user's entered values intact when saving fails
        setGeneralErrorMessage(
          `Failed to save to ESP8266: ${response.error}\nYour entered values have been retained. Ensure your phone and the ESP8266 are on the same Wi-Fi.`
        );
      }
    } catch (err: unknown) {
      setIsSaving(false);
      setGeneralErrorMessage(
        `Network error: ${err instanceof Error ? err.message : 'Unknown'}. Entered values are preserved.`
      );
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset Thresholds to Defaults?',
      'This will restore factory recommended values:\n• Bulb ON: 36.0°C\n• Bulb OFF: 38.0°C',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setOnInput(DEFAULT_TEMPERATURE_SETTINGS.bulbOnThreshold.toString());
            setOffInput(DEFAULT_TEMPERATURE_SETTINGS.bulbOffThreshold.toString());
            setOnErrorMessage(null);
            setOffErrorMessage(null);
            setGeneralErrorMessage(null);
            setSuccessMessage('Defaults restored in form. Tap "Save to ESP8266" to upload.');
          },
        },
      ]
    );
  };

  const parsedOn = parseFloat(onInput);
  const parsedOff = parseFloat(offInput);
  const isValidPreview = !isNaN(parsedOn) && !isNaN(parsedOff) && parsedOn < parsedOff;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation / Header Bar */}
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Temperature Settings</Text>
        </View>

        {/* Target Device Banner */}
        <View style={styles.targetDeviceBanner}>
          <Text style={styles.targetDeviceIcon}>📡</Text>
          <View style={styles.targetDeviceTextWrap}>
            <Text style={styles.targetDeviceTitle}>ESP8266 Target: {deviceConfig.getBaseUrl()}</Text>
            <Text style={styles.targetDeviceSubtitle}>
              Threshold updates are persisted to ESP8266 EEPROM. Heating is autonomously regulated on hardware.
            </Text>
          </View>
        </View>

        {/* Loading Device Config Indicator */}
        {isLoadingConfig && (
          <View style={styles.loadingConfigBox}>
            <ActivityIndicator size="small" color={colors.cyanGlow} />
            <Text style={styles.loadingConfigText}>{deviceNotice}</Text>
          </View>
        )}

        {/* Device Notice Banner */}
        {!isLoadingConfig && deviceNotice && (
          <View style={styles.deviceNoticeBox}>
            <Text style={styles.deviceNoticeText}>{deviceNotice}</Text>
          </View>
        )}

        {/* Success Alert Banner */}
        {successMessage && (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {/* General Error Banner */}
        {generalErrorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{generalErrorMessage}</Text>
          </View>
        )}

        {/* Form Fields Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BULB TEMPERATURE THRESHOLDS</Text>
          <Text style={styles.cardDescription}>
            Configure the chamber temperature limits that govern the heating bulb relay.
          </Text>

          {/* Bulb ON Threshold Input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>Bulb ON Threshold (Lower Limit)</Text>
              <Text style={styles.defaultBadge}>Default: 36.0°C</Text>
            </View>
            <Text style={styles.fieldHint}>
              Heating bulb energizes when temperature reaches or falls below this value.
            </Text>

            <View
              style={[
                styles.inputWrapper,
                onFocused && styles.inputWrapperFocused,
                onErrorMessage ? styles.inputWrapperError : null,
              ]}
            >
              <Text style={styles.inputPrefixIcon}>🔥</Text>
              <TextInput
                style={styles.textInput}
                value={onInput}
                onChangeText={(text) => {
                  setOnInput(text);
                  if (onErrorMessage) setOnErrorMessage(null);
                  if (generalErrorMessage) setGeneralErrorMessage(null);
                  if (successMessage) setSuccessMessage(null);
                }}
                onFocus={() => setOnFocused(true)}
                onBlur={() => setOnFocused(false)}
                placeholder="36.0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                editable={!isSaving}
              />
              <View style={styles.unitBadge}>
                <Text style={styles.unitText}>°C</Text>
              </View>
            </View>
            {onErrorMessage && (
              <Text style={styles.inlineErrorText}>{onErrorMessage}</Text>
            )}
          </View>

          {/* Bulb OFF Threshold Input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>Bulb OFF Threshold (Upper Limit)</Text>
              <Text style={styles.defaultBadge}>Default: 38.0°C</Text>
            </View>
            <Text style={styles.fieldHint}>
              Heating bulb turns OFF when temperature reaches or rises above this value.
            </Text>

            <View
              style={[
                styles.inputWrapper,
                offFocused && styles.inputWrapperFocused,
                offErrorMessage ? styles.inputWrapperError : null,
              ]}
            >
              <Text style={styles.inputPrefixIcon}>❄️</Text>
              <TextInput
                style={styles.textInput}
                value={offInput}
                onChangeText={(text) => {
                  setOffInput(text);
                  if (offErrorMessage) setOffErrorMessage(null);
                  if (generalErrorMessage) setGeneralErrorMessage(null);
                  if (successMessage) setSuccessMessage(null);
                }}
                onFocus={() => setOffFocused(true)}
                onBlur={() => setOffFocused(false)}
                placeholder="38.0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                editable={!isSaving}
              />
              <View style={styles.unitBadge}>
                <Text style={styles.unitText}>°C</Text>
              </View>
            </View>
            {offErrorMessage && (
              <Text style={styles.inlineErrorText}>{offErrorMessage}</Text>
            )}
          </View>
        </View>

        {/* Hysteresis Explanation Card */}
        <View style={styles.explanationCard}>
          <View style={styles.explanationHeader}>
            <Text style={styles.explanationIcon}>🔄</Text>
            <Text style={styles.explanationTitle}>CONTROL BEHAVIOR & HYSTERESIS</Text>
          </View>

          <Text style={styles.explanationLead}>
            Hysteresis prevents rapid on/off relay flapping, protecting both your relay contacts and heating bulb.
          </Text>

          {/* Visual Track */}
          <View style={styles.hysteresisTrackContainer}>
            <View style={styles.hysteresisTrack}>
              <View style={[styles.hysteresisZone, styles.zoneHeat]}>
                <Text style={styles.zoneText}>Bulb ON</Text>
              </View>
              <View style={[styles.hysteresisZone, styles.zoneHold]}>
                <Text style={styles.zoneText}>Maintain State</Text>
              </View>
              <View style={[styles.hysteresisZone, styles.zoneCool]}>
                <Text style={styles.zoneText}>Bulb OFF</Text>
              </View>
            </View>

            <View style={styles.hysteresisMarkers}>
              <Text style={styles.markerText}>
                ≤ {isValidPreview ? parsedOn.toFixed(1) : '36.0'}°C
              </Text>
              <Text style={styles.markerText}>
                Deadband ({isValidPreview ? (parsedOff - parsedOn).toFixed(1) : '2.0'}°C)
              </Text>
              <Text style={styles.markerText}>
                ≥ {isValidPreview ? parsedOff.toFixed(1) : '38.0'}°C
              </Text>
            </View>
          </View>

          {/* Behavior Rules List */}
          <View style={styles.rulesList}>
            <View style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>
                <Text style={styles.ruleHighlight}>Temp ≤ {isValidPreview ? parsedOn.toFixed(1) : '36.0'}°C:</Text>{' '}
                Chamber is cooling; bulb switches <Text style={{ color: colors.amberGlow }}>ON</Text>.
              </Text>
            </View>
            <View style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>
                <Text style={styles.ruleHighlight}>
                  Between {isValidPreview ? parsedOn.toFixed(1) : '36.0'}°C and {isValidPreview ? parsedOff.toFixed(1) : '38.0'}°C:
                </Text>{' '}
                Bulb maintains its previous state without switching.
              </Text>
            </View>
            <View style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>
                <Text style={styles.ruleHighlight}>Temp ≥ {isValidPreview ? parsedOff.toFixed(1) : '38.0'}°C:</Text>{' '}
                Target heat reached; bulb switches <Text style={{ color: colors.cyanGlow }}>OFF</Text>.
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.saveButtonText}>Save to ESP8266 (POST /api/config)</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetToDefaults}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            <Text style={styles.resetButtonText}>Reset to Factory Defaults (36°C / 38°C)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusFooter}>
          <Text style={styles.statusFooterText}>
            Current configuration: {currentSettings.lastUpdated || 'Factory Defaults'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  targetDeviceBanner: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  targetDeviceIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  targetDeviceTextWrap: {
    flex: 1,
  },
  targetDeviceTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.cyanGlow,
  },
  targetDeviceSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  loadingConfigBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceSubtle,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  loadingConfigText: {
    fontSize: 12,
    color: colors.cyanGlow,
    fontWeight: '600',
  },
  deviceNoticeBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deviceNoticeText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.emeraldMuted,
    borderColor: colors.emeraldGlow,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  successIcon: {
    fontSize: 16,
    color: colors.emeraldGlow,
    fontWeight: '700',
  },
  successText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#A7F3D0',
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.crimsonMuted,
    borderColor: colors.crimsonGlow,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#FECACA',
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  defaultBadge: {
    fontSize: 10,
    color: colors.textMuted,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 8,
    lineHeight: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: colors.amberGlow,
    backgroundColor: colors.surfaceElevated,
  },
  inputWrapperError: {
    borderColor: colors.crimsonGlow,
  },
  inputPrefixIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'monospace',
    paddingVertical: 0,
  },
  unitBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  inlineErrorText: {
    fontSize: 11,
    color: colors.crimsonGlow,
    marginTop: 4,
    fontWeight: '600',
  },
  explanationCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  explanationIcon: {
    fontSize: 16,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  explanationLead: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: 14,
  },
  hysteresisTrackContainer: {
    marginBottom: 16,
  },
  hysteresisTrack: {
    flexDirection: 'row',
    height: 28,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  hysteresisZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneHeat: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  zoneHold: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  zoneCool: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
  },
  zoneText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  hysteresisMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  markerText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  rulesList: {
    gap: 8,
  },
  ruleItem: {
    flexDirection: 'row',
    gap: 6,
  },
  ruleBullet: {
    fontSize: 12,
    color: colors.amberGlow,
    lineHeight: 16,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  ruleHighlight: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionContainer: {
    gap: 12,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: colors.amberGlow,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 0.3,
  },
  cancelButton: {
    backgroundColor: colors.surfaceElevated,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  resetButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  statusFooter: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusFooterText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
