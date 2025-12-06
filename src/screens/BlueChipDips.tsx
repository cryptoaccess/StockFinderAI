import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

const DEFAULT_BLUE_CHIPS = [
  'AA', 'AAPL', 'ABBV', 'AMD', 'AVGO', 'AXON', 'BAC', 'BMY', 'BRK.B', 'BUD',
  'C', 'CAT', 'CI', 'COKE', 'COST', 'CRWD', 'CVX', 'DD', 'DELL', 'DHR',
  'DIS', 'F', 'GE', 'GM', 'GOOGL', 'GS', 'HD', 'HON', 'HPE', 'IBM',
  'INTC', 'JCI', 'JNJ', 'JPM', 'KO', 'KR', 'LLY', 'LMT', 'MA', 'MCD',
  'META', 'MNST', 'MRCK', 'MRK', 'MSFT', 'NFLX', 'NKE', 'NOC', 'NOW', 'NSRGY',
  'NVDA', 'ORCL', 'PEP', 'PFE', 'PG', 'PLTR', 'PYPL', 'RHHBY', 'SBUX', 'SMCI',
  'SNY', 'SONY', 'T', 'TMO', 'TSLA', 'TSM', 'UNH', 'V', 'VZ', 'WMT', 'XOM'
];

const COMPANY_NAMES: { [key: string]: string } = {
  'AA': 'Alcoa Corp',
  'AAPL': 'Apple Inc',
  'ABBV': 'AbbVie Inc',
  'AMD': 'Advanced Micro Devices',
  'AVGO': 'Broadcom Inc',
  'AXON': 'Axon Enterprise',
  'BAC': 'Bank of America',
  'BMY': 'Bristol Myers Squibb',
  'BRK.B': 'Berkshire Hathaway',
  'BUD': 'Anheuser-Busch InBev',
  'C': 'Citigroup Inc',
  'CAT': 'Caterpillar Inc',
  'CI': 'Cigna Corp',
  'COKE': 'Coca-Cola Consolidated',
  'COST': 'Costco Wholesale',
  'CRWD': 'CrowdStrike Holdings',
  'CVX': 'Chevron Corp',
  'DD': 'DuPont de Nemours',
  'DELL': 'Dell Technologies',
  'DHR': 'Danaher Corp',
  'DIS': 'Walt Disney Company',
  'F': 'Ford Motor Company',
  'GE': 'General Electric',
  'GM': 'General Motors',
  'GOOGL': 'Alphabet Inc',
  'GS': 'Goldman Sachs',
  'HD': 'Home Depot',
  'HON': 'Honeywell International',
  'HPE': 'Hewlett Packard Enterprise',
  'IBM': 'IBM Corp',
  'INTC': 'Intel Corp',
  'JCI': 'Johnson Controls',
  'JNJ': 'Johnson & Johnson',
  'JPM': 'JPMorgan Chase',
  'KO': 'Coca-Cola Company',
  'KR': 'Kroger Company',
  'LLY': 'Eli Lilly and Company',
  'LMT': 'Lockheed Martin',
  'MA': 'Mastercard Inc',
  'MCD': 'McDonald\'s Corp',
  'META': 'Meta Platforms',
  'MNST': 'Monster Beverage',
  'MRCK': 'Merck KGaA',
  'MRK': 'Merck & Co',
  'MSFT': 'Microsoft Corp',
  'NFLX': 'Netflix Inc',
  'NKE': 'Nike Inc',
  'NOC': 'Northrop Grumman',
  'NOW': 'ServiceNow Inc',
  'NSRGY': 'Nestlé SA',
  'NVDA': 'NVIDIA Corp',
  'ORCL': 'Oracle Corp',
  'PEP': 'PepsiCo Inc',
  'PFE': 'Pfizer Inc',
  'PG': 'Procter & Gamble',
  'PLTR': 'Palantir Technologies',
  'PYPL': 'PayPal Holdings',
  'RHHBY': 'Roche Holding AG',
  'SBUX': 'Starbucks Corp',
  'SMCI': 'Super Micro Computer',
  'SNY': 'Sanofi SA',
  'SONY': 'Sony Group Corp',
  'T': 'AT&T Inc',
  'TMO': 'Thermo Fisher Scientific',
  'TSLA': 'Tesla Inc',
  'TSM': 'Taiwan Semiconductor',
  'UNH': 'UnitedHealth Group',
  'V': 'Visa Inc',
  'VZ': 'Verizon Communications',
  'WMT': 'Walmart Inc',
  'XOM': 'Exxon Mobil Corp'
};

