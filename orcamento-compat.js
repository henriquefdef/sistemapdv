// orcamento-compat.js - Funções de Compatibilidade para Orçamento
// ===============================================================

/**
 * Funções auxiliares para compatibilidade com sistema PDV
 * Garante que todas as dependências estejam disponíveis
 */

// === FUNÇÃO DE NOTIFICAÇÃO (se não existir) ===
if (typeof showNotification === 'undefined') {
    window.showNotification = function(message, type = 'info') {
        if (typeof utils !== 'undefined' && utils.showNotification) {
            return utils.showNotification(message, type);
        }
        
        // Fallback para console se utils não existir
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    };
}

// === SISTEMA DE SUPABASE PARA VENDAS (compatibilidade) ===
if (typeof window.saveSaleToSupabase === 'undefined') {
    /**
     * Salvar venda no Supabase - versão para orçamentos
     */
    window.saveSaleToSupabase = async function(saleData) {
        try {
            console.log('💾 Salvando venda do orçamento no Supabase...');
            
            const saleNumber = generateSaleNumber();
            const now = new Date().toISOString();
            
            // Preparar registros da venda
            const saleRecords = saleData.items.map(item => ({
                id_venda: saleNumber,
                auth_user_id: window.currentUser?.auth_user_id || null,
                id_empresa: window.currentCompanyId,
                hora_venda: now,
                cliente_id: saleData.customer?.id || null,
                cliente_nome: saleData.customer?.nome || null,
                produto_nome: item.nome,
                produto_codigo_barras: item.codigo_barras || null,
                produto_sku: item.codigo_sku || null,
                quantidade_unit: item.quantity,
                tipo_desconto_unit: item.discount?.type || 'none',
                valor_desconto_unit: item.discount?.value || 0,
                preco_unitario: item.preco_venda,
                subtotal_item: item.preco_venda * item.quantity,
                subtotal_venda: saleData.totals?.subtotal || 0,
                desconto_total: saleData.totals?.totalDiscount || 0,
                total_venda: saleData.totals?.total || 0,
                forma_pagamento: saleData.payment?.method || 'Dinheiro',
                valor_recebido_dinheiro: saleData.payment?.method === 'Dinheiro' ? saleData.payment?.amountReceived : null,
                troco_dinheiro: saleData.payment?.method === 'Dinheiro' ? saleData.payment?.change : null,
                modalidade_cartao: saleData.payment?.method === 'Cartao' ? saleData.payment?.cardType : null,
                parcelas_cartao: saleData.payment?.method === 'Cartao' ? saleData.payment?.installments : null,
                taxa_cartao: saleData.payment?.method === 'Cartao' ? saleData.payment?.fees : null,
                numero_parcelas_crediario: saleData.payment?.method === 'Crediario' ? saleData.payment?.crediarioInstallments : null,
                data_primeira_parcela: saleData.payment?.method === 'Crediario' ? saleData.payment?.crediarioFirstDate : null,
                valor_utilizado_cashback: saleData.payment?.method === 'Cashback' ? saleData.payment?.cashbackUseAmount : null,
                codigo_cupom: saleData.payment?.method === 'Cupom' ? saleData.payment?.coupon : null,
                desconto_adicional: saleData.adjustments?.discount || 0,
                acrescimo: saleData.adjustments?.surcharge || 0,
                frete: saleData.adjustments?.freight || 0,
                frete_pago_por: (saleData.adjustments?.freight && saleData.adjustments.freight > 0) ? 
                    (saleData.adjustments?.freightPaidBy || 'casa') : null,
                cashback_gerado: saleData.adjustments?.cashback || 0,
                vendedor_id: saleData.info?.seller || window.currentUser?.id,
                entregador: saleData.info?.deliveryPerson || null,
                canal_venda: saleData.info?.saleChannel || 'presencial',
                metodo_comprovante: saleData.receipt?.method || 'none',
                whatsapp_comprovante: saleData.receipt?.whatsappNumber || null,
                maquina_utilizada: saleData.payment?.machineUsed || null,
                origem: saleData.info?.sourceType || 'orcamento',
                id_origem: saleData.info?.sourceId || null,
                status: 'ATIVO'
            }));
            
            // Inserir no banco
            const { data, error } = await supabaseClient
                .from('vendas')
                .insert(saleRecords)
                .select();
            
            if (error) throw error;
            
            console.log('✅ Venda salva com sucesso:', saleNumber);
            
            return {
                success: true,
                data: data,
                saleId: data[0]?.id || null,
                saleNumber: saleNumber,
                message: 'Venda registrada com sucesso!'
            };
            
        } catch (error) {
            console.error('❌ Erro ao salvar venda:', error);
            return {
                success: false,
                error: error.message,
                message: 'Erro ao registrar venda'
            };
        }
    };
}

