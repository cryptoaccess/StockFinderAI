import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import CongressTradesService from '../services/CongressTradesService';
import InsiderTradesService from '../services/InsiderTradesService';

/**
 * AI Picks Screen
 * 
 * Displays top stock picks based on:
 * - Stocks with recent Congress or Insider purchases
 * - Filtered to only blue chip stocks (from saved preferences) or user's watchlist
 * - Scored by purchase frequency and recency
 * - Insider purchases weighted higher than Congress
 */

interface StockPick {
  id: string;
  ticker: string;
  companyName: string;
  priceChange: number;
  hasCongressPurchases: boolean;
  hasInsiderPurchases: boolean;
  congressPurchaseCount: number;
  insiderPurchaseCount: number;
  hasCongressSales: boolean;
  hasInsiderSales: boolean;
  congressSaleCount: number;
  insiderSaleCount: number;
  mostRecentCongressDate?: Date;
  mostRecentInsiderDate?: Date;
  hasPriceDip: boolean;
  dipPercentage?: number;
  dipDaysAgo?: number;
  dipScore?: number;
  score: number;
  reasons: string[];
}

export default function AIPicks({ navigation }: any) {
  const [picks, setPicks] = useState<StockPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [watchList, setWatchList] = useState<Array<{symbol: string, name: string}>>([]);
  const [symbolList, setSymbolList] = useState<Array<{symbol: string, name: string}>>([]);
  const [blueChipStocks, setBlueChipStocks] = useState<string[]>([]);
  const [showRankingsModal, setShowRankingsModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockPick | null>(null);

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    const watchListData = await loadWatchList();
    const blueChipData = await loadBlueChipList();
    await loadPicks(watchListData, blueChipData);
  };

  const loadWatchList = async () => {
    try {
      const saved = await AsyncStorage.getItem('watchList');
      let loadedWatchList: Array<{symbol: string, name: string}> = [];
      if (saved) {
        loadedWatchList = JSON.parse(saved);
        setWatchList(loadedWatchList);
      }
      // Also load symbol list for stock search
      const cachedSymbols = await AsyncStorage.getItem('stockSymbolList');
      if (cachedSymbols) {
        setSymbolList(JSON.parse(cachedSymbols));
      }
      return loadedWatchList;
    } catch (error) {
      console.error('Failed to load watch list:', error);
      return [];
    }
  };

  const loadBlueChipList = async () => {
    try {
      // Load the user's selected blue chip stocks from BlueChipDips preferences
      const savedStocks = await AsyncStorage.getItem('blueChipSelectedStocks');
      let loadedBlueChips: string[] = [];
      if (savedStocks) {
        loadedBlueChips = JSON.parse(savedStocks);
        setBlueChipStocks(loadedBlueChips);
      } else {
        // Fallback to all available stocks if user hasn't customized
        const savedAllStocks = await AsyncStorage.getItem('blueChipAllAvailableStocks');
        if (savedAllStocks) {
          loadedBlueChips = JSON.parse(savedAllStocks);
          setBlueChipStocks(loadedBlueChips);
        }
      }
      return loadedBlueChips;
    } catch (error) {
      console.error('Failed to load blue chip list:', error);
      return [];
    }
  };

  const formatDaysAgo = (date: Date | undefined): string => {
    if (!date || isNaN(date.getTime())) return '';
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 0) return 'recently'; // Future date edge case
    return `${diffDays} days ago`;
  };

  const checkPriceDip = async (ticker: string): Promise<{
    hasDip: boolean;
    dipPercentage?: number;
    daysAgo?: number;
    dipScore?: number;
  }> => {
    try {
      // Fetch 1 month of price data
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1mo&interval=1d`
      );

      const chartData = response.data.chart.result[0];
      const closePrices = chartData.indicators.quote[0].close;

      if (!closePrices || closePrices.length < 8) {
        return { hasDip: false };
      }

      const currentPrice = closePrices[closePrices.length - 1];
      let bestDipScore = 0;
      let bestDipPercentage = 0;
      let bestDaysAgo = 0;

      // Check for dips in the last 2-7 days
      for (let daysAgo = 2; daysAgo <= 7; daysAgo++) {
        if (closePrices.length <= daysAgo) continue;
        
        const pastPrice = closePrices[closePrices.length - 1 - daysAgo];
        if (!pastPrice || !currentPrice) continue;
        
        const dipPercentage = ((currentPrice - pastPrice) / pastPrice) * 100;
        
        // Check if it's a dip (negative percentage) between -2% and -5%
        if (dipPercentage >= -5 && dipPercentage <= -2) {
          // Calculate score: larger dips and more recent = higher score
          // Score range: 20-100 points
          const dipMagnitudeScore = Math.abs(dipPercentage) * 10; // 20-50 points for 2-5% dip
          const recencyMultiplier = (8 - daysAgo) / 6; // 1.0 for 2 days ago, 0.17 for 7 days ago
          const dipScore = dipMagnitudeScore * (1 + recencyMultiplier); // 40-100 points
          
          if (dipScore > bestDipScore) {
            bestDipScore = dipScore;
            bestDipPercentage = dipPercentage;
            bestDaysAgo = daysAgo;
          }
        }
      }

      if (bestDipScore > 0) {
        return {
          hasDip: true,
          dipPercentage: bestDipPercentage,
          daysAgo: bestDaysAgo,
          dipScore: bestDipScore
        };
      }

      return { hasDip: false };
    } catch (error) {
      console.log(`Error checking price dip for ${ticker}:`, error);
      return { hasDip: false };
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

  const loadPicks = async (
    watchListData?: Array<{symbol: string, name: string}>, 
    blueChipData?: string[]
  ) => {
    setLoading(true);
    try {
      console.log('Loading AI Picks...');
      
      // Use passed data or fall back to state
      const currentWatchList = watchListData || watchList;
      const currentBlueChips = blueChipData || blueChipStocks;
      
      // Fetch both Congress and Insider trades
      const [congressTrades, insiderTrades] = await Promise.all([
        CongressTradesService.getTrades(),
        InsiderTradesService.getTrades()
      ]);

      console.log(`Received ${congressTrades.length} congress trades, ${insiderTrades.length} insider trades`);

      // Separate purchases and sales
      const congressPurchases = congressTrades.filter(t => {
        const type = t.transactionType?.toLowerCase() || '';
        return type.includes('purchase') || type.includes('buy');
      });

      const congressSales = congressTrades.filter(t => {
        const type = t.transactionType?.toLowerCase() || '';
        return type.includes('sale') || type.includes('sell');
      });

      const insiderPurchases = insiderTrades.filter(t => {
        const type = t.transactionType?.toLowerCase() || '';
        return type.includes('purchase') || type.includes('buy');
      });

      const insiderSales = insiderTrades.filter(t => {
        const type = t.transactionType?.toLowerCase() || '';
        return type.includes('sale') || type.includes('sell');
      });

      // Count purchases and sales by ticker and track most recent dates
      const tickerData: Record<string, { 
        congressCount: number,
        congressSaleCount: number,
        insiderCount: number,
        insiderSaleCount: number,
        companyName: string,
        mostRecentDate: Date,
        mostRecentCongressDate?: Date,
        mostRecentInsiderDate?: Date
      }> = {};

      congressPurchases.forEach(t => {
        if (!tickerData[t.ticker]) {
          tickerData[t.ticker] = { 
            congressCount: 0,
            congressSaleCount: 0,
            insiderCount: 0,
            insiderSaleCount: 0,
            companyName: t.assetDescription || t.ticker,
            mostRecentDate: new Date(0)
          };
        }
        tickerData[t.ticker].congressCount++;
        
        // Track most recent purchase
        const tradeDate = new Date(t.transactionDate);
        if (!isNaN(tradeDate.getTime()) && tradeDate > tickerData[t.ticker].mostRecentDate) {
          tickerData[t.ticker].mostRecentDate = tradeDate;
        }
        
        // Track most recent Congress purchase specifically
        if (!isNaN(tradeDate.getTime())) {
          if (!tickerData[t.ticker].mostRecentCongressDate || tradeDate > tickerData[t.ticker].mostRecentCongressDate!) {
            tickerData[t.ticker].mostRecentCongressDate = tradeDate;
          }
        }
      });

      insiderPurchases.forEach(t => {
        if (!tickerData[t.ticker]) {
          tickerData[t.ticker] = { 
            congressCount: 0,
            congressSaleCount: 0,
            insiderCount: 0,
            insiderSaleCount: 0,
            companyName: t.companyName || t.ticker,
            mostRecentDate: new Date(0)
          };
        }
        tickerData[t.ticker].insiderCount++;
        
        // Update company name if we have a better one from insider trades
        if (t.companyName && t.companyName !== t.ticker) {
          tickerData[t.ticker].companyName = t.companyName;
        }
        
        // Track most recent purchase
        const tradeDate = new Date(t.transactionDate);
        if (!isNaN(tradeDate.getTime()) && tradeDate > tickerData[t.ticker].mostRecentDate) {
          tickerData[t.ticker].mostRecentDate = tradeDate;
        }
        
        // Track most recent Insider purchase specifically
        if (!isNaN(tradeDate.getTime())) {
          if (!tickerData[t.ticker].mostRecentInsiderDate || tradeDate > tickerData[t.ticker].mostRecentInsiderDate!) {
            tickerData[t.ticker].mostRecentInsiderDate = tradeDate;
          }
        }
      });

      // Track Congress sales
      congressSales.forEach(t => {
        if (!tickerData[t.ticker]) {
          tickerData[t.ticker] = { 
            congressCount: 0,
            congressSaleCount: 0,
            insiderCount: 0,
            insiderSaleCount: 0,
            companyName: t.assetDescription || t.ticker,
            mostRecentDate: new Date(0)
          };
        }
        tickerData[t.ticker].congressSaleCount++;
      });

      // Track Insider sales
      insiderSales.forEach(t => {
        if (!tickerData[t.ticker]) {
          tickerData[t.ticker] = { 
            congressCount: 0,
            congressSaleCount: 0,
            insiderCount: 0,
            insiderSaleCount: 0,
            companyName: t.companyName || t.ticker,
            mostRecentDate: new Date(0)
          };
        }
        tickerData[t.ticker].insiderSaleCount++;
        
        // Update company name if we have a better one from insider trades
        if (t.companyName && t.companyName !== t.ticker) {
          tickerData[t.ticker].companyName = t.companyName;
        }
      });

      // Create picks from ticker data
      const allPicks: StockPick[] = Object.keys(tickerData).map(ticker => {
        const data = tickerData[ticker];
        const hasCongressPurchases = data.congressCount > 0;
        const hasInsiderPurchases = data.insiderCount > 0;
        const hasCongressSales = data.congressSaleCount > 0;
        const hasInsiderSales = data.insiderSaleCount > 0;

        // Calculate score (higher is better)
        let score = 0;
        const reasons: string[] = [];

        // Recency bonus (more recent = higher score)
        const now = new Date();
        const daysAgo = Math.floor((now.getTime() - data.mostRecentDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo <= 7) {
          const recencyBonus = (8 - daysAgo) * 10; // 70 points for today, down to 10 for 7 days ago
          score += recencyBonus;
        } else if (daysAgo <= 14) {
          score += 5;
        }

        // Congress purchases (40 points each)
        if (hasCongressPurchases) {
          score += data.congressCount * 40;
          reasons.push(`${data.congressCount} Congress purchase${data.congressCount > 1 ? 's' : ''}`);
        }

        // Insider purchases (50 points each - higher priority)
        if (hasInsiderPurchases) {
          score += data.insiderCount * 50;
          reasons.push(`${data.insiderCount} Insider purchase${data.insiderCount > 1 ? 's' : ''}`);
        }

        // Congress sales (negative 40 points each)
        if (hasCongressSales) {
          score -= data.congressSaleCount * 40;
          reasons.push(`${data.congressSaleCount} Congress sale${data.congressSaleCount > 1 ? 's' : ''}`);
        }

        // Insider sales (negative 50 points each)
        if (hasInsiderSales) {
          score -= data.insiderSaleCount * 50;
          reasons.push(`${data.insiderSaleCount} Insider sale${data.insiderSaleCount > 1 ? 's' : ''}`);
        }

        return {
          id: ticker,
          ticker,
          companyName: data.companyName,
          priceChange: 0,
          hasCongressPurchases,
          hasInsiderPurchases,
          hasCongressSales,
          hasInsiderSales,
          congressPurchaseCount: data.congressCount,
          insiderPurchaseCount: data.insiderCount,
          congressSaleCount: data.congressSaleCount,
          insiderSaleCount: data.insiderSaleCount,
          mostRecentCongressDate: data.mostRecentCongressDate,
          mostRecentInsiderDate: data.mostRecentInsiderDate,
          hasPriceDip: false,
          score,
          reasons
        } as StockPick;
      });

      // Check for price dips and add dip scoring
      const picksWithDips = await Promise.all(
        allPicks.map(async (pick) => {
          const dipData = await checkPriceDip(pick.ticker);
          
          if (dipData.hasDip && dipData.dipScore) {
            pick.hasPriceDip = true;
            pick.dipPercentage = dipData.dipPercentage;
            pick.dipDaysAgo = dipData.daysAgo;
            pick.dipScore = dipData.dipScore;
            pick.score += dipData.dipScore;
            pick.reasons.push(`${Math.abs(dipData.dipPercentage!).toFixed(1)}% price dip (${dipData.daysAgo} days)`);
          }
          
          return pick;
        })
      );

      // Filter to only include blue chip stocks or stocks in user's watchlist
      const watchlistTickers = new Set(currentWatchList.map(w => w.symbol));
      const blueChipSet = new Set(currentBlueChips);
      
      const filteredPicks = picksWithDips.filter(pick => 
        blueChipSet.has(pick.ticker) || watchlistTickers.has(pick.ticker)
      );

      // Sort by score (highest first)
      filteredPicks.sort((a, b) => b.score - a.score);

      // Limit to top 10
      const top10Picks = filteredPicks.slice(0, 10);

      console.log(`Found ${top10Picks.length} AI picks (top 10 from ${filteredPicks.length} filtered, ${picksWithDips.length} total)`);
      console.log(`Filter: ${currentBlueChips.length} blue chips, ${currentWatchList.length} watchlist stocks`);
      setPicks(top10Picks);
      setLoading(false);
    } catch (error) {
      console.error('Error loading AI picks:', error);
      setPicks([]);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const watchListData = await loadWatchList();
    const blueChipData = await loadBlueChipList();
    await loadPicks(watchListData, blueChipData);
    setRefreshing(false);
  };

  const renderPickCard = ({ item }: { item: StockPick }) => {
    const isWatched = watchList.some(w => w.symbol === item.ticker);

    return (
      <View style={styles.pickCard}>
        <View style={styles.cardHeader}>
          <View style={styles.tickerCompanyRow}>
            <TouchableOpacity onPress={() => navigation.navigate('StockSearch', { preSelectedSymbol: item.ticker, symbolList })}>
              <Text style={styles.ticker}>{item.ticker}</Text>
            </TouchableOpacity>
            <Text style={styles.company} numberOfLines={1}>{item.companyName}</Text>
          </View>
          <TouchableOpacity
            onPress={() => toggleWatchListStock(item.ticker, item.companyName)}
            style={styles.starButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isWatched ? (
              <Text style={styles.starText}>★</Text>
            ) : (
              <Text style={[styles.starText, styles.starOutline]}>☆</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.scoreRow}>
          <TouchableOpacity 
            style={styles.scoreBadge}
            onPress={() => setSelectedStock(item)}
          >
            <Text style={styles.scoreLabel}>AI Score</Text>
            <Text style={styles.scoreValue}>{Math.round(item.score)}</Text>
          </TouchableOpacity>
          <View style={styles.reasonsContainer}>
            {item.reasons.map((reason, index) => (
              <View key={index} style={styles.reasonRow}>
                <Text style={styles.reasonBullet}>•</Text>
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.activityRow}>
          {item.hasInsiderPurchases && (
            <TouchableOpacity 
              style={styles.badge}
              onPress={() => navigation.navigate('InsiderTrades', { 
                preSelectedSymbol: item.ticker 
              })}
              activeOpacity={0.7}
            >
              <Text style={[styles.badgeText, { color: '#22c55e' }]}>
                {item.insiderPurchaseCount} Insider Buy
              </Text>
            </TouchableOpacity>
          )}
          {item.hasInsiderSales && (
            <TouchableOpacity 
              style={[styles.badge, { borderColor: '#ef4444' }]}
              onPress={() => navigation.navigate('InsiderTrades', { 
                preSelectedSymbol: item.ticker 
              })}
              activeOpacity={0.7}
            >
              <Text style={[styles.badgeText, { color: '#ef4444' }]}>
                {item.insiderSaleCount} Insider Sale
              </Text>
            </TouchableOpacity>
          )}
          {item.hasCongressPurchases && (
            <TouchableOpacity 
              style={styles.badge}
              onPress={() => navigation.navigate('CongressTrades')}
              activeOpacity={0.7}
            >
              <Text style={[styles.badgeText, { color: '#3b82f6' }]}>
                {item.congressPurchaseCount} Congress Buy
              </Text>
            </TouchableOpacity>
          )}
          {item.hasCongressSales && (
            <TouchableOpacity 
              style={[styles.badge, { borderColor: '#f97316' }]}
              onPress={() => navigation.navigate('CongressTrades')}
              activeOpacity={0.7}
            >
              <Text style={[styles.badgeText, { color: '#f97316' }]}>
                {item.congressSaleCount} Congress Sale
              </Text>
            </TouchableOpacity>
          )}
          {item.hasPriceDip && (
            <TouchableOpacity 
              style={[styles.badge, { borderColor: '#fbbf24' }]}
              onPress={() => navigation.navigate('StockSearch', { 
                preSelectedSymbol: item.ticker,
                symbolList 
              })}
              activeOpacity={0.7}
            >
              <Text style={[styles.badgeText, { color: '#fbbf24' }]}>
                {Math.abs(item.dipPercentage!).toFixed(1)}% Dip
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading && picks.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Picks</Text>
          <Text style={styles.subtitle}>
            Blue chip stocks and your Watch List stocks ranked by recent insider and Congress purchase activity. Data covers up to the last 30 days of activity.
          </Text>
          <TouchableOpacity
            style={styles.rankingsButton}
            onPress={() => setShowRankingsModal(true)}
          >
            <Text style={styles.rankingsButtonText}>Rankings Info</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00d4ff" />
          <Text style={styles.loadingText}>Analysing stocks...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Picks</Text>
        <Text style={styles.subtitle}>
          Blue chip stocks and your Watch List stocks ranked by recent insider and Congress purchase activity. Data covers up to the last 30 days of activity.
        </Text>
        <TouchableOpacity
          style={styles.rankingsButton}
          onPress={() => setShowRankingsModal(true)}
        >
          <Text style={styles.rankingsButtonText}>Rankings Info</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showRankingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRankingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowRankingsModal(false)}
          />
          <View style={styles.modalContent} pointerEvents="box-none">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How AI Picks Work</Text>
              <TouchableOpacity
                onPress={() => setShowRankingsModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stock Filtering</Text>
                <Text style={styles.sectionText}>
                  Only stocks from your Blue Chip list and Watch List are analyzed. This ensures you see opportunities in companies you're already interested in or have identified as quality investments.
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ranking Algorithm</Text>
                <Text style={styles.sectionText}>
                  Stocks are scored based on multiple factors:
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>1. Recency (0-70 points)</Text>
                <Text style={styles.sectionText}>
                  • Purchases within the last 7 days: 10-70 points (more recent = higher score)
                </Text>
                <Text style={styles.sectionText}>
                  • Purchases 8-14 days ago: 5 points
                </Text>
                <Text style={styles.sectionText}>
                  • Older purchases: 0 points
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>2. Insider Purchases (50 points each)</Text>
                <Text style={styles.sectionText}>
                  Company insiders (executives, directors, major shareholders) buying their own stock signals strong confidence. Each insider purchase adds 50 points to the score.
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>3. Congress Purchases (40 points each)</Text>
                <Text style={styles.sectionText}>
                  Members of Congress are required to disclose stock purchases. Each Congress member purchase adds 40 points.
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>4. Insider Sales (-50 points each)</Text>
                <Text style={styles.sectionText}>
                  When insiders sell their stock, it can signal lack of confidence in future performance. Each insider sale subtracts 50 points from the score.
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>5. Congress Sales (-40 points each)</Text>
                <Text style={styles.sectionText}>
                  Congressional stock sales are tracked and negatively impact the AI score. Each Congress member sale subtracts 40 points.
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>6. Price Dip Bonus (40-100 points)</Text>
                <Text style={styles.sectionText}>
                  Stocks with recent price dips get bonus points, making them buying opportunities:
                </Text>
                <Text style={styles.sectionText}>
                  • Dip must be 2-5% within the last 2-7 days
                </Text>
                <Text style={styles.sectionText}>
                  • Larger dips = more points (2% = 20 pts, 5% = 50 pts)
                </Text>
                <Text style={styles.sectionText}>
                  • More recent dips = higher multiplier (2x for 2 days ago, 1.17x for 7 days ago)
                </Text>
                <Text style={styles.sectionText}>
                  • Combined scoring range: 40-100 points
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Example Scoring</Text>
                <Text style={styles.sectionText}>
                  A stock with 2 insider purchases, 1 insider sale, 1 Congress purchase, and a 3.5% dip from 2 days ago (3 days old) would score:
                </Text>
                <Text style={styles.sectionText}>
                  • Recency: 50 points (8-3)×10
                </Text>
                <Text style={styles.sectionText}>
                  • Insider purchases: 100 points (2×50)
                </Text>
                <Text style={styles.sectionText}>
                  • Insider sales: -50 points (1×-50)
                </Text>
                <Text style={styles.sectionText}>
                  • Congress purchases: 40 points (1×40)
                </Text>
                <Text style={styles.sectionText}>
                  • Price dip bonus: 70 points (3.5% dip, 2 days ago)
                </Text>
                <Text style={styles.sectionText}>
                  • Total AI Score: 210 points
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Why This Matters</Text>
                <Text style={styles.sectionText}>
                  Insider and Congress purchases often precede positive price movements. Conversely, sales can signal concerns about future performance. Insiders have access to non-public information about their companies, making their trading activity a valuable indicator.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Score Detail Modal */}
      <Modal
        visible={selectedStock !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedStock(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedStock(null)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.scoreDetailModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedStock?.ticker} - Score Breakdown
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedStock(null)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.scoreDetailContent}>
              <View style={styles.scoreDetailRow}>
                <Text style={styles.scoreDetailLabel}>Company:</Text>
                <Text style={styles.scoreDetailValue}>{selectedStock?.companyName}</Text>
              </View>
              
              <View style={styles.scoreDetailDivider} />
              
              <View style={styles.scoreDetailRow}>
                <Text style={styles.scoreDetailLabel}>Total AI Score:</Text>
                <Text style={[styles.scoreDetailValue, styles.scoreDetailTotal]}>
                  {selectedStock ? Math.round(selectedStock.score) : 0} points
                </Text>
              </View>
              
              <View style={styles.scoreDetailDivider} />
              
              <Text style={styles.scoreDetailSectionTitle}>Score Components:</Text>
              
              {selectedStock?.hasInsiderPurchases && (
                <View>
                  <View style={styles.scoreComponentRow}>
                    <Text style={styles.scoreComponentLabel}>
                      • Insider Purchases ({selectedStock.insiderPurchaseCount})
                    </Text>
                    <Text style={styles.scoreComponentValue}>
                      +{selectedStock.insiderPurchaseCount * 50} pts
                    </Text>
                  </View>
                  {selectedStock.mostRecentInsiderDate && (
                    <Text style={styles.dateRangeText}>
                      Most recent: {formatDaysAgo(selectedStock.mostRecentInsiderDate)}
                    </Text>
                  )}
                </View>
              )}
              
              {selectedStock?.hasInsiderSales && (
                <View>
                  <View style={styles.scoreComponentRow}>
                    <Text style={styles.scoreComponentLabel}>
                      • Insider Sales ({selectedStock.insiderSaleCount})
                    </Text>
                    <Text style={[styles.scoreComponentValue, { color: '#ef4444' }]}>
                      -{selectedStock.insiderSaleCount * 50} pts
                    </Text>
                  </View>
                </View>
              )}
              
              {selectedStock?.hasCongressPurchases && (
                <View>
                  <View style={styles.scoreComponentRow}>
                    <Text style={styles.scoreComponentLabel}>
                      • Congress Purchases ({selectedStock.congressPurchaseCount})
                    </Text>
                    <Text style={styles.scoreComponentValue}>
                      +{selectedStock.congressPurchaseCount * 40} pts
                    </Text>
                  </View>
                  {selectedStock.mostRecentCongressDate && (
                    <Text style={styles.dateRangeText}>
                      Most recent: {formatDaysAgo(selectedStock.mostRecentCongressDate)}
                    </Text>
                  )}
                </View>
              )}
              
              {selectedStock?.hasCongressSales && (
                <View>
                  <View style={styles.scoreComponentRow}>
                    <Text style={styles.scoreComponentLabel}>
                      • Congress Sales ({selectedStock.congressSaleCount})
                    </Text>
                    <Text style={[styles.scoreComponentValue, { color: '#f97316' }]}>
                      -{selectedStock.congressSaleCount * 40} pts
                    </Text>
                  </View>
                </View>
              )}
              
              {selectedStock?.hasPriceDip && selectedStock.dipScore && (
                <View>
                  <View style={styles.scoreComponentRow}>
                    <Text style={styles.scoreComponentLabel}>
                      • Price Dip Bonus
                    </Text>
                    <Text style={styles.scoreComponentValue}>
                      +{Math.round(selectedStock.dipScore)} pts
                    </Text>
                  </View>
                  <Text style={styles.dateRangeText}>
                    {Math.abs(selectedStock.dipPercentage!).toFixed(1)}% dip, {selectedStock.dipDaysAgo} days ago
                  </Text>
                </View>
              )}
              
              <View style={styles.scoreComponentRow}>
                <Text style={styles.scoreComponentLabel}>
                  • Recency Bonus
                </Text>
                <Text style={styles.scoreComponentValue}>
                  +{selectedStock ? Math.round(selectedStock.score - 
                    (selectedStock.insiderPurchaseCount * 50) - 
                    (selectedStock.congressPurchaseCount * 40) -
                    (selectedStock.dipScore || 0) +
                    (selectedStock.insiderSaleCount * 50) +
                    (selectedStock.congressSaleCount * 40)) : 0} pts
                </Text>
              </View>
            </View>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <FlatList
        data={picks}
        keyExtractor={(item) => item.id}
        renderItem={renderPickCard}
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
            <Text style={styles.emptyText}>No AI picks found</Text>
            <Text style={styles.emptySubtext}>
              Looking for stocks with 3-5% dips and insider/Congress purchases
            </Text>
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
                All rights reserved. © 2025, Malachi J. King
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
    color: '#94a3b8',
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
  listContainer: {
    padding: 10,
    paddingBottom: 20,
  },
  pickCard: {
    backgroundColor: '#0a1929',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tickerCompanyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  ticker: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00d4ff',
    letterSpacing: 0.5,
  },
  company: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    flexShrink: 1,
  },
  starButton: {
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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 0,
  },
  scoreBadge: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#00d4ff',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  priceChangeContainer: {
    alignItems: 'flex-start',
  },
  priceChange: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceChangeLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  reasonsContainer: {
    flex: 1,
    marginLeft: 12,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  reasonBullet: {
    color: '#00d4ff',
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  reasonText: {
    color: '#cbd5e1',
    fontSize: 13,
    flex: 1,
  },
  activityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rankingsButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#00d4ff',
    marginTop: 12,
    alignSelf: 'center',
  },
  rankingsButtonText: {
    color: '#00d4ff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#64748b',
    fontWeight: '300',
  },
  modalScroll: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
    marginBottom: 6,
  },
  subsection: {
    marginBottom: 20,
    marginLeft: 8,
  },
  subsectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 6,
  },
  scoreDetailModal: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  scoreDetailContent: {
    padding: 20,
  },
  scoreDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreDetailLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  scoreDetailValue: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '600',
    flexShrink: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  scoreDetailTotal: {
    fontSize: 18,
    color: '#00d4ff',
    fontWeight: 'bold',
  },
  scoreDetailDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  scoreDetailSectionTitle: {
    fontSize: 15,
    color: '#00d4ff',
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 4,
  },
  scoreComponentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreComponentLabel: {
    fontSize: 14,
    color: '#cbd5e1',
    flex: 1,
  },
  scoreComponentValue: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
    marginLeft: 12,
  },
  dateRangeText: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 16,
    marginTop: -6,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  disclaimerSection: {
    padding: 20,
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
