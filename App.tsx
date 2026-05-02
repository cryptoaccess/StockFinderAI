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
import ErrorBoundary from './src/components/ErrorBoundary';



function App() {
  const isDarkMode = useColorScheme() === 'dark';
  
  // Add global error handling
  useEffect(() => {
    const handleUnhandledRejection = (event: any) => {
      console.error('Unhandled promise rejection (silently handled):', event.reason);
      // Prevent the default handler (which would crash the app)
      event.preventDefault();
    };

    const handleError = (error: any) => {
      console.error('Global error (silently handled):', error.error);
      // Prevent the default handler
      error.preventDefault();
    };

    // Add event listeners
    const globalWindow = (globalThis as any)?.window;
    if (globalWindow && typeof globalWindow.addEventListener === 'function') {
      globalWindow.addEventListener('unhandledrejection', handleUnhandledRejection);
      globalWindow.addEventListener('error', handleError);
    }

    // Cleanup
    return () => {
      const cleanupWindow = (globalThis as any)?.window;
      if (cleanupWindow && typeof cleanupWindow.removeEventListener === 'function') {
        cleanupWindow.removeEventListener('unhandledrejection', handleUnhandledRejection);
        cleanupWindow.removeEventListener('error', handleError);
      }
    };
  }, []);
  
  // Prefetch congressional trades and insider trades data in background on app startup
  useEffect(() => {
    // Add small delay to ensure AsyncStorage is ready
    setTimeout(() => {
      CongressTradesService.prefetchTrades().catch(error => {
        console.error('[App] Failed to prefetch Congress trades:', error);
      });
      InsiderTradesService.prefetchTrades().catch(error => {
        console.error('[App] Failed to prefetch Insider trades:', error);
      });
    }, 500); // 500ms delay to let AsyncStorage initialize
  }, []);
  
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppNavigator />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
