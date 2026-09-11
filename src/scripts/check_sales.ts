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
  const dataPath = 'users/shared_franquia_data/sales';
  const colRef = collection(db, dataPath);
  const snap = await getDocs(colRef);
  
  const months = new Set<string>();
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.mes) months.add(data.mes);
  });
  
  console.log("Existing months in sales collection:", Array.from(months));
  if (snap.docs.length > 0) {
    console.log("Sample doc:", snap.docs[0].data());
  }
  process.exit(0);
}

run();
