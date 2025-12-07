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
      
      // Comprehensive list of 500+ largest US companies across all sectors
      const symbols: Array<{symbol: string, name: string}> = [
        // Technology - Mega Cap
        { symbol: 'AAPL', name: 'Apple Inc' },
        { symbol: 'MSFT', name: 'Microsoft Corp' },
        { symbol: 'GOOGL', name: 'Alphabet Inc' },
        { symbol: 'GOOG', name: 'Alphabet Inc Class C' },
        { symbol: 'AMZN', name: 'Amazon.com Inc' },
        { symbol: 'META', name: 'Meta Platforms' },
        { symbol: 'NVDA', name: 'NVIDIA Corp' },
        { symbol: 'TSLA', name: 'Tesla Inc' },
        
        // Technology - Large Cap
        { symbol: 'AVGO', name: 'Broadcom Inc' },
        { symbol: 'ORCL', name: 'Oracle Corp' },
        { symbol: 'CRM', name: 'Salesforce Inc' },
        { symbol: 'ADBE', name: 'Adobe Inc' },
        { symbol: 'CSCO', name: 'Cisco Systems' },
        { symbol: 'INTC', name: 'Intel Corp' },
        { symbol: 'AMD', name: 'Advanced Micro Devices' },
        { symbol: 'QCOM', name: 'QUALCOMM Inc' },
        { symbol: 'TXN', name: 'Texas Instruments' },
        { symbol: 'IBM', name: 'International Business Machines' },
        { symbol: 'NOW', name: 'ServiceNow Inc' },
        { symbol: 'INTU', name: 'Intuit Inc' },
        { symbol: 'AMAT', name: 'Applied Materials' },
        { symbol: 'MU', name: 'Micron Technology' },
        { symbol: 'SMCI', name: 'Super Micro Computer Inc' },
        { symbol: 'LRCX', name: 'Lam Research' },
        { symbol: 'ADI', name: 'Analog Devices' },
        { symbol: 'KLAC', name: 'KLA Corp' },
        { symbol: 'SNPS', name: 'Synopsys Inc' },
        { symbol: 'CDNS', name: 'Cadence Design Systems' },
        { symbol: 'MRVL', name: 'Marvell Technology' },
        { symbol: 'NXPI', name: 'NXP Semiconductors' },
        { symbol: 'MCHP', name: 'Microchip Technology' },
        { symbol: 'ON', name: 'ON Semiconductor' },
        { symbol: 'MPWR', name: 'Monolithic Power Systems' },
        { symbol: 'SWKS', name: 'Skyworks Solutions' },
        { symbol: 'QRVO', name: 'Qorvo Inc' },
        
        // Technology - Software & Cloud
        { symbol: 'PANW', name: 'Palo Alto Networks' },
        { symbol: 'CRWD', name: 'CrowdStrike Holdings' },
        { symbol: 'SNOW', name: 'Snowflake Inc' },
        { symbol: 'DDOG', name: 'Datadog Inc' },
        { symbol: 'ZS', name: 'Zscaler Inc' },
        { symbol: 'WDAY', name: 'Workday Inc' },
        { symbol: 'FTNT', name: 'Fortinet Inc' },
        { symbol: 'NET', name: 'Cloudflare Inc' },
        { symbol: 'TEAM', name: 'Atlassian Corp' },
        { symbol: 'HUBS', name: 'HubSpot Inc' },
        { symbol: 'OKTA', name: 'Okta Inc' },
        { symbol: 'VEEV', name: 'Veeva Systems' },
        { symbol: 'SPLK', name: 'Splunk Inc' },
        { symbol: 'ANSS', name: 'ANSYS Inc' },
        { symbol: 'ROP', name: 'Roper Technologies' },
        { symbol: 'ADSK', name: 'Autodesk Inc' },
        { symbol: 'TWLO', name: 'Twilio Inc' },
        { symbol: 'DOCU', name: 'DocuSign Inc' },
        { symbol: 'ZM', name: 'Zoom Video Communications' },
        { symbol: 'DKNG', name: 'DraftKings Inc' },
        { symbol: 'PLTR', name: 'Palantir Technologies' },
        { symbol: 'U', name: 'Unity Software' },
        { symbol: 'RBLX', name: 'Roblox Corp' },
        { symbol: 'GTLB', name: 'GitLab Inc' },
        { symbol: 'S', name: 'SentinelOne Inc' },
        
        // Technology - Hardware & Electronics
        { symbol: 'HPQ', name: 'HP Inc' },
        { symbol: 'HPE', name: 'Hewlett Packard Enterprise' },
        { symbol: 'DELL', name: 'Dell Technologies' },
        { symbol: 'APH', name: 'Amphenol Corp' },
        { symbol: 'TEL', name: 'TE Connectivity' },
        { symbol: 'GLW', name: 'Corning Inc' },
        { symbol: 'KEYS', name: 'Keysight Technologies' },
        { symbol: 'ZBRA', name: 'Zebra Technologies' },
        { symbol: 'NTAP', name: 'NetApp Inc' },
        { symbol: 'STX', name: 'Seagate Technology' },
        { symbol: 'WDC', name: 'Western Digital' },
        
        // E-Commerce & Internet
        { symbol: 'SHOP', name: 'Shopify Inc' },
        { symbol: 'EBAY', name: 'eBay Inc' },
        { symbol: 'ETSY', name: 'Etsy Inc' },
        { symbol: 'MELI', name: 'MercadoLibre Inc' },
        { symbol: 'SE', name: 'Sea Ltd' },
        { symbol: 'BABA', name: 'Alibaba Group' },
        { symbol: 'JD', name: 'JD.com Inc' },
        { symbol: 'PDD', name: 'PDD Holdings' },
        
        // Streaming & Media
        { symbol: 'NFLX', name: 'Netflix Inc' },
        { symbol: 'DIS', name: 'Walt Disney Co' },
        { symbol: 'WBD', name: 'Warner Bros Discovery' },
        { symbol: 'PARA', name: 'Paramount Global' },
        { symbol: 'ROKU', name: 'Roku Inc' },
        { symbol: 'SPOT', name: 'Spotify Technology' },
        { symbol: 'MTCH', name: 'Match Group' },
        { symbol: 'PINS', name: 'Pinterest Inc' },
        { symbol: 'SNAP', name: 'Snap Inc' },
        { symbol: 'RDDT', name: 'Reddit Inc' },
        
        // Gaming
        { symbol: 'EA', name: 'Electronic Arts' },
        { symbol: 'TTWO', name: 'Take-Two Interactive' },
        { symbol: 'ATVI', name: 'Activision Blizzard' },
        
        // Finance - Mega Banks
        { symbol: 'JPM', name: 'JPMorgan Chase & Co' },
        { symbol: 'BAC', name: 'Bank of America Corp' },
        { symbol: 'WFC', name: 'Wells Fargo & Co' },
        { symbol: 'C', name: 'Citigroup Inc' },
        { symbol: 'GS', name: 'Goldman Sachs Group' },
        { symbol: 'MS', name: 'Morgan Stanley' },
        { symbol: 'BLK', name: 'BlackRock Inc' },
        { symbol: 'SCHW', name: 'Charles Schwab Corp' },
        { symbol: 'USB', name: 'U.S. Bancorp' },
        { symbol: 'PNC', name: 'PNC Financial Services' },
        { symbol: 'TFC', name: 'Truist Financial Corp' },
        { symbol: 'BK', name: 'Bank of New York Mellon' },
        { symbol: 'STT', name: 'State Street Corp' },
        { symbol: 'COF', name: 'Capital One Financial' },
        { symbol: 'DFS', name: 'Discover Financial Services' },
        { symbol: 'AXP', name: 'American Express Co' },
        
        // Finance - Regional Banks
        { symbol: 'RF', name: 'Regions Financial' },
        { symbol: 'CFG', name: 'Citizens Financial Group' },
        { symbol: 'KEY', name: 'KeyCorp' },
        { symbol: 'FITB', name: 'Fifth Third Bancorp' },
        { symbol: 'HBAN', name: 'Huntington Bancshares' },
        { symbol: 'MTB', name: 'M&T Bank Corp' },
        { symbol: 'ZION', name: 'Zions Bancorp' },
        { symbol: 'WBS', name: 'Webster Financial' },
        { symbol: 'FHN', name: 'First Horizon Corp' },
        { symbol: 'EWBC', name: 'East West Bancorp' },
        { symbol: 'PNFP', name: 'Pinnacle Financial' },
        { symbol: 'SNV', name: 'Synovus Financial' },
        { symbol: 'WAL', name: 'Western Alliance Bancorp' },
        
        // Finance - Investment & Insurance
        { symbol: 'SPGI', name: 'S&P Global Inc' },
        { symbol: 'MCO', name: 'Moody\'s Corp' },
        { symbol: 'CME', name: 'CME Group Inc' },
        { symbol: 'ICE', name: 'Intercontinental Exchange' },
        { symbol: 'MSCI', name: 'MSCI Inc' },
        { symbol: 'NDAQ', name: 'Nasdaq Inc' },
        { symbol: 'CBOE', name: 'Cboe Global Markets' },
        { symbol: 'AMP', name: 'Ameriprise Financial' },
        { symbol: 'TROW', name: 'T. Rowe Price Group' },
        { symbol: 'BEN', name: 'Franklin Resources' },
        { symbol: 'IVZ', name: 'Invesco Ltd' },
        { symbol: 'NTRS', name: 'Northern Trust Corp' },
        
        // Finance - Payment Processors
        { symbol: 'V', name: 'Visa Inc' },
        { symbol: 'MA', name: 'Mastercard Inc' },
        { symbol: 'PYPL', name: 'PayPal Holdings' },
        { symbol: 'SQ', name: 'Block Inc' },
        { symbol: 'FIS', name: 'Fidelity National Info Services' },
        { symbol: 'FISV', name: 'Fiserv Inc' },
        { symbol: 'ADP', name: 'Automatic Data Processing' },
        { symbol: 'PAYX', name: 'Paychex Inc' },
        { symbol: 'FLT', name: 'FleetCor Technologies' },
        { symbol: 'GPN', name: 'Global Payments Inc' },
        
        // Finance - Fintech
        { symbol: 'COIN', name: 'Coinbase Global' },
        { symbol: 'SOFI', name: 'SoFi Technologies' },
        { symbol: 'HOOD', name: 'Robinhood Markets' },
        { symbol: 'AFRM', name: 'Affirm Holdings' },
        { symbol: 'UPST', name: 'Upstart Holdings' },
        { symbol: 'LC', name: 'LendingClub Corp' },
        
        // Insurance
        { symbol: 'BRK.B', name: 'Berkshire Hathaway' },
        { symbol: 'PGR', name: 'Progressive Corp' },
        { symbol: 'ALL', name: 'Allstate Corp' },
        { symbol: 'TRV', name: 'Travelers Companies' },
        { symbol: 'AIG', name: 'American International Group' },
        { symbol: 'MET', name: 'MetLife Inc' },
        { symbol: 'PRU', name: 'Prudential Financial' },
        { symbol: 'AFL', name: 'Aflac Inc' },
        { symbol: 'AJG', name: 'Arthur J Gallagher' },
        { symbol: 'MMC', name: 'Marsh & McLennan' },
        { symbol: 'AON', name: 'Aon PLC' },
        { symbol: 'WRB', name: 'W.R. Berkley Corp' },
        { symbol: 'CB', name: 'Chubb Ltd' },
        { symbol: 'HIG', name: 'Hartford Financial Services' },
        { symbol: 'L', name: 'Loews Corp' },
        { symbol: 'RLI', name: 'RLI Corp' },
        
        // Healthcare - Pharma
        { symbol: 'JNJ', name: 'Johnson & Johnson' },
        { symbol: 'UNH', name: 'UnitedHealth Group' },
        { symbol: 'LLY', name: 'Eli Lilly and Co' },
        { symbol: 'ABBV', name: 'AbbVie Inc' },
        { symbol: 'PFE', name: 'Pfizer Inc' },
        { symbol: 'MRK', name: 'Merck & Co' },
        { symbol: 'TMO', name: 'Thermo Fisher Scientific' },
        { symbol: 'ABT', name: 'Abbott Laboratories' },
        { symbol: 'DHR', name: 'Danaher Corp' },
        { symbol: 'AMGN', name: 'Amgen Inc' },
        { symbol: 'GILD', name: 'Gilead Sciences' },
        { symbol: 'VRTX', name: 'Vertex Pharmaceuticals' },
        { symbol: 'REGN', name: 'Regeneron Pharmaceuticals' },
        { symbol: 'BMY', name: 'Bristol Myers Squibb' },
        { symbol: 'BIIB', name: 'Biogen Inc' },
        { symbol: 'MRNA', name: 'Moderna Inc' },
        { symbol: 'BNTX', name: 'BioNTech SE' },
        { symbol: 'ZTS', name: 'Zoetis Inc' },
        { symbol: 'BSX', name: 'Boston Scientific' },
        { symbol: 'SYK', name: 'Stryker Corp' },
        { symbol: 'MDT', name: 'Medtronic PLC' },
        { symbol: 'ISRG', name: 'Intuitive Surgical' },
        { symbol: 'EW', name: 'Edwards Lifesciences' },
        { symbol: 'IDXX', name: 'IDEXX Laboratories' },
        { symbol: 'A', name: 'Agilent Technologies' },
        { symbol: 'IQV', name: 'IQVIA Holdings' },
        { symbol: 'DXCM', name: 'DexCom Inc' },
        { symbol: 'ALGN', name: 'Align Technology' },
        { symbol: 'HOLX', name: 'Hologic Inc' },
        { symbol: 'BAX', name: 'Baxter International' },
        { symbol: 'BDX', name: 'Becton Dickinson' },
        { symbol: 'RMD', name: 'ResMed Inc' },
        { symbol: 'WAT', name: 'Waters Corp' },
        { symbol: 'TECH', name: 'Bio-Techne Corp' },
        { symbol: 'PKI', name: 'PerkinElmer Inc' },
        
        // Healthcare - Services & Managed Care
        { symbol: 'CVS', name: 'CVS Health Corp' },
        { symbol: 'CI', name: 'Cigna Group' },
        { symbol: 'ELV', name: 'Elevance Health' },
        { symbol: 'HUM', name: 'Humana Inc' },
        { symbol: 'CNC', name: 'Centene Corp' },
        { symbol: 'MOH', name: 'Molina Healthcare' },
        { symbol: 'HCA', name: 'HCA Healthcare' },
        { symbol: 'UHS', name: 'Universal Health Services' },
        { symbol: 'DVA', name: 'DaVita Inc' },
        { symbol: 'HSIC', name: 'Henry Schein' },
        { symbol: 'CAH', name: 'Cardinal Health' },
        { symbol: 'MCK', name: 'McKesson Corp' },
        { symbol: 'COR', name: 'Cencora Inc' },
        
        // Consumer - Retail
        { symbol: 'WMT', name: 'Walmart Inc' },
        { symbol: 'COST', name: 'Costco Wholesale' },
        { symbol: 'HD', name: 'Home Depot Inc' },
        { symbol: 'LOW', name: 'Lowe\'s Companies' },
        { symbol: 'TGT', name: 'Target Corp' },
        { symbol: 'TJX', name: 'TJX Companies' },
        { symbol: 'ROST', name: 'Ross Stores' },
        { symbol: 'DG', name: 'Dollar General' },
        { symbol: 'DLTR', name: 'Dollar Tree' },
        { symbol: 'BBY', name: 'Best Buy Co' },
        { symbol: 'ULTA', name: 'Ulta Beauty' },
        { symbol: 'FIVE', name: 'Five Below' },
        { symbol: 'DKS', name: 'Dick\'s Sporting Goods' },
        { symbol: 'AZO', name: 'AutoZone Inc' },
        { symbol: 'ORLY', name: 'O\'Reilly Automotive' },
        { symbol: 'AAP', name: 'Advance Auto Parts' },
        { symbol: 'GPC', name: 'Genuine Parts Co' },
        { symbol: 'KSS', name: 'Kohl\'s Corp' },
        { symbol: 'M', name: 'Macy\'s Inc' },
        { symbol: 'JWN', name: 'Nordstrom Inc' },
        
        // Consumer - Apparel & Footwear
        { symbol: 'NKE', name: 'Nike Inc' },
        { symbol: 'LULU', name: 'Lululemon Athletica' },
        { symbol: 'UAA', name: 'Under Armour' },
        { symbol: 'CROX', name: 'Crocs Inc' },
        { symbol: 'DECK', name: 'Deckers Outdoor' },
        { symbol: 'VFC', name: 'VF Corp' },
        { symbol: 'PVH', name: 'PVH Corp' },
        { symbol: 'RL', name: 'Ralph Lauren Corp' },
        { symbol: 'TPR', name: 'Tapestry Inc' },
        { symbol: 'CPRI', name: 'Capri Holdings' },
        { symbol: 'HBI', name: 'Hanesbrands Inc' },
        
        // Consumer - Food & Beverage
        { symbol: 'PEP', name: 'PepsiCo Inc' },
        { symbol: 'KO', name: 'Coca-Cola Co' },
        { symbol: 'MDLZ', name: 'Mondelez International' },
        { symbol: 'GIS', name: 'General Mills' },
        { symbol: 'K', name: 'Kellogg Co' },
        { symbol: 'KHC', name: 'Kraft Heinz Co' },
        { symbol: 'HSY', name: 'Hershey Co' },
        { symbol: 'CAG', name: 'Conagra Brands' },
        { symbol: 'CPB', name: 'Campbell Soup Co' },
        { symbol: 'HRL', name: 'Hormel Foods' },
        { symbol: 'SJM', name: 'JM Smucker Co' },
        { symbol: 'MKC', name: 'McCormick & Co' },
        { symbol: 'TSN', name: 'Tyson Foods' },
        { symbol: 'BF.B', name: 'Brown-Forman Corp' },
        { symbol: 'STZ', name: 'Constellation Brands' },
        { symbol: 'TAP', name: 'Molson Coors Beverage' },
        { symbol: 'SAM', name: 'Boston Beer Co' },
        { symbol: 'CELH', name: 'Celsius Holdings' },
        { symbol: 'MNST', name: 'Monster Beverage' },
        
        // Consumer - Household & Personal Care
        { symbol: 'PG', name: 'Procter & Gamble' },
        { symbol: 'CL', name: 'Colgate-Palmolive Co' },
        { symbol: 'KMB', name: 'Kimberly-Clark Corp' },
        { symbol: 'CLX', name: 'Clorox Co' },
        { symbol: 'CHD', name: 'Church & Dwight' },
        { symbol: 'EL', name: 'Estee Lauder Companies' },
        { symbol: 'NWL', name: 'Newell Brands' },
        
        // Consumer - Tobacco
        { symbol: 'PM', name: 'Philip Morris International' },
        { symbol: 'MO', name: 'Altria Group' },
        { symbol: 'BTI', name: 'British American Tobacco' },
        
        // Restaurants
        { symbol: 'MCD', name: 'McDonald\'s Corp' },
        { symbol: 'SBUX', name: 'Starbucks Corp' },
        { symbol: 'CMG', name: 'Chipotle Mexican Grill' },
        { symbol: 'YUM', name: 'Yum! Brands' },
        { symbol: 'QSR', name: 'Restaurant Brands International' },
        { symbol: 'DPZ', name: 'Domino\'s Pizza' },
        { symbol: 'WING', name: 'Wingstop Inc' },
        { symbol: 'CAVA', name: 'CAVA Group' },
        { symbol: 'SHAK', name: 'Shake Shack' },
        { symbol: 'TXRH', name: 'Texas Roadhouse' },
        { symbol: 'DRI', name: 'Darden Restaurants' },
        { symbol: 'EAT', name: 'Brinker International' },
        { symbol: 'BLMN', name: 'Bloomin\' Brands' },
        { symbol: 'CAKE', name: 'Cheesecake Factory' },
        
        // Energy - Integrated
        { symbol: 'XOM', name: 'Exxon Mobil Corp' },
        { symbol: 'CVX', name: 'Chevron Corp' },
        { symbol: 'COP', name: 'ConocoPhillips' },
        { symbol: 'SLB', name: 'Schlumberger NV' },
        { symbol: 'EOG', name: 'EOG Resources' },
        { symbol: 'PXD', name: 'Pioneer Natural Resources' },
        { symbol: 'MPC', name: 'Marathon Petroleum' },
        { symbol: 'VLO', name: 'Valero Energy' },
        { symbol: 'PSX', name: 'Phillips 66' },
        { symbol: 'OXY', name: 'Occidental Petroleum' },
        { symbol: 'HAL', name: 'Halliburton Co' },
        { symbol: 'BKR', name: 'Baker Hughes Co' },
        { symbol: 'DVN', name: 'Devon Energy' },
        { symbol: 'FANG', name: 'Diamondback Energy' },
        { symbol: 'HES', name: 'Hess Corp' },
        { symbol: 'MRO', name: 'Marathon Oil' },
        { symbol: 'OVV', name: 'Ovintiv Inc' },
        { symbol: 'APA', name: 'APA Corp' },
        { symbol: 'CTRA', name: 'Coterra Energy' },
        { symbol: 'EQT', name: 'EQT Corp' },
        { symbol: 'NOV', name: 'NOV Inc' },
        { symbol: 'FTI', name: 'TechnipFMC PLC' },
        
        // Utilities
        { symbol: 'NEE', name: 'NextEra Energy' },
        { symbol: 'DUK', name: 'Duke Energy' },
        { symbol: 'SO', name: 'Southern Co' },
        { symbol: 'D', name: 'Dominion Energy' },
        { symbol: 'AEP', name: 'American Electric Power' },
        { symbol: 'EXC', name: 'Exelon Corp' },
        { symbol: 'SRE', name: 'Sempra Energy' },
        { symbol: 'XEL', name: 'Xcel Energy' },
        { symbol: 'ED', name: 'Consolidated Edison' },
        { symbol: 'WEC', name: 'WEC Energy Group' },
        { symbol: 'AWK', name: 'American Water Works' },
        { symbol: 'ES', name: 'Eversource Energy' },
        { symbol: 'FE', name: 'FirstEnergy Corp' },
        { symbol: 'ETR', name: 'Entergy Corp' },
        { symbol: 'PPL', name: 'PPL Corp' },
        { symbol: 'CMS', name: 'CMS Energy' },
        { symbol: 'PEG', name: 'Public Service Enterprise' },
        { symbol: 'DTE', name: 'DTE Energy' },
        { symbol: 'AEE', name: 'Ameren Corp' },
        { symbol: 'CNP', name: 'CenterPoint Energy' },
        
        // Industrial - Aerospace & Defense
        { symbol: 'BA', name: 'Boeing Co' },
        { symbol: 'RTX', name: 'RTX Corp' },
        { symbol: 'LMT', name: 'Lockheed Martin' },
        { symbol: 'GD', name: 'General Dynamics' },
        { symbol: 'NOC', name: 'Northrop Grumman' },
        { symbol: 'HWM', name: 'Howmet Aerospace' },
        { symbol: 'TDG', name: 'TransDigm Group' },
        { symbol: 'HEI', name: 'HEICO Corp' },
        { symbol: 'TXT', name: 'Textron Inc' },
        
        // Industrial - Machinery & Equipment
        { symbol: 'CAT', name: 'Caterpillar Inc' },
        { symbol: 'DE', name: 'Deere & Co' },
        { symbol: 'ITW', name: 'Illinois Tool Works' },
        { symbol: 'EMR', name: 'Emerson Electric' },
        { symbol: 'ETN', name: 'Eaton Corp' },
        { symbol: 'PH', name: 'Parker-Hannifin' },
        { symbol: 'CMI', name: 'Cummins Inc' },
        { symbol: 'ROK', name: 'Rockwell Automation' },
        { symbol: 'PCAR', name: 'PACCAR Inc' },
        { symbol: 'IR', name: 'Ingersoll Rand' },
        { symbol: 'OTIS', name: 'Otis Worldwide' },
        { symbol: 'CARR', name: 'Carrier Global' },
        { symbol: 'JCI', name: 'Johnson Controls' },
        { symbol: 'GWW', name: 'W.W. Grainger' },
        { symbol: 'FAST', name: 'Fastenal Co' },
        { symbol: 'VMC', name: 'Vulcan Materials' },
        { symbol: 'MLM', name: 'Martin Marietta Materials' },
        
        // Industrial - Conglomerate
        { symbol: 'GE', name: 'General Electric' },
        { symbol: 'HON', name: 'Honeywell International' },
        { symbol: 'MMM', name: '3M Co' },
        
        // Transportation & Logistics
        { symbol: 'UPS', name: 'United Parcel Service' },
        { symbol: 'FDX', name: 'FedEx Corp' },
        { symbol: 'UBER', name: 'Uber Technologies' },
        { symbol: 'LYFT', name: 'Lyft Inc' },
        { symbol: 'CSX', name: 'CSX Corp' },
        { symbol: 'UNP', name: 'Union Pacific' },
        { symbol: 'NSC', name: 'Norfolk Southern' },
        { symbol: 'JBHT', name: 'JB Hunt Transport' },
        { symbol: 'CHRW', name: 'CH Robinson Worldwide' },
        { symbol: 'EXPD', name: 'Expeditors International' },
        { symbol: 'XPO', name: 'XPO Logistics' },
        { symbol: 'R', name: 'Ryder System' },
        
        // Airlines
        { symbol: 'DAL', name: 'Delta Air Lines' },
        { symbol: 'UAL', name: 'United Airlines Holdings' },
        { symbol: 'AAL', name: 'American Airlines Group' },
        { symbol: 'LUV', name: 'Southwest Airlines' },
        { symbol: 'ALK', name: 'Alaska Air Group' },
        { symbol: 'JBLU', name: 'JetBlue Airways' },
        { symbol: 'SAVE', name: 'Spirit Airlines' },
        
        // Automotive
        { symbol: 'F', name: 'Ford Motor Co' },
        { symbol: 'GM', name: 'General Motors Co' },
        { symbol: 'RIVN', name: 'Rivian Automotive' },
        { symbol: 'LCID', name: 'Lucid Group' },
        { symbol: 'NIO', name: 'NIO Inc' },
        { symbol: 'XPEV', name: 'XPeng Inc' },
        { symbol: 'LI', name: 'Li Auto Inc' },
        
        // Telecom
        { symbol: 'T', name: 'AT&T Inc' },
        { symbol: 'VZ', name: 'Verizon Communications' },
        { symbol: 'TMUS', name: 'T-Mobile US' },
        { symbol: 'CMCSA', name: 'Comcast Corp' },
        { symbol: 'CHTR', name: 'Charter Communications' },
        
        // Travel & Leisure
        { symbol: 'ABNB', name: 'Airbnb Inc' },
        { symbol: 'BKNG', name: 'Booking Holdings' },
        { symbol: 'EXPE', name: 'Expedia Group' },
        { symbol: 'MAR', name: 'Marriott International' },
        { symbol: 'HLT', name: 'Hilton Worldwide Holdings' },
        { symbol: 'H', name: 'Hyatt Hotels' },
        { symbol: 'IHG', name: 'InterContinental Hotels' },
        { symbol: 'RCL', name: 'Royal Caribbean Cruises' },
        { symbol: 'CCL', name: 'Carnival Corp' },
        { symbol: 'NCLH', name: 'Norwegian Cruise Line' },
        { symbol: 'MGM', name: 'MGM Resorts International' },
        { symbol: 'WYNN', name: 'Wynn Resorts' },
        { symbol: 'LVS', name: 'Las Vegas Sands' },
        { symbol: 'CZR', name: 'Caesars Entertainment' },
        { symbol: 'PENN', name: 'Penn Entertainment' },
        
        // Real Estate - REITs
        { symbol: 'AMT', name: 'American Tower Corp' },
        { symbol: 'PLD', name: 'Prologis Inc' },
        { symbol: 'CCI', name: 'Crown Castle Inc' },
        { symbol: 'EQIX', name: 'Equinix Inc' },
        { symbol: 'PSA', name: 'Public Storage' },
        { symbol: 'SPG', name: 'Simon Property Group' },
        { symbol: 'O', name: 'Realty Income Corp' },
        { symbol: 'DLR', name: 'Digital Realty Trust' },
        { symbol: 'WELL', name: 'Welltower Inc' },
        { symbol: 'AVB', name: 'AvalonBay Communities' },
        { symbol: 'EQR', name: 'Equity Residential' },
        { symbol: 'VTR', name: 'Ventas Inc' },
        { symbol: 'ARE', name: 'Alexandria Real Estate' },
        { symbol: 'SBAC', name: 'SBA Communications' },
        { symbol: 'INVH', name: 'Invitation Homes' },
        { symbol: 'MAA', name: 'Mid-America Apartment' },
        { symbol: 'ESS', name: 'Essex Property Trust' },
        { symbol: 'KIM', name: 'Kimco Realty' },
        { symbol: 'REG', name: 'Regency Centers' },
        { symbol: 'BXP', name: 'Boston Properties' },
        { symbol: 'VNO', name: 'Vornado Realty Trust' },
        { symbol: 'SLG', name: 'SL Green Realty' },
        
        // Materials - Chemicals
        { symbol: 'LIN', name: 'Linde PLC' },
        { symbol: 'APD', name: 'Air Products & Chemicals' },
        { symbol: 'SHW', name: 'Sherwin-Williams' },
        { symbol: 'ECL', name: 'Ecolab Inc' },
        { symbol: 'DD', name: 'DuPont de Nemours' },
        { symbol: 'DOW', name: 'Dow Inc' },
        { symbol: 'PPG', name: 'PPG Industries' },
        { symbol: 'LYB', name: 'LyondellBasell Industries' },
        { symbol: 'CE', name: 'Celanese Corp' },
        { symbol: 'ALB', name: 'Albemarle Corp' },
        { symbol: 'EMN', name: 'Eastman Chemical' },
        { symbol: 'FMC', name: 'FMC Corp' },
        { symbol: 'IFF', name: 'International Flavors & Fragrances' },
        
        // Materials - Metals & Mining
        { symbol: 'NUE', name: 'Nucor Corp' },
        { symbol: 'FCX', name: 'Freeport-McMoRan' },
        { symbol: 'NEM', name: 'Newmont Corp' },
        { symbol: 'GOLD', name: 'Barrick Gold Corp' },
        { symbol: 'STLD', name: 'Steel Dynamics' },
        { symbol: 'RS', name: 'Reliance Steel & Aluminum' },
        { symbol: 'AA', name: 'Alcoa Corp' },
        { symbol: 'MP', name: 'MP Materials' },
        
        // Materials - Packaging & Containers
        { symbol: 'PKG', name: 'Packaging Corp of America' },
        { symbol: 'BALL', name: 'Ball Corp' },
        { symbol: 'AVY', name: 'Avery Dennison' },
        { symbol: 'SEE', name: 'Sealed Air' },
        { symbol: 'WRK', name: 'WestRock Co' },
        { symbol: 'IP', name: 'International Paper' },
        { symbol: 'AMC', name: 'AMC Entertainment' },
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
      
      // Fetch 3 months of data to support 90-day view
      const [dowResponse, sp500Response, nasdaqResponse] = await Promise.all([
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/DIA?range=3mo&interval=1d'),
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=3mo&interval=1d'),
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/QQQ?range=3mo&interval=1d')
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
    fetchSymbolList(); // Fetch stock symbols for Stock Search
    preloadAIPicksData(); // Preload AI Picks data in background
  }, []);

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
                  <Text style={styles.shareButtonIcon}>📤</Text>
                  <Text style={styles.shareButtonText}>Share</Text>
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
});

export default HomeScreen;