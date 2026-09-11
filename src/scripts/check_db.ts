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
  console.log("=== DIAGNOSTICKING FIRESTORE DATA COUUNTS ===");
  const dataPath = 'users/shared_franquia_data';
  const collections = [
    'sales',
    'purchases',
    'bankTransactions',
    'stock',
    'financialRecords',
    'wasteRecords',
    'staffConsumption',
    'staffPayments',
    'purchaseRequests',
    'recipes'
  ];

  for (const name of collections) {
    try {
      const colRef = collection(db, `${dataPath}/${name}`);
      const snap = await getDocs(colRef);
      console.log(`Collection '${name}': ${snap.size} documents found.`);
      if (snap.size > 0) {
        console.log(`Sample doc from ${name}:`, snap.docs[0].data());
      }
    } catch (err: any) {
      console.error(`Error reading collection '${name}':`, err.message || err);
    }
  }
  console.log("=== FINISHED DIAGNOSTIC ===");
  process.exit(0);
}

run();
