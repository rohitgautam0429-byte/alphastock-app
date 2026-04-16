import { runDailyJob } from './src/services/emailBot.js';

console.log('Testing Email Bot...');
// Passed true to indicate it is a test run, which warns if .env is not setup.
runDailyJob(true).then(() => {
  // Give Node a moment to finish async tasks (since Nodemailer operations might still be pending in event loop)
  setTimeout(() => {
    console.log('Test execution complete.');
    process.exit(0);
  }, 2000);
});
