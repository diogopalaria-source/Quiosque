import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const csvData = `DATA,Funcionário,Produto,Valor Cheio,Desconto
22/05/2026,Alexandre,coca cola 350ml,"R$ 10,00",50%
22/05/2026,Keila,chocolate cremoso grande,"R$ 18,00",30%
22/05/2026,Keila,cinnamon tradicional,"R$ 27,00",50%
23/05/2026,Ariane,6 paes de queijo,"R$ 18,00",50%
23/05/2026,Ariane,yuba,"R$ 18,00",50%
23/05/2026,Ariane,CHOCOLATE QUENTE GRANDE,"R$ 14,00",50%
23/05/2026,Keila,2x cookie branco,"R$ 37,80",50%
23/05/2026,Keila,2 x yuba,"R$ 36,00",50%
23/05/2026,Keila,suco lata,"R$ 9,00",50%
23/05/2026,Keila,suco natural,"R$ 14,00",30%
23/05/2026,Keila,yuba,"R$ 18,00",50%
23/05/2026,Keila,cookie triplo,"R$ 18,90",50%
24/05/2026,Barbara,Pão na chapa,"R$ 10,00",30%
24/05/2026,Alexandre,KIT Lanche - pao de queijo c 3 + Chocolate,0,"0,00%"
24/05/2026,Alexandre,Coca cola 350ml,"R$ 10,00",50%
24/05/2026,Alexandre,guarana zero 350 ml,"R$ 10,00",50%
24/05/2026,Breno,KIT Lanche – Pão na chapa + Chocolate,0,"0,00%"
25/05/2026,Keila,cookie triplo,"R$ 18,90",50%
25/05/2026,Keila,2 x yuba,"R$ 36,00",50%
25/05/2026,Keila,Torta de frango,"R$ 18,00",30%
25/05/2026,Keila,suco lata,"R$ 9,00",50%
25/05/2026,Keila,cookie red velvet,"R$ 21,90",50%
25/05/2026,Keila,2 x torta de frango,"R$ 36,00",30%
26/05/2026,Breno,Torta mista,"R$ 18,00",30%
26/05/2026,Breno,Coca cola 350ml,"R$ 10,00",50%
26/05/2026,Ariane,mud frape,"R$ 28,00",50%
27/05/2026,Keila,suco lata,"R$ 9,00",50%
27/05/2026,Keila,triplo,"R$ 18,90",50%
27/05/2026,Ariane,SUCO LATA,"R$ 9,00",50%
27/05/2026,Alexandre,6 PAES DE QUEIJO,"R$ 18,00",50%
27/05/2026,Alexandre,6 paes de queijo,"R$ 18,00",50%
28/05/2026,Keila,2 yuba,"R$ 36,00",50%
28/05/2026,Keila,suco lata,"R$ 9,00",50%
28/05/2026,Keila,triplo,"R$ 18,90",50%
28/05/2026,Ariane,my way,"R$ 27,00",50%
28/05/2026,Keila,Yuba,"R$ 18,00",50%
29/05/2026,Keila,Yuba,"R$ 18,00",50%
29/05/2026,Keila,Cookie triplo,"R$ 18,90",50%
29/05/2026,Barbara,H2O Limoneto,"R$ 10,00",50%
29/05/2026,Alexandre,yuba,"R$ 18,00",50%
29/05/2026,Alexandre,6 paes de queijo,"R$ 18,00",50%
29/05/2026,Alexandre,2X suco lata,"R$ 18,00",50%
30/05/2026,Keila,cookie red velvet,"R$ 21,90",50%
30/05/2026,Keila,2x yuba,"R$ 36,00",50%
30/05/2026,Keila,coxinha de frango,"R$ 16,00",30%
30/05/2026,Keila,suco lata,"R$ 9,00",50%
30/05/2026,Alexandre,panqueca de 2 unidades,"R$ 20,90",50%
30/05/2026,Alexandre,Suco lata,"R$ 9,00",50%
30/05/2026,Barbara,cookie duplo,"R$ 18,90",50%
31/05/2026,Keila,KIT Lanche - pao de queijo c 3 + Chocolate,"R$ 0,00",0%
31/05/2026,Alexandre,KIT Lanche - pao de queijo c 3 + Chocolate,"R$ 0,00",0%
31/05/2026,Ariane,KIT Lanche - pao com requeijão+ Chocolate,"R$ 0,00",0%
31/05/2026,Ariane,OVOS CREMOSOS,"R$ 12,00",30%
31/05/2026,Alexandre,Cookie tradicional,"R$ 18,90",50%`;

