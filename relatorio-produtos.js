// ===== RELATÓRIO DE PRODUTOS - CORE & INICIALIZAÇÃO =====

// ===== ESTADO DA APLICAÇÃO =====
const relatorioProdutosState = {
    produtosData: [],
    categorias: [],
    marcas: [],
    supabaseClient: null,
    filters: {
        categoria: '',
        marca: '',
        status: ''
    },
    statistics: {
        totalProdutos: 0,
        produtosAtivos: 0,
        valorTotalEstoque: 0,
        valorMedioProduto: 0,
        totalCategorias: 0,
        totalMarcas: 0,
        estoqueBaixo: 0,
        semEstoque: 0,
        semLimite: 0,
        margemMedia: 0
    }
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    if (window.currentCompanyId) {
        initializeRelatorioProdutos();
    } else {
        document.addEventListener('userDataReady', initializeRelatorioProdutos);
    }
});

function initializeRelatorioProdutos() {
    if (!window.currentCompanyId) {
        console.error("ID da empresa não encontrado.");
        showNotification('Erro: ID da empresa não encontrado', 'error');
        return;
    }

    // Usar cliente Supabase existente se disponível
    relatorioProdutosState.supabaseClient = window.supabaseClient || supabase.createClient(
        'https://gnehkswoqlpchtlgyjyj.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWhrc3dvcWxwY2h0bGd5anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTY3NjYsImV4cCI6MjA2OTQ3Mjc2Nn0.8giA1bDvCzgvlcW_pkimGO9qHRF2I0QfhG6nx9U_tdY'
    );
    
    setupEventListeners();
    loadInitialData();
}

// ===== CONFIGURAÇÃO DE EVENTOS =====
function setupEventListeners() {
    // Controles principais
    const refreshBtn = document.getElementById('refresh-data');
    const exportBtn = document.getElementById('export-report');

    if (refreshBtn) refreshBtn.addEventListener('click', refreshData);
    if (exportBtn) exportBtn.addEventListener('click', exportReport);

    // Filtros
    const categoriaFilter = document.getElementById('filter-categoria');
    const marcaFilter = document.getElementById('filter-marca');
    const statusFilter = document.getElementById('filter-status');

    if (categoriaFilter) categoriaFilter.addEventListener('change', applyFilters);
    if (marcaFilter) marcaFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);

    // Controles de gráficos
    const categoriaMetric = document.getElementById('categoria-metric');
    const margemView = document.getElementById('margem-view');
    const marcaMetric = document.getElementById('marca-metric');

    if (categoriaMetric) categoriaMetric.addEventListener('change', updateCategoriaChart);
    if (margemView) margemView.addEventListener('change', updateMargemChart);
    if (marcaMetric) marcaMetric.addEventListener('change', updateMarcasChart);

    // Toggle de alertas
    const toggleAlertsBtn = document.getElementById('toggle-alerts');
    if (toggleAlertsBtn) toggleAlertsBtn.addEventListener('click', toggleAlertsTable);
}

// ===== CARREGAMENTO PRINCIPAL =====
async function loadInitialData() {
    try {
        showLoading(true);
        
        await loadProdutosData();
        calculateStatistics();
        updateStatisticsDisplay();
        populateFilters();
        
        // Inicializar gráficos
        setTimeout(() => {
            if (window.initializeProdutosCharts) {
                window.initializeProdutosCharts();
            }
        }, 500);
        
        updateAlertsTable();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showNotification('Erro ao carregar dados dos produtos', 'error');
    } finally {
        showLoading(false);
    }
}

// ===== CARREGAMENTO DE DADOS =====
async function loadProdutosData() {
    if (!relatorioProdutosState.supabaseClient || !window.currentCompanyId) {
        console.warn('Supabase não configurado ou empresa não encontrada');
        return;
    }

    try {
        let query = relatorioProdutosState.supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });

        // Aplicar filtros
        if (relatorioProdutosState.filters.categoria) {
            query = query.eq('categoria', relatorioProdutosState.filters.categoria);
        }
        if (relatorioProdutosState.filters.marca) {
            query = query.eq('marca', relatorioProdutosState.filters.marca);
        }
        if (relatorioProdutosState.filters.status === 'ativo') {
            query = query.eq('ativo', true);
        } else if (relatorioProdutosState.filters.status === 'inativo') {
            query = query.eq('ativo', false);
        }

        const { data, error } = await query;

        if (error) throw error;

        relatorioProdutosState.produtosData = data || [];
        
        // Aplicar filtros de estoque se necessário
        if (relatorioProdutosState.filters.status === 'estoque-baixo') {
            relatorioProdutosState.produtosData = relatorioProdutosState.produtosData.filter(produto => 
                produto.quantidade_estoque <= produto.estoque_minimo && produto.estoque_minimo > 0
            );
        } else if (relatorioProdutosState.filters.status === 'sem-estoque') {
            relatorioProdutosState.produtosData = relatorioProdutosState.produtosData.filter(produto => 
                produto.quantidade_estoque <= 0
            );
        }

        console.log(`Carregados ${relatorioProdutosState.produtosData.length} produtos`);

    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        relatorioProdutosState.produtosData = [];
    }
}