// === FUNÇÃO PARA GERAR NÚMERO DA VENDA ===
if (typeof generateSaleNumber === 'undefined') {
    function generateSaleNumber() {
        return Math.floor(100000000 + Math.random() * 900000000).toString();
    }
}

// === FUNÇÕES DE PROCESSAMENTO DE FORMAS DE PAGAMENTO ===
if (typeof window.processSpecialPayments === 'undefined') {
    /**
     * Processa formas de pagamento especiais - versão simplificada para orçamentos
     */
    window.processSpecialPayments = async function(saleData, saleNumber) {
        console.log('💳 Processando formas de pagamento especiais...');
        
        const results = {
            cashback: { processed: false, success: false },
            crediario: { processed: false, success: false },
            cupom: { processed: false, success: false },
            multiplo: { processed: false, success: false }
        };

        try {
            const paymentMethod = saleData.payment.method;
            const clienteId = saleData.customer?.id || null;
            
            // Processar baseado no método de pagamento
            switch (paymentMethod) {
                case 'Cashback':
                    results.cashback = await processOrcamentoCashback(clienteId, saleNumber, saleData);
                    break;
                    
                case 'Crediario':
                    results.crediario = await processOrcamentoCrediario(clienteId, saleNumber, saleData);
                    break;
                    
                case 'Cupom':
                    results.cupom = await processOrcamentoCupom(clienteId, saleNumber, saleData);
                    break;
                    
                case 'Multiplo':
                    results.multiplo = await processOrcamentoMultiplo(clienteId, saleNumber, saleData);
                    break;
                    
                default:
                    console.log('Método de pagamento padrão:', paymentMethod);
            }
            
            // Gerar cashback se habilitado (independente do método)
            const cashbackEnabled = document.getElementById('enable-cashback')?.checked || false;
            const cashbackValue = saleData.adjustments?.cashback || 0;
            
            if (cashbackEnabled && cashbackValue > 0 && paymentMethod !== 'Cashback') {
                const cashbackResult = await generateOrcamentoCashback(clienteId, saleNumber, cashbackValue);
                if (!results.cashback.processed) {
                    results.cashback = cashbackResult;
                } else {
                    results.cashback.generation = cashbackResult;
                }
            }
            
            return { success: true, results };
            
        } catch (error) {
            console.error('Erro no processamento de pagamentos:', error);
            return { success: false, error: error.message, results };
        }
    };
}

// === FUNÇÕES AUXILIARES PARA PROCESSAMENTO ===

async function processOrcamentoCashback(clienteId, saleNumber, saleData) {
    if (!clienteId) {
        return { processed: false, success: false, reason: 'Cliente não selecionado' };
    }
    
    const valorUso = saleData.payment?.cashbackUseAmount || saleData.totals?.total || 0;
    
    return {
        processed: true,
        success: true,
        type: 'usage',
        valor: valorUso,
        message: `Cashback de R$ ${valorUso.toFixed(2)} utilizado`
    };
}

async function processOrcamentoCrediario(clienteId, saleNumber, saleData) {
    if (!clienteId) {
        return { processed: false, success: false, reason: 'Cliente não selecionado' };
    }
    
    const numeroParcelas = saleData.payment?.crediarioInstallments || 2;
    const valorTotal = saleData.totals?.total || 0;
    const valorParcela = valorTotal / numeroParcelas;
    
    return {
        processed: true,
        success: true,
        valorTotal: valorTotal,
        numeroParcelas: numeroParcelas,
        valorParcela: valorParcela,
        message: `Crediário criado: ${numeroParcelas}x de R$ ${valorParcela.toFixed(2)}`
    };
}

async function processOrcamentoCupom(clienteId, saleNumber, saleData) {
    const codigo = saleData.payment?.coupon || '';
    
    if (!codigo.trim()) {
        return { processed: false, success: false, reason: 'Nenhum cupom informado' };
    }
    
    return {
        processed: true,
        success: true,
        codigo: codigo,
        message: `Cupom ${codigo} utilizado`
    };
}

async function processOrcamentoMultiplo(clienteId, saleNumber, saleData) {
    const multipleData = saleData.payment?.multiplePayment || {};
    
    return {
        processed: true,
        success: true,
        method1: multipleData.method1,
        amount1: multipleData.amount1,
        method2: multipleData.method2,
        amount2: multipleData.amount2,
        message: 'Pagamento múltiplo processado'
    };
}

