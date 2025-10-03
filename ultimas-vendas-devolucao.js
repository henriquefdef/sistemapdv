// ultimas-vendas-devolucao.js - Sistema Profissional de Devoluções

/**
 * Registra movimentação de estoque (entrada por devolução)
 * @param {Object} dados - Dados da movimentação
 */
async function registrarMovimentacaoEstoqueDevolucao(dados) {
    try {
        console.log('🔄 INICIANDO registro de movimentação de estoque (devolução)...');
        console.log('📋 Dados recebidos para movimentação:', dados);
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
        
        console.log('📊 Dados da movimentação preparados para inserção:', movimentacao);
        console.log('💾 Inserindo movimentação na tabela estoque_movimentacoes...');
        
        const { data, error } = await supabaseClient
            .from('estoque_movimentacoes')
            .insert([movimentacao]);

        if (error) {
            console.error('❌ ERRO ao inserir movimentação no banco:', error);
            console.error('❌ Detalhes do erro:', error.message);
            throw error;
        }
        
        console.log('✅ SUCESSO - Movimentação de estoque inserida com sucesso!');
        console.log('📊 Dados da movimentação inserida:', data);
        return { success: true, data };

    } catch (error) {
        console.error('❌ ERRO GERAL na função registrarMovimentacaoEstoqueDevolucao:', error);
        console.error('❌ Stack trace:', error.stack);
        return { success: false, error: error.message };
    }
}

/**
 * Atualiza o estoque do produto na tabela produtos
 * @param {number} produtoId - ID do produto
 * @param {number} quantidadeAlterada - Quantidade a ser alterada (positiva para entrada, negativa para saída)
 */
async function atualizarEstoqueProduto(produtoId, quantidadeAlterada) {
    try {
        console.log('🔄 INICIANDO atualização de estoque do produto...');
        console.log('📋 Produto ID:', produtoId, 'Quantidade alterada:', quantidadeAlterada);
        
        const { data: produto, error: selectError } = await supabaseClient
            .from('produtos')
            .select('quantidade_estoque')
            .eq('id', produtoId)
            .single();

        if (selectError) {
            console.error('❌ ERRO ao buscar produto:', selectError);
            throw selectError;
        }
        
        console.log('📊 Estoque atual do produto:', produto.quantidade_estoque);

        const novoEstoque = (produto.quantidade_estoque || 0) + quantidadeAlterada;
        console.log('📊 Novo estoque calculado:', novoEstoque);

        const { error: updateError } = await supabaseClient
            .from('produtos')
            .update({ quantidade_estoque: novoEstoque })
            .eq('id', produtoId);

        if (updateError) {
            console.error('❌ ERRO ao atualizar estoque:', updateError);
            throw updateError;
        }
        
        console.log('✅ SUCESSO - Estoque do produto atualizado!');
        console.log('📊 Estoque anterior:', produto.quantidade_estoque, '→ Novo estoque:', novoEstoque);

        return { success: true, novoEstoque };

    } catch (error) {
        console.error('❌ ERRO GERAL em atualizarEstoqueProduto:', error);
        console.error('❌ Stack trace:', error.stack);
        return { success: false, error: error.message };
    }
}

/**
 * Registra entrada de estoque por devolução
 * @param {Object} itemVenda - Item da venda devolvida
 * @param {number} vendaId - ID da venda
 * @param {number} quantidade - Quantidade devolvida
 */
