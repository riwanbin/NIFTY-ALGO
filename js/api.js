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
   * Fetch all global market data in optimized batches
   * Returns: { sp500, nasdaq, dow, nikkei, hangSeng, kospi, crude, usdInr }
   */
  async fetchGlobalMarkets() {
    const apiKey = this._getApiKey();
    if (!apiKey) throw new Error('API key not set. Go to Settings to configure.');

    const cached = Storage.getCached('global_markets');
    if (cached) return cached;

    const results = {};
    const errors = [];

    // Batch 1: US Markets (Using ETFs for free tier compatibility)
    try {
      const usData = await this.fetchBatchQuotes(['SPY', 'QQQ', 'DIA']);
      if (usData && !usData.code) {
        results.sp500 = usData.SPY || usData['SPY'];
        results.nasdaq = usData.QQQ || usData['QQQ'];
        results.dow = usData.DIA || usData['DIA'];
      }
    } catch (e) {
      errors.push('US Markets: ' + e.message);
      // Try individually
      try { results.sp500 = await this.fetchQuote('SPY'); } catch(e2) { errors.push('S&P: ' + e2.message); }
      try { results.nasdaq = await this.fetchQuote('QQQ'); } catch(e2) { errors.push('NASDAQ: ' + e2.message); }
      try { results.dow = await this.fetchQuote('DIA'); } catch(e2) { errors.push('DOW: ' + e2.message); }
    }

    // Batch 2: Asian Markets (sequential to respect rate limits)
    await this._delay(300);
    try { results.nikkei = await this.fetchQuote('EWJ'); } catch(e) { errors.push('Nikkei: ' + e.message); }
    await this._delay(300);
    try { results.hangSeng = await this.fetchQuote('EWH'); } catch(e) { errors.push('Hang Seng: ' + e.message); }

    // Batch 3: Commodities & Forex
    await this._delay(300);
    try { results.crude = await this.fetchQuote('CL'); } catch(e) { errors.push('Crude: ' + e.message); }
    await this._delay(300);
    try { results.usdInr = await this.fetchExchangeRate('USD', 'INR'); } catch(e) { errors.push('USD/INR: ' + e.message); }

    results.errors = errors;
    results.fetchedAt = new Date().toISOString();
    Storage.setCache('global_markets', results, 3);
    return results;
  },

  /**
   * Fetch NIFTY technical data (price + EMAs)
   */
  async fetchNiftyTechnicals() {
    const apiKey = this._getApiKey();
    if (!apiKey) throw new Error('API key not set');

    const cached = Storage.getCached('nifty_technicals');
    if (cached) return cached;

    const results = {};
    const errors = [];

    // NIFTY 50 price
    try {
      results.nifty = await this.fetchQuote('NIFTY 50');
    } catch(e) {
      try { results.nifty = await this.fetchQuote('NSEI'); } catch(e2) { errors.push('NIFTY: ' + e2.message); }
    }

    // Bank NIFTY
    await this._delay(300);
    try {
      results.bankNifty = await this.fetchQuote('NIFTY BANK');
    } catch(e) {
      try { results.bankNifty = await this.fetchQuote('NSEBANK'); } catch(e2) { errors.push('Bank NIFTY: ' + e2.message); }
    }

    // EMAs (20, 50, 200)
    const niftySymbol = 'NSEI';
    await this._delay(300);
    try {
      const ema20Data = await this.fetchEMA(niftySymbol, 20);
      results.ema20 = ema20Data?.values?.[0]?.ema ? parseFloat(ema20Data.values[0].ema) : null;
    } catch(e) { errors.push('EMA20: ' + e.message); }

    await this._delay(300);
    try {
      const ema50Data = await this.fetchEMA(niftySymbol, 50);
      results.ema50 = ema50Data?.values?.[0]?.ema ? parseFloat(ema50Data.values[0].ema) : null;
    } catch(e) { errors.push('EMA50: ' + e.message); }

    await this._delay(300);
    try {
      const ema200Data = await this.fetchEMA(niftySymbol, 200);
      results.ema200 = ema200Data?.values?.[0]?.ema ? parseFloat(ema200Data.values[0].ema) : null;
    } catch(e) { errors.push('EMA200: ' + e.message); }

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
      previousClose: parseFloat(quoteData.previous_close || 0)
    };
  }
};
