// ultimas-vendas-movimentacao.js - Histórico Completo de Movimentação de Produtos
// =====================================================================================

// Injetar estilos CSS no DOM
function injectMovementStyles() {
    const styleId = 'movement-styles';
    
    // Verificar se já foi injetado
    if (document.getElementById(styleId)) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* ===== ESTILOS PARA MOVIMENTAÇÃO COMPLETA DE PRODUTOS ===== */
        
        /* Cabeçalho das informações do produto */
        .product-movement-header {
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 12px;
            border-left: 4px solid var(--primary-color);
        }
        
        .product-movement-header h4 {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .product-movement-header h4 i {
            color: var(--primary-color);
            font-size: 1.1rem;
        }
        
        .movement-summary {
            display: flex;
            gap: 2rem;
            margin-top: 0.5rem;
            font-size: 0.9rem;
            color: var(--text-secondary);
        }
        
        .movement-summary strong {
            color: var(--text-primary);
            font-weight: 600;
        }
        
        .product-info-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .product-summary-item {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        
        .product-summary-item label {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .product-summary-item span {
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--text-primary);
        }
        
        .saldo-atual {
            font-weight: 700;
            font-size: 1.1rem;
        }
        
        .saldo-atual.positivo {
            color: #059669;
        }
        
        .saldo-atual.negativo {
            color: #dc2626;
        }
        
        /* Timeline melhorada */
        .timeline {
            position: relative;
            padding-left: 2rem;
            margin-top: 1.5rem;
        }
        
        .timeline::before {
            content: '';
            position: absolute;
            left: 12px;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(to bottom, var(--primary-color), #e2e8f0);
            border-radius: 2px;
        }
        
        .timeline-item {
            position: relative;
            margin-bottom: 2rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            border: 1px solid #f1f5f9;
            transition: all 0.2s ease;
        }
        
        .timeline-item:hover {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            transform: translateX(4px);
        }
        
        .timeline-item:last-child {
            margin-bottom: 0;
        }
        
        .timeline-icon {
            position: absolute;
            left: -21px;
            top: 1.25rem;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            font-size: 0.9rem;
        }
        
        .timeline-icon.cadastro { 
            background: linear-gradient(135deg, #3b82f6, #1d4ed8); 
        }
        
        .timeline-icon.entrada { 
            background: linear-gradient(135deg, #10b981, #047857); 
        }
        
        .timeline-icon.saida { 
            background: linear-gradient(135deg, #f59e0b, #d97706); 
        }
        
        .timeline-content {
            padding: 1.5rem;
            padding-left: 2rem;
        }
        
        .timeline-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }
        
        .timeline-header h4 {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 0;
            color: var(--text-primary);
        }
        
        .timeline-date {
            font-size: 0.8rem;
            color: var(--text-secondary);
            background: #f8fafc;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            font-weight: 500;
        }
        
        .movement-details {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .movement-info {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        
        .movement-quantity {
            font-size: 0.9rem;
            font-weight: 400;
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            width: fit-content;
        }
        
        .movement-quantity.entrada {
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
        }
        
        .movement-quantity.saida {
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }
        
        .movement-balance {
            font-size: 0.9rem;
            color: var(--text-secondary);
            background: #f1f5f9;
            padding: 0.3rem 0.6rem;
            border-radius: 6px;
            font-weight: 500;
        }
        
        .movement-description {
            font-size: 0.95rem;
            color: var(--text-primary);
            margin: 0;
            line-height: 1.4;
        }
        
        .movement-client,
        .movement-sale,
        .movement-origin {
            font-size: 0.8rem;
            color: var(--text-secondary);
            padding: 0.2rem 0;
        }
        
        .movement-client {
            color: #7c3aed;
        }
        
        .movement-client::before {
            content: "👤 ";
            margin-right: 0.25rem;
        }
        
        .movement-sale {
            color: #f59e0b;
        }
        
        .movement-sale::before {
            content: "🛒 ";
            margin-right: 0.25rem;
        }
        
        .movement-origin {
            color: #059669;
        }
        
        .movement-origin::before {
            content: "🏷️ ";
            margin-right: 0.25rem;
        }
        
        /* Estados vazios e de erro melhorados */
        .empty-state,
        .error-state {
            text-align: center;
            padding: 3rem 2rem;
            color: var(--text-secondary);
        }
        
        .empty-state h3,
        .error-state h3 {
            font-size: 1.25rem;
            color: var(--text-primary);
            margin: 1rem 0 0.5rem 0;
        }
        
        .empty-state i,
        .error-state i {
            font-size: 3rem;
            margin-bottom: 1rem;
            display: block;
        }
        
        .empty-state i {
            color: #9ca3af;
        }
        
        .error-state i {
            color: var(--danger-color);
        }
        
        .empty-state p,
        .error-state p {
            margin: 0.5rem 0;
            font-size: 0.95rem;
            line-height: 1.4;
        }
        
        .empty-state strong,
        .error-state strong {
            color: var(--primary-color);
            font-weight: 600;
        }
        
        .error-state small {
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-top: 0.5rem;
            display: block;
        }
        
        /* Loading melhorado */
        .loading-state {
            text-align: center;
            padding: 3rem 2rem;
            color: var(--text-secondary);
        }
        
        .loading-state i {
            font-size: 2rem;
            color: var(--primary-color);
            margin-bottom: 1rem;
            animation: spin 1s linear infinite;
        }
        
        .loading-state p {
            font-size: 0.95rem;
            margin: 0;
        }
        
        /* Responsividade */
        @media (max-width: 768px) {
            .product-info-summary {
                grid-template-columns: 1fr;
                gap: 0.75rem;
            }
            
            .timeline {
                padding-left: 1.5rem;
            }
            
            .timeline-icon {
                left: -18px;
                width: 32px;
                height: 32px;
                font-size: 0.8rem;
            }
            
            .timeline-content {
                padding: 1rem;
                padding-left: 1.5rem;
            }
            
            .timeline-header {
                flex-direction: column;
                gap: 0.5rem;
                align-items: flex-start;
            }
            
            .movement-info {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.5rem;
            }
            
            .movement-quantity {
                font-size: 0.9rem;
                padding: 0.3rem 0.6rem;
            }
            
            .movement-summary {
                flex-direction: column;
                gap: 0.5rem;
            }
        }
    `;
    
    document.head.appendChild(style);
    console.log('✅ Estilos de movimentação injetados no DOM');
}

/**
 * Mostra o modal de movimentação completa de um produto pelo SKU
 * @param {string} sku - Código SKU do produto
 * @param {string} productName - Nome do produto (opcional)
 */
async function showMovementModal(sku, productName = null) {
    console.log('📦 Mostrando histórico completo de movimentação para SKU:', sku);
    
    // Validar SKU antes de prosseguir
    if (!sku || sku === 'undefined' || sku === 'N/A' || sku.trim() === '') {
        console.error('❌ SKU inválido recebido:', sku);
        alert('SKU inválido para mostrar movimentação.');
        return;
    }
    
    const modal = document.getElementById('movement-modal');
    const content = document.getElementById('movement-content');
    
    if (!modal || !content) {
        console.error('❌ Modal de movimentação não encontrado no DOM');
        alert('Erro: Modal de movimentação não encontrado.');
        return;
    }
    
    // Mostrar loading
    content.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Carregando histórico completo de movimentação para SKU: ${sku}...</p>
        </div>
    `;
    
    modal.classList.add('show');
    
    try {
        // Buscar dados completos do produto e suas movimentações
        const productData = await fetchCompleteProductMovements(sku);
        
        if (!productData || productData.movements.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>Nenhuma movimentação encontrada</h3>
                    <p>Não foi encontrado histórico de movimentação para o SKU: <strong>${sku}</strong></p>
                    <small>Verifique se o produto foi cadastrado ou se houve vendas registradas.</small>
                </div>
            `;
            return;
        }
        
        // Renderizar timeline completa
        const timelineHtml = renderMovementTimeline(productData, sku);
        content.innerHTML = timelineHtml;
        
    } catch (error) {
        console.error('❌ Erro ao buscar movimentação completa:', error);
        content.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro ao carregar movimentação</h3>
                <p>Não foi possível carregar o histórico de movimentação do produto.</p>
                <small>SKU: ${sku} | Erro: ${error.message}</small>
            </div>
        `;
    }
}

/**
 * Busca dados completos do produto e todas suas movimentações
 * @param {string} sku - Código SKU do produto
 * @returns {Object} Dados do produto e movimentações
 */
async function fetchCompleteProductMovements(sku) {
    try {
        console.log('🔍 Buscando dados completos para SKU:', sku);
        
        const movements = [];
        let produto = null;
        
        // 1. SEMPRE buscar o produto na tabela produtos (entrada inicial)
        console.log('📦 Buscando produto na tabela produtos...');
        try {
            const { data: produtoData, error: produtoError } = await supabaseClient
                .from('produtos')
                .select('id, nome, codigo_sku, quantidade_estoque, created_at')
                .eq('codigo_sku', sku)
                .eq('id_empresa', window.currentCompanyId)
                .single();
                
            if (!produtoError && produtoData) {
                produto = produtoData;
                console.log('✅ Produto encontrado:', produto.nome);
                
                // Adicionar cadastro inicial como ENTRADA
                movements.push({
                    tipo: 'entrada',
                    descricao: `Cadastro Inicial - ${produto.nome}`,
                    quantidade: produto.quantidade_estoque || 0,
                    data: produto.created_at,
                    origem: 'cadastro',
                    saldo: produto.quantidade_estoque || 0
                });
            } else {
                console.warn('⚠️ Produto não encontrado na tabela produtos:', produtoError);
                produto = { nome: 'Produto não encontrado', codigo_sku: sku };
            }
        } catch (error) {
            console.warn('⚠️ Erro ao buscar produto:', error);
            produto = { nome: 'Produto não encontrado', codigo_sku: sku };
        }
        
        // 2. SEMPRE buscar TODAS as vendas deste SKU (saídas)
        console.log('🛒 Buscando todas as vendas do SKU...');
        const { data: vendas, error: vendasError } = await supabaseClient
            .from('vendas')
            .select('id_venda, hora_venda, quantidade_unit, cliente_nome, id')
            .eq('produto_sku', sku) // CORRIGIDO: usar produto_sku na tabela vendas
            .eq('id_empresa', window.currentCompanyId)
            .order('hora_venda', { ascending: true }); // Ordem cronológica
            
        if (vendasError) {
            console.error('❌ Erro ao buscar vendas:', vendasError);
            throw vendasError;
        }
        
        if (vendas && vendas.length > 0) {
            console.log(`✅ Encontradas ${vendas.length} vendas para SKU ${sku}`);
            
            // Adicionar CADA venda como uma SAÍDA separada
            vendas.forEach((venda, index) => {
                movements.push({
                    tipo: 'saida',
                    descricao: `Venda #${venda.id_venda}`,
                    quantidade: venda.quantidade_unit || 1,
                    data: venda.hora_venda,
                    cliente: venda.cliente_nome || 'Cliente não informado',
                    venda_id: venda.id_venda,
                    origem: 'venda',
                    ordem: index + 1
                });
            });
        } else {
            console.log('📭 Nenhuma venda encontrada para este SKU');
        }
        
        // 3. Buscar entradas de estoque (se existir tabela)
        console.log('📦 Tentando buscar entradas de estoque...');
        try {
            const { data: entradasData, error: entradasError } = await supabaseClient
                .from('entradas_estoque')
                .select('quantidade, created_at, observacoes')
                .eq('produto_sku', sku) // CORRIGIDO: verificar se também usa produto_sku
                .eq('id_empresa', window.currentCompanyId)
                .order('created_at', { ascending: true });
                
            if (!entradasError && entradasData && entradasData.length > 0) {
                console.log(`✅ Encontradas ${entradasData.length} entradas de estoque`);
                entradasData.forEach(entrada => {
                    movements.push({
                        tipo: 'entrada',
                        descricao: 'Entrada de Estoque',
                        quantidade: entrada.quantidade,
                        data: entrada.created_at,
                        detalhes: entrada.observacoes || 'Entrada manual de estoque',
                        origem: 'entrada_manual'
                    });
                });
            }
        } catch (error) {
            console.log('📝 Tabela entradas_estoque não existe ou sem permissão');
        }
        
        // 4. Ordenar TUDO por data cronológica (do primeiro ao último)
        movements.sort((a, b) => new Date(a.data) - new Date(b.data));
        
        // 5. Calcular saldo progressivo
        let saldoAtual = 0;
        movements.forEach((movement, index) => {
            if (movement.tipo === 'entrada') {
                saldoAtual += movement.quantidade;
            } else if (movement.tipo === 'saida') {
                saldoAtual -= movement.quantidade;
            }
            movement.saldoApos = saldoAtual;
            movement.numeroSequencial = index + 1;
        });
        
        console.log(`📊 Timeline completa: ${movements.length} movimentações`);
        console.log('📋 Saldo final:', saldoAtual);
        
        // Debug: mostrar resumo
        movements.forEach((mov, i) => {
            console.log(`${i+1}. ${mov.tipo.toUpperCase()}: ${mov.quantidade} (Saldo: ${mov.saldoApos}) - ${new Date(mov.data).toLocaleDateString()}`);
        });
        
        return {
            produto: produto,
            movements: movements,
            totalMovements: movements.length,
            saldoAtual: saldoAtual
        };
        
    } catch (error) {
        console.error('❌ Erro ao buscar movimentações completas:', error);
        throw error;
    }
}

/**
 * Renderiza a timeline de movimentações
 * @param {Object} productData - Dados do produto e movimentações
 * @param {string} sku - SKU do produto
 * @returns {string} HTML da timeline
 */
function renderMovementTimeline(productData, sku) {
    const { produto, movements, saldoAtual } = productData;
    
    // Cabeçalho com informações do produto
    const headerHtml = `
        <div class="product-movement-header">
            <h4>
                <i class="fas fa-box"></i>
                📦 Histórico Completo - SKU: ${sku}
            </h4>
            <div class="movement-summary">
                <span>📊 Total de movimentações: <strong>${movements.length}</strong></span>
                <span>📈 Saldo atual: <strong class="${saldoAtual <= 0 ? 'negativo' : 'positivo'}">${saldoAtual}</strong></span>
                <span>🏷️ Produto: <strong>${produto.nome || 'Nome não encontrado'}</strong></span>
            </div>
        </div>
    `;
    
    // Timeline de movimentações
    const timelineHtml = movements.map(movement => `
        <div class="timeline-item">
            <div class="timeline-icon ${movement.tipo}">
                <i class="fas ${movement.tipo === 'entrada' ? 'fa-plus' : 'fa-minus'}"></i>
            </div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <h4>${movement.numeroSequencial}. ${movement.descricao}</h4>
                    <span class="timeline-date">${formatDateMovement(movement.data)}</span>
                </div>
                <div class="movement-details">
                    <div class="movement-info">
                        <span class="movement-quantity ${movement.tipo}">
                            ${movement.tipo === 'entrada' ? '+' : '-'}${movement.quantidade} unidades
                        </span>
                        <span class="movement-balance">
                            Saldo após: <strong>${movement.saldoApos}</strong>
                        </span>
                    </div>
                    ${movement.cliente ? `<div class="movement-client">${movement.cliente}</div>` : ''}
                    ${movement.venda_id ? `<div class="movement-sale">Venda #${movement.venda_id}</div>` : ''}
                    ${movement.origem === 'cadastro' ? `<div class="movement-origin">Estoque inicial</div>` : ''}
                    ${movement.detalhes ? `<p class="movement-description">${movement.detalhes}</p>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    return `
        ${headerHtml}
        <div class="timeline">
            ${timelineHtml}
        </div>
    `;
}

/**
 * Formata data para exibição na timeline
 * @param {string} dateString - Data em formato ISO
 * @returns {string} Data formatada
 */
function formatDateMovement(dateString) {
    if (!dateString) return 'Data não informada';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('❌ Erro ao formatar data:', dateString, error);
        return 'Data inválida';
    }
}

/**
 * Formata valor monetário para exibição
 * @param {number} value - Valor a ser formatado
 * @returns {string} Valor formatado
 */
function formatCurrencyMovement(value) {
    try {
        return parseFloat(value || 0).toFixed(2).replace('.', ',');
    } catch (error) {
        console.error('❌ Erro ao formatar moeda:', value, error);
        return '0,00';
    }
}

/**
 * Fecha o modal de movimentação
 */
function closeMovementModal() {
    const modal = document.getElementById('movement-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Event listeners para modal de movimentação (executado quando DOM carrega)
document.addEventListener('DOMContentLoaded', function() {
    // Injetar estilos CSS
    injectMovementStyles();
    
    const closeMovementBtn = document.getElementById('close-movement-modal');
    if (closeMovementBtn) {
        closeMovementBtn.addEventListener('click', closeMovementModal);
    }
    
    const movementModal = document.getElementById('movement-modal');
    if (movementModal) {
        movementModal.addEventListener('click', function(e) {
            if (e.target === movementModal) {
                closeMovementModal();
            }
        });
    }
});

// Exportar funções para uso global
window.showMovementModal = showMovementModal;
window.closeMovementModal = closeMovementModal;
window.fetchCompleteProductMovements = fetchCompleteProductMovements;

console.log('✅ Sistema de movimentação completa de produtos carregado');