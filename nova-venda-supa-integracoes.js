// nova-venda-supa-integracoes.js - PARTE 2: Integrações e Controle de Estoque

/**
 * Processa os dados da venda atual e salva no Supabase
 */
async function processAndSaveSale(paymentData) {
    try {
        const saleData = {
            items: cart,
            customer: saleState.customer,
            totals: calculateTotals(),
            payment: paymentData,
            adjustments: {
                discount: paymentData.discount || 0,
                surcharge: paymentData.surcharge || 0,
                freight: paymentData.freight || 0,
                freightPaidBy: paymentData.freightPaidBy || 'casa',
                cashback: paymentData.cashback || 0
            },
            info: {
                seller: paymentData.seller || window.currentUser?.id,
                deliveryPerson: paymentData.deliveryPerson || null,
                saleChannel: paymentData.saleChannel || 'presencial'
            },
            receipt: {
                method: paymentData.receiptMethod || 'none',
                whatsappNumber: paymentData.whatsappNumber || null
            }
        };

        if (!saleData.items || saleData.items.length === 0) {
            throw new Error('Carrinho vazio - não é possível processar a venda');
        }

        if (!window.currentCompanyId) {
            throw new Error('ID da empresa não encontrado');
        }

        if (!window.currentUser) {
            throw new Error('Usuário não autenticado');
        }

        const result = await saveSaleToSupabase(saleData);

        if (result.success) {
            return {
                success: true,
                saleId: result.saleId,
                saleNumber: result.saleNumber,
                financialMovement: result.financialMovement,
                message: 'Venda registrada com sucesso!'
            };
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        if (typeof showNotification === 'function') {
            showNotification('Erro ao registrar venda: ' + error.message, 'error');
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * VERSÃO PARA PAGAMENTO SIMPLES (modal básico)
 */
async function finalizeSimpleSaleWithSupabase() {
    const { total } = calculateTotals();
    const paymentData = {
        method: saleState.paymentMethod || 'Dinheiro',
        totalAmount: total,
        amountReceived: saleState.amountReceived || total,
        change: Math.max(0, (saleState.amountReceived || total) - total),
        receiptMethod: 'none',
        seller: window.currentUser?.id,
        saleChannel: 'presencial'
    };
    
    const result = await processAndSaveSale(paymentData);
    
    if (typeof window.processSaleOriginal === 'function') {
        window.processSaleOriginal();
    } else {
        const simulatedSaleId = result.saleId || Math.floor(10000 + Math.random() * 90000);
        showSuccessScreen(simulatedSaleId);
    }
}

/**
 * VERSÃO PARA PAGAMENTO AVANÇADO (modal completo)
 */
async function finalizeAdvancedSaleWithSupabase(paymentData) {
    const result = await processAndSaveSale(paymentData);
    
    if (result.success) {
        const simulatedSaleId = result.saleId || Math.floor(10000 + Math.random() * 90000);
        
        // Processar comprovante
        if (paymentData.receiptMethod === 'print') {
            showNotification('Comprovante sendo impresso...', 'info');
        } else if (paymentData.receiptMethod === 'whatsapp') {
            showNotification(`Comprovante enviado para ${paymentData.whatsappNumber}`, 'success');
        }
        
        if (window.paymentModal && typeof window.paymentModal.close === 'function') {
            window.paymentModal.close();
        }
        
        startNewSale();
        
    } else {
        if (typeof window.finalizeAdvancedSaleOriginal === 'function') {
            window.finalizeAdvancedSaleOriginal(paymentData);
        } else {
            const simulatedSaleId = Math.floor(10000 + Math.random() * 90000);
            showSuccessScreen(simulatedSaleId);
        }
    }
}

/**
 * Inicialização: Substitui as funções originais após carregamento
 */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // 1. SUBSTITUIR FUNÇÃO DE VENDA SIMPLES
        if (typeof window.processSale === 'function') {
            window.processSaleOriginal = window.processSale;
            
            window.processSale = function() {
                finalizeSimpleSaleWithSupabase();
            };
        }
        
        // 2. SUBSTITUIR FUNÇÃO DE VENDA AVANÇADA (MODAL)
        if (typeof window.finalizeAdvancedSale === 'function') {
            window.finalizeAdvancedSaleOriginal = window.finalizeAdvancedSale;
            window.finalizeAdvancedSale = finalizeAdvancedSaleWithSupabase;
        }
        
    }, 2000);
});

