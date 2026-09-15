import { collection, addDoc, serverTimestamp, getDocs, writeBatch, doc } from 'firebase/firestore';
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

/**
 * High-performance automatic purge for logs older than `keepDays` (default: 10 days).
 * Uses batch operations (up to 400 deletes per commit) to complete in 1-2 seconds
 * even if thousands of logs exist, without blocking the UI.
 */
export async function autoPurgeOldLogs(keepDays: number = 10): Promise<{ deleted: number; remaining: number }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const logsRef = collection(db, 'users/shared_franquia_data/systemLogs');
    const snapshot = await getDocs(logsRef);
    
    const docsToDelete: string[] = [];
    let remaining = 0;

    snapshot.docs.forEach((d) => {
      const data = d.data();
      const logDate = data.data;
      if (logDate && logDate < cutoffDateStr) {
        docsToDelete.push(d.id);
      } else {
        remaining++;
      }
    });

    if (docsToDelete.length === 0) {
      console.log(`[AutoPurgeLogs] Todos os logs estão em conformidade (últimos ${keepDays} dias). Total mantido: ${remaining}`);
      return { deleted: 0, remaining };
    }

    console.log(`[AutoPurgeLogs] Expurgando ${docsToDelete.length} logs antigos (> ${keepDays} dias)...`);
    let deleted = 0;
    const batchSize = 400;

    for (let i = 0; i < docsToDelete.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = docsToDelete.slice(i, i + batchSize);
      chunk.forEach((id) => {
        batch.delete(doc(db, 'users/shared_franquia_data/systemLogs', id));
      });
      await batch.commit();
      deleted += chunk.length;
    }

    console.log(`[AutoPurgeLogs] Expurgo concluído com sucesso! ${deleted} logs deletados em lote. Restantes: ${remaining}`);
    return { deleted, remaining };
  } catch (err) {
    console.error('[AutoPurgeLogs] Erro durante o expurgo automático de logs:', err);
    return { deleted: 0, remaining: 0 };
  }
}

