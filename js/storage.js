/* ============================================
   Storage Module
   localStorage persistence for all app data
   ============================================ */

const Storage = {
  // ---------- API Key ----------
  getApiKey() {
    return localStorage.getItem('nifty_api_key') || '';
  },

  setApiKey(key) {
    localStorage.setItem('nifty_api_key', key.trim());
  },

  getApiProvider() {
    return localStorage.getItem('nifty_api_provider') || 'twelvedata';
  },

  setApiProvider(provider) {
    localStorage.setItem('nifty_api_provider', provider);
  },

  // ---------- Daily Analysis History ----------
  getDailyAnalysis() {
    try {
      return JSON.parse(localStorage.getItem('nifty_daily_analysis') || '[]');
    } catch { return []; }
  },

  saveDailyEntry(entry) {
    const history = this.getDailyAnalysis();
    const todayStr = new Date().toISOString().split('T')[0];
    const existingIdx = history.findIndex(h => h.date === todayStr);
    entry.date = todayStr;
    entry.timestamp = new Date().toISOString();

    if (existingIdx >= 0) {
      history[existingIdx] = { ...history[existingIdx], ...entry };
    } else {
      history.unshift(entry);
    }
    // Keep last 1500 entries max
    if (history.length > 1500) history.length = 1500;
    localStorage.setItem('nifty_daily_analysis', JSON.stringify(history));
    return entry;
  },

  getTodaysAnalysis() {
    const todayStr = new Date().toISOString().split('T')[0];
    const history = this.getDailyAnalysis();
    return history.find(h => h.date === todayStr) || null;
  },

  // ---------- Trade Journal ----------
  getTrades() {
    try {
      return JSON.parse(localStorage.getItem('nifty_trades') || '[]');
    } catch { return []; }
  },

  saveTrade(trade) {
    const trades = this.getTrades();
    if (trade.id) {
      const idx = trades.findIndex(t => t.id === trade.id);
      if (idx >= 0) {
        trades[idx] = { ...trades[idx], ...trade };
      } else {
        trades.push(trade);
      }
    } else {
      trade.id = 'T' + Date.now() + Math.random().toString(36).substr(2, 4);
      trade.createdAt = new Date().toISOString();
      trades.push(trade);
    }
    localStorage.setItem('nifty_trades', JSON.stringify(trades));
    return trade;
  },

  deleteTrade(id) {
    let trades = this.getTrades();
    trades = trades.filter(t => t.id !== id);
    localStorage.setItem('nifty_trades', JSON.stringify(trades));
  },

  // ---------- Global Market Log ----------
  getGlobalMarketLog() {
    try {
      return JSON.parse(localStorage.getItem('nifty_global_log') || '[]');
    } catch { return []; }
  },

  saveGlobalMarketEntry(entry) {
    const log = this.getGlobalMarketLog();
    const todayStr = new Date().toISOString().split('T')[0];
    entry.date = todayStr;
    const existingIdx = log.findIndex(l => l.date === todayStr);
    if (existingIdx >= 0) {
      log[existingIdx] = { ...log[existingIdx], ...entry };
    } else {
      log.unshift(entry);
    }
    if (log.length > 500) log.length = 500;
    localStorage.setItem('nifty_global_log', JSON.stringify(log));
    return entry;
  },

  // ---------- Trading Plan ----------
  getTodaysPlan() {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const plans = JSON.parse(localStorage.getItem('nifty_plans') || '{}');
      return plans[todayStr] || null;
    } catch { return null; }
  },

  saveTradingPlan(plan) {
    const todayStr = new Date().toISOString().split('T')[0];
    let plans;
    try {
      plans = JSON.parse(localStorage.getItem('nifty_plans') || '{}');
    } catch { plans = {}; }
    plans[todayStr] = { ...plan, date: todayStr, updatedAt: new Date().toISOString() };
    // Keep last 365 days
    const keys = Object.keys(plans).sort().reverse();
    if (keys.length > 365) {
      keys.slice(365).forEach(k => delete plans[k]);
    }
    localStorage.setItem('nifty_plans', JSON.stringify(plans));
    return plans[todayStr];
  },

  // ---------- Checklist State ----------
  getChecklist() {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const data = JSON.parse(localStorage.getItem('nifty_checklist') || '{}');
      return data[todayStr] || {};
    } catch { return {}; }
  },

  saveChecklistItem(id, checked) {
    const todayStr = new Date().toISOString().split('T')[0];
    let data;
    try {
      data = JSON.parse(localStorage.getItem('nifty_checklist') || '{}');
    } catch { data = {}; }
    if (!data[todayStr]) data[todayStr] = {};
    data[todayStr][id] = { checked, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
    // Keep last 30 days
    const keys = Object.keys(data).sort().reverse();
    if (keys.length > 30) {
      keys.slice(30).forEach(k => delete data[k]);
    }
    localStorage.setItem('nifty_checklist', JSON.stringify(data));
  },

  // ---------- NSE Manual Data ----------
  getNSEManualData() {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const data = JSON.parse(localStorage.getItem('nifty_nse_manual') || '{}');
      return data[todayStr] || null;
    } catch { return null; }
  },

  saveNSEManualData(nseData) {
    const todayStr = new Date().toISOString().split('T')[0];
    let data;
    try {
      data = JSON.parse(localStorage.getItem('nifty_nse_manual') || '{}');
    } catch { data = {}; }
    data[todayStr] = { ...nseData, updatedAt: new Date().toISOString() };
    const keys = Object.keys(data).sort().reverse();
    if (keys.length > 60) keys.slice(60).forEach(k => delete data[k]);
    localStorage.setItem('nifty_nse_manual', JSON.stringify(data));
  },

  // ---------- Data Cache ----------
  getCached(key) {
    try {
      const raw = localStorage.getItem('cache_' + key);
      if (!raw) return null;
      const { data, expiry } = JSON.parse(raw);
      if (Date.now() > expiry) {
        localStorage.removeItem('cache_' + key);
        return null;
      }
      return data;
    } catch { return null; }
  },

  setCache(key, data, ttlMinutes = 5) {
    const payload = {
      data,
      expiry: Date.now() + ttlMinutes * 60 * 1000
    };
    try {
      localStorage.setItem('cache_' + key, JSON.stringify(payload));
    } catch (e) {
      // localStorage full, clear old caches
      this.clearOldCaches();
    }
  },

  clearOldCaches() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  },

  // ---------- Settings ----------
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem('nifty_settings') || '{}');
    } catch { return {}; }
  },

  saveSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    localStorage.setItem('nifty_settings', JSON.stringify(settings));
  },

  // ---------- Export All Data ----------
  exportAllData() {
    return {
      dailyAnalysis: this.getDailyAnalysis(),
      trades: this.getTrades(),
      globalMarketLog: this.getGlobalMarketLog(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString()
    };
  },

  importData(jsonData) {
    if (jsonData.dailyAnalysis) {
      localStorage.setItem('nifty_daily_analysis', JSON.stringify(jsonData.dailyAnalysis));
    }
    if (jsonData.trades) {
      localStorage.setItem('nifty_trades', JSON.stringify(jsonData.trades));
    }
    if (jsonData.globalMarketLog) {
      localStorage.setItem('nifty_global_log', JSON.stringify(jsonData.globalMarketLog));
    }
  }
};
