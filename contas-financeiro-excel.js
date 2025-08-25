// ===== FUNCIONALIDADE DE EXPORTAÇÃO PARA EXCEL - CONTAS FINANCEIRAS =====

// Função principal para exportar dados para Excel
async function exportarParaExcel() {
    try {
        // Mostrar loading
        const btnExcel = document.getElementById('btn-baixar-excel');
        const originalText = btnExcel.innerHTML;
        btnExcel.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportando...';
        btnExcel.disabled = true;

        // Buscar dados da tabela movimentacoes_financeiros
        const dados = await buscarDadosMovimentacoes();
        
        if (!dados || dados.length === 0) {
            showNotification('Nenhum dado encontrado para exportar', 'warning');
            return;
        }

        // Criar planilha Excel
        const workbook = criarPlanilhaExcel(dados);
        
        // Fazer download do arquivo
        const nomeArquivo = `movimentacoes_financeiras_${formatarDataParaArquivo(new Date())}.xlsx`;
        baixarArquivoExcel(workbook, nomeArquivo);
        
        showNotification(`Arquivo ${nomeArquivo} baixado com sucesso!`, 'success');
        
    } catch (error) {
        console.error('Erro ao exportar para Excel:', error);
        showNotification('Erro ao exportar dados para Excel', 'error');
    } finally {
        // Restaurar botão
        const btnExcel = document.getElementById('btn-baixar-excel');
        btnExcel.innerHTML = '<i class="fas fa-file-excel"></i> Baixar Excel';
        btnExcel.disabled = false;
    }
}

// Cliente Supabase (será inicializado usando as variáveis globais do header.js)
let excelSupabaseClient = null;

// Inicializar cliente Supabase
function initializeSupabaseForExcel() {
    if (!excelSupabaseClient) {
        // Usar as constantes globais do header.js
        excelSupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return excelSupabaseClient;
}

// Função para buscar dados da tabela movimentacoes_financeiras
async function buscarDadosMovimentacoes() {
    try {
        // Usar as variáveis globais definidas pelo header.js
        if (!window.currentCompanyId) {
            throw new Error('ID da empresa não encontrado');
        }

        const client = initializeSupabaseForExcel();
        const { data, error } = await client
            .from('movimentacoes_financeiras')
            .select(`
                data_vencimento,
                descricao,
                valor,
                tipo,
                categoria,
                pessoa_empresa,
                status,
                recorrente
            `)
            .eq('id_empresa', window.currentCompanyId)
            .order('data_vencimento', { ascending: false });

        if (error) {
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        throw error;
    }
}

// Função para criar a planilha Excel
function criarPlanilhaExcel(dados) {
    // Definir cabeçalhos das colunas
    const cabecalhos = [
        'Data Vencimento',
        'Descrição',
        'Valor',
        'Tipo',
        'Categoria',
        'Pessoa/Empresa',
        'Status Pagamento',
        'Recorrente'
    ];

    // Preparar dados para a planilha
    const dadosFormatados = dados.map(item => [
        formatarDataParaExcel(item.data_vencimento),
        item.descricao || '',
        formatarValorParaExcel(item.valor),
        formatarTipo(item.tipo),
        item.categoria || '',
        item.pessoa_empresa || '',
        formatarStatusPagamento(item.status),
        item.recorrente ? 'Sim' : 'Não'
    ]);

    // Criar workbook
    const ws = XLSX.utils.aoa_to_sheet([cabecalhos, ...dadosFormatados]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimentações Financeiras');

    // Configurar largura das colunas
    const larguraColunas = [
        { wch: 15 }, // Data Vencimento
        { wch: 30 }, // Descrição
        { wch: 15 }, // Valor
        { wch: 12 }, // Tipo
        { wch: 20 }, // Categoria
        { wch: 25 }, // Pessoa/Empresa
        { wch: 15 }, // Status Pagamento
        { wch: 12 }  // Recorrente
    ];
    ws['!cols'] = larguraColunas;

    return wb;
}

// Função para fazer download do arquivo Excel
function baixarArquivoExcel(workbook, nomeArquivo) {
    XLSX.writeFile(workbook, nomeArquivo);
}

// Funções auxiliares de formatação
function formatarDataParaExcel(data) {
    if (!data) return '';
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR');
}

function formatarDataHoraParaExcel(dataHora) {
    if (!dataHora) return '';
    const date = new Date(dataHora);
    return date.toLocaleString('pt-BR');
}

function formatarValorParaExcel(valor) {
    if (!valor) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function formatarTipo(tipo) {
    const tipos = {
        'receber': 'A Receber',
        'pagar': 'A Pagar',
        'receita': 'Receita',
        'despesa': 'Despesa'
    };
    return tipos[tipo] || tipo;
}

function formatarStatusPagamento(status) {
    const statusMap = {
        'PAGO': 'Pago',
        'PENDENTE': 'Pendente',
        'VENCIDO': 'Vencido',
        'CANCELADO': 'Cancelado'
    };
    return statusMap[status] || status || 'Pendente';
}

function formatarDataParaArquivo(data) {
    const year = data.getFullYear();
    const month = String(data.getMonth() + 1).padStart(2, '0');
    const day = String(data.getDate()).padStart(2, '0');
    const hours = String(data.getHours()).padStart(2, '0');
    const minutes = String(data.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}`;
}

// Função para carregar a biblioteca XLSX dinamicamente
function carregarBibliotecaXLSX() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Erro ao carregar biblioteca XLSX'));
        document.head.appendChild(script);
    });
}

// Função principal que será chamada pelo botão
async function iniciarExportacaoExcel() {
    try {
        // Carregar biblioteca XLSX se necessário
        await carregarBibliotecaXLSX();
        
        // Executar exportação
        await exportarParaExcel();
    } catch (error) {
        console.error('Erro na exportação:', error);
        showNotification('Erro ao inicializar exportação para Excel', 'error');
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    const btnExcel = document.getElementById('btn-baixar-excel');
    if (btnExcel) {
        btnExcel.addEventListener('click', iniciarExportacaoExcel);
    }
});