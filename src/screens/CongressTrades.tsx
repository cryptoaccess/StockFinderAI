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
import { useRoute, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CongressTradesService from '../services/CongressTradesService';

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
  person?: string; // 'Spouse', 'Self', 'Child', etc.
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
  const route = useRoute();
  // @ts-ignore
  const { preSelectedSymbol } = route.params || {};
  const [trades, setTrades] = useState<TradeListing[]>([]);
  const [groupedTrades, setGroupedTrades] = useState<GroupedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedParty, setSelectedParty] = useState<'All' | 'D' | 'R'>('All');
  const [selectedTransactionType, setSelectedTransactionType] = useState<'All' | 'Purchase' | 'Sale'>('All');
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [watchList, setWatchList] = useState<Array<{symbol: string, name: string}>>([]);
  const [symbolList, setSymbolList] = useState<Array<{symbol: string, name: string}>>([]);
  const [demCount, setDemCount] = useState(0);
  const [gopCount, setGopCount] = useState(0);
  const [mostBoughtStocks, setMostBoughtStocks] = useState<string>('');
  const [mostSoldStocks, setMostSoldStocks] = useState<string>('');
  const [favoriteMembers, setFavoriteMembers] = useState<Array<{name: string, state: string}>>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => {
      if (prev.has(cardId)) {
        // If clicking the currently expanded card, close it
        return new Set();
      } else {
        // Otherwise, close all others and open this one
        return new Set([cardId]);
      }
    });
  };

  const loadWatchList = async () => {
    try {
      const saved = await AsyncStorage.getItem('watchList');
      if (saved) {
        setWatchList(JSON.parse(saved));
      }
      // Also load symbol list for stock search
      const cachedSymbols = await AsyncStorage.getItem('stockSymbolList');
      if (cachedSymbols) {
        setSymbolList(JSON.parse(cachedSymbols));
      }
      // Load favorite congress members
      const savedFavorites = await AsyncStorage.getItem('favoriteCongressMembers');
      if (savedFavorites) {
        setFavoriteMembers(JSON.parse(savedFavorites));
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
    }
  };

  const toggleFavoriteMember = async (name: string, state: string) => {
    try {
      const isFavorited = favoriteMembers.some(
        item => item.name === name && item.state === state
      );
      let newFavorites;
      
      if (isFavorited) {
        newFavorites = favoriteMembers.filter(
          item => !(item.name === name && item.state === state)
        );
      } else {
        newFavorites = [...favoriteMembers, { name, state }];
      }
      
      setFavoriteMembers(newFavorites);
      await AsyncStorage.setItem('favoriteCongressMembers', JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Error toggling favorite member:', error);
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
      console.log('Loading congressional trades...');
      
      // Use the service to get trades (will use cached data if available)
      const tradesData = await CongressTradesService.getTrades();
      
      console.log(`Received ${tradesData.length} trades`);
      
      if (tradesData.length > 0) {
        setTrades(tradesData);
        groupTradesByRepresentative(tradesData);
        updateTradeCounts(tradesData);
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
    
    // Calculate most popular stocks
    const purchaseTickers = allTrades
      .filter(t => t.transactionType.toLowerCase().includes('purchase'))
      .map(t => t.ticker);
    const saleTickers = allTrades
      .filter(t => t.transactionType.toLowerCase().includes('sale'))
      .map(t => t.ticker);
    
    const getTopStocks = (tickers: string[], count: number = 3) => {
      const tickerCounts = tickers.reduce((acc, ticker) => {
        acc[ticker] = (acc[ticker] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return Object.entries(tickerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([ticker]) => ticker)
        .join(', ');
    };
    
    setMostBoughtStocks(getTopStocks(purchaseTickers));
    setMostSoldStocks(getTopStocks(saleTickers));
  };
  
  const updatePartyCounts = (allTrades: TradeListing[]) => {
    // Count unique politicians by party from ALL trades (not filtered)
    const uniqueDems = new Set(allTrades.filter(t => t.party === 'D').map(t => t.representative));
    const uniqueGOP = new Set(allTrades.filter(t => t.party === 'R').map(t => t.representative));
    setDemCount(uniqueDems.size);
    setGopCount(uniqueGOP.size);
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
      // Sort trades within each group by amount (largest first), then alphabetically by ticker
      group.trades.sort((a: TradeListing, b: TradeListing) => {
        // Extract numeric value from amount range (e.g., "$1,000,001 - $5,000,000" -> 5000000)
        const getMaxAmount = (amountStr: string) => {
          const match = amountStr.match(/\$([0-9,]+)\s*-\s*\$([0-9,]+)/);
          if (match) {
            return parseInt(match[2].replace(/,/g, ''));
          }
          return 0;
        };
        
        const amountA = getMaxAmount(a.amount);
        const amountB = getMaxAmount(b.amount);
        
        // First sort by amount (largest first)
        if (amountB !== amountA) {
          return amountB - amountA;
        }
        
        // If amounts are equal, sort alphabetically by ticker
        return a.ticker.localeCompare(b.ticker);
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

  // Auto-expand card for preSelectedSymbol
  useEffect(() => {
    if (preSelectedSymbol && groupedTrades.length > 0) {
      // Find the card that contains this symbol
      const cardWithSymbol = groupedTrades.find(group => 
        group.trades.some(trade => trade.ticker === preSelectedSymbol)
      );
      if (cardWithSymbol) {
        setExpandedCards(new Set([cardWithSymbol.id]));
      }
    }
  }, [preSelectedSymbol, groupedTrades]);

  useEffect(() => {
    // Re-group when filter changes
    let filtered = selectedParty === 'All' 
      ? trades 
      : trades.filter(t => t.party === selectedParty);
    
    // Apply transaction type filter
    if (selectedTransactionType !== 'All') {
      filtered = filtered.filter(t => {
        const type = t.transactionType?.toLowerCase() || '';
        if (selectedTransactionType === 'Purchase') {
          return type.includes('purchase') || type.includes('buy');
        } else if (selectedTransactionType === 'Sale') {
          return type.includes('sale') || type.includes('sell');
        }
        return true;
      });
    }
    
    // Apply favorites filter
    if (showFavoritesOnly && favoriteMembers.length > 0) {
      filtered = filtered.filter(t => 
        favoriteMembers.some(fav => fav.name === t.representative && fav.state === t.state)
      );
    }
    
    groupTradesByRepresentative(filtered);
    updateTradeCounts(filtered);
    // Always update party counts from the full trades array
    updatePartyCounts(trades);
  }, [selectedParty, selectedTransactionType, trades, showFavoritesOnly, favoriteMembers]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Reload from cache (same as initial load)
      const tradesData = await CongressTradesService.getTrades();
      if (tradesData.length > 0) {
        setTrades(tradesData);
        groupTradesByRepresentative(tradesData);
        updateTradeCounts(tradesData);
      }
    } catch (error) {
      console.log('Error refreshing trades:', error);
    } finally {
      setRefreshing(false);
    }
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
    const isFavorited = favoriteMembers.some(
      fav => fav.name === item.representative && fav.state === item.state
    );
    
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
            <View style={styles.representativeNameContainer}>
              <Text style={styles.representativeName}>
                {item.representative} <Text style={styles.statePartyText}>({item.state} - <Text style={{ color: partyColor }}>{partyLetter}</Text>)</Text>
              </Text>
              <TouchableOpacity 
                onPress={(e) => {
                  e.stopPropagation();
                  toggleFavoriteMember(item.representative, item.state);
                }}
                style={styles.memberStarIcon}
              >
                <Text style={styles.memberStarText}>{isFavorited ? '★' : '☆'}</Text>
              </TouchableOpacity>
            </View>
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
                      <View style={styles.dateWithType}>
                        <Text style={[styles.detailType, { color: '#22c55e' }]}>{trade.transactionType}</Text>
                        <Text style={styles.detailDate}> - {trade.transactionDate}{trade.person ? ` (${trade.person})` : ''}</Text>
                      </View>
                      <View style={styles.tickerWithStar}>
                        <TouchableOpacity onPress={() => navigation.navigate('StockSearch', { preSelectedSymbol: trade.ticker, symbolList })}>
                          <Text style={styles.detailTicker}>{trade.ticker}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => toggleWatchListStock(trade.ticker, trade.assetDescription)}
                          style={styles.starIcon}
                        >
                          <Text style={styles.starText}>{isWatched ? '★' : '☆'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.detailRowBody}>
                      <Text style={styles.detailAmount}>{trade.amount}</Text>
                      <Text style={styles.detailCompany} numberOfLines={1} ellipsizeMode="tail">{trade.assetDescription}</Text>
                    </View>
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
                      <View style={styles.dateWithType}>
                        <Text style={[styles.detailType, { color: '#ef4444' }]}>{trade.transactionType}</Text>
                        <Text style={styles.detailDate}> - {trade.transactionDate}{trade.person ? ` (${trade.person})` : ''}</Text>
                      </View>
                      <View style={styles.tickerWithStar}>
                        <TouchableOpacity onPress={() => navigation.navigate('StockSearch', { preSelectedSymbol: trade.ticker, symbolList })}>
                          <Text style={styles.detailTicker}>{trade.ticker}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => toggleWatchListStock(trade.ticker, trade.assetDescription)}
                          style={styles.starIcon}
                        >
                          <Text style={styles.starText}>{isWatched ? '★' : '☆'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.detailRowBody}>
                      <Text style={styles.detailAmount}>{trade.amount}</Text>
                      <Text style={styles.detailCompany} numberOfLines={1} ellipsizeMode="tail">{trade.assetDescription}</Text>
                    </View>
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
        <Text style={styles.loadingText}>Loading trades by U.S. Congress members...</Text>
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
        {(mostBoughtStocks || mostSoldStocks) && (
          <View style={[styles.popularStocksContainer, { flexWrap: 'wrap', flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
              <Text style={[styles.popularStocksValue, { color: '#22c55e' }]}>Most Bought:</Text>
              {(() => {
                // Calculate ticker counts for Most Bought (filtered by party)
                const tickerCounts: Record<string, number> = {};
                const filteredTrades = selectedParty === 'All' ? trades : trades.filter(t => t.party === selectedParty);
                filteredTrades.filter(t => {
                  const type = t.transactionType?.toLowerCase() || '';
                  return type.includes('purchase') || type.includes('buy');
                }).forEach(t => {
                  tickerCounts[t.ticker] = (tickerCounts[t.ticker] || 0) + 1;
                });
                const topTickers = Object.entries(tickerCounts)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 3) as [string, number][];
                return topTickers.length > 0 ? topTickers.map(([ticker, count], i) => (
                  <TouchableOpacity key={ticker} onPress={() => navigation.navigate('StockSearch', { preSelectedSymbol: ticker, symbolList })}>
                    <Text style={[styles.popularStocksValue, { color: '#22c55e' }]}>
                      {' '}{ticker} ({count}){i < topTickers.length - 1 ? ', ' : ''}
                    </Text>
                  </TouchableOpacity>
                )) : <Text style={[styles.popularStocksValue, { color: '#22c55e' }]}> N/A</Text>;
              })()}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
              <Text style={[styles.popularStocksValue, { color: '#ef4444' }]}>Most Sold:</Text>
              {(() => {
                // Calculate ticker counts for Most Sold (filtered by party)
                const tickerCounts: Record<string, number> = {};
                const filteredTrades = selectedParty === 'All' ? trades : trades.filter(t => t.party === selectedParty);
                filteredTrades.filter(t => {
                  const type = t.transactionType?.toLowerCase() || '';
                  return type.includes('sale') || type.includes('sell');
                }).forEach(t => {
                  tickerCounts[t.ticker] = (tickerCounts[t.ticker] || 0) + 1;
                });
                const topTickers = Object.entries(tickerCounts)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 3) as [string, number][];
                return topTickers.length > 0 ? topTickers.map(([ticker, count], i) => (
                  <TouchableOpacity key={ticker} onPress={() => navigation.navigate('StockSearch', { preSelectedSymbol: ticker, symbolList })}>
                    <Text style={[styles.popularStocksValue, { color: '#ef4444' }]}>
                      {' '}{ticker} ({count}){i < topTickers.length - 1 ? ', ' : ''}
                    </Text>
                  </TouchableOpacity>
                )) : <Text style={[styles.popularStocksValue, { color: '#ef4444' }]}> N/A</Text>;
              })()}
            </View>
          </View>
        )}
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, selectedParty === 'All' && styles.filterButtonActive]}
            onPress={() => {
              setSelectedParty('All');
              setSelectedTransactionType('All');
              setShowFavoritesOnly(false);
            }}
          >
            <Text style={[styles.filterText, selectedParty === 'All' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton, 
              styles.favoritesFilterButton,
              showFavoritesOnly && styles.favoritesFilterButtonActive
            ]}
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <Text style={[
              styles.filterText, 
              styles.favoritesFilterText,
              showFavoritesOnly && styles.favoritesFilterTextActive
            ]}>
              ★ Favorites ({favoriteMembers.length})
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, selectedParty === 'D' && styles.filterButtonActive]}
            onPress={() => setSelectedParty(selectedParty === 'D' ? 'All' : 'D')}
          >
            <Text numberOfLines={1} style={[styles.filterText, selectedParty === 'D' && styles.filterTextActive]}>
              Dems ({demCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedParty === 'R' && styles.filterButtonActive]}
            onPress={() => setSelectedParty(selectedParty === 'R' ? 'All' : 'R')}
          >
            <Text numberOfLines={1} style={[styles.filterText, selectedParty === 'R' && styles.filterTextActive]}>
              GOP ({gopCount})
            </Text>
          </TouchableOpacity>
        </View>
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
        ListFooterComponent={
          !loading ? (
            <View style={styles.disclaimerSection}>
              <Text style={styles.disclaimerTitle}>Disclaimer:</Text>
              <Text style={styles.disclaimerText}>
                This app provides financial data and analysis for general informational purposes only. It does not provide investment, financial, legal, or tax advice, and nothing contained in the app should be interpreted as a recommendation to buy, sell, or hold any securities. Market data and information may be delayed, inaccurate, or incomplete. The developers and publishers of this app make no guarantees regarding the accuracy, timeliness, or reliability of any content.
              </Text>
              <Text style={styles.disclaimerText}>
                You are solely responsible for evaluating your own investment decisions, and you agree that the developers are not liable for any losses, damages, or consequences arising from the use of this app or reliance on its information.
              </Text>
              <Text style={styles.disclaimerText}>
                © 2025. All rights reserved.
              </Text>
            </View>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 16,
  },
  popularStocksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    flexWrap: 'nowrap',
  },
  popularStocksLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  popularStocksLabelActive: {
    color: '#00d4ff',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  popularStocksValue: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  transactionFilterButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    marginRight: 6,
  },
  transactionFilterButtonActivePurchase: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  transactionFilterButtonActiveSale: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  transactionFilterButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionFilterButtonTextActivePurchase: {
    color: '#0f172a',
    fontWeight: '700',
  },
  transactionFilterButtonTextActiveSale: {
    color: '#ffffff',
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 12,
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
    marginTop: 6,
    alignItems: 'center',
  },
  expandButton: {
    fontSize: 11,
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
    paddingTop: 1,
    paddingBottom: 8,
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
  dateWithType: {
    flexDirection: 'row',
    alignItems: 'center',
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
    gap: 12,
  },
  starIcon: {
    padding: 0,
    marginTop: -2,
  },
  starText: {
    fontSize: 22,
    color: '#ffffff',
    lineHeight: 22,
  },
  detailRowBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  detailType: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailAmount: {
    fontSize: 13,
    color: '#cbd5e1',
    minWidth: 150,
  },
  detailCompany: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'right',
    marginLeft: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#00d4ff',
    borderColor: '#00d4ff',
  },
  favoritesFilterButton: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  favoritesFilterButtonActive: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  filterText: {
    color: '#00d4ff',
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#000000',
  },
  favoritesFilterText: {
    color: '#fbbf24',
  },
  favoritesFilterTextActive: {
    color: '#000000',
  },
  listContainer: {
    padding: 8,
    paddingTop: 0,
  },
  groupCard: {
    backgroundColor: '#0a1929',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.2)',
  },
  representativeNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  representativeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  memberStarIcon: {
    padding: 4,
    marginLeft: 8,
  },
  memberStarText: {
    fontSize: 24,
    color: '#fbbf24',
    lineHeight: 24,
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
    fontSize: 11,
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
  disclaimerSection: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    marginTop: 10,
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 16,
    marginBottom: 8,
  },
});