// ===== INTEGRAÇÃO DE CONTROLE DE ESTOQUE NO SISTEMA DE VENDAS =====

async function verificarEstoqueDisponivel(produtoId, quantidadeDesejada) {
    try {
        const { data: produto, error } = await supabaseClient
            .from('produtos')
            .select('quantidade_estoque, nome')
            .eq('id', produtoId)
            .single();

        if (error) throw error;

        if (!produto) {
            return { 
                success: false, 
                estoqueDisponivel: 0, 
                insuficiente: true,
                produto: null,
                error: 'Produto não encontrado' 
            };
        }

        const estoqueDisponivel = produto.quantidade_estoque || 0;
        const insuficiente = estoqueDisponivel < quantidadeDesejada;

        return { 
            success: true, 
            estoqueDisponivel,
            insuficiente,
            produto: produto.nome,
            quantidadeDesejada
        };

    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            estoqueDisponivel: 0,
            insuficiente: true
        };
    }
}

/**
 * Registra movimentação de estoque (saída por venda)
 */
async function registrarMovimentacaoEstoque(dados) {
    try {
        const { data, error } = await supabaseClient
            .from('estoque_movimentacoes')
            .insert([{
                produto_id: dados.produto_id,
                tipo_movimentacao: dados.tipo_movimentacao,
                quantidade: dados.quantidade,
                valor_unitario: dados.valor_unitario || null,
                valor_total: dados.valor_total || null,
                documento: dados.documento || null,
                fornecedor: dados.fornecedor || null,
                observacao: dados.observacao || null,
                auth_user_id: window.currentUser.auth_user_id,
                id_empresa: window.currentCompanyId
            }]);

        if (error) throw error;
        return { success: true, data };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Atualiza estoque do produto (permite estoque negativo)
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
 * Registra saída de estoque por venda
 */
async function registrarSaidaVenda(itemVenda, vendaId) {
    return await registrarMovimentacaoEstoque({
        produto_id: itemVenda.id,
        tipo_movimentacao: 'saida',
        quantidade: -Math.abs(itemVenda.quantity),
        valor_unitario: itemVenda.preco_venda,
        valor_total: itemVenda.quantity * itemVenda.preco_venda,
        documento: `Venda #${vendaId}`,
        observacao: `Venda - ${itemVenda.nome}`,
    });
}

/**
 * Processa movimentação de estoque para uma venda (SEM TRAVAR)
 */
async function processarEstoqueVenda(itensVenda, numeroVenda) {
    const alertasEstoque = [];
    const resultados = [];

    try {
        for (let item of itensVenda) {
            try {
                const verificacao = await verificarEstoqueDisponivel(item.id, item.quantity);
                
                if (verificacao.insuficiente && verificacao.success) {
                    alertasEstoque.push({
                        produto: item.nome,
                        disponivel: verificacao.estoqueDisponivel,
                        solicitado: item.quantity,
                        diferenca: item.quantity - verificacao.estoqueDisponivel
                    });
                }

                const movimentacao = await registrarSaidaVenda(item, numeroVenda);
                if (!movimentacao.success) {
                    continue;
                }

                const atualizacao = await atualizarEstoqueProduto(item.id, -item.quantity);
                if (!atualizacao.success) {
                    continue;
                }

                resultados.push({
                    produto: item.nome,
                    quantidade: item.quantity,
                    estoqueAnterior: (atualizacao.novoEstoque + item.quantity),
                    novoEstoque: atualizacao.novoEstoque,
                    success: true
                });

            } catch (error) {
                resultados.push({
                    produto: item.nome,
                    error: error.message,
                    success: false
                });
            }
        }

        if (alertasEstoque.length > 0) {
            mostrarAlertaEstoqueInsuficiente(alertasEstoque, numeroVenda);
        }

        return { 
            success: true, 
            resultados, 
            alertasEstoque,
            message: `Estoque atualizado para ${resultados.filter(r => r.success).length} itens`
        };

    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            resultados,
            alertasEstoque
        };
    }
}

/**
 * Mostra alerta de estoque insuficiente (informativo, não bloqueia)
 */
function mostrarAlertaEstoqueInsuficiente(alertas, numeroVenda) {
    const produtosAfetados = alertas.length;

    let mensagem = `⚠️ Alerta de Estoque - Venda #${numeroVenda}\n\n`;
    mensagem += `${produtosAfetados} produto(s) com estoque insuficiente:\n\n`;
    
    alertas.forEach(alerta => {
        mensagem += `• ${alerta.produto}\n`;
        mensagem += `  Disponível: ${alerta.disponivel} | Vendido: ${alerta.solicitado}\n`;
        mensagem += `  Estoque ficará: ${alerta.disponivel - alerta.solicitado}\n\n`;
    });

    mensagem += `A venda foi processada normalmente.\n`;
    mensagem += `Recomendamos repor o estoque dos produtos em falta.`;

    if (typeof showNotification === 'function') {
        showNotification(`Atenção: ${produtosAfetados} produto(s) com estoque insuficiente`, 'warning');
    }
}

// Backup da função original para integração com estoque
const processAndSaveSaleOriginal = window.processAndSaveSale;

// Substituir pela função com controle de estoque
window.processAndSaveSale = async function(paymentData) {
    try {
        const resultadoVenda = await processAndSaveSaleOriginal(paymentData);

        if (!resultadoVenda.success) {
            return resultadoVenda;
        }

        if (cart && cart.length > 0 && resultadoVenda.saleNumber) {
            const resultadoEstoque = await processarEstoqueVenda(cart, resultadoVenda.saleNumber);
            
            if (resultadoEstoque.success) {
                if (resultadoEstoque.alertasEstoque.length > 0) {
                    return {
                        ...resultadoVenda,
                        estoqueAlerta: true,
                        alertasEstoque: resultadoEstoque.alertasEstoque,
                        message: resultadoVenda.message + ' (Veja alertas de estoque)'
                    };
                }
            } else {
                if (typeof showNotification === 'function') {
                    showNotification('Venda salva, mas houve erro no controle de estoque', 'warning');
                }
            }
        }

        return resultadoVenda;

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

// Adicionar CSS para o alerta de estoque
const estoqueAlertStyle = document.createElement('style');
estoqueAlertStyle.textContent = `
    .notification.warning {
        background-color: #f59e0b !important;
        border-left: 4px solid #d97706;
    }
    
    .estoque-alert {
        background: linear-gradient(135deg, #fef3c7, #fbbf24);
        color: #92400e;
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
        font-size: 0.9rem;
    }
    
    .estoque-alert h4 {
        margin: 0 0 0.5rem 0;
        color: #92400e;
        font-weight: 600;
    }
    
    .estoque-alert ul {
        margin: 0.5rem 0 0 0;
        padding-left: 1.5rem;
    }
    
    .estoque-alert li {
        margin-bottom: 0.25rem;
    }
`;
document.head.appendChild(estoqueAlertStyle);

// Exportar funções para uso global
window.verificarEstoqueDisponivel = verificarEstoqueDisponivel;
window.registrarMovimentacaoEstoque = registrarMovimentacaoEstoque;
window.atualizarEstoqueProduto = atualizarEstoqueProduto;
window.registrarSaidaVenda = registrarSaidaVenda;
window.processarEstoqueVenda = processarEstoqueVenda;
window.saveSaleToSupabase = saveSaleToSupabase;
window.processAndSaveSale = processAndSaveSale;