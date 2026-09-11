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

const csvData = `Nome;Quantidade;Vendas
"espresso origens pequeno";543;5.430,00
"cookie chocolate chips";151;2.931,90
"cookie triple chocolate";151;2.877,90
"cookie chocolate chips with m&ms";132;2.626,80
"café latte pequeno";203;2.436,00
"novo cinnamon roll tradicional";86;2.361,50
"cookie double chocolate";105;1.996,50
"caixa 4 cookies";29;1.924,20
"white chocolate";91;1.755,90
"caixa 7 cookies";12;1.684,80
"água sem gás";231;1.673,00
"cookie my way";57;1.554,00
"cookie chocolate chips com macadâmia";80;1.518,00
"cookie red velvet";68;1.514,70
"croissant caprese";28;1.092,00
"cookie doce de leite";45;1.031,40
"cappuccino tradicional";63;1.008,00
"café latte grande";63;1.008,00
"pão de queijo (6 unidades)";53;984,00
"pão de queijo (3 unidades)";82;924,00
"brownie cookie";46;887,40
cheesecake;30;840,00
"espresso origens grande";54;810,00
"suco natural";52;728,00
"bolo caseiro";40;632,00
"croissant presunto e queijo";25;629,90
"água com gás";73;600,00
"cookie avelã crunchy";21;597,00
"croissant tradicional";27;567,00
"tortas da bottega";29;522,00
"cookie sandwich g";12;518,10
"refrigerante 350ml";51;510,00
"caixinha especial: compre 4 (-15%)";6;507,60
"caixinha especial: compre 4 cookies (-15%)";6;507,60
"chá twinnigs";49;490,00
"brownie chocolate";17;489,80
clássico;32;448,00
"espresso macchiato pequeno";40;440,00
"pancakes 2 unidades";21;438,90
"1 cookie + cafe ou chocolate";19;416,10
"coxinha de batata doce com frango";24;397,00
"pão com carne suculenta";9;333,00
"2 estrelas - cookie + 1 expresso origens";16;308,40
"pão com ovo";11;308,00
"cookie bomb";11;307,00
"loj1 - café + 3 pães de queijo";19;304,00
"novo cinnamon roll especial";9;297,10
"cappuccino dos chocólatras";16;291,00
"esfiha de queijo";22;270,50
"cookie ice mountain";9;252,00
"pão na chapa";25;250,00
"caixa 12 cookies";1;249,00
"chocolate quente pequeno";19;228,00
"cookie pistache";8;221,00
"cookie dark";8;221,00
"esfiha de carne";18;216,00
"refrigerante 220ml";26;208,00
"coxinha vegana de batata doce com jaca";11;192,50
descafeinado;12;192,00
"loj2 - café + cookie clássico";8;151,20
moccha;8;144,00
"chocolate cremoso pequeno";9;135,00
"espresso macchiato grande";9;135,00
"pão de queijo (3 unid) + café";8;128,00
"3 estrelas - croissant recheado + suco natural com água";4;128,00
"chocolate cremoso grande";7;126,00
"cookie ovomaltine";4;123,00
"café mr cheney moído- 250 g";2;116,20
"cookie day after";12;113,40
"cookie with fruits + nutella";4;108,00
"suco lata (290ml)";12;108,00
"chocolate quente grande";7;98,00
"loj6 - café + pão na chapa";6;95,40
"cookie my way - day after";7;94,50
"apple cobbler";3;90,90
"novo cinnamon roll clássico";3;87,60
"loj8 - suco + yuba";3;81,00
"creme de mandioquinha";2;79,80
"loj3 - café + croissant tradicional";3;72,00
"espresso com panna pequeno";6;72,00
"chocolate quente com chantilly grande";4;68,00
"loj4 - suco + croissant de presunto e queijo";2;66,00
"crie seu milk shake";2;66,00
"suco detox";4;64,00
"pão de queijo com batata doce e grãos";4;64,00
"cookie shake";2;64,00
"espresso com panna grande";4;64,00
"pastel assado";3;57,00
"cookie brigadeirão";2;54,00
"delícia detox";3;54,00
cappucheney;3;54,00
"soda americana";3;51,00
"pão na chapa com requeijão";3;51,00
"croissant bomb";2;50,00
"delícia de abacaxi";3;48,00
"pancakes 3 unidades";2;48,00
"leitinho da casa";3;42,00
yuba;2;36,00
"quichê de alho poró";2;36,00
"waffle de queijo mr. cheney";3;36,00
"suco natural com leite";2;32,00
"ovos orgânicos cremosos";2;24,00
"ice cappuccino";1;21,50
"chantilly 15 g";4;20,00
"smoothie de fruta";1;19,00
"chocolate gelado";1;11,00
"porção de sorvete 80 g";1;8,50
"leite integral 300ml";1;5,50
"geleia (amora e morango) 30 g";1;4,50`;

