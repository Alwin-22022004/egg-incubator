import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { deviceConfig, DEFAULT_DEVICE_URL } from '../services/deviceConfig';
import { esp8266Api } from '../services/esp8266Api';

interface DeviceAddressModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DeviceAddressModal: React.FC<DeviceAddressModalProps> = ({
  visible,
  onClose,
}) => {
  const [urlInput, setUrlInput] = useState<string>(deviceConfig.getBaseUrl());
  const [inputError, setInputError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{
    testing: boolean;
    success?: boolean;
    message?: string;
  }>({ testing: false });

  useEffect(() => {
    if (visible) {
      setUrlInput(deviceConfig.getBaseUrl());
      setInputError(null);
      setTestStatus({ testing: false });
    }
  }, [visible]);

  const handleTestConnection = async () => {
    setInputError(null);
    const validation = deviceConfig.validateUrl(urlInput);
    if (!validation.valid || !validation.normalized) {
      setInputError(validation.error || 'Invalid URL');
      return;
    }

    // Temporarily apply URL to test
    const previousUrl = deviceConfig.getBaseUrl();
    deviceConfig.setBaseUrl(validation.normalized);

    setTestStatus({ testing: true });
    try {
      const probe = await esp8266Api.ping();
      setTestStatus({
        testing: false,
        success: probe.success,
        message: probe.message,
      });
    } catch (err: unknown) {
      setTestStatus({
        testing: false,
        success: false,
        message: err instanceof Error ? err.message : 'Probe failed',
      });
    } finally {
      // Restore previous url if probe was just a test and user hasn't saved yet
      deviceConfig.setBaseUrl(previousUrl);
    }
  };

  const handleSave = () => {
    setInputError(null);
    const validation = deviceConfig.validateUrl(urlInput);
    if (!validation.valid || !validation.normalized) {
      setInputError(validation.error || 'Invalid URL');
      return;
    }

    deviceConfig.setBaseUrl(validation.normalized);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleGroup}>
              <Text style={styles.icon}>📡</Text>
              <Text style={styles.title}>ESP8266 Device Address</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Device Base URL Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ESP8266 BASE URL</Text>
            <Text style={styles.hintText}>
              Enter the local IP address assigned to your ESP8266 NodeMCU on your Wi-Fi:
            </Text>

            <View style={[styles.inputWrapper, inputError ? styles.inputWrapperError : null]}>
              <Text style={styles.inputPrefix}>🔗</Text>
              <TextInput
                style={styles.textInput}
                value={urlInput}
                onChangeText={(text) => {
                  setUrlInput(text);
                  if (inputError) setInputError(null);
                  if (testStatus.message) setTestStatus({ testing: false });
                }}
                placeholder="http://192.168.1.142"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                style={styles.defaultPill}
                onPress={() => setUrlInput(DEFAULT_DEVICE_URL)}
              >
                <Text style={styles.defaultPillText}>Default</Text>
              </TouchableOpacity>
            </View>

            {inputError && <Text style={styles.inlineError}>{inputError}</Text>}
          </View>

          {/* Local Wi-Fi Explanation Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoHighlight}>Local Wi-Fi Network:</Text> Your phone and the ESP8266 must be connected to the same Wi-Fi router (2.4 GHz). Check the ESP8266 OLED display or Serial Monitor for its IP address.
            </Text>
          </View>

          {/* Test Connection Probe Feedback */}
          {testStatus.message && (
            <View
              style={[
                styles.testResultBox,
                testStatus.success ? styles.testSuccess : styles.testFailed,
              ]}
            >
              <Text style={styles.testResultIcon}>
                {testStatus.success ? '✓' : '⚠️'}
              </Text>
              <Text
                style={[
                  styles.testResultText,
                  { color: testStatus.success ? '#A7F3D0' : '#FECACA' },
                ]}
              >
                {testStatus.message}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestConnection}
              disabled={testStatus.testing}
              activeOpacity={0.7}
            >
              {testStatus.testing ? (
                <ActivityIndicator size="small" color={colors.cyanGlow} />
              ) : (
                <Text style={styles.testButtonText}>Test Connection ⚡</Text>
              )}
            </TouchableOpacity>

            <View style={styles.saveCancelGroup}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>Apply IP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 6,
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
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
  inputWrapperError: {
    borderColor: colors.crimsonGlow,
  },
  inputPrefix: {
    fontSize: 16,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    paddingVertical: 0,
  },
  defaultPill: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  defaultPillText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  inlineError: {
    fontSize: 11,
    color: colors.crimsonGlow,
    marginTop: 4,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  infoHighlight: {
    color: colors.cyanGlow,
    fontWeight: '700',
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  testSuccess: {
    backgroundColor: colors.emeraldMuted,
    borderColor: colors.emeraldGlow,
  },
  testFailed: {
    backgroundColor: colors.crimsonMuted,
    borderColor: colors.crimsonGlow,
  },
  testResultIcon: {
    fontSize: 16,
  },
  testResultText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  actionRow: {
    gap: 10,
  },
  testButton: {
    backgroundColor: colors.surfaceSubtle,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cyanGlow,
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.cyanGlow,
  },
  saveCancelGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.amberGlow,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
  },
});
