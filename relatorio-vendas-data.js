// ===== RELATÓRIO DE VENDAS - CARREGAMENTO DE DADOS E CÁLCULOS =====

// ===== CARREGAMENTO DE DADOS DO SUPABASE =====
async function loadVendasData() {
    if (!relatorioState.supabaseClient || !window.currentCompanyId) {
        console.warn('Supabase não configurado ou empresa não encontrada');
        return;
    }

    try {
        const startDateStr = relatorioState.startDate.toISOString().split('T')[0];
        const endDateStr = relatorioState.endDate.toISOString().split('T')[0];

        let query = relatorioState.supabaseClient
            .from('vendas')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .gte('hora_venda', startDateStr)
            .lte('hora_venda', endDateStr + 'T23:59:59')
            .eq('status', 'ATIVO')
            .order('hora_venda', { ascending: false });

        // Aplicar filtros
        if (relatorioState.filters.vendedor) {
            query = query.eq('vendedor_id', relatorioState.filters.vendedor);
        }
        if (relatorioState.filters.formaPagamento) {
            query = query.eq('forma_pagamento', relatorioState.filters.formaPagamento);
        }
        if (relatorioState.filters.canal) {
            query = query.eq('canal_venda', relatorioState.filters.canal);
        }
        if (relatorioState.filters.cliente) {
            query = query.ilike('cliente_nome', `%${relatorioState.filters.cliente}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        relatorioState.vendasData = data || [];
        console.log(`Carregadas ${relatorioState.vendasData.length} vendas`);

    } catch (error) {
        console.error('Erro ao carregar vendas:', error);
        relatorioState.vendasData = [];
    }
}

async function loadVendedores() {
    if (!relatorioState.supabaseClient || !window.currentCompanyId) {
        return;
    }

    try {
        const { data, error } = await relatorioState.supabaseClient
            .from('user')
            .select('id, nome')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });

        if (error) throw error;

        relatorioState.vendedores = data || [];
        populateVendedoresSelect();

    } catch (error) {
        console.error('Erro ao carregar vendedores:', error);
        relatorioState.vendedores = [];
    }
}

async function loadTodayStats() {
    if (!relatorioState.supabaseClient || !window.currentCompanyId) {
        return;
    }

    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const { data, error } = await relatorioState.supabaseClient
            .from('vendas')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .gte('hora_venda', todayStr)
            .lte('hora_venda', todayStr + 'T23:59:59')
            .eq('status', 'ATIVO');

        if (error) throw error;

        const todayVendas = data || [];
        
        // Calcular estatísticas do dia
        const vendasUnicas = {};
        todayVendas.forEach(venda => {
            if (!vendasUnicas[venda.id_venda]) {
                vendasUnicas[venda.id_venda] = {
                    total: parseFloat(venda.total_venda) || 0,
                    produtos: 0
                };
            }
        });

        todayVendas.forEach(venda => {
            if (vendasUnicas[venda.id_venda]) {
                vendasUnicas[venda.id_venda].produtos += parseInt(venda.quantidade_unit) || 0;
            }
        });

        relatorioState.todayStats = {
            vendas: Object.keys(vendasUnicas).length,
            valor: Object.values(vendasUnicas).reduce((sum, v) => sum + v.total, 0),
            produtos: Object.values(vendasUnicas).reduce((sum, v) => sum + v.produtos, 0)
        };

    } catch (error) {
        console.error('Erro ao carregar estatísticas de hoje:', error);
        relatorioState.todayStats = { vendas: 0, valor: 0, produtos: 0 };
    }
}

function populateVendedoresSelect() {
    const select = document.getElementById('filter-vendedor');
    if (!select) return;

    // Limpar opções existentes (exceto a primeira)
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }

    // Adicionar vendedores
    relatorioState.vendedores.forEach(vendedor => {
        const option = document.createElement('option');
        option.value = vendedor.id;
        option.textContent = vendedor.nome;
        select.appendChild(option);
    });
}

// ===== CÁLCULOS E ESTATÍSTICAS =====
function calculateStatistics() {
    const vendas = relatorioState.vendasData;
    
    // Agrupar vendas únicas por ID para evitar duplicação
    const vendasUnicas = {};
    vendas.forEach(venda => {
        if (!vendasUnicas[venda.id_venda]) {
            vendasUnicas[venda.id_venda] = {
                total: parseFloat(venda.total_venda) || 0,
                desconto: parseFloat(venda.desconto_total) || 0,
                produtos: 0
            };
        }
    });

    // Somar produtos de todas as linhas
    vendas.forEach(venda => {
        if (vendasUnicas[venda.id_venda]) {
            vendasUnicas[venda.id_venda].produtos += parseInt(venda.quantidade_unit) || 0;
        }
    });

    const valores = Object.values(vendasUnicas);
    
    // Estatísticas atuais
    relatorioState.statistics.totalVendas = valores.reduce((sum, v) => sum + v.total, 0);
    relatorioState.statistics.numeroVendas = Object.keys(vendasUnicas).length;
    relatorioState.statistics.produtosVendidos = valores.reduce((sum, v) => sum + v.produtos, 0);
    relatorioState.statistics.descontosConcedidos = valores.reduce((sum, v) => sum + v.desconto, 0);

    // Calcular comparação com período anterior
    calculateComparison();
}

async function calculateComparison() {
    try {
        const periodDays = Math.ceil((relatorioState.endDate - relatorioState.startDate) / (1000 * 60 * 60 * 24));
        const prevStartDate = new Date(relatorioState.startDate);
        prevStartDate.setDate(prevStartDate.getDate() - periodDays);
        const prevEndDate = new Date(relatorioState.startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);

        const prevStartStr = prevStartDate.toISOString().split('T')[0];
        const prevEndStr = prevEndDate.toISOString().split('T')[0];

        const { data: prevData, error } = await relatorioState.supabaseClient
            .from('vendas')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .gte('hora_venda', prevStartStr)
            .lte('hora_venda', prevEndStr + 'T23:59:59')
            .eq('status', 'ATIVO');

        if (error) throw error;

        const prevVendas = prevData || [];
        
        // Processar período anterior
        const prevVendasUnicas = {};
        prevVendas.forEach(venda => {
            if (!prevVendasUnicas[venda.id_venda]) {
                prevVendasUnicas[venda.id_venda] = {
                    total: parseFloat(venda.total_venda) || 0,
                    desconto: parseFloat(venda.desconto_total) || 0,
                    produtos: 0
                };
            }
        });

        prevVendas.forEach(venda => {
            if (prevVendasUnicas[venda.id_venda]) {
                prevVendasUnicas[venda.id_venda].produtos += parseInt(venda.quantidade_unit) || 0;
            }
        });

        const prevValores = Object.values(prevVendasUnicas);
        
        const prevTotalVendas = prevValores.reduce((sum, v) => sum + v.total, 0);
        const prevNumeroVendas = Object.keys(prevVendasUnicas).length;
        const prevProdutosVendidos = prevValores.reduce((sum, v) => sum + v.produtos, 0);
        const prevDescontosConcedidos = prevValores.reduce((sum, v) => sum + v.desconto, 0);

        // Calcular percentuais
        relatorioState.statistics.comparacao.totalVendas = calculatePercentChange(prevTotalVendas, relatorioState.statistics.totalVendas);
        relatorioState.statistics.comparacao.numeroVendas = calculatePercentChange(prevNumeroVendas, relatorioState.statistics.numeroVendas);
        relatorioState.statistics.comparacao.produtosVendidos = calculatePercentChange(prevProdutosVendidos, relatorioState.statistics.produtosVendidos);
        relatorioState.statistics.comparacao.descontosConcedidos = calculatePercentChange(prevDescontosConcedidos, relatorioState.statistics.descontosConcedidos);

    } catch (error) {
        console.error('Erro ao calcular comparação:', error);
        // Zerar comparações em caso de erro
        relatorioState.statistics.comparacao = {
            totalVendas: 0,
            numeroVendas: 0,
            produtosVendidos: 0,
            descontosConcedidos: 0
        };
    }
}

function calculatePercentChange(previous, current) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

// ===== ATUALIZAÇÃO DA INTERFACE =====
function updateStatisticsDisplay() {
    // Atualizar valores
    const totalVendasEl = document.getElementById('total-vendas');
    const numeroVendasEl = document.getElementById('numero-vendas');
    const produtosVendidosEl = document.getElementById('produtos-vendidos');
    const descontosEl = document.getElementById('descontos-concedidos');

    if (totalVendasEl) totalVendasEl.textContent = formatCurrency(relatorioState.statistics.totalVendas);
    if (numeroVendasEl) numeroVendasEl.textContent = relatorioState.statistics.numeroVendas.toLocaleString('pt-BR');
    if (produtosVendidosEl) produtosVendidosEl.textContent = relatorioState.statistics.produtosVendidos.toLocaleString('pt-BR');
    if (descontosEl) descontosEl.textContent = formatCurrency(relatorioState.statistics.descontosConcedidos);

    // Atualizar indicadores de mudança
    updateChangeIndicator('total-vendas-change', relatorioState.statistics.comparacao.totalVendas);
    updateChangeIndicator('numero-vendas-change', relatorioState.statistics.comparacao.numeroVendas);
    updateChangeIndicator('produtos-vendidos-change', relatorioState.statistics.comparacao.produtosVendidos);
    updateChangeIndicator('descontos-change', relatorioState.statistics.comparacao.descontosConcedidos, true);
}

function updateChangeIndicator(elementId, percent, isReverse = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const icon = element.querySelector('i');
    const span = element.querySelector('span');
    
    if (!icon || !span) return;

    const absPercent = Math.abs(percent);
    const isPositive = percent > 0;
    const isNeutral = percent === 0;

    // Para descontos, menos é melhor (reverse)
    const isGood = isReverse ? !isPositive : isPositive;

    // Atualizar classe
    element.className = 'stat-change ' + (isNeutral ? 'neutral' : isGood ? 'positive' : 'negative');

    // Atualizar ícone
    if (isNeutral) {
        icon.className = 'fas fa-minus';
    } else if (isPositive) {
        icon.className = 'fas fa-arrow-up';
    } else {
        icon.className = 'fas fa-arrow-down';
    }

    // Atualizar texto
    span.textContent = absPercent.toFixed(1) + '%';
}

function updateTodayDisplay() {
    const todayVendasEl = document.getElementById('today-vendas');
    const todayValorEl = document.getElementById('today-valor');
    const todayProdutosEl = document.getElementById('today-produtos');

    if (todayVendasEl) todayVendasEl.textContent = relatorioState.todayStats.vendas;
    if (todayValorEl) todayValorEl.textContent = formatCurrency(relatorioState.todayStats.valor);
    if (todayProdutosEl) todayProdutosEl.textContent = relatorioState.todayStats.produtos;
}

// ===== ANÁLISES AVANÇADAS =====
function getTopProdutos(limite = 10) {
    const produtosMap = new Map();
    
    relatorioState.vendasData.forEach(venda => {
        const produto = venda.produto_nome;
        const quantidade = parseInt(venda.quantidade_unit) || 0;
        const valor = parseFloat(venda.subtotal_item) || 0;
        
        if (produtosMap.has(produto)) {
            const existing = produtosMap.get(produto);
            existing.quantidade += quantidade;
            existing.valor += valor;
        } else {
            produtosMap.set(produto, {
                nome: produto,
                quantidade: quantidade,
                valor: valor
            });
        }
    });
    
    return Array.from(produtosMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, limite);
}

function getFormasPagamento() {
    const formasMap = new Map();
    const vendasUnicas = new Map();
    
    // Primeiro, agrupar vendas únicas
    relatorioState.vendasData.forEach(venda => {
        if (!vendasUnicas.has(venda.id_venda)) {
            vendasUnicas.set(venda.id_venda, {
                forma: venda.forma_pagamento,
                valor: parseFloat(venda.total_venda) || 0
            });
        }
    });
    
    // Depois, contar por forma de pagamento
    vendasUnicas.forEach(venda => {
        const forma = venda.forma || 'Não informado';
        
        if (formasMap.has(forma)) {
            const existing = formasMap.get(forma);
            existing.quantidade += 1;
            existing.valor += venda.valor;
        } else {
            formasMap.set(forma, {
                forma: forma,
                quantidade: 1,
                valor: venda.valor
            });
        }
    });
    
    return Array.from(formasMap.values())
        .sort((a, b) => b.valor - a.valor);
}

function getVendasPorDiaSemana() {
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const vendasPorDia = new Array(7).fill(0).map(() => ({ vendas: 0, valor: 0 }));
    const vendasUnicas = new Map();
    
    // Agrupar vendas únicas
    relatorioState.vendasData.forEach(venda => {
        if (!vendasUnicas.has(venda.id_venda)) {
            vendasUnicas.set(venda.id_venda, {
                data: new Date(venda.hora_venda),
                valor: parseFloat(venda.total_venda) || 0
            });
        }
    });
    
    // Contar por dia da semana
    vendasUnicas.forEach(venda => {
        const diaSemana = venda.data.getDay();
        vendasPorDia[diaSemana].vendas += 1;
        vendasPorDia[diaSemana].valor += venda.valor;
    });
    
    return vendasPorDia.map((data, index) => ({
        dia: diasSemana[index],
        vendas: data.vendas,
        valor: data.valor
    }));
}

function getVendasPorHorario() {
    const horarios = new Array(24).fill(0).map(() => ({ vendas: 0, valor: 0 }));
    const vendasUnicas = new Map();
    
    // Agrupar vendas únicas
    relatorioState.vendasData.forEach(venda => {
        if (!vendasUnicas.has(venda.id_venda)) {
            vendasUnicas.set(venda.id_venda, {
                hora: new Date(venda.hora_venda).getHours(),
                valor: parseFloat(venda.total_venda) || 0
            });
        }
    });
    
    // Contar por horário
    vendasUnicas.forEach(venda => {
        horarios[venda.hora].vendas += 1;
        horarios[venda.hora].valor += venda.valor;
    });
    
    return horarios.map((data, index) => ({
        hora: `${index.toString().padStart(2, '0')}:00`,
        vendas: data.vendas,
        valor: data.valor
    }));
}

function getResumoVendas() {
    if (!relatorioState.vendasData || relatorioState.vendasData.length === 0) {
        return {
            ticketMedio: 0,
            maiorVenda: 0,
            menorVenda: 0,
            totalTransacoes: 0,
            produtoMaisVendido: 'Nenhum',
            formaPagamentoMaisUsada: 'Nenhuma'
        };
    }
    
    const vendasUnicas = new Map();
    const produtosMap = new Map();
    const formasMap = new Map();
    
    // Processar vendas únicas
    relatorioState.vendasData.forEach(venda => {
        const idVenda = venda.id_venda;
        const valor = parseFloat(venda.total_venda) || 0;
        const quantidade = parseInt(venda.quantidade_unit) || 0;
        const produto = venda.produto_nome;
        const forma = venda.forma_pagamento;
        
        // Vendas únicas
        if (!vendasUnicas.has(idVenda)) {
            vendasUnicas.set(idVenda, {
                valor: valor,
                forma: forma
            });
        }
        
        // Produtos
        if (produtosMap.has(produto)) {
            produtosMap.set(produto, produtosMap.get(produto) + quantidade);
        } else {
            produtosMap.set(produto, quantidade);
        }
    });
    
    // Contar formas de pagamento
    vendasUnicas.forEach(venda => {
        const forma = venda.forma;
        formasMap.set(forma, (formasMap.get(forma) || 0) + 1);
    });
    
    const valores = Array.from(vendasUnicas.values()).map(v => v.valor);
    const totalVendas = valores.reduce((sum, v) => sum + v, 0);
    const totalTransacoes = valores.length;
    
    // Produto mais vendido
    let produtoMaisVendido = 'Nenhum';
    let maiorQuantidade = 0;
    produtosMap.forEach((quantidade, produto) => {
        if (quantidade > maiorQuantidade) {
            maiorQuantidade = quantidade;
            produtoMaisVendido = produto;
        }
    });
    
    // Forma de pagamento mais usada
    let formaMaisUsada = 'Nenhuma';
    let maiorUso = 0;
    formasMap.forEach((uso, forma) => {
        if (uso > maiorUso) {
            maiorUso = uso;
            formaMaisUsada = forma;
        }
    });
    
    return {
        ticketMedio: totalTransacoes > 0 ? totalVendas / totalTransacoes : 0,
        maiorVenda: valores.length > 0 ? Math.max(...valores) : 0,
        menorVenda: valores.length > 0 ? Math.min(...valores) : 0,
        totalTransacoes: totalTransacoes,
        produtoMaisVendido: produtoMaisVendido,
        formaPagamentoMaisUsada: formaMaisUsada
    };
}

// ===== EXPORTAR FUNÇÕES PARA USO GLOBAL =====
window.getTopProdutos = getTopProdutos;
window.getFormasPagamento = getFormasPagamento;
window.getVendasPorDiaSemana = getVendasPorDiaSemana;
window.getVendasPorHorario = getVendasPorHorario;
window.getResumoVendas = getResumoVendas;