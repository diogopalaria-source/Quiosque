export interface Sale {
  data: string;
  mes?: string;
  produto: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
  categoria?: string;
  origem?: string;
  tipoEntrega?: string;
  nome?: string;
  vendas?: number;
}

export interface Purchase {
  id?: string;
  data: string;
  mes?: string;
  produto: string;
  quantidade: number;
  custoUnitario: number;
  total: number;
  desconsiderado?: boolean;
  fornecedor?: string;
  createdAt?: any;
}

export interface BankTransaction {
  id?: string;
  data: string;
  descricao: string;
  categoria: 'Venda' | 'Custo' | 'Fixa' | 'Variável' | 'Outros';
  valor: number;
  tipo: 'Entrada' | 'Saída';
  reconciled?: boolean;
  reconciledId?: string;
  reconciledMonth?: string;
  reconciledClassification?: string;
  reconciledDetails?: string;
}

export interface StockItem {
  produto: string;
  estoqueAtual: number;
  custoUnitario: number;
  valorTotal: number;
}

export interface FinancialRecord {
  mes: string;
  valor: number;
  tipo: 'Receita' | 'Despesa';
  classificacao: string;
  detalhes: string;
  observacoes: string;
}

export interface MonthlyClosing {
  vendasBrutas: number;
  receitaLiquida: number; // Do novo CSV tipo Receita
  descontos: number; // vendasBrutas - receitaLiquida
  cmv: number; // Do novo CSV onde detalhes tem 'mercadoria'
  gastosFixos: number;
  gastosVariaveis: number;
  lucroBruto: number;
  lucroLiquido: number;
  margemContribuicao: number;
  custoOcupacao: number;
  custoPessoal: number;
  totalStaffPayments?: number;
}

export interface WasteRecord {
  id?: string;
  data: string;
  produto: string;
  quantidade: number;
  responsavel: string;
  acao: 'Reuso' | 'Descarte';
  motivo: 'café' | 'qualidade' | 'validade' | 'vitrine';
  userId: string;
  createdAt?: any;
}

export interface StaffConsumption {
  id?: string;
  data: string;
  mes?: string;
  funcionario: string;
  produto: string;
  quantidade?: number;
  valorCheio: number;
  descontoPercent: number;
  valorPago: number;
  status: 'pendente' | 'pago';
  userId: string;
  createdAt?: any;
}

export interface StaffPayment {
  id?: string;
  dataDeposito: string;
  funcionario: string;
  valorPago: number;
  observacao?: string;
  userId: string;
  createdAt?: any;
}

export interface PurchaseRequest {
  id?: string;
  produto: string;
  quantidade?: string;
  quantidadeNumerica?: number;
  valorTotal?: number;
  valorUnitario?: number;
  status: 'pendente' | 'comprado' | 'recebido' | 'cancelado';
  fornecedor?: string;
  usuarioSolicitante: string;
  dataSolicitacao: string;
  dataCompra?: string;
  dataRecebimento?: string;
  userId: string;
  urgente?: boolean;
  categoriaEstoque?: string; // New field for macro-ingredient linking
  naoConsiderarEstoque?: boolean;
  previsaoChegada?: string;
  createdAt?: any;
}

export interface RecipeIngredient {
  macroIngredient: typeof MACRO_INGREDIENTS[number] | string;
  quantidade: number;
  unidade: 'un' | 'kg';
}

export interface Recipe {
  id?: string;
  produtoFinal: string; // Nome do produto como aparece na venda/consumo
  ingredientes: RecipeIngredient[];
  userId: string;
}

export const MACRO_INGREDIENTS = [
  'Cookie',
  'Croissant',
  'Pão',
  'Recheio Maça',
  'Cheese Cake',
  'Tortas Bottega',
  'Esfiha Carne',
  'Esfiha Queijo',
  'Pastel Assado',
  'Coxinha Jaca',
  'Coxinha Frango',
  'Pão de queijo Gouda',
  'Pão de queijo Batata Doce',
  'Refrigerante 350ml',
  'Refrigerante 220ml',
  'Agua com gas',
  'Agua sem gas',
  'Café em grão',
  'Café moido Classico',
  'Café descafeinado',
  'Outros unidade',
  'Outros KG',
  'Suco Lata',
  'Frutas Congeladas',
  'Quiche',
  'Yuba',
  'Carne suculenta',
  'Cinnamon Roll',
  'Brownie',
  'Bolo Caseiro',
  'Pão de queijo para Waffle',
  'chá twinnigs',
  'Sopa de Batata com Bacon',
  'Caldo de Mandioquinha',
  'Caldo verde'
] as const;

export interface StaffDiscountOverride {
  id?: string;
  productId: string;
  productName: string;
  descontoPercent: number;
  userId: string;
  updatedAt?: any;
}

export interface TemperatureMeasurement {
  id?: string;
  data_registro: string; // YYYY-MM-DD
  hora_registro: string; // HH:MM:SS
  id_equipamento: 'Freezer' | 'Geladeira' | 'Frigobar';
  temperatura: number;
  funcionario: string; // Name of staff
  id_funcionario: string; // User ID
  status_conformidade: 'OK' | 'ALERTA';
  justificativa?: string;
  userId: string; // Shared or specific user ownership ID
  createdAt?: any;
}