// ===== CÁLCULOS E ESTATÍSTICAS =====
function calculateStatistics() {
    const produtos = relatorioProdutosState.produtosData;
    
    if (!produtos || produtos.length === 0) {
        relatorioProdutosState.statistics = {
            totalProdutos: 0,
            produtosAtivos: 0,
            valorTotalEstoque: 0,
            valorMedioProduto: 0,
            totalCategorias: 0,
            totalMarcas: 0,
            estoqueBaixo: 0,
            semEstoque: 0,
            semLimite: 0,
            margemMedia: 0
        };
        return;
    }

    // Estatísticas básicas
    const produtosAtivos = produtos.filter(p => p.ativo === true);
    const totalProdutos = produtos.length;
    
    // Valor total do estoque
    const valorTotalEstoque = produtos.reduce((sum, produto) => {
        const preco = parseFloat(produto.preco_venda) || 0;
        const quantidade = parseInt(produto.quantidade_estoque) || 0;
        return sum + (preco * quantidade);
    }, 0);

    // Categorias e marcas únicas
    const categoriasUnicas = new Set(produtos.map(p => p.categoria).filter(c => c));
    const marcasUnicas = new Set(produtos.map(p => p.marca).filter(m => m));

    // Alertas de estoque
    const estoqueBaixo = produtos.filter(p => {
        const estoque = parseInt(p.quantidade_estoque) || 0;
        const minimo = parseInt(p.estoque_minimo) || 0;
        return estoque <= minimo && minimo > 0;
    }).length;

    const semEstoque = produtos.filter(p => (parseInt(p.quantidade_estoque) || 0) <= 0).length;
    const semLimite = produtos.filter(p => !p.estoque_minimo || p.estoque_minimo <= 0).length;

    // Margem média
    const produtosComMargem = produtos.filter(p => p.markup && p.markup > 0);
    const margemMedia = produtosComMargem.length > 0 
        ? produtosComMargem.reduce((sum, p) => sum + (parseFloat(p.markup) || 0), 0) / produtosComMargem.length 
        : 0;

    relatorioProdutosState.statistics = {
        totalProdutos,
        produtosAtivos: produtosAtivos.length,
        valorTotalEstoque,
        valorMedioProduto: totalProdutos > 0 ? valorTotalEstoque / totalProdutos : 0,
        totalCategorias: categoriasUnicas.size,
        totalMarcas: marcasUnicas.size,
        estoqueBaixo,
        semEstoque,
        semLimite,
        margemMedia
    };

    // Atualizar listas para filtros
    relatorioProdutosState.categorias = Array.from(categoriasUnicas).sort();
    relatorioProdutosState.marcas = Array.from(marcasUnicas).sort();
}