function cleanValue(val: string): string {
  return val.replace(/^["']|["']$/g, '').trim();
}

function parseBrazilianNumber(val: string): number {
  const clean = val.replace(/[^\d,.-]/g, '').trim(); // leaves digits, commas, dots, minuses
  if (!clean) return 0;
  // If it's a Brazilian currency format like "17,50" or "50,00"
  if (clean.includes(',') && !clean.includes('.')) {
    return parseFloat(clean.replace(',', '.')) || 0;
  }
  // If contains both like "1.234,56", replace dot with empty and comma with dot
  if (clean.includes(',') && clean.includes('.')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(clean) || 0;
}

async function incrementData() {
  const lines = csvData.split('\n').filter(line => line.trim() !== '');
  console.log(`Starting incremental import of ${lines.length - 1} records...`);

  let successCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle quoted values with commas
    const parts: string[] = [];
    let currentPart = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(currentPart);
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart);

    // Columns mapping:
    // 0: DATA
    // 1: Funcionário
    // 2: Produto
    // 3: Valor Cheio
    // 4: Desconto
    const [rawDate, rawFuncionario, rawProduto, rawValueOriginal, rawDiscount] = parts;

    // Skip header
    if (rawDate.toLowerCase().includes('data')) {
      continue;
    }

    // 1. Format date "DD/MM/YYYY" -> "YYYY-MM-DD"
    const dateParts = cleanValue(rawDate || '').split('/');
    if (dateParts.length !== 3) {
      console.warn(`[Line ${i + 1}] Skip invalid date format: ${rawDate}`);
      continue;
    }
    const dataFormatted = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    const mesFormatted = `${dateParts[1]}/${dateParts[2]}`;

    // 2. Trim string values
    const funcionario = cleanValue(rawFuncionario || '');
    const produto = cleanValue(rawProduto || '');

    // 3. Compute numeric values
    const valorCheio = parseBrazilianNumber(cleanValue(rawValueOriginal || ''));
    
    // Discount percentage (e.g. 50%)
    let descontoPercent = 0;
    const discountStr = cleanValue(rawDiscount || '');
    descontoPercent = parseBrazilianNumber(discountStr);

    // Valor Pago
    let valorPago = valorCheio * (1 - descontoPercent / 100);
    // Round to 2 decimals nicely
    valorPago = Math.round(valorPago * 100) / 100;

    // 4. Determine quantity
    let quantidade = 1;
    const prodLower = produto.toLowerCase();
    const qtyMatch = prodLower.match(/^(\d+)\s*x\s+/);
    if (qtyMatch) {
      quantidade = parseInt(qtyMatch[1], 10) || 1;
    } else {
      // Support patterns like "2 yuba"
      const simpleQtyMatch = prodLower.match(/^(\d+)\s+(yuba|cookie|suco|torta|brownie|coca|chocolate|cinnamon)/);
      if (simpleQtyMatch) {
        quantidade = parseInt(simpleQtyMatch[1], 10) || 1;
      } else {
        const endsWithQtyMatch = prodLower.match(/\s+(\d+)$/);
        if (endsWithQtyMatch && !prodLower.includes('+') && !prodLower.includes('capsula') && !prodLower.includes('ml')) {
          quantidade = parseInt(endsWithQtyMatch[1], 10) || 1;
        }
      }
    }

    const record = {
      data: dataFormatted,
      mes: mesFormatted,
      funcionario: funcionario,
      produto: produto,
      quantidade: quantidade,
      valorCheio: valorCheio,
      descontoPercent: descontoPercent,
      valorPago: valorPago,
      status: 'pendente',
      userId: 'shared_franquia_data',
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, `users/shared_franquia_data/staffConsumption`), record);
      console.log(`[Inserted] ${dataFormatted} | ${funcionario} | ${produto} | Qtd: ${quantidade} | Cheio: R$ ${valorCheio.toFixed(2)} | Desconto: ${descontoPercent}% | Pago: R$ ${valorPago.toFixed(2)}`);
      successCount++;
    } catch (err: any) {
      console.error(`Error inserting line ${i + 1}:`, err);
    }
  }

  console.log(`Incremental import complete. Imported ${successCount} records.`);
  process.exit(0);
}

incrementData();
