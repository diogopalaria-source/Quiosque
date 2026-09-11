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

const csvData = `Fornecedor,Produto,Quantidade,Data,Valor total
Pode Comer,COXINHA DE BATATA DOCE COM FRANGO,"18,0000",24/4/2026,"99,0000"
Pode Comer,ESFIRRA DE CARNE,"18,0000",24/4/2026,"82,5000"
Pode Comer,ESFIRRA DE QUEIJO,"18,0000",29/4/2026,"99,0000"
Pode Comer,PASTEL DE ABOBORA COM FRANGO,"6,0000",29/4/2026,"42,9000"
Pode Comer,COXINHA DE BATATA DOCE COM FRANGO,"12,0000",8/5/2026,"66,0000"
Pode Comer,ESFIRRA DE CARNE,"6,0000",8/5/2026,"27,5000"
Pode Comer,ESFIRRA DE QUEIJO,"6,0000",8/5/2026,"33,0000"
Pode Comer,PAO DE QUEIJO COM BATATA DOCE E GRAOS,"30,0000",8/5/2026,"46,2000"
Pode Comer,QUICHE DE ALHO PORO,"10,0000",8/5/2026,"62,0000"
Pode Comer,ESFIRRA DE CARNE,"18,0000",18/5/2026,"82,5000"
Pode Comer,COXINHA DE BATATA DOCE COM FRANGO,"18,0000",18/5/2026,"99,0000"
Pode Comer,ESFIRRA DE CARNE,"6,0000",22/5/2026,"27,5000"
Pode Comer,ESFIRRA DE QUEIJO,"18,0000",22/5/2026,"99,0000"
Pode Comer,COXINHA DE BATATA DOCE COM FRANGO,"6,0000",22/5/2026,"33,0000"
Pode Comer,COXINHA DE BATATA DOCE COM JACA,"6,0000",22/5/2026,"39,6000"
Pode Comer,ESFIRRA DE CARNE,"30,0000",12/1/2026,"137,5000"
Pode Comer,ESFIRRA DE QUEIJO,"30,0000",12/1/2026,"165,0000"
Pode Comer,COXINHA DE BATATA DOCE COM JACA,"6,0000",12/1/2026,"40,0000"
Pode Comer,COXINHA DE BATATA DOCE COM FRANGO,"6,0000",12/1/2026,"33,0000"
Pode Comer,COXINHA DE BATATA DOCE COM FRANGO,"12,0000",30/1/2026,"66,0000"
Pode Comer,COXINHA DE BATATA DOCE COM JACA,"6,0000",30/1/2026,"40,0000"
Pode Comer,PASTEL DE ABOBORA COM CARNE DE SOL,"6,0000",30/1/2026,"53,0000"
Pode Comer,PASTEL DE ABOBORA COM FRANGO,"6,0000",30/1/2026,"43,0000"
Pode Comer,ESFIRRA DE QUEIJO,"18,0000",20/2/2026,"99,0000"
Pode Comer,ESFIRRA DE CARNE,"12,0000",20/2/2026,"55,0000"
Pode Comer,COXINHA DE BATATA DOCE COM JACA,"12,0000",20/2/2026,"79,2000"
Pode Comer,COXINHA DE BATATA DOCE COM FRANGO,"6,0000",20/2/2026,"33,0000"
Pode Comer,PASTEL DE ABOBORA COM FRANGO,"6,0000",6/3/2026,"42,9000"
Pode Comer,ESFIRRA DE CARNE,"18,0000",6/3/2026,"82,5000"
Pode Comer,PASTEL DE ABOBORA COM CARNE DE SOL,"6,0000",6/3/2026,"52,8000"
Pode Comer,ESFIRRA DE QUEIJO,"6,0000",6/3/2026,"33,0000"
Pode Comer,ESFIRRA DE CARNE,"12,0000",13/3/2026,"55,0000"
Pode Comer,ESFIRRA DE QUEIJO,"12,0000",13/3/2026,"66,0000"
Pode Comer,COXINHA DE BATATA DOCE COM JACA,"6,0000",13/3/2026,"39,6000"
Pode Comer,COXINHA DE BATATA DOCE COM FRANGO,"6,0000",13/3/2026,"33,0000"
Pode Comer,COXINHA DE BATATA DOCE COM FRANGO,"12,0000",25/3/2026,"66,0000"
Pode Comer,PASTEL DE ABOBORA COM CARNE DE SOL,"6,0000",25/3/2026,"52,8000"
Pode Comer,PASTEL DE ABOBORA COM FRANGO,"6,0000",25/3/2026,"42,9000"
Pode Comer,PAO DE QUEIJO COM BATATA DOCE E GRAOS,"20,0000",25/3/2026,"30,8000"
Pode Comer,ESFIRRA DE QUEIJO,"18,0000",15/4/2026,"99,0000"
Pode Comer,PASTEL DE ABOBORA COM CARNE DE SOL,"6,0000",15/4/2026,"52,8000"`;

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

