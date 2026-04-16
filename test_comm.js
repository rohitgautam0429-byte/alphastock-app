

const COMMODITY_MAP = {
  'GC=F': { name: 'Gold', unit: '10 grams', conversion: (usd) => (usd / 31.1035) * 10 },
  'SI=F': { name: 'Silver', unit: '1 kg', conversion: (usd) => (usd / 31.1035) * 1000 },
};

async function test() {
  const usdInrReq = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X');
  const usdInrData = await usdInrReq.json();
  const rate = usdInrData.chart.result[0].meta.regularMarketPrice;
  console.log('USDINR=X Rate:', rate);

  for (const sym of ['GC=F', 'SI=F']) {
    const req = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}`);
    const data = await req.json();
    const usdPrice = data.chart.result[0].meta.regularMarketPrice;
    console.log(sym, 'Raw USD:', usdPrice);
    
    const info = COMMODITY_MAP[sym];
    const inrPrice = info.conversion(usdPrice) * rate;
    console.log(sym, 'Converted INR:', inrPrice);
  }
}

test();
