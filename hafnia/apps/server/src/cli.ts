// Admin commands for the server operator.
//   npm run invite -- 5           creates 5 invite codes
//   npm run admin -- <name>       makes an existing trainer an admin
// Uses DATABASE_URL, or the dev JSON file when it is not set.
import { config } from './config';
import { inviteCode } from './hub';
import { PgStore } from './pg-store';
import { MemoryStore, type Store } from './store';

const store: Store = config.databaseUrl ? new PgStore(config.databaseUrl) : new MemoryStore(config.dataFile);
const [cmd, arg] = process.argv.slice(2);

if (cmd === 'invite') {
  const codes = Array.from({ length: Math.min(100, Math.max(1, Number(arg) || 1)) }, inviteCode);
  await store.createInvites(null, codes);
  console.log(codes.join('\n'));
} else if (cmd === 'admin') {
  const a = arg ? await store.accountByName(arg) : null;
  if (!a) console.error(`No trainer called "${arg}".`);
  else { await store.updateAccount(a.id, { role: 'admin' }); console.log(`${a.trainerName} is now an admin.`); }
} else console.error('Usage: invite [count] | admin <trainer name>');
await store.close();
