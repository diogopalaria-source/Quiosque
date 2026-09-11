import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size limit to digest base64 documents safely
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini SDK with telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Helper function to call Gemini generateContent with exponential backoff retries for 503/429 errors
async function generateContentWithRetry(ai: any, params: any, maxRetries = 4, initialDelay = 1000) {
  let attempt = 0;
  while (true) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      attempt++;
      console.error(`[Gemini API] Attempt ${attempt} failed:`, error?.message || error);
      
      const errMsg = error?.message || "";
      const isRetryable = 
        error?.status === "UNAVAILABLE" || 
        error?.code === 503 ||
        errMsg.includes("503") ||
        errMsg.includes("UNAVAILABLE") ||
        errMsg.includes("high demand") ||
        errMsg.includes("service is unavailable") ||
        error?.status === "RESOURCE_EXHAUSTED" ||
        error?.code === 429 ||
        errMsg.includes("429") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("Quota exceeded") ||
        errMsg.includes("quota") ||
        errMsg.includes("overburdened") ||
        errMsg.includes("busy");

      if (isRetryable && attempt < maxRetries) {
        // On the final retry attempts, fallback to gemini-3.1-flash-lite to bypass high demand on gemini-3.5-flash
        if (attempt >= maxRetries - 2 && params.model === "gemini-3.5-flash") {
          console.log("[Gemini API] Falling back to model 'gemini-3.1-flash-lite' to mitigate high load issues on 'gemini-3.5-flash'.");
          params.model = "gemini-3.1-flash-lite";
        }
        
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.log(`[Gemini API] Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// API Endpoint to Parse Purchase Order (PDF or Image)
app.post("/api/parse-order", async (req, res) => {
  try {
    const { fileBase64, mimeType } = req.body;

    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Faltando arquivo base64 ou mimeType" });
    }

    const ai = getGeminiClient();
    
    // Call Gemini with the document and prompt using our retry helper
    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: fileBase64,
            mimeType: mimeType
          }
        },
        "Extraia os itens do pedido ou nota de compra com seus respectivos nomes de produtos, quantidades, valores unitários e valores totais em Reais (BRL). No início do documento, procure também pela data do pedido ou data de emissão; retorne esta data no formato YYYY-MM-DD na propriedade 'data' do objeto principal."
      ],
      config: {
        systemInstruction: "Você é um assistente especialista em analisar faturas, notas de compra e pedidos em PDF ou imagem. Identifique com precisão o nome do produto, a quantidade adquirida, o valor unitário e o valor total de cada item listado no documento. Além disso, localize a data do pedido ou data de emissão no início ou cabeçalho do documento e extraia-a no formato YYYY-MM-DD.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            data: {
              type: Type.STRING,
              description: "A data do pedido ou da nota fiscal/fatura encontrada no início ou cabeçalho do documento, formatada estritamente como YYYY-MM-DD. Caso não seja encontrada, retorne string vazia."
            },
            items: {
              type: Type.ARRAY,
              description: "Lista de itens encontrados no documento",
              items: {
                type: Type.OBJECT,
                properties: {
                  produto: { 
                    type: Type.STRING, 
                    description: "Nome do produto conforme aparece na fatura ou pedido" 
                  },
                  quantidade: { 
                    type: Type.NUMBER, 
                    description: "Quantidade física comprada ou encomendada" 
                  },
                  valorUnitario: { 
                    type: Type.NUMBER, 
                    description: "Preço cobrado por uma unidade única do item" 
                  },
                  valorTotal: { 
                    type: Type.NUMBER, 
                    description: "Preço total cobrado por todas as unidades deste item" 
                  }
                },
                required: ["produto", "quantidade", "valorUnitario", "valorTotal"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    const outputText = response.text || "{}";
    const parsedData = JSON.parse(outputText);
    
    res.json(parsedData);
  } catch (error: any) {
    console.error("Erro ao processar pedido com Gemini:", error);
    const errMsg = error?.message || "";
    if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota exceeded")) {
      return res.status(429).json({ 
        error: "Você atingiu o limite de cota diária gratuita do Gemini API (limite de 20 requisições). Aguarde cerca de 1 a 2 minutos ou utilize o botão 'Simular com o PDF Enviado' ao lado, que permite testar toda a conciliação gratuitamente sem gastar sua cota!" 
      });
    }
    if (errMsg.includes("high demand") || errMsg.includes("503") || errMsg.includes("UNAVAILABLE")) {
      return res.status(503).json({
        error: "O serviço de IA do Gemini está temporariamente sobrecarregado devido à alta demanda global (Erro 503). Por favor, aguarde alguns instantes e tente novamente, ou utilize o botão 'Simular com o PDF Enviado' ao lado para testar a conciliação instantaneamente sem depender do servidor!"
      });
    }
    res.status(500).json({ error: errMsg || "Erro ao processar documento com Gemini" });
  }
});

// Endpoint to retrieve active source code files for system backup
app.get("/api/codebase", (req, res) => {
  try {
    const listFiles = (dir: string, fileList: string[] = []): string[] => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          const baseName = path.basename(file);
          if (baseName !== "node_modules" && baseName !== "dist" && !baseName.startsWith(".") && baseName !== "coverage") {
            listFiles(filePath, fileList);
          }
        } else {
          fileList.push(filePath);
        }
      }
      return fileList;
    };

    const allFiles = listFiles(process.cwd());
    const codebase: Record<string, string> = {};

    for (const f of allFiles) {
      const relativePath = path.relative(process.cwd(), f);
      // Include source code and key configurations, skip binary/lock/media files
      const ext = path.extname(f).toLowerCase();
      if (
        ext === ".ts" ||
        ext === ".tsx" ||
        ext === ".json" ||
        ext === ".css" ||
        ext === ".html" ||
        ext === ".rules" ||
        ext === ".example" ||
        ext === ".js" ||
        ext === ".md"
      ) {
        if (
          !relativePath.startsWith("node_modules") &&
          !relativePath.startsWith("dist") &&
          !relativePath.startsWith(".") &&
          relativePath !== "package-lock.json"
        ) {
          codebase[relativePath] = fs.readFileSync(f, "utf-8");
        }
      }
    }

    res.json(codebase);
  } catch (error: any) {
    console.error("Erro ao obter código fonte:", error);
    res.status(500).json({ error: error?.message || "Erro no servidor" });
  }
});

// Helper to sequentially try multiple endpoint paths for resiliency
async function tryFetchEndpoints(endpoints: string[], token: string): Promise<{ data: any[], url: string, status: number, error?: string }> {
  let lastError = "";
  let lastStatus = 404;
  
  for (const url of endpoints) {
    try {
      console.log(`[Alfa Labs API] Tentando buscar em: ${url}`);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      lastStatus = res.status;
      if (res.ok) {
        const json: any = await res.json();
        const payload = Array.isArray(json) ? json : (json.data || json.results || []);
        if (Array.isArray(payload)) {
          console.log(`[Alfa Labs API] Sucesso! Obtido da URL: ${url}, registros: ${payload.length}`);
          return { data: payload, url, status: res.status };
        }
      } else {
        const text = await res.text();
        lastError = `Status ${res.status}: ${text.substring(0, 150)}`;
        console.warn(`[Alfa Labs API] Falhou URL ${url} -> ${lastError}`);
      }
    } catch (err: any) {
      lastError = err.message || "Erro de rede";
      console.warn(`[Alfa Labs API] Erro físico na URL ${url} -> ${lastError}`);
    }
  }
  return { data: [], url: endpoints[0], status: lastStatus, error: lastError || "Todos os caminhos de API reportaram indisponibilidade ou 404." };
}

// API Endpoint to Sync Alfa Labs sales by date and return JSON and CSV
app.post("/api/alfalabs/sync", async (req, res) => {
  try {
    const { token, filialId = 1, date, simulate = false } = req.body;

    // Yesterday date calculation as default (YYYY-MM-DD format)
    let targetDate = date;
    if (!targetDate) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      targetDate = d.toISOString().split("T")[0];
    }

    // MM/YYYY month format for data structure
    const [year, month] = targetDate.split("-");
    const targetMonthStr = `${month}/${year}`;

    let isSimulated = simulate;
    let filialNome = null;
    let productsRaw: any[] = [];
    let paymentsRaw: any[] = [];
    
    // Detailed traces of tried endpoints to return to Client
    let trace: any = {};
    let reportOrdersCount = 0;
    let reportTotalFaturamento = 0;
    let reportTotalVendas = 0;

    if (!simulate) {
      if (!token) {
        return res.status(400).json({ success: false, error: "É necessário informar o Token de Acesso para sincronização em produção." });
      }

      console.log(`[Alfa Labs Sync] Iniciando conexão de relatórios de Ontem (${targetDate}) para Filial: ${filialId}`);

      // 1. Fetch ranking faturamento report (reliable source of daily global faturamento and finalized order counts)
      const rankingEndpoints = [
        `https://app.alfalabs.com.br/api/v1/relatorios/ranking?pagina=1&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorios/ranking?start_date=${targetDate}&end_date=${targetDate}`
      ];

      // 2. Endpoints for "Formas de Pagamento" (Payment Methods Report with ontem filter)
      const paymentEndpoints = [
        `https://app.alfalabs.com.br/api/v1/relatorios/formas_pagamento?filial_id=${filialId}&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorios/formas-pagamento?filial_id=${filialId}&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorios/pagamentos?filial_id=${filialId}&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorios/faturamento?filial_id=${filialId}&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorio/formas_pagamento?filial_id=${filialId}&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorios/formas_pagamento?start_date=${targetDate}&end_date=${targetDate}`
      ];

      // 3. Endpoints for "Cardápio / Produtos" (Products Report under Cardapio with ontem filter)
      const productEndpoints = [
        `https://app.alfalabs.com.br/api/v1/relatorios/produtos?filial_id=${filialId}&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorios/cardapio/produtos?filial_id=${filialId}&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorios/produtos_vendidos?filial_id=${filialId}&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorios/vendas_produtos?filial_id=${filialId}&start_date=${targetDate}&end_date=${targetDate}`,
        `https://app.alfalabs.com.br/api/v1/relatorios/produtos?start_date=${targetDate}&end_date=${targetDate}`
      ];

      // Fetch ranking report
      const rankingResult = await tryFetchEndpoints(rankingEndpoints, token);
      const rankingRaw = rankingResult.data;
      
      reportOrdersCount = 0;
      reportTotalFaturamento = 0;
      reportTotalVendas = 0;

      const matchedRanking = rankingRaw.find((item: any) => 
        String(item.filial_id) === String(filialId) || 
        (item.filial && String(item.filial).toLowerCase().startsWith(String(filialId) + ".")) ||
        (item.filial && String(item.filial).toLowerCase().includes(String(filialId)))
      );

      if (matchedRanking) {
        reportOrdersCount = Number(matchedRanking.qtd_pedidos || 0);
        reportTotalVendas = Number(matchedRanking.total_vendas || 0);
        reportTotalFaturamento = Number(matchedRanking.total_faturamento || 0);
        if (matchedRanking.filial) filialNome = matchedRanking.filial;
      }

      // Fetch payment methods report
      const paymentResult = await tryFetchEndpoints(paymentEndpoints, token);
      paymentsRaw = paymentResult.data;
      trace.formasPagamentoReport = {
        endpointSucceeded: paymentResult.url,
        status: paymentResult.status,
        recordsCount: paymentsRaw.length,
        error: paymentResult.error
      };

      // Fetch products report
      const productResult = await tryFetchEndpoints(productEndpoints, token);
      productsRaw = productResult.data;
      trace.produtosReport = {
        endpointSucceeded: productResult.url,
        status: productResult.status,
        recordsCount: productsRaw.length,
        error: productResult.error
      };

      trace.rankingReport = {
        endpointSucceeded: rankingResult.url,
        status: rankingResult.status,
        recordsCount: rankingRaw.length,
        matched: !!matchedRanking,
        values: { reportOrdersCount, reportTotalVendas, reportTotalFaturamento }
      };

      // If all reports are empty or fail, raise alert with tracing
      if (productsRaw.length === 0 && paymentsRaw.length === 0 && rankingRaw.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Conexão efetuada, porém nenhum dado de faturamento/vendas foi encontrado para a data ${targetDate} nesta filial (${filialId}).`,
          trace
        });
      }

      // Identify store/filial name from any available field in reports if not set by ranking
      if (!filialNome) {
        for (const item of productsRaw) {
          if (item.filial_nome) { filialNome = item.filial_nome; break; }
          if (item.filial) { filialNome = item.filial; break; }
        }
      }
      if (!filialNome) {
        for (const item of paymentsRaw) {
          if (item.filial_nome) { filialNome = item.filial_nome; break; }
          if (item.filial) { filialNome = item.filial; break; }
        }
      }

      // If we got faturamento ranking data but products/payments are empty, let's build standard structures from it to keep UI happy
      if (paymentsRaw.length === 0 && reportTotalVendas > 0) {
        paymentsRaw = [
          { forma_pagamento: "Faturamento Relatório", total: reportTotalVendas, qtd_pedidos: reportOrdersCount }
        ];
      }

    } else {
      isSimulated = true;
      filialNome = "Bottega da Nonna (Simulada)";
      console.log(`[Alfa Labs Simulation] Carregando relatórios simulados para data: ${targetDate}`);

      // High-fidelity payment report mock
      paymentsRaw = [
        { forma_pagamento: "Dinheiro", total: 107.0, qtd_pedidos: 2 },
        { forma_pagamento: "iFood", total: 150.0, qtd_pedidos: 2 },
        { forma_pagamento: "Cartão de Débito", total: 34.5, qtd_pedidos: 1 },
        { forma_pagamento: "Cartão de Crédito", total: 45.5, qtd_pedidos: 1 },
        { forma_pagamento: "Pix", total: 80.0, qtd_pedidos: 1 }
      ];

      // High-fidelity products/cardapio report mock
      productsRaw = [
        { nome: "Pão de Queijo Gouda", quantidade: 3, total: 36.0, categoria: "Pães de Queijo" },
        { nome: "Croissant Tradicional", quantidade: 1, total: 14.0, categoria: "Croissants" },
        { nome: "Pão com Carne Suculenta", quantidade: 3, total: 66.0, categoria: "Pães" },
        { nome: "Cookie Chips", quantidade: 2, total: 22.0, categoria: "Cookies" },
        { nome: "Suco Lata Laranja", quantidade: 1, total: 7.0, categoria: "Bebidas" },
        { nome: "Esfiha de Carne", quantidade: 3, total: 28.5, categoria: "Salgados" },
        { nome: "Refrigerante 350ml", quantidade: 1, total: 6.0, categoria: "Bebidas" },
        { nome: "Coxinha de Frango", quantidade: 2, total: 19.0, categoria: "Salgados" },
        { nome: "Cookie Triple Chocolate", quantidade: 3, total: 36.0, categoria: "Cookies" },
        { nome: "Esfiha de Queijo", quantidade: 4, total: 36.0, categoria: "Salgados" },
        { nome: "Coxinha de Jaca", quantidade: 1, total: 9.5, categoria: "Salgados" },
        { nome: "Torta Bottega Especial", quantidade: 2, total: 145.0, categoria: "Tortas Bottega" }
      ];
    }

    // Process and normalize "Formas de Pagamento" report
    const pagamentos: Record<string, number> = {};
    for (const item of paymentsRaw) {
      const nomePgto = item.forma_pagamento || item.formaPagamento || item.nome || item.descricao || "Outro";
      const valorPgto = Number(item.total || item.valor || item.valor_total || item.total_venda || 0);
      pagamentos[nomePgto] = (pagamentos[nomePgto] || 0) + valorPgto;
    }

    // Process and normalize "Cardápio, Produtos" report to map into standard table/CSV format
    // Header format: Mês,Data,Nome,Quantidade,Vendas,Categoria
    const normalizedSales: any[] = [];
    const categorias: Record<string, number> = {};
    let idx = 1;

    for (const item of productsRaw) {
      const nome = item.nome || item.produto || item.nome_produto || item.descricao || "Item Não Especificado";
      const quantidade = Number(item.quantidade || item.qtd || item.total_venda_item_quantidade || item.quantidade_vendida || 1);
      const subTotal = Number(item.total || item.valor || item.sub_total || item.total_venda || (quantidade * (item.preco || item.preco_un || 0)));
      
      let categoria = item.categoria || item.categoria_nome || item.grupo || "Geral";
      const lowerNome = nome.toLowerCase();
      if (categoria === "Geral" || !categoria) {
        if (lowerNome.includes("torta") || lowerNome.includes("bottega")) {
          categoria = "Tortas Bottega";
        } else if (lowerNome.includes("cookie")) {
          categoria = "Cookies";
        } else if (lowerNome.includes("croissant")) {
          categoria = "Croissants";
        } else if (lowerNome.includes("pão") || lowerNome.includes("pao")) {
          categoria = "Pães de Queijo";
        } else if (lowerNome.includes("suco") || lowerNome.includes("refrigerante") || lowerNome.includes("refri") || lowerNome.includes("agua") || lowerNome.includes("água")) {
          categoria = "Bebidas";
        } else if (lowerNome.includes("café") || lowerNome.includes("cafe")) {
          categoria = "Cafés";
        }
      }

      categorias[categoria] = (categorias[categoria] || 0) + subTotal;

      normalizedSales.push({
        mes: targetMonthStr,
        data: targetDate,
        nome,
        quantidade,
        vendas: subTotal,
        categoria,
        seq: idx++
      });
    }

    // Calculate total items sold
    const totalItensVendidos = normalizedSales.reduce((sum, item) => sum + item.quantidade, 0);

    // Compile into standard sales CSV string
    let csvLines = ["Mês,Data,Nome,Quantidade,Vendas,Categoria"];
    normalizedSales.forEach(s => {
      const escNome = s.nome.includes(",") ? `"${s.nome}"` : s.nome;
      const escCat = s.categoria.includes(",") ? `"${s.categoria}"` : s.categoria;
      csvLines.push(`${s.mes},${s.data},${escNome},${s.quantidade},${s.vendas},${escCat}`);
    });
    const csvString = csvLines.join("\n");

    const finalOrdersCount = (!isSimulated && typeof reportOrdersCount === "number" && reportOrdersCount > 0) 
      ? reportOrdersCount 
      : paymentsRaw.reduce((sum, p) => sum + Number(p.qtd_pedidos || 1), 0);

    res.json({
      success: true,
      isSimulated,
      filialNome: filialNome || "Bottega da Nonna",
      date: targetDate,
      ordersCount: finalOrdersCount,
      reportTotalVendas: !isSimulated ? reportTotalVendas : paymentsRaw.reduce((sum, p) => sum + Number(p.total || 0), 0),
      reportTotalFaturamento: !isSimulated ? reportTotalFaturamento : paymentsRaw.reduce((sum, p) => sum + Number(p.total || 0), 0),
      itemsCount: normalizedSales.length,
      sales: normalizedSales,
      pagamentos,
      categorias,
      csv: csvString,
      trace
    });

  } catch (error: any) {
    console.error("Erro ao sincronizar relatórios Alfa Labs:", error);
    res.status(500).json({ success: false, error: error?.message || "Erro no processador de relatórios Alfa Labs" });
  }
});

// New Endpoint to Validate API Credentials and get Store/Filial Name
app.post("/api/alfalabs/validate", async (req, res) => {
  try {
    const { token, filialId = 1 } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: "Token de acesso é obrigatório para validação." });
    }

    console.log(`[Alfa Labs Validation] Verificando conexão de relatórios da filial: ${filialId}`);
    
    // We try to fetch the shapes of payment methods to check connectivity
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split("T")[0];

    const testEndpoints = [
      `https://app.alfalabs.com.br/api/v1/relatorios/ranking?pagina=1&start_date=${yesterday}&end_date=${yesterday}`,
      `https://app.alfalabs.com.br/api/v1/relatorios/formas_pagamento?filial_id=${filialId}&start_date=${yesterday}&end_date=${yesterday}`,
      `https://app.alfalabs.com.br/api/v1/relatorios/produtos?filial_id=${filialId}&start_date=${yesterday}&end_date=${yesterday}`
    ];

    const validationResult = await tryFetchEndpoints(testEndpoints, token);
    
    if (validationResult.status !== 200 && validationResult.data.length === 0) {
      return res.status(validationResult.status || 401).json({ 
        success: false, 
        error: `Conexão recusada pela Alfa Labs (Erro HTTP ${validationResult.status || 401}). ${validationResult.error || "Token de acesso inválido ou ID de filial não autorizado."}` 
      });
    }

    // Try finding store name from data
    let filialNome = null;
    for (const item of validationResult.data) {
      if (item.filial_nome) { filialNome = item.filial_nome; break; }
      if (item.filial) { filialNome = item.filial; break; }
    }

    return res.json({
      success: true,
      filialId: Number(filialId),
      filialNome: filialNome || "Bottega da Nonna (Conexão Relatório Validada com Sucesso!)",
      totalOrdersFoundInPayload: validationResult.data.length
    });

  } catch (error: any) {
    console.error("Erro na validação da API Alfa Labs:", error);
    return res.status(500).json({ success: false, error: error?.message || "Erro inesperado ao conectar à API da Alfa Labs" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Configure Vite or Serve static built files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