function cleanValue(val: string): string {
  return val.replace(/^["']|["']$/g, '').trim();
}

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
  if (type === 'sales') {
    return `sale_${sanitize(item.mes)}_${sanitize(item.nome)}_${item.quantidade}_${Math.round((item.vendas || 0) * 100)}${seqStr}`;
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

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(';');

    if (parts.length < 3) continue;

    const rawNome = parts[0];
    const rawQty = parts[1];
    const rawVendas = parts[2];

    const nome = cleanValue(rawNome);
    const quantidade = parseCSVAmount(rawQty);
    const vendas = parseCSVAmount(rawVendas);

    if (!nome || quantidade <= 0) continue;

    items.push({
      mes: '07/2026',
      data: '01/07/2026',
      nome: nome,
      produto: nome,
      quantidade: quantidade,
      vendas: vendas,
      total: vendas,
      precoUnitario: quantidade > 0 ? (vendas / quantidade) : 0,
      categoria: 'Mr. Cheney',
    });
  }

  // Deduplicate / compute sequence numbers
  const occurrences: Record<string, number> = {};
  const processedItems = items.map(item => {
    const key = `${item.mes}_${item.data}_${item.nome}_${item.quantidade}_${item.vendas}`.toLowerCase().trim();
    occurrences[key] = (occurrences[key] || 0) + 1;
    return {
      ...item,
      seq: occurrences[key],
    };
  });

  const pathOfSales = 'users/shared_franquia_data/sales';

  // Firestore writeBatch has a limit of 500 ops per batch
  const batchSize = 400;
  console.log(`Writing ${processedItems.length} items to Firebase collection: ${pathOfSales}...`);

  for (let i = 0; i < processedItems.length; i += batchSize) {
    const chunk = processedItems.slice(i, i + batchSize);
    const batch = writeBatch(db);

    chunk.forEach(item => {
      const id = generateDeterministicId(item, 'sales');
      const docRef = doc(db, pathOfSales, id);
      const dataToSave = {
        ...item,
        userId: 'shared_franquia_data',
      };
      batch.set(docRef, dataToSave);
    });

    if (i === 0) {
      // Log the action inside systemLogs on first batch
      const logRef = doc(collection(db, 'users/shared_franquia_data/systemLogs'));
      const logData = {
        data: new Date().toISOString().split('T')[0],
        usuario: 'sistema@franquia.com.br',
        acao: 'Upload CSV',
        tipo: 'Faturamento',
        descricao: `Importação automática via terminal de ${processedItems.length} vendas de produtos para o mês de Julho/2026.`,
        detalhesRef: { rowCount: processedItems.length },
        userId: 'shared_franquia_data',
        createdAt: new Date().toISOString()
      };
      batch.set(logRef, logData);
    }

    await batch.commit();
    console.log(`Batch ${Math.floor(i / batchSize) + 1} committed (${chunk.length} items).`);
  }

  console.log(`Successfully uploaded all ${processedItems.length} sales records for July/2026 to Firebase!`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Failed to import sales:', err);
  process.exit(1);
});
