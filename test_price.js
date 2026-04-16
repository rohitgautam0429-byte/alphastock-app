async function getPrice(symbol) {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    const json = await res.json();
    const meta = json.chart.result[0].meta;
    console.log(`${symbol} -> Price: ${meta.regularMarketPrice}, PrevClose: ${meta.previousClose}, Currency: ${meta.currency}, Exchange: ${meta.exchangeName}, tz: ${meta.exchangeTimezoneName}`);
  } catch(e) {
    console.log(`${symbol} -> Error parsing or no data. MSG: ${e.message}`);
  }
}

async function run() {
  await getPrice('RELIANCE.NS');
  await getPrice('TATAMOTORS.NS');
  await getPrice('TCS.NS');
  await getPrice('^NSEI');
  await getPrice('GC=F');
  await getPrice('CL=F');
}
run();
