import React, { useState } from 'react';
import { StyleSheet, View, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme/colors';
import { Header, AppScreen } from './src/components/Header';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TemperatureSettingsScreen } from './src/screens/TemperatureSettingsScreen';
import { DeviceStatusScreen } from './src/screens/DeviceStatusScreen';
import { DeviceAddressModal } from './src/components/DeviceAddressModal';
import { TemperatureSettings, DEFAULT_TEMPERATURE_SETTINGS } from './src/types/incubator';
import { deviceConfig } from './src/services/deviceConfig';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard');
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [temperatureSettings, setTemperatureSettings] = useState<TemperatureSettings>(
    DEFAULT_TEMPERATURE_SETTINGS
  );

  const handleSaveSettings = (updated: TemperatureSettings) => {
    setTemperatureSettings(updated);
  };

  const getSubheaderTitle = () => {
    switch (currentScreen) {
      case 'temperatureSettings':
        return 'ESP8266 Config (/api/config)';
      case 'deviceStatus':
        return 'Live API Diagnostics';
      case 'dashboard':
      default:
        return `Target: ${deviceConfig.getBaseUrl()}`;
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
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          onOpenSettings={() => setCurrentScreen('temperatureSettings')}
          onBackToDashboard={() => setCurrentScreen('dashboard')}
          onOpenDiagnostics={() => setCurrentScreen('deviceStatus')}
          onOpenConfigModal={() => setIsConfigModalVisible(true)}
        />

        {currentScreen === 'dashboard' && (
          <DashboardScreen
            settings={temperatureSettings}
            onOpenSettings={() => setCurrentScreen('temperatureSettings')}
            onOpenDiagnostics={() => setCurrentScreen('deviceStatus')}
            onOpenConfigModal={() => setIsConfigModalVisible(true)}
          />
        )}

        {currentScreen === 'temperatureSettings' && (
          <TemperatureSettingsScreen
            currentSettings={temperatureSettings}
            onSaveSettings={handleSaveSettings}
            onClose={() => setCurrentScreen('dashboard')}
          />
        )}

        {currentScreen === 'deviceStatus' && (
          <DeviceStatusScreen
            onBackToDashboard={() => setCurrentScreen('dashboard')}
            onOpenSettings={() => setCurrentScreen('temperatureSettings')}
            onOpenConfigModal={() => setIsConfigModalVisible(true)}
          />
        )}

        {/* Global Modal to configure device base URL */}
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
