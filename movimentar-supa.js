// ===== MOVIMENTAR ESTOQUE - OPERAÇÕES SUPABASE =====

/**
 * Busca produto no banco de dados
 * @param {string} searchTerm - Termo de busca (código de barras, SKU ou nome)
 * @returns {Object} - Resultado da busca
 */
async function searchProductInDatabase(searchTerm) {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .or(`codigo_barras.eq.${searchTerm},codigo_sku.eq.${searchTerm},nome.ilike.%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        return { success: true, data };

    } catch (error) {
        console.error('Erro ao buscar produto no banco:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Registra uma movimentação de estoque
 * @param {Object} movementData - Dados da movimentação
 * @returns {Object} - Resultado da operação
 */
async function registerMovement(movementData) {
    try {
        // Registrar movimentação
        const { data: movement, error: movementError } = await supabaseClient
            .from('estoque_movimentacoes')
            .insert([movementData]);

        if (movementError) throw movementError;

        // Atualizar estoque do produto
        const novoEstoque = (currentProduct.quantidade_estoque || 0) + movementData.quantidade;
        
        const { error: updateError } = await supabaseClient
            .from('produtos')
            .update({ quantidade_estoque: novoEstoque })
            .eq('id', movementData.produto_id);

        if (updateError) throw updateError;

        console.log(`Movimentação registrada: ${movementData.tipo_movimentacao} - ${movementData.quantidade} unidades`);
        
        return { 
            success: true, 
            data: movement,
            newStock: novoEstoque
        };

    } catch (error) {
        console.error('Erro ao registrar movimentação:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verifica se há movimentação duplicada recente
 * @param {Object} movementData - Dados da movimentação
 * @returns {Object} - Resultado da verificação
 */
async function checkForDuplicateMovement(movementData) {
    try {
        const fiveSecondsAgo = new Date();
        fiveSecondsAgo.setSeconds(fiveSecondsAgo.getSeconds() - 5);

        const { data, error } = await supabaseClient
            .from('estoque_movimentacoes')
            .select('id')
            .eq('produto_id', movementData.produto_id)
            .eq('tipo_movimentacao', movementData.tipo_movimentacao)
            .eq('quantidade', movementData.quantidade)
            .eq('auth_user_id', movementData.auth_user_id)
            .eq('id_empresa', movementData.id_empresa)
            .gte('created_at', fiveSecondsAgo.toISOString())
            .limit(1);

        if (error) {
            console.error('Erro ao verificar duplicata:', error);
            return { success: false, isDuplicate: false };
        }

        return { 
            success: true, 
            isDuplicate: data && data.length > 0 
        };

    } catch (error) {
        console.error('Erro na verificação de duplicata:', error);
        return { success: false, isDuplicate: false };
    }
}

/**
 * Busca movimentações de um produto específico
 * @param {number} productId - ID do produto
 * @returns {Object} - Resultado da busca
 */
async function getProductMovements(productId) {
    try {
        const { data, error } = await supabaseClient
            .from('estoque_movimentacoes')
            .select(`
                *,
                produtos(nome, codigo_sku)
            `)
            .eq('produto_id', productId)
            .eq('id_empresa', window.currentCompanyId)
            .order('created_at', { ascending: false })
            .limit(20); // Limitar a 20 movimentações mais recentes

        if (error) throw error;

        console.log(`Carregadas ${data.length} movimentações para o produto ${productId}`);
        
        return { success: true, data };

    } catch (error) {
        console.error('Erro ao buscar movimentações do produto:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Busca histórico completo de movimentações (para relatórios)
 * @param {Object} filters - Filtros de busca
 * @returns {Object} - Resultado da busca
 */
async function getMovementsHistory(filters = {}) {
    try {
        let query = supabaseClient
            .from('estoque_movimentacoes')
            .select(`
                *,
                produtos(nome, codigo_sku, codigo_barras)
            `)
            .eq('id_empresa', window.currentCompanyId);

        // Aplicar filtros
        if (filters.productId) {
            query = query.eq('produto_id', filters.productId);
        }

        if (filters.type) {
            query = query.eq('tipo_movimentacao', filters.type);
        }

        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate);
        }

        if (filters.endDate) {
            query = query.lte('created_at', filters.endDate);
        }

        if (filters.document) {
            query = query.ilike('documento', `%${filters.document}%`);
        }

        // Ordenação
        const orderBy = filters.orderBy || 'created_at';
        const ascending = filters.ascending !== undefined ? filters.ascending : false;
        query = query.order(orderBy, { ascending });

        // Limite
        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        return { success: true, data };

    } catch (error) {
        console.error('Erro ao buscar histórico de movimentações:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Calcula estatísticas de movimentações
 * @param {number} productId - ID do produto (opcional)
 * @param {Object} dateRange - Período de análise
 * @returns {Object} - Estatísticas
 */
async function getMovementStats(productId = null, dateRange = {}) {
    try {
        let query = supabaseClient
            .from('estoque_movimentacoes')
            .select('tipo_movimentacao, quantidade, valor_total, created_at')
            .eq('id_empresa', window.currentCompanyId);

        if (productId) {
            query = query.eq('produto_id', productId);
        }

        if (dateRange.start) {
            query = query.gte('created_at', dateRange.start);
        }

        if (dateRange.end) {
            query = query.lte('created_at', dateRange.end);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Calcular estatísticas
        const stats = {
            total_movimentacoes: data.length,
            entradas: {
                quantidade: 0,
                valor: 0,
                count: 0
            },
            saidas: {
                quantidade: 0,
                valor: 0,
                count: 0
            },
            ajustes: {
                quantidade: 0,
                count: 0
            }
        };

        data.forEach(movement => {
            switch (movement.tipo_movimentacao) {
                case 'entrada':
                    stats.entradas.quantidade += movement.quantidade;
                    stats.entradas.valor += movement.valor_total || 0;
                    stats.entradas.count++;
                    break;
                case 'saida':
                    stats.saidas.quantidade += Math.abs(movement.quantidade);
                    stats.saidas.valor += movement.valor_total || 0;
                    stats.saidas.count++;
                    break;
                case 'ajuste':
                    stats.ajustes.quantidade += movement.quantidade;
                    stats.ajustes.count++;
                    break;
            }
        });

        return { success: true, data: stats };

    } catch (error) {
        console.error('Erro ao calcular estatísticas:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Busca produtos com estoque baixo
 * @returns {Object} - Produtos com estoque baixo
 */
async function getLowStockProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('id, nome, codigo_sku, quantidade_estoque, estoque_minimo')
            .eq('id_empresa', window.currentCompanyId)
            .gt('estoque_minimo', 0) // Só produtos que têm estoque mínimo definido
            .or('quantidade_estoque.lt.estoque_minimo,quantidade_estoque.is.null');

        if (error) throw error;

        // Filtrar produtos que realmente estão com estoque baixo
        const lowStockProducts = data.filter(product => {
            const currentStock = product.quantidade_estoque || 0;
            const minStock = product.estoque_minimo || 0;
            return currentStock <= minStock;
        });

        return { success: true, data: lowStockProducts };

    } catch (error) {
        console.error('Erro ao buscar produtos com estoque baixo:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Executa ajuste em lote de múltiplos produtos
 * @param {Array} adjustments - Array de ajustes
 * @returns {Object} - Resultado da operação
 */
async function batchAdjustStock(adjustments) {
    try {
        const results = [];
        const errors = [];

        for (const adjustment of adjustments) {
            try {
                // Buscar estoque atual
                const { data: product, error: productError } = await supabaseClient
                    .from('produtos')
                    .select('quantidade_estoque, nome')
                    .eq('id', adjustment.produto_id)
                    .eq('id_empresa', window.currentCompanyId)
                    .single();

                if (productError) throw productError;

                const estoqueAtual = product.quantidade_estoque || 0;
                const diferenca = adjustment.estoque_fisico - estoqueAtual;

                if (diferenca !== 0) {
                    // Registrar movimentação de ajuste
                    const movementData = {
                        produto_id: adjustment.produto_id,
                        tipo_movimentacao: 'ajuste',
                        quantidade: diferenca,
                        documento: 'Ajuste em Lote',
                        observacao: adjustment.observacao || `Ajuste automático: ${estoqueAtual} → ${adjustment.estoque_fisico}`,
                        auth_user_id: window.currentUser.auth_user_id,
                        id_empresa: window.currentCompanyId
                    };

                    const { error: movementError } = await supabaseClient
                        .from('estoque_movimentacoes')
                        .insert([movementData]);

                    if (movementError) throw movementError;

                    // Atualizar estoque do produto
                    const { error: updateError } = await supabaseClient
                        .from('produtos')
                        .update({ quantidade_estoque: adjustment.estoque_fisico })
                        .eq('id', adjustment.produto_id);

                    if (updateError) throw updateError;

                    results.push({
                        produto_id: adjustment.produto_id,
                        nome: product.nome,
                        estoque_anterior: estoqueAtual,
                        estoque_novo: adjustment.estoque_fisico,
                        diferenca: diferenca
                    });
                }

            } catch (error) {
                errors.push({
                    produto_id: adjustment.produto_id,
                    error: error.message
                });
            }
        }

        return { 
            success: errors.length === 0, 
            results, 
            errors,
            processed: results.length,
            total: adjustments.length
        };

    } catch (error) {
        console.error('Erro no ajuste em lote:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cancela/estorna uma movimentação específica
 * @param {number} movementId - ID da movimentação
 * @param {string} reason - Motivo do cancelamento
 * @returns {Object} - Resultado da operação
 */
async function cancelMovement(movementId, reason) {
    try {
        // Buscar movimentação original
        const { data: movement, error: movError } = await supabaseClient
            .from('estoque_movimentacoes')
            .select('*')
            .eq('id', movementId)
            .eq('id_empresa', window.currentCompanyId)
            .single();

        if (movError) throw movError;

        if (!movement) {
            throw new Error('Movimentação não encontrada');
        }

        // Criar movimentação de estorno (quantidade inversa)
        const cancelMovement = {
            produto_id: movement.produto_id,
            tipo_movimentacao: 'ajuste',
            quantidade: -movement.quantidade,
            documento: `Estorno - ${movement.documento || 'Mov. #' + movementId}`,
            observacao: `Estorno: ${reason}`,
            movimentacao_origem_id: movementId,
            auth_user_id: window.currentUser.auth_user_id,
            id_empresa: window.currentCompanyId
        };

        const { data: cancelData, error: cancelError } = await supabaseClient
            .from('estoque_movimentacoes')
            .insert([cancelMovement]);

        if (cancelError) throw cancelError;

        // Atualizar estoque do produto
        const { data: product, error: productError } = await supabaseClient
            .from('produtos')
            .select('quantidade_estoque')
            .eq('id', movement.produto_id)
            .single();

        if (productError) throw productError;

        const novoEstoque = (product.quantidade_estoque || 0) - movement.quantidade;

        const { error: updateError } = await supabaseClient
            .from('produtos')
            .update({ quantidade_estoque: novoEstoque })
            .eq('id', movement.produto_id);

        if (updateError) throw updateError;

        // Marcar movimentação original como cancelada
        const { error: markError } = await supabaseClient
            .from('estoque_movimentacoes')
            .update({ 
                cancelada: true,
                data_cancelamento: new Date().toISOString(),
                motivo_cancelamento: reason
            })
            .eq('id', movementId);

        if (markError) throw markError;

        return { 
            success: true, 
            data: cancelData,
            newStock: novoEstoque
        };

    } catch (error) {
        console.error('Erro ao cancelar movimentação:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Busca movimentações por período para relatórios
 * @param {string} startDate - Data início (ISO string)
 * @param {string} endDate - Data fim (ISO string)
 * @param {Object} options - Opções adicionais
 * @returns {Object} - Resultado da busca
 */
async function getMovementsByPeriod(startDate, endDate, options = {}) {
    try {
        let query = supabaseClient
            .from('estoque_movimentacoes')
            .select(`
                *,
                produtos(nome, codigo_sku, codigo_barras, categoria)
            `)
            .eq('id_empresa', window.currentCompanyId)
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        // Filtros opcionais
        if (options.type) {
            query = query.eq('tipo_movimentacao', options.type);
        }

        if (options.productIds && options.productIds.length > 0) {
            query = query.in('produto_id', options.productIds);
        }

        if (options.excludeCanceled) {
            query = query.neq('cancelada', true);
        }

        // Ordenação
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        return { success: true, data };

    } catch (error) {
        console.error('Erro ao buscar movimentações por período:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verifica consistência do estoque
 * @param {number} productId - ID do produto (opcional, se não informado verifica todos)
 * @returns {Object} - Resultado da verificação
 */
async function checkStockConsistency(productId = null) {
    try {
        let productQuery = supabaseClient
            .from('produtos')
            .select('id, nome, codigo_sku, quantidade_estoque')
            .eq('id_empresa', window.currentCompanyId);

        if (productId) {
            productQuery = productQuery.eq('id', productId);
        }

        const { data: products, error: productsError } = await productQuery;

        if (productsError) throw productsError;

        const inconsistencies = [];

        for (const product of products) {
            // Calcular estoque baseado nas movimentações
            const { data: movements, error: movError } = await supabaseClient
                .from('estoque_movimentacoes')
                .select('quantidade')
                .eq('produto_id', product.id)
                .eq('id_empresa', window.currentCompanyId)
                .neq('cancelada', true);

            if (movError) {
                console.error(`Erro ao verificar movimentações do produto ${product.id}:`, movError);
                continue;
            }

            const calculatedStock = movements.reduce((total, mov) => total + (mov.quantidade || 0), 0);
            const registeredStock = product.quantidade_estoque || 0;

            if (calculatedStock !== registeredStock) {
                inconsistencies.push({
                    produto_id: product.id,
                    nome: product.nome,
                    codigo_sku: product.codigo_sku,
                    estoque_registrado: registeredStock,
                    estoque_calculado: calculatedStock,
                    diferenca: calculatedStock - registeredStock
                });
            }
        }

        return { 
            success: true, 
            data: inconsistencies,
            total_checked: products.length,
            inconsistencies_found: inconsistencies.length
        };

    } catch (error) {
        console.error('Erro na verificação de consistência:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Corrige inconsistências de estoque encontradas
 * @param {Array} inconsistencies - Array de inconsistências
 * @returns {Object} - Resultado da correção
 */
async function fixStockInconsistencies(inconsistencies) {
    try {
        const results = [];
        const errors = [];

        for (const item of inconsistencies) {
            try {
                // Atualizar estoque para o valor calculado
                const { error: updateError } = await supabaseClient
                    .from('produtos')
                    .update({ quantidade_estoque: item.estoque_calculado })
                    .eq('id', item.produto_id);

                if (updateError) throw updateError;

                // Registrar movimentação de correção
                const movementData = {
                    produto_id: item.produto_id,
                    tipo_movimentacao: 'ajuste',
                    quantidade: item.diferenca,
                    documento: 'Correção Automática',
                    observacao: `Correção de inconsistência: ${item.estoque_registrado} → ${item.estoque_calculado}`,
                    auth_user_id: window.currentUser.auth_user_id,
                    id_empresa: window.currentCompanyId
                };

                const { error: movError } = await supabaseClient
                    .from('estoque_movimentacoes')
                    .insert([movementData]);

                if (movError) throw movError;

                results.push({
                    produto_id: item.produto_id,
                    nome: item.nome,
                    corrigido: true
                });

            } catch (error) {
                errors.push({
                    produto_id: item.produto_id,
                    nome: item.nome,
                    error: error.message
                });
            }
        }

        return {
            success: errors.length === 0,
            results,
            errors,
            corrected: results.length,
            total: inconsistencies.length
        };

    } catch (error) {
        console.error('Erro na correção de inconsistências:', error);
        return { success: false, error: error.message };
    }
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.searchProductInDatabase = searchProductInDatabase;
window.registerMovement = registerMovement;
window.checkForDuplicateMovement = checkForDuplicateMovement;
window.getProductMovements = getProductMovements;
window.getMovementsHistory = getMovementsHistory;
window.getMovementStats = getMovementStats;
window.getLowStockProducts = getLowStockProducts;
window.batchAdjustStock = batchAdjustStock;
window.cancelMovement = cancelMovement;
window.getMovementsByPeriod = getMovementsByPeriod;
window.checkStockConsistency = checkStockConsistency;
window.fixStockInconsistencies = fixStockInconsistencies;