async function generateOrcamentoCashback(clienteId, saleNumber, valor) {
    return {
        processed: true,
        success: true,
        type: 'generation',
        valor: valor,
        message: `Cashback de R$ ${valor.toFixed(2)} ${clienteId ? 'creditado ao cliente' : 'gerado na venda'}`
    };
}

// === CATEGORIA FINANCEIRA (garantir que existe) ===
if (typeof window.ensureVendasCategory === 'undefined') {
    window.ensureVendasCategory = async function() {
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
            console.error('Erro ao garantir categoria de vendas:', error);
            return null;
        }
    };
}

// === MOVIMENTAÇÃO FINANCEIRA ===
if (typeof window.createFinancialMovement === 'undefined') {
    window.createFinancialMovement = async function(saleData, saleNumber, formaPagamento) {
        try {
            await window.ensureVendasCategory();
            
            const movimentacaoData = {
                id_empresa: String(window.currentCompanyId),
                tipo: 'RECEBER',
                descricao: `Venda #${saleNumber} (via orçamento)`,
                valor: Number(saleData.totals?.total || 0),
                data_vencimento: new Date().toISOString().split('T')[0],
                categoria: 'Vendas',
                pessoa_empresa: saleData.customer?.nome || 'Cliente não identificado',
                documento: String(saleNumber),
                observacoes: `Venda via orçamento - ${saleData.items?.length || 0} itens`,
                recorrente: false,
                status: formaPagamento === 'Crediario' ? 'PENDENTE' : 'PAGO',
                auth_user_id: window.currentUser?.auth_user_id || null
            };
            
            const { data, error } = await supabaseClient
                .from('movimentacoes_financeiras')
                .insert([movimentacaoData])
                .select('*');

            if (error) throw error;
            
            return { success: true, data: data[0] };
            
        } catch (error) {
            console.error('Erro na movimentação financeira:', error);
            return { success: false, error: error.message };
        }
    };
}

// === COMPATIBILIDADE COM SISTEMA DE MODAL ===

/**
 * PaymentModalConfig - versão básica se não existir
 */
if (typeof window.PaymentModalConfig === 'undefined') {
    console.warn('⚠️ PaymentModalConfig não encontrado, criando versão básica');
    
    window.PaymentModalConfig = class PaymentModalConfigBasic {
        constructor() {
            this.paymentData = {
                method: 'Dinheiro',
                totalAmount: 0
            };
            this.currentMachine = null;
            console.log('✅ PaymentModalConfig básico inicializado');
        }
        
        show(totalAmount) {
            console.log('Modal de pagamento não disponível, usando fallback');
            alert('Modal de pagamento não disponível. Implementação básica ativada.');
            return false;
        }
        
        close() {
            console.log('Fechando modal básico');
        }
        
        getCurrentTotal() {
            return this.paymentData.totalAmount || 0;
        }
    };
}

// === VERIFICAÇÃO DE DEPENDÊNCIAS ===
function checkDependencies() {
    const dependencies = [
        { name: 'supabaseClient', obj: window.supabaseClient || window.supabase },
        { name: 'currentCompanyId', obj: window.currentCompanyId },
        { name: 'currentUser', obj: window.currentUser }
    ];
    
    // Tentar encontrar supabaseClient em diferentes locais
    if (!dependencies[0].obj) {
        if (typeof supabaseClient !== 'undefined') {
            window.supabaseClient = supabaseClient;
            dependencies[0].obj = supabaseClient;
        } else if (typeof supabase !== 'undefined') {
            window.supabaseClient = supabase;
            dependencies[0].obj = supabase;
        }
    }
    
    const missing = dependencies.filter(dep => !dep.obj);
    
    if (missing.length > 0) {
        console.warn('⚠️ Dependências faltando:', missing.map(m => m.name));
        
        // Aguardar mais tempo se supabaseClient estiver faltando
        if (missing.some(m => m.name === 'supabaseClient')) {
            console.log('🔄 Aguardando carregamento do Supabase...');
            setTimeout(checkDependencies, 1000);
        }
        
        return false;
    }
    
    console.log('✅ Todas as dependências estão disponíveis');
    return true;
}

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Sistema de compatibilidade carregado');
    
    // Verificar dependências após um tempo
    setTimeout(() => {
        checkDependencies();
    }, 2000);
});

document.addEventListener('userDataReady', () => {
    console.log('👤 Dados do usuário carregados - verificando compatibilidade');
    checkDependencies();
});

// === LOG DE CARREGAMENTO ===
console.log('✅ Funções de compatibilidade para orçamentos carregadas');
console.log('📦 Funções disponíveis:');
console.log('- showNotification()');
console.log('- saveSaleToSupabase()');
console.log('- processSpecialPayments()');
console.log('- ensureVendasCategory()');
console.log('- createFinancialMovement()');