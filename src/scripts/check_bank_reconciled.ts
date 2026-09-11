import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const databaseId = firebaseConfig.firestoreDatabaseId;
const db = databaseId 
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, databaseId)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

async function run() {
  const dataPath = 'users/shared_franquia_data/bankTransactions';
  const colRef = collection(db, dataPath);
  const snap = await getDocs(colRef);
  
  const months: Record<string, { total: number; reconciled: number }> = {};
  
  snap.docs.forEach(d => {
    const data = d.data();
    const dateStr = data.data || '';
    const parts = dateStr.split('/');
    const month = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : 'unknown';
    
    if (!months[month]) months[month] = { total: 0, reconciled: 0 };
    months[month].total++;
    if (data.reconciled) months[month].reconciled++;
  });
  
  console.log("Bank Transactions stats by month:", months);
  
  // Find a sample reconciled doc
  const recSample = snap.docs.find(d => d.data().reconciled);
  if (recSample) {
    console.log("Sample reconciled doc:", recSample.data());
  } else {
    console.log("No reconciled doc found.");
  }

  process.exit(0);
}

run();