// ===== ATUALIZAÇÃO DA INTERFACE =====
function updateStatisticsDisplay() {
    const stats = relatorioProdutosState.statistics;

    // Header stats
    const totalProdutosEl = document.getElementById('total-produtos');
    const valorEstoqueEl = document.getElementById('valor-estoque');
    const estoqueBaixoEl = document.getElementById('estoque-baixo');
    const margemMediaEl = document.getElementById('margem-media');

    if (totalProdutosEl) totalProdutosEl.textContent = stats.totalProdutos.toLocaleString('pt-BR');
    if (valorEstoqueEl) valorEstoqueEl.textContent = formatCurrency(stats.valorTotalEstoque);
    if (estoqueBaixoEl) estoqueBaixoEl.textContent = stats.estoqueBaixo.toLocaleString('pt-BR');
    if (margemMediaEl) margemMediaEl.textContent = stats.margemMedia.toFixed(1) + '%';

    // Cards detalhados
    const produtosAtivosEl = document.getElementById('produtos-ativos');
    const produtosAtivosPercentEl = document.getElementById('produtos-ativos-percent');
    const valorTotalEstoqueEl = document.getElementById('valor-total-estoque');
    const valorMedioProdutoEl = document.getElementById('valor-medio-produto');
    const totalCategoriasEl = document.getElementById('total-categorias');
    const categoriaMaisProdutosEl = document.getElementById('categoria-mais-produtos');
    const totalAlertasEl = document.getElementById('total-alertas');
    const produtosSemEstoqueEl = document.getElementById('produtos-sem-estoque');

    if (produtosAtivosEl) produtosAtivosEl.textContent = stats.produtosAtivos.toLocaleString('pt-BR');
    if (produtosAtivosPercentEl) {
        const percent = stats.totalProdutos > 0 ? (stats.produtosAtivos / stats.totalProdutos * 100).toFixed(1) : 0;
        produtosAtivosPercentEl.textContent = `${percent}% do total`;
    }
    
    if (valorTotalEstoqueEl) valorTotalEstoqueEl.textContent = formatCurrency(stats.valorTotalEstoque);
    if (valorMedioProdutoEl) valorMedioProdutoEl.textContent = `Média: ${formatCurrency(stats.valorMedioProduto)}/produto`;
    if (totalCategoriasEl) totalCategoriasEl.textContent = stats.totalCategorias.toLocaleString('pt-BR');
    
    // Categoria com mais produtos
    if (categoriaMaisProdutosEl) {
        const categoriaMaior = getCategoriaComMaisProdutos();
        categoriaMaisProdutosEl.textContent = `Maior: ${categoriaMaior}`;
    }

    const totalAlertas = stats.estoqueBaixo + stats.semEstoque;
    if (totalAlertasEl) totalAlertasEl.textContent = totalAlertas.toLocaleString('pt-BR');
    if (produtosSemEstoqueEl) produtosSemEstoqueEl.textContent = `${stats.semEstoque} sem estoque`;

    // Alertas summary
    const semEstoqueCountEl = document.getElementById('sem-estoque-count');
    const estoqueBaixoCountEl = document.getElementById('estoque-baixo-count');
    const semLimiteCountEl = document.getElementById('sem-limite-count');

    if (semEstoqueCountEl) semEstoqueCountEl.textContent = stats.semEstoque;
    if (estoqueBaixoCountEl) estoqueBaixoCountEl.textContent = stats.estoqueBaixo;
    if (semLimiteCountEl) semLimiteCountEl.textContent = stats.semLimite;
}

function getCategoriaComMaisProdutos() {
    if (!relatorioProdutosState.produtosData.length) return 'N/A';
    
    const categoriaCount = {};
    relatorioProdutosState.produtosData.forEach(produto => {
        const categoria = produto.categoria || 'Sem categoria';
        categoriaCount[categoria] = (categoriaCount[categoria] || 0) + 1;
    });
    
    let maxCategoria = 'N/A';
    let maxCount = 0;
    Object.entries(categoriaCount).forEach(([categoria, count]) => {
        if (count > maxCount) {
            maxCount = count;
            maxCategoria = categoria;
        }
    });
    
    return maxCategoria;
}

// ===== FILTROS =====
function populateFilters() {
    // Categorias
    const categoriaSelect = document.getElementById('filter-categoria');
    if (categoriaSelect) {
        // Limpar opções existentes
        while (categoriaSelect.children.length > 1) {
            categoriaSelect.removeChild(categoriaSelect.lastChild);
        }
        
        relatorioProdutosState.categorias.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria;
            option.textContent = categoria;
            categoriaSelect.appendChild(option);
        });
    }

    // Marcas
    const marcaSelect = document.getElementById('filter-marca');
    if (marcaSelect) {
        // Limpar opções existentes
        while (marcaSelect.children.length > 1) {
            marcaSelect.removeChild(marcaSelect.lastChild);
        }
        
        relatorioProdutosState.marcas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca;
            option.textContent = marca;
            marcaSelect.appendChild(option);
        });
    }
}

function applyFilters() {
    const categoriaEl = document.getElementById('filter-categoria');
    const marcaEl = document.getElementById('filter-marca');
    const statusEl = document.getElementById('filter-status');

    relatorioProdutosState.filters.categoria = categoriaEl ? categoriaEl.value : '';
    relatorioProdutosState.filters.marca = marcaEl ? marcaEl.value : '';
    relatorioProdutosState.filters.status = statusEl ? statusEl.value : '';
    
    refreshData();
}

