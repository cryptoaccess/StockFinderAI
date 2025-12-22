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
  StatusBar,
  Share,
  Modal,
  Linking,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import CongressTradesService from '../services/CongressTradesService';
import InsiderTradesService from '../services/InsiderTradesService';

const packageJson = require('../../package.json');
const screenWidth = Dimensions.get('window').width;

const HomeScreen = () => {
  const navigation = useNavigation();
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  
  // Store the full dataset
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

  // Fetch market data using Yahoo Finance
  const fetchAllMarketData = async () => {
    setLoading(true);
    try {
      // Check cache first
      const cachedData = await AsyncStorage.getItem('marketChartData');
      const cacheTimestamp = await AsyncStorage.getItem('marketChartDataTimestamp');
      
      if (cachedData && cacheTimestamp) {
        const hoursSinceCache = (Date.now() - parseInt(cacheTimestamp)) / (1000 * 60 * 60);
        
        // Use cache if less than 1 hour old
        if (hoursSinceCache < 1) {
          console.log('=== USING CACHED MARKET DATA ===');
          const cached = JSON.parse(cachedData);
          
          setFullMarketData(cached.fullData);
          setLastUpdate(cached.lastUpdate);
          
          // Update display for current time range
          const numDays = parseInt(timeRange);
          const slicedDow = cached.fullData.dow.prices.slice(-numDays);
          const slicedSp500 = cached.fullData.sp500.prices.slice(-numDays);
          const slicedNasdaq = cached.fullData.nasdaq.prices.slice(-numDays);
          const slicedDates = cached.fullData.dow.dates.slice(-numDays);
          
          setDisplayData({
            dow: slicedDow,
            sp500: slicedSp500,
            nasdaq: slicedNasdaq,
          });
          
          const labels = generateLabels(slicedDates, timeRange);
          setDateLabels(labels);
          
          setLoading(false);
          console.log('=== LOADED FROM CACHE ===');
          return;
        }
      }
      
      console.log('=== FETCHING MARKET DATA FROM YAHOO FINANCE ===');
      
      // Fetch 3 months of data to support 90-day view with timeout
      const [dowResponse, sp500Response, nasdaqResponse] = await Promise.all([
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/DIA?range=3mo&interval=1d', { timeout: 20000 }),
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=3mo&interval=1d', { timeout: 20000 }),
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/QQQ?range=3mo&interval=1d', { timeout: 20000 })
      ]);
      
      console.log('=== RESPONSES RECEIVED ===');
      
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
        
        // Cache the data
        const fullData = {
          dow: dowData,
          sp500: sp500Data,
          nasdaq: nasdaqData,
        };
        
        await AsyncStorage.setItem('marketChartData', JSON.stringify({
          fullData,
          lastUpdate: formattedDateTime
        }));
        await AsyncStorage.setItem('marketChartDataTimestamp', Date.now().toString());
        console.log('=== CACHED MARKET DATA ===');
        
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
    checkDisclaimerAcceptance(); // Check if disclaimer was accepted
    fetchAllMarketData(); // Full fetch on initial load
    preloadAIPicksData(); // Preload AI Picks data in background
    checkAndPromptReview(); // Check if we should show review prompt
  }, []);

  // Check and prompt for review after app opens
  const checkAndPromptReview = async () => {
    try {
      const appOpenCountStr = await AsyncStorage.getItem('appOpenCount');
      const reviewPromptShownStr = await AsyncStorage.getItem('reviewPromptShown');
      const remindLaterCountStr = await AsyncStorage.getItem('remindLaterCount');
      
      let appOpenCount = appOpenCountStr ? parseInt(appOpenCountStr) : 0;
      const reviewPromptShown = reviewPromptShownStr === 'true';
      let remindLaterCount = remindLaterCountStr ? parseInt(remindLaterCountStr) : 0;
      
      // Increment app open count
      appOpenCount += 1;
      await AsyncStorage.setItem('appOpenCount', appOpenCount.toString());
      
      // Show review prompt after 3 opens (first time) or 5 opens after "Remind me later"
      const shouldShowReview = (!reviewPromptShown && appOpenCount >= 3) || 
                               (reviewPromptShown && remindLaterCount > 0 && appOpenCount >= remindLaterCount + 5);
      
      if (shouldShowReview) {
        // Small delay so it doesn't appear immediately
        setTimeout(() => {
          setShowReviewModal(true);
        }, 2000);
      }
    } catch (error) {
      console.log('Error checking review prompt:', error);
    }
  };

  // Handle review button click
  const handleLeaveReview = async () => {
    try {
      const reviewUrl = Platform.OS === 'ios' 
        ? 'https://apps.apple.com/app/id6756030906?action=write-review'
        : 'https://play.google.com/store/apps/details?id=com.stockfinderai&showAllReviews=true';
      
      await Linking.openURL(reviewUrl);
      
      // Mark that review prompt was shown and close modal
      await AsyncStorage.setItem('reviewPromptShown', 'true');
      await AsyncStorage.setItem('remindLaterCount', '0'); // Reset remind later count
      setShowReviewModal(false);
    } catch (error) {
      console.log('Error opening review URL:', error);
      Alert.alert('Error', 'Could not open review page. Please try again later.');
    }
  };

  // Handle "Remind me later" button click
  const handleRemindLater = async () => {
    try {
      const appOpenCountStr = await AsyncStorage.getItem('appOpenCount');
      const appOpenCount = appOpenCountStr ? parseInt(appOpenCountStr) : 0;
      
      // Mark that we've shown the prompt and save the current count
      await AsyncStorage.setItem('reviewPromptShown', 'true');
      await AsyncStorage.setItem('remindLaterCount', appOpenCount.toString());
      setShowReviewModal(false);
    } catch (error) {
      console.log('Error handling remind later:', error);
    }
  };

  // Check if user has accepted disclaimer
  const checkDisclaimerAcceptance = async () => {
    try {
      const disclaimerAccepted = await AsyncStorage.getItem('disclaimerAccepted');
      if (!disclaimerAccepted) {
        setShowDisclaimerModal(true);
      }
    } catch (error) {
      console.log('Error checking disclaimer acceptance:', error);
    }
  };

  // Handle disclaimer acceptance
  const handleAcceptDisclaimer = async () => {
    try {
      await AsyncStorage.setItem('disclaimerAccepted', 'true');
      setShowDisclaimerModal(false);
    } catch (error) {
      console.log('Error saving disclaimer acceptance:', error);
    }
  };

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

  // Share app function
  const shareApp = async () => {
    try {
      const iosUrl = 'https://apps.apple.com/app/id6756030906';
      const androidUrl = 'https://play.google.com/store/apps/details?id=com.stockfinderai';
      
      const result = await Share.share({
        message: `Check out StockFinderAI - Track insider trades and price dips, with no registration or account!\n\niPhone: ${iosUrl}\nAndroid: ${androidUrl}`,
        title: 'StockFinderAI - Smart Stock Research',
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log('Shared with activity type:', result.activityType);
        } else {
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
      console.error('Share error:', error);
    }
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

  // Handle menu actions
  const handleReviewApp = () => {
    setShowMenuModal(false);
    
    // Platform-specific store URLs
    const storeUrl = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/id6756030906'
      : 'https://play.google.com/store/apps/details?id=com.stockfinderai';
    
    Linking.openURL(storeUrl);
  };

  const handleDonate = () => {
    setShowMenuModal(false);
    Linking.openURL('https://www.paypal.com/ncp/payment/QAQU3ZZ5NDDNW');
  };

  const handlePrivacyPolicy = () => {
    setShowMenuModal(false);
    Linking.openURL('https://cryptoaccess.github.io/StockFinderAI/privacy-policy.html');
  };

  const handleTermsOfService = () => {
    setShowMenuModal(false);
    Linking.openURL('https://cryptoaccess.github.io/StockFinderAI/terms-of-service.html');
  };

  const handleAbout = () => {
    setShowMenuModal(false);
    Linking.openURL('https://cryptoaccess.github.io/StockFinderAI/');
  };

  // Navigation button component
  const NavButton = ({ title, icon, onPress }: { title: string; icon: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.navButton} onPress={onPress}>
      <Text style={[styles.navButtonIcon, icon === '★' && styles.starIconWhite]}>{icon}</Text>
      <Text style={[styles.navButtonText, icon === '★' && { marginTop: 0 }]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1929" />
      
      {/* Disclaimer Modal */}
      <Modal
        visible={showDisclaimerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Important Disclaimer</Text>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalText}>
                This app provides financial data and analysis for general informational purposes only. It does not provide investment, financial, legal, or tax advice, and nothing contained in the app should be interpreted as a recommendation to buy, sell, or hold any securities. Market data and information may be delayed, inaccurate, or incomplete. The developers and publishers of this app make no guarantees regarding the accuracy, timeliness, or reliability of any content.
              </Text>
              <Text style={styles.modalText}>
                You are solely responsible for evaluating your own investment decisions, and you agree that the developers are not liable for any losses, damages, or consequences arising from the use of this app or reliance on its information.
              </Text>
              <View style={styles.legalLinksContainer}>
                <TouchableOpacity onPress={() => Linking.openURL('https://cryptoaccess.github.io/StockFinderAI/privacy-policy.html')}>
                  <Text style={styles.legalLink}>Privacy Policy</Text>
                </TouchableOpacity>
                <Text style={styles.legalSeparator}>  |  </Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://cryptoaccess.github.io/StockFinderAI/terms-of-service.html')}>
                  <Text style={styles.legalLink}>Terms of Service</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <TouchableOpacity 
              style={styles.acceptButton} 
              onPress={handleAcceptDisclaimer}
            >
              <Text style={styles.acceptButtonText}>I Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Review Prompt Modal */}
      <Modal
        visible={showReviewModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reviewModalContent}>
            <Text style={styles.reviewModalTitle}>⭐ Enjoying StockFinderAI?</Text>
            <Text style={styles.reviewModalText}>
              If you like this free app, please leave a review. It helps!
            </Text>
            <TouchableOpacity 
              style={styles.reviewButton} 
              onPress={handleLeaveReview}
            >
              <Text style={styles.reviewButtonText}>Leave a Review</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.remindLaterButton} 
              onPress={handleRemindLater}
            >
              <Text style={styles.remindLaterButtonText}>Remind Me Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Menu Modal */}
      <Modal
        visible={showMenuModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenuModal(false)}
      >
        <TouchableOpacity 
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenuModal(false)}
        >
          <View style={styles.menuContent}>
            <TouchableOpacity style={styles.menuItem} onPress={handleReviewApp}>
              <Text style={styles.menuIcon}>⭐</Text>
              <Text style={styles.menuText}>Review this app</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handlePrivacyPolicy}>
              <Text style={styles.menuIcon}>🔒</Text>
              <Text style={styles.menuText}>Privacy Policy</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleTermsOfService}>
              <Text style={styles.menuIcon}>📄</Text>
              <Text style={styles.menuText}>Terms of Service</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleAbout}>
              <Text style={styles.menuIcon}>ℹ️</Text>
              <Text style={styles.menuText}>About</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.hamburgerButton}
            onPress={() => setShowMenuModal(true)}
          >
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>StockFinderAI</Text>
            <Text style={styles.subtitle}>Market Intelligence Dashboard</Text>
            {lastUpdate && (
              <Text style={styles.updateTime}>Last updated: {lastUpdate}</Text>
            )}
          </View>
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
              {/* Time Range Toggle and Share Button */}
              <View style={styles.toggleAndShareRow}>
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
                <TouchableOpacity style={styles.shareButton} onPress={shareApp}>
                  <Text style={styles.shareButtonIcon}>💬</Text>
                  <Text style={styles.shareButtonText}>Share app</Text>
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
                icon="★"
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate('WatchList');
                }}
              />
              <NavButton 
                title="AI Picks" 
                icon="💡"
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
              © 2025. All rights reserved.
            </Text>
            <Text style={styles.versionText}>
              Version {packageJson.version}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.3)',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00d4ff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 212, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#7dd3fc',
    marginTop: 5,
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
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
  toggleAndShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  toggleContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 10,
    padding: 4,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  shareButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    marginBottom: 5,
    height: 47,
  },
  shareButtonIcon: {
    fontSize: 16,
    marginBottom: 1,
  },
  shareButtonText: {
    color: '#00d4ff',
    fontSize: 10,
    fontWeight: '600',
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
    marginTop: 6,
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
  starIconWhite: {
    color: '#ffffff',
    fontSize: 42,
    marginBottom: 0,
    marginTop: -10,
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
  versionText: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.5)',
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 450,
    marginBottom: 20,
  },
  modalText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
    marginBottom: 12,
  },
  acceptButton: {
    backgroundColor: '#00d4ff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  acceptButtonText: {
    color: '#0a1929',
    fontSize: 16,
    fontWeight: 'bold',
  },
  legalLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(125, 211, 252, 0.3)',
  },
  legalLink: {
    color: '#7dd3fc',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    color: '#7dd3fc',
    fontSize: 13,
  },
  hamburgerButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    borderRadius: 6,
  },
  hamburgerLine: {
    width: 20,
    height: 2,
    backgroundColor: '#00d4ff',
    marginVertical: 2.5,
    borderRadius: 2,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 100,
    paddingLeft: 10,
  },
  menuContent: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    marginHorizontal: 10,
  },
  reviewModalContent: {
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
  reviewModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 16,
    textAlign: 'center',
  },
  reviewModalText: {
    fontSize: 16,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  reviewButton: {
    backgroundColor: '#00d4ff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewButtonText: {
    color: '#0a1929',
    fontSize: 16,
    fontWeight: 'bold',
  },
  remindLaterButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  remindLaterButtonText: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default HomeScreen;