interface StockDipData {
  symbol: string;
  companyName: string;
  currentPrice: number;
  dipPercentage: number;
  priceXDaysAgo: number;
  growth90Day: number;
  price90DaysAgo: number;
  expanded?: boolean;
  chartPrices?: number[];
  chartDates?: string[];
  headlines?: Array<{ title: string; link: string; pubDate: string }>;
  loadingChart?: boolean;
}

const BlueChipDips: React.FC = () => {
  const navigation = useNavigation();
  const [selectedStocks, setSelectedStocks] = useState<string[]>(DEFAULT_BLUE_CHIPS);
  const [dayPeriod, setDayPeriod] = useState<number>(2); // Default 2 days
  const [dipThreshold, setDipThreshold] = useState<number>(-2); // Default -2%
  const [growthThreshold, setGrowthThreshold] = useState<number>(10); // Default 10% 90-day growth
  const [stockData, setStockData] = useState<StockDipData[]>([]);
  const [allStockData, setAllStockData] = useState<StockDipData[]>([]); // Store all fetched data
  const [loading, setLoading] = useState<boolean>(false);
  const [showStockPicker, setShowStockPicker] = useState<boolean>(false);
  const [showDayPicker, setShowDayPicker] = useState<boolean>(false);
  const [showThresholdPicker, setShowThresholdPicker] = useState<boolean>(false);
  const [showGrowthPicker, setShowGrowthPicker] = useState<boolean>(false);
  const [newStockSymbol, setNewStockSymbol] = useState<string>('');
  const [allAvailableStocks, setAllAvailableStocks] = useState<string[]>(DEFAULT_BLUE_CHIPS);
  const [watchList, setWatchList] = useState<Array<{symbol: string, name: string}>>([]);
  const [symbolList, setSymbolList] = useState<Array<{symbol: string, name: string}>>([]);
  const [invalidStockError, setInvalidStockError] = useState<boolean>(false);
  const [duplicateStockError, setDuplicateStockError] = useState<boolean>(false);

  const dayOptions = [2, 3, 5, 7];
  const thresholdOptions = [-2, -3, -4, -5];
  const growthOptions = [5, 10, 15, 20, 25, 30];

  // Load symbol list from cache
  useEffect(() => {
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
    loadSymbolList();
  }, []);

  const generateDateLabels = (dates: string[]): string[] => {
    if (dates.length === 0) return [];
    
    // Extract unique month names from the dates
    const monthNames: string[] = [];
    const seenMonths = new Set<string>();
    
    dates.forEach(dateStr => {
      const date = new Date(dateStr);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      if (!seenMonths.has(monthName)) {
        seenMonths.add(monthName);
        monthNames.push(monthName);
      }
    });
    
    return monthNames;
  };

  useEffect(() => {
    loadPreferences();
    loadWatchList();
  }, []);

  const loadWatchList = async () => {
    try {
      const saved = await AsyncStorage.getItem('watchList');
      if (saved) {
        setWatchList(JSON.parse(saved));
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

  useEffect(() => {
    if (selectedStocks.length > 0) {
      fetchDipData();
    }
  }, [selectedStocks, dayPeriod]);

  const loadPreferences = async () => {
    try {
      const savedStocks = await AsyncStorage.getItem('blueChipSelectedStocks');
      const savedDayPeriod = await AsyncStorage.getItem('blueChipDayPeriod');
      const savedThreshold = await AsyncStorage.getItem('blueChipDipThreshold');
      const savedGrowthThreshold = await AsyncStorage.getItem('blueChipGrowthThreshold');
      const savedAllStocks = await AsyncStorage.getItem('blueChipAllAvailableStocks');

      if (savedStocks) {
        setSelectedStocks(JSON.parse(savedStocks));
      } else {
        // First time - save the default blue chips
        await AsyncStorage.setItem('blueChipSelectedStocks', JSON.stringify(DEFAULT_BLUE_CHIPS));
      }
      if (savedDayPeriod) {
        setDayPeriod(parseInt(savedDayPeriod));
      }
      if (savedThreshold) {
        setDipThreshold(parseFloat(savedThreshold));
      }
      if (savedGrowthThreshold) {
        setGrowthThreshold(parseFloat(savedGrowthThreshold));
      }
      if (savedAllStocks) {
        setAllAvailableStocks(JSON.parse(savedAllStocks));
      } else {
        // First time - save the default blue chips as available stocks
        await AsyncStorage.setItem('blueChipAllAvailableStocks', JSON.stringify(DEFAULT_BLUE_CHIPS));
      }
    } catch (error) {
      console.log('Error loading preferences:', error);
    }
  };

  const savePreferences = async (overrides?: { 
    growthThreshold?: number;
    dipThreshold?: number;
    dayPeriod?: number;
  }) => {
    try {
      await AsyncStorage.setItem('blueChipSelectedStocks', JSON.stringify(selectedStocks));
      await AsyncStorage.setItem('blueChipDayPeriod', (overrides?.dayPeriod ?? dayPeriod).toString());
      await AsyncStorage.setItem('blueChipDipThreshold', (overrides?.dipThreshold ?? dipThreshold).toString());
      await AsyncStorage.setItem('blueChipGrowthThreshold', (overrides?.growthThreshold ?? growthThreshold).toString());
      await AsyncStorage.setItem('blueChipAllAvailableStocks', JSON.stringify(allAvailableStocks));
    } catch (error) {
      console.log('Error saving preferences:', error);
    }
  };

  const fetchDipData = async () => {
    setLoading(true);
    const results: StockDipData[] = [];

    try {
      // Fetch data for all selected stocks
      const promises = selectedStocks.map(async (symbol) => {
        try {
          // Fetch 3 months of data to calculate 90-day growth
          const response = await axios.get(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`
          );

          const chartData = response.data.chart.result[0];
          const timestamps = chartData.timestamp;
          const closePrices = chartData.indicators.quote[0].close;

          if (!timestamps || !closePrices || closePrices.length < dayPeriod + 1) {
            return null;
          }

          // Get current price (most recent close)
          const currentPrice = closePrices[closePrices.length - 1];
          
          // Get price from X days ago (counting backwards from most recent)
          const priceXDaysAgo = closePrices[closePrices.length - 1 - dayPeriod];

          // Get price from 90 days ago (first available price)
          const price90DaysAgo = closePrices[0];

          if (!currentPrice || !priceXDaysAgo || !price90DaysAgo) {
            return null;
          }

          // Calculate dip percentage
          const dipPercentage = ((currentPrice - priceXDaysAgo) / priceXDaysAgo) * 100;

          // Calculate 90-day growth percentage
          const growth90Day = ((currentPrice - price90DaysAgo) / price90DaysAgo) * 100;

          return {
            symbol,
            companyName: COMPANY_NAMES[symbol] || symbol,
            currentPrice,
            dipPercentage,
            priceXDaysAgo,
            growth90Day,
            price90DaysAgo,
          };
        } catch (error) {
          console.log(`Error fetching data for ${symbol}:`, error);
          return null;
        }
      });

      const allResults = await Promise.all(promises);
      
      // Filter out nulls
      const validResults = allResults.filter(
        (result): result is StockDipData => result !== null
      );

      // Sort by dip percentage (most negative first)
      validResults.sort((a, b) => a.dipPercentage - b.dipPercentage);

      // Store all data
      setAllStockData(validResults);
      
      // Apply current filters
      const filtered = validResults.filter(
        stock => stock.dipPercentage <= dipThreshold && stock.growth90Day >= growthThreshold
      );
      setStockData(filtered);
    } catch (error) {
      console.log('Error fetching dip data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStock = (symbol: string) => {
    setSelectedStocks(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  };

  const selectAllStocks = () => {
    setSelectedStocks([...allAvailableStocks]);
  };

  const deselectAllStocks = () => {
    setSelectedStocks([]);
  };

  const addNewStock = () => {
    const symbol = newStockSymbol.trim().toUpperCase();
    if (!symbol) return;

    // Check if symbol already exists in the list
    if (allAvailableStocks.includes(symbol)) {
      setDuplicateStockError(true);
      setNewStockSymbol('');
      // Hide error after 3 seconds
      setTimeout(() => setDuplicateStockError(false), 3000);
      return;
    }

    // Check if symbol exists in the top 500 stock list
    const isValidSymbol = symbolList.some(stock => stock.symbol === symbol);
    
    if (!isValidSymbol) {
      // Show error message
      setInvalidStockError(true);
      setNewStockSymbol('');
      // Hide error after 3 seconds
      setTimeout(() => setInvalidStockError(false), 3000);
      return;
    }

    // Valid symbol - add it
    const updatedStocks = [...allAvailableStocks, symbol].sort();
    setAllAvailableStocks(updatedStocks);
    setSelectedStocks(prev => [...prev, symbol]);
    setNewStockSymbol('');
    setInvalidStockError(false);
    setDuplicateStockError(false);
  };

  const applyStockSelection = () => {
    setShowStockPicker(false);
    savePreferences();
  };

  const applyDayPeriod = (days: number) => {
    setDayPeriod(days);
    setShowDayPicker(false);
    savePreferences({ dayPeriod: days });
  };

  const applyThreshold = (threshold: number) => {
    setDipThreshold(threshold);
    setShowThresholdPicker(false);
    savePreferences({ dipThreshold: threshold });
    // Filter existing data
    const filtered = allStockData.filter(
      stock => stock.dipPercentage <= threshold && stock.growth90Day >= growthThreshold
    );
    setStockData(filtered);
  };

  const applyGrowthThreshold = (threshold: number) => {
    setGrowthThreshold(threshold);
    setShowGrowthPicker(false);
    savePreferences({ growthThreshold: threshold });
    // Filter existing data
    const filtered = allStockData.filter(
      stock => stock.dipPercentage <= dipThreshold && stock.growth90Day >= threshold
    );
    setStockData(filtered);
  };

  const toggleExpanded = async (symbol: string) => {
    setStockData(prev => prev.map(stock => {
      if (stock.symbol === symbol) {
        const isExpanding = !stock.expanded;
        
        // If expanding and no chart data yet, fetch it
        if (isExpanding && !stock.chartPrices) {
          fetchChartAndHeadlines(symbol);
          return { ...stock, expanded: true, loadingChart: true };
        }
        
        return { ...stock, expanded: !stock.expanded };
      }
      // Collapse all other stocks when expanding this one
      return { ...stock, expanded: false };
    }));
  };

  const fetchChartAndHeadlines = async (symbol: string) => {
    try {
      // Fetch chart data
      const chartResponse = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`
      );
      
      const chartData = chartResponse.data.chart.result[0];
      const timestamps = chartData.timestamp;
      const closePrices = chartData.indicators.quote[0].close;
      
      // Process chart data
      const prices: number[] = [];
      const dates: string[] = [];
      
      if (timestamps && closePrices) {
        timestamps.forEach((timestamp: number, index: number) => {
          const price = closePrices[index];
          if (price !== null && price !== undefined) {
            prices.push(price);
            dates.push(new Date(timestamp * 1000).toISOString().split('T')[0]);
          }
        });
      }
      
      // Fetch headlines
      let headlines: Array<{ title: string; link: string; pubDate: string }> = [];
      try {
        const headlinesResponse = await axios.get(
          `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US`,
          { headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' } }
        );
        
        const rssText = headlinesResponse.data;
        
        // Parse RSS items with multiple title format attempts
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const items = [...rssText.matchAll(itemRegex)];
        
        for (let i = 0; i < Math.min(items.length, 3); i++) {
          const itemContent = items[i][1];
          
          // Try CDATA format first
          let titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
          if (!titleMatch) {
            // Try plain text format
            titleMatch = itemContent.match(/<title>(.*?)<\/title>/);
          }
          
          const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
          const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
          
          if (titleMatch && linkMatch) {
            let pubDateStr = 'Recent';
            if (pubDateMatch) {
              const date = new Date(pubDateMatch[1]);
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const year = date.getFullYear();
              pubDateStr = `${month}/${day}/${year}`;
            }
            
            headlines.push({
              title: titleMatch[1],
              link: linkMatch[1],
              pubDate: pubDateStr
            });
          }
        }
      } catch (error) {
        console.log(`Error fetching headlines for ${symbol}:`, error);
      }
      
      // Update stock data with chart and headlines
      setStockData(prev => prev.map(stock => {
        if (stock.symbol === symbol) {
          return {
            ...stock,
            chartPrices: prices,
            chartDates: dates,
            headlines,
            loadingChart: false
          };
        }
        return stock;
      }));
    } catch (error) {
      console.log(`Error fetching chart/headlines for ${symbol}:`, error);
      
      // Update to show error state
      setStockData(prev => prev.map(stock => {
        if (stock.symbol === symbol) {
          return { ...stock, loadingChart: false, headlines: [] };
        }
        return stock;
      }));
    }
  };

  const renderStockItem = ({ item }: { item: StockDipData }) => {
    const dipColor = item.dipPercentage < 0 ? '#ff4444' : '#00ff88';
    const growthColor = item.growth90Day >= 0 ? '#00ff88' : '#ff4444';
    const isWatched = watchList.some(w => w.symbol === item.symbol);
    
    return (
      <View style={styles.stockCard}>
        <View style={styles.stockHeader}>
          <View style={styles.stockTitleContainer}>
            <View style={styles.symbolRow}>
              <Text style={styles.symbolText}>{item.symbol}</Text>
              <TouchableOpacity
                onPress={() => toggleWatchListStock(item.symbol, item.companyName)}
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
            <Text style={styles.companyNameText}>{item.companyName}</Text>
          </View>
          <View style={styles.changeContainer}>
            <Text style={[styles.dipText, { color: dipColor }]}>
              {dayPeriod} day dip: {item.dipPercentage.toFixed(1)}%
            </Text>
            <Text style={[styles.growthText, { color: growthColor }]}>
              90 day growth: +{item.growth90Day.toFixed(1)}%
            </Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Current:</Text>
          <Text style={styles.priceValue}>${item.currentPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{dayPeriod} days ago:</Text>
          <Text style={styles.priceValue}>${item.priceXDaysAgo.toFixed(2)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>90 days ago:</Text>
          <Text style={styles.priceValue}>${item.price90DaysAgo.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => toggleExpanded(item.symbol)}
        >
          <Text style={styles.detailsButtonText}>
            {item.expanded ? 'Minimize ▲' : 'Graph and Headlines ▼'}
          </Text>
        </TouchableOpacity>
        
        {/* Expanded Chart and Headlines Section */}
        {item.expanded && (
          <View style={styles.expandedSection}>
            {item.loadingChart ? (
              <ActivityIndicator size="small" color="#00d4ff" style={{ marginVertical: 20 }} />
            ) : (
              <>
                {/* Chart */}
                {item.chartPrices && item.chartPrices.length > 0 && (
                  <View style={styles.chartSection}>
                    <LineChart
                      data={{
                        labels: generateDateLabels(item.chartDates || []),
                        datasets: [{
                          data: item.chartPrices,
                          color: (opacity = 1) => `rgba(0, 212, 255, 0.6)`,
                          strokeWidth: 2
                        }],
                      }}
                      width={screenWidth - 64}
                      height={120}
                      chartConfig={{
                        backgroundGradientFrom: '#0a1929',
                        backgroundGradientTo: '#0a1929',
                        color: (opacity = 1) => `rgba(0, 212, 255, 0.6)`,
                        strokeWidth: 2,
                        propsForDots: { r: '0' },
                        propsForBackgroundLines: { strokeWidth: 0 },
                        labelColor: () => '#7dd3fc',
                        style: { borderRadius: 16 }
                      }}
                      withDots={false}
                      withInnerLines={false}
                      withOuterLines={false}
                      withVerticalLabels={true}
                      withHorizontalLabels={true}
                      withShadow={false}
                      bezier
                      style={styles.chart}
                      verticalLabelRotation={0}
                      fromZero={false}
                      segments={4}
                      formatYLabel={(value) => `$${value}`}
                    />
                    <View style={styles.dayLabelsContainer}>
                      {generateDateLabels(item.chartDates || []).map((label, index) => (
                        <Text key={index} style={styles.dayLabel}>{label}</Text>
                      ))}
                    </View>
                  </View>
                )}
                
                {/* Headlines */}
                <View style={styles.headlinesSection}>
                  <Text style={styles.headlinesTitle}>Recent Headlines:</Text>
                  {item.headlines && item.headlines.length > 0 ? (
                    item.headlines.map((headline, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => Linking.openURL(headline.link)}
                        style={styles.headlineItem}
                      >
                        <Text style={styles.headlineDate}>{headline.pubDate}</Text>
                        <Text style={styles.headlineText}>{headline.title}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.noHeadlinesText}>No recent headlines available.</Text>
                  )}
                </View>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleSection}>
        <Text style={styles.screenTitle}>Blue Chip Dips</Text>
        <Text style={styles.subtitle}>Large established stocks in a recent price dip</Text>
      </View>
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowThresholdPicker(true)}
        >
          <Text style={styles.filterButtonText}>{dipThreshold}% Dip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowDayPicker(true)}
        >
          <Text style={styles.filterButtonText}>{dayPeriod} Day</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowGrowthPicker(true)}
        >
          <Text style={styles.filterButtonText}>{growthThreshold}% 90d</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowStockPicker(true)}
        >
          <Text style={styles.filterButtonText}>
            Stocks ({selectedStocks.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Analyzing stocks...</Text>
        </View>
      ) : stockData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No stocks meet both criteria: {dipThreshold}% dip over {dayPeriod} days AND {growthThreshold}% growth over 90 days
          </Text>
        </View>
      ) : (
        <FlatList
          data={stockData}
          renderItem={renderStockItem}
          keyExtractor={(item) => item.symbol}
          contentContainerStyle={styles.listContainer}
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
      )}

      {/* Day Period Picker Modal */}
      <Modal
        visible={showDayPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDayPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Time Period</Text>
            {dayOptions.map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.modalOption,
                  dayPeriod === days && styles.modalOptionSelected
                ]}
                onPress={() => applyDayPeriod(days)}
              >
                <Text style={[
                  styles.modalOptionText,
                  dayPeriod === days && styles.modalOptionTextSelected
                ]}>
                  {days} Days
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowDayPicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Threshold Picker Modal */}
      <Modal
        visible={showThresholdPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowThresholdPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Dip Threshold</Text>
            {thresholdOptions.map((threshold) => (
              <TouchableOpacity
                key={threshold}
                style={[
                  styles.modalOption,
                  dipThreshold === threshold && styles.modalOptionSelected
                ]}
                onPress={() => applyThreshold(threshold)}
              >
                <Text style={[
                  styles.modalOptionText,
                  dipThreshold === threshold && styles.modalOptionTextSelected
                ]}>
                  {threshold}% or more
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowThresholdPicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Growth Threshold Picker Modal */}
      <Modal
        visible={showGrowthPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGrowthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Minimum 90-Day Growth</Text>
            {growthOptions.map((growth) => (
              <TouchableOpacity
                key={growth}
                style={[
                  styles.modalOption,
                  growthThreshold === growth && styles.modalOptionSelected
                ]}
                onPress={() => applyGrowthThreshold(growth)}
              >
                <Text style={[
                  styles.modalOptionText,
                  growthThreshold === growth && styles.modalOptionTextSelected
                ]}>
                  {growth}% or more
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowGrowthPicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Stock Picker Modal */}
      <Modal
        visible={showStockPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStockPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.stockPickerModal]}>
            <Text style={styles.modalTitle}>Select Stocks for the Blue Chip List</Text>
            
            <View style={styles.selectAllRow}>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={selectAllStocks}
              >
                <Text style={styles.selectAllText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={deselectAllStocks}
              >
                <Text style={styles.selectAllText}>Deselect All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addStockRow}>
              <TextInput
                style={styles.addStockInput}
                placeholder="Add stock symbol"
                placeholderTextColor="#64748b"
                value={newStockSymbol}
                onChangeText={(text) => {
                  setNewStockSymbol(text);
                  setInvalidStockError(false);
                  setDuplicateStockError(false);
                }}
                autoCapitalize="characters"
                maxLength={10}
              />
              <TouchableOpacity
                style={styles.addStockButton}
                onPress={addNewStock}
              >
                <Text style={styles.addStockButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            {invalidStockError && (
              <Text style={styles.errorMessage}>Only blue chip stocks can be entered</Text>
            )}
            {duplicateStockError && (
              <Text style={styles.errorMessage}>That stock is already on the list</Text>
            )}

            <ScrollView style={styles.stockList}>
              {allAvailableStocks.map((symbol) => (
                <TouchableOpacity
                  key={symbol}
                  style={styles.checkboxRow}
                  onPress={() => toggleStock(symbol)}
                >
                  <View style={styles.checkbox}>
                    {selectedStocks.includes(symbol) && (
                      <View style={styles.checkboxChecked} />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>{symbol}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalApplyButton}
                onPress={applyStockSelection}
              >
                <Text style={styles.modalApplyText}>
                  Apply ({selectedStocks.length} selected)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowStockPicker(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginTop: 4,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.3)',
  },
  filterButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.4)',
  },
  filterButtonText: {
    color: '#00d4ff',
    fontSize: 15,
    fontWeight: '700',
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
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#7dd3fc',
    textAlign: 'center',
  },
  listContainer: {
    padding: 12,
  },
  stockCard: {
    backgroundColor: '#0a1929',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
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
    marginBottom: 8,
  },
  stockTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  starButton: {
    padding: 2,
  },
  starText: {
    fontSize: 20,
    color: '#fff',
    lineHeight: 20,
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
  companyNameText: {
    fontSize: 13,
    color: '#7dd3fc',
    marginTop: 2,
  },
  changeContainer: {
    alignItems: 'flex-end',
  },
  dipText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  growthText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  detailsButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    alignItems: 'center',
  },
  detailsButtonText: {
    color: '#00d4ff',
    fontSize: 13,
    fontWeight: '600',
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 212, 255, 0.2)',
  },
  chartSection: {
    marginBottom: 16,
  },
  chart: {
    borderRadius: 8,
    marginVertical: 8,
  },
  dayLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginTop: 4,
  },
  dayLabel: {
    fontSize: 11,
    color: '#7dd3fc',
    minWidth: 30,
    textAlign: 'center',
  },
  headlinesSection: {
    marginTop: 8,
  },
  headlinesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 8,
  },
  headlineItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.1)',
    flexDirection: 'column',
  },
  headlineDate: {
    fontSize: 12,
    color: '#00d4ff',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headlineText: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  noHeadlinesText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.4)',
  },
  stockPickerModal: {
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(0, 212, 255, 0.3)',
    borderColor: 'rgba(0, 212, 255, 0.6)',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#e2e8f0',
    textAlign: 'center',
  },
  modalOptionTextSelected: {
    color: '#00d4ff',
    fontWeight: '600',
  },
  modalCancelButton: {
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.4)',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectAllButton: {
    flex: 1,
    padding: 10,
    marginHorizontal: 4,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.4)',
  },
  selectAllText: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: '600',
  },
  addStockRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  addStockInput: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e2e8f0',
    fontSize: 14,
  },
  addStockButton: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.5)',
    borderRadius: 6,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addStockButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  errorMessage: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 0,
    marginLeft: 5,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  stockList: {
    maxHeight: 300,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.1)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#00d4ff',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    width: 14,
    height: 14,
    backgroundColor: '#00d4ff',
    borderRadius: 2,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  modalButtons: {
    marginTop: 16,
  },
  modalApplyButton: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.5)',
    marginBottom: 8,
  },
  modalApplyText: {
    fontSize: 16,
    color: '#00ff88',
    fontWeight: '600',
    textAlign: 'center',
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

export default BlueChipDips;
