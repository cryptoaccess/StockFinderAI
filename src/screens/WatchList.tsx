import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Share,
  Platform,
  Linking,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import CongressTradesService from '../services/CongressTradesService';
import InsiderTradesService from '../services/InsiderTradesService';

const screenWidth = Dimensions.get('window').width;

const shouldShowLast = () => {
  const now = new Date();
  // Get EST time by formatting as string in EST timezone, then parse individual components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  let day = -1;
  let hours = 0;
  let minutes = 0;
  
  for (const part of parts) {
    if (part.type === 'weekday') {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      day = weekdays.indexOf(part.value);
    } else if (part.type === 'hour') {
      hours = parseInt(part.value, 10);
    } else if (part.type === 'minute') {
      minutes = parseInt(part.value, 10);
    }
  }
  
  // Weekend (Saturday=6, Sunday=0)
  if (day === 0 || day === 6) {
    return true;
  }
  
  // Weekday before 9:30 AM EST (market opens at 9:30 AM)
  if (day >= 1 && day <= 5) {
    if (hours < 9 || (hours === 9 && minutes < 30)) {
      return true;
    }
  }
  
  return false;
};

interface WatchedStock {
  symbol: string;
  name: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
  entryPrice?: number;
  shares?: number;
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
  const [symbolList, setSymbolList] = useState<Array<{symbol: string, name: string, category: string}>>([]);
  const [tradeData, setTradeData] = useState<Map<string, TradeInfo>>(new Map());
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState<string>('');
  const [entryPriceInput, setEntryPriceInput] = useState('');
  const [sharesInput, setSharesInput] = useState('');
  const [priceError, setPriceError] = useState(false);
  const [sharesError, setSharesError] = useState(false);
  const [showRemovePrompt, setShowRemovePrompt] = useState(false);
  const [stockToRemove, setStockToRemove] = useState<{symbol: string, price: number} | null>(null);
  const [filter, setFilter] = useState<'all' | 'positions'>('all');
  const [newTradeCounts, setNewTradeCounts] = useState<Map<string, {
    insiderPurchases: number,
    insiderSales: number,
    congressPurchases: number,
    congressSales: number
  }>>(new Map());

  useEffect(() => {
    loadWatchList();
    loadSymbolList();
    loadTradeData();
  }, []);

  // Check if we should show share prompt when watch list updates
  useEffect(() => {
    checkSharePrompt();
  }, [watchedStocks]);

  const checkSharePrompt = async () => {
    try {
      // Only check if we have exactly 5 stocks
      if (watchedStocks.length === 5) {
        const sharePromptShown = await AsyncStorage.getItem('watchListSharePromptShown');
        if (!sharePromptShown) {
          // Small delay so it doesn't appear immediately
          setTimeout(() => {
            setShowSharePrompt(true);
          }, 1000);
        }
      }
    } catch (error) {
      console.log('Error checking share prompt:', error);
    }
  };

  const handleShareApp = async () => {
    try {
      const iosUrl = 'https://apps.apple.com/us/app/stockfinderai/id6756030906';
      const androidUrl = 'https://play.google.com/store/apps/details?id=com.stockfinderai';
      
      const result = await Share.share({
        message: `Check out StockFinderAI - Track insider trades and price dips, with no registration or account!\n\niPhone: ${iosUrl}\nAndroid: ${androidUrl}`,
        title: 'StockFinderAI - Smart Stock Research',
      });

      // Mark that share prompt was shown
      await AsyncStorage.setItem('watchListSharePromptShown', 'true');
      setShowSharePrompt(false);
    } catch (error) {
      console.log('Error sharing app:', error);
    }
  };

  const handleNoThanks = async () => {
    try {
      await AsyncStorage.setItem('watchListSharePromptShown', 'true');
      setShowSharePrompt(false);
    } catch (error) {
      console.log('Error handling no thanks:', error);
    }
  };

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
      
