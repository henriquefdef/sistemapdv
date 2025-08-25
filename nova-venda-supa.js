// nova-venda-supa.js - Versão Limpa

/**
 * Gera um número de venda único de 9 dígitos
 */
function generateSaleNumber() {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
}

/**
 * Verifica se o número da venda já existe no banco
 */
async function checkSaleNumberExists(saleNumber) {
    try {
        const { data, error } = await supabaseClient
            .from('vendas')
            .select('id')
            .eq('id_venda', saleNumber)
            .eq('id_empresa', window.currentCompanyId)
            .limit(1);

        if (error) return false;
        return data && data.length > 0;
    } catch (error) {
        return false;
    }
}

/**
 * Gera um número de venda único
 */
async function generateUniqueSaleNumber() {
    let saleNumber;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
        saleNumber = generateSaleNumber();
        attempts++;
        
        if (attempts >= maxAttempts) break;
    } while (await checkSaleNumberExists(saleNumber));
    
    return saleNumber;
}

/**
 * Garante que a categoria "Vendas" existe
 */
async function ensureVendasCategory() {
    try {
        const { data: existing, error: searchError } = await supabaseClient
            .from('categoria_financeira')
            .select('id, nome')
            .eq('id_empresa', window.currentCompanyId)
            .eq('nome', 'Vendas')
            .eq('tipo', 'RECEBER')
            .limit(1);

        if (searchError || (existing && existing.length > 0)) {
            return existing?.[0] || null;
        }

        const newCategoryData = {
            id_empresa: window.currentCompanyId,
            nome: 'Vendas',
            tipo: 'RECEBER'
        };
        
        const { data: newCategory, error: insertError } = await supabaseClient
            .from('categoria_financeira')
            .insert([newCategoryData])
            .select()
            .single();

        return insertError ? null : newCategory;
    } catch (error) {
        return null;
    }
}

/**
 * Criar movimentação financeira
 */
