/**
 * Congress Trades Service
 * 
 * Handles background prefetching of congressional trading data
 * with once-per-day refresh logic
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { CONGRESS_TRADES_URL } from '../config/api';

const CACHE_KEY = 'congressTrades_cache';
const LAST_FETCH_DATE_KEY = 'congressTrades_lastFetchDate';

interface TradeListing {
  id: string;
  representative: string;
  party: string;
  state: string;
  ticker: string;
  assetDescription: string;
  transactionType: string;
  transactionDate: string;
  amount: string;
  person?: string;
  link?: string;
  chamber: string;
}

class CongressTradesService {
  private static instance: CongressTradesService;
  private cachedTrades: TradeListing[] | null = null;
  private fetchPromise: Promise<TradeListing[]> | null = null;

  private constructor() {}

  static getInstance(): CongressTradesService {
    if (!CongressTradesService.instance) {
      CongressTradesService.instance = new CongressTradesService();
    }
    return CongressTradesService.instance;
  }

  /**
   * Get current cache date key based on EST timezone
   * If before 10am EST, use previous day's cache
   */
  private getCacheDate(): string {
    const now = new Date();
    const estOffset = -5; // EST is UTC-5
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    const estHour = estTime.getUTCHours();

    // If before 10am EST, use previous day
    if (estHour < 10) {
      estTime.setUTCDate(estTime.getUTCDate() - 1);
    }

    return estTime.toISOString().split('T')[0];
  }

  /**
   * Prefetch trades in the background on app startup
   * Only fetches if it's the first time today (after 10am EST)
   */
  async prefetchTrades(): Promise<void> {
    try {
      const cacheDate = this.getCacheDate();
      const lastFetchDate = await AsyncStorage.getItem(LAST_FETCH_DATE_KEY);

      // If we already fetched for this cache period, load from cache
      if (lastFetchDate === cacheDate) {
        console.log('[CongressTrades] Already fetched for', cacheDate, '- loading from cache...');
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          this.cachedTrades = JSON.parse(cached);
          console.log('[CongressTrades] Loaded from cache:', this.cachedTrades?.length || 0, 'trades');
        }
        return;
      }

      // Otherwise, fetch fresh data in background
      console.log('[CongressTrades] Starting background fetch for cache date:', cacheDate);
      this.fetchPromise = this.fetchFreshTrades();
      
      // Don't await - let it run in background
      this.fetchPromise.then(async (trades) => {
        this.cachedTrades = trades;
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(trades));
        await AsyncStorage.setItem(LAST_FETCH_DATE_KEY, cacheDate);
        console.log('[CongressTrades] Background fetch complete:', trades.length, 'trades for', cacheDate);
      }).catch(error => {
        console.error('[CongressTrades] Background fetch failed:', error);
      });
    } catch (error) {
      console.error('[CongressTrades] Prefetch error:', error);
    }
  }

  /**
   * Get trades - returns cached if available, otherwise waits for fetch
   */
  async getTrades(): Promise<TradeListing[]> {
    const cacheDate = this.getCacheDate();
    const lastFetchDate = await AsyncStorage.getItem(LAST_FETCH_DATE_KEY);

    // If we have cached data, return it immediately
    if (this.cachedTrades && lastFetchDate === cacheDate) {
      console.log('[CongressTrades] Returning in-memory cached trades for', cacheDate);
      return [...this.cachedTrades];
    }

    // If a fetch is in progress, wait for it
    if (this.fetchPromise) {
      console.log('[CongressTrades] Waiting for ongoing fetch...');
      return await this.fetchPromise;
    }

    // Otherwise, check AsyncStorage
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    let parsedTrades: TradeListing[] | null = null;
    if (cached) {
      parsedTrades = JSON.parse(cached);
      if (lastFetchDate === cacheDate) {
        console.log('[CongressTrades] Loading valid cache from AsyncStorage for', cacheDate);
        this.cachedTrades = parsedTrades;
        return parsedTrades;
      }
      console.log('[CongressTrades] Cache is stale. lastFetchDate=', lastFetchDate, 'cacheDate=', cacheDate, '- fetching fresh data...');
    }

    // No valid cache, fetch fresh
    console.log('[CongressTrades] No valid cache, fetching fresh data...');
    try {
      this.fetchPromise = this.fetchFreshTrades();
      const trades = await this.fetchPromise;
      this.cachedTrades = trades;
      
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(trades));
      await AsyncStorage.setItem(LAST_FETCH_DATE_KEY, cacheDate);
      
      return trades;
    } catch (error) {
      // Fallback to stale cache if API fails
      if (parsedTrades) {
        console.log('[CongressTrades] Fresh fetch failed, falling back to stale cache');
        this.cachedTrades = parsedTrades;
        return parsedTrades;
      }
      throw error;
    }
  }

  /**
   * Force refresh - clears cache and fetches fresh data
   */
  async refreshTrades(): Promise<TradeListing[]> {
    console.log('[CongressTrades] Force refresh requested');
    this.cachedTrades = null;
    this.fetchPromise = this.fetchFreshTrades();
    
    const trades = await this.fetchPromise;
    this.cachedTrades = trades;
    
    const cacheDate = this.getCacheDate();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(trades));
    await AsyncStorage.setItem(LAST_FETCH_DATE_KEY, cacheDate);
    
    return trades;
  }

  /**
   * Fetch fresh data from API
   */
  private async fetchFreshTrades(): Promise<TradeListing[]> {
    try {
      const response = await axios.get(CONGRESS_TRADES_URL, {
        timeout: 60000, // 60 second timeout since scraping takes time
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }

      // Return empty array if no data
      return [];
    } catch (error) {
      console.error('[CongressTrades] API fetch error:', error);
      throw error;
    }
  }
}

export default CongressTradesService.getInstance();
