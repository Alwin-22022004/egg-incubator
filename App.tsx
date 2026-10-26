import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme/colors';
import { Header, AppScreen } from './src/components/Header';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TemperatureSettingsScreen } from './src/screens/TemperatureSettingsScreen';
import { DeviceStatusScreen } from './src/screens/DeviceStatusScreen';
import { DeviceAddressModal } from './src/components/DeviceAddressModal';
import { TemperatureSettings } from './src/types/incubator';
import { DataMode } from './src/types/api';
import { DEFAULT_TEMPERATURE_SETTINGS } from './src/mock/mockData';
import { deviceConfig } from './src/services/deviceConfig';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard');
  const [dataMode, setDataMode] = useState<DataMode>(deviceConfig.getDataMode());
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);

  // Keep Mock Mode settings and Device Mode settings separate
  const [mockTemperatureSettings, setMockTemperatureSettings] = useState<TemperatureSettings>(
    DEFAULT_TEMPERATURE_SETTINGS
  );
  const [deviceTemperatureSettings, setDeviceTemperatureSettings] = useState<TemperatureSettings>({
    ...DEFAULT_TEMPERATURE_SETTINGS,
    lastUpdated: 'Default (Pending /api/config sync)',
    isMock: false,
  });

  // Subscribe to device config service changes (URL and mode)
  useEffect(() => {
    const unsubscribe = deviceConfig.subscribe((state) => {
      setDataMode(state.dataMode);
    });
    return unsubscribe;
  }, []);

  const activeSettings = dataMode === 'device' ? deviceTemperatureSettings : mockTemperatureSettings;

  const handleSaveSettings = (updated: TemperatureSettings) => {
    if (dataMode === 'device') {
      setDeviceTemperatureSettings(updated);
    } else {
      setMockTemperatureSettings(updated);
    }
  };

  const getSubheaderTitle = () => {
    switch (currentScreen) {
      case 'temperatureSettings':
        return dataMode === 'device' ? 'ESP8266 Config (/api/config)' : 'Mock Threshold Config';
      case 'deviceStatus':
        return dataMode === 'device' ? 'Live API Diagnostics' : 'ESP8266 Diagnostics (Mock)';
      case 'dashboard':
      default:
        return dataMode === 'device' ? 'Live HTTP Telemetry' : 'Simulated Telemetry';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          connection="connected"
          chipModel="ESP8266 NodeMCU"
          lastSync={getSubheaderTitle()}
          dataMode={dataMode}
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          onOpenSettings={() => setCurrentScreen('temperatureSettings')}
          onBackToDashboard={() => setCurrentScreen('dashboard')}
          onOpenDiagnostics={() => setCurrentScreen('deviceStatus')}
          onOpenConfigModal={() => setIsConfigModalVisible(true)}
        />

        {currentScreen === 'dashboard' && (
          <DashboardScreen
            settings={activeSettings}
            dataMode={dataMode}
            onOpenSettings={() => setCurrentScreen('temperatureSettings')}
            onOpenDiagnostics={() => setCurrentScreen('deviceStatus')}
            onOpenConfigModal={() => setIsConfigModalVisible(true)}
          />
        )}

        {currentScreen === 'temperatureSettings' && (
          <TemperatureSettingsScreen
            currentSettings={activeSettings}
            dataMode={dataMode}
            onSaveSettings={handleSaveSettings}
            onClose={() => setCurrentScreen('dashboard')}
          />
        )}

        {currentScreen === 'deviceStatus' && (
          <DeviceStatusScreen
            dataMode={dataMode}
            onBackToDashboard={() => setCurrentScreen('dashboard')}
            onOpenSettings={() => setCurrentScreen('temperatureSettings')}
            onOpenConfigModal={() => setIsConfigModalVisible(true)}
          />
        )}

        {/* Global Modal to configure device base URL and operational data mode */}
        <DeviceAddressModal
          visible={isConfigModalVisible}
          onClose={() => setIsConfigModalVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
