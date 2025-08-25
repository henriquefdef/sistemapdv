// ultimas-vendas-devolucao.js - Sistema Profissional de Devoluções

async function confirmReturn() {
    console.log('↩️ Confirmando devolução completa da venda...');
    
    const reason = document.getElementById('return-reason').value;
    const notes = document.getElementById('return-notes').value;
    const saleNumber = document.getElementById('return-sale-number').textContent;
    
    if (!reason) {
        alert('Por favor, selecione o motivo da devolução.');
        return;
    }
    
    if (!saleNumber) {
        alert('Erro: Número da venda não encontrado.');
        return;
    }
    
    try {
        // Mostrar loading
        const confirmBtn = document.getElementById('confirm-return-btn');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        confirmBtn.disabled = true;
        
        console.log('🔄 Processando devolução completa para venda:', saleNumber);
        
        // 1. Buscar todos os itens desta venda
        const { data: itensVenda, error: fetchError } = await supabaseClient
            .from('vendas')
            .select('id, produto_sku, quantidade_unit, produto_nome, status')
            .eq('id_venda', saleNumber)
            .eq('id_empresa', window.currentCompanyId);
            
        if (fetchError) throw fetchError;
        
        if (!itensVenda || itensVenda.length === 0) {
            throw new Error('Nenhum item encontrado para esta venda.');
        }
        
        // VERIFICAR SE TODOS OS ITENS JÁ FORAM DEVOLVIDOS
        const itensJaDevolvidos = itensVenda.filter(item => item.status === 'DEVOLVIDO');
        if (itensJaDevolvidos.length === itensVenda.length) {
            alert('Todos os produtos desta venda já foram devolvidos anteriormente.');
            // Restaurar botão antes de retornar
            const confirmBtn = document.getElementById('confirm-return-btn');
            if (confirmBtn) {
                confirmBtn.innerHTML = '<i class="fas fa-undo"></i> Confirmar Devolução';
                confirmBtn.disabled = false;
            }
            return;
        }
        
        console.log(`📦 Encontrados ${itensVenda.length} itens para devolver`);
        
        // 2. Atualizar status de TODOS os itens para DEVOLVIDO
        const { error: updateError } = await supabaseClient
            .from('vendas')
            .update({
                status: 'DEVOLVIDO',
                motivo_devolucao: reason,
                observacoes_devolucao: notes || null,
                data_devolucao: new Date().toISOString()
            })
            .eq('id_venda', saleNumber)
            .eq('id_empresa', window.currentCompanyId);
            
        if (updateError) throw updateError;
        
        // 3. Atualizar estoque para cada item (devolver para o estoque)
        const estoquePromises = itensVenda.map(async (item) => {
            if (item.produto_sku && item.produto_sku !== 'N/A') {
                try {
                    console.log(`📦 Devolvendo ${item.quantidade_unit} unidades do SKU ${item.produto_sku} ao estoque`);
                    
                    // Buscar produto atual
                    const { data: produto, error: produtoError } = await supabaseClient
                        .from('produtos')
                        .select('quantidade_estoque')
                        .eq('codigo_sku', item.produto_sku)
                        .eq('id_empresa', window.currentCompanyId)
                        .single();
                        
                    if (!produtoError && produto) {
                        const novaQuantidade = (produto.quantidade_estoque || 0) + (item.quantidade_unit || 0);
                        
                        // Atualizar estoque
                        const { error: estoqueError } = await supabaseClient
                            .from('produtos')
                            .update({ 
                                quantidade_estoque: novaQuantidade,
                                updated_at: new Date().toISOString()
                            })
                            .eq('codigo_sku', item.produto_sku)
                            .eq('id_empresa', window.currentCompanyId);
                            
                        if (estoqueError) {
                            console.warn('⚠️ Erro ao atualizar estoque do SKU', item.produto_sku, ':', estoqueError);
                        } else {
                            console.log(`✅ Estoque atualizado: SKU ${item.produto_sku} → ${novaQuantidade} unidades`);
                        }
                    } else {
                        console.warn('⚠️ Produto não encontrado para atualizar estoque:', item.produto_sku);
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao processar estoque do item:', item.produto_sku, error);
                }
            }
        });
        
        // Aguardar todas as atualizações de estoque
        await Promise.all(estoquePromises);
        
        console.log('✅ Devolução completa processada com sucesso!');
        
        // Fechar modal
        document.getElementById('return-modal').classList.remove('show');
        
        // Mostrar sucesso
        showNotificationDevolucao(`Venda #${saleNumber} devolvida com sucesso! Estoque atualizado.`, 'success');
        
        // Recarregar lista de vendas
        await fetchSales();
        
    } catch (error) {
        console.error('❌ Erro ao processar devolução:', error);
        alert(`Erro ao processar devolução: ${error.message}`);
    } finally {
        // Restaurar botão
        const confirmBtn = document.getElementById('confirm-return-btn');
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fas fa-undo"></i> Confirmar Devolução';
            confirmBtn.disabled = false;
        }
    }
}

