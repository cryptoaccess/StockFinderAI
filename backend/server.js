const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3001;

// Enable CORS so React Native app can call this API
app.use(cors());

// Cache for trades data (refresh every 30 minutes)
let cachedTrades = null;
let lastFetch = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

app.get('/api/trades', async (req, res) => {
  try {
    console.log('Received request for trades data');
    
    // Return cached data if still fresh
    if (cachedTrades && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
      console.log('Returning cached data');
      return res.json(cachedTrades);
    }
    
    console.log('Fetching fresh data from CapitolTrades.com...');
    
    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Navigate to CapitolTrades.com
    await page.goto('https://www.capitoltrades.com/trades?pageSize=250&page=1&txDate=30d', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
    
    // Extract trade data using the CSS selectors from Power Query
    const { trades: tradesData, debug } = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.hover\\:bg-neutral-100\\/50'));
      let debugInfo = '';
      
      const trades = rows.map((row, index) => {
        try {
          // Use exact Power Query CSS selectors
          const politicianName = row.querySelector('.politician-name')?.textContent?.trim() || '';
          const state = row.querySelector('.us-state-compact')?.textContent?.trim() || '';
          const ticker = row.querySelector('.issuer-ticker')?.textContent?.trim() || '';
          const companyName = row.querySelector('.issuer-name')?.textContent?.trim() || '';
          const party = row.querySelector('.party')?.textContent?.trim() || '';
          const chamber = row.querySelector('.chamber')?.textContent?.trim() || '';
          
          // Get all cells to debug
          const cells = Array.from(row.querySelectorAll('td'));
          
          // Debug first row
          if (index === 0) {
            const cellTexts = cells.map((cell, i) => `[${i}]: ${cell.textContent?.trim()}`);
            debugInfo = cellTexts.join(' | ');
          }
          
          // Find transaction date - look for date format in cells
          let transactionDate = 'N/A';
          for (let cell of cells) {
            const text = cell.textContent?.trim() || '';
            // Match various date formats
            // MM/DD/YYYY format
            let dateMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
            if (dateMatch) {
              transactionDate = dateMatch[1];
              break;
            }
            // "21 Nov2025" format - convert to MM/DD/YYYY
            dateMatch = text.match(/(\d{1,2})\s*([A-Za-z]{3})(\d{4})/);
            if (dateMatch) {
              const day = dateMatch[1];
              const monthStr = dateMatch[2];
              const year = dateMatch[3];
              const months = {
                'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
              };
              const month = months[monthStr];
              if (month) {
                transactionDate = `${month}/${day.padStart(2, '0')}/${year}`;
                break;
              }
            }
          }
          
          // If still no date, try looking in specific date-related selectors
          if (transactionDate === 'N/A') {
            const dateSelectors = ['.tx-date', '.text-size-3', 'time'];
            for (let selector of dateSelectors) {
              const dateEl = row.querySelector(selector);
              if (dateEl) {
                const text = dateEl.textContent?.trim() || '';
                const dateMatch = text.match(/(\d{1,2})\s*([A-Za-z]{3})(\d{4})/);
                if (dateMatch) {
                  const day = dateMatch[1];
                  const monthStr = dateMatch[2];
                  const year = dateMatch[3];
                  const months = {
                    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                  };
                  const month = months[monthStr];
                  if (month) {
                    transactionDate = `${month}/${day.padStart(2, '0')}/${year}`;
                    break;
                  }
                }
              }
            }
          }
          
          // Find transaction type - look for text indicators
          let transactionType = 'Unknown';
          for (let cell of cells) {
            const text = cell.textContent?.trim().toLowerCase() || '';
            if (text === 'purchased' || text === 'purchase' || text === 'buy') {
              transactionType = 'Purchase';
              break;
            } else if (text === 'sold' || text === 'sale' || text === 'sell') {
              transactionType = 'Sale';
              break;
            }
          }
          
          // Find amount - look for dollar range or K format
          let amount = 'Unknown';
          for (let cell of cells) {
            const text = cell.textContent?.trim() || '';
            // Match $X - $Y format
            let amountMatch = text.match(/\$[\d,]+\s*-\s*\$[\d,]+/);
            if (amountMatch) {
              amount = amountMatch[0];
              break;
            }
            // Match 15K–50K format
            amountMatch = text.match(/(\d+)K\s*[–-]\s*(\d+)K/);
            if (amountMatch) {
              amount = `$${amountMatch[1]},000 - $${amountMatch[2]},000`;
              break;
            }
          }
          
          // Skip if no ticker (header rows, etc.)
          if (!ticker || ticker === '--') {
            return null;
          }
          
          // Filter out Treasury bills and bonds
          const lowerCompany = companyName.toLowerCase();
          const lowerTicker = ticker.toLowerCase();
          if (lowerCompany.includes('treasury') || lowerCompany.includes('t-bill') || 
              lowerTicker.includes('treasury') || ticker.startsWith('T-')) {
            return null;
          }
          
          // Remove :US suffix from tickers
          const cleanTicker = ticker.replace(':US', '').replace(':CA', '').trim();
          
          return {
            id: `${politicianName}-${cleanTicker}-${index}`,
            representative: politicianName,
            party: party.charAt(0).toUpperCase(),
            state: state,
            ticker: cleanTicker,
            assetDescription: companyName || cleanTicker,
            transactionType: transactionType,
            transactionDate: transactionDate,
            amount: amount,
            chamber: chamber || 'Congress'
          };
        } catch (error) {
          return null;
        }
      }).filter(trade => trade !== null);
      
      return { trades, debug: debugInfo };
    });
    
    await browser.close();
    
    console.log(`Successfully scraped ${tradesData.length} trades`);
    console.log('First row cells:', debug);
    
    // Debug: Log a sample trade to see what we're getting
    if (tradesData.length > 0) {
      console.log('Sample trade:', JSON.stringify(tradesData[0], null, 2));
    }
    
    // Cache the results
    cachedTrades = tradesData;
    lastFetch = Date.now();
    
    res.json(tradesData);
    
  } catch (error) {
    console.error('Error scraping trades:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trades',
      message: error.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', lastFetch: lastFetch });
});

app.listen(PORT, () => {
  console.log(`Congress Trades API running on http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/api/trades`);
});
