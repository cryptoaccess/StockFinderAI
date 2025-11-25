# Congress Trades API Backend

This is a simple Node.js backend that scrapes congressional trading data from CapitolTrades.com using Puppeteer (headless Chrome).

## Setup

1. Install dependencies:
   ```
   cd backend
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```

3. The API will be available at `http://localhost:3001`

## Endpoints

- `GET /api/trades` - Returns congressional trades data (last 30 days)
- `GET /api/health` - Health check endpoint

## How it works

The server uses Puppeteer to:
1. Launch a headless Chrome browser
2. Navigate to CapitolTrades.com
3. Wait for the page to fully load (JavaScript rendered)
4. Extract trade data using CSS selectors
5. Return JSON data to your React Native app

## Caching

Results are cached for 30 minutes to avoid excessive scraping.
