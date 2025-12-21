/**
 * API Configuration
 * 
 * Centralized API configuration for development and production environments.
 * Automatically detects platform (iOS/Android) and environment (dev/prod).
 */

import { Platform } from 'react-native';

// Determine if we're in development mode
const IS_DEV = __DEV__;

// Production URL - Railway deployment
const PRODUCTION_BASE_URL = 'https://stockfinderai-production.up.railway.app';

// Development URLs differ by platform
const getDevBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001'; // Android emulator (requires local backend)
  } else {
    // iOS: Use production server even in dev mode (no local backend needed)
    return PRODUCTION_BASE_URL;
  }
};

export const API_CONFIG = {
  BASE_URL: IS_DEV ? getDevBaseUrl() : PRODUCTION_BASE_URL,
  
  ENDPOINTS: {
    CONGRESS_TRADES: '/api/trades',
    INSIDER_TRADES: '/api/insider-trades',
  },
  
  // Helper to get full URL
  getUrl: (endpoint: string) => {
    return `${IS_DEV ? getDevBaseUrl() : PRODUCTION_BASE_URL}${endpoint}`;
  }
};

// Export individual URLs for convenience
export const CONGRESS_TRADES_URL = API_CONFIG.getUrl(API_CONFIG.ENDPOINTS.CONGRESS_TRADES);
export const INSIDER_TRADES_URL = API_CONFIG.getUrl(API_CONFIG.ENDPOINTS.INSIDER_TRADES);