async function registrarEntradaDevolucao(itemVenda, vendaId, quantidade) {
    try {
        console.log('🔄 INICIANDO registro de entrada de devolução...');
        console.log('📋 Dados recebidos para entrada:', { itemVenda, vendaId, quantidade });
        console.log('👤 Usuário atual:', window.currentUser);
        console.log('🏢 Empresa atual:', window.currentCompanyId);
        
        if (!window.currentUser || !window.currentCompanyId) {
            console.error('❌ ERRO: Usuário ou empresa não identificados');
            console.error('❌ currentUser:', window.currentUser);
            console.error('❌ currentCompanyId:', window.currentCompanyId);
            throw new Error('Usuário ou empresa não identificados');
        }
        
        // Buscar o produto_id usando o SKU da venda
        console.log(`🔍 Buscando produto com SKU: ${itemVenda.produto_sku}`);
        const { data: produto, error: produtoError } = await supabaseClient
            .from('produtos')
            .select('id')
            .eq('codigo_sku', itemVenda.produto_sku)
            .eq('id_empresa', window.currentCompanyId)
            .single();
            
        if (produtoError || !produto) {
            console.error('❌ ERRO: Produto não encontrado para SKU:', itemVenda.produto_sku, produtoError);
            return { success: false, error: `Produto não encontrado para SKU: ${itemVenda.produto_sku}` };
        }
        
        console.log(`✅ SUCESSO: Produto encontrado - ID ${produto.id} para SKU ${itemVenda.produto_sku}`);
        
        console.log('🔄 Chamando registrarMovimentacaoEstoqueDevolucao...');
        const resultado = await registrarMovimentacaoEstoqueDevolucao({
            produto_id: produto.id,
            tipo_movimentacao: 'entrada',
            quantidade: Math.abs(quantidade), // Sempre positivo para entrada
            valor_unitario: itemVenda.produto_preco,
            valor_total: quantidade * itemVenda.produto_preco,
            documento: `Devolução Venda #${vendaId}`,
            observacao: `Devolução - ${itemVenda.produto_nome || 'Produto'}`,
        });
        
        console.log('📊 Resultado da movimentação de estoque:', resultado);
        
        if (resultado.success) {
            console.log('🔄 Atualizando estoque do produto na tabela produtos...');
            const resultadoEstoque = await atualizarEstoqueProduto(produto.id, Math.abs(quantidade));
            console.log('📊 Resultado da atualização do estoque:', resultadoEstoque);
            
            if (!resultadoEstoque.success) {
                console.error('❌ ERRO: Movimentação registrada mas estoque não atualizado!');
                return { success: false, error: 'Movimentação registrada mas estoque não foi atualizado: ' + resultadoEstoque.error };
            }
        }
        
        return resultado;
    } catch (error) {
        console.error('❌ ERRO GERAL em registrarEntradaDevolucao:', error);
        console.error('❌ Stack trace:', error.stack);
        return { success: false, error: error.message };
    }
}

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
        
        // 2. Buscar e deletar registros de cashback relacionados à venda devolvida
        console.log('🔄 Removendo registros de cashback da venda devolvida...');
        
        // Primeiro buscar os registros para mostrar o valor total
        const { data: cashbackRecords, error: fetchCashbackError } = await supabaseClient
            .from('cashback')
            .select('*')
            .eq('venda_id', saleNumber)
            .eq('id_empresa', window.currentCompanyId);
            
        if (!fetchCashbackError && cashbackRecords && cashbackRecords.length > 0) {
            const valorTotalCashback = cashbackRecords.reduce((total, cb) => total + cb.valor, 0);
            console.log(`💳 Cashback total da venda a ser removido: R$ ${valorTotalCashback.toFixed(2)}`);
            
            // Buscar o saldo atual do cliente para criar registro de débito
            const clienteId = cashbackRecords[0].cliente_id;
            const { data: ultimoRegistro } = await supabaseClient
                .from('cashback')
                .select('saldo_atual')
                .eq('cliente_id', clienteId)
                .eq('id_empresa', window.currentCompanyId)
                .order('created_at', { ascending: false })
                .limit(1);
            
            const saldoAnterior = ultimoRegistro?.[0]?.saldo_atual || 0;
            
            // Deletar os registros de cashback da venda
            const { error: errorCashback } = await supabaseClient
                .from('cashback')
                .delete()
                .eq('venda_id', saleNumber)
                .eq('id_empresa', window.currentCompanyId);
                
            if (errorCashback) {
                console.warn('⚠️ Erro ao deletar cashback:', errorCashback.message);
                // Não interrompe o processo, apenas registra o aviso
            } else {
                // Criar registro de débito para ajustar o saldo_atual
                const novoSaldo = saldoAnterior - valorTotalCashback;
                
                await supabaseClient
                    .from('cashback')
                    .insert([{
                        cliente_id: clienteId,
                        venda_id: saleNumber,
                        tipo_operacao: 'debito',
                        valor: valorTotalCashback,
                        saldo_anterior: saldoAnterior,
                        saldo_atual: novoSaldo,
                        descricao: `Devolução completa da venda #${saleNumber}`,
                        id_empresa: window.currentCompanyId,
                        auth_user_id: window.currentUser?.auth_user_id
                    }]);
                
                console.log(`✅ Cashback removido completamente: R$ ${valorTotalCashback.toFixed(2)}`);
                console.log(`💰 Saldo de cashback atualizado: R$ ${saldoAnterior.toFixed(2)} → R$ ${novoSaldo.toFixed(2)}`);
            }
        } else {
            console.log('ℹ️ Nenhum cashback encontrado para esta venda');
        }
        
        // 3. Buscar e deletar registros de crediário relacionados à venda devolvida
        console.log('🔄 Removendo registros de crediário da venda devolvida...');
        
        // Primeiro buscar os registros para mostrar o valor total
        const { data: crediarioRecords, error: fetchCrediarioError } = await supabaseClient
            .from('crediario')
            .select('*')
            .eq('venda_id', saleNumber)
            .eq('id_empresa', window.currentCompanyId);
            
        if (!fetchCrediarioError && crediarioRecords && crediarioRecords.length > 0) {
            const valorTotalCrediario = crediarioRecords.reduce((total, cr) => total + cr.valor_parcela, 0);
            console.log(`💳 Crediário total da venda a ser removido: R$ ${valorTotalCrediario.toFixed(2)}`);
            
            // Agora deletar os registros
            const { error: errorCrediario } = await supabaseClient
                .from('crediario')
                .delete()
                .eq('venda_id', saleNumber)
                .eq('id_empresa', window.currentCompanyId);
                
            if (errorCrediario) {
                console.warn('⚠️ Erro ao deletar crediário:', errorCrediario.message);
                // Não interrompe o processo, apenas registra o aviso
            } else {
                console.log(`✅ Crediário removido completamente: R$ ${valorTotalCrediario.toFixed(2)}`);
            }
        } else {
            console.log('ℹ️ Nenhum crediário encontrado para esta venda');
        }
        
        // 4. Atualizar status de TODOS os itens para DEVOLVIDO
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
        
        // 5. Registrar movimentações e atualizar estoque para cada item (devolver para o estoque)
        const estoquePromises = itensVenda.map(async (item) => {
            if (item.produto_sku && item.produto_sku !== 'N/A') {
                try {
                    console.log(`📦 Devolvendo ${item.quantidade_unit} unidades do SKU ${item.produto_sku} ao estoque`);
                    
                    // 1. Primeiro registrar a movimentação de entrada no estoque
                    console.log(`🔄 Chamando registrarEntradaDevolucao para produto ${item.produto_nome}`);
                    const movimentacao = await registrarEntradaDevolucao(item, saleNumber, item.quantidade_unit || 0);
                    console.log(`📊 Resultado da movimentação:`, movimentacao);
                    
                    if (!movimentacao.success) {
                        console.error(`❌ ERRO ao registrar movimentação de estoque para ${item.produto_nome}:`, movimentacao.error);
                    } else {
                        console.log(`✅ Movimentação de entrada registrada com SUCESSO para ${item.produto_nome}`);
                    }
                    
                    // 2. Depois atualizar o estoque do produto
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
        
        // Processamento das atualizações do banco concluído
        console.log('🔄 Processamento das atualizações no banco concluído');
        
        // Recarregar lista de produtos se estiver disponível (caso esteja na página de produtos)
        console.log('🔍 Verificando se window.fetchProducts está disponível:', typeof window.fetchProducts);
        if (typeof window.fetchProducts === 'function') {
            try {
                console.log('📋 Iniciando atualização da lista de produtos após devolução de item...');
                await window.fetchProducts();
                console.log('✅ Lista de produtos atualizada com SUCESSO após devolução de item');
            } catch (error) {
                console.error('❌ ERRO ao atualizar lista de produtos após devolução de item:', error);
                console.error('❌ Stack trace:', error.stack);
            }
        } else {
            console.warn('⚠️ window.fetchProducts não está disponível - lista de produtos não será atualizada automaticamente');
        }
        
        // Processamento das atualizações do banco concluído
        console.log('🔄 Processamento das atualizações no banco concluído');
        
        // Recarregar lista de produtos se estiver disponível (caso esteja na página de produtos)
        console.log('🔍 Verificando se window.fetchProducts está disponível:', typeof window.fetchProducts);
        if (typeof window.fetchProducts === 'function') {
            try {
                console.log('📋 Iniciando atualização da lista de produtos após devolução completa...');
                await window.fetchProducts();
                console.log('✅ Lista de produtos atualizada com SUCESSO após devolução completa');
            } catch (error) {
                console.error('❌ ERRO ao atualizar lista de produtos após devolução completa:', error);
                console.error('❌ Stack trace:', error.stack);
            }
        } else {
            console.warn('⚠️ window.fetchProducts não está disponível - lista de produtos não será atualizada automaticamente');
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar devolução:', error);
        alert(`Erro ao processar devolução: ${error.message}`);
    } finally {
        // Restaurar botão
        const confirmBtn = document.getElementById('confirm-return-btn');
        if (confirmBtn) {
            confirmBtn.innerHTML = originalText;
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
        
        // 2. Ajustar cashback proporcionalmente ao valor do item devolvido
        console.log('🔄 Ajustando cashback proporcional baseado no valor do item devolvido...');
        
        // Primeiro, buscar o valor total da venda para calcular a proporção correta
        const { data: todosItensVenda, error: fetchItensError } = await supabaseClient
            .from('vendas')
            .select('subtotal_item')
            .eq('id_venda', itemData.id_venda)
            .eq('id_empresa', window.currentCompanyId);
            
        if (!fetchItensError && todosItensVenda && todosItensVenda.length > 0) {
            const valorTotalVenda = todosItensVenda.reduce((total, item) => total + (item.subtotal_item || 0), 0);
            const valorItemDevolvido = quantity * itemData.preco_unitario;
            const proporcaoValor = valorItemDevolvido / valorTotalVenda; // Proporção baseada no valor
            
            console.log(`💰 Valor total da venda: R$ ${valorTotalVenda}`);
            console.log(`💰 Valor do item devolvido: R$ ${valorItemDevolvido}`);
            console.log(`📊 Proporção por valor: ${(proporcaoValor * 100).toFixed(2)}%`);
            
            const { data: cashbackRecords, error: fetchCashbackError } = await supabaseClient
                .from('cashback')
                .select('*')
                .eq('venda_id', itemData.id_venda)
                .eq('id_empresa', window.currentCompanyId);
                
            if (!fetchCashbackError && cashbackRecords && cashbackRecords.length > 0) {
                const valorTotalCashback = cashbackRecords.reduce((total, cb) => total + cb.valor, 0);
                console.log(`💳 Cashback total da venda: R$ ${valorTotalCashback.toFixed(2)}`);
                
                let valorTotalCashbackRemovido = 0;
                
                // Buscar o saldo atual do cliente para criar registro de débito
                const { data: ultimoRegistro } = await supabaseClient
                    .from('cashback')
                    .select('saldo_atual, cliente_id')
                    .eq('cliente_id', cashbackRecords[0].cliente_id)
                    .eq('id_empresa', window.currentCompanyId)
                    .order('created_at', { ascending: false })
                    .limit(1);
                
                const saldoAnterior = ultimoRegistro?.[0]?.saldo_atual || 0;
                const clienteId = cashbackRecords[0].cliente_id;
                
                for (const cashback of cashbackRecords) {
                    const valorCashbackProporcional = cashback.valor * proporcaoValor;
                    const novoValorCashback = cashback.valor - valorCashbackProporcional;
                    
                    valorTotalCashbackRemovido += valorCashbackProporcional;
                    
                    if (novoValorCashback <= 0.01) { // Considera valores muito pequenos como zero
                        // Se o valor ficar zero ou negativo, deletar o registro
                        await supabaseClient
                            .from('cashback')
                            .delete()
                            .eq('id', cashback.id);
                        console.log(`✅ Cashback deletado completamente: R$ ${cashback.valor.toFixed(2)}`);
                    } else {
                        // Atualizar com o novo valor
                        await supabaseClient
                            .from('cashback')
                            .update({ valor: parseFloat(novoValorCashback.toFixed(2)) })
                            .eq('id', cashback.id);
                        console.log(`✅ Cashback ajustado: R$ ${cashback.valor.toFixed(2)} → R$ ${novoValorCashback.toFixed(2)}`);
                    }
                }
                
                // Criar registro de débito para ajustar o saldo_atual
                if (valorTotalCashbackRemovido > 0) {
                    const novoSaldo = saldoAnterior - valorTotalCashbackRemovido;
                    
                    await supabaseClient
                        .from('cashback')
                        .insert([{
                            cliente_id: clienteId,
                            venda_id: itemData.id_venda,
                            tipo_operacao: 'debito',
                            valor: valorTotalCashbackRemovido,
                            saldo_anterior: saldoAnterior,
                            saldo_atual: novoSaldo,
                            descricao: `Devolução parcial - Item: ${itemData.produto_nome}`,
                            id_empresa: window.currentCompanyId,
                            auth_user_id: window.currentUser?.auth_user_id
                        }]);
                    
                    console.log(`💰 Saldo de cashback atualizado: R$ ${saldoAnterior.toFixed(2)} → R$ ${novoSaldo.toFixed(2)}`);
                }
                
                console.log(`🔻 Valor total de cashback removido: R$ ${valorTotalCashbackRemovido.toFixed(2)}`);
                console.log(`💰 Cashback restante na venda: R$ ${(valorTotalCashback - valorTotalCashbackRemovido).toFixed(2)}`);
            } else {
                console.log('ℹ️ Nenhum cashback encontrado para esta venda');
            }
        }
        
        // 3. Ajustar crediário proporcionalmente ao valor do item devolvido
        console.log('🔄 Ajustando crediário proporcional baseado no valor do item devolvido...');
        
        // Usar a mesma proporção por valor calculada acima
        if (!fetchItensError && todosItensVenda && todosItensVenda.length > 0) {
            const valorTotalVenda = todosItensVenda.reduce((total, item) => total + (item.subtotal_item || 0), 0);
            const valorItemDevolvido = quantity * itemData.preco_unitario;
            const proporcaoValor = valorItemDevolvido / valorTotalVenda; // Proporção baseada no valor
            
            const { data: crediarioRecords, error: fetchCrediarioError } = await supabaseClient
                .from('crediario')
                .select('*')
                .eq('venda_id', itemData.id_venda)
                .eq('id_empresa', window.currentCompanyId);
                
            if (!fetchCrediarioError && crediarioRecords && crediarioRecords.length > 0) {
                const valorTotalCrediario = crediarioRecords.reduce((total, cr) => total + cr.valor_parcela, 0);
                console.log(`💳 Crediário total da venda: R$ ${valorTotalCrediario.toFixed(2)}`);
                
                let valorTotalCrediarioRemovido = 0;
                
                for (const crediario of crediarioRecords) {
                    const valorCrediarioProporcional = crediario.valor_parcela * proporcaoValor;
                    const novoValorCrediario = crediario.valor_parcela - valorCrediarioProporcional;
                    
                    valorTotalCrediarioRemovido += valorCrediarioProporcional;
                    
                    if (novoValorCrediario <= 0.01) { // Considera valores muito pequenos como zero
                        // Se o valor ficar zero ou negativo, deletar o registro
                        await supabaseClient
                            .from('crediario')
                            .delete()
                            .eq('id', crediario.id);
                        console.log(`✅ Crediário deletado completamente: R$ ${crediario.valor_parcela.toFixed(2)}`);
                    } else {
                        // Atualizar com o novo valor
                        await supabaseClient
                            .from('crediario')
                            .update({ valor_parcela: parseFloat(novoValorCrediario.toFixed(2)) })
                            .eq('id', crediario.id);
                        console.log(`✅ Crediário ajustado: R$ ${crediario.valor_parcela.toFixed(2)} → R$ ${novoValorCrediario.toFixed(2)}`);
                    }
                }
                
                console.log(`🔻 Valor total de crediário removido: R$ ${valorTotalCrediarioRemovido.toFixed(2)}`);
                console.log(`💰 Crediário restante na venda: R$ ${(valorTotalCrediario - valorTotalCrediarioRemovido).toFixed(2)}`);
            } else {
                console.log('ℹ️ Nenhum crediário encontrado para esta venda');
            }
        }
        
        // 4. Se a quantidade devolvida é igual à vendida, marcar como DEVOLVIDO
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
            // 5. Se é devolução parcial, criar nova entrada para a parte devolvida
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
        
        // 6. Registrar movimentação e atualizar estoque (devolver para o estoque)
        if (itemData.produto_sku && itemData.produto_sku !== 'N/A') {
            try {
                console.log(`📦 Devolvendo ${quantity} unidades do SKU ${itemData.produto_sku} ao estoque`);
                
                // 1. Primeiro registrar a movimentação de entrada no estoque
                console.log(`🔄 Chamando registrarEntradaDevolucao para produto ${itemData.produto_nome}`);
                const movimentacao = await registrarEntradaDevolucao(itemData, itemData.id_venda || 'N/A', quantity);
                console.log(`📊 Resultado da movimentação:`, movimentacao);
                
                if (!movimentacao.success) {
                    console.error(`❌ ERRO ao registrar movimentação de estoque para ${itemData.produto_nome}:`, movimentacao.error);
                } else {
                    console.log(`✅ Movimentação de entrada registrada com SUCESSO para ${itemData.produto_nome}`);
                }
                
                // 2. Depois atualizar o estoque do produto
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
            confirmBtn.innerHTML = originalText;
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
function gerarRelatorioDevolucoes(devolucoes) {
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
window.gerarRelatorioDevolucoes = gerarRelatorioDevolucoes;
window.validarDevolucao = validarDevolucao;

console.log('✅ Sistema profissional de devoluções carregado');
console.log('📋 Funções disponíveis:');
console.log('   - confirmReturn() → Devolução completa da venda');
console.log('   - confirmItemReturn() → Devolução de item específico');
console.log('   - buscarDevolucoesPorPeriodo() → Buscar devoluções por período');
console.log('   - gerarRelatorioDevolucoes() → Gerar relatório de análise');
console.log('   - validarDevolucao() → Validar se devolução é possível');
