/* ============================================
   API Module
   Fetches data from Twelve Data, NSE, etc.
   ============================================ */

const API = {
  TWELVE_DATA_BASE: 'https://api.twelvedata.com',
  NSE_BASE: 'https://www.nseindia.com',

  // CORS proxies to try for NSE (browser-based)
  CORS_PROXIES: [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ],

  _getApiKey() {
    return Storage.getApiKey();
  },

  // ---------- Twelve Data Endpoints ----------

  /**
   * Fetch real-time quote for a symbol
   */
  async fetchQuote(symbol) {
    const apiKey = this._getApiKey();
    if (!apiKey) throw new Error('API key not set');

    const cached = Storage.getCached(`quote_${symbol}`);
    if (cached) return cached;

    const url = `${this.TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Quote fetch failed: ${res.status}`);
    const data = await res.json();

    if (data.code) throw new Error(data.message || 'API Error');
    Storage.setCache(`quote_${symbol}`, data, 3); // cache 3 min
    return data;
  },

  /**
   * Fetch multiple quotes in batch (saves API calls)
   */
  async fetchBatchQuotes(symbols) {
    const apiKey = this._getApiKey();
    if (!apiKey) throw new Error('API key not set');

    const cacheKey = `batch_${symbols.join(',')}`;
    const cached = Storage.getCached(cacheKey);
    if (cached) return cached;

    const url = `${this.TWELVE_DATA_BASE}/quote?symbol=${symbols.join(',')}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Batch quote failed: ${res.status}`);
    const data = await res.json();

    if (data.code) throw new Error(data.message || 'API Error');
    Storage.setCache(cacheKey, data, 3);
    return data;
  },

  /**
   * Fetch exchange rate
   */
  async fetchExchangeRate(from, to) {
    const apiKey = this._getApiKey();
    if (!apiKey) throw new Error('API key not set');

    const cacheKey = `fx_${from}_${to}`;
    const cached = Storage.getCached(cacheKey);
    if (cached) return cached;

    const url = `${this.TWELVE_DATA_BASE}/exchange_rate?symbol=${from}/${to}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
    const data = await res.json();
    if (data.code) throw new Error(data.message || 'API Error');
    Storage.setCache(cacheKey, data, 5);
    return data;
  },

  /**
   * Fetch EMA for a symbol
   */
  async fetchEMA(symbol, period, interval = '1day') {
    const apiKey = this._getApiKey();
    if (!apiKey) throw new Error('API key not set');

    const cacheKey = `ema_${symbol}_${period}_${interval}`;
    const cached = Storage.getCached(cacheKey);
    if (cached) return cached;

    const url = `${this.TWELVE_DATA_BASE}/ema?symbol=${encodeURIComponent(symbol)}&interval=${interval}&time_period=${period}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EMA fetch failed: ${res.status}`);
    const data = await res.json();
    if (data.code) throw new Error(data.message || 'API Error');
    Storage.setCache(cacheKey, data, 10);
    return data;
  },

  /**
   * Fetch price (real-time)
   */
  async fetchPrice(symbol) {
    const apiKey = this._getApiKey();
    if (!apiKey) throw new Error('API key not set');

    const cacheKey = `price_${symbol}`;
    const cached = Storage.getCached(cacheKey);
    if (cached) return cached;

    const url = `${this.TWELVE_DATA_BASE}/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Price fetch failed: ${res.status}`);
    const data = await res.json();
    if (data.code) throw new Error(data.message || 'API Error');
    Storage.setCache(cacheKey, data, 2);
    return data;
  },

  // ---------- Aggregated Fetches ----------

  /**
   * Fetch from Yahoo Finance via CORS proxy
   */
  async fetchYahooFinance(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    for (const proxy of this.CORS_PROXIES) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url);
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.chart && data.chart.result && data.chart.result[0]) {
            const meta = data.chart.result[0].meta;
            return {
              price: meta.regularMarketPrice,
              previousClose: meta.chartPreviousClose,
              change: meta.regularMarketPrice - meta.chartPreviousClose,
              percent_change: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
              symbol: symbol
            };
          }
        }
      } catch(e) {
        continue;
      }
    }
    throw new Error(`Failed to fetch Yahoo Finance data for ${symbol}`);
  },

  /**
   * Fetch all global market data using Yahoo Finance (No API Key Required)
   * Returns: { sp500, nasdaq, dow, nikkei, hangSeng, giftNifty, crude, usdInr }
   */
  async fetchGlobalMarkets() {
    const cached = Storage.getCached('global_markets');
    if (cached) return cached;

    const results = {};
    const errors = [];

    // US Markets
    try { results.sp500 = await this.fetchYahooFinance('^GSPC'); } catch(e) { errors.push('S&P: ' + e.message); }
    try { results.nasdaq = await this.fetchYahooFinance('^IXIC'); } catch(e) { errors.push('NASDAQ: ' + e.message); }
    try { results.dow = await this.fetchYahooFinance('^DJI'); } catch(e) { errors.push('DOW: ' + e.message); }

    // Asian Markets
    try { results.nikkei = await this.fetchYahooFinance('^N225'); } catch(e) { errors.push('Nikkei: ' + e.message); }
    try { results.hangSeng = await this.fetchYahooFinance('^HSI'); } catch(e) { errors.push('Hang Seng: ' + e.message); }
    try { results.giftNifty = await this.fetchYahooFinance('^NSEI'); } catch(e) { errors.push('Gift Nifty: ' + e.message); }

    // Commodities & Forex
    try { results.crude = await this.fetchYahooFinance('CL=F'); } catch(e) { errors.push('Crude: ' + e.message); }
    try { results.usdInr = await this.fetchYahooFinance('INR=X'); } catch(e) { errors.push('USD/INR: ' + e.message); }

    results.errors = errors;
    results.fetchedAt = new Date().toISOString();
    Storage.setCache('global_markets', results, 3);
    return results;
  },

  /**
   * Fetch NIFTY technical data (price + EMAs)
   */
  async fetchNiftyTechnicals() {
    const cached = Storage.getCached('nifty_technicals');
    if (cached) return cached;

    const results = {};
    const errors = [];

    // NIFTY 50 price
    try {
      results.nifty = await this.fetchYahooFinance('^NSEI');
    } catch(e) {
      errors.push('NIFTY: ' + e.message);
    }

    // Bank NIFTY
    await this._delay(300);
    try {
      results.bankNifty = await this.fetchYahooFinance('^NSEBANK');
    } catch(e) {
      errors.push('Bank NIFTY: ' + e.message);
    }

    // EMAs (20, 50, 200) locally calculated from Yahoo Finance historical data
    await this._delay(300);
    try {
      const histUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?interval=1d&range=1y';
      let histData = null;
      for (const proxy of this.CORS_PROXIES) {
        try {
          const res = await fetch(proxy + encodeURIComponent(histUrl));
          if (res.ok) {
            const json = await res.json();
            if (json.chart && json.chart.result && json.chart.result[0]) {
              histData = json.chart.result[0].indicators.quote[0].close;
              // Filter out nulls
              histData = histData.filter(v => v !== null);
              break;
            }
          }
        } catch (e) {}
      }

      if (histData && histData.length >= 200) {
        const calcEMA = (prices, period) => {
          const k = 2 / (period + 1);
          let ema = prices[0];
          for (let i = 1; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
          }
          return ema;
        };
        
        results.ema20 = calcEMA(histData, 20);
        results.ema50 = calcEMA(histData, 50);
        results.ema200 = calcEMA(histData, 200);
      }
    } catch(e) { 
      errors.push('EMAs: ' + e.message); 
    }

    results.errors = errors;
    results.fetchedAt = new Date().toISOString();
    Storage.setCache('nifty_technicals', results, 5);
    return results;
  },

  /**
   * Try to fetch NSE data via CORS proxy
   * Falls back gracefully if blocked
   */
  async fetchNSE(endpoint) {
    const url = `${this.NSE_BASE}${endpoint}`;

    for (const proxy of this.CORS_PROXIES) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url);
        const res = await fetch(proxyUrl, {
          headers: {
            'Accept': 'application/json',
          }
        });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      } catch(e) {
        continue; // Try next proxy
      }
    }

    // Direct attempt (may fail due to CORS)
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) return await res.json();
    } catch(e) { /* expected to fail */ }

    return null; // All attempts failed
  },

  /**
   * Try to fetch FII/DII data from NSE
   */
  async fetchFIIDII() {
    const cached = Storage.getCached('fii_dii');
    if (cached) return cached;

    const data = await this.fetchNSE('/api/fiidiiTradeReact');
    if (data) {
      Storage.setCache('fii_dii', data, 30);
    }
    return data;
  },

  /**
   * Try to fetch Option Chain from NSE
   */
  async fetchOptionChain(symbol = 'NIFTY') {
    const cached = Storage.getCached(`oc_${symbol}`);
    if (cached) return cached;

    const data = await this.fetchNSE(`/api/option-chain-indices?symbol=${symbol}`);
    if (data) {
      Storage.setCache(`oc_${symbol}`, data, 5);
    }
    return data;
  },

  /**
   * Try to fetch India VIX
   */
  async fetchIndiaVIX() {
    const cached = Storage.getCached('india_vix');
    if (cached) return cached;

    const data = await this.fetchNSE('/api/allIndices');
    if (data) {
      const vixData = data.data?.find(d => d.indexSymbol === 'INDIA VIX' || d.index === 'INDIA VIX');
      if (vixData) {
        Storage.setCache('india_vix', vixData, 5);
        return vixData;
      }
    }
    return null;
  },

  /**
   * Parse option chain data for analysis
   */
  parseOptionChain(data) {
    if (!data?.records?.data) return null;

    const records = data.records.data;
    let maxCallOI = 0, maxCallStrike = 0;
    let maxPutOI = 0, maxPutStrike = 0;
    let totalCallOI = 0, totalPutOI = 0;

    records.forEach(record => {
      if (record.CE) {
        totalCallOI += record.CE.openInterest || 0;
        if ((record.CE.openInterest || 0) > maxCallOI) {
          maxCallOI = record.CE.openInterest;
          maxCallStrike = record.strikePrice;
        }
      }
      if (record.PE) {
        totalPutOI += record.PE.openInterest || 0;
        if ((record.PE.openInterest || 0) > maxPutOI) {
          maxPutOI = record.PE.openInterest;
          maxPutStrike = record.strikePrice;
        }
      }
    });

    const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI) : 0;

    return {
      highestCallOI: maxCallStrike,
      highestCallOIValue: maxCallOI,
      highestPutOI: maxPutStrike,
      highestPutOIValue: maxPutOI,
      totalCallOI,
      totalPutOI,
      pcr: Math.round(pcr * 100) / 100,
      spotPrice: data.records?.underlyingValue,
      timestamp: data.records?.timestamp
    };
  },

  // ---------- Helpers ----------
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Format number with commas (Indian format)
   */
  formatIndian(num) {
    if (num == null || isNaN(num)) return '—';
    const n = Number(num);
    const abs = Math.abs(n);
    if (abs >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
    if (abs >= 100000) return (n / 100000).toFixed(2) + ' L';
    return n.toLocaleString('en-IN');
  },

  /**
   * Format percentage
   */
  formatPercent(num) {
    if (num == null || isNaN(num)) return '—';
    const n = Number(num);
    const prefix = n > 0 ? '+' : '';
    return prefix + n.toFixed(2) + '%';
  },

  /**
   * Parse change from quote data
   */
  parseChange(quoteData) {
    if (!quoteData) return { price: null, change: null, changePercent: null };
    return {
      price: parseFloat(quoteData.close || quoteData.price || quoteData.rate || 0),
      change: parseFloat(quoteData.change || 0),
      changePercent: parseFloat(quoteData.percent_change || 0),
      name: quoteData.name || quoteData.symbol || '',
      previousClose: parseFloat(quoteData.previous_close || quoteData.previousClose || 0)
    };
  }
};
