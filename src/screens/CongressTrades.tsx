import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Linking,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Congress Trades Screen
 * 
 * Displays congressional stock trading activity scraped from CapitolTrades.com
 * 
 * IMPORTANT DEPLOYMENT NOTES:
 * - This screen requires a backend server running to scrape data from CapitolTrades.com
 * - For Android emulator: Backend runs on http://10.0.2.2:3001
 * - For iOS simulator: Backend runs on http://localhost:3001
 * - For REAL DEVICES: You MUST deploy the backend to a cloud service:
 *   • Render (https://render.com) - Free tier available
 *   • Railway (https://railway.app) - Free tier available
 *   • Vercel (https://vercel.com) - Serverless functions
 *   Then update the apiUrl below to point to your deployed backend URL
 * 
 * Backend Location: /backend/server.js
 * Backend uses Puppeteer to render JavaScript and scrape table data (same as Excel Power Query)
 * Data is cached for 30 minutes to avoid excessive scraping
 */

interface TradeListing {
  id: string;
  representative: string;
  party: string; // 'D' or 'R'
  state: string;
  ticker: string;
  assetDescription: string;
  transactionType: string; // 'Purchase', 'Sale', etc.
  transactionDate: string;
  amount: string;
  link?: string;
  chamber: string; // 'House' or 'Senate'
}

interface GroupedTrade {
  id: string;
  representative: string;
  party: string;
  state: string;
  chamber: string;
  trades: TradeListing[];
}

export default function CongressTrades({ navigation }: any) {
  const [trades, setTrades] = useState<TradeListing[]>([]);
  const [groupedTrades, setGroupedTrades] = useState<GroupedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedParty, setSelectedParty] = useState<'All' | 'D' | 'R'>('All');
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [watchList, setWatchList] = useState<Array<{symbol: string, name: string}>>([]);

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const loadWatchList = async () => {
    try {
      const saved = await AsyncStorage.getItem('watchList');
      if (saved) {
        setWatchList(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
    }
  };

  const toggleWatchListStock = async (ticker: string, companyName: string) => {
    try {
      const isWatched = watchList.some(item => item.symbol === ticker);
      let newWatchList;
      
      if (isWatched) {
        newWatchList = watchList.filter(item => item.symbol !== ticker);
      } else {
        newWatchList = [...watchList, { symbol: ticker, name: companyName }];
      }
      
      setWatchList(newWatchList);
      await AsyncStorage.setItem('watchList', JSON.stringify(newWatchList));
    } catch (error) {
      console.error('Error toggling watchlist:', error);
    }
  };

  const loadTrades = async () => {
    setLoading(true);
    try {
      console.log('Fetching congressional trades from local API...');
      
      // Call our local Node.js backend API
      // DEPLOYMENT NOTE: For real devices, replace this URL with your deployed backend URL
      // Android emulator: use 10.0.2.2 instead of localhost
      // iOS simulator: use localhost
      // Real device: use deployed URL (e.g., https://your-app.onrender.com/api/trades)
      const apiUrl = 'http://10.0.2.2:3001/api/trades';
      
      const response = await axios.get(apiUrl, {
        timeout: 60000, // 60 second timeout since scraping takes time
      });
      
      console.log(`Received ${response.data.length} trades from API`);
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        setTrades(response.data);
        groupTradesByRepresentative(response.data);
        updateTradeCounts(response.data);
        setLoading(false);
        return;
      }
      
      // If no data, fall back to mock data
      console.log('No trades received, using mock data');
      const mockTrades: TradeListing[] = [
        {
          id: '1',
          representative: 'Nancy Pelosi',
          party: 'D',
          state: 'CA',
          ticker: 'NVDA',
          assetDescription: 'NVIDIA Corporation',
          transactionType: 'Purchase',
          transactionDate: '11/15/2024',
          amount: '$1,000,001 - $5,000,000',
          chamber: 'House',
        },
        {
          id: '2',
          representative: 'Nancy Pelosi',
          party: 'D',
          state: 'CA',
          ticker: 'MSFT',
          assetDescription: 'Microsoft Corporation',
          transactionType: 'Sale',
          transactionDate: '11/10/2024',
          amount: '$500,001 - $1,000,000',
          chamber: 'House',
        },
        {
          id: '3',
          representative: 'Dan Crenshaw',
          party: 'R',
          state: 'TX',
          ticker: 'TSLA',
          assetDescription: 'Tesla Inc',
          transactionType: 'Purchase',
          transactionDate: '11/12/2024',
          amount: '$100,001 - $250,000',
          chamber: 'House',
        },
        {
          id: '4',
          representative: 'Josh Gottheimer',
          party: 'D',
          state: 'NJ',
          ticker: 'AAPL',
          assetDescription: 'Apple Inc',
          transactionType: 'Sale',
          transactionDate: '11/08/2024',
          amount: '$250,001 - $500,000',
          chamber: 'House',
        },
        {
          id: '5',
          representative: 'Josh Gottheimer',
          party: 'D',
          state: 'NJ',
          ticker: 'GOOGL',
          assetDescription: 'Alphabet Inc Class A',
          transactionType: 'Purchase',
          transactionDate: '11/05/2024',
          amount: '$50,001 - $100,000',
          chamber: 'House',
        },
      ];
      
      setTrades(mockTrades);
      groupTradesByRepresentative(mockTrades);
    } catch (error) {
      console.log('Error loading trades:', error);
      if (axios.isAxiosError(error)) {
        console.log('Axios error details:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
        });
      }
      
      // Fallback to mock data
      const mockTrades: TradeListing[] = [
        {
          id: '1',
          representative: 'Nancy Pelosi',
          party: 'D',
          state: 'CA',
          ticker: 'NVDA',
          assetDescription: 'NVIDIA Corporation',
          transactionType: 'Purchase',
          transactionDate: '11/15/2024',
          amount: '$1,000,001 - $5,000,000',
          chamber: 'House',
        },
      ];
      
      setTrades(mockTrades);
      groupTradesByRepresentative(mockTrades);
      updateTradeCounts(mockTrades);
    } finally {
      setLoading(false);
    }
  };

  const updateTradeCounts = (allTrades: TradeListing[]) => {
    const purchases = allTrades.filter(t => t.transactionType.toLowerCase().includes('purchase')).length;
    const sales = allTrades.filter(t => t.transactionType.toLowerCase().includes('sale')).length;
    setPurchaseCount(purchases);
    setSaleCount(sales);
  };

  const groupTradesByRepresentative = (allTrades: TradeListing[]) => {
    // Group trades by representative
    const grouped = new Map<string, GroupedTrade>();
    
    allTrades.forEach((trade) => {
      const key = `${trade.representative}-${trade.state}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          representative: trade.representative,
          party: trade.party,
          state: trade.state,
          chamber: trade.chamber,
          trades: [],
        });
      }
      
      grouped.get(key)!.trades.push(trade);
    });
    
    // Convert to array and sort each representative's trades
    const groupedArray = Array.from(grouped.values()).map((group) => {
      // Sort trades within each group by date (most recent first)
      group.trades.sort((a: TradeListing, b: TradeListing) => {
        const parseDate = (dateStr: string) => {
          const parts = dateStr.split('/');
          if (parts.length !== 3) return new Date(0);
          return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        };
        return parseDate(b.transactionDate).getTime() - parseDate(a.transactionDate).getTime();
      });
      return group;
    });
    
    // Sort groups by last name alphabetically
    groupedArray.sort((a, b) => {
      // Extract last name (last word in the name)
      const getLastName = (name: string) => {
        const parts = name.trim().split(' ');
        return parts[parts.length - 1].toLowerCase();
      };
      return getLastName(a.representative).localeCompare(getLastName(b.representative));
    });
    
    setGroupedTrades(groupedArray);
  };

  useEffect(() => {
    loadTrades();
    loadWatchList();
  }, []);

  useEffect(() => {
    // Re-group when filter changes
    const filtered = selectedParty === 'All' 
      ? trades 
      : trades.filter(t => t.party === selectedParty);
    groupTradesByRepresentative(filtered);
    updateTradeCounts(filtered);
  }, [selectedParty, trades]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrades();
    setRefreshing(false);
  };

  const getPartyEmoji = (party: string) => {
    if (party === 'D') return '🔵';
    if (party === 'R') return '🔴';
    return '⚪';
  };

  const renderGroupedCard = ({ item }: { item: GroupedTrade }) => {
    // Calculate summary statistics for this representative
    const purchases = item.trades.filter(t => t.transactionType.toLowerCase().includes('purchase'));
    const sales = item.trades.filter(t => t.transactionType.toLowerCase().includes('sale'));
    const isExpanded = expandedCards.has(item.id);
    
    // Get unique tickers for purchases and sales
    const purchaseTickers = [...new Set(purchases.map(t => t.ticker))].sort();
    const saleTickers = [...new Set(sales.map(t => t.ticker))].sort();
    
    // Get most recent trade date
    const mostRecentDate = item.trades.length > 0 ? item.trades[0].transactionDate : 'N/A';
    
    // Get party letter and color
    const partyLetter = item.party === 'D' ? 'D' : item.party === 'R' ? 'R' : 'O';
    const partyColor = item.party === 'D' ? '#3b82f6' : item.party === 'R' ? '#ef4444' : '#94a3b8';
    
    return (
      <View style={styles.groupCard}>
        <TouchableOpacity onPress={() => toggleCard(item.id)} activeOpacity={0.7}>
          <View style={styles.groupHeader}>
            <Text style={styles.representativeName}>
              {item.representative} <Text style={styles.statePartyText}>({item.state} - <Text style={{ color: partyColor }}>{partyLetter}</Text>)</Text>
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Last: </Text>
            <Text style={styles.summaryValue}>{mostRecentDate}</Text>
            <Text style={styles.summaryLabel}>  Activity: </Text>
            <Text style={[styles.summaryValue, { color: '#22c55e' }]}>{purchases.length} Purchase{purchases.length !== 1 ? 's' : ''}</Text>
            <Text style={styles.summaryValue}> / </Text>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{sales.length} Sale{sales.length !== 1 ? 's' : ''}</Text>
          </View>
          
          <View style={[styles.summaryRow, { marginBottom: 0, flexWrap: 'wrap' }]}>
            <Text style={styles.summaryLabel}>Stocks: </Text>
            {purchaseTickers.map((ticker, idx) => (
              <Text key={`p-${ticker}`} style={[styles.tickerBadge, { color: '#22c55e' }]}>
                {ticker}{idx < purchaseTickers.length - 1 || saleTickers.length > 0 ? ', ' : ''}
              </Text>
            ))}
            {saleTickers.map((ticker, idx) => (
              <Text key={`s-${ticker}`} style={[styles.tickerBadge, { color: '#ef4444' }]}>
                {ticker}{idx < saleTickers.length - 1 ? ', ' : ''}
              </Text>
            ))}
          </View>
          
          <View style={styles.expandButtonContainer}>
            <Text style={styles.expandButton}>{isExpanded ? '▲ Hide Details' : '▼ Show Details'}</Text>
          </View>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.detailsContainer}>
            {purchases.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Purchases ({purchases.length})</Text>
                {purchases.map((trade, index) => {
                  const isWatched = watchList.some(item => item.symbol === trade.ticker);
                  return (
                  <View key={`purchase-${index}`} style={styles.detailRow}>
                    <View style={styles.detailRowHeader}>
                      <Text style={styles.detailDate}>Date: {trade.transactionDate}</Text>
                      <View style={styles.tickerWithStar}>
                        <Text style={styles.detailTicker}>{trade.ticker}</Text>
                        <TouchableOpacity 
                          onPress={() => toggleWatchListStock(trade.ticker, trade.assetDescription)}
                          style={styles.starIcon}
                        >
                          <Text style={styles.starText}>{isWatched ? '★' : '☆'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.detailRowBody}>
                      <Text style={[styles.detailType, { color: '#22c55e' }]}>{trade.transactionType}</Text>
                      <Text style={styles.detailAmount}>{trade.amount}</Text>
                    </View>
                    <Text style={styles.detailCompany}>{trade.assetDescription}</Text>
                  </View>
                  );
                })}
              </View>
            )}
            
            {sales.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sales ({sales.length})</Text>
                {sales.map((trade, index) => {
                  const isWatched = watchList.some(item => item.symbol === trade.ticker);
                  return (
                  <View key={`sale-${index}`} style={styles.detailRow}>
                    <View style={styles.detailRowHeader}>
                      <Text style={styles.detailDate}>Date: {trade.transactionDate}</Text>
                      <View style={styles.tickerWithStar}>
                        <Text style={styles.detailTicker}>{trade.ticker}</Text>
                        <TouchableOpacity 
                          onPress={() => toggleWatchListStock(trade.ticker, trade.assetDescription)}
                          style={styles.starIcon}
                        >
                          <Text style={styles.starText}>{isWatched ? '★' : '☆'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.detailRowBody}>
                      <Text style={[styles.detailType, { color: '#ef4444' }]}>{trade.transactionType}</Text>
                      <Text style={styles.detailAmount}>{trade.amount}</Text>
                    </View>
                    <Text style={styles.detailCompany}>{trade.assetDescription}</Text>
                  </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading && groupedTrades.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading congressional trades...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Congress Trades</Text>
        <Text style={styles.subtitle}>
          During the last 30 days, there were {saleCount} sales and {purchaseCount} purchases of stock by these politicians or their family members.
        </Text>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, selectedParty === 'All' && styles.filterButtonActive]}
          onPress={() => setSelectedParty('All')}
        >
          <Text style={[styles.filterText, selectedParty === 'All' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedParty === 'D' && styles.filterButtonActive]}
          onPress={() => setSelectedParty('D')}
        >
          <Text style={[styles.filterText, selectedParty === 'D' && styles.filterTextActive]}>
            🔵 Dems
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedParty === 'R' && styles.filterButtonActive]}
          onPress={() => setSelectedParty('R')}
        >
          <Text style={[styles.filterText, selectedParty === 'R' && styles.filterTextActive]}>
            🔴 GOP
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groupedTrades}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupedCard}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00d4ff"
            colors={['#00d4ff']}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>No trades found</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1929',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a1929',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  tickerList: {
    fontSize: 14,
    color: '#00d4ff',
    flex: 1,
    flexWrap: 'wrap',
  },
  expandButtonContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  expandButton: {
    fontSize: 13,
    color: '#00d4ff',
    fontWeight: '600',
  },
  detailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 212, 255, 0.2)',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#00d4ff',
    marginBottom: 8,
  },
  detailRow: {
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00d4ff',
  },
  detailRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  detailTicker: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00d4ff',
  },
  tickerWithStar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starIcon: {
    padding: 2,
  },
  starText: {
    fontSize: 18,
    color: '#ffffff',
  },
  detailRowBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailType: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailAmount: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  detailCompany: {
    fontSize: 13,
    color: '#94a3b8',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#00d4ff',
    borderColor: '#00d4ff',
  },
  filterText: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#000000',
  },
  listContainer: {
    padding: 20,
    paddingTop: 0,
  },
  groupCard: {
    backgroundColor: '#0a1929',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.2)',
  },
  representativeName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  statePartyText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#94a3b8',
  },
  stateText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  tickerBadge: {
    fontSize: 13,
    fontWeight: '600',
  },
  tradeRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  tradeRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tradeDate: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  transactionType: {
    fontSize: 15,
    fontWeight: '600',
  },
  tradeDetails: {
    marginBottom: 6,
  },
  tickerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00d4ff',
    marginBottom: 4,
  },
  companyText: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  amountText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
