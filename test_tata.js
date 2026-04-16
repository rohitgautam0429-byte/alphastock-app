async function test() {
  const req = await fetch('http://localhost:4000/api/yahoo-chart/TATAMOTORS.NS?interval=1d&range=1d&includePrePost=true');
  console.log('Yahoo Proxy API Status:', req.status);
  
  const req2 = await fetch('http://localhost:4000/stock/TATAMOTORS.NS');
  console.log('Server Request Status for React Route:', req2.status);
  const text = await req2.text();
  console.log('Response content length:', text.length, 'Starts with:', text.substring(0, 50));
}

test();