/**
 * CONFIRMA DEVOLUÇÃO DE ITEM ESPECÍFICO
 * Atualiza status apenas do item selecionado para "DEVOLVIDO"
 */
async function confirmItemReturn() {
    console.log('↩️ Confirmando devolução do item específico...');
    
    const itemId = document.getElementById('confirm-item-return-btn').dataset.itemId;
    const quantity = parseInt(document.getElementById('return-item-qty').value);
    const reason = document.getElementById('return-item-reason').value;
    const notes = document.getElementById('return-item-notes').value;
    
    if (!reason) {
        alert('Por favor, selecione o motivo da devolução.');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        alert('Por favor, informe uma quantidade válida.');
        return;
    }
    
    if (!itemId) {
        alert('Erro: ID do item não encontrado.');
        return;
    }
    
    try {
        // Mostrar loading
        const confirmBtn = document.getElementById('confirm-item-return-btn');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        confirmBtn.disabled = true;
        
        console.log('🔄 Processando devolução do item ID:', itemId);
        
        // 1. Buscar dados do item
        const { data: itemData, error: fetchError } = await supabaseClient
            .from('vendas')
            .select('*')
            .eq('id', itemId)
            .single();
            
        if (fetchError) throw fetchError;
        
        if (!itemData) {
            throw new Error('Item não encontrado.');
        }
        
        // VERIFICAR SE JÁ FOI DEVOLVIDO
        if (itemData.status === 'DEVOLVIDO') {
            alert('Este produto já foi devolvido anteriormente.');
            // Restaurar botão antes de retornar
            confirmBtn.innerHTML = '<i class="fas fa-undo"></i> Confirmar Devolução';
            confirmBtn.disabled = false;
            return;
        }
        
        console.log('📦 Item encontrado:', itemData.produto_nome);
        
        // Verificar quantidade disponível para devolução
        if (quantity > itemData.quantidade_unit) {
            throw new Error(`Quantidade inválida. Máximo disponível: ${itemData.quantidade_unit}`);
        }
        
        // 2. Se a quantidade devolvida é igual à vendida, marcar como DEVOLVIDO
        if (quantity === itemData.quantidade_unit) {
            console.log('📝 Devolução total do item - marcando como DEVOLVIDO');
            
            const { error: updateError } = await supabaseClient
                .from('vendas')
                .update({
                    status: 'DEVOLVIDO',
                    motivo_devolucao: reason,
                    observacoes_devolucao: notes || null,
                    data_devolucao: new Date().toISOString()
                })
                .eq('id', itemId);
                
            if (updateError) throw updateError;
            
        } else {
            // 3. Se é devolução parcial, criar nova entrada para a parte devolvida
            console.log('📝 Devolução parcial - criando entrada separada');
            
            // Atualizar quantidade do item original
            const novaQuantidadeOriginal = itemData.quantidade_unit - quantity;
            const { error: updateOriginalError } = await supabaseClient
                .from('vendas')
                .update({
                    quantidade_unit: novaQuantidadeOriginal,
                    subtotal_item: novaQuantidadeOriginal * itemData.preco_unitario,
                    updated_at: new Date().toISOString()
                })
                .eq('id', itemId);
                
            if (updateOriginalError) throw updateOriginalError;
            
            // Criar nova entrada para a parte devolvida
            const itemDevolvido = {
                ...itemData,
                id: undefined, // Remover ID para criar novo registro
                quantidade_unit: quantity,
                subtotal_item: quantity * itemData.preco_unitario,
                status: 'DEVOLVIDO',
                motivo_devolucao: reason,
                observacoes_devolucao: notes || null,
                data_devolucao: new Date().toISOString(),
                created_at: new Date().toISOString()
            };
            
            delete itemDevolvido.id; // Garantir que não tem ID
            
            const { error: insertError } = await supabaseClient
                .from('vendas')
                .insert([itemDevolvido]);
                
            if (insertError) throw insertError;
        }
        
        // 4. Atualizar estoque (devolver para o estoque)
        if (itemData.produto_sku && itemData.produto_sku !== 'N/A') {
            try {
                console.log(`📦 Devolvendo ${quantity} unidades do SKU ${itemData.produto_sku} ao estoque`);
                
                const { data: produto, error: produtoError } = await supabaseClient
                    .from('produtos')
                    .select('quantidade_estoque')
                    .eq('codigo_sku', itemData.produto_sku)
                    .eq('id_empresa', window.currentCompanyId)
                    .single();
                    
                if (!produtoError && produto) {
                    const novaQuantidade = (produto.quantidade_estoque || 0) + quantity;
                    
                    const { error: estoqueError } = await supabaseClient
                        .from('produtos')
                        .update({ 
                            quantidade_estoque: novaQuantidade,
                            updated_at: new Date().toISOString()
                        })
                        .eq('codigo_sku', itemData.produto_sku)
                        .eq('id_empresa', window.currentCompanyId);
                        
                    if (estoqueError) {
                        console.warn('⚠️ Erro ao atualizar estoque:', estoqueError);
                    } else {
                        console.log(`✅ Estoque atualizado: SKU ${itemData.produto_sku} → ${novaQuantidade} unidades`);
                    }
                } else {
                    console.warn('⚠️ Produto não encontrado para atualizar estoque:', itemData.produto_sku);
                }
            } catch (error) {
                console.warn('⚠️ Erro ao atualizar estoque:', error);
            }
        }
        
        console.log('✅ Devolução do item processada com sucesso!');
        
        // Fechar modal
        document.getElementById('item-return-modal').classList.remove('show');
        
        // Mostrar sucesso
        showNotificationDevolucao(`Item devolvido com sucesso! Quantidade: ${quantity} unidades.`, 'success');
        
        // Recarregar detalhes da venda se estiver aberto
        const saleDetailsModal = document.getElementById('sale-details-modal');
        if (saleDetailsModal && saleDetailsModal.classList.contains('show')) {
            const saleId = itemData.id_venda;
            console.log('🔄 Recarregando detalhes da venda:', saleId);
            await showSaleDetailsModal(saleId);
        }
        
        // Recarregar lista de vendas
        await fetchSales();
        
    } catch (error) {
        console.error('❌ Erro ao processar devolução do item:', error);
        alert(`Erro ao processar devolução: ${error.message}`);
    } finally {
        // Restaurar botão
        const confirmBtn = document.getElementById('confirm-item-return-btn');
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fas fa-undo"></i> Confirmar Devolução';
            confirmBtn.disabled = false;
        }
    }
}

