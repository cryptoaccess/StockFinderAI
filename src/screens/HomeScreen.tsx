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
  const [symbolList, setSymbolList] = useState<Array<{symbol: string, name: string, category: string}>>([]);

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
      const symbols: Array<{symbol: string, name: string, category: string}> = [
        // Technology - Mega Cap
        { symbol: 'AAPL', name: 'Apple Inc', category: 'Information Technology' },
        { symbol: 'MSFT', name: 'Microsoft Corp', category: 'Information Technology' },
        { symbol: 'GOOGL', name: 'Alphabet Inc', category: 'Information Technology' },
        { symbol: 'GOOG', name: 'Alphabet Inc Class C', category: 'Information Technology' },
        { symbol: 'AMZN', name: 'Amazon.com Inc', category: 'Information Technology' },
        { symbol: 'META', name: 'Meta Platforms', category: 'Information Technology' },
        { symbol: 'NVDA', name: 'NVIDIA Corp', category: 'Information Technology' },
        { symbol: 'TSLA', name: 'Tesla Inc', category: 'Information Technology' },
        
        // Technology - Large Cap
        { symbol: 'AVGO', name: 'Broadcom Inc', category: 'Information Technology' },
        { symbol: 'ORCL', name: 'Oracle Corp', category: 'Information Technology' },
        { symbol: 'CRM', name: 'Salesforce Inc', category: 'Information Technology' },
        { symbol: 'ADBE', name: 'Adobe Inc', category: 'Information Technology' },
        { symbol: 'CSCO', name: 'Cisco Systems', category: 'Information Technology' },
        { symbol: 'INTC', name: 'Intel Corp', category: 'Information Technology' },
        { symbol: 'AMD', name: 'Advanced Micro Devices', category: 'Information Technology' },
        { symbol: 'QCOM', name: 'QUALCOMM Inc', category: 'Information Technology' },
        { symbol: 'TXN', name: 'Texas Instruments', category: 'Information Technology' },
        { symbol: 'IBM', name: 'International Business Machines', category: 'Information Technology' },
        { symbol: 'NOW', name: 'ServiceNow Inc', category: 'Information Technology' },
        { symbol: 'INTU', name: 'Intuit Inc', category: 'Information Technology' },
        { symbol: 'AMAT', name: 'Applied Materials', category: 'Information Technology' },
        { symbol: 'MU', name: 'Micron Technology', category: 'Information Technology' },
        { symbol: 'SMCI', name: 'Super Micro Computer Inc', category: 'Information Technology' },
        { symbol: 'LRCX', name: 'Lam Research', category: 'Information Technology' },
        { symbol: 'ADI', name: 'Analog Devices', category: 'Information Technology' },
        { symbol: 'KLAC', name: 'KLA Corp', category: 'Information Technology' },
        { symbol: 'SNPS', name: 'Synopsys Inc', category: 'Information Technology' },
        { symbol: 'CDNS', name: 'Cadence Design Systems', category: 'Information Technology' },
        { symbol: 'MRVL', name: 'Marvell Technology', category: 'Information Technology' },
        { symbol: 'NXPI', name: 'NXP Semiconductors', category: 'Information Technology' },
        { symbol: 'MCHP', name: 'Microchip Technology', category: 'Information Technology' },
        { symbol: 'ON', name: 'ON Semiconductor', category: 'Information Technology' },
        { symbol: 'MPWR', name: 'Monolithic Power Systems', category: 'Information Technology' },
        { symbol: 'SWKS', name: 'Skyworks Solutions', category: 'Information Technology' },
        { symbol: 'QRVO', name: 'Qorvo Inc', category: 'Information Technology' },
        
        // Technology - Software & Cloud
        { symbol: 'PANW', name: 'Palo Alto Networks', category: 'Information Technology' },
        { symbol: 'CRWD', name: 'CrowdStrike Holdings', category: 'Information Technology' },
        { symbol: 'SNOW', name: 'Snowflake Inc', category: 'Information Technology' },
        { symbol: 'DDOG', name: 'Datadog Inc', category: 'Information Technology' },
        { symbol: 'ZS', name: 'Zscaler Inc', category: 'Information Technology' },
        { symbol: 'WDAY', name: 'Workday Inc', category: 'Information Technology' },
        { symbol: 'FTNT', name: 'Fortinet Inc', category: 'Information Technology' },
        { symbol: 'NET', name: 'Cloudflare Inc', category: 'Information Technology' },
        { symbol: 'TEAM', name: 'Atlassian Corp', category: 'Information Technology' },
        { symbol: 'HUBS', name: 'HubSpot Inc', category: 'Information Technology' },
        { symbol: 'OKTA', name: 'Okta Inc', category: 'Information Technology' },
        { symbol: 'VEEV', name: 'Veeva Systems', category: 'Information Technology' },
        { symbol: 'SPLK', name: 'Splunk Inc', category: 'Information Technology' },
        { symbol: 'ANSS', name: 'ANSYS Inc', category: 'Information Technology' },
        { symbol: 'ROP', name: 'Roper Technologies', category: 'Information Technology' },
        { symbol: 'ADSK', name: 'Autodesk Inc', category: 'Information Technology' },
        { symbol: 'TWLO', name: 'Twilio Inc', category: 'Information Technology' },
        { symbol: 'DOCU', name: 'DocuSign Inc', category: 'Information Technology' },
        { symbol: 'ZM', name: 'Zoom Video Communications', category: 'Information Technology' },
        { symbol: 'DKNG', name: 'DraftKings Inc', category: 'Information Technology' },
        { symbol: 'PLTR', name: 'Palantir Technologies', category: 'Information Technology' },
        { symbol: 'U', name: 'Unity Software', category: 'Information Technology' },
        { symbol: 'RBLX', name: 'Roblox Corp', category: 'Information Technology' },
        { symbol: 'GTLB', name: 'GitLab Inc', category: 'Information Technology' },
        { symbol: 'S', name: 'SentinelOne Inc', category: 'Information Technology' },
        
        // Technology - Hardware & Electronics
        { symbol: 'HPQ', name: 'HP Inc', category: 'Information Technology' },
        { symbol: 'HPE', name: 'Hewlett Packard Enterprise', category: 'Information Technology' },
        { symbol: 'DELL', name: 'Dell Technologies', category: 'Information Technology' },
        { symbol: 'APH', name: 'Amphenol Corp', category: 'Information Technology' },
        { symbol: 'TEL', name: 'TE Connectivity', category: 'Information Technology' },
        { symbol: 'GLW', name: 'Corning Inc', category: 'Information Technology' },
        { symbol: 'KEYS', name: 'Keysight Technologies', category: 'Information Technology' },
        { symbol: 'ZBRA', name: 'Zebra Technologies', category: 'Information Technology' },
        { symbol: 'NTAP', name: 'NetApp Inc', category: 'Information Technology' },
        { symbol: 'STX', name: 'Seagate Technology', category: 'Information Technology' },
        { symbol: 'WDC', name: 'Western Digital', category: 'Information Technology' },
        { symbol: 'ENPH', name: 'Enphase Energy', category: 'Information Technology' },
        { symbol: 'SEDG', name: 'SolarEdge Technologies', category: 'Information Technology' },
        { symbol: 'FSLR', name: 'First Solar Inc', category: 'Information Technology' },
        { symbol: 'PATH', name: 'UiPath Inc', category: 'Information Technology' },
        { symbol: 'BILL', name: 'Bill.com Holdings', category: 'Information Technology' },
        { symbol: 'ESTC', name: 'Elastic NV', category: 'Information Technology' },
        { symbol: 'CFLT', name: 'Confluent Inc', category: 'Information Technology' },
        
        // E-Commerce & Internet
        { symbol: 'SHOP', name: 'Shopify Inc', category: 'Consumer Discretionary' },
        { symbol: 'EBAY', name: 'eBay Inc', category: 'Consumer Discretionary' },
        { symbol: 'ETSY', name: 'Etsy Inc', category: 'Consumer Discretionary' },
        { symbol: 'MELI', name: 'MercadoLibre Inc', category: 'Consumer Discretionary' },
        { symbol: 'SE', name: 'Sea Ltd', category: 'Consumer Discretionary' },
        { symbol: 'BABA', name: 'Alibaba Group', category: 'Consumer Discretionary' },
        { symbol: 'JD', name: 'JD.com Inc', category: 'Consumer Discretionary' },
        { symbol: 'PDD', name: 'PDD Holdings', category: 'Consumer Discretionary' },
        
        // Streaming & Media
        { symbol: 'NFLX', name: 'Netflix Inc', category: 'Communication Services' },
        { symbol: 'DIS', name: 'Walt Disney Co', category: 'Communication Services' },
        { symbol: 'WBD', name: 'Warner Bros Discovery', category: 'Communication Services' },
        { symbol: 'PARA', name: 'Paramount Global', category: 'Communication Services' },
        { symbol: 'ROKU', name: 'Roku Inc', category: 'Communication Services' },
        { symbol: 'SPOT', name: 'Spotify Technology', category: 'Communication Services' },
        { symbol: 'MTCH', name: 'Match Group', category: 'Communication Services' },
        { symbol: 'PINS', name: 'Pinterest Inc', category: 'Communication Services' },
        { symbol: 'SNAP', name: 'Snap Inc', category: 'Communication Services' },
        { symbol: 'RDDT', name: 'Reddit Inc', category: 'Communication Services' },
        
        // Gaming
        { symbol: 'EA', name: 'Electronic Arts', category: 'Communication Services' },
        { symbol: 'TTWO', name: 'Take-Two Interactive', category: 'Communication Services' },
        { symbol: 'ATVI', name: 'Activision Blizzard', category: 'Communication Services' },
        { symbol: 'AMC', name: 'AMC Entertainment', category: 'Communication Services' },
        { symbol: 'NWSA', name: 'News Corp', category: 'Communication Services' },
        { symbol: 'FOXA', name: 'Fox Corp', category: 'Communication Services' },
        { symbol: 'OMC', name: 'Omnicom Group', category: 'Communication Services' },
        { symbol: 'IPG', name: 'Interpublic Group', category: 'Communication Services' },
        
        // Finance - Mega Banks
        { symbol: 'JPM', name: 'JPMorgan Chase & Co', category: 'Financials' },
        { symbol: 'BAC', name: 'Bank of America Corp', category: 'Financials' },
        { symbol: 'WFC', name: 'Wells Fargo & Co', category: 'Financials' },
        { symbol: 'C', name: 'Citigroup Inc', category: 'Financials' },
        { symbol: 'GS', name: 'Goldman Sachs Group', category: 'Financials' },
        { symbol: 'MS', name: 'Morgan Stanley', category: 'Financials' },
        { symbol: 'BLK', name: 'BlackRock Inc', category: 'Financials' },
        { symbol: 'SCHW', name: 'Charles Schwab Corp', category: 'Financials' },
        { symbol: 'USB', name: 'U.S. Bancorp', category: 'Financials' },
        { symbol: 'PNC', name: 'PNC Financial Services', category: 'Financials' },
        { symbol: 'TFC', name: 'Truist Financial Corp', category: 'Financials' },
        { symbol: 'BK', name: 'Bank of New York Mellon', category: 'Financials' },
        { symbol: 'STT', name: 'State Street Corp', category: 'Financials' },
        { symbol: 'COF', name: 'Capital One Financial', category: 'Financials' },
        { symbol: 'DFS', name: 'Discover Financial Services', category: 'Financials' },
        { symbol: 'AXP', name: 'American Express Co', category: 'Financials' },
        
        // Finance - Regional Banks
        { symbol: 'RF', name: 'Regions Financial', category: 'Financials' },
        { symbol: 'CFG', name: 'Citizens Financial Group', category: 'Financials' },
        { symbol: 'KEY', name: 'KeyCorp', category: 'Financials' },
        { symbol: 'FITB', name: 'Fifth Third Bancorp', category: 'Financials' },
        { symbol: 'HBAN', name: 'Huntington Bancshares', category: 'Financials' },
        { symbol: 'MTB', name: 'M&T Bank Corp', category: 'Financials' },
        { symbol: 'ZION', name: 'Zions Bancorp', category: 'Financials' },
        { symbol: 'WBS', name: 'Webster Financial', category: 'Financials' },
        { symbol: 'FHN', name: 'First Horizon Corp', category: 'Financials' },
        { symbol: 'EWBC', name: 'East West Bancorp', category: 'Financials' },
        { symbol: 'PNFP', name: 'Pinnacle Financial', category: 'Financials' },
        { symbol: 'SNV', name: 'Synovus Financial', category: 'Financials' },
        { symbol: 'WAL', name: 'Western Alliance Bancorp', category: 'Financials' },
        
        // Finance - Investment & Insurance
        { symbol: 'SPGI', name: 'S&P Global Inc', category: 'Financials' },
        { symbol: 'MCO', name: 'Moody\'s Corp', category: 'Financials' },
        { symbol: 'CME', name: 'CME Group Inc', category: 'Financials' },
        { symbol: 'ICE', name: 'Intercontinental Exchange', category: 'Financials' },
        { symbol: 'MSCI', name: 'MSCI Inc', category: 'Financials' },
        { symbol: 'NDAQ', name: 'Nasdaq Inc', category: 'Financials' },
        { symbol: 'CBOE', name: 'Cboe Global Markets', category: 'Financials' },
        { symbol: 'AMP', name: 'Ameriprise Financial', category: 'Financials' },
        { symbol: 'TROW', name: 'T. Rowe Price Group', category: 'Financials' },
        { symbol: 'BEN', name: 'Franklin Resources', category: 'Financials' },
        { symbol: 'IVZ', name: 'Invesco Ltd', category: 'Financials' },
        { symbol: 'NTRS', name: 'Northern Trust Corp', category: 'Financials' },
        
        // Finance - Payment Processors
        { symbol: 'V', name: 'Visa Inc', category: 'Financials' },
        { symbol: 'MA', name: 'Mastercard Inc', category: 'Financials' },
        { symbol: 'PYPL', name: 'PayPal Holdings', category: 'Financials' },
        { symbol: 'SQ', name: 'Block Inc', category: 'Financials' },
        { symbol: 'FIS', name: 'Fidelity National Info Services', category: 'Financials' },
        { symbol: 'FISV', name: 'Fiserv Inc', category: 'Financials' },
        { symbol: 'ADP', name: 'Automatic Data Processing', category: 'Financials' },
        { symbol: 'PAYX', name: 'Paychex Inc', category: 'Financials' },
        { symbol: 'FLT', name: 'FleetCor Technologies', category: 'Financials' },
        { symbol: 'GPN', name: 'Global Payments Inc', category: 'Financials' },
        
        // Finance - Fintech
        { symbol: 'COIN', name: 'Coinbase Global', category: 'Financials' },
        { symbol: 'SOFI', name: 'SoFi Technologies', category: 'Financials' },
        { symbol: 'HOOD', name: 'Robinhood Markets', category: 'Financials' },
        { symbol: 'AFRM', name: 'Affirm Holdings', category: 'Financials' },
        { symbol: 'UPST', name: 'Upstart Holdings', category: 'Financials' },
        { symbol: 'LC', name: 'LendingClub Corp', category: 'Financials' },
        { symbol: 'RJF', name: 'Raymond James Financial', category: 'Financials' },
        { symbol: 'SIVB', name: 'SVB Financial Group', category: 'Financials' },
        { symbol: 'CMA', name: 'Comerica Inc', category: 'Financials' },
        { symbol: 'FCNCA', name: 'First Citizens BancShares', category: 'Financials' },
        { symbol: 'ALLY', name: 'Ally Financial', category: 'Financials' },
        { symbol: 'SYF', name: 'Synchrony Financial', category: 'Financials' },
        
        // Insurance
        { symbol: 'BRK.B', name: 'Berkshire Hathaway', category: 'Financials' },
        { symbol: 'PGR', name: 'Progressive Corp', category: 'Financials' },
        { symbol: 'ALL', name: 'Allstate Corp', category: 'Financials' },
        { symbol: 'TRV', name: 'Travelers Companies', category: 'Financials' },
        { symbol: 'AIG', name: 'American International Group', category: 'Financials' },
        { symbol: 'MET', name: 'MetLife Inc', category: 'Financials' },
        { symbol: 'PRU', name: 'Prudential Financial', category: 'Financials' },
        { symbol: 'AFL', name: 'Aflac Inc', category: 'Financials' },
        { symbol: 'AJG', name: 'Arthur J Gallagher', category: 'Financials' },
        { symbol: 'MMC', name: 'Marsh & McLennan', category: 'Financials' },
        { symbol: 'AON', name: 'Aon PLC', category: 'Financials' },
        { symbol: 'WRB', name: 'W.R. Berkley Corp', category: 'Financials' },
        { symbol: 'CB', name: 'Chubb Ltd', category: 'Financials' },
        { symbol: 'HIG', name: 'Hartford Financial Services', category: 'Financials' },
        { symbol: 'L', name: 'Loews Corp', category: 'Financials' },
        { symbol: 'RLI', name: 'RLI Corp', category: 'Financials' },
        { symbol: 'GL', name: 'Globe Life Inc', category: 'Financials' },
        { symbol: 'CINF', name: 'Cincinnati Financial', category: 'Financials' },
        
        // Healthcare - Pharma
        { symbol: 'JNJ', name: 'Johnson & Johnson', category: 'Health Care' },
        { symbol: 'UNH', name: 'UnitedHealth Group', category: 'Health Care' },
        { symbol: 'LLY', name: 'Eli Lilly and Co', category: 'Health Care' },
        { symbol: 'ABBV', name: 'AbbVie Inc', category: 'Health Care' },
        { symbol: 'PFE', name: 'Pfizer Inc', category: 'Health Care' },
        { symbol: 'MRK', name: 'Merck & Co', category: 'Health Care' },
        { symbol: 'TMO', name: 'Thermo Fisher Scientific', category: 'Health Care' },
        { symbol: 'ABT', name: 'Abbott Laboratories', category: 'Health Care' },
        { symbol: 'DHR', name: 'Danaher Corp', category: 'Health Care' },
        { symbol: 'AMGN', name: 'Amgen Inc', category: 'Health Care' },
        { symbol: 'GILD', name: 'Gilead Sciences', category: 'Health Care' },
        { symbol: 'VRTX', name: 'Vertex Pharmaceuticals', category: 'Health Care' },
        { symbol: 'REGN', name: 'Regeneron Pharmaceuticals', category: 'Health Care' },
        { symbol: 'BMY', name: 'Bristol Myers Squibb', category: 'Health Care' },
        { symbol: 'BIIB', name: 'Biogen Inc', category: 'Health Care' },
        { symbol: 'MRNA', name: 'Moderna Inc', category: 'Health Care' },
        { symbol: 'BNTX', name: 'BioNTech SE', category: 'Health Care' },
        { symbol: 'ZTS', name: 'Zoetis Inc', category: 'Health Care' },
        { symbol: 'BSX', name: 'Boston Scientific', category: 'Health Care' },
        { symbol: 'SYK', name: 'Stryker Corp', category: 'Health Care' },
        { symbol: 'MDT', name: 'Medtronic PLC', category: 'Health Care' },
        { symbol: 'ISRG', name: 'Intuitive Surgical', category: 'Health Care' },
        { symbol: 'EW', name: 'Edwards Lifesciences', category: 'Health Care' },
        { symbol: 'IDXX', name: 'IDEXX Laboratories', category: 'Health Care' },
        { symbol: 'A', name: 'Agilent Technologies', category: 'Health Care' },
        { symbol: 'IQV', name: 'IQVIA Holdings', category: 'Health Care' },
        { symbol: 'DXCM', name: 'DexCom Inc', category: 'Health Care' },
        { symbol: 'ALGN', name: 'Align Technology', category: 'Health Care' },
        { symbol: 'HOLX', name: 'Hologic Inc', category: 'Health Care' },
        { symbol: 'BAX', name: 'Baxter International', category: 'Health Care' },
        { symbol: 'BDX', name: 'Becton Dickinson', category: 'Health Care' },
        { symbol: 'RMD', name: 'ResMed Inc', category: 'Health Care' },
        { symbol: 'WAT', name: 'Waters Corp', category: 'Health Care' },
        { symbol: 'TECH', name: 'Bio-Techne Corp', category: 'Health Care' },
        { symbol: 'PKI', name: 'PerkinElmer Inc', category: 'Health Care' },
        { symbol: 'ILMN', name: 'Illumina Inc', category: 'Health Care' },
        { symbol: 'EXAS', name: 'Exact Sciences', category: 'Health Care' },
        { symbol: 'INCY', name: 'Incyte Corp', category: 'Health Care' },
        { symbol: 'SGEN', name: 'Seagen Inc', category: 'Health Care' },
        { symbol: 'ALNY', name: 'Alnylam Pharmaceuticals', category: 'Health Care' },
        { symbol: 'NBIX', name: 'Neurocrine Biosciences', category: 'Health Care' },
        { symbol: 'VTRS', name: 'Viatris Inc', category: 'Health Care' },
        { symbol: 'ZBH', name: 'Zimmer Biomet Holdings', category: 'Health Care' },
        
        // Healthcare - Services & Managed Care
        { symbol: 'CVS', name: 'CVS Health Corp', category: 'Health Care' },
        { symbol: 'CI', name: 'Cigna Group', category: 'Health Care' },
        { symbol: 'ELV', name: 'Elevance Health', category: 'Health Care' },
        { symbol: 'HUM', name: 'Humana Inc', category: 'Health Care' },
        { symbol: 'CNC', name: 'Centene Corp', category: 'Health Care' },
        { symbol: 'MOH', name: 'Molina Healthcare', category: 'Health Care' },
        { symbol: 'HCA', name: 'HCA Healthcare', category: 'Health Care' },
        { symbol: 'UHS', name: 'Universal Health Services', category: 'Health Care' },
        { symbol: 'DVA', name: 'DaVita Inc', category: 'Health Care' },
        { symbol: 'HSIC', name: 'Henry Schein', category: 'Health Care' },
        { symbol: 'CAH', name: 'Cardinal Health', category: 'Health Care' },
        { symbol: 'MCK', name: 'McKesson Corp', category: 'Health Care' },
        { symbol: 'COR', name: 'Cencora Inc', category: 'Health Care' },
        
        // Consumer - Retail
        { symbol: 'WMT', name: 'Walmart Inc', category: 'Consumer Discretionary' },
        { symbol: 'COST', name: 'Costco Wholesale', category: 'Consumer Discretionary' },
        { symbol: 'HD', name: 'Home Depot Inc', category: 'Consumer Discretionary' },
        { symbol: 'LOW', name: 'Lowe\'s Companies', category: 'Consumer Discretionary' },
        { symbol: 'TGT', name: 'Target Corp', category: 'Consumer Discretionary' },
        { symbol: 'TJX', name: 'TJX Companies', category: 'Consumer Discretionary' },
        { symbol: 'ROST', name: 'Ross Stores', category: 'Consumer Discretionary' },
        { symbol: 'DG', name: 'Dollar General', category: 'Consumer Discretionary' },
        { symbol: 'DLTR', name: 'Dollar Tree', category: 'Consumer Discretionary' },
        { symbol: 'BBY', name: 'Best Buy Co', category: 'Consumer Discretionary' },
        { symbol: 'ULTA', name: 'Ulta Beauty', category: 'Consumer Discretionary' },
        { symbol: 'FIVE', name: 'Five Below', category: 'Consumer Discretionary' },
        { symbol: 'DKS', name: 'Dick\'s Sporting Goods', category: 'Consumer Discretionary' },
        { symbol: 'AZO', name: 'AutoZone Inc', category: 'Consumer Discretionary' },
        { symbol: 'ORLY', name: 'O\'Reilly Automotive', category: 'Consumer Discretionary' },
        { symbol: 'AAP', name: 'Advance Auto Parts', category: 'Consumer Discretionary' },
        { symbol: 'GPC', name: 'Genuine Parts Co', category: 'Consumer Discretionary' },
        { symbol: 'KSS', name: 'Kohl\'s Corp', category: 'Consumer Discretionary' },
        { symbol: 'M', name: 'Macy\'s Inc', category: 'Consumer Discretionary' },
        { symbol: 'JWN', name: 'Nordstrom Inc', category: 'Consumer Discretionary' },
        { symbol: 'TSCO', name: 'Tractor Supply Co', category: 'Consumer Discretionary' },
        { symbol: 'AN', name: 'AutoNation Inc', category: 'Consumer Discretionary' },
        { symbol: 'PAG', name: 'Penske Automotive Group', category: 'Consumer Discretionary' },
        { symbol: 'LAD', name: 'Lithia Motors', category: 'Consumer Discretionary' },
        { symbol: 'PLAY', name: 'Dave & Buster\'s Entertainment', category: 'Consumer Discretionary' },
        
        // Consumer - Apparel & Footwear
        { symbol: 'NKE', name: 'Nike Inc', category: 'Consumer Discretionary' },
        { symbol: 'LULU', name: 'Lululemon Athletica', category: 'Consumer Discretionary' },
        { symbol: 'UAA', name: 'Under Armour', category: 'Consumer Discretionary' },
        { symbol: 'CROX', name: 'Crocs Inc', category: 'Consumer Discretionary' },
        { symbol: 'DECK', name: 'Deckers Outdoor', category: 'Consumer Discretionary' },
        { symbol: 'VFC', name: 'VF Corp', category: 'Consumer Discretionary' },
        { symbol: 'PVH', name: 'PVH Corp', category: 'Consumer Discretionary' },
        { symbol: 'RL', name: 'Ralph Lauren Corp', category: 'Consumer Discretionary' },
        { symbol: 'TPR', name: 'Tapestry Inc', category: 'Consumer Discretionary' },
        { symbol: 'CPRI', name: 'Capri Holdings', category: 'Consumer Discretionary' },
        { symbol: 'HBI', name: 'Hanesbrands Inc', category: 'Consumer Discretionary' },
        
        // Consumer - Food & Beverage
        { symbol: 'PEP', name: 'PepsiCo Inc', category: 'Consumer Staples' },
        { symbol: 'KO', name: 'Coca-Cola Co', category: 'Consumer Staples' },
        { symbol: 'MDLZ', name: 'Mondelez International', category: 'Consumer Staples' },
        { symbol: 'GIS', name: 'General Mills', category: 'Consumer Staples' },
        { symbol: 'K', name: 'Kellogg Co', category: 'Consumer Staples' },
        { symbol: 'KHC', name: 'Kraft Heinz Co', category: 'Consumer Staples' },
        { symbol: 'HSY', name: 'Hershey Co', category: 'Consumer Staples' },
        { symbol: 'CAG', name: 'Conagra Brands', category: 'Consumer Staples' },
        { symbol: 'CPB', name: 'Campbell Soup Co', category: 'Consumer Staples' },
        { symbol: 'HRL', name: 'Hormel Foods', category: 'Consumer Staples' },
        { symbol: 'SJM', name: 'JM Smucker Co', category: 'Consumer Staples' },
        { symbol: 'MKC', name: 'McCormick & Co', category: 'Consumer Staples' },
        { symbol: 'TSN', name: 'Tyson Foods', category: 'Consumer Staples' },
        { symbol: 'BF.B', name: 'Brown-Forman Corp', category: 'Consumer Staples' },
        { symbol: 'STZ', name: 'Constellation Brands', category: 'Consumer Staples' },
        { symbol: 'TAP', name: 'Molson Coors Beverage', category: 'Consumer Staples' },
        { symbol: 'SAM', name: 'Boston Beer Co', category: 'Consumer Staples' },
        { symbol: 'CELH', name: 'Celsius Holdings', category: 'Consumer Staples' },
        { symbol: 'MNST', name: 'Monster Beverage', category: 'Consumer Staples' },
        
        // Consumer - Household & Personal Care
        { symbol: 'PG', name: 'Procter & Gamble', category: 'Consumer Staples' },
        { symbol: 'CL', name: 'Colgate-Palmolive Co', category: 'Consumer Staples' },
        { symbol: 'KMB', name: 'Kimberly-Clark Corp', category: 'Consumer Staples' },
        { symbol: 'CLX', name: 'Clorox Co', category: 'Consumer Staples' },
        { symbol: 'CHD', name: 'Church & Dwight', category: 'Consumer Staples' },
        { symbol: 'EL', name: 'Estee Lauder Companies', category: 'Consumer Staples' },
        { symbol: 'NWL', name: 'Newell Brands', category: 'Consumer Staples' },
        
        // Consumer - Tobacco
        { symbol: 'PM', name: 'Philip Morris International', category: 'Consumer Staples' },
        { symbol: 'MO', name: 'Altria Group', category: 'Consumer Staples' },
        { symbol: 'BTI', name: 'British American Tobacco', category: 'Consumer Staples' },
        { symbol: 'COKE', name: 'Coca-Cola Consolidated', category: 'Consumer Staples' },
        { symbol: 'KDP', name: 'Keurig Dr Pepper', category: 'Consumer Staples' },
        { symbol: 'BG', name: 'Bunge Global SA', category: 'Consumer Staples' },
        { symbol: 'ADM', name: 'Archer-Daniels-Midland', category: 'Consumer Staples' },
        
        // Restaurants
        { symbol: 'MCD', name: 'McDonald\'s Corp', category: 'Consumer Discretionary' },
        { symbol: 'SBUX', name: 'Starbucks Corp', category: 'Consumer Discretionary' },
        { symbol: 'CMG', name: 'Chipotle Mexican Grill', category: 'Consumer Discretionary' },
        { symbol: 'YUM', name: 'Yum! Brands', category: 'Consumer Discretionary' },
        { symbol: 'QSR', name: 'Restaurant Brands International', category: 'Consumer Discretionary' },
        { symbol: 'DPZ', name: 'Domino\'s Pizza', category: 'Consumer Discretionary' },
        { symbol: 'WING', name: 'Wingstop Inc', category: 'Consumer Discretionary' },
        { symbol: 'CAVA', name: 'CAVA Group', category: 'Consumer Discretionary' },
        { symbol: 'SHAK', name: 'Shake Shack', category: 'Consumer Discretionary' },
        { symbol: 'TXRH', name: 'Texas Roadhouse', category: 'Consumer Discretionary' },
        { symbol: 'DRI', name: 'Darden Restaurants', category: 'Consumer Discretionary' },
        { symbol: 'EAT', name: 'Brinker International', category: 'Consumer Discretionary' },
        { symbol: 'BLMN', name: 'Bloomin\' Brands', category: 'Consumer Discretionary' },
        { symbol: 'CAKE', name: 'Cheesecake Factory', category: 'Consumer Discretionary' },
        
        // Energy - Integrated
        { symbol: 'XOM', name: 'Exxon Mobil Corp', category: 'Energy' },
        { symbol: 'CVX', name: 'Chevron Corp', category: 'Energy' },
        { symbol: 'COP', name: 'ConocoPhillips', category: 'Energy' },
        { symbol: 'SLB', name: 'Schlumberger NV', category: 'Energy' },
        { symbol: 'EOG', name: 'EOG Resources', category: 'Energy' },
        { symbol: 'PXD', name: 'Pioneer Natural Resources', category: 'Energy' },
        { symbol: 'MPC', name: 'Marathon Petroleum', category: 'Energy' },
        { symbol: 'VLO', name: 'Valero Energy', category: 'Energy' },
        { symbol: 'PSX', name: 'Phillips 66', category: 'Energy' },
        { symbol: 'OXY', name: 'Occidental Petroleum', category: 'Energy' },
        { symbol: 'HAL', name: 'Halliburton Co', category: 'Energy' },
        { symbol: 'BKR', name: 'Baker Hughes Co', category: 'Energy' },
        { symbol: 'DVN', name: 'Devon Energy', category: 'Energy' },
        { symbol: 'FANG', name: 'Diamondback Energy', category: 'Energy' },
        { symbol: 'HES', name: 'Hess Corp', category: 'Energy' },
        { symbol: 'MRO', name: 'Marathon Oil', category: 'Energy' },
        { symbol: 'OVV', name: 'Ovintiv Inc', category: 'Energy' },
        { symbol: 'APA', name: 'APA Corp', category: 'Energy' },
        { symbol: 'CTRA', name: 'Coterra Energy', category: 'Energy' },
        { symbol: 'EQT', name: 'EQT Corp', category: 'Energy' },
        { symbol: 'NOV', name: 'NOV Inc', category: 'Energy' },
        { symbol: 'FTI', name: 'TechnipFMC PLC', category: 'Energy' },
        
        // Utilities
        { symbol: 'NEE', name: 'NextEra Energy', category: 'Utilities' },
        { symbol: 'DUK', name: 'Duke Energy', category: 'Utilities' },
        { symbol: 'SO', name: 'Southern Co', category: 'Utilities' },
        { symbol: 'D', name: 'Dominion Energy', category: 'Utilities' },
        { symbol: 'AEP', name: 'American Electric Power', category: 'Utilities' },
        { symbol: 'EXC', name: 'Exelon Corp', category: 'Utilities' },
        { symbol: 'SRE', name: 'Sempra Energy', category: 'Utilities' },
        { symbol: 'XEL', name: 'Xcel Energy', category: 'Utilities' },
        { symbol: 'ED', name: 'Consolidated Edison', category: 'Utilities' },
        { symbol: 'WEC', name: 'WEC Energy Group', category: 'Utilities' },
        { symbol: 'AWK', name: 'American Water Works', category: 'Utilities' },
        { symbol: 'ES', name: 'Eversource Energy', category: 'Utilities' },
        { symbol: 'FE', name: 'FirstEnergy Corp', category: 'Utilities' },
        { symbol: 'ETR', name: 'Entergy Corp', category: 'Utilities' },
        { symbol: 'PPL', name: 'PPL Corp', category: 'Utilities' },
        { symbol: 'CMS', name: 'CMS Energy', category: 'Utilities' },
        { symbol: 'PEG', name: 'Public Service Enterprise', category: 'Utilities' },
        { symbol: 'DTE', name: 'DTE Energy', category: 'Utilities' },
        { symbol: 'AEE', name: 'Ameren Corp', category: 'Utilities' },
        { symbol: 'CNP', name: 'CenterPoint Energy', category: 'Utilities' },
        
        // Industrial - Aerospace & Defense
        { symbol: 'BA', name: 'Boeing Co', category: 'Industrials' },
        { symbol: 'RTX', name: 'RTX Corp', category: 'Industrials' },
        { symbol: 'LMT', name: 'Lockheed Martin', category: 'Industrials' },
        { symbol: 'GD', name: 'General Dynamics', category: 'Industrials' },
        { symbol: 'NOC', name: 'Northrop Grumman', category: 'Industrials' },
        { symbol: 'HWM', name: 'Howmet Aerospace', category: 'Industrials' },
        { symbol: 'TDG', name: 'TransDigm Group', category: 'Industrials' },
        { symbol: 'HEI', name: 'HEICO Corp', category: 'Industrials' },
        { symbol: 'TXT', name: 'Textron Inc', category: 'Industrials' },
        
        // Industrial - Machinery & Equipment
        { symbol: 'CAT', name: 'Caterpillar Inc', category: 'Industrials' },
        { symbol: 'DE', name: 'Deere & Co', category: 'Industrials' },
        { symbol: 'ITW', name: 'Illinois Tool Works', category: 'Industrials' },
        { symbol: 'EMR', name: 'Emerson Electric', category: 'Industrials' },
        { symbol: 'ETN', name: 'Eaton Corp', category: 'Industrials' },
        { symbol: 'PH', name: 'Parker-Hannifin', category: 'Industrials' },
        { symbol: 'CMI', name: 'Cummins Inc', category: 'Industrials' },
        { symbol: 'ROK', name: 'Rockwell Automation', category: 'Industrials' },
        { symbol: 'PCAR', name: 'PACCAR Inc', category: 'Industrials' },
        { symbol: 'IR', name: 'Ingersoll Rand', category: 'Industrials' },
        { symbol: 'OTIS', name: 'Otis Worldwide', category: 'Industrials' },
        { symbol: 'CARR', name: 'Carrier Global', category: 'Industrials' },
        { symbol: 'JCI', name: 'Johnson Controls', category: 'Industrials' },
        { symbol: 'GWW', name: 'W.W. Grainger', category: 'Industrials' },
        { symbol: 'FAST', name: 'Fastenal Co', category: 'Industrials' },
        { symbol: 'VMC', name: 'Vulcan Materials', category: 'Industrials' },
        { symbol: 'MLM', name: 'Martin Marietta Materials', category: 'Industrials' },
        { symbol: 'GNRC', name: 'Generac Holdings', category: 'Industrials' },
        { symbol: 'ODFL', name: 'Old Dominion Freight Line', category: 'Industrials' },
        { symbol: 'JBHT', name: 'JB Hunt Transport Services', category: 'Industrials' },
        { symbol: 'WAB', name: 'Westinghouse Air Brake Technologies', category: 'Industrials' },
        { symbol: 'URI', name: 'United Rentals', category: 'Industrials' },
        { symbol: 'PWR', name: 'Quanta Services', category: 'Industrials' },
        { symbol: 'J', name: 'Jacobs Solutions', category: 'Industrials' },
        
        // Industrial - Conglomerate
        { symbol: 'GE', name: 'General Electric', category: 'Industrials' },
        { symbol: 'HON', name: 'Honeywell International', category: 'Industrials' },
        { symbol: 'MMM', name: '3M Co', category: 'Industrials' },
        
        // Transportation & Logistics
        { symbol: 'UPS', name: 'United Parcel Service', category: 'Industrials' },
        { symbol: 'FDX', name: 'FedEx Corp', category: 'Industrials' },
        { symbol: 'UBER', name: 'Uber Technologies', category: 'Industrials' },
        { symbol: 'LYFT', name: 'Lyft Inc', category: 'Industrials' },
        { symbol: 'CSX', name: 'CSX Corp', category: 'Industrials' },
        { symbol: 'UNP', name: 'Union Pacific', category: 'Industrials' },
        { symbol: 'NSC', name: 'Norfolk Southern', category: 'Industrials' },
        { symbol: 'JBHT', name: 'JB Hunt Transport', category: 'Industrials' },
        { symbol: 'CHRW', name: 'CH Robinson Worldwide', category: 'Industrials' },
        { symbol: 'EXPD', name: 'Expeditors International', category: 'Industrials' },
        { symbol: 'XPO', name: 'XPO Logistics', category: 'Industrials' },
        { symbol: 'R', name: 'Ryder System', category: 'Industrials' },
        
        // Airlines
        { symbol: 'DAL', name: 'Delta Air Lines', category: 'Industrials' },
        { symbol: 'UAL', name: 'United Airlines Holdings', category: 'Industrials' },
        { symbol: 'AAL', name: 'American Airlines Group', category: 'Industrials' },
        { symbol: 'LUV', name: 'Southwest Airlines', category: 'Industrials' },
        { symbol: 'ALK', name: 'Alaska Air Group', category: 'Industrials' },
        { symbol: 'JBLU', name: 'JetBlue Airways', category: 'Industrials' },
        { symbol: 'SAVE', name: 'Spirit Airlines', category: 'Industrials' },
        
        // Automotive
        { symbol: 'GM', name: 'General Motors Co', category: 'Consumer Discretionary' },
        { symbol: 'F', name: 'Ford Motor Co', category: 'Consumer Discretionary' },
        { symbol: 'RIVN', name: 'Rivian Automotive', category: 'Consumer Discretionary' },
        { symbol: 'LCID', name: 'Lucid Group', category: 'Consumer Discretionary' },
        { symbol: 'NIO', name: 'NIO Inc', category: 'Consumer Discretionary' },
        { symbol: 'XPEV', name: 'XPeng Inc', category: 'Consumer Discretionary' },
        { symbol: 'LI', name: 'Li Auto Inc', category: 'Consumer Discretionary' },
        
        // Telecom
        { symbol: 'T', name: 'AT&T Inc', category: 'Communication Services' },
        { symbol: 'VZ', name: 'Verizon Communications', category: 'Communication Services' },
        { symbol: 'TMUS', name: 'T-Mobile US', category: 'Communication Services' },
        { symbol: 'CMCSA', name: 'Comcast Corp', category: 'Communication Services' },
        { symbol: 'CHTR', name: 'Charter Communications', category: 'Communication Services' },
        
        // Travel & Leisure
        { symbol: 'ABNB', name: 'Airbnb Inc', category: 'Consumer Discretionary' },
        { symbol: 'BKNG', name: 'Booking Holdings', category: 'Consumer Discretionary' },
        { symbol: 'EXPE', name: 'Expedia Group', category: 'Consumer Discretionary' },
        { symbol: 'MAR', name: 'Marriott International', category: 'Consumer Discretionary' },
        { symbol: 'HLT', name: 'Hilton Worldwide Holdings', category: 'Consumer Discretionary' },
        { symbol: 'H', name: 'Hyatt Hotels', category: 'Consumer Discretionary' },
        { symbol: 'IHG', name: 'InterContinental Hotels', category: 'Consumer Discretionary' },
        { symbol: 'RCL', name: 'Royal Caribbean Cruises', category: 'Consumer Discretionary' },
        { symbol: 'CCL', name: 'Carnival Corp', category: 'Consumer Discretionary' },
        { symbol: 'NCLH', name: 'Norwegian Cruise Line', category: 'Consumer Discretionary' },
        { symbol: 'MGM', name: 'MGM Resorts International', category: 'Consumer Discretionary' },
        { symbol: 'WYNN', name: 'Wynn Resorts', category: 'Consumer Discretionary' },
        { symbol: 'LVS', name: 'Las Vegas Sands', category: 'Consumer Discretionary' },
        { symbol: 'CZR', name: 'Caesars Entertainment', category: 'Consumer Discretionary' },
        { symbol: 'PENN', name: 'Penn Entertainment', category: 'Consumer Discretionary' },
        
        // Real Estate - REITs
        { symbol: 'AMT', name: 'American Tower Corp', category: 'Real Estate' },
        { symbol: 'PLD', name: 'Prologis Inc', category: 'Real Estate' },
        { symbol: 'CCI', name: 'Crown Castle Inc', category: 'Real Estate' },
        { symbol: 'EQIX', name: 'Equinix Inc', category: 'Real Estate' },
        { symbol: 'PSA', name: 'Public Storage', category: 'Real Estate' },
        { symbol: 'SPG', name: 'Simon Property Group', category: 'Real Estate' },
        { symbol: 'O', name: 'Realty Income Corp', category: 'Real Estate' },
        { symbol: 'DLR', name: 'Digital Realty Trust', category: 'Real Estate' },
        { symbol: 'WELL', name: 'Welltower Inc', category: 'Real Estate' },
        { symbol: 'AVB', name: 'AvalonBay Communities', category: 'Real Estate' },
        { symbol: 'EQR', name: 'Equity Residential', category: 'Real Estate' },
        { symbol: 'VTR', name: 'Ventas Inc', category: 'Real Estate' },
        { symbol: 'ARE', name: 'Alexandria Real Estate', category: 'Real Estate' },
        { symbol: 'SBAC', name: 'SBA Communications', category: 'Real Estate' },
        { symbol: 'INVH', name: 'Invitation Homes', category: 'Real Estate' },
        { symbol: 'MAA', name: 'Mid-America Apartment', category: 'Real Estate' },
        { symbol: 'ESS', name: 'Essex Property Trust', category: 'Real Estate' },
        { symbol: 'KIM', name: 'Kimco Realty', category: 'Real Estate' },
        { symbol: 'REG', name: 'Regency Centers', category: 'Real Estate' },
        { symbol: 'BXP', name: 'Boston Properties', category: 'Real Estate' },
        { symbol: 'VNO', name: 'Vornado Realty Trust', category: 'Real Estate' },
        { symbol: 'SLG', name: 'SL Green Realty', category: 'Real Estate' },
        
        // Materials - Chemicals
        { symbol: 'LIN', name: 'Linde PLC', category: 'Materials' },
        { symbol: 'APD', name: 'Air Products & Chemicals', category: 'Materials' },
        { symbol: 'SHW', name: 'Sherwin-Williams', category: 'Materials' },
        { symbol: 'ECL', name: 'Ecolab Inc', category: 'Materials' },
        { symbol: 'DD', name: 'DuPont de Nemours', category: 'Materials' },
        { symbol: 'DOW', name: 'Dow Inc', category: 'Materials' },
        { symbol: 'PPG', name: 'PPG Industries', category: 'Materials' },
        { symbol: 'LYB', name: 'LyondellBasell Industries', category: 'Materials' },
        { symbol: 'CE', name: 'Celanese Corp', category: 'Materials' },
        { symbol: 'ALB', name: 'Albemarle Corp', category: 'Materials' },
        { symbol: 'EMN', name: 'Eastman Chemical', category: 'Materials' },
        { symbol: 'FMC', name: 'FMC Corp', category: 'Materials' },
        { symbol: 'IFF', name: 'International Flavors & Fragrances', category: 'Materials' },
        
        // Materials - Metals & Mining
        { symbol: 'NUE', name: 'Nucor Corp', category: 'Materials' },
        { symbol: 'FCX', name: 'Freeport-McMoRan', category: 'Materials' },
        { symbol: 'NEM', name: 'Newmont Corp', category: 'Materials' },
        { symbol: 'GOLD', name: 'Barrick Gold Corp', category: 'Materials' },
        { symbol: 'STLD', name: 'Steel Dynamics', category: 'Materials' },
        { symbol: 'RS', name: 'Reliance Steel & Aluminum', category: 'Materials' },
        { symbol: 'AA', name: 'Alcoa Corp', category: 'Materials' },
        { symbol: 'MP', name: 'MP Materials', category: 'Materials' },
        
        // Materials - Packaging & Containers
        { symbol: 'PKG', name: 'Packaging Corp of America', category: 'Materials' },
        { symbol: 'BALL', name: 'Ball Corp', category: 'Materials' },
        { symbol: 'AVY', name: 'Avery Dennison', category: 'Materials' },
        { symbol: 'SEE', name: 'Sealed Air', category: 'Materials' },
        { symbol: 'WRK', name: 'WestRock Co', category: 'Materials' },
        { symbol: 'IP', name: 'International Paper', category: 'Materials' },
        { symbol: 'CCK', name: 'Crown Holdings', category: 'Materials' },
        { symbol: 'AMCR', name: 'Amcor PLC', category: 'Materials' },
        { symbol: 'OLN', name: 'Olin Corp', category: 'Materials' },
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
    fetchSymbolList(); // Fetch stock symbols for Stock Search
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
