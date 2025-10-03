// ===== LÓGICA PARA CANCELAMENTO DE VENDAS =====

/**
 * Registra movimentação de estoque (entrada por cancelamento)
 * @param {Object} dados - Dados da movimentação
 */
async function registrarMovimentacaoEstoque(dados) {
    try {
        console.log('📋 Tentando registrar movimentação de estoque:', dados);
        console.log('👤 Usuário atual:', window.currentUser);
        console.log('🏢 Empresa atual:', window.currentCompanyId);
        
        const movimentacao = {
            produto_id: dados.produto_id,
            tipo_movimentacao: dados.tipo_movimentacao,
            quantidade: dados.quantidade,
            valor_unitario: dados.valor_unitario || null,
            valor_total: dados.valor_total || null,
            documento: dados.documento || null,
            fornecedor: dados.fornecedor || null,
            observacao: dados.observacao || null,
            auth_user_id: window.currentUser?.auth_user_id || window.currentUser?.id,
            id_empresa: window.currentCompanyId
        };
        
        console.log('📋 Dados da movimentação a ser inserida:', movimentacao);
        
        const { data, error } = await supabaseClient
            .from('estoque_movimentacoes')
            .insert([movimentacao]);

        if (error) {
            console.error('❌ Erro ao inserir movimentação:', error);
            throw error;
        }
        
        console.log('✅ Movimentação inserida com sucesso:', data);
        return { success: true, data };

    } catch (error) {
        console.error('❌ Erro na função registrarMovimentacaoEstoque:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Registra entrada de estoque por cancelamento de venda
 * @param {Object} itemVenda - Item da venda cancelada
 * @param {number} vendaId - ID da venda
 */
async function registrarEntradaCancelamento(itemVenda, vendaId) {
    try {
        // Buscar o produto_id usando o SKU da venda
        const { data: produto, error: produtoError } = await supabaseClient
            .from('produtos')
            .select('id')
            .eq('codigo_sku', itemVenda.produto_sku)
            .eq('id_empresa', window.currentCompanyId)
            .single();
            
        if (produtoError || !produto) {
            console.error('❌ Produto não encontrado para SKU:', itemVenda.produto_sku, produtoError);
            return { success: false, error: `Produto não encontrado para SKU: ${itemVenda.produto_sku}` };
        }
        
        console.log(`✅ Produto encontrado: ID ${produto.id} para SKU ${itemVenda.produto_sku}`);
        
        return await registrarMovimentacaoEstoque({
            produto_id: produto.id,
            tipo_movimentacao: 'entrada',
            quantidade: Math.abs(itemVenda.quantidade_unit || itemVenda.quantidade), // Sempre positivo para entrada
            valor_unitario: itemVenda.preco_unitario || itemVenda.produto_preco,
            valor_total: (itemVenda.quantidade_unit || itemVenda.quantidade) * (itemVenda.preco_unitario || itemVenda.produto_preco),
            documento: `Cancelamento Venda #${vendaId}`,
            observacao: `Cancelamento - ${itemVenda.produto_nome || 'Produto'}`,
        });
    } catch (error) {
        console.error('❌ Erro em registrarEntradaCancelamento:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Atualiza estoque do produto
 * @param {number} produtoId - ID do produto
 * @param {number} quantidadeAlterada - Quantidade a ser alterada (+ ou -)
 */
async function atualizarEstoqueProduto(produtoId, quantidadeAlterada) {
    try {
        const { data: produto, error: selectError } = await supabaseClient
            .from('produtos')
            .select('quantidade_estoque')
            .eq('id', produtoId)
            .single();

        if (selectError) throw selectError;

        const novoEstoque = (produto.quantidade_estoque || 0) + quantidadeAlterada;

        const { error: updateError } = await supabaseClient
            .from('produtos')
            .update({ quantidade_estoque: novoEstoque })
            .eq('id', produtoId);

        if (updateError) throw updateError;

        return { success: true, novoEstoque };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Cancela as vendas selecionadas
 * @param {Array} saleIds - Array com os IDs das vendas a serem canceladas
 */
async function cancelSelectedSales(saleIds) {
    console.log('🚫 Iniciando cancelamento de vendas:', saleIds);
    
    if (!saleIds || saleIds.length === 0) {
        console.warn('⚠️ Nenhuma venda selecionada para cancelamento');
        return;
    }
    
    try {
        // Mostrar loading
        const loadingModal = document.createElement('div');
        loadingModal.className = 'modal-overlay';
        loadingModal.innerHTML = `
            <div class="modal-content">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Cancelando vendas...</p>
                </div>
            </div>
        `;
        document.body.appendChild(loadingModal);
        loadingModal.classList.add('show');
        
        // Buscar todas as vendas que serão canceladas
        const { data: vendasParaCancelar, error: errorBusca } = await supabaseClient
            .from('vendas')
            .select('*')
            .in('id_venda', saleIds)
            .eq('id_empresa', window.currentCompanyId);
            
        if (errorBusca) {
            throw new Error(`Erro ao buscar vendas: ${errorBusca.message}`);
        }
        
        if (!vendasParaCancelar || vendasParaCancelar.length === 0) {
            throw new Error('Nenhuma venda encontrada para cancelamento');
        }
        
        console.log(`📋 ${vendasParaCancelar.length} itens de venda encontrados para cancelamento`);
        console.log('🔍 DEBUG - Dados da primeira venda:', vendasParaCancelar[0]);
        console.log('🔍 DEBUG - Campos disponíveis:', Object.keys(vendasParaCancelar[0] || {}));
        
        // Preparar dados para inserir na tabela canceladas
        const vendasCanceladas = vendasParaCancelar.map(venda => ({
            id_venda_original: venda.id_venda,
            id_empresa: venda.id_empresa,
            cliente_nome: venda.cliente_nome,
            cliente_telefone: venda.cliente_telefone,
            cliente_email: venda.cliente_email,
            cliente_cpf: venda.cliente_cpf,
            produto_id: venda.produto_id,
            produto_nome: venda.produto_nome,
            produto_sku: venda.produto_sku,
            produto_preco: venda.produto_preco,
            quantidade: venda.quantidade,
            desconto: venda.desconto,
            total_item: venda.total_item,
            total_venda: venda.total_venda,
            forma_pagamento: venda.forma_pagamento,
            vendedor_id: venda.vendedor_id,
            hora_venda: venda.hora_venda,
            observacoes: venda.observacoes,
            status_original: venda.status,
            data_cancelamento: new Date().toISOString(),
            cancelado_por: window.currentUser?.id || null,
            motivo_cancelamento: 'Cancelamento via sistema'
        }));
        
        // Inserir na tabela canceladas
        const { error: errorInsert } = await supabaseClient
            .from('vendas_canceladas')
            .insert(vendasCanceladas);
            
        if (errorInsert) {
            throw new Error(`Erro ao inserir vendas canceladas: ${errorInsert.message}`);
        }
        
        console.log('✅ Vendas inseridas na tabela canceladas');
        
        // Deletar da tabela vendas
        const { error: errorDelete } = await supabaseClient
            .from('vendas')
            .delete()
            .in('id_venda', saleIds)
            .eq('id_empresa', window.currentCompanyId);
            
        if (errorDelete) {
            throw new Error(`Erro ao deletar vendas: ${errorDelete.message}`);
        }
        
        console.log('✅ Vendas deletadas da tabela principal');
        
        // Deletar registros de cashback relacionados às vendas canceladas
        const { error: errorCashback } = await supabaseClient
            .from('cashback')
            .delete()
            .in('venda_id', saleIds)
            .eq('id_empresa', window.currentCompanyId);
            
        if (errorCashback) {
            console.warn('⚠️ Erro ao deletar cashback:', errorCashback.message);
            // Não interrompe o processo, apenas registra o aviso
        } else {
            console.log('✅ Registros de cashback deletados');
        }
        
        // Deletar registros de crediário relacionados às vendas canceladas
        const { error: errorCrediario } = await supabaseClient
            .from('crediario')
            .delete()
            .in('venda_id', saleIds)
            .eq('id_empresa', window.currentCompanyId);
            
        if (errorCrediario) {
            console.warn('⚠️ Erro ao deletar crediário:', errorCrediario.message);
            // Não interrompe o processo, apenas registra o aviso
        } else {
            console.log('✅ Registros de crediário deletados');
        }
        
        // Nota: Não deletamos as movimentações de saída originais, pois elas representam o histórico.
        // Ao invés disso, criaremos movimentações de entrada para compensar o cancelamento.
        console.log('📋 Movimentações de saída originais mantidas para histórico');
        
        // Reverter estoque dos produtos (devolver ao estoque)
        console.log(`🔄 Iniciando reversão de estoque para ${vendasParaCancelar.length} itens...`);
        for (const venda of vendasParaCancelar) {
            try {
                console.log(`📦 Revertendo estoque: Produto ID ${venda.produto_id} (${venda.produto_nome}) - Quantidade: +${venda.quantidade}`);
                
                // 1. Primeiro registrar a movimentação de entrada no estoque
                console.log(`🔄 Chamando registrarEntradaCancelamento para produto ${venda.produto_nome}`);
                const movimentacao = await registrarEntradaCancelamento(venda, venda.id_venda);
                console.log(`📊 Resultado da movimentação:`, movimentacao);
                
                if (!movimentacao.success) {
                    console.error(`❌ ERRO ao registrar movimentação de estoque para ${venda.produto_nome}:`, movimentacao.error);
                } else {
                    console.log(`✅ Movimentação de entrada registrada com SUCESSO para ${venda.produto_nome}`);
                }
                
                // 2. Depois atualizar o estoque do produto (buscar ID pelo SKU)
                const { data: produtoEstoque, error: estoqueError } = await supabaseClient
                    .from('produtos')
                    .select('id')
                    .eq('codigo_sku', venda.produto_sku)
                    .eq('id_empresa', window.currentCompanyId)
                    .single();
                    
                if (estoqueError || !produtoEstoque) {
                    console.warn(`⚠️ Produto não encontrado para atualizar estoque. SKU: ${venda.produto_sku}`);
                    continue;
                }
                
                const resultado = await atualizarEstoqueProduto(produtoEstoque.id, venda.quantidade_unit || venda.quantidade);
                    
                if (!resultado.success) {
                    console.warn(`⚠️ Erro ao reverter estoque do produto ${venda.produto_nome}:`, resultado.error);
                } else {
                    console.log(`✅ Estoque revertido para ${venda.produto_nome}: +${venda.quantidade} (novo estoque: ${resultado.novoEstoque})`);
                }
            } catch (error) {
                console.warn(`⚠️ Erro ao reverter estoque do produto ${venda.produto_nome}:`, error.message);
            }
        }
        console.log('🔄 Reversão de estoque concluída!');
        
        // Remover loading
        document.body.removeChild(loadingModal);
        
        // Mostrar sucesso
        showSuccessMessage(`${saleIds.length} venda(s) cancelada(s) com sucesso!`);
        
        // Limpar seleções e recarregar dados
        state.selectedIds.clear();
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
        
        // Recarregar a lista de vendas
        await fetchSales();
        
        // Aguardar um pouco para garantir que as atualizações do banco sejam processadas
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Recarregar lista de produtos se estiver disponível (caso esteja na página de produtos)
        if (typeof window.fetchProducts === 'function') {
            try {
                await window.fetchProducts();
                console.log('✅ Lista de produtos atualizada após cancelamento');
            } catch (error) {
                console.warn('⚠️ Erro ao atualizar lista de produtos:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao cancelar vendas:', error);
        
        // Remover loading se existir
        const loadingModal = document.querySelector('.modal-overlay');
        if (loadingModal) {
            document.body.removeChild(loadingModal);
        }
        
        // Mostrar erro
        showErrorMessage(`Erro ao cancelar vendas: ${error.message}`);
    }
}

/**
 * Mostra mensagem de sucesso
 * @param {string} message - Mensagem a ser exibida
 */
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remover após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

/**
 * Mostra mensagem de erro
 * @param {string} message - Mensagem a ser exibida
 */
function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remover após 5 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

console.log('🚫 Módulo de cancelamento de vendas carregado');