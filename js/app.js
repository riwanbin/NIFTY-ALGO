/* ============================================
   App Controller
   Main dashboard logic and UI binding
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const navLinks = document.querySelectorAll('.nav-links li');
  const tabContents = document.querySelectorAll('.tab-content');
  const clockEl = document.getElementById('header-clock');
  const dateEl = document.getElementById('header-date');
  const marketStatusDot = document.getElementById('market-status-dot');
  const marketStatusText = document.getElementById('market-status-text');
  
  // Data State
  let marketData = {
    global: null,
    nifty: null,
    fiiDii: null,
    optionChain: null,
    vix: null
  };

  // Toast System
  window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if(type === 'success') icon = '✅';
    if(type === 'error') icon = '❌';
    
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 4000);
  };

  // Clock
  setInterval(() => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dateEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Simple market status check (9:15 to 15:30 IST, Mon-Fri)
    const day = now.getDay();
    const hour = now.getHours();
    const min = now.getMinutes();
    const time = hour + min/60;
    
    if (day >= 1 && day <= 5 && time >= 9.25 && time <= 15.5) {
      marketStatusDot.classList.add('open');
      marketStatusText.textContent = 'Market Open';
    } else {
      marketStatusDot.classList.remove('open');
      marketStatusText.textContent = 'Market Closed';
    }
  }, 1000);

  // Tab Switching
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Remove active from all
      navLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active to clicked
      link.classList.add('active');
      const tabId = link.getAttribute('data-tab');
      document.getElementById(`tab-${tabId}`).classList.add('active');
      
      // Special tab handlers
      if (tabId === 'dashboard') {
        renderDashboard();
      }
    });
  });

  // Checklist Setup
  const checklistItems = document.querySelectorAll('.checklist-item');
  const checklistData = Storage.getChecklist();
  
  checklistItems.forEach(item => {
    const id = item.getAttribute('data-id');
    const timeEl = item.querySelector('.checklist-time');
    
    if (checklistData[id] && checklistData[id].checked) {
      item.classList.add('checked');
      if (timeEl && checklistData[id].time) timeEl.textContent = checklistData[id].time;
    }
    
    item.addEventListener('click', () => {
      const isChecked = !item.classList.contains('checked');
      item.classList.toggle('checked');
      
      if (isChecked && timeEl) {
        const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        timeEl.textContent = time;
      } else if (!isChecked && timeEl) {
        timeEl.textContent = '--:--';
      }
      
      Storage.saveChecklistItem(id, isChecked);
    });
  });

  // Settings Modal
  const settingsModal = document.getElementById('settings-modal');
  const settingsBtn = document.getElementById('btn-settings');
  const closeSettingsBtn = document.getElementById('close-settings');
  const saveSettingsBtn = document.getElementById('save-settings');
  
  settingsBtn.addEventListener('click', () => {
    document.getElementById('api-key-input').value = Storage.getApiKey();
    settingsModal.classList.add('active');
  });
  
  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });
  
  saveSettingsBtn.addEventListener('click', () => {
    const key = document.getElementById('api-key-input').value;
    Storage.setApiKey(key);
    settingsModal.classList.remove('active');
    showToast('Settings saved successfully', 'success');
  });

  // Check API Key
  if (!Storage.getApiKey()) {
    document.getElementById('api-key-banner').classList.remove('hidden');
  } else {
    document.getElementById('api-key-banner').classList.add('hidden');
  }

  // Bind Fetch Buttons
  document.getElementById('btn-fetch-global').addEventListener('click', fetchGlobalData);
  document.getElementById('btn-fetch-nse').addEventListener('click', fetchNseData);
  document.getElementById('btn-calculate-bias').addEventListener('click', calculateBias);

  // Manual NSE Data Upload Handler
  document.getElementById('nse-manual-paste').addEventListener('change', handleManualNsePaste);

  // Initial render calls
  renderTradeJournal();
  
  // ==========================================
  // Data Fetching & Rendering Logic
  // ==========================================
  
  async function fetchGlobalData() {
    const btn = document.getElementById('btn-fetch-global');
    if (!Storage.getApiKey()) {
      showToast('Please set your API key in Settings first', 'error');
      settingsModal.classList.add('active');
      return;
    }
    
    try {
      btn.innerHTML = '<span class="spinner"></span> Fetching...';
      btn.disabled = true;
      
      const data = await API.fetchGlobalMarkets();
      marketData.global = data;
      
      if (data.errors && data.errors.length > 0) {
        showToast('Some markets failed to load: ' + data.errors[0], 'error');
      } else {
        showToast('Global market data updated', 'success');
      }
      
      renderGlobalMarkets(data);
      
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      btn.innerHTML = '🔄 Fetch Latest Data';
      btn.disabled = false;
    }
  }
  
  function renderGlobalMarkets(data) {
    const updateTile = (id, quote) => {
      if (!quote) return;
      const parsed = API.parseChange(quote);
      const valEl = document.getElementById(`val-${id}`);
      const chgEl = document.getElementById(`chg-${id}`);
      const tile = document.getElementById(`tile-${id}`);
      
      if (valEl) valEl.textContent = parsed.price ? parsed.price.toLocaleString('en-US', {maximumFractionDigits:2}) : '—';
      if (chgEl) {
        const sign = parsed.changePercent >= 0 ? '+' : '';
        chgEl.textContent = `${sign}${parsed.changePercent.toFixed(2)}%`;
        chgEl.className = `stat-change ${parsed.changePercent >= 0 ? 'positive' : 'negative'}`;
      }
      if (tile) {
        tile.className = `stat-tile ${parsed.changePercent >= 0 ? 'bullish' : 'bearish'}`;
      }
    };
    
    updateTile('sp500', data.sp500);
    updateTile('nasdaq', data.nasdaq);
    updateTile('dow', data.dow);
    updateTile('nikkei', data.nikkei);
    updateTile('hangseng', data.hangSeng);
    updateTile('crude', data.crude);
    updateTile('usdinr', data.usdInr);
  }
  
  async function fetchNseData() {
    const btn = document.getElementById('btn-fetch-nse');
    
    try {
      btn.innerHTML = '<span class="spinner"></span> Fetching...';
      btn.disabled = true;
      
      // Technicals from Twelve Data
      if (Storage.getApiKey()) {
        const techData = await API.fetchNiftyTechnicals();
        marketData.nifty = techData;
        renderNiftyTrend(techData);
      }
      
      // Try fetching from NSE
      const fiiPromise = API.fetchFIIDII();
      const ocPromise = API.fetchOptionChain();
      const vixPromise = API.fetchIndiaVIX();
      
      const [fii, oc, vix] = await Promise.allSettled([fiiPromise, ocPromise, vixPromise]);
      
      if (fii.status === 'fulfilled' && fii.value) {
        marketData.fiiDii = fii.value;
        renderFIIDII(fii.value);
      }
      
      if (oc.status === 'fulfilled' && oc.value) {
        const parsedOC = API.parseOptionChain(oc.value);
        marketData.optionChain = parsedOC;
        renderOptionChain(parsedOC);
      }
      
      if (vix.status === 'fulfilled' && vix.value) {
        marketData.vix = vix.value;
      }
      
      // Check if NSE failed
      if (!marketData.fiiDii || !marketData.optionChain) {
        // Look for manual data
        const manual = Storage.getNSEManualData();
        if (manual) {
           showToast('Using manually pasted NSE data', 'info');
           if (manual.fii) renderFIIDII(manual.fii);
           if (manual.oc) renderOptionChain(manual.oc);
        } else {
           showToast('NSE blocked auto-fetch. Please paste data manually below.', 'error');
           document.getElementById('nse-manual-section').classList.remove('hidden');
        }
      } else {
        showToast('NSE data updated successfully', 'success');
      }
      
    } catch (e) {
      showToast(e.message, 'error');
      document.getElementById('nse-manual-section').classList.remove('hidden');
    } finally {
      btn.innerHTML = '🔄 Fetch NSE Data';
      btn.disabled = false;
    }
  }
  
  function renderNiftyTrend(data) {
    if (!data) return;
    
    if (data.nifty) {
      const parsed = API.parseChange(data.nifty);
      document.getElementById('nifty-spot-input').value = parsed.price;
    }
    
    if (data.ema20) document.getElementById('nifty-ema20-input').value = Math.round(data.ema20);
    if (data.ema50) document.getElementById('nifty-ema50-input').value = Math.round(data.ema50);
    if (data.ema200) document.getElementById('nifty-ema200-input').value = Math.round(data.ema200);
    
    updateManualTrend();
  }
  
  function updateManualTrend() {
    const price = parseFloat(document.getElementById('nifty-spot-input').value) || 0;
    const ema20 = parseFloat(document.getElementById('nifty-ema20-input').value) || 0;
    const ema50 = parseFloat(document.getElementById('nifty-ema50-input').value) || 0;
    const ema200 = parseFloat(document.getElementById('nifty-ema200-input').value) || 0;
    
    if (!price) return;
    
    const score = Scoring.scoreTrend(price, ema20, ema50, ema200);
    const badge = document.getElementById('nifty-trend-badge');
    
    if (score > 0) { badge.className = 'card-badge badge-green'; badge.textContent = 'BULLISH'; }
    else if (score < 0) { badge.className = 'card-badge badge-red'; badge.textContent = 'BEARISH'; }
    else { badge.className = 'card-badge badge-amber'; badge.textContent = 'NEUTRAL'; }
  }

  // Bind manual trend updates
  ['nifty-spot-input', 'nifty-ema20-input', 'nifty-ema50-input', 'nifty-ema200-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateManualTrend);
  });
  
  function renderFIIDII(data) {
    // Basic rendering (assuming data array exists)
    try {
      // Find today/latest values (this depends heavily on actual NSE json structure)
      // We will leave placeholder values to be filled by the scoring engine
      showToast('FII/DII data loaded', 'success');
    } catch(e) {}
  }
  
  function renderOptionChain(data) {
    if (!data) return;
    
    if (data.spotPrice) {
      document.getElementById('nifty-spot-input').value = data.spotPrice;
      updateManualTrend();
    }
    
    document.getElementById('oc-highest-call').textContent = data.highestCallOI.toLocaleString('en-IN');
    document.getElementById('oc-highest-put').textContent = data.highestPutOI.toLocaleString('en-IN');
    document.getElementById('oc-pcr').textContent = data.pcr.toFixed(2);
    
    const pcrBadge = document.getElementById('oc-pcr-badge');
    if (data.pcr > 1.2) { pcrBadge.className = 'card-badge badge-green'; pcrBadge.textContent = 'BULLISH'; }
    else if (data.pcr < 0.8) { pcrBadge.className = 'card-badge badge-red'; pcrBadge.textContent = 'BEARISH'; }
    else { pcrBadge.className = 'card-badge badge-amber'; pcrBadge.textContent = 'NEUTRAL'; }
  }
  
  function handleManualNsePaste(e) {
    try {
      const val = e.target.value;
      if (!val) return;
      const parsed = JSON.parse(val);
      Storage.saveNSEManualData({ oc: parsed }); // Assume it's OC data for now
      showToast('Manual data parsed successfully', 'success');
      e.target.value = '';
      
      const parsedOC = API.parseOptionChain(parsed);
      marketData.optionChain = parsedOC;
      renderOptionChain(parsedOC);
      
    } catch(err) {
      showToast('Invalid JSON format', 'error');
    }
  }
  
  function calculateBias() {
    // For now we will use dummy inputs or inputs read from DOM, to showcase the engine
    // In production, we'd pull from marketData
    
    // Read from manual inputs
    const getVal = id => {
      const el = document.getElementById(id);
      return el && el.value !== '' ? parseFloat(el.value) : null;
    };
    
    const scores = {
      global: marketData.global ? Scoring.scoreGlobal(marketData.global) : 0,
      news: Scoring.scoreNews(document.getElementById('news-impact')?.value || 'none'),
      fii: Scoring.scoreFIIDII(getVal('fii-net') ?? (marketData.fiiDii ? 1000 : 0), getVal('dii-net') ?? 0),
      dii: 0, // bundled in fii
      vix: Scoring.scoreVIX(getVal('manual-vix') ?? (marketData.vix ? marketData.vix.lastPrice : 14)),
      trend: Scoring.scoreTrend(
        getVal('nifty-spot-input') || (marketData.nifty ? API.parseChange(marketData.nifty.nifty).price : 0),
        getVal('nifty-ema20-input') || marketData.nifty?.ema20 || 0,
        getVal('nifty-ema50-input') || marketData.nifty?.ema50 || 0,
        getVal('nifty-ema200-input') || marketData.nifty?.ema200 || 0
      ),
      bankNifty: marketData.nifty?.bankNifty ? Scoring.scoreBankNifty(API.parseChange(marketData.nifty.bankNifty).changePercent) : 0,
      breadth: Scoring.scoreBreadth(getVal('advances') || 0, getVal('declines') || 0),
      optionChain: Scoring.scoreOptionChain(
        getVal('manual-pcr') || marketData.optionChain?.pcr || 1.0, 
        marketData.optionChain?.highestCallOIValue || 0, 
        marketData.optionChain?.highestPutOIValue || 0, 
        marketData.optionChain?.spotPrice || 0
      ),
      oi: marketData.optionChain ? 1 : 0 // Simplified for now
    };
    
    const result = Scoring.computeBias(scores);
    
    // Render result
    document.getElementById('final-score-value').textContent = result.totalScore;
    const biasEl = document.getElementById('final-bias-label');
    biasEl.textContent = result.bias;
    biasEl.className = `bias-label ${result.biasClass}`;
    
    // Render Bar
    const bar = document.getElementById('final-score-bar');
    // Map -10 to +10 to 0% to 100%
    let pct = ((result.totalScore + 10) / 20) * 100;
    pct = Math.max(0, Math.min(100, pct));
    bar.style.width = `${pct}%`;
    
    if (result.totalScore > 0) bar.style.background = 'var(--green)';
    else if (result.totalScore < 0) bar.style.background = 'var(--red)';
    else bar.style.background = 'var(--amber)';
    
    // Render Factor Grid
    const factorGrid = document.getElementById('factor-score-grid');
    factorGrid.innerHTML = '';
    
    Object.keys(scores).forEach(key => {
      const name = key.replace(/([A-Z])/g, ' $1').trim();
      const val = scores[key];
      const weight = Scoring.weights[key] || 10;
      
      factorGrid.innerHTML += `
        <div class="factor-card">
          <div class="factor-name">${name.toUpperCase()}</div>
          <div class="factor-score" style="color: ${Scoring.getScoreColor(val)}">${val > 0 ? '+' : ''}${val}</div>
          <div class="factor-weight">Weight: ${weight}%</div>
        </div>
      `;
    });
    
    showToast('Market Bias Calculated', 'success');
    
    // Save to daily history
    Storage.saveDailyEntry({
      score: result.totalScore,
      bias: result.bias,
      factors: scores
    });
  }

  // ==========================================
  // Trade Journal Logic
  // ==========================================
  const addTradeBtn = document.getElementById('btn-add-trade');
  if (addTradeBtn) {
    addTradeBtn.addEventListener('click', () => {
      // Create a dummy trade for demo purposes
      const newTrade = {
        date: new Date().toISOString().split('T')[0],
        setup: 'Breakout',
        direction: 'Long',
        entry: 25000,
        sl: 24950,
        target: 25100,
        exit: 25080,
        pnl: 1500,
        winLoss: 'Win',
        rr: 1.6,
        confidence: 80
      };
      Storage.saveTrade(newTrade);
      renderTradeJournal();
      showToast('Trade added to journal', 'success');
    });
  }
  
  function renderTradeJournal() {
    const tbody = document.getElementById('trade-journal-body');
    if (!tbody) return;
    
    const trades = Storage.getTrades().reverse(); // newest first
    tbody.innerHTML = '';
    
    if (trades.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding: 20px;">No trades logged yet. Add your first trade.</td></tr>`;
      return;
    }
    
    trades.forEach(t => {
      const isWin = t.winLoss === 'Win';
      const tr = document.createElement('tr');
      tr.className = isWin ? 'trade-row-win' : 'trade-row-loss';
      
      tr.innerHTML = `
        <td>${t.date}</td>
        <td>${t.setup}</td>
        <td><span class="pill ${t.direction === 'Long' ? 'pill-bullish' : 'pill-bearish'}">${t.direction}</span></td>
        <td class="mono-cell">${t.entry}</td>
        <td class="mono-cell text-red">${t.sl}</td>
        <td class="mono-cell text-green">${t.exit || '-'}</td>
        <td><span class="pill ${isWin ? 'pill-win' : 'pill-loss'}">${t.winLoss}</span></td>
        <td class="mono-cell" style="color: ${isWin ? 'var(--green-light)' : 'var(--red-light)'}">${t.pnl}</td>
        <td><button class="btn-icon btn-sm delete-trade" data-id="${t.id}">🗑️</button></td>
      `;
      tbody.appendChild(tr);
    });
    
    // Bind delete buttons
    document.querySelectorAll('.delete-trade').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        Storage.deleteTrade(id);
        renderTradeJournal();
        showToast('Trade deleted', 'info');
      });
    });
  }

  // ==========================================
  // Dashboard Metrics & Charts Logic
  // ==========================================
  function renderDashboard() {
    const trades = Storage.getTrades();
    const metrics = Scoring.computeDashboard(trades);
    
    // Update Tiles
    document.getElementById('dash-total-trades').textContent = metrics.total;
    document.getElementById('dash-win-rate').textContent = (metrics.winRate * 100).toFixed(1) + '%';
    document.getElementById('dash-total-pnl').textContent = '₹' + metrics.totalPnl.toLocaleString('en-IN');
    
    const pnlTile = document.getElementById('tile-total-pnl');
    if (pnlTile) pnlTile.className = `stat-tile ${metrics.totalPnl >= 0 ? 'bullish' : 'bearish'}`;
    
    document.getElementById('dash-profit-factor').textContent = metrics.profitFactor.toFixed(2);
    
    // Render Charts
    Charts.destroyAll();
    
    // Equity Curve
    const equityData = Scoring.computeEquityCurve(trades);
    Charts.createEquityCurve('chart-equity', equityData);
    
    // Win/Loss
    Charts.createWinLossDonut('chart-winloss', metrics.wins, metrics.losses);
    
    // Setup Analytics
    const setups = Scoring.computeSetupAnalytics(trades);
    Charts.createSetupBar('chart-setups', setups);
  }

  // ==========================================
  // Export Binding
  // ==========================================
  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      Export.exportTrades();
    });
  }

});
