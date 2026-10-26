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
import { DataMode } from '../types/api';

interface DeviceAddressModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DeviceAddressModal: React.FC<DeviceAddressModalProps> = ({
  visible,
  onClose,
}) => {
  const [urlInput, setUrlInput] = useState<string>(deviceConfig.getBaseUrl());
  const [selectedMode, setSelectedMode] = useState<DataMode>(deviceConfig.getDataMode());
  const [inputError, setInputError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{
    testing: boolean;
    success?: boolean;
    message?: string;
  }>({ testing: false });

  useEffect(() => {
    if (visible) {
      setUrlInput(deviceConfig.getBaseUrl());
      setSelectedMode(deviceConfig.getDataMode());
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
    deviceConfig.setDataMode(selectedMode);
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
              <Text style={styles.title}>ESP8266 Connection Config</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Operational Data Mode Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACTIVE DATA MODE</Text>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  selectedMode === 'mock' && styles.modeButtonActiveMock,
                ]}
                onPress={() => setSelectedMode('mock')}
                activeOpacity={0.7}
              >
                <Text style={styles.modeIcon}>🧪</Text>
                <View>
                  <Text
                    style={[
                      styles.modeText,
                      selectedMode === 'mock' && styles.modeTextActive,
                    ]}
                  >
                    Mock Mode
                  </Text>
                  <Text style={styles.modeSub}>Simulated Scenarios</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  selectedMode === 'device' && styles.modeButtonActiveDevice,
                ]}
                onPress={() => setSelectedMode('device')}
                activeOpacity={0.7}
              >
                <Text style={styles.modeIcon}>📡</Text>
                <View>
                  <Text
                    style={[
                      styles.modeText,
                      selectedMode === 'device' && styles.modeTextActive,
                    ]}
                  >
                    Device Mode
                  </Text>
                  <Text style={styles.modeSub}>Live HTTP Polling</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Device Base URL Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ESP8266 BASE URL</Text>
            <Text style={styles.hintText}>
              Enter the local IP address or mDNS hostname of your NodeMCU:
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
              <Text style={styles.infoHighlight}>Local Network Requirement:</Text> Your Android phone and ESP8266 must be on the same local Wi-Fi router (e.g. 2.4 GHz network).
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
                <Text style={styles.saveButtonText}>Apply Config</Text>
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
  modeToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 8,
  },
  modeButtonActiveMock: {
    borderColor: colors.amberGlow,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  modeButtonActiveDevice: {
    borderColor: colors.cyanGlow,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
  },
  modeIcon: {
    fontSize: 20,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.textPrimary,
  },
  modeSub: {
    fontSize: 10,
    color: colors.textMuted,
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
