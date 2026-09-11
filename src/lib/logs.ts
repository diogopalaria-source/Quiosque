import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface SystemLog {
  id?: string;
  data: string; // ISO date format 'YYYY-MM-DD' for date filtering
  timestamp: any;
  usuario: string; // User email
  acao: 'Criação' | 'Edição' | 'Exclusão' | 'Upload CSV';
  tipo: string; // 'Descarte' | 'Consumo Equipe' | 'Pagamento Equipe' | 'Pedido Compra' | 'Ficha Técnica' | 'Manual' | 'Ajuste Estoque' | 'Upload CSV'
  descricao: string;
  detalhesRef: {
    collection: string; // e.g. 'wasteRecords', 'staffConsumption', 'staffPayments', 'purchaseRequests', 'recipes', 'purchases'
    docId: string;
    payload: any;
  };
}

export async function logAction(
  acao: 'Criação' | 'Edição' | 'Exclusão' | 'Upload CSV',
  tipo: string,
  descricao: string,
  collectionName: string,
  docId: string,
  payload: any,
  overrideUser?: string
) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    let userEmail = overrideUser;
    
    if (!userEmail) {
      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.isAnonymous && currentUser.email) {
        const email = currentUser.email.toLowerCase();
        if (
          email === 'diogopalaria@gmail.com' || 
          email === 'gisele.palaria@gmail.com' ||
          email === 'diogo@cheney.com.br' ||
          email === 'diogopalaria@hotmail.com'
        ) {
          userEmail = currentUser.email;
        } else {
          userEmail = 'Operador';
        }
      } else {
        userEmail = 'Operador';
      }
    }
    
    const logRecord: Omit<SystemLog, 'id'> = {
      data: todayStr,
      timestamp: serverTimestamp(),
      usuario: userEmail,
      acao,
      tipo,
      descricao,
      detalhesRef: {
        collection: collectionName,
        docId: docId || '',
        payload: payload || {}
      }
    };
    
    await addDoc(collection(db, 'users/shared_franquia_data/systemLogs'), logRecord);
    console.log(`[SystemLog] Logged action: ${acao} for ${tipo} success.`);
  } catch (err) {
    console.error('[SystemLog] Erro ao salvar log do sistema: ', err);
  }
}
