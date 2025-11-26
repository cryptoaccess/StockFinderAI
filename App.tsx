/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useEffect } from 'react';

import AppNavigator from './AppNavigator';
import CongressTradesService from './src/services/CongressTradesService';
import InsiderTradesService from './src/services/InsiderTradesService';



function App() {
  const isDarkMode = useColorScheme() === 'dark';
  
  // Prefetch congressional trades and insider trades data in background on app startup
  useEffect(() => {
    CongressTradesService.prefetchTrades();
    InsiderTradesService.prefetchTrades();
  }, []);
  
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
