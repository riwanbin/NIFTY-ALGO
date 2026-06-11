/* ============================================
   Charts Module
   Chart.js rendering for dashboard visualizations
   ============================================ */

const Charts = {
  instances: {},
  defaultFont: "'Inter', sans-serif",
  monoFont: "'JetBrains Mono', monospace",

  // Common chart defaults
  _getDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: this.defaultFont, size: 11 },
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 20, 38, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: this.defaultFont, weight: '600' },
          bodyFont: { family: this.monoFont, size: 12 },
          displayColors: true
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { family: this.monoFont, size: 10 } },
          grid: { color: 'rgba(255,255,255,0.03)' },
          border: { color: 'rgba(255,255,255,0.06)' }
        },
        y: {
          ticks: { color: '#64748b', font: { family: this.monoFont, size: 10 } },
          grid: { color: 'rgba(255,255,255,0.03)' },
          border: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    };
  },

  /**
   * Safely destroy and recreate a chart
   */
  _getCanvas(canvasId) {
    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
      delete this.instances[canvasId];
    }
    const el = document.getElementById(canvasId);
    if (!el) return null;
    return el.getContext('2d');
  },

  /**
   * Equity Curve — Line chart of cumulative PnL
   */
  createEquityCurve(canvasId, equityData) {
    const ctx = this._getCanvas(canvasId);
    if (!ctx || !equityData.length) return;

    const labels = equityData.map(d => d.tradeNumber);
    const data = equityData.map(d => d.cumulative);

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    const isPositive = data[data.length - 1] >= 0;
    if (isPositive) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }

    const defaults = this._getDefaults();
    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Cumulative P&L',
          data,
          borderColor: isPositive ? '#10b981' : '#ef4444',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: data.length > 50 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: isPositive ? '#10b981' : '#ef4444'
        }]
      },
      options: {
        ...defaults,
        plugins: {
          ...defaults.plugins,
          legend: { display: false }
        },
        scales: {
          ...defaults.scales,
          x: { ...defaults.scales.x, title: { display: true, text: 'Trade #', color: '#64748b', font: { size: 10 } } },
          y: { ...defaults.scales.y, title: { display: true, text: 'Cumulative P&L (₹)', color: '#64748b', font: { size: 10 } } }
        }
      }
    });
  },

  /**
   * Win/Loss Donut Chart
   */
  createWinLossDonut(canvasId, wins, losses) {
    const ctx = this._getCanvas(canvasId);
    if (!ctx) return;

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Wins', 'Losses'],
        datasets: [{
          data: [wins, losses],
          backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'],
          borderColor: ['#10b981', '#ef4444'],
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              font: { family: this.defaultFont, size: 11 },
              padding: 20,
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          tooltip: this._getDefaults().plugins.tooltip
        }
      }
    });
  },

  /**
   * Factor Radar Chart
   */
  createFactorRadar(canvasId, factors) {
    const ctx = this._getCanvas(canvasId);
    if (!ctx) return;

    const labels = Object.keys(factors);
    const data = Object.values(factors).map(v => Math.abs(v));
    const colors = Object.values(factors).map(v => v >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)');

    this.instances[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'Factor Scores',
          data,
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          borderColor: '#3b82f6',
          borderWidth: 2,
          pointBackgroundColor: colors,
          pointBorderColor: colors,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: 'rgba(255,255,255,0.05)' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            pointLabels: {
              color: '#94a3b8',
              font: { family: this.defaultFont, size: 11 }
            },
            ticks: {
              display: false,
              stepSize: 1
            },
            suggestedMin: 0,
            suggestedMax: 3
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: this._getDefaults().plugins.tooltip
        }
      }
    });
  },

  /**
   * Setup Analytics Bar Chart
   */
  createSetupBar(canvasId, setups) {
    const ctx = this._getCanvas(canvasId);
    if (!ctx) return;

    const labels = Object.keys(setups);
    const wins = labels.map(k => setups[k].wins);
    const losses = labels.map(k => setups[k].losses);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Wins',
            data: wins,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Losses',
            data: losses,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        ...this._getDefaults(),
        plugins: {
          ...this._getDefaults().plugins,
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: this.defaultFont, size: 11 },
              usePointStyle: true,
              pointStyleWidth: 10,
              padding: 16
            }
          }
        }
      }
    });
  },

  /**
   * OI Distribution Bar Chart
   */
  createOIDistribution(canvasId, strikes, callOI, putOI) {
    const ctx = this._getCanvas(canvasId);
    if (!ctx) return;

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: strikes,
        datasets: [
          {
            label: 'Call OI',
            data: callOI,
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'Put OI',
            data: putOI,
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 3
          }
        ]
      },
      options: {
        ...this._getDefaults(),
        indexAxis: 'x',
        plugins: {
          ...this._getDefaults().plugins,
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: this.defaultFont, size: 11 },
              usePointStyle: true,
              padding: 16
            }
          }
        }
      }
    });
  },

  /**
   * Daily Score Timeline
   */
  createScoreTimeline(canvasId, dailyData) {
    const ctx = this._getCanvas(canvasId);
    if (!ctx || !dailyData.length) return;

    const labels = dailyData.map(d => d.date).reverse();
    const scores = dailyData.map(d => d.score || 0).reverse();
    const bgColors = scores.map(s => s > 1 ? 'rgba(16, 185, 129, 0.6)' : s < -1 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 158, 11, 0.6)');

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Daily Score',
          data: scores,
          backgroundColor: bgColors,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        ...this._getDefaults(),
        plugins: {
          ...this._getDefaults().plugins,
          legend: { display: false }
        }
      }
    });
  },

  /**
   * Destroy all chart instances
   */
  destroyAll() {
    Object.keys(this.instances).forEach(key => {
      this.instances[key].destroy();
      delete this.instances[key];
    });
  }
};
