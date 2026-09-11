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
"espresso origens pequeno";659;6.590,00
"novo cinnamon roll tradicional";118;3.297,90
"cookie chocolate chips";166;3.227,40
"cookie triple chocolate";156;3.052,95
"cookie chocolate chips with m&ms";146;2.917,60
"café latte pequeno";219;2.628,00
"cookie double chocolate";124;2.373,60
"caixa 4 cookies";34;2.210,00
"caixa 7 cookies";16;2.194,40
"água sem gás";284;1.988,00
"cappuccino tradicional";97;1.552,00
"white chocolate";78;1.528,20
"cookie chocolate chips com macadâmia";76;1.472,40
"croissant caprese";37;1.443,00
"cookie my way";51;1.437,00
"cookie doce de leite";52;1.169,40
"café latte grande";71;1.136,00
"tortas da bottega";59;1.062,00
"caixinha especial: compre 4 (-15%)";12;1.021,20
"água com gás";123;984,00
"espresso origens grande";60;900,00
"bolo caseiro";60;900,00
"brownie cookie";43;860,70
"cookie red velvet";38;857,70
"pão de queijo (6 unidades)";45;810,00
"pão de queijo (3 unidades)";73;803,00
"croissant tradicional";38;798,00
"novo cinnamon roll especial";23;781,70
"brownie chocolate";26;734,90
cheesecake;26;728,00
"suco natural";52;728,00
"1 cookie + cafe ou chocolate";31;678,90
"croissant presunto e queijo";27;675,00
"pão com carne suculenta";18;666,00
"refrigerante 350ml";62;620,00
"pancakes 2 unidades";28;585,20
"coxinha de batata doce com frango";36;576,00
"cookie avelã crunchy";20;550,00
"cappuccino dos chocólatras";29;522,00
"cookie sandwich g";12;504,30
"chá twinnigs";49;490,00
"pão com ovo";17;476,00
clássico;34;476,00
"loj1 - café + 3 pães de queijo";29;464,00
"2 estrelas - cookie + 1 expresso origens";24;462,60
"pão de queijo (3 unid) + café";28;448,00
"refrigerante 220ml";55;440,00
"loj4 - suco + croissant de presunto e queijo";12;396,00
"espresso macchiato pequeno";34;374,00
"esfiha de queijo";29;354,50
"cookie ovomaltine";12;344,00
"esfiha de carne";27;324,00
"cookie pistache";11;312,00
"cookie dark";11;302,00
"cookie day after";30;301,50
"cookie bomb";10;295,00
"apple cobbler";10;293,80
"loj2 - café + cookie clássico";15;283,50
"pão na chapa";28;280,00
"chocolate quente pequeno";22;264,00
descafeinado;15;240,00
"pancakes 3 unidades";10;240,00
"chocolate quente grande";16;224,00
"milk shake";7;217,00
"loj6 - café + pão na chapa";13;206,70
"cookie ice mountain";7;196,00
"cookie my way - day after";13;175,50
"chocolate cremoso grande";9;162,00
"cookie with fruits + nutella";6;162,00
"pão na chapa com requeijão";9;153,00
"novo cinnamon roll clássico";5;146,00
"cookie pao de mel";5;135,00
"ice cappuccino";6;129,00
yuba;7;126,00
"chocolate cremoso pequeno";8;120,00
"café mr cheney moído- 250 g";2;116,20
"coxinha vegana de batata doce com jaca";6;102,00
"leitinho da casa";7;98,00
"espresso macchiato grande";6;90,00
"pão de queijo com batata doce e grãos";6;88,00
"soda americana";5;85,00
"chocolate quente com chantilly grande";5;85,00
"mud frappe";3;84,00
"cookie brigadeirão";3;81,00
"pastel assado";4;76,00
"espresso com panna pequeno";6;72,00
moccha;4;72,00
"quichê de alho poró";4;72,00
"chocolate quente com chantilly pequeno";5;70,00
"chocolate gelado";6;66,00
"espresso com panna grande";4;64,00
"suco lata (290ml)";7;63,00
"cookie cenoura com chocolate";2;54,00
"waffle de queijo mr. cheney";4;48,00
"loj3 - café + croissant tradicional";2;48,00
"delícia detox";2;36,00
"cookie shake";1;32,00
"suco natural com leite";2;32,00
croissants;1;24,00
"pão de queijo gouda";1;23,00
"refrigerante coca cola lata 350ml";2;22,00
"loj7 - café + pão com requeijão";1;21,00
"suco detox";1;16,00
"delícia de abacaxi";1;16,00
"chantilly 15 g";2;10,00
"refrigerante zero coca cola 220ml";1;9,50
"geleia (amora e morango) 30 g";2;9,00
nutella;1;9,00
"creme de avela nutella 45 g";1;7,90`;

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

  // CSV has semicolon as separator
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
      mes: '05/2026',
      data: '01/05/2026',
      nome: nome,
      produto: nome,
      quantidade: quantidade,
      vendas: vendas,
      total: vendas,
      precoUnitario: quantidade > 0 ? (vendas / quantidade) : 0,
      categoria: 'Mr. Cheney',
    });
  }

  // Deduplicate / compute sequence sequence numbers
  const occurrences: Record<string, number> = {};
  const processedItems = items.map(item => {
    const key = `${item.mes}_${item.data}_${item.nome}_${item.quantidade}_${item.vendas}`.toLowerCase().trim();
    occurrences[key] = (occurrences[key] || 0) + 1;
    return {
      ...item,
      seq: occurrences[key],
    };
  });

  const batch = writeBatch(db);
  const pathOfSales = 'users/shared_franquia_data/sales';

  console.log(`Writing batch to Firebase at collection: ${pathOfSales}...`);
  processedItems.forEach(item => {
    const id = generateDeterministicId(item, 'sales');
    const docRef = doc(db, pathOfSales, id);
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
    tipo: 'Faturamento',
    descricao: `Importação automática via terminal de ${processedItems.length} vendas de produtos para o mês de maio/2026.`,
    detalhesRef: { rowCount: processedItems.length },
    userId: 'shared_franquia_data',
    createdAt: new Date().toISOString()
  };
  batch.set(logRef, logData);

  await batch.commit();
  console.log(`Successfully uploaded ${processedItems.length} sales records to Firebase and logged systemic action!`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Failed to import sales:', err);
  process.exit(1);
});
