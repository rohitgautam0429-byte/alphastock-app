import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 4444;

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <style>
            body { font-family: Arial; padding: 40px; background: #0f172a; color: white; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;}
            .box { background: #1e293b; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); text-align:center; }
            input { padding: 10px; width: 300px; font-size: 16px; margin: 20px 0; border: none; border-radius: 4px; }
            button { padding: 10px 20px; font-size: 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>AlphaBasket Setup</h2>
            <p>Paste your 16-character Google App Password below:</p>
            <form method="POST" action="/save">
              <input type="text" name="password" placeholder="e.g. abcd efgh ijkl mnop" required autocomplete="off" /><br/>
              <button type="submit">Save Password</button>
            </form>
          </div>
        </body>
      </html>
    `);
  } else if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const rawPass = params.get('password') || '';
      // clean whitespace from password
      const cleanPass = rawPass.replace(/\\s+/g, '').trim(); 
      
      const envContent = 'EMAIL_USER=rohitgautam0429@gmail.com\nEMAIL_PASS=' + cleanPass + '\nEMAIL_TO=rohitgautam0429@gmail.com';

      fs.writeFileSync(path.join(process.cwd(), '.env'), envContent);
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body style="font-family: Arial; background: #0f172a; color: #10b981; padding: 40px; text-align:center;"><h2>✅ Password Saved Successfully!</h2><p>You may now close this window and run [npm run test-email] in the chat.</p><script>setTimeout(() => { fetch("/kill"); }, 2000);</script></body></html>');
    });
  } else if (req.method === 'GET' && req.url === '/kill') {
    res.end('ok');
    process.exit(0);
  }
});

server.listen(PORT, () => {
  console.log('Password setup server listening on port ' + PORT);
});
