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

  if (session.rememberMeTicket) {
    console.log('\nAdd these lines to your .env file:\n');
    console.log(`UPLAY_REMEMBER_ME_TICKET=${session.rememberMeTicket}`);
    console.log(`UPLAY_USER_ID=${session.userId}`);
  } else {
    console.log('\nUbisoft did not issue a remember-me ticket for this login, so there is nothing');
    console.log('to save for unattended access - this session is only valid until it expires');
    console.log('(a few hours). Re-run this script and paste a fresh PRODloginData when it does.');
  }
}

main().catch((err) => {
  console.error('Uplay login failed:', err.response?.data || err.message);
  process.exitCode = 1;
});
