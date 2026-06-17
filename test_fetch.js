const url = 'https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?interval=1d&range=1y';
fetch(url).then(r => r.json()).then(j => {
  const close = j.chart.result[0].indicators.quote[0].close;
  console.log('Total days:', close.length);
  const filtered = close.filter(v => v !== null);
  console.log('Valid days:', filtered.length);
}).catch(console.error);