// Map raw product names to official macro-ingredients based on user guidelines
const mapProductToMacroIngredient = (productName: string): string => {
  const normalized = (productName || '').toLowerCase().trim();
  if (normalized.includes('coxinha') && normalized.includes('frango')) return 'Coxinha Frango';
  if (normalized.includes('coxinha') && normalized.includes('jaca')) return 'Coxinha Jaca';
  if (normalized.includes('esfirra') || normalized.includes('esfiha')) {
    if (normalized.includes('carne')) return 'Esfiha Carne';
    if (normalized.includes('queijo')) return 'Esfiha Queijo';
  }
  if (normalized.includes('pastel')) return 'Pastel Assado';
  if (normalized.includes('pão') || normalized.includes('pao')) {
    if (normalized.includes('queijo') && (normalized.includes('batata') || normalized.includes('graos') || normalized.includes('grãos'))) return 'Pão de queijo Batata Doce';
    if (normalized.includes('queijo') && normalized.includes('gouda')) return 'Pão de queijo Gouda';
  }
  if (normalized.includes('quiche')) return 'Quiche';
  
  return 'Outros unidade';
};

async function runImport() {
  console.log('Signing in anonymously to Firebase...');
  await signInAnonymously(auth);
  console.log('Authentication successful!');

  const lines = csvData.split('\n').filter(line => line.trim() !== '');
  const items: any[] = [];
  
  console.log(`Parsing ${lines.length - 1} rows from Pode Comer CSV...`);

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

    const [supplier, item, rawQty, rawDate, rawTotal] = parts;
    if (!item || !rawTotal) continue;

    const finalDate = normalizeDayDate(rawDate);
    const mes = normalizeMonth(rawDate);
    const fornecedor = supplier ? supplier.trim() : 'Pode Comer';
    const originalProduto = item.trim();
    // Resolve macro ingredient
    const produto = mapProductToMacroIngredient(originalProduto);
    const quantidade = parseCSVAmount(rawQty);
    const total = parseCSVAmount(rawTotal);
    const custoUnitario = quantidade > 0 ? (total / quantidade) : 0;

    items.push({
      data: finalDate,
      mes,
      produto, // Store direct macroingredient link in DB
      quantidade,
      custoUnitario,
      total,
      fornecedor,
      _originalProduto: originalProduto
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
  const pathPrefix = 'users/shared_franquia_data/purchases';

  console.log(`Writing batch to Firebase collections at ${pathPrefix}...`);
  processedItems.forEach(item => {
    const id = generateDeterministicId(item, 'purchases');
    const docRef = doc(db, pathPrefix, id);
    const { _originalProduto, ...dataToSave } = item;
    const itemData = {
      ...dataToSave,
      userId: 'shared_franquia_data',
    };
    batch.set(docRef, itemData);
  });

  // Log inside systemLogs
  const logRef = doc(collection(db, 'users/shared_franquia_data/systemLogs'));
  const logData = {
    data: new Date().toISOString().split('T')[0],
    usuario: 'sistema@franquia.com.br',
    acao: 'Upload CSV',
    tipo: 'Compra Manual/Estoque',
    descricao: `Importação automática de ${processedItems.length} compras do fornecedor Pode Comer direcionadas automaticamente aos macroingredientes correspondentes.`,
    detalhesRef: { rowCount: processedItems.length, fornecedor: 'Pode Comer' },
    userId: 'shared_franquia_data',
    createdAt: new Date().toISOString()
  };
  batch.set(logRef, logData);

  await batch.commit();
  console.log(`Successfully imported and mapped ${processedItems.length} records for Pode Comer!`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Failed to import Pode Comer purchases:', err);
  process.exit(1);
});