async function createFinancialMovement(saleData, saleNumber, formaPagamento) {
    try {
        if (!window.currentCompanyId) {
            throw new Error('ID da empresa não encontrado');
        }
        
        if (!saleData?.totals?.total || saleData.totals.total <= 0) {
            throw new Error('Total da venda inválido');
        }
        
        let status = 'PAGO';
        let dataVencimento = new Date().toISOString().split('T')[0];
        let observacoes = `Venda via PDV - ${saleData.items?.length || 0} itens`;
        
        if (formaPagamento === 'Crediario') {
            status = 'PENDENTE';
            if (saleData.payment?.crediarioFirstDate) {
                dataVencimento = saleData.payment.crediarioFirstDate;
            }
            observacoes += ` - Crediário ${saleData.payment?.crediarioInstallments || 2}x`;
        }
        
        const movimentacaoData = {
            id_empresa: String(window.currentCompanyId),
            tipo: 'RECEBER',
            descricao: `Venda #${saleNumber}`,
            valor: Number(saleData.totals.total),
            data_vencimento: dataVencimento,
            categoria: 'Vendas',
            pessoa_empresa: saleData.customer?.nome || 'Cliente não identificado',
            documento: String(saleNumber),
            observacoes: observacoes,
            recorrente: false,
            status: status,
            auth_user_id: window.currentUser?.auth_user_id || null
        };
        
        const { data, error } = await supabaseClient
            .from('movimentacoes_financeiras')
            .insert([movimentacaoData])
            .select('*');

        if (error) {
            throw new Error(`Erro no financeiro: ${error.message}`);
        }
        
        return { success: true, data: data[0] };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Crediário no financeiro
 */
async function createCrediarioFinancialMovements(saleData, saleNumber) {
    try {
        if (saleData.payment?.method !== 'Crediario') {
            return { success: true, message: 'Não é crediário' };
        }

        const numeroParcelas = parseInt(saleData.payment?.crediarioInstallments) || 2;
        const valorParcela = Number(saleData.totals.total) / numeroParcelas;
        const dataPrimeiraParcela = new Date(saleData.payment?.crediarioFirstDate || new Date());
        
        const movimentacoes = [];

        for (let i = 1; i <= numeroParcelas; i++) {
            const dataVencimento = new Date(dataPrimeiraParcela);
            dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
            
            const movimentacao = {
                id_empresa: String(window.currentCompanyId),
                tipo: 'RECEBER',
                descricao: `Venda #${saleNumber} - Parcela ${i}/${numeroParcelas}`,
                valor: Number(valorParcela.toFixed(2)),
                data_vencimento: dataVencimento.toISOString().split('T')[0],
                categoria: 'Vendas',
                pessoa_empresa: saleData.customer?.nome || 'Cliente não identificado',
                documento: `${saleNumber}-P${i}`,
                observacoes: `Crediário ${numeroParcelas}x - Parcela ${i}`,
                recorrente: false,
                status: 'PENDENTE',
                auth_user_id: window.currentUser?.auth_user_id || null
            };
            
            movimentacoes.push(movimentacao);
        }
        
        const { data, error } = await supabaseClient
            .from('movimentacoes_financeiras')
            .insert(movimentacoes)
            .select('*');

        if (error) throw error;
        
        return { success: true, data, parcelas: numeroParcelas };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Salvar venda completa
 */
async function saveSaleToSupabase(saleData) {
    try {
        const saleNumber = await generateUniqueSaleNumber();
        await ensureVendasCategory();

        const saleRecords = prepareSaleRecords(saleData, saleNumber);
        
        const { data: vendaData, error: vendaError } = await supabaseClient
            .from('vendas')
            .insert(saleRecords)
            .select();

        if (vendaError) {
            throw new Error(`Erro ao salvar venda: ${vendaError.message}`);
        }

        const formaPagamento = saleData.payment?.method || 'Dinheiro';
        let financialResult;

        if (formaPagamento === 'Crediario') {
            financialResult = await createCrediarioFinancialMovements(saleData, saleNumber);
        } else {
            financialResult = await createFinancialMovement(saleData, saleNumber, formaPagamento);
        }
        
        return {
            success: true,
            data: vendaData,
            saleId: vendaData[0]?.id || null,
            saleNumber: saleNumber,
            financialMovement: financialResult,
            message: 'Venda registrada com sucesso!'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Erro ao registrar venda'
        };
    }
}

/**
 * Prepara registros da venda
 */
function prepareSaleRecords(saleData, saleNumber) {
    const baseRecord = createBaseRecord(saleData, saleNumber);
    const records = [];

    if (saleData.items && saleData.items.length > 0) {
        saleData.items.forEach((item) => {
            const itemRecord = {
                ...baseRecord,
                produto_nome: item.nome,
                produto_codigo_barras: item.codigo_barras || null,
                produto_sku: item.codigo_sku || null,
                quantidade_unit: item.quantity,
                tipo_desconto_unit: item.discount?.type || 'none',
                valor_desconto_unit: item.discount?.value || 0,
                preco_unitario: item.preco_venda,
                subtotal_item: item.preco_venda * item.quantity
            };
            records.push(itemRecord);
        });
    }

    return records;
}

/**
 * Cria registro base da venda - CORRIGIDO PARA USAR VALOR DO MODAL
 */
function createBaseRecord(saleData, saleNumber) {
    const now = new Date().toISOString();
    
    return {
        id_venda: saleNumber,
        auth_user_id: window.currentUser?.auth_user_id || null,
        id_empresa: window.currentCompanyId,
        hora_venda: now,
        cliente_id: saleData.customer?.id || null,
        cliente_nome: saleData.customer?.nome || null,
        subtotal_venda: saleData.totals?.subtotal || 0,
        desconto_total: saleData.totals?.totalDiscount || 0,
        
        // 🔥 PRINCIPAL CORREÇÃO: Usar valor do modal (que já inclui todos os ajustes)
        total_venda: saleData.payment?.totalAmount || saleData.totals?.total || 0,
        
        forma_pagamento: saleData.payment?.method || 'Dinheiro',
        valor_recebido_dinheiro: saleData.payment?.method === 'Dinheiro' ? saleData.payment?.amountReceived : null,
        troco_dinheiro: saleData.payment?.method === 'Dinheiro' ? saleData.payment?.change : null,
        modalidade_cartao: saleData.payment?.method === 'Cartao' ? saleData.payment?.cardType : null,
        parcelas_cartao: saleData.payment?.method === 'Cartao' ? saleData.payment?.installments : null,
        taxa_cartao: saleData.payment?.method === 'Cartao' ? saleData.payment?.fees : null,
        numero_parcelas_crediario: saleData.payment?.method === 'Crediario' ? saleData.payment?.crediarioInstallments : null,
        data_primeira_parcela: saleData.payment?.method === 'Crediario' ? saleData.payment?.crediarioFirstDate : null,
        cashback_disponivel: saleData.payment?.method === 'Cashback' ? saleData.payment?.cashbackAvailable : null,
        valor_utilizado_cashback: saleData.payment?.method === 'Cashback' ? saleData.payment?.cashbackUseAmount : null,
        codigo_cupom: saleData.payment?.method === 'Cupom' ? saleData.payment?.coupon : null,
        desconto_adicional: saleData.adjustments?.discount || 0,
        acrescimo: saleData.adjustments?.surcharge || 0,
        frete: saleData.adjustments?.freight || 0,
        frete_pago_por: (saleData.adjustments?.freight && saleData.adjustments.freight > 0) 
            ? (saleData.adjustments?.freightPaidBy || 'casa') 
            : null,
        cashback_gerado: saleData.adjustments?.cashback || 0,
        vendedor_id: saleData.info?.seller || window.currentUser?.id,
        entregador: saleData.info?.deliveryPerson || null,
        canal_venda: saleData.info?.saleChannel || 'presencial',
        metodo_comprovante: saleData.receipt?.method || 'none',
        whatsapp_comprovante: saleData.receipt?.whatsappNumber || null,
        maquina_utilizada: (saleData.payment?.method === 'Cartao' || saleData.payment?.method === 'Cartão') 
            ? (saleData.payment?.machineUsed || null) 
            : null,
        status: 'ATIVO'
    };
}

// Interceptar processo de venda
const originalProcessAndSaveSale = window.processAndSaveSale;

window.processAndSaveSale = async function(paymentData) {
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
            throw new Error('Carrinho vazio');
        }

        if (!window.currentCompanyId) {
            throw new Error('ID da empresa não encontrado');
        }

        const result = await saveSaleToSupabase(saleData);

        if (result.success) {
            if (originalProcessAndSaveSale && typeof originalProcessAndSaveSale === 'function') {
                return await originalProcessAndSaveSale(paymentData);
            }
            return result;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        if (originalProcessAndSaveSale && typeof originalProcessAndSaveSale === 'function') {
            return await originalProcessAndSaveSale(paymentData);
        }
        return { success: false, error: error.message };
    }
};

// Inicialização
document.addEventListener('userDataReady', () => {
    if (window.currentCompanyId) {
        ensureVendasCategory();
    }
});

// Função de teste básico
window.testarTabelaBasico = async function() {
    if (!window.currentCompanyId || !window.currentUser) {
        alert('❌ Dados da empresa ou usuário não encontrados!');
        return;
    }
    
    const testData = {
        id_empresa: String(window.currentCompanyId),
        tipo: 'RECEBER',
        descricao: 'TESTE BÁSICO',
        valor: 1.00,
        data_vencimento: new Date().toISOString().split('T')[0],
        status: 'PAGO'
    };
    
    try {
        const { data, error } = await supabaseClient
            .from('movimentacoes_financeiras')
            .insert([testData])
            .select('*');

        if (error) {
            alert(`❌ ERRO: ${error.message}`);
            return;
        }

        alert('✅ TABELA FUNCIONANDO!');
        
        // Limpar teste
        if (data[0]?.id) {
            await supabaseClient
                .from('movimentacoes_financeiras')
                .delete()
                .eq('id', data[0].id);
        }
        
    } catch (error) {
        alert(`❌ ERRO: ${error.message}`);
    }
};