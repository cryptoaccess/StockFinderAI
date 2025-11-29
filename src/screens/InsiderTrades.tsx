import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InsiderTradesService from '../services/InsiderTradesService';

/**
 * Insider Trades Screen
 * 
 * Displays corporate insider trading activity scraped from OpenInsider.com
 * Shows recent SEC Form 4 filings - trades made by company executives, directors, and major shareholders
 */

interface InsiderTrade {
  id: string;
  ticker: string;
  companyName: string;
  insiderName: string;
  insiderTitle: string;
  transactionType: string; // 'Purchase', 'Sale'
  transactionDate: string;
  sharesTraded: string;
  pricePerShare: string;
  value: string;
  sharesOwned: string;
}

interface GroupedInsiderTrade {
  id: string;
  ticker: string;
  companyName: string;
  trades: InsiderTrade[];
}

export default function InsiderTrades({ navigation }: any) {
  const route = useRoute();
  // @ts-ignore
  const { preSelectedSymbol } = route.params || {};
    // Calculate the time span of all trades
    const getTradeTimeSpan = () => {
      if (!trades || trades.length === 0) return null;
      // Parse all dates in local timezone by appending time component
      const dates = trades
        .map(t => {
          // Parse as YYYY-MM-DD and create date at noon local time to avoid timezone issues
          const parts = t.transactionDate.split('-');
          if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
          }
          return new Date(t.transactionDate);
        })
        .filter(d => !isNaN(d.getTime()));
      if (dates.length === 0) return null;
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      return { minDate, maxDate };
    };
  const [trades, setTrades] = useState<InsiderTrade[]>([]);
  const [groupedTrades, setGroupedTrades] = useState<GroupedInsiderTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [watchList, setWatchList] = useState<Array<{symbol: string, name: string}>>([]);
  const [mostBoughtStocks, setMostBoughtStocks] = useState<string>('');
  const [mostSoldStocks, setMostSoldStocks] = useState<string>('');
  const [symbolList, setSymbolList] = useState<Array<{symbol: string, name: string}>>([]);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedTransactionType, setSelectedTransactionType] = useState<'purchase' | 'sale' | null>(null);

  // Alphabet for filtering
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Filter grouped trades by selected letter and transaction type
  const displayedTrades = groupedTrades.filter(item => {
    // Filter by letter
    if (selectedLetter && !item.ticker.startsWith(selectedLetter)) {
      return false;
    }
    // Filter by transaction type
    if (selectedTransactionType) {
      const hasPurchases = item.trades.some(t => {
        const type = t.transactionType?.toLowerCase() || '';
        return type.includes('purchase') || type.includes('buy');
      });
      const hasSales = item.trades.some(t => {
        const type = t.transactionType?.toLowerCase() || '';
        return type.includes('sale') || type.includes('sell');
      });
      if (selectedTransactionType === 'purchase' && !hasPurchases) {
        return false;
      }
      if (selectedTransactionType === 'sale' && !hasSales) {
        return false;
      }
    }
    return true;
  });

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
    } catch (error) {
      console.error('Failed to load watch list:', error);
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
      console.log('Loading insider trades...');
      
      const tradesData = await InsiderTradesService.getTrades();
      
      console.log(`Received ${tradesData.length} insider trades`);
      
      if (tradesData.length > 0) {
        setTrades(tradesData);
        groupTradesByTicker(tradesData);
        updateTradeCounts(tradesData);
        setLoading(false);
        return;
      }
      
      // If no data, show empty state
      console.log('No insider trades received');
      setTrades([]);
      setGroupedTrades([]);
      setLoading(false);
    } catch (error) {
      console.error('Error loading insider trades:', error);
      setTrades([]);
      setGroupedTrades([]);
      setLoading(false);
    }
  };

  const updateTradeCounts = (allTrades: InsiderTrade[]) => {
    console.log('updateTradeCounts called with', allTrades.length, 'trades');
    if (allTrades.length > 0) {
      console.log('First trade transactionType:', allTrades[0].transactionType);
      console.log('Sample transaction types:', allTrades.slice(0, 5).map(t => t.transactionType));
    }
    
    const purchases = allTrades.filter(t => {
      const type = t.transactionType?.toLowerCase() || '';
      return type.includes('purchase') || type.includes('buy');
    }).length;
    const sales = allTrades.filter(t => {
      const type = t.transactionType?.toLowerCase() || '';
      return type.includes('sale') || type.includes('sell');
    }).length;
    
    console.log('Calculated purchases:', purchases, 'sales:', sales);
    setPurchaseCount(purchases);
    setSaleCount(sales);
    
    // Calculate most popular stocks
    const purchaseTickers = allTrades
      .filter(t => {
        const type = t.transactionType?.toLowerCase() || '';
        return type.includes('purchase') || type.includes('buy');
      })
      .map(t => t.ticker);
    const saleTickers = allTrades
      .filter(t => {
        const type = t.transactionType?.toLowerCase() || '';
        return type.includes('sale') || type.includes('sell');
      })
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

  const groupTradesByTicker = (allTrades: InsiderTrade[]) => {
    const grouped = new Map<string, GroupedInsiderTrade>();
    allTrades.forEach((trade) => {
      const key = trade.ticker;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          ticker: trade.ticker,
          companyName: trade.companyName,
          trades: [],
        });
      }
      grouped.get(key)!.trades.push(trade);
    });
    // Sort trades within each group by value (largest first)
    grouped.forEach((group) => {
      group.trades.sort((a, b) => {
        const getNumericValue = (valueStr: string) => {
          const match = valueStr.match(/[\d,]+/);
          return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
        };
        const valueA = getNumericValue(a.value);
        const valueB = getNumericValue(b.value);
        return valueB - valueA;
      });
    });
    // Sort company cards alphabetically by ticker
    const groupedArray = Array.from(grouped.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
    setGroupedTrades(groupedArray);
  };

  useEffect(() => {
    loadWatchList();
    loadTrades();
  }, []);

  // Auto-expand card for preSelectedSymbol
  useEffect(() => {
    if (preSelectedSymbol && groupedTrades.length > 0) {
      // Find the card that contains this symbol
      const cardWithSymbol = groupedTrades.find(group => 
        group.ticker === preSelectedSymbol
      );
      if (cardWithSymbol) {
        setExpandedCards(new Set([cardWithSymbol.id]));
      }
    }
  }, [preSelectedSymbol, groupedTrades]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const tradesData = await InsiderTradesService.refreshTrades();
      setTrades(tradesData);
      groupTradesByTicker(tradesData);
      updateTradeCounts(tradesData);
    } catch (error) {
      console.error('Error refreshing insider trades:', error);
    }
    setRefreshing(false);
  };

  const renderGroupedCard = ({ item }: { item: GroupedInsiderTrade }) => {
    const isExpanded = expandedCards.has(item.id);
    const purchases = item.trades.filter(t => {
      const type = t.transactionType?.toLowerCase() || '';
      return type.includes('purchase') || type.includes('buy');
    });
    const sales = item.trades.filter(t => {
      const type = t.transactionType?.toLowerCase() || '';
      return type.includes('sale') || type.includes('sell');
    });
    const isWatched = watchList.some(w => w.symbol === item.ticker);
    
    // Get most recent trade date
    const mostRecentDate = item.trades.length > 0 ? item.trades[0].transactionDate : 'N/A';

    return (
      <View style={styles.groupCard}>
        <TouchableOpacity onPress={() => toggleCard(item.id)} activeOpacity={0.7}>
          <View style={styles.groupHeaderRow}>
            <View style={styles.tickerCompanyRow}>
              <TouchableOpacity onPress={() => navigation.navigate('StockSearch', { preSelectedSymbol: item.ticker, symbolList })}>
                <Text style={styles.ticker}>{item.ticker}</Text>
              </TouchableOpacity>
              <Text style={styles.company} numberOfLines={1}>{item.companyName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleWatchListStock(item.ticker, item.companyName)}
              style={styles.starIconRight}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isWatched ? (
                <Text style={styles.starText}>★</Text>
              ) : (
                <Text style={[styles.starText, styles.starOutline]}>☆</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Last: </Text>
            <Text style={[styles.summaryValue, { fontSize: 12 }]}>{mostRecentDate}</Text>
            <Text style={styles.summaryLabel}>  Activity: </Text>
            <Text style={[styles.summaryValue, { color: '#22c55e' }]}>{purchases.length} Purchase{purchases.length !== 1 ? 's' : ''}</Text>
            <Text style={styles.summaryValue}> / </Text>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{sales.length} Sale{sales.length !== 1 ? 's' : ''}</Text>
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
                {purchases.map((trade, index) => (
                  <View key={`purchase-${index}`} style={styles.detailRow}>
                    <View style={styles.detailRowHeader}>
                      <View style={styles.dateWithType}>
                        <Text style={[styles.detailType, { color: '#22c55e' }]}>{trade.transactionType}</Text>
                        <Text style={styles.detailDate}> - {trade.transactionDate}</Text>
                      </View>
                      <Text style={styles.detailValue}>{trade.value.replace(/^[-–—+]+\s*/, '')}</Text>
                    </View>
                    <View style={styles.detailRowBody}>
                      <Text style={styles.detailAmount}>{trade.sharesTraded.replace(/^[-–—+]+\s*/, '')} shares @ {trade.pricePerShare.replace(/^[-–—+]+\s*/, '')}</Text>
                      <Text style={styles.detailCompany} numberOfLines={1} ellipsizeMode="tail">{trade.insiderName} - {trade.insiderTitle}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {sales.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sales ({sales.length})</Text>
                {sales.map((trade, index) => (
                  <View key={`sale-${index}`} style={styles.detailRow}>
                    <View style={styles.detailRowHeader}>
                      <View style={styles.dateWithType}>
                        <Text style={[styles.detailType, { color: '#ef4444' }]}>{trade.transactionType}</Text>
                        <Text style={styles.detailDate}> - {trade.transactionDate}</Text>
                      </View>
                      <Text style={styles.detailValue}>{trade.value.replace(/^[-–—+]+\s*/, '')}</Text>
                    </View>
                    <View style={styles.detailRowBody}>
                      <Text style={styles.detailAmount}>{trade.sharesTraded.replace(/^[-–—+]+\s*/, '')} shares @ {trade.pricePerShare.replace(/^[-–—+]+\s*/, '')}</Text>
                      <Text style={styles.detailCompany} numberOfLines={1} ellipsizeMode="tail">{trade.insiderName} - {trade.insiderTitle}</Text>
                    </View>
                  </View>
                ))}
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
        <Text style={styles.loadingText}>Loading insider trades...</Text>
      </View>
    );
  }

  const tradeSpan = getTradeTimeSpan();
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Insider Trades</Text>
        <Text style={styles.subtitle}>
          The most recent 1000 filings of SEC Form 4:{'\n'}{saleCount} sales and {purchaseCount} purchases by company insiders.
        </Text>
        {tradeSpan && (
          <Text style={[styles.subtitle, { marginTop: 2 }]}>Time span: {tradeSpan.minDate.toLocaleDateString()} – {tradeSpan.maxDate.toLocaleDateString()}</Text>
        )}
        {(mostBoughtStocks || mostSoldStocks) && (
          <View style={[styles.popularStocksContainer, { flexWrap: 'wrap', flexDirection: 'column', alignItems: 'flex-start' }]}> 
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
              <TouchableOpacity 
                onPress={() => setSelectedTransactionType(selectedTransactionType === 'purchase' ? null : 'purchase')}
                style={[
                  styles.filterButton,
                  selectedTransactionType === 'purchase' && styles.filterButtonActive
                ]}
              >
                <Text style={[
                  styles.filterButtonText,
                  { color: '#22c55e' },
                  selectedTransactionType === 'purchase' && styles.filterButtonTextActive
                ]}>Most Bought:</Text>
              </TouchableOpacity>
              {(() => {
                // Calculate ticker counts for Most Bought
                const tickerCounts: Record<string, number> = {};
                trades.filter(t => {
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
                      {ticker} ({count}){i < topTickers.length - 1 ? ', ' : ''}
                    </Text>
                  </TouchableOpacity>
                )) : <Text style={[styles.popularStocksValue, { color: '#22c55e' }]}>N/A</Text>;
              })()}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
              <TouchableOpacity 
                onPress={() => setSelectedTransactionType(selectedTransactionType === 'sale' ? null : 'sale')}
                style={[
                  styles.filterButton,
                  selectedTransactionType === 'sale' && styles.filterButtonActiveSale
                ]}
              >
                <Text style={[
                  styles.filterButtonText,
                  { color: '#ef4444' },
                  selectedTransactionType === 'sale' && styles.filterButtonTextActiveSale
                ]}>Most Sold:</Text>
              </TouchableOpacity>
              {(() => {
                // Calculate ticker counts for Most Sold
                const tickerCounts: Record<string, number> = {};
                trades.filter(t => {
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
                      {ticker} ({count}){i < topTickers.length - 1 ? ', ' : ''}
                    </Text>
                  </TouchableOpacity>
                )) : <Text style={[styles.popularStocksValue, { color: '#ef4444' }]}>N/A</Text>;
              })()}
            </View>
          </View>
        )}
        
        {/* Alphabet Filter */}
        <View style={styles.alphabetContainer}>
          {alphabet.map(letter => (
            <TouchableOpacity
              key={letter}
              onPress={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
              style={[styles.letterButton, selectedLetter === letter && styles.letterButtonActive]}
            >
              <Text style={[styles.letterText, selectedLetter === letter && styles.letterTextActive]}>{letter}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity 
            onPress={() => { setSelectedLetter(null); setSelectedTransactionType(null); }} 
            style={[styles.resetButton, selectedLetter === null && selectedTransactionType === null && styles.letterButtonActive]}
          >
            <Text style={[styles.resetButtonText, selectedLetter === null && selectedTransactionType === null && styles.letterTextActive]}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={displayedTrades}
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No insider trades found</Text>
          </View>
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
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
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
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  popularStocksValue: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  listContainer: {
    padding: 8,
    paddingBottom: 16,
  },
  groupCard: {
    backgroundColor: '#0a1929',
    borderRadius: 12,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tickerCompanyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    flex: 1,
  },
  ticker: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00d4ff',
    letterSpacing: 0.5,
    marginBottom: 0,
    marginRight: 6,
  },
  starIconRight: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    marginTop: 0,
    padding: 2,
  },
  starText: {
    fontSize: 22,
    color: '#fff',
    lineHeight: 22,
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  starOutline: {
    color: '#fff',
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    fontWeight: '400',
  },
  company: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '500',
    flexShrink: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  expandButtonContainer: {
    marginTop: 6,
    alignItems: 'center',
  },
  expandButton: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  detailsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 212, 255, 0.2)',
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00d4ff',
    marginBottom: 6,
  },
  detailRow: {
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    padding: 8,
    paddingTop: 1,
    paddingBottom: 6,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#00d4ff',
  },
  detailRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateWithType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailType: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  detailRowBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  detailAmount: {
    fontSize: 12,
    color: '#cbd5e1',
    minWidth: 120,
  },
  detailCompany: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
  alphabetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    gap: 4,
  },
  letterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  letterButtonActive: {
    backgroundColor: '#00d4ff',
    borderColor: '#00d4ff',
  },
  letterText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  letterTextActive: {
    color: '#0f172a',
  },
  resetButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  resetButtonText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  filterButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    marginRight: 6,
  },
  filterButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  filterButtonActiveSale: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  filterButtonTextActiveSale: {
    color: '#ffffff',
    fontWeight: '700',
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
