import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { getGogLoginUrl, exchangeGogAuthorizationCode } from '../lib/gog.js';

async function main() {
  console.log('1. Open this URL in your browser and log in to GOG:\n');
  console.log(getGogLoginUrl());
  console.log('\n2. After logging in you will land on a mostly blank embed.gog.com page.');
  console.log('   Copy the "code" query parameter from that page\'s address bar.\n');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const code = (await rl.question('Paste the code here: ')).trim();
  rl.close();

  if (!code) {
    console.error('No code provided.');
    process.exitCode = 1;
    return;
  }

  const tokens = await exchangeGogAuthorizationCode(code);
  if (!tokens?.refresh_token) {
    console.error('GOG did not return a refresh token. Response:', tokens);
    process.exitCode = 1;
    return;
  }

  console.log('\nAdd this line to your .env file:\n');
  console.log(`GOG_REFRESH_TOKEN=${tokens.refresh_token}`);
}

main().catch((err) => {
  console.error('GOG login failed:', err.response?.data || err.message);
  process.exitCode = 1;
});