      // Check and update daily snapshot for "New" badges
      await checkDailyTradeSnapshot(tradesMap);
    } catch (error) {
      console.log('[WatchList] Error loading trade data:', error);
    }
  };

  const checkDailyTradeSnapshot = async (currentTradeData: Map<string, TradeInfo>) => {
    try {
      const today = new Date().toDateString(); // e.g., "Fri Dec 20 2025"
      const snapshotData = await AsyncStorage.getItem('dailyTradeSnapshot');
      
      let snapshot: { date: string, trades: Record<string, any> } | null = null;
      if (snapshotData) {
        snapshot = JSON.parse(snapshotData);
      }
      
      // If snapshot is from a different day or doesn't exist, calculate "new" counts
      if (!snapshot || snapshot.date !== today) {
        const newCounts = new Map<string, {
          insiderPurchases: number,
          insiderSales: number,
          congressPurchases: number,
          congressSales: number
        }>();
        
        if (snapshot) {
          // Compare current data with yesterday's snapshot
          currentTradeData.forEach((current, symbol) => {
            const previous = snapshot!.trades[symbol];
            if (previous) {
              const newCount = {
                insiderPurchases: Math.max(0, current.insiderPurchases - previous.insiderPurchases),
                insiderSales: Math.max(0, current.insiderSales - previous.insiderSales),
                congressPurchases: Math.max(0, current.congressPurchases - previous.congressPurchases),
                congressSales: Math.max(0, current.congressSales - previous.congressSales)
              };
              
              // Only add if there are any new trades
              if (newCount.insiderPurchases > 0 || newCount.insiderSales > 0 || 
                  newCount.congressPurchases > 0 || newCount.congressSales > 0) {
                newCounts.set(symbol, newCount);
              }
            } else {
              // Stock is new to watch list, all trades are "new"
              newCounts.set(symbol, {
                insiderPurchases: current.insiderPurchases,
                insiderSales: current.insiderSales,
                congressPurchases: current.congressPurchases,
                congressSales: current.congressSales
              });
            }
          });
        }
        
        setNewTradeCounts(newCounts);
        
        // Save today's snapshot
        const newSnapshot = {
          date: today,
          trades: Object.fromEntries(
            Array.from(currentTradeData.entries()).map(([symbol, info]) => [
              symbol,
              {
                insiderPurchases: info.insiderPurchases,
                insiderSales: info.insiderSales,
                congressPurchases: info.congressPurchases,
                congressSales: info.congressSales
              }
            ])
          )
        };
        await AsyncStorage.setItem('dailyTradeSnapshot', JSON.stringify(newSnapshot));
      } else {
        // Same day - use existing new counts from state (badges persist throughout the day)
        // Don't reset the badges
      }
    } catch (error) {
      console.log('[WatchList] Error checking daily snapshot:', error);
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

  const handleEditEntryPrice = (symbol: string, currentEntryPrice?: number) => {
    const stock = watchedStocks.find(s => s.symbol === symbol);
    setEditingSymbol(symbol);
    setEditingCompanyName(stock?.name || '');
    setEntryPriceInput(currentEntryPrice ? currentEntryPrice.toString() : '');
    setSharesInput(stock?.shares ? stock.shares.toString() : '');
  };

  const saveEntryPrice = async () => {
    if (!editingSymbol) return;
    
    const price = parseFloat(entryPriceInput);
    const shares = parseFloat(sharesInput);
    
    // Reset error states
    setPriceError(false);
    setSharesError(false);
    
    // Both fields can be empty, or both must be filled
    const isPriceEntered = entryPriceInput.trim() !== '';
    const isSharesEntered = sharesInput.trim() !== '';
    
    // If one field is filled, both must be filled
    if (isPriceEntered && !isSharesEntered) {
      setSharesError(true);
      return;
    }
    
    if (isSharesEntered && !isPriceEntered) {
      setPriceError(true);
      return;
    }
    
    // If both are empty, just close the modal
    if (!isPriceEntered && !isSharesEntered) {
      setEditingSymbol(null);
      setEntryPriceInput('');
      setSharesInput('');
      return;
    }
    
    // Validate price
    if (isNaN(price) || price <= 0) {
      setPriceError(true);
      return;
    }

    // Validate shares
    if (isNaN(shares) || shares <= 0) {
      setSharesError(true);
      return;
    }

    try {
      const updatedList = watchedStocks.map(stock => 
        stock.symbol === editingSymbol 
          ? { ...stock, entryPrice: price, shares: shares }
          : stock
      );
      setWatchedStocks(updatedList);
      await AsyncStorage.setItem('watchList', JSON.stringify(updatedList));
      setEditingSymbol(null);
      setEntryPriceInput('');
      setSharesInput('');
    } catch (error) {
      console.log('Error saving entry price:', error);
    }
  };

  const removeEntryPrice = async (symbol: string) => {
    try {
      const updatedList = watchedStocks.map(stock => 
        stock.symbol === symbol 
          ? { ...stock, entryPrice: undefined, shares: undefined }
          : stock
      );
      setWatchedStocks(updatedList);
      await AsyncStorage.setItem('watchList', JSON.stringify(updatedList));
    } catch (error) {
      console.log('Error removing entry price:', error);
    }
  };

  const renderStockItem = ({ item }: { item: WatchedStock }) => {
    const changeColor = (item.change || 0) >= 0 ? '#00ff88' : '#ff4444';
    const trades = tradeData.get(item.symbol.toUpperCase());
    const newCounts = newTradeCounts.get(item.symbol.toUpperCase());
    
    // Calculate entry price gain/loss
    let entryGain = 0;
    let entryGainPercent = 0;
    let totalGain = 0;
    if (item.entryPrice && item.currentPrice) {
      entryGain = item.currentPrice - item.entryPrice;
      entryGainPercent = (entryGain / item.entryPrice) * 100;
      if (item.shares) {
        totalGain = entryGain * item.shares;
      }
    }
    const entryColor = entryGain >= 0 ? '#00ff88' : '#ff4444';
    
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
                <View style={styles.symbolRow}>
                  <Text style={styles.symbolText}>{item.symbol}</Text>
                  <TouchableOpacity
                    style={styles.starButton}
                    onPress={() => removeFromWatchList(item.symbol)}
                  >
                    <Text style={styles.starIcon}>★</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.nameText}>{item.name}</Text>
                {(() => {
                  const stockInfo = symbolList.find(s => s.symbol === item.symbol);
                  if (stockInfo?.category) {
                    return <Text style={styles.categoryText}>{stockInfo.category}</Text>;
                  }
                  return null;
                })()}
                {trades && (
                  <View style={styles.tradesInfoContainer}>
                    {trades.insiderPurchases > 0 && trades.mostRecentInsiderPurchaseDate && (
                      <View style={styles.tradeRow}>
                        <Text style={[styles.tradeText, { color: '#22c55e' }]}>
                          {trades.insiderPurchases} Insider Buy{trades.insiderPurchases > 1 ? 's' : ''} ({formatDate(trades.mostRecentInsiderPurchaseDate)})
                          {newCounts && newCounts.insiderPurchases > 0 && (
                            <Text style={{ color: '#00d4ff' }}> - {newCounts.insiderPurchases} New</Text>
                          )}
                        </Text>
                      </View>
                    )}
                    {trades.insiderSales > 0 && trades.mostRecentInsiderSaleDate && (
                      <View style={styles.tradeRow}>
                        <Text style={[styles.tradeText, { color: '#ef4444' }]}>
                          {trades.insiderSales} Insider Sale{trades.insiderSales > 1 ? 's' : ''} ({formatDate(trades.mostRecentInsiderSaleDate)})
                          {newCounts && newCounts.insiderSales > 0 && (
                            <Text style={{ color: '#00d4ff' }}> - {newCounts.insiderSales} New</Text>
                          )}
                        </Text>
                      </View>
                    )}
                    {trades.congressPurchases > 0 && trades.mostRecentCongressPurchaseDate && (
                      <View style={styles.tradeRow}>
                        <Text style={[styles.tradeText, { color: '#22c55e' }]}>
                          {trades.congressPurchases} Congress Buy{trades.congressPurchases > 1 ? 's' : ''} ({formatDate(trades.mostRecentCongressPurchaseDate)})
                          {newCounts && newCounts.congressPurchases > 0 && (
                            <Text style={{ color: '#00d4ff' }}> - {newCounts.congressPurchases} New</Text>
                          )}
                        </Text>
                      </View>
                    )}
                    {trades.congressSales > 0 && trades.mostRecentCongressSaleDate && (
                      <View style={styles.tradeRow}>
                        <Text style={[styles.tradeText, { color: '#ef4444' }]}>
                          {trades.congressSales} Congress Sale{trades.congressSales > 1 ? 's' : ''} ({formatDate(trades.mostRecentCongressSaleDate)})
                          {newCounts && newCounts.congressSales > 0 && (
                            <Text style={{ color: '#00d4ff' }}> - {newCounts.congressSales} New</Text>
                          )}
                        </Text>
                      </View>
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
                    {shouldShowLast() ? 'Last:' : 'Today:'} {(item.change || 0) >= 0 ? '+' : ''}
                    {item.change?.toFixed(2)} ({(item.changePercent || 0) >= 0 ? '+' : ''}
                    {item.changePercent?.toFixed(1)}%)
                  </Text>
                  <View style={styles.entryPriceSection}>
                    {!item.entryPrice && (
                      <TouchableOpacity 
                        style={styles.setEntryPriceButton}
                        onPress={() => handleEditEntryPrice(item.symbol, item.entryPrice)}
                      >
                        <Text style={styles.setEntryPriceButtonText}>Add to Portfolio</Text>
                      </TouchableOpacity>
                    )}
                    {item.entryPrice && (
                      <TouchableOpacity 
                        style={styles.entryPriceContainer}
                        onPress={() => {
                          setStockToRemove({ symbol: item.symbol, price: item.entryPrice! });
                          setShowRemovePrompt(true);
                        }}
                      >
                        <Text style={styles.entryPriceLabel}>
                          My Position:
                        </Text>
                        <Text style={styles.entryPriceLabel}>
                          ${item.entryPrice.toFixed(2)} × {item.shares || 0} shares
                        </Text>
                        <View style={styles.gainRow}>
                          <Text style={[styles.entryGainText, { color: entryColor }]}>
                            Gain: {totalGain >= 0 ? '+' : ''}${Math.round(totalGain)} ({entryGain >= 0 ? '+' : ''}{entryGainPercent.toFixed(1)}%)
                          </Text>
                          <Text style={styles.trashIcon}>✕</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Remove Entry Price Modal */}
      <Modal
        visible={showRemovePrompt}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRemovePrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.removeModalContent}>
            <Text style={styles.removeModalTitle}>Remove from Portfolio</Text>
            <Text style={styles.removeModalText}>
              Remove your position tracking for {stockToRemove?.symbol}?
            </Text>
            <Text style={styles.removeModalCompanyName}>
              {watchedStocks.find(s => s.symbol === stockToRemove?.symbol)?.name}
            </Text>
            <View style={styles.removeButtonRow}>
              <TouchableOpacity 
                style={styles.removeButton} 
                onPress={() => {
                  if (stockToRemove) {
                    removeEntryPrice(stockToRemove.symbol);
                  }
                  setShowRemovePrompt(false);
                  setStockToRemove(null);
                }}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.editRemoveButton} 
                onPress={() => {
                  if (stockToRemove) {
                    handleEditEntryPrice(stockToRemove.symbol, stockToRemove.price);
                  }
                  setShowRemovePrompt(false);
                  setStockToRemove(null);
                }}
              >
                <Text style={styles.editRemoveButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelRemoveButton} 
                onPress={() => {
                  setShowRemovePrompt(false);
                  setStockToRemove(null);
                }}
              >
                <Text style={styles.cancelRemoveButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Entry Price Edit Modal */}
      <Modal
        visible={editingSymbol !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingSymbol(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.entryPriceModalContent}>
            <Text style={styles.entryPriceModalTitle}>Input Your Purchase Price</Text>
            <Text style={styles.entryPriceModalSubtitle}>{editingCompanyName} ({editingSymbol})</Text>
            <View style={[styles.entryPriceInputContainer, priceError && styles.inputError]}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.entryPriceInput}
                placeholder="Enter price (e.g., 150.00)"
                placeholderTextColor="#7dd3fc"
                keyboardType="decimal-pad"
                value={entryPriceInput}
                onChangeText={(text) => {
                  setEntryPriceInput(text);
                  setPriceError(false);
                }}
                autoFocus
              />
            </View>
            <View style={[styles.sharesInputContainer, sharesError && styles.inputError]}>
              <Text style={styles.sharesLabel}>#</Text>
              <TextInput
                style={styles.sharesInput}
                placeholder="Number of shares (e.g., 100)"
                placeholderTextColor="#7dd3fc"
                keyboardType="decimal-pad"
                value={sharesInput}
                onChangeText={(text) => {
                  setSharesInput(text);
                  setSharesError(false);
                }}
              />
            </View>
            <View style={styles.entryPriceButtonRow}>
              <TouchableOpacity 
                style={styles.entrySaveButton} 
                onPress={saveEntryPrice}
              >
                <Text style={styles.entrySaveButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.entryCancelButton} 
                onPress={() => {
                  setEditingSymbol(null);
                  setEntryPriceInput('');
                }}
              >
                <Text style={styles.entryCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.entryPriceDisclaimer}>
              For your portfolio tracking only.{"\n"}
              This app does not buy or sell stock.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Share Prompt Modal */}
      <Modal
        visible={showSharePrompt}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSharePrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.shareModalContent}>
            <Text style={styles.shareModalTitle}>Congrats! You've added 5 stocks to your watch list.</Text>
            <Text style={styles.shareModalText}>
              Consider sharing this app with other investors. (This won't share your stocks.)
            </Text>
            <TouchableOpacity 
              style={styles.shareButton} 
              onPress={handleShareApp}
            >
              <Text style={styles.shareButtonText}>Share app</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.noThanksButton} 
              onPress={handleNoThanks}
            >
              <Text style={styles.noThanksButtonText}>No thanks</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.titleSection}>
        <Text style={styles.screenTitle}>Watch List ({watchedStocks.length})</Text>
        <Text style={styles.subtitle}>
          Tap <Text style={styles.starIcon}>☆</Text> to add or remove from your watch list
        </Text>
      </View>

      <View style={styles.filterButtonRow}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'positions' && styles.filterButtonActive]}
          onPress={() => setFilter('positions')}
        >
          <Text style={[styles.filterButtonText, filter === 'positions' && styles.filterButtonTextActive]}>My Portfolio</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>All Stocks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => {
            // @ts-ignore
            navigation.navigate('StockSearch', { symbolList });
          }}
        >
          <Text style={styles.searchButtonText}>Stock Search</Text>
        </TouchableOpacity>
      </View>

      {watchedStocks.length > 0 && (() => {
        const categoryCounts: { [key: string]: number } = {};
        const stocksToCount = filter === 'positions' 
          ? watchedStocks.filter(stock => stock.entryPrice !== undefined && stock.currentPrice !== undefined)
          : watchedStocks;
        
        stocksToCount.forEach(stock => {
          const stockInfo = symbolList.find(s => s.symbol === stock.symbol);
          if (stockInfo?.category) {
            categoryCounts[stockInfo.category] = (categoryCounts[stockInfo.category] || 0) + 1;
          }
        });
        const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
        
        if (sortedCategories.length > 0) {
          return (
            <View style={styles.categoryTally}>
              <Text style={styles.categoryTallyText}>
                Categories: {sortedCategories.map(([category, count]) => `${category.replace(/ /g, '\u00A0')}\u00A0(${count})`).join(', ')}
              </Text>
            </View>
          );
        }
        return null;
      })()}

      {filter === 'positions' && (() => {
        const positionStocks = watchedStocks.filter(stock => stock.entryPrice !== undefined && stock.currentPrice !== undefined);
        const totalInvested = positionStocks.reduce((sum, stock) => {
          return sum + ((stock.entryPrice || 0) * (stock.shares || 0));
        }, 0);
        const currentValue = positionStocks.reduce((sum, stock) => {
          return sum + ((stock.currentPrice || 0) * (stock.shares || 0));
        }, 0);
        const totalGain = currentValue - totalInvested;
        const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
        const gainColor = totalGain >= 0 ? '#00ff88' : '#ff4444';

        return (
          <View style={styles.portfolioSummary}>
            <Text style={styles.portfolioTitle}>Portfolio Summary</Text>
            <View style={styles.portfolioRow}>
              <Text style={styles.portfolioLabel}>Total Invested:</Text>
              <Text style={styles.portfolioValue}>${Math.round(totalInvested).toLocaleString()}</Text>
            </View>
            <View style={styles.portfolioRow}>
              <Text style={styles.portfolioLabel}>Current Value:</Text>
              <Text style={styles.portfolioValue}>${Math.round(currentValue).toLocaleString()}</Text>
            </View>
            <View style={styles.portfolioRow}>
              <Text style={styles.portfolioLabel}>Total Gain/Loss:</Text>
              <Text style={[styles.portfolioGain, { color: gainColor }]}>
                {totalGain >= 0 ? '+' : '-'}${Math.round(Math.abs(totalGain)).toLocaleString()} ({totalGain >= 0 ? '+' : ''}{totalGainPercent.toFixed(1)}%)
              </Text>
            </View>
          </View>
        );
      })()}

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
          data={filter === 'positions' ? watchedStocks.filter(stock => stock.entryPrice !== undefined) : watchedStocks}
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
    fontSize: 24,
    color: '#7dd3fc',
    lineHeight: 24,
  },
  filterButtonRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginVertical: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#00d4ff',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.3)',
  },
  filterButtonText: {
    color: '#7dd3fc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  filterButtonTextActive: {
    color: '#00d4ff',
  },
  searchButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#00d4ff',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#7dd3fc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryTally: {
    marginHorizontal: 12,
    marginTop: 0,
    marginBottom: 0,
    paddingVertical: 0,
  },
  categoryTallyText: {
    fontSize: 11,
    color: '#7dd3fc',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '500',
  },
  portfolioSummary: {
    backgroundColor: '#0a1929',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  portfolioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 6,
    textAlign: 'center',
  },
  portfolioRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  portfolioLabel: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  portfolioValue: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  portfolioGain: {
    fontSize: 14,
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
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 2,
  },
  tradesInfoContainer: {
    marginTop: 4,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  tradeText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  newBadge: {
    backgroundColor: '#00d4ff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0a1929',
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
  categoryText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  priceDataContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 2,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  starButton: {
    padding: 0,
    marginLeft: 8,
    marginTop: -4,
  },
  editButton: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  setEntryPriceButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#00d4ff',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  setEntryPriceButtonText: {
    color: '#00d4ff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  editButtonText: {
    fontSize: 12,
    color: '#7dd3fc',
    textAlign: 'right',
    fontStyle: 'italic',
    marginTop: 4,
  },
  entryPriceSection: {
    marginTop: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  entryPriceContainer: {
    width: '100%',
    alignItems: 'flex-end',
  },
  entryPriceLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 2,
    textAlign: 'right',
  },
  entryGainText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  trashIcon: {
    fontSize: 13,
    color: '#00d4ff',
    fontWeight: 'bold',
  },
  removeModalContent: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  removeModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  removeModalText: {
    fontSize: 16,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  removeModalCompanyName: {
    fontSize: 14,
    color: '#7dd3fc',
    textAlign: 'center',
    marginBottom: 24,
  },
  removeButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    flexWrap: 'wrap',
  },
  editRemoveButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#00d4ff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editRemoveButtonText: {
    color: '#0a1929',
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#ff4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelRemoveButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  cancelRemoveButtonText: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: '500',
  },
  entryPriceModalContent: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  entryPriceModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 8,
    textAlign: 'center',
  },
  entryPriceModalSubtitle: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 16,
    textAlign: 'center',
  },
  entryPriceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#0a1929',
    borderWidth: 1,
    borderColor: '#00d4ff',
    borderRadius: 8,
    paddingLeft: 12,
    marginBottom: 12,
  },
  dollarSign: {
    fontSize: 16,
    color: '#00d4ff',
    fontWeight: 'bold',
    marginRight: 4,
  },
  entryPriceInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  sharesInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#0a1929',
    borderWidth: 1,
    borderColor: '#00d4ff',
    borderRadius: 8,
    paddingLeft: 12,
    marginBottom: 20,
  },
  sharesLabel: {
    fontSize: 16,
    color: '#00d4ff',
    fontWeight: 'bold',
    marginRight: 4,
  },
  sharesInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  entryPriceButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  entrySaveButton: {
    flex: 1,
    backgroundColor: '#00d4ff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  entrySaveButtonText: {
    color: '#0a1929',
    fontSize: 16,
    fontWeight: 'bold',
  },
  entryCancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  entryCancelButtonText: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: '500',
  },
  entryPriceDisclaimer: {
    fontSize: 13,
    color: '#7dd3fc',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModalContent: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  shareModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 16,
    textAlign: 'center',
  },
  shareModalText: {
    fontSize: 16,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  shareButton: {
    backgroundColor: '#00d4ff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButtonText: {
    color: '#0a1929',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noThanksButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  noThanksButtonText: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default WatchList;