// ===== TABELA DE ALERTAS =====
function toggleAlertsTable() {
    const container = document.getElementById('alerts-table-container');
    const button = document.getElementById('toggle-alerts');
    
    if (!container || !button) return;
    
    const span = button.querySelector('span');
    
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        if (span) span.textContent = 'Ocultar Tabela';
        updateAlertsTable();
    } else {
        container.style.display = 'none';
        if (span) span.textContent = 'Mostrar Todos';
    }
}

function updateAlertsTable() {
    const tbody = document.getElementById('alerts-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    const alertProducts = relatorioProdutosState.produtosData.filter(produto => {
        const estoque = parseInt(produto.quantidade_estoque) || 0;
        const minimo = parseInt(produto.estoque_minimo) || 0;
        return estoque <= minimo || estoque <= 0 || minimo <= 0;
    });

    alertProducts.forEach(produto => {
        const row = tbody.insertRow();
        const estoque = parseInt(produto.quantidade_estoque) || 0;
        const minimo = parseInt(produto.estoque_minimo) || 0;
        const valor = parseFloat(produto.preco_venda) || 0;

        let status = 'success';
        let statusText = 'Normal';
        
        if (estoque <= 0) {
            status = 'critical';
            statusText = 'Sem Estoque';
        } else if (estoque <= minimo && minimo > 0) {
            status = 'warning';
            statusText = 'Estoque Baixo';
        } else if (minimo <= 0) {
            status = 'info';
            statusText = 'Sem Limite';
        }

        row.innerHTML = `
            <td>${produto.nome || 'N/A'}</td>
            <td>${produto.categoria || 'N/A'}</td>
            <td>${estoque.toLocaleString('pt-BR')}</td>
            <td>${minimo > 0 ? minimo.toLocaleString('pt-BR') : 'N/A'}</td>
            <td><span class="status-badge ${status}">${statusText}</span></td>
            <td>${formatCurrency(valor * estoque)}</td>
        `;
    });
}

// ===== AÇÕES PRINCIPAIS =====
async function refreshData() {
    await loadInitialData();
    
    // Atualizar gráficos
    if (window.updateProdutosCharts) {
        window.updateProdutosCharts();
    }
}

function updateCategoriaChart() {
    if (window.updateCategoriaChart) {
        const metric = document.getElementById('categoria-metric')?.value || 'quantidade';
        window.updateCategoriaChart(metric);
    }
}

function updateMargemChart() {
    if (window.updateMargemChart) {
        const view = document.getElementById('margem-view')?.value || 'distribuicao';
        window.updateMargemChart(view);
    }
}

function updateMarcasChart() {
    if (window.updateMarcasChart) {
        const metric = document.getElementById('marca-metric')?.value || 'quantidade';
        window.updateMarcasChart(metric);
    }
}

function exportReport() {
    try {
        if (!relatorioProdutosState.produtosData || relatorioProdutosState.produtosData.length === 0) {
            showNotification('Nenhum dado para exportar', 'warning');
            return;
        }

        // Preparar dados para exportação
        const reportData = relatorioProdutosState.produtosData.map(produto => ({
            'Nome': produto.nome || '',
            'Categoria': produto.categoria || '',
            'Marca': produto.marca || '',
            'SKU': produto.codigo_sku || '',
            'Código de Barras': produto.codigo_barras || '',
            'Preço Custo': formatCurrency(produto.preco_custo || 0),
            'Preço Venda': formatCurrency(produto.preco_venda || 0),
            'Markup (%)': produto.markup || 0,
            'Estoque Atual': produto.quantidade_estoque || 0,
            'Estoque Mínimo': produto.estoque_minimo || 0,
            'Estoque Máximo': produto.estoque_maximo || 0,
            'Valor em Estoque': formatCurrency((produto.preco_venda || 0) * (produto.quantidade_estoque || 0)),
            'Status': produto.ativo ? 'Ativo' : 'Inativo',
            'Localização': produto.localizacao || '',
            'Observações': produto.observacoes || ''
        }));

        // Converter para CSV
        const headers = Object.keys(reportData[0] || {});
        const csvContent = [
            headers.join(','),
            ...reportData.map(row => 
                headers.map(header => `"${row[header]}"`).join(',')
            )
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio_produtos_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Relatório exportado com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao exportar relatório:', error);
        showNotification('Erro ao exportar relatório', 'error');
    }
}

// ===== UTILITÁRIOS =====
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showNotification(message, type = 'info') {
    // Remover notificação existente
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" 
                style="background: none; border: none; color: white; margin-left: auto; cursor: pointer; padding: 0.25rem;">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.relatorioProdutosState = relatorioProdutosState;
window.refreshProdutosData = refreshData;