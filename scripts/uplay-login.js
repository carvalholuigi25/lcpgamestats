import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { getUplayLoginUrl, parseUplayLoginPayload, verifyUplaySession } from '../lib/uplay.js';

async function main() {
  console.log('1. Open this URL in your browser and log in to Ubisoft Connect (2FA included):\n');
  console.log(getUplayLoginUrl());
  console.log('\n2. Once you land back on connect.ubisoft.com logged in, open DevTools');
  console.log('   (F12) -> Application/Storage -> Local Storage -> https://connect.ubisoft.com');
  console.log('   and copy the full value of the "PRODloginData" key.\n');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const pasted = (await rl.question('Paste the PRODloginData value here: ')).trim();
  rl.close();

  if (!pasted) {
    console.error('No data provided.');
    process.exitCode = 1;
    return;
  }

  const payload = parseUplayLoginPayload(pasted);
  const session = await verifyUplaySession(payload);

  console.log(`\nLogged in as ${session.nameOnPlatform || payload.userId}.`);

  console.log('\nYour Uplay session has been saved to .env automatically - no need to copy anything.');
  if (session.rememberMeTicket) {
    console.log('Ubisoft issued a remember-me ticket, so it will keep refreshing itself unattended.');
  } else {
    console.log('Ubisoft did not issue a remember-me ticket for this login, so this session is only');
    console.log('valid until it expires (a few hours) - re-run this script and paste a fresh');
    console.log('PRODloginData once it does.');
  }
}

main().catch((err) => {
  console.error('Uplay login failed:', err.response?.data || err.message);
  process.exitCode = 1;
});
