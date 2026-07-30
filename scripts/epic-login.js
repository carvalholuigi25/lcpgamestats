import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { getEpicLoginUrl, exchangeEpicAuthorizationCode } from '../lib/epic.js';

async function main() {
  console.log('1. Open this URL in your browser and log in to Epic Games:\n');
  console.log(getEpicLoginUrl());
  console.log('\n2. After logging in you will see a JSON page with an "authorizationCode" field.');
  console.log('   Copy just the value of that field (not the quotes).\n');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const code = (await rl.question('Paste the authorizationCode here: ')).trim();
  rl.close();

  if (!code) {
    console.error('No code provided.');
    process.exitCode = 1;
    return;
  }

  const tokens = await exchangeEpicAuthorizationCode(code);
  if (!tokens?.refresh_token) {
    console.error('Epic did not return a refresh token. Response:', tokens);
    process.exitCode = 1;
    return;
  }

  console.log('\nAdd this line to your .env file:\n');
  console.log(`EPIC_REFRESH_TOKEN=${tokens.refresh_token}`);
}

main().catch((err) => {
  console.error('Epic login failed:', err.response?.data || err.message);
  process.exitCode = 1;
});
