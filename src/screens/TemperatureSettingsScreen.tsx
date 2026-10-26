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
import { TemperatureSettings } from '../types/incubator';
import { DEFAULT_TEMPERATURE_SETTINGS } from '../mock/mockData';
import { DataMode } from '../types/api';
import { esp8266Api } from '../services/esp8266Api';
import { deviceConfig } from '../services/deviceConfig';

interface TemperatureSettingsScreenProps {
  currentSettings: TemperatureSettings;
  dataMode: DataMode;
  onSaveSettings: (settings: TemperatureSettings) => void;
  onClose: () => void;
}

export const TemperatureSettingsScreen: React.FC<TemperatureSettingsScreenProps> = ({
  currentSettings,
  dataMode,
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

  // When Device Mode is active, fetch live configuration via GET /api/config on mount
  useEffect(() => {
    let isMounted = true;

    if (dataMode === 'device') {
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
              `Live config loaded from ${deviceConfig.getBaseUrl()}: ON ${result.data.bulbOnThreshold}°C / OFF ${result.data.bulbOffThreshold}°C`
            );
          } else {
            setDeviceNotice(
              `Device unreachable at ${deviceConfig.getBaseUrl()}. Displaying local fallback thresholds.`
            );
          }
        })
        .catch(() => {
          if (isMounted) {
            setIsLoadingConfig(false);
            setDeviceNotice('Failed to communicate with device. Showing local fallback.');
          }
        });
    } else {
      setDeviceNotice(null);
    }

    return () => {
      isMounted = false;
    };
  }, [dataMode]);

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

    if (dataMode === 'device') {
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
            isMock: false,
          };
          onSaveSettings(updated);
          setSuccessMessage(
            `Successfully updated ESP8266 thresholds via POST /api/config! (${response.data.bulbOnThreshold}°C / ${response.data.bulbOffThreshold}°C)`
          );
        } else {
          // Keep user's unsaved values intact when saving fails!
          setGeneralErrorMessage(
            `Failed to save to ESP8266: ${response.error}\nYour entered values have been retained. Try again or check local Wi-Fi link.`
          );
        }
      } catch (err: unknown) {
        setIsSaving(false);
        setGeneralErrorMessage(
          `Unexpected network error: ${err instanceof Error ? err.message : 'Unknown'}. Entered values are preserved.`
        );
      }
    } else {
      // Mock Mode: simulate local save with delay
      setTimeout(() => {
        const updated: TemperatureSettings = {
          bulbOnThreshold: validResult.onNum,
          bulbOffThreshold: validResult.offNum,
          lastUpdated: `Saved locally at ${timestamp} (Mock Mode)`,
          isMock: true,
        };
        onSaveSettings(updated);
        setIsSaving(false);
        setSuccessMessage('Settings saved successfully (Local Mock Mode)!');
      }, 400);
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset Thresholds to Defaults?',
      'This will restore the factory recommended values:\n• Bulb ON: 36.0°C\n• Bulb OFF: 38.0°C',
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
            setSuccessMessage('Defaults restored in form. Tap "Save Settings" to apply.');
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

        {/* Mode Indicator Banner */}
        <View
          style={[
            styles.modeBanner,
            dataMode === 'device' ? styles.modeBannerDevice : styles.modeBannerMock,
          ]}
        >
          <Text style={styles.modeBannerIcon}>{dataMode === 'device' ? '📡' : '🧪'}</Text>
          <View style={styles.modeBannerTextContainer}>
            <Text
              style={[
                styles.modeBannerTitle,
                { color: dataMode === 'device' ? colors.cyanGlow : colors.amberGlow },
              ]}
            >
              {dataMode === 'device'
                ? `DEVICE MODE TARGET: ${deviceConfig.getBaseUrl()}`
                : 'MOCK SIMULATION MODE'}
            </Text>
            <Text style={styles.modeBannerSubtitle}>
              {dataMode === 'device'
                ? 'Saving will send HTTP POST /api/config directly to your ESP8266 NodeMCU. The firmware autonomously makes all relay actuation decisions.'
                : 'Changes update local mock state for previewing. No hardware packets will be transmitted.'}
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
              <Text style={styles.saveButtonText}>
                {dataMode === 'device' ? 'Save to ESP8266 (POST /api/config)' : 'Save Settings (Mock)'}
              </Text>
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
            Current configuration: {currentSettings.lastUpdated || 'Factory Defaults'} • Mode:{' '}
            {dataMode.toUpperCase()}
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
  modeBanner: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  modeBannerMock: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  modeBannerDevice: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  modeBannerIcon: {
    fontSize: 18,
  },
  modeBannerTextContainer: {
    flex: 1,
  },
  modeBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modeBannerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  loadingConfigBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  loadingConfigText: {
    fontSize: 11,
    color: colors.cyanGlow,
  },
  deviceNoticeBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  deviceNoticeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.emeraldMuted,
    borderColor: colors.emeraldGlow,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  successIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.emeraldGlow,
  },
  successText: {
    flex: 1,
    fontSize: 12,
    color: '#A7F3D0',
    fontWeight: '600',
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
    marginBottom: 14,
    gap: 10,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#FECACA',
    fontWeight: '600',
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
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
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
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
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: colors.amberGlow,
    backgroundColor: colors.surfaceElevated,
  },
  inputWrapperError: {
    borderColor: colors.crimsonGlow,
  },
  inputPrefixIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  unitBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.amberGlow,
  },
  inlineErrorText: {
    fontSize: 11,
    color: colors.crimsonGlow,
    marginTop: 5,
    fontWeight: '600',
  },
  explanationCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
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
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 14,
  },
  hysteresisTrackContainer: {
    marginBottom: 14,
  },
  hysteresisTrack: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hysteresisMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  markerText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  rulesList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    lineHeight: 17,
  },
  ruleHighlight: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  actionContainer: {
    gap: 10,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: colors.amberGlow,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
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
    backgroundColor: colors.surface,
    height: 44,
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
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  statusFooter: {
    alignItems: 'center',
    marginTop: 4,
  },
  statusFooterText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
