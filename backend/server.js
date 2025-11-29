const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3001;

// Enable CORS so React Native app can call this API
app.use(cors());

// Cache for trades data (refresh once per calendar day)
let cachedTrades = null;
let lastFetchDate = null; // Store the date of last fetch

app.get('/api/trades', async (req, res) => {
  try {
    console.log('Received request for trades data');
    
    // Get current date (YYYY-MM-DD format)
    const today = new Date().toISOString().split('T')[0];
    
    // Return cached data if we already fetched today
    if (cachedTrades && lastFetchDate === today) {
      console.log(`Returning cached data from ${lastFetchDate}`);
      return res.json(cachedTrades);
    }
    
    console.log(`Fetching fresh data for ${today}...`);
    
    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    let allTrades = [];
    
    // First, navigate to page 1 to determine total number of pages
    console.log('Fetching page 1 to determine total pages...');
    await page.goto('https://www.capitoltrades.com/trades?pageSize=100&page=1&txDate=30d', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
    
    // Detect total number of pages from pagination
    const totalPages = await page.evaluate(() => {
      // Look for pagination elements - common patterns:
      // 1. Page numbers in pagination buttons
      const pageButtons = Array.from(document.querySelectorAll('a[href*="page="], button[aria-label*="page"]'));
      let maxPage = 1;
      
      pageButtons.forEach(button => {
        const text = button.textContent?.trim() || '';
        const href = button.getAttribute('href') || '';
        
        // Extract page number from text
        const pageNumFromText = parseInt(text);
        if (!isNaN(pageNumFromText) && pageNumFromText > maxPage) {
          maxPage = pageNumFromText;
        }
        
        // Extract page number from href (e.g., "page=5")
        const match = href.match(/page=(\d+)/);
        if (match) {
          const pageNum = parseInt(match[1]);
          if (pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
      });
      
      // Also check for "Last" or "Next" buttons that might have the total
      const lastButton = document.querySelector('[aria-label*="last" i], [title*="last" i]');
      if (lastButton) {
        const href = lastButton.getAttribute('href') || '';
        const match = href.match(/page=(\d+)/);
        if (match) {
          const pageNum = parseInt(match[1]);
          if (pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
      }
      
      return maxPage;
    });
    
    console.log(`Detected ${totalPages} total pages. Fetching all pages...`);
    
    // Fetch all pages
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      console.log(`Fetching page ${pageNum} of ${totalPages}...`);
      
      // Only navigate if not already on page 1
      if (pageNum > 1) {
        await page.goto(`https://www.capitoltrades.com/trades?pageSize=100&page=${pageNum}&txDate=30d`, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        
        await page.waitForSelector('table tbody tr', { timeout: 30000 });
      }
      
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
          
          // Find TRANSACTION date (not reported/published date)
          // CapitolTrades typically shows: Published date (with time), Reported date, and Traded date
          // We want the TRADED date, which should be the LAST date in "DD MMM YYYY" format without a time
          let transactionDate = 'N/A';
          let datesFound = [];
          
          // Collect ALL dates in "DD MMM YYYY" format from the row, excluding published dates with times
          for (let cell of cells) {
            const text = cell.textContent?.trim() || '';
            
            // Skip if this looks like a published date (has time like "17:30" or words like "Yesterday")
            if (text.match(/\d{1,2}:\d{2}/) || text.toLowerCase().includes('yesterday') || 
                text.toLowerCase().includes('today') || text.toLowerCase().includes('ago')) {
              continue;
            }
            
            // Look for "DD MMM YYYY" format (e.g., "30 Oct 2025")
            const dateMatch = text.match(/\b(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})\b/);
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
                const formattedDate = `${month}/${day.padStart(2, '0')}/${year}`;
                datesFound.push(formattedDate);
              }
            }
            
            // Also check for MM/DD/YYYY format
            const slashDateMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
            if (slashDateMatch) {
              datesFound.push(slashDateMatch[1]);
            }
          }
          
          // Take the LAST date found (transaction date), not the first (reported date)
          // If there are multiple dates, the last one is typically the actual transaction date
          if (datesFound.length > 0) {
            transactionDate = datesFound[datesFound.length - 1];
          }
          
          // Fallback to .tx-date selector if no dates found
          if (transactionDate === 'N/A') {
            const txDateEl = row.querySelector('.tx-date');
            if (txDateEl) {
              const text = txDateEl.textContent?.trim() || '';
              const dateMatch = text.match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);
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
          
          // Find person (Spouse, Self, Child, etc.)
          let person = '';
          for (let cell of cells) {
            const text = cell.textContent?.trim() || '';
            // Look for common person indicators
            if (text.match(/^(Spouse|Self|Child|Joint|Dependent)$/i)) {
              person = text;
              break;
            }
          }
          
          // Skip if no ticker (header rows, etc.)
          if (!ticker || ticker === '--' || ticker.toUpperCase() === 'N/A') {
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
          
          // Skip if cleanTicker ends up being N/A or empty after cleaning
          if (!cleanTicker || cleanTicker.toUpperCase() === 'N/A') {
            return null;
          }
          
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
            person: person,
            chamber: chamber || 'Congress'
          };
        } catch (error) {
          return null;
        }
      }).filter(trade => trade !== null);
      
      return { trades, debug: debugInfo };
    });
      
      console.log(`Page ${pageNum}: Scraped ${tradesData.length} trades`);
      allTrades = allTrades.concat(tradesData);
    }
    
    await browser.close();
    
    console.log(`Successfully scraped ${allTrades.length} total trades from all pages`);
    
    // Get unique politicians
    const uniquePoliticians = new Set(allTrades.map(t => t.representative));
    console.log(`Found ${uniquePoliticians.size} unique politicians`);
    
    // Debug: Log a sample trade to see what we're getting
    if (allTrades.length > 0) {
      console.log('Sample trade:', JSON.stringify(allTrades[0], null, 2));
    }
    
    // Cache the results with today's date
    cachedTrades = allTrades;
    lastFetchDate = today;
    
    res.json(allTrades);
    
  } catch (error) {
    console.error('Error scraping trades:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trades',
      message: error.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', lastFetchDate: lastFetchDate });
});

