import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  ActivityIndicator,
  Alert,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import CongressTradesService from '../services/CongressTradesService';
import InsiderTradesService from '../services/InsiderTradesService';

const screenWidth = Dimensions.get('window').width;

const HomeScreen = () => {
  const navigation = useNavigation();
  
  // Store the full dataset (up to 365 days)
  const [fullMarketData, setFullMarketData] = useState<{
    dow: { prices: number[], dates: string[] },
    sp500: { prices: number[], dates: string[] },
    nasdaq: { prices: number[], dates: string[] },
  }>({
    dow: { prices: [], dates: [] },
    sp500: { prices: [], dates: [] },
    nasdaq: { prices: [], dates: [] },
  });
  
  // Currently displayed data based on selected time range
  const [displayData, setDisplayData] = useState<{
    dow: number[],
    sp500: number[],
    nasdaq: number[],
  }>({
    dow: [],
    sp500: [],
    nasdaq: [],
  });
  
  const [dateLabels, setDateLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [timeRange, setTimeRange] = useState('7'); // '7', '30', or '90'
  const [symbolList, setSymbolList] = useState<Array<{symbol: string, name: string}>>([]);

  // Preload AI Picks data in the background
  const preloadAIPicksData = async () => {
    try {
      console.log('Preloading AI Picks data in background...');
      // Fetch both datasets in parallel - this will cache them
      await Promise.all([
        CongressTradesService.getTrades(),
        InsiderTradesService.getTrades()
      ]);
      console.log('AI Picks data preloaded successfully');
    } catch (error) {
      console.log('Error preloading AI Picks data:', error);
    }
  };

  // Function to fetch and cache stock symbol list
  const fetchSymbolList = async () => {
    try {
      // Check if we have cached data
      const cachedData = await AsyncStorage.getItem('stockSymbolList');
      const cacheTimestamp = await AsyncStorage.getItem('stockSymbolListTimestamp');
      
      // Use cache if it's less than 7 days old
      if (cachedData && cacheTimestamp) {
        const daysSinceCache = (Date.now() - parseInt(cacheTimestamp)) / (1000 * 60 * 60 * 24);
        if (daysSinceCache < 7) {
          console.log('Using cached stock list');
          setSymbolList(JSON.parse(cachedData));
          return;
        }
      }
      
      // For now, use a basic list of popular stocks
      // In production, you could fetch from a more comprehensive source
      const symbols: Array<{symbol: string, name: string}> = [
        { symbol: 'AAPL', name: 'Apple Inc' },
        { symbol: 'MSFT', name: 'Microsoft Corp' },
        { symbol: 'GOOGL', name: 'Alphabet Inc' },
        { symbol: 'AMZN', name: 'Amazon.com Inc' },
        { symbol: 'TSLA', name: 'Tesla Inc' },
        { symbol: 'META', name: 'Meta Platforms' },
        { symbol: 'NVDA', name: 'NVIDIA Corp' },
        { symbol: 'AMD', name: 'Advanced Micro Devices' },
        // Add more as needed
      ];
      
      console.log(`Using ${symbols.length} stock symbols`);
      
      // Cache the data
      await AsyncStorage.setItem('stockSymbolList', JSON.stringify(symbols));
      await AsyncStorage.setItem('stockSymbolListTimestamp', Date.now().toString());
      
      setSymbolList(symbols);
    } catch (error) {
      console.log('Error fetching symbol list:', error);
    }
  };

  // Fetch market data using Yahoo Finance API
  // Fetch market data using Yahoo Finance API
  const fetchAllMarketData = async () => {
    setLoading(true);
    try {
      console.log('=== FETCHING MARKET DATA FROM YAHOO FINANCE ===');
      
      // Fetch 3 months of data to support 90-day view
      const [dowResponse, sp500Response, nasdaqResponse] = await Promise.all([
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/DIA?range=3mo&interval=1d'),
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=3mo&interval=1d'),
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/QQQ?range=3mo&interval=1d')
      ]);
      
      console.log('=== API RESPONSES RECEIVED ===');
      
      // Process Yahoo Finance response
      const processYahooData = (response: any, symbol: string) => {
        console.log(`Processing ${symbol}...`);
        const result = response.data.chart.result[0];
        
        if (!result || !result.timestamp || !result.indicators) {
          console.log(`!!! No data found for ${symbol} !!!`);
          return { prices: [], dates: [] };
        }
        
        const timestamps = result.timestamp;
        const closePrices = result.indicators.quote[0].close;
        
        // Convert timestamps to dates and filter out null prices
        const dates: string[] = [];
        const prices: number[] = [];
        
        for (let i = 0; i < timestamps.length; i++) {
          if (closePrices[i] !== null && closePrices[i] !== undefined) {
            const date = new Date(timestamps[i] * 1000);
            dates.push(date.toISOString().split('T')[0]);
            prices.push(closePrices[i]);
          }
        }
        
        console.log(`${symbol} - Got ${prices.length} data points`);
        console.log(`${symbol} - First date: ${dates[0]}, Last date: ${dates[dates.length - 1]}`);
        console.log(`${symbol} - First price: ${prices[0].toFixed(2)}, Last price: ${prices[prices.length - 1].toFixed(2)}`);
        
        return { prices, dates };
      };

      const dowData = processYahooData(dowResponse, 'DIA');
      const sp500Data = processYahooData(sp500Response, 'SPY');
      const nasdaqData = processYahooData(nasdaqResponse, 'QQQ');

      console.log('=== PROCESSED DATA LENGTHS ===');
      console.log('Dow:', dowData.prices.length);
      console.log('SP500:', sp500Data.prices.length);
      console.log('NASDAQ:', nasdaqData.prices.length);

      // Only update if we got valid data
      if (dowData.prices.length > 0 && sp500Data.prices.length > 0 && nasdaqData.prices.length > 0) {
        console.log('✓ Valid data received, storing and displaying...');
        
        // Store the FULL dataset
        setFullMarketData({
          dow: dowData,
          sp500: sp500Data,
          nasdaq: nasdaqData,
        });

        // Update timestamp
        const now = new Date();
        const formattedDateTime = now.toLocaleString('en-US', { 
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit'
        });
        setLastUpdate(formattedDateTime);
        
        // IMPORTANT: Immediately update display for current time range
        const numDays = parseInt(timeRange);
        const slicedDow = dowData.prices.slice(-numDays);
        const slicedSp500 = sp500Data.prices.slice(-numDays);
        const slicedNasdaq = nasdaqData.prices.slice(-numDays);
        const slicedDates = dowData.dates.slice(-numDays);
        
        console.log(`Displaying ${numDays} days - Sliced lengths:`, slicedDow.length, slicedSp500.length, slicedNasdaq.length);
        
        setDisplayData({
          dow: slicedDow,
          sp500: slicedSp500,
          nasdaq: slicedNasdaq,
        });
        
        const labels = generateLabels(slicedDates, timeRange);
        console.log('Generated labels:', labels);
        setDateLabels(labels);
        
        console.log('=== DATA UPDATE COMPLETE ===');
      } else {
        console.log('!!! INVALID DATA - Not updating !!!');
        console.log('Data lengths:', dowData.prices.length, sp500Data.prices.length, nasdaqData.prices.length);
      }
      
      setLoading(false);
    } catch (error) {
      console.log('=== ERROR OCCURRED ===');
      console.log('Error fetching market data:', error);
      setLoading(false);
    }
  };

  // Function to update displayed data based on time range (no API call needed)
  const updateDisplayData = (dowData: { prices: number[], dates: string[] }, sp500Data: { prices: number[], dates: string[] }, nasdaqData: { prices: number[], dates: string[] }, range: string) => {
    const numDays = parseInt(range);
    
    // Slice the stored data to show only the selected time range
    const slicedDow = dowData.prices.slice(-numDays);
    const slicedSp500 = sp500Data.prices.slice(-numDays);
    const slicedNasdaq = nasdaqData.prices.slice(-numDays);
    const slicedDates = dowData.dates.slice(-numDays);
    
    console.log(`Displaying ${numDays} days. Sliced data length: ${slicedDow.length}`);
    
    // Update display data
    setDisplayData({
      dow: slicedDow,
      sp500: slicedSp500,
      nasdaq: slicedNasdaq,
    });
    
    // Generate labels for the selected range
    const labels = generateLabels(slicedDates, range);
    setDateLabels(labels);
  };

  // Generate labels based on time range
  const generateLabels = (dates: string[], range: string) => {
    if (range === '7') {
      // Show day names for 7 days
      const dayNames = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];
      return (dates as string[]).map((dateStr: string) => {
        const date = new Date(dateStr + 'T12:00:00');
        return dayNames[date.getDay()];
      });
    } else if (range === '30') {
      // Show dates for 30 days (every 5th date)
      return (dates as string[]).map((dateStr: string, index: number) => {
        if (index % 5 === 0 || index === dates.length - 1) {
          const date = new Date(dateStr + 'T12:00:00');
          return `${date.getMonth() + 1}/${date.getDate()}`;
        }
        return '';
      });
    } else {
      // For 90 days - show each unique month name evenly distributed
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthsFound: string[] = [];
      let lastMonth: number | null = null;
      
      // First pass: identify unique months
      dates.forEach((dateStr: string) => {
        const date = new Date(dateStr + 'T12:00:00');
        const month = date.getMonth();
        if (month !== lastMonth) {
          monthsFound.push(monthNames[month]);
          lastMonth = month;
        }
      });
      
      // Return array with only the unique months found (no empty strings)
      return monthsFound;
    }
  };

  // Fetch data once when component loads
  useEffect(() => {
    console.log('Component mounted, fetching data...');
    fetchAllMarketData(); // Full fetch on initial load
    fetchSymbolList(); // Fetch stock symbols for Stock Search
    preloadAIPicksData(); // Preload AI Picks data in background
  }, []);

  // Update display when time range changes (no API call, just slice existing data)
  useEffect(() => {
    if (fullMarketData.dow.prices.length > 0) {
      console.log('Time range changed to:', timeRange);
      updateDisplayData(
        fullMarketData.dow,
        fullMarketData.sp500,
        fullMarketData.nasdaq,
        timeRange
      );
    }
  }, [timeRange, fullMarketData]);

  // Calculate percentage change across the displayed time range
  const getTimeRangePercentageChange = (priceData: number[]) => {
    if (priceData.length < 2) return 0;
    const firstPrice = priceData[0];
    const lastPrice = priceData[priceData.length - 1];
    return (((lastPrice - firstPrice) / firstPrice) * 100).toFixed(2);
  };

  // Render a single index chart
  const renderIndexChart = (chartTitle: string, chartData: number[], chartColor: string) => {
    const change = getTimeRangePercentageChange(chartData);
    const isPositive = Number(change) >= 0;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{chartTitle}</Text>
          <Text style={[styles.changeText, { color: isPositive ? '#00ff88' : '#ff4444' }]}>
            {isPositive ? '+' : ''}{change}%
          </Text>
        </View>
        {chartData.length > 0 ? (
          <LineChart
            data={{
              labels: dateLabels,
              datasets: [{ 
                data: chartData.length > 0 ? chartData : [0],
                color: (opacity = 1) => chartColor,
                strokeWidth: 2
              }],
            }}
            width={screenWidth * 0.88}
            height={50}
            chartConfig={{
              backgroundGradientFrom: '#0a1929',
              backgroundGradientTo: '#0a1929',
              color: (opacity = 1) => chartColor,
              strokeWidth: 2,
              propsForDots: {
                r: '0',
              },
              propsForBackgroundLines: {
                strokeWidth: 0,
              },
              labelColor: () => '#7dd3fc',
              style: {
                borderRadius: 16
              }
            }}
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLabels={true}
            withHorizontalLabels={false}
            withShadow={false}
            bezier
            style={styles.chart}
            verticalLabelRotation={0}
            fromZero={false}
            segments={4}
          />
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>No data available</Text>
          </View>
        )}
        {/* Manual day labels */}
        {dateLabels.length > 0 && (
          <View style={styles.dayLabelsContainer}>
            {dateLabels.map((label, index) => (
              <Text key={index} style={styles.dayLabel}>{label}</Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Navigation button component
  const NavButton = ({ title, icon, onPress }: { title: string; icon: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.navButton} onPress={onPress}>
      <Text style={styles.navButtonIcon}>{icon}</Text>
      <Text style={styles.navButtonText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1929" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>StockFinderAI</Text>
          <Text style={styles.subtitle}>Market Intelligence Dashboard</Text>
          {lastUpdate && (
            <Text style={styles.updateTime}>Last updated: {lastUpdate}</Text>
          )}
        </View>

        {/* Loading indicator */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00d4ff" />
            <Text style={styles.loadingText}>Loading market data...</Text>
          </View>
        ) : (
          <>
            {/* Market Indices Section */}
            <View style={styles.section}>
              {/* Time Range Toggle */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity 
                  style={[styles.toggleButton, timeRange === '7' && styles.toggleButtonActive]}
                  onPress={() => setTimeRange('7')}
                >
                  <Text style={[styles.toggleText, timeRange === '7' && styles.toggleTextActive]}>
                    7 Days
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleButton, timeRange === '30' && styles.toggleButtonActive]}
                  onPress={() => setTimeRange('30')}
                >
                  <Text style={[styles.toggleText, timeRange === '30' && styles.toggleTextActive]}>
                    30 Days
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleButton, timeRange === '90' && styles.toggleButtonActive]}
                  onPress={() => setTimeRange('90')}
                >
                  <Text style={[styles.toggleText, timeRange === '90' && styles.toggleTextActive]}>
                    90 Days
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>
                  {timeRange === '7' ? 'LAST 7 DAYS' : timeRange === '30' ? 'LAST 30 DAYS' : 'LAST 90 DAYS'}
                </Text>
                <TouchableOpacity style={styles.refreshIconButton} onPress={fetchAllMarketData}>
                  <Text style={styles.refreshIconText}>↻</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chartsGroup}>
                {renderIndexChart('Dow Jones', displayData.dow, 'rgba(0, 212, 255, 0.8)')}
                {renderIndexChart('S&P 500', displayData.sp500, 'rgba(0, 255, 136, 0.8)')}
                {renderIndexChart('NASDAQ', displayData.nasdaq, 'rgba(138, 43, 226, 0.8)')}
              </View>
            </View>

            {/* Navigation Buttons Grid */}
            <View style={styles.navGrid}>
              <NavButton 
                title="My Watch List" 
                icon="⭐"
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate('WatchList');
                }}
              />
              <NavButton 
                title="AI Picks" 
                icon="🦾"
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate('AIPicks');
                }}
              />
              <NavButton 
                title="Blue Chip Dips" 
                icon="💎"
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate('BlueChipDips');
                }}
              />
              <NavButton 
                title="Stock Search" 
                icon="🔍"
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate('StockSearch', { 
                    symbolList, 
                    fullMarketData
                  });
                }}
              />
              <NavButton 
                title="Congress Trades" 
                icon="🏛️"
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate('CongressTrades');
                }}
              />
              <NavButton 
                title="Insider Trades" 
                icon="💼"
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate('InsiderTrades');
                }}
              />
            </View>
          </>
        )}

        {/* Disclaimer */}
        {!loading && (
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1929',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.3)',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00d4ff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 212, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#7dd3fc',
    marginTop: 5,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  updateTime: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    color: '#7dd3fc',
    marginTop: 15,
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 15,
    marginTop: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 5,
    paddingLeft: 5,
    paddingRight: 5,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#64748b',
    letterSpacing: 2,
  },
  refreshIconButton: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIconText: {
    color: '#7dd3fc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 10,
    padding: 4,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.3)',
  },
  toggleText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#00d4ff',
  },
  chartContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 0,
    padding: 10,
    paddingTop: 8,
    paddingBottom: 5,
    marginBottom: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.2)',
  },
  chartsGroup: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  chartTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  changeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  chart: {
    borderRadius: 10,
    marginLeft: -15,
    paddingBottom: 5,
  },
  noDataContainer: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: '#64748b',
    fontSize: 14,
  },
  dayLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingHorizontal: 22,
    backgroundColor: 'transparent',
  },
  dayLabel: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(10, 25, 41, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
    minWidth: 30,
    textAlign: 'center',
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 10,
  },
  navButton: {
    width: '48%',
    aspectRatio: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  navButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  navButtonText: {
    color: '#7dd3fc',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1,
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

export default HomeScreen;