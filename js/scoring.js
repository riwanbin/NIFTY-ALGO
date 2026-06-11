/* ============================================
   Scoring Engine
   Market bias scoring (mirrors Excel formulas)
   ============================================ */

const Scoring = {
  /* Factor weights from Factor Effectiveness sheet */
  weights: {
    trend: 25,
    optionChain: 20,
    oi: 15,
    bankNifty: 15,
    fiiDii: 10,
    breadth: 10,
    news: 5
  },

  /**
   * Score GIFT Nifty gap
   * @param {number} diff - GIFT Nifty - Previous NIFTY Close
   * @returns {number} -2 to +2
   */
  scoreGiftNifty(diff) {
    if (diff >= 100) return 2;
    if (diff >= 30) return 1;
    if (diff <= -100) return -2;
    if (diff <= -30) return -1;
    return 0;
  },

  /**
   * Score Global Markets (US + Asian)
   * @param {object} data - { sp500: %, nasdaq: %, dow: %, nikkei: %, hangSeng: %, kospi: % }
   * @returns {number} -2 to +2
   */
  scoreGlobal(data) {
    const usMarkets = [data.sp500, data.nasdaq, data.dow].filter(v => v != null);
    const asianMarkets = [data.nikkei, data.hangSeng, data.kospi].filter(v => v != null);

    let usScore = 0;
    if (usMarkets.length > 0) {
      const greenCount = usMarkets.filter(v => v > 0).length;
      const redCount = usMarkets.filter(v => v < 0).length;
      if (greenCount === usMarkets.length) usScore = 1;
      else if (redCount === usMarkets.length) usScore = -1;
    }

    let asianScore = 0;
    if (asianMarkets.length > 0) {
      const greenCount = asianMarkets.filter(v => v > 0).length;
      const redCount = asianMarkets.filter(v => v < 0).length;
      if (greenCount === asianMarkets.length) asianScore = 1;
      else if (redCount === asianMarkets.length) asianScore = -1;
    }

    return usScore + asianScore;
  },

  /**
   * Score FII/DII activity
   * @param {number} fiiNet - FII net buy/sell in crores
   * @param {number} diiNet - DII net buy/sell in crores
   * @returns {number} -2 to +2
   */
  scoreFIIDII(fiiNet, diiNet) {
    let score = 0;
    // FII buying is more impactful
    if (fiiNet > 1000) score += 2;
    else if (fiiNet > 0) score += 1;
    else if (fiiNet < -1000) score -= 2;
    else if (fiiNet < 0) score -= 1;

    // DII buying (usually contra to FII)
    if (diiNet > 1000) score += 0.5;
    else if (diiNet > 0) score += 0.25;

    return Math.round(score);
  },

  /**
   * Score India VIX
   * @param {number} vix - Current VIX
   * @param {number} prevVix - Previous day VIX (optional)
   * @returns {number} -2 to +2
   */
  scoreVIX(vix, prevVix) {
    if (vix == null) return 0;
    let score = 0;

    // VIX level
    if (vix < 12) score = 1;       // Low fear
    else if (vix < 15) score = 0;  // Normal
    else if (vix < 20) score = -1; // Elevated fear
    else score = -2;               // High fear

    // VIX trend (falling VIX is bullish)
    if (prevVix != null) {
      const change = ((vix - prevVix) / prevVix) * 100;
      if (change < -10) score += 1;
      else if (change > 10) score -= 1;
    }

    return Math.max(-2, Math.min(2, score));
  },

  /**
   * Score NIFTY Trend using EMAs
   * @param {number} price - Current NIFTY price
   * @param {number} ema20 - 20-day EMA
   * @param {number} ema50 - 50-day EMA
   * @param {number} ema200 - 200-day EMA
   * @returns {number} -2 to +2
   */
  scoreTrend(price, ema20, ema50, ema200) {
    if (!price) return 0;
    let score = 0;

    // Price vs EMAs
    if (ema20 && price > ema20) score += 0.5;
    else if (ema20 && price < ema20) score -= 0.5;

    if (ema50 && price > ema50) score += 0.5;
    else if (ema50 && price < ema50) score -= 0.5;

    if (ema200 && price > ema200) score += 0.5;
    else if (ema200 && price < ema200) score -= 0.5;

    // EMA alignment (bullish: 20 > 50 > 200)
    if (ema20 && ema50 && ema200) {
      if (ema20 > ema50 && ema50 > ema200) score += 0.5;
      else if (ema20 < ema50 && ema50 < ema200) score -= 0.5;
    }

    return Math.max(-2, Math.min(2, Math.round(score)));
  },

  /**
   * Score Bank Nifty confirmation
   * @param {number} changePercent - Bank Nifty % change
   * @returns {number} -1 to +1
   */
  scoreBankNifty(changePercent) {
    if (changePercent == null) return 0;
    if (changePercent > 0.5) return 1;
    if (changePercent < -0.5) return -1;
    return 0;
  },

  /**
   * Score Market Breadth
   * @param {number} advancing - Number of advancing stocks
   * @param {number} declining - Number of declining stocks
   * @returns {number} -2 to +2
   */
  scoreBreadth(advancing, declining) {
    if (!advancing && !declining) return 0;
    const total = advancing + declining;
    if (total === 0) return 0;
    const ratio = advancing / total;

    if (ratio >= 0.7) return 2;
    if (ratio >= 0.55) return 1;
    if (ratio <= 0.3) return -2;
    if (ratio <= 0.45) return -1;
    return 0;
  },

  /**
   * Score Option Chain analysis
   * @param {number} pcr - Put Call Ratio
   * @param {number} highestCallOI - Strike with highest Call OI
   * @param {number} highestPutOI - Strike with highest Put OI
   * @param {number} niftyPrice - Current NIFTY price
   * @returns {number} -2 to +2
   */
  scoreOptionChain(pcr, highestCallOI, highestPutOI, niftyPrice) {
    let score = 0;

    // PCR interpretation
    if (pcr != null) {
      if (pcr > 1.3) score += 2;       // Very bullish
      else if (pcr > 1) score += 1;    // Bullish
      else if (pcr < 0.7) score -= 2;  // Very bearish
      else if (pcr < 1) score -= 1;    // Bearish
    }

    return Math.max(-2, Math.min(2, score));
  },

  /**
   * Detect OI build-up type
   * @param {number} priceChange - Price change direction (positive/negative)
   * @param {number} oiChange - OI change direction (positive/negative)
   * @returns {object} { type, score, description }
   */
  analyzeOI(priceChange, oiChange) {
    if (priceChange > 0 && oiChange > 0) {
      return { type: 'long-buildup', score: 2, description: 'Long Build-up (Bullish)' };
    }
    if (priceChange < 0 && oiChange > 0) {
      return { type: 'short-buildup', score: -2, description: 'Short Build-up (Bearish)' };
    }
    if (priceChange > 0 && oiChange < 0) {
      return { type: 'short-covering', score: 1, description: 'Short Covering (Mildly Bullish)' };
    }
    if (priceChange < 0 && oiChange < 0) {
      return { type: 'long-unwinding', score: -1, description: 'Long Unwinding (Mildly Bearish)' };
    }
    return { type: 'neutral', score: 0, description: 'No Clear Signal' };
  },

  /**
   * Score News impact
   * @param {string} impact - 'high-bullish', 'high-bearish', 'medium-bullish', 'medium-bearish', 'low', 'none'
   * @returns {number} -1 to +1
   */
  scoreNews(impact) {
    const map = {
      'high-bullish': 1,
      'medium-bullish': 0.5,
      'low': 0,
      'none': 0,
      'medium-bearish': -0.5,
      'high-bearish': -1
    };
    return map[impact] || 0;
  },

  /**
   * Compute total score from all factors
   * Uses the Daily Analysis sheet formula: Score = SUM(B:K)
   * @param {object} scores - { global, news, fii, dii, vix, trend, bankNifty, breadth, optionChain, oi }
   * @returns {object} { totalScore, bias, factors }
   */
  computeBias(scores) {
    const totalScore = Object.values(scores).reduce((sum, v) => sum + (Number(v) || 0), 0);

    let bias;
    if (totalScore > 5) bias = 'Strong Bullish';
    else if (totalScore > 1) bias = 'Bullish';
    else if (totalScore < -5) bias = 'Strong Bearish';
    else if (totalScore < -1) bias = 'Bearish';
    else bias = 'Neutral';

    return {
      totalScore: Math.round(totalScore * 10) / 10,
      bias,
      biasClass: bias.toLowerCase().replace(' ', '-'),
      factors: scores
    };
  },

  /**
   * Get bias CSS class
   */
  getBiasClass(bias) {
    const map = {
      'Strong Bullish': 'bias-strong-bullish',
      'Bullish': 'bias-bullish',
      'Neutral': 'bias-neutral',
      'Bearish': 'bias-bearish',
      'Strong Bearish': 'bias-strong-bearish'
    };
    return map[bias] || 'bias-neutral';
  },

  /**
   * Get pill class for bias
   */
  getPillClass(bias) {
    if (bias.includes('Bullish')) return 'pill-bullish';
    if (bias.includes('Bearish')) return 'pill-bearish';
    return 'pill-neutral';
  },

  /**
   * Get color for a score value
   */
  getScoreColor(score) {
    if (score > 0) return 'var(--green-light)';
    if (score < 0) return 'var(--red-light)';
    return 'var(--amber-light)';
  },

  /**
   * Compute dashboard metrics from trades
   */
  computeDashboard(trades) {
    const total = trades.length;
    const wins = trades.filter(t => t.winLoss === 'Win').length;
    const losses = trades.filter(t => t.winLoss === 'Loss').length;
    const winRate = total > 0 ? (wins / total) : 0;
    const totalPnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
    const avgRR = trades.length > 0
      ? trades.reduce((s, t) => s + (Number(t.rr) || 0), 0) / trades.length
      : 0;
    const avgConfidence = trades.length > 0
      ? trades.reduce((s, t) => s + (Number(t.confidence) || 0), 0) / trades.length
      : 0;

    const grossProfit = trades.filter(t => (Number(t.pnl) || 0) > 0).reduce((s, t) => s + Number(t.pnl), 0);
    const grossLoss = Math.abs(trades.filter(t => (Number(t.pnl) || 0) < 0).reduce((s, t) => s + Number(t.pnl), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    // Analysis accuracy
    const dailyHistory = Storage.getDailyAnalysis();
    const correctDays = dailyHistory.filter(d => d.correct === 'Yes').length;
    const totalDays = dailyHistory.filter(d => d.actual).length;
    const analysisAccuracy = totalDays > 0 ? correctDays / totalDays : 0;

    return {
      total, wins, losses, winRate, totalPnl, avgRR, avgConfidence,
      profitFactor, analysisAccuracy, grossProfit, grossLoss
    };
  },

  /**
   * Compute equity curve from trades
   */
  computeEquityCurve(trades) {
    let cumulative = 0;
    return trades.map((t, i) => {
      cumulative += Number(t.pnl) || 0;
      return { tradeNumber: i + 1, pnl: Number(t.pnl) || 0, cumulative };
    });
  },

  /**
   * Compute setup analytics
   */
  computeSetupAnalytics(trades) {
    const setups = {};
    trades.forEach(t => {
      const setup = t.setup || 'Unknown';
      if (!setups[setup]) setups[setup] = { wins: 0, losses: 0, pnl: 0 };
      if (t.winLoss === 'Win') setups[setup].wins++;
      else if (t.winLoss === 'Loss') setups[setup].losses++;
      setups[setup].pnl += Number(t.pnl) || 0;
    });
    return setups;
  }
};