/**
 * BUSCA DEVOLUÇÕES POR PERÍODO
 * Para relatórios e análises
 */
async function buscarDevolucoesPorPeriodo(dataInicio, dataFim) {
    try {
        console.log('📊 Buscando devoluções do período:', dataInicio, 'até', dataFim);
        
        let query = supabaseClient
            .from('vendas')
            .select(`
                id_venda,
                produto_nome,
                produto_sku,
                quantidade_unit,
                total_venda,
                motivo_devolucao,
                observacoes_devolucao,
                data_devolucao,
                cliente_nome
            `)
            .eq('id_empresa', window.currentCompanyId)
            .eq('status', 'DEVOLVIDO')
            .order('data_devolucao', { ascending: false });
            
        if (dataInicio) {
            query = query.gte('data_devolucao', dataInicio);
        }
        
        if (dataFim) {
            query = query.lte('data_devolucao', `${dataFim} 23:59:59`);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        console.log(`✅ Encontradas ${data?.length || 0} devoluções no período`);
        return data || [];
        
    } catch (error) {
        console.error('❌ Erro ao buscar devoluções:', error);
        throw error;
    }
}

/**
 * GERA RELATÓRIO DE DEVOLUÇÕES
 * Agrupa por motivo, produto, período etc.
 */
function gerarRelatorioDevoluções(devolucoes) {
    const relatorio = {
        totalDevolucoes: devolucoes.length,
        valorTotalDevolvido: devolucoes.reduce((acc, dev) => acc + (dev.total_venda || 0), 0),
        
        // Agrupar por motivo
        porMotivo: devolucoes.reduce((acc, dev) => {
            const motivo = dev.motivo_devolucao || 'Não informado';
            acc[motivo] = (acc[motivo] || 0) + 1;
            return acc;
        }, {}),
        
        // Agrupar por produto
        porProduto: devolucoes.reduce((acc, dev) => {
            const produto = dev.produto_nome || 'Produto não informado';
            if (!acc[produto]) {
                acc[produto] = { quantidade: 0, valores: 0 };
            }
            acc[produto].quantidade += dev.quantidade_unit || 0;
            acc[produto].valores += dev.total_venda || 0;
            return acc;
        }, {}),
        
        // Produtos mais devolvidos
        produtosMaisDevolvidos: Object.entries(
            devolucoes.reduce((acc, dev) => {
                const produto = dev.produto_nome || 'Produto não informado';
                acc[produto] = (acc[produto] || 0) + (dev.quantidade_unit || 0);
                return acc;
            }, {})
        ).sort(([,a], [,b]) => b - a).slice(0, 10)
    };
    
    return relatorio;
}

/**
 * VALIDAÇÃO DE DEVOLUÇÃO
 * Verifica se a devolução é possível
 */
function validarDevolucao(item, quantidadeDevolver) {
    const validacao = {
        valida: true,
        motivos: []
    };
    
    // Verificar se já foi devolvido
    if (item.status === 'DEVOLVIDO') {
        validacao.valida = false;
        validacao.motivos.push('Este item já foi devolvido anteriormente');
    }
    
    // Verificar quantidade
    if (quantidadeDevolver <= 0 || quantidadeDevolver > item.quantidade_unit) {
        validacao.valida = false;
        validacao.motivos.push(`Quantidade inválida. Disponível: ${item.quantidade_unit}`);
    }
    
    // Verificar prazo (se aplicável)
    const diasLimite = 30; // Configurável
    const dataVenda = new Date(item.hora_venda);
    const agora = new Date();
    const diasPassados = Math.floor((agora - dataVenda) / (1000 * 60 * 60 * 24));
    
    if (diasPassados > diasLimite) {
        validacao.valida = false;
        validacao.motivos.push(`Prazo para devolução expirado (${diasPassados} dias). Limite: ${diasLimite} dias`);
    }
    
    return validacao;
}

/**
 * MOSTRAR NOTIFICAÇÃO NA TELA
 * Sistema visual de notificações igual ao de adicionar produto
 */
function showNotificationDevolucao(message, type = 'success') {
    console.log(`📢 [${type.toUpperCase()}] ${message}`);
    
    // Remover notificação anterior se existir
    const existingNotification = document.querySelector('.notification-devolucao');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification-devolucao notification-${type}`;
    
    // Definir ícone baseado no tipo
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        default:
            icon = '<i class="fas fa-info-circle"></i>';
    }
    
    notification.innerHTML = `
        <div class="notification-content">
            ${icon}
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Adicionar estilos CSS se não existirem
    if (!document.getElementById('notification-styles-devolucao')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles-devolucao';
        styles.textContent = `
            .notification-devolucao {
                position: fixed;
                top: 20px;
                right: 20px;
                min-width: 350px;
                max-width: 500px;
                padding: 0;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 9999;
                animation: slideInRight 0.3s ease-out;
                font-family: 'Inter', sans-serif;
                border: none;
                overflow: hidden;
            }
            
            .notification-success {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
            }
            
            .notification-error {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
            }
            
            .notification-warning {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
            }
            
            .notification-info {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 20px;
                position: relative;
            }
            
            .notification-content i:first-child {
                font-size: 18px;
                flex-shrink: 0;
            }
            
            .notification-message {
                flex: 1;
                font-size: 14px;
                font-weight: 500;
                line-height: 1.4;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.8);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
            }
            
            .notification-close:hover {
                background: rgba(255, 255, 255, 0.2);
                color: white;
            }
            
            .notification-close i {
                font-size: 12px;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            .notification-devolucao.removing {
                animation: slideOutRight 0.3s ease-in forwards;
            }
            
            /* Responsividade */
            @media (max-width: 768px) {
                .notification-devolucao {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    min-width: auto;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Adicionar ao body
    document.body.appendChild(notification);
    
    // Auto remover após 5 segundos (exceto erros que ficam mais tempo)
    const autoRemoveTime = type === 'error' ? 8000 : 5000;
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.add('removing');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, autoRemoveTime);
}

// Exportar funções para uso global
window.confirmReturn = confirmReturn;
window.confirmItemReturn = confirmItemReturn;
window.buscarDevolucoesPorPeriodo = buscarDevolucoesPorPeriodo;
window.gerarRelatorioDevoluções = gerarRelatorioDevoluções;
window.validarDevolucao = validarDevolucao;

console.log('✅ Sistema profissional de devoluções carregado');
console.log('📋 Funções disponíveis:');
console.log('   - confirmReturn() → Devolução completa da venda');
console.log('   - confirmItemReturn() → Devolução de item específico');
console.log('   - buscarDevolucoesPorPeriodo() → Buscar devoluções por período');
console.log('   - gerarRelatorioDevoluções() → Gerar relatório de análise');
console.log('   - validarDevolucao() → Validar se devolução é possível');
