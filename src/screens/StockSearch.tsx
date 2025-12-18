
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const screenWidth = require('react-native').Dimensions.get('window').width;

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

// Define the Stock type
type Stock = {
  symbol: string;
  name: string;
};

type SelectedStock = Stock & {
  prices?: number[];
  dates?: string[];
  currentPrice?: number;
  change?: number;
};

type NewsHeadline = {
  title: string;
  link: string;
  pubDate: string;
};

const StockSearch = () => {
  const route = useRoute();
  const navigation = useNavigation();
  // @ts-ignore
  const { symbolList: passedSymbolList = [], preSelectedSymbol } = route.params || {};
  const searchInputRef = useRef<TextInput>(null);
  
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<SelectedStock | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceCache, setPriceCache] = useState<Record<string, any>>({});
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [similarStocks, setSimilarStocks] = useState<Stock[]>([]);
  const [watchList, setWatchList] = useState<Array<{symbol: string, name: string}>>([]);
  const [symbolList, setSymbolList] = useState<Stock[]>(passedSymbolList);

  // Load watch list and symbol list on mount
  useEffect(() => {
    loadWatchList();
    loadSymbolList();
  }, []);
  
  // Update symbolList if passed from navigation params
  useEffect(() => {
    if (passedSymbolList && passedSymbolList.length > 0) {
      setSymbolList(passedSymbolList);
    }
  }, [passedSymbolList]);

  // Focus on search input when screen comes into focus (only if no preSelectedSymbol)
  useFocusEffect(
    React.useCallback(() => {
      // Don't auto-focus keyboard if user navigated here by clicking a stock ticker
      if (!preSelectedSymbol) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [preSelectedSymbol])
  );

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

  const loadSymbolList = async () => {
    try {
      const cachedSymbols = await AsyncStorage.getItem('stockSymbolList');
      if (cachedSymbols) {
        const parsedSymbols = JSON.parse(cachedSymbols);
        setSymbolList(parsedSymbols);
        console.log(`Loaded ${parsedSymbols.length} symbols from cache`);
      }
    } catch (error) {
      console.error('Failed to load symbol list:', error);
    }
  };

  const toggleWatchList = async () => {
    if (!selectedStock) return;

    try {
      const isWatched = watchList.some(item => item.symbol === selectedStock.symbol);
      let newWatchList;

      if (isWatched) {
        // Remove from watch list
        newWatchList = watchList.filter(item => item.symbol !== selectedStock.symbol);
      } else {
        // Add to watch list
        newWatchList = [...watchList, { symbol: selectedStock.symbol, name: selectedStock.name }];
      }

      setWatchList(newWatchList);
      await AsyncStorage.setItem('watchList', JSON.stringify(newWatchList));
    } catch (error) {
      console.error('Failed to update watch list:', error);
    }
  };

  // Filter stocks by company name as user types
  const handleSearch = (text: string) => {
    setQuery(text);
    if (text.length === 0) {
      setSuggestions([]);
      return;
    }
    // Show top 8 matches
    const filtered = symbolList
      .filter((stock: Stock) =>
        stock.name.toLowerCase().includes(text.toLowerCase()) ||
        stock.symbol.toLowerCase().includes(text.toLowerCase())
      )
      .slice(0, 8);
    setSuggestions(filtered);
  };

  // When user selects a stock from suggestions
  const selectSuggestion = (stock: Stock) => {
    Keyboard.dismiss();
    setQuery('');
    setSuggestions([]);
    setSelectedStock({ ...stock });
    setHeadlines([]);
    fetchHeadlines(stock.symbol);
    fetchPriceHistory(stock.symbol);
    findSimilarStocks(stock);
  };

  // Handle pre-selected symbol from navigation
  useEffect(() => {
    if (preSelectedSymbol) {
      if (symbolList.length > 0) {
        // Find the stock in symbolList
        const stock = symbolList.find((s: Stock) => s.symbol === preSelectedSymbol);
        if (stock) {
          selectSuggestion(stock);
        } else {
          // If not in symbolList, create a basic stock object with the symbol
          selectSuggestion({ symbol: preSelectedSymbol, name: preSelectedSymbol });
        }
      } else {
        // If symbolList is empty, just create a basic stock object
        selectSuggestion({ symbol: preSelectedSymbol, name: preSelectedSymbol });
      }
    }
  }, [preSelectedSymbol]);

  // Find similar stocks based on industry/sector relationships
  const findSimilarStocks = (stock: Stock) => {
    // Define sector/industry categories with more specific matching
    const sectors: Record<string, { keywords: string[], exactWords?: string[] }> = {
      tech: { 
        keywords: ['technology', 'software', 'computer', 'systems', 'cloud', 'semiconductor', 'microchip'],
        exactWords: ['microsoft', 'apple', 'google', 'alphabet', 'meta', 'facebook', 'oracle', 'salesforce', 'adobe', 'nvidia', 'amd', 'intel', 'qualcomm', 'broadcom', 'texas instruments', 'micron']
      },
      finance: { 
        keywords: ['bank', 'bancorp', 'financial services', 'credit', 'insurance', 'investment', 'securities', 'trust company', 'mortgage'],
        exactWords: ['jpmorgan', 'wells fargo', 'bank of america', 'citigroup', 'goldman sachs', 'morgan stanley', 'visa', 'mastercard', 'paypal', 'american express']
      },
      healthcare: { 
        keywords: ['pharmaceuticals', 'biotech', 'medical', 'hospital', 'healthcare', 'therapeutics', 'health systems'],
        exactWords: ['pfizer', 'johnson & johnson', 'abbvie', 'merck', 'unitedhealth', 'cvs health', 'moderna', 'regeneron']
      },
      retail: { 
        keywords: ['retail', 'stores', 'supermarket', 'department store', 'warehouse'],
        exactWords: ['walmart', 'target', 'costco', 'amazon', 'home depot', 'lowes', "macy's", 'nordstrom', 'kohls']
      },
      energy: { 
        keywords: ['energy', 'oil', 'petroleum', 'natural gas', 'electric utility', 'power'],
        exactWords: ['exxon', 'chevron', 'conocophillips', 'shell', 'bp', 'marathon', 'valero', 'occidental']
      },
      auto: { 
        keywords: ['motors', 'automotive', 'vehicles'],
        exactWords: ['ford', 'general motors', 'tesla', 'toyota', 'honda', 'nissan', 'rivian', 'lucid']
      },
      telecom: { 
        keywords: ['communications', 'telecommunications', 'wireless', 'cable'],
        exactWords: ['verizon', 'at&t', 't-mobile', 'comcast', 'charter', 'dish']
      },
      food: { 
        keywords: ['foods', 'beverage', 'restaurant', 'brewing'],
        exactWords: ['coca-cola', 'pepsico', 'kraft heinz', 'general mills', 'kellogg', 'mcdonalds', 'starbucks', 'chipotle', 'yum brands']
      },
      industrial: { 
        keywords: ['industrial', 'manufacturing', 'machinery', 'aerospace', 'defense'],
        exactWords: ['boeing', 'lockheed martin', 'raytheon', 'caterpillar', 'deere', '3m', 'honeywell', 'general electric']
      },
      entertainment: { 
        keywords: ['entertainment', 'media', 'streaming', 'studios', 'broadcasting'],
        exactWords: ['disney', 'netflix', 'warner', 'paramount', 'spotify', 'roku', 'activision']
      },
      airlines: { 
        keywords: ['airlines', 'airways', 'air lines'],
        exactWords: ['delta', 'american airlines', 'united airlines', 'southwest', 'jetblue', 'alaska air']
      }
    };

    const stockNameLower = stock.name.toLowerCase();
    let matchedSector = '';
    let bestMatchScore = 0;
    
    // Find the best matching sector
    for (const [sector, config] of Object.entries(sectors)) {
      let score = 0;
      
      // Check exact word matches (higher priority)
      if (config.exactWords) {
        for (const exactWord of config.exactWords) {
          if (stockNameLower.includes(exactWord.toLowerCase())) {
            score += 10; // High score for exact matches
            break;
          }
        }
      }
      
      // Check keyword matches (lower priority)
      for (const keyword of config.keywords) {
        if (stockNameLower.includes(keyword.toLowerCase())) {
          score += 3;
          break; // Only count one keyword match per sector
        }
      }
      
      if (score > bestMatchScore) {
        bestMatchScore = score;
        matchedSector = sector;
      }
    }

    // If no sector matched, show random stocks from the list
    if (!matchedSector || bestMatchScore === 0) {
      const randomStocks: Stock[] = [];
      const seenCompanies = new Set<string>();
      const availableStocks = symbolList.filter((s: Stock) => s.symbol !== stock.symbol);
      
      // Shuffle and pick 4 random stocks
      const shuffled = [...availableStocks].sort(() => Math.random() - 0.5);
      for (const s of shuffled) {
        const baseSymbol = s.symbol.split('-')[0];
        if (!seenCompanies.has(baseSymbol)) {
          randomStocks.push(s);
          seenCompanies.add(baseSymbol);
          if (randomStocks.length === 4) break;
        }
      }
      
      console.log(`No sector match for ${stock.symbol}, showing random stocks:`, randomStocks.map(s => s.symbol).join(', '));
      setSimilarStocks(randomStocks);
      return;
    }

    // Find other stocks in the same sector
    const sectorConfig = sectors[matchedSector];
    console.log(`Stock ${stock.symbol} matched to sector: ${matchedSector}`);
    
    // Separate exact matches from keyword matches
    const exactMatches: Stock[] = [];
    const keywordMatches: Stock[] = [];
    const seenCompanies = new Set<string>(); // Track base symbols to avoid duplicates
    
    symbolList.forEach((s: Stock) => {
      if (s.symbol === stock.symbol) return;
      
      // Extract base symbol (before any hyphen for preferred shares, warrants, etc.)
      const baseSymbol = s.symbol.split('-')[0];
      
      // Skip if we've already included this base company
      if (seenCompanies.has(baseSymbol)) return;
      
      const nameLower = s.name.toLowerCase();
      let isExactMatch = false;
      
      // Check exact words first (must be whole word match)
      if (sectorConfig.exactWords) {
        for (const exactWord of sectorConfig.exactWords) {
          const regex = new RegExp(`\\b${exactWord.toLowerCase()}\\b`);
          if (regex.test(nameLower)) {
            exactMatches.push(s);
            seenCompanies.add(baseSymbol);
            isExactMatch = true;
            break;
          }
        }
      }
      
      // Only check keywords if not already matched by exact word
      if (!isExactMatch) {
        for (const keyword of sectorConfig.keywords) {
          const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`);
          if (regex.test(nameLower)) {
            keywordMatches.push(s);
            seenCompanies.add(baseSymbol);
            break;
          }
        }
      }
    });
    
    // Prioritize exact matches, then fill with keyword matches
    const similar = [...exactMatches, ...keywordMatches].slice(0, 4);
    
    console.log(`Found ${similar.length} similar stocks for ${stock.symbol}:`, similar.map(s => s.symbol).join(', '));
    
    setSimilarStocks(similar);
  };

  // Fetch price history for selected stock
  const fetchPriceHistory = async (symbol: string) => {
    // Check cache first
    if (priceCache[symbol]) {
      console.log(`Using cached data for ${symbol}`);
      setSelectedStock(prev => prev ? { ...prev, ...priceCache[symbol] } : null);
      return;
    }

    setLoadingPrice(true);
    try {
      // Use Yahoo Finance API for 90-day history
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`
      );

      const result = response.data.chart.result[0];
      if (!result || !result.timestamp || !result.indicators) {
        console.log('No price data available');
        setLoadingPrice(false);
        return;
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

      // Get last 90 days (or whatever is available)
      const last90Dates = dates.slice(-90);
      const last90Prices = prices.slice(-90);
      
      const currentPrice = last90Prices[last90Prices.length - 1];
      const oldPrice = last90Prices[0];
      const change = ((currentPrice - oldPrice) / oldPrice) * 100;

      const priceData = { prices: last90Prices, dates: last90Dates, currentPrice, change };
      
      // Cache the data
      setPriceCache(prev => ({ ...prev, [symbol]: priceData }));
      setSelectedStock(prev => prev ? { ...prev, ...priceData } : null);
    } catch (error) {
      console.log('Error fetching price data:', error);
    }
    setLoadingPrice(false);
  };

  // Fetch news headlines from Yahoo Finance RSS
  const fetchHeadlines = async (symbol: string) => {
    console.log('Fetching headlines for:', symbol);
    setLoadingNews(true);
    try {
      // Fetch RSS for headlines
      const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US`;
      
      // Use Yahoo Finance query API for real-time price
      const quoteApiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      
      const [rssResponse, quoteResponse] = await Promise.all([
        axios.get(rssUrl),
        axios.get(quoteApiUrl)
      ]);
      
      const xmlData = rssResponse.data;
      const quoteData = quoteResponse.data;
      
      console.log('Quote API response:', JSON.stringify(quoteData).substring(0, 500));
      
      // Extract current price from Yahoo Finance API
      let currentPrice: number | undefined;
      let priceChange: number | undefined;
      let changePercent: number | undefined;
      
      try {
        const meta = quoteData.chart?.result?.[0]?.meta;
        if (meta) {
          currentPrice = meta.regularMarketPrice;
          const previousClose = meta.previousClose || meta.chartPreviousClose;
          
          if (currentPrice && previousClose) {
            priceChange = currentPrice - previousClose;
            changePercent = (priceChange / previousClose) * 100;
            console.log('Current price:', currentPrice);
            console.log('Previous close:', previousClose);
            console.log('Change percent:', changePercent);
          }
        }
      } catch (error) {
        console.error('Error parsing quote data:', error);
      }
      
      // Parse XML to extract headlines
      const items: NewsHeadline[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      
      while ((match = itemRegex.exec(xmlData)) !== null && items.length < 3) {
        const itemContent = match[1];
        
        let titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        if (!titleMatch) {
          titleMatch = itemContent.match(/<title>(.*?)<\/title>/);
        }
        
        const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
        
        if (titleMatch && linkMatch) {
          const title = titleMatch[1].trim();
          const link = linkMatch[1].trim();
          const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).toLocaleDateString() : '';
          
          items.push({ title, link, pubDate });
        }
      }
      
      console.log('Total parsed headlines:', items.length);
      
      // Update selected stock with price info if available
      setSelectedStock(prev => {
        console.log('Updating stock with current price:', currentPrice, '1-day change%:', changePercent);
        return prev ? {
          ...prev,
          currentPrice
          // Don't overwrite the 90-day change calculation with 1-day change
        } : null;
      });
      
      setHeadlines(items);
    } catch (error) {
      // Silently handle errors - some stocks may not have RSS feeds or API access
      console.log('Could not fetch headlines for', symbol);
      setHeadlines([]);
    }
    setLoadingNews(false);
  };

  // Generate date labels for 90-day view (show month names at first occurrence, skip first month)
  const generateDateLabels = (dates: string[]) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastMonth: number | null = null;
    let isFirstMonth = true;
    return dates.map((dateStr: string, index: number) => {
      const date = new Date(dateStr + 'T12:00:00');
      const month = date.getMonth();
      let label = '';
      if (month !== lastMonth) {
        if (!isFirstMonth) {
          label = monthNames[month];
        }
        isFirstMonth = false;
        lastMonth = month;
      }
      return label;
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stock Search</Text>
      <Text style={styles.subtitle}>Search the top 500 U.S. stocks</Text>
      
      <TextInput
        ref={searchInputRef}
        style={styles.searchBox}
        placeholder="Search by company name or symbol..."
        value={query}
        onChangeText={handleSearch}
        placeholderTextColor="#7dd3fc"
        autoCorrect={false}
        autoCapitalize="characters"
        spellCheck={false}
      />

      {/* Show suggestions above search results */}
      {suggestions.length > 0 && (
        <ScrollView 
          style={styles.suggestionsContainer} 
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map((stock) => (
            <TouchableOpacity
              key={stock.symbol}
              style={styles.suggestionItem}
              onPress={() => selectSuggestion(stock)}
            >
              <Text style={styles.suggestionSymbol}>{stock.symbol}</Text>
              <Text style={styles.suggestionName}>{stock.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Show selected stock details */}
      {selectedStock && (
        <ScrollView style={styles.resultsContainer}>
          <View style={styles.stockCard}>
            <View style={styles.stockHeader}>
              <View style={styles.stockTitleContainer}>
                <Text style={styles.stockName}>{selectedStock.name}</Text>
                <Text style={styles.stockSymbol}>Stock Symbol: {selectedStock.symbol}</Text>
              </View>
              <TouchableOpacity onPress={toggleWatchList} style={styles.starButton}>
                <Text style={styles.starIcon}>
                  {watchList.some(item => item.symbol === selectedStock.symbol) ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Display current price if available from scraping */}
            {selectedStock.currentPrice && !selectedStock.prices && (
              <View style={styles.priceInfoRow}>
                <Text style={styles.price}>
                  Current: ${selectedStock.currentPrice.toFixed(2)}
                </Text>
                {selectedStock.change !== undefined && (
                  <Text style={[
                    styles.price,
                    { 
                      color: selectedStock.change >= 0 ? '#00ff88' : '#ff4444',
                      marginLeft: 12
                    }
                  ]}>
                    {shouldShowLast() ? 'Last:' : 'Today:'} {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change.toFixed(2)}%
                  </Text>
                )}
              </View>
            )}
            
            {/* Chart section - only show if prices loaded */}
            {selectedStock.prices && selectedStock.prices.length > 0 && (
              <>
                <View style={styles.priceInfoRow}>
                  <Text style={styles.price}>
                    Current: ${selectedStock.currentPrice?.toFixed(2)}
                  </Text>
                  <Text style={[styles.price, { color: '#22c55e', marginLeft: 12 }]}>
                    High: ${Math.max(...selectedStock.prices).toFixed(2)}
                  </Text>
                  <Text style={[styles.price, { color: '#ef4444', marginLeft: 12 }]}>
                    Low: ${Math.min(...selectedStock.prices).toFixed(2)}
                  </Text>
                </View>
                <Text style={[
                  styles.change,
                  { color: (selectedStock.change || 0) >= 0 ? '#00ff88' : '#ff4444' }
                ]}>
                  90-day change: {(selectedStock.change || 0) >= 0 ? '+' : ''}
                  {selectedStock.change?.toFixed(1)}%
                </Text>
                
                {selectedStock.prices && selectedStock.prices.length > 0 && (() => {
                  const prices = selectedStock.prices;
                  const maxPrice = Math.max(...prices);
                  const minPrice = Math.min(...prices);
                  const priceRange = maxPrice - minPrice;
                  
                  // Calculate Y positions for high/low lines (chart height is 60px)
                  const chartHeight = 60;
                  const highLineY = 0; // Top of chart
                  const lowLineY = chartHeight - 1; // Bottom of chart
                  
                  return (
                    <View style={styles.chartWrapper}>
                      <LineChart
                      data={{
                        labels: generateDateLabels(selectedStock.dates || []),
                        datasets: [{ 
                          data: selectedStock.prices,
                          color: (opacity = 1) => `rgba(0, 212, 255, 0.6)`,
                          strokeWidth: 2
                        }],
                      }}
                      width={screenWidth - 64}
                      height={70}
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
                    
                    {/* Date labels below chart */}
                    <View style={styles.dayLabelsContainer}>
                      {generateDateLabels(selectedStock.dates || []).map((label, index) => (
                        <Text key={index} style={styles.dayLabel}>{label}</Text>
                      ))}
                    </View>
                  </View>
                  );
                })()}
              </>
            )}
            
            {/* News Headlines Section - Show immediately */}
            {loadingNews ? (
              <View style={styles.newsSection}>
                <Text style={styles.newsTitle}>Recent Headlines:</Text>
                <ActivityIndicator size="small" color="#00d4ff" />
              </View>
            ) : headlines.length > 0 ? (
              <View style={styles.newsSection}>
                <Text style={styles.newsTitle}>Recent Headlines:</Text>
                {headlines.map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    onPress={() => {
                      try {
                        const { Linking } = require('react-native');
                        Linking.openURL(item.link);
                      } catch (err) {
                        console.error('Error opening link:', err);
                      }
                    }}
                    style={styles.newsItem}
                  >
                    <Text style={styles.newsDate}>{item.pubDate}</Text>
                    <Text style={styles.newsHeadline}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.newsSection}>
                <Text style={styles.newsTitle}>Recent Headlines:</Text>
                <Text style={styles.noHeadlinesText}>This stock has no recent headlines.</Text>
              </View>
            )}

            {/* Other Stocks Section */}
            {similarStocks.length > 0 && (
              <View style={styles.similarSection}>
                <Text style={styles.similarTitle}>Other Stocks:</Text>
                <View style={styles.similarButtonsContainer}>
                  {similarStocks.map((stock) => (
                    <TouchableOpacity
                      key={stock.symbol}
                      style={styles.similarButton}
                      onPress={() => selectSuggestion(stock)}
                    >
                      <Text style={styles.similarSymbol}>{stock.symbol}</Text>
                      <Text style={styles.similarName} numberOfLines={1}>{stock.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Watch List Box */}
      {watchList.length > 0 && (
        <TouchableOpacity
          style={styles.watchListBox}
          onPress={() => {
            // @ts-ignore
            navigation.navigate('WatchList');
          }}
        >
          <Text style={styles.watchListTitle}>Watch List:</Text>
          <View style={styles.watchListSymbols}>
            {[...watchList]
              .sort((a, b) => a.symbol.localeCompare(b.symbol))
              .map((stock, index) => (
                <Text key={stock.symbol} style={styles.watchListSymbol}>
                  {stock.symbol}{index < watchList.length - 1 ? ', ' : ''}
                </Text>
              ))}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1929',
    padding: 16,
  },
  title: {
    fontSize: 28,
    color: '#00d4ff',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#7dd3fc',
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 16,
  },
  searchBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    maxHeight: 300,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionSymbol: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: 'bold',
    width: 80,
  },
  suggestionName: {
    color: '#7dd3fc',
    fontSize: 14,
    flex: 1,
  },
  resultsContainer: {
    flex: 1,
  },
  stockCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  stockName: {
    color: '#7dd3fc',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  stockSymbol: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stockTitleContainer: {
    flex: 1,
  },
  starButton: {
    padding: 4,
    marginLeft: 12,
  },
  starIcon: {
    fontSize: 32,
    color: '#ffffff',
  },
  price: {
    color: '#e2e8f0',
    fontSize: 15,
    marginBottom: 4,
  },
  priceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  change: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  chartWrapper: {
    position: 'relative',
    marginTop: 12,
    paddingBottom: 8,
  },
  priceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    zIndex: 10,
  },
  priceLineLabel: {
    position: 'absolute',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: 'rgba(10, 25, 41, 0.95)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  chart: {
    borderRadius: 10,
    marginLeft: -15,
    marginBottom: 5,
  },
  dayLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 5,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  dayLabel: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(10, 25, 41, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  loadButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#00d4ff',
    alignItems: 'center',
  },
  loadButtonText: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  newsSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 212, 255, 0.2)',
  },
  newsTitle: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  newsItem: {
    marginBottom: 10,
  },
  newsDate: {
    color: '#00d4ff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  newsHeadline: {
    color: '#ffffff',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  noHeadlinesText: {
    color: '#7dd3fc',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  similarSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 212, 255, 0.2)',
  },
  similarTitle: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  similarButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  similarButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    width: '48%',
    marginBottom: 8,
  },
  similarSymbol: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  similarName: {
    color: '#7dd3fc',
    fontSize: 11,
  },
  watchListBox: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 12,
    borderTopWidth: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  watchListTitle: {
    color: '#00d4ff',
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 8,
  },
  watchListSymbols: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  watchListSymbol: {
    color: '#7dd3fc',
    fontSize: 12,
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

export default StockSearch;
