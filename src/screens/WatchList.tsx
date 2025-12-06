import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import CongressTradesService from '../services/CongressTradesService';
import InsiderTradesService from '../services/InsiderTradesService';

const screenWidth = Dimensions.get('window').width;

interface WatchedStock {
  symbol: string;
  name: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
}

interface TradeInfo {
  insiderPurchases: number;
  insiderSales: number;
  congressPurchases: number;
  congressSales: number;
  mostRecentInsiderPurchaseDate?: string;
  mostRecentInsiderSaleDate?: string;
  mostRecentCongressPurchaseDate?: string;
  mostRecentCongressSaleDate?: string;
}

const WatchList: React.FC = () => {
  const navigation = useNavigation();
  const [watchedStocks, setWatchedStocks] = useState<WatchedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbolList, setSymbolList] = useState<Array<{symbol: string, name: string}>>([]);
  const [tradeData, setTradeData] = useState<Map<string, TradeInfo>>(new Map());

  useEffect(() => {
    loadWatchList();
    loadSymbolList();
    loadTradeData();
  }, []);

  // Format date to MM/DD/YYYY
  const formatDate = (dateStr: string): string => {
    if (!dateStr || dateStr === 'N/A') return dateStr;
    
    // Handle YYYY-MM-DD format (from Insider trades)
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${month}/${day}/${year}`;
      }
    }
    
    // Handle MM/DD/YYYY format (already correct from Congress trades)
    if (dateStr.includes('/')) {
      return dateStr;
    }
    
    return dateStr;
  };

  const loadTradeData = async () => {
    try {
      const tradesMap = new Map<string, TradeInfo>();

      // Load Congress trades
      const congressTrades = await CongressTradesService.getTrades();
      congressTrades.forEach(trade => {
        if (trade.ticker) {
          const ticker = trade.ticker.toUpperCase();
          const info = tradesMap.get(ticker) || { 
            insiderPurchases: 0, 
            insiderSales: 0, 
            congressPurchases: 0, 
            congressSales: 0 
          };
          
          const isPurchase = trade.transactionType?.toLowerCase().includes('purchase') || 
                            trade.transactionType?.toLowerCase().includes('buy');
          const isSale = trade.transactionType?.toLowerCase().includes('sale') || 
                        trade.transactionType?.toLowerCase().includes('sell');
          
          if (isPurchase) {
            info.congressPurchases++;
            if (!info.mostRecentCongressPurchaseDate || trade.transactionDate > info.mostRecentCongressPurchaseDate) {
              info.mostRecentCongressPurchaseDate = trade.transactionDate;
            }
          } else if (isSale) {
            info.congressSales++;
            if (!info.mostRecentCongressSaleDate || trade.transactionDate > info.mostRecentCongressSaleDate) {
              info.mostRecentCongressSaleDate = trade.transactionDate;
            }
          }
          
          tradesMap.set(ticker, info);
        }
      });

      // Load Insider trades
      const insiderTrades = await InsiderTradesService.getTrades();
      insiderTrades.forEach(trade => {
        if (trade.ticker) {
          const ticker = trade.ticker.toUpperCase();
          const info = tradesMap.get(ticker) || { 
            insiderPurchases: 0, 
            insiderSales: 0, 
            congressPurchases: 0, 
            congressSales: 0 
          };
          
          const isPurchase = trade.transactionType?.toLowerCase().includes('purchase') || 
                            trade.transactionType?.toLowerCase().includes('buy');
          const isSale = trade.transactionType?.toLowerCase().includes('sale') || 
                        trade.transactionType?.toLowerCase().includes('sell');
          
          if (isPurchase) {
            info.insiderPurchases++;
            if (!info.mostRecentInsiderPurchaseDate || trade.transactionDate > info.mostRecentInsiderPurchaseDate) {
              info.mostRecentInsiderPurchaseDate = trade.transactionDate;
            }
          } else if (isSale) {
            info.insiderSales++;
            if (!info.mostRecentInsiderSaleDate || trade.transactionDate > info.mostRecentInsiderSaleDate) {
              info.mostRecentInsiderSaleDate = trade.transactionDate;
            }
          }
          
          tradesMap.set(ticker, info);
        }
      });

      setTradeData(tradesMap);
      console.log('[WatchList] Loaded trade data for', tradesMap.size, 'tickers');
    } catch (error) {
      console.log('[WatchList] Error loading trade data:', error);
    }
  };

  const loadSymbolList = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('stockSymbolList');
      if (cachedData) {
        setSymbolList(JSON.parse(cachedData));
      }
    } catch (error) {
      console.log('Error loading symbol list:', error);
    }
  };

  const loadWatchList = async () => {
    try {
      setLoading(true);
      const savedWatchList = await AsyncStorage.getItem('watchList');
      
      if (savedWatchList) {
        const stockList: WatchedStock[] = JSON.parse(savedWatchList);
        
        // Fetch current prices for all watched stocks
        const updatedStocks = await Promise.all(
          stockList.map(async (stock) => {
            try {
              const response = await axios.get(
                `https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?interval=1d&range=1d`
              );
              
              const meta = response.data.chart?.result?.[0]?.meta;
              if (meta) {
                const currentPrice = meta.regularMarketPrice;
                const previousClose = meta.previousClose || meta.chartPreviousClose;
                
                if (currentPrice && previousClose) {
                  const change = currentPrice - previousClose;
                  const changePercent = (change / previousClose) * 100;
                  
                  return {
                    ...stock,
                    currentPrice,
                    change,
                    changePercent,
                  };
                }
              }
              
              return stock;
            } catch (error) {
              console.log(`Error fetching price for ${stock.symbol}:`, error);
              return stock;
            }
          })
        );
        
        // Sort alphabetically by symbol
        const sortedStocks = updatedStocks.sort((a, b) => 
          a.symbol.localeCompare(b.symbol)
        );
        
        setWatchedStocks(sortedStocks);
      } else {
        setWatchedStocks([]);
      }
    } catch (error) {
      console.log('Error loading watch list:', error);
      setWatchedStocks([]);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWatchList = async (symbol: string) => {
    try {
      const updatedList = watchedStocks.filter(stock => stock.symbol !== symbol);
      setWatchedStocks(updatedList);
      await AsyncStorage.setItem('watchList', JSON.stringify(updatedList));
    } catch (error) {
      console.log('Error removing from watch list:', error);
    }
  };

  const renderStockItem = ({ item }: { item: WatchedStock }) => {
    const changeColor = (item.change || 0) >= 0 ? '#00ff88' : '#ff4444';
    const trades = tradeData.get(item.symbol.toUpperCase());
    
    return (
      <View style={styles.stockCard}>
        <View style={styles.stockHeader}>
          <TouchableOpacity 
            style={styles.stockTitleContainer}
            onPress={() => {
              // @ts-ignore
              navigation.navigate('StockSearch', { 
                symbolList,
                preSelectedSymbol: item.symbol 
              });
            }}
            activeOpacity={0.7}
          >
            <View style={styles.stockInfoRow}>
              <View style={styles.stockNameContainer}>
                <Text style={styles.symbolText}>{item.symbol}</Text>
                <Text style={styles.nameText}>{item.name}</Text>
                {trades && (
                  <View style={styles.tradesInfoContainer}>
                    {trades.insiderPurchases > 0 && trades.mostRecentInsiderPurchaseDate && (
                      <Text style={[styles.tradeText, { color: '#22c55e' }]}>
                        {trades.insiderPurchases} Insider Buy{trades.insiderPurchases > 1 ? 's' : ''} ({formatDate(trades.mostRecentInsiderPurchaseDate)})
                      </Text>
                    )}
                    {trades.insiderSales > 0 && trades.mostRecentInsiderSaleDate && (
                      <Text style={[styles.tradeText, { color: '#ef4444' }]}>
                        {trades.insiderSales} Insider Sale{trades.insiderSales > 1 ? 's' : ''} ({formatDate(trades.mostRecentInsiderSaleDate)})
                      </Text>
                    )}
                    {trades.congressPurchases > 0 && trades.mostRecentCongressPurchaseDate && (
                      <Text style={[styles.tradeText, { color: '#22c55e' }]}>
                        {trades.congressPurchases} Congress Buy{trades.congressPurchases > 1 ? 's' : ''} ({formatDate(trades.mostRecentCongressPurchaseDate)})
                      </Text>
                    )}
                    {trades.congressSales > 0 && trades.mostRecentCongressSaleDate && (
                      <Text style={[styles.tradeText, { color: '#ef4444' }]}>
                        {trades.congressSales} Congress Sale{trades.congressSales > 1 ? 's' : ''} ({formatDate(trades.mostRecentCongressSaleDate)})
                      </Text>
                    )}
                  </View>
                )}
              </View>
              
              {item.currentPrice !== undefined && (
                <View style={styles.priceDataContainer}>
                  <Text style={styles.priceText}>
                    Current: ${item.currentPrice.toFixed(2)}
                  </Text>
                  <Text style={[styles.changeText, { color: changeColor }]}>
                    Today: {(item.change || 0) >= 0 ? '+' : ''}
                    {item.change?.toFixed(2)} ({(item.changePercent || 0) >= 0 ? '+' : ''}
                    {item.changePercent?.toFixed(1)}%)
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.starButton}
            onPress={() => removeFromWatchList(item.symbol)}
          >
            <Text style={styles.starIcon}>★</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleSection}>
        <Text style={styles.screenTitle}>Watch List ({watchedStocks.length})</Text>
        <Text style={styles.subtitle}>
          Tap <Text style={styles.starIcon}>☆</Text> to add or remove from your watch list
        </Text>
      </View>

      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => {
          // @ts-ignore
          navigation.navigate('StockSearch', { symbolList });
        }}
      >
        <Text style={styles.searchButtonText}>Search for Stocks 🔍</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00d4ff" />
          <Text style={styles.loadingText}>Loading your watch list...</Text>
        </View>
      ) : watchedStocks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>☆</Text>
          <Text style={styles.emptyTitle}>No stocks in your watch list</Text>
          <Text style={styles.emptyText}>
            Star stocks while browsing to add them to your watch list
          </Text>
        </View>
      ) : (
        <FlatList
          data={watchedStocks}
          renderItem={renderStockItem}
          keyExtractor={(item) => item.symbol}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={loadWatchList}
          ListFooterComponent={
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
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1929',
  },
  titleSection: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.3)',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00d4ff',
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#7dd3fc',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: -4,
  },
  starIcon: {
    fontSize: 18,
    color: '#7dd3fc',
    lineHeight: 18,
  },
  searchButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#00d4ff',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#00d4ff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7dd3fc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    color: '#ffffff',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#7dd3fc',
    textAlign: 'center',
    lineHeight: 24,
  },
  listContainer: {
    padding: 12,
  },
  stockCard: {
    backgroundColor: '#0a1929',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stockTitleContainer: {
    flex: 1,
  },
  stockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flex: 1,
  },
  stockNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  tradesInfoContainer: {
    marginTop: 4,
  },
  tradeText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 2,
  },
  nameText: {
    fontSize: 11,
    color: '#7dd3fc',
  },
  priceDataContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 2,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  starButton: {
    padding: 2,
    marginLeft: 8,
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

export default WatchList;