// Cache for insider trades data
let cachedInsiderTrades = null;
let lastInsiderFetchDate = null;

app.get('/api/insider-trades', async (req, res) => {
  try {
    console.log('Received request for insider trades data');
    
    const today = new Date().toISOString().split('T')[0];
    
    if (cachedInsiderTrades && lastInsiderFetchDate === today) {
      console.log(`Returning cached insider trades from ${lastInsiderFetchDate}`);
      return res.json(cachedInsiderTrades);
    }
    
    console.log(`Fetching fresh insider trades for ${today}...`);
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Navigate to OpenInsider.com - screener with 30 day trade date filter and 1000 results
    await page.goto('http://openinsider.com/screener?s=&o=&pl=&ph=&ll=&lh=&fd=30&fdr=&td=30&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&xs=1&vl=&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=1&cnt=1000&page=1', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    // Wait for the table to load
    await page.waitForSelector('table.tinytable tbody tr', { timeout: 30000 });
    
    // Extract insider trades from the table
    const trades = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table.tinytable tbody tr'));
      const results = [];
      rows.forEach((row, index) => {
        try {
          const cells = row.querySelectorAll('td');
          if (cells.length < 10) return;
          const ticker = cells[3]?.textContent?.trim() || '';
          const companyName = cells[4]?.textContent?.trim() || '';
          const insiderName = cells[5]?.textContent?.trim() || '';
          const insiderTitle = cells[6]?.textContent?.trim() || '';
          const tradeType = cells[7]?.textContent?.trim() || '';
          const price = cells[8]?.textContent?.trim() || '';
          const shares = cells[9]?.textContent?.trim() || '';
          const owned = cells[10]?.textContent?.trim() || '';
          const value = cells[12]?.textContent?.trim() || '';
          const tradeDate = cells[2]?.textContent?.trim() || '';
          if (ticker && companyName && insiderName) {
            let transactionType = 'Trade';
            const tradeTypeLower = tradeType.toLowerCase();
            if (tradeTypeLower.includes('purchase') || 
                tradeTypeLower.includes('buy') ||
                tradeTypeLower.includes('p - purchase') ||
                tradeTypeLower === 'p') {
              transactionType = 'Purchase';
            } else if (tradeTypeLower.includes('sale') || 
                       tradeTypeLower.includes('sell') ||
                       tradeTypeLower.includes('s - sale') ||
                       tradeTypeLower === 's') {
              transactionType = 'Sale';
            }
            if (index < 3) {
              console.log(`Trade ${index}: type="${tradeType}" -> ${transactionType}`);
            }
            results.push({
              id: `insider-${ticker}-${index}`,
              ticker,
              companyName,
              insiderName,
              insiderTitle,
              transactionType,
              transactionDate: tradeDate,
              sharesTraded: shares,
              pricePerShare: price,
              value,
              sharesOwned: owned
            });
          }
        } catch (error) {
          console.error('Error parsing insider trade row:', error);
        }
      });
      return results;
    });

    await browser.close();

    // Filter to last 30 calendar days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); // inclusive of today
    const filteredTrades = trades.filter(trade => {
      if (!trade.transactionDate) return false;
      // Try to parse as MM/DD/YYYY or similar
      const d = new Date(trade.transactionDate);
      if (isNaN(d.getTime())) return false;
      return d >= thirtyDaysAgo && d <= now;
    });

    console.log(`Scraped ${trades.length} insider trades, ${filteredTrades.length} in last 30 days`);

    cachedInsiderTrades = filteredTrades;
    lastInsiderFetchDate = today;
    res.json(filteredTrades);
  } catch (error) {
    console.error('Error scraping insider trades:', error);
    res.status(500).json({ 
      error: 'Failed to fetch insider trades',
      message: error.message 
    });
  }
});

app.get('/api/clear-cache', (req, res) => {
  cachedTrades = null;
  lastFetchDate = null;
  cachedInsiderTrades = null;
  lastInsiderFetchDate = null;
  console.log('Cache cleared');
  res.json({ status: 'Cache cleared successfully' });
});

app.listen(PORT, () => {
  console.log(`Congress Trades API running on http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/api/trades`);
  console.log(`Try: http://localhost:${PORT}/api/insider-trades`);
  console.log(`Clear cache: http://localhost:${PORT}/api/clear-cache`);
});
