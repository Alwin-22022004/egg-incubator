import React, { useState, useEffect } from 'react';
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
import { esp8266Api } from './src/services/esp8266Api';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard');
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [temperatureSettings, setTemperatureSettings] = useState<TemperatureSettings>(
    DEFAULT_TEMPERATURE_SETTINGS
  );

  useEffect(() => {
    let isMounted = true;

    const loadDeviceConfig = async () => {
      try {
        const result = await esp8266Api.getConfig();
        if (isMounted && result.success) {
          setTemperatureSettings({
            bulbOnThreshold: result.data.bulbOnThreshold,
            bulbOffThreshold: result.data.bulbOffThreshold,
            lastUpdated: `Synced with ESP8266 (${result.timestamp})`,
          });
        }
      } catch {
        // Retain current settings if ESP8266 is temporarily unreachable
      }
    };

    loadDeviceConfig();

    const unsubscribe = deviceConfig.subscribe(() => {
      loadDeviceConfig();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

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
