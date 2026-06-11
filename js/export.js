/* ============================================
   Export Module
   Export to Excel (XLSX) and CSV
   ============================================ */

const Export = {
  /**
   * Generates a CSV string from an array of objects
   */
  _toCSV(data) {
    if (!data || !data.length) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        // Escape quotes and wrap in quotes if contains comma
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  },

  /**
   * Downloads a string as a file
   */
  _download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  },

  /**
   * Export Trade Journal to CSV
   */
  exportTrades() {
    const trades = Storage.getTrades();
    if (!trades.length) {
      alert('No trades to export.');
      return;
    }
    const csv = this._toCSV(trades);
    this._download(csv, `NIFTY_Trade_Journal_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
  },

  /**
   * Export Daily Analysis History to CSV
   */
  exportDailyAnalysis() {
    const history = Storage.getDailyAnalysis();
    if (!history.length) {
      alert('No daily analysis history to export.');
      return;
    }
    const csv = this._toCSV(history);
    this._download(csv, `NIFTY_Daily_Analysis_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
  },

  /**
   * Export all data as JSON backup
   */
  exportBackup() {
    const data = Storage.exportAllData();
    const json = JSON.stringify(data, null, 2);
    this._download(json, `NIFTY_Dashboard_Backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  },

  /**
   * Process uploaded backup JSON
   */
  importBackup(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.dailyAnalysis || data.trades || data.globalMarketLog) {
             Storage.importData(data);
             resolve("Data imported successfully!");
          } else {
             reject(new Error("Invalid backup format"));
          }
        } catch (err) {
          reject(new Error("Error parsing JSON file"));
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  }
};
