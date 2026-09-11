import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, collection } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import * as fs from 'fs';
import * as path from 'path';

// Load Firebase Config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const csvData = `Data,Fornecedor,produto,quantidade,valor total
06/10/25,My Baker,Croissant,60,"442,2"
06/10/25,My Baker,Pão,20,"197,2"
05/11/25,My Baker,Croissant,40,"294,8"
18/11/25,My Baker,Croissant,40,"294,8"
02/12/25,My Baker,Croissant,40,"294,8"
15/12/25,My Baker,Croissant,40,"294,8"
15/12/25,My Baker,Pão,10,"98,6"
19/12/25,My Baker,Croissant,20,"147,4"
05/01/26,My Baker,Croissant,40,"294,8"
13/01/26,My Baker,Pão,10,"98,6"
20/01/26,My Baker,Croissant,40,"294,8"
02/02/26,My Baker,Croissant,40,"294,8"
19/02/26,My Baker,Croissant,20,"147,4"
26/02/26,My Baker,Pão,5,"49,3"
26/02/26,My Baker,Croissant,40,"294,8"
06/04/26,My Baker,Pão,10,"98,6"
06/04/26,My Baker,Croissant,40,"294,8"
20/04/26,My Baker,Croissant,40,"294,8"
20/04/26,My Baker,Pão,5,"49,3"
27/05/26,My Baker,Croissant,40,"294,8"
27/05/26,My Baker,Pão,5,"49,3"
09/10/25,Bottega,Torta Bottega,45,360
23/10/25,Bottega,Torta Bottega,30,240
30/10/25,Bottega,Torta Bottega,40,320
06/11/25,Bottega,Torta Bottega,45,360
13/11/25,Bottega,Torta Bottega,60,480
18/11/25,Bottega,Torta Bottega,60,480
02/12/25,Bottega,Torta Bottega,20,160
15/12/25,Bottega,Torta Bottega,35,280
19/12/25,Bottega,Torta Bottega,60,480
02/01/26,Bottega,Torta Bottega,30,240
13/01/26,Bottega,Torta Bottega,70,560
02/02/26,Bottega,Torta Bottega,30,240
18/02/26,Bottega,Torta Bottega,31,248
23/03/26,Bottega,Torta Bottega,50,400
13/04/26,Bottega,Torta Bottega,50,400
28/04/26,Bottega,Carne suculenta,10,56
12/05/26,Bottega,Torta Bottega,50,400
12/05/26,Bottega,Carne suculenta,5,28
21/05/26,Bottega,Carne suculenta,10,56`;

const MONTH_MAP: Record<string, string> = {
  'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
  'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
  'jan.': '01', 'fev.': '02', 'mar.': '03', 'abr.': '04', 'mai.': '05', 'jun.': '06',
  'jul.': '07', 'ago.': '08', 'set.': '09', 'out.': '10', 'nov.': '11', 'dez.': '12',
  'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06',
  'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
};

const normalizeDayDate = (raw: string): string => {
  if (!raw) return '';
  const pts = raw.split(/[/ -]/).filter(p => p.length > 0);
  if (pts.length >= 2) {
    if (pts[0].length === 4) {
      const y = pts[0];
      const mOriginal = pts[1];
      const mClean = mOriginal.toLowerCase().trim().replace('.', '');
      const m = (MONTH_MAP[mClean] || mOriginal).padStart(2, '0');
      const d = (pts[2] || '01').padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
    let d = pts[0].padStart(2, '0');
    const mOriginal = pts[1];
    const mClean = mOriginal.toLowerCase().trim().replace('.', '');
    let m = (MONTH_MAP[mClean] || mOriginal).padStart(2, '0');
    let y = pts[2] || new Date().getFullYear().toString();
    if (y.length === 2) y = '20' + y;
    return `${d}/${m}/${y}`;
  }
  return raw;
};

const normalizeMonth = (val: string): string => {
  const raw = val.toLowerCase().trim();
  if (!raw) return '';
  if (/^\d{2}\/\d{4}$/.test(raw)) return raw;

  const separators = ['/', '-', '.', ' '];
  let pts: string[] = [raw];
  for (const sep of separators) {
    if (raw.includes(sep)) {
      pts = raw.split(sep).map(p => p.trim()).filter(p => p !== '');
      if (pts.length >= 2) break;
    }
  }

  let m = '', y = '';
  const findMonthNum = (s: string) => {
    const cleanS = s.replace('.', '').substring(0, 3).toLowerCase();
    return MONTH_MAP[cleanS] || (Number(s) <= 12 ? s.padStart(2, '0') : null);
  };

  if (pts.length >= 2) {
    pts.forEach(p => {
      if (p.length === 4 && !isNaN(Number(p))) y = p;
    });
    pts.forEach(p => {
      const mn = findMonthNum(p);
      if (mn && p !== y) m = mn;
    });
    if (!m || !y) {
      if (pts.length === 3) {
        if (!y) y = pts[2].length === 4 ? pts[2] : (pts[0].length === 4 ? pts[0] : '');
        if (!m) m = pts[1].padStart(2, '0');
      } else if (pts.length === 2) {
        if (!y) y = pts[1].length === 4 ? pts[1] : (pts[0].length === 4 ? pts[0] : '');
        if (!m) m = (y === pts[1] ? pts[0] : pts[1]).padStart(2, '0');
      }
    }
  }
  
  if (y.length === 2) y = '20' + y;
  return m && y ? `${m}/${y}` : '';
};

const parseCSVAmount = (val: string): number => {
  if (!val) return 0;
  let clean = val.replace(/R\$/g, '').trim().replace(/[^\d,.-]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  return parseFloat(clean) || 0;
};

const sanitize = (val: any) => String(val || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_').substring(0, 50);

const generateDeterministicId = (item: any, type: string) => {
  const seqStr = item.seq ? `_seq_${item.seq}` : '';
  if (type === 'purchases') {
    return `purchase_${sanitize(normalizeDayDate(item.data))}_${sanitize(item.fornecedor)}_${sanitize(item.produto)}_${item.quantidade}_${Math.round((item.total || 0) * 100)}${seqStr}`;
  }
  return '';
};

async function runImport() {
  console.log('Signing in anonymously...');
  await signInAnonymously(auth);
  console.log('Auth successful.');

  const lines = csvData.split('\n').filter(line => line.trim() !== '');
  const items: any[] = [];
  
  console.log(`Parsing ${lines.length - 1} csv rows...`);

  // Simple CSV parser supporting quotes
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = [];
    let currentPart = '';
    let inQuotes = false;
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        parts.push(currentPart);
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart);

    const [rawDate, supplier, item, rawQty, rawTotal] = parts;
    if (!item || !rawTotal) continue;

    const finalDate = normalizeDayDate(rawDate);
    const mes = normalizeMonth(rawDate);
    const fornecedor = supplier ? supplier.trim() : 'Sem Fornecedor';
    const produto = item.trim();
    const quantidade = parseCSVAmount(rawQty);
    const total = parseCSVAmount(rawTotal);
    const custoUnitario = quantidade > 0 ? (total / quantidade) : 0;

    items.push({
      data: finalDate,
      mes,
      produto,
      quantidade,
      custoUnitario,
      total,
      fornecedor,
    });
  }

  // Deduplicate / compute sequence sequence numbers
  const occurrences: Record<string, number> = {};
  const processedItems = items.map(item => {
    const key = `${item.data}_${item.fornecedor}_${item.produto}_${item.quantidade}_${item.total}`.toLowerCase().trim();
    occurrences[key] = (occurrences[key] || 0) + 1;
    return {
      ...item,
      seq: occurrences[key],
    };
  });

  const batch = writeBatch(db);
  const path = 'users/shared_franquia_data/purchases';

  console.log(`Writing batch to Firebase at collection: ${path}...`);
  processedItems.forEach(item => {
    const id = generateDeterministicId(item, 'purchases');
    const docRef = doc(db, path, id);
    const dataToSave = {
      ...item,
      userId: 'shared_franquia_data',
    };
    batch.set(docRef, dataToSave);
  });

  // Also log the action inside systemLogs
  const logRef = doc(collection(db, 'users/shared_franquia_data/systemLogs'));
  const logData = {
    data: new Date().toISOString().split('T')[0],
    usuario: 'sistema@franquia.com.br',
    acao: 'Upload CSV',
    tipo: 'Compra Manual/Estoque',
    descricao: `Importação automática via terminal de ${processedItems.length} compras de fornecedores (My Baker, Bottega).`,
    detalhesRef: { rowCount: processedItems.length },
    userId: 'shared_franquia_data',
    createdAt: new Date().toISOString()
  };
  batch.set(logRef, logData);

  await batch.commit();
  console.log(`Successfully uploaded ${processedItems.length} purchase records to Firebase and logged systemic action!`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Failed to import purchases:', err);
  process.exit(1);
});
