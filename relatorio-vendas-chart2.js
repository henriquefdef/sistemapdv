// ===== RELATÓRIO DE VENDAS - GRÁFICOS ADICIONAIS =====

let topProdutosChart = null;
let formasPagamentoChart = null;
let diasSemanaChart = null;
let horariosChart = null;

// ===== INICIALIZAÇÃO DOS NOVOS GRÁFICOS =====
function initializeAdditionalCharts() {
    if (!relatorioState?.vendasData?.length) {
        console.log('Aguardando dados para inicializar gráficos adicionais...');
        return;
    }

    createTopProdutosChart();
    createFormasPagamentoChart();
    createDiasSemanaChart();
    createHorariosChart();
    
    console.log('Gráficos adicionais inicializados');
}

// ===== TOP 10 PRODUTOS =====
function createTopProdutosChart() {
    const ctx = document.getElementById('top-produtos-chart');
    if (!ctx) return;

    const topProdutos = getTopProdutos(10);
    
    if (topProdutosChart) topProdutosChart.destroy();

    topProdutosChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topProdutos.map(p => p.nome.length > 20 ? p.nome.substring(0, 20) + '...' : p.nome),
            datasets: [{
                label: 'Valor Vendido (R$)',
                data: topProdutos.map(p => p.valor),
                backgroundColor: 'rgba(255, 152, 0, 0.8)',
                borderColor: '#FF9800',
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#FF9800',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            return topProdutos[context[0].dataIndex].nome;
                        },
                        label: function(context) {
                            const produto = topProdutos[context.dataIndex];
                            return [
                                `Valor: ${formatCurrency(produto.valor)}`,
                                `Quantidade: ${produto.quantidade} un`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f3f4'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ===== FORMAS DE PAGAMENTO =====
function createFormasPagamentoChart() {
    const ctx = document.getElementById('formas-pagamento-chart');
    if (!ctx) return;

    const formasPagamento = getFormasPagamento();
    
    if (formasPagamentoChart) formasPagamentoChart.destroy();

    const colors = ['#FF9800', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#FF5722', '#795548', '#607D8B'];

    formasPagamentoChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: formasPagamento.map(f => f.forma),
            datasets: [{
                data: formasPagamento.map(f => f.valor),
                backgroundColor: colors.slice(0, formasPagamento.length),
                borderColor: '#fff',
                borderWidth: 2,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#FF9800',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const forma = formasPagamento[context.dataIndex];
                            const total = formasPagamento.reduce((sum, f) => sum + f.valor, 0);
                            const percentage = ((forma.valor / total) * 100).toFixed(1);
                            return [
                                `${forma.forma}: ${formatCurrency(forma.valor)}`,
                                `${forma.quantidade} vendas (${percentage}%)`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// ===== VENDAS POR DIA DA SEMANA =====
function createDiasSemanaChart() {
    const ctx = document.getElementById('dias-semana-chart');
    if (!ctx) return;

    const diasSemana = getVendasPorDiaSemana();
    
    if (diasSemanaChart) diasSemanaChart.destroy();

    diasSemanaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: diasSemana.map(d => d.dia),
            datasets: [
                {
                    label: 'Valor (R$)',
                    data: diasSemana.map(d => d.valor),
                    backgroundColor: 'rgba(255, 152, 0, 0.8)',
                    borderColor: '#FF9800',
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                    yAxisID: 'y'
                },
                {
                    label: 'Quantidade',
                    data: diasSemana.map(d => d.vendas),
                    type: 'line',
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: false,
                    pointBackgroundColor: '#2196F3',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end'
                },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#FF9800',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `Valor: ${formatCurrency(context.parsed.y)}`;
                            } else {
                                return `Vendas: ${context.parsed.y}`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                        color: '#f1f3f4'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
}

// ===== VENDAS POR HORÁRIO =====
function createHorariosChart() {
    const ctx = document.getElementById('horarios-chart');
    if (!ctx) return;

    const horarios = getVendasPorHorario();
    
    if (horariosChart) horariosChart.destroy();

    horariosChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: horarios.map(h => h.hora),
            datasets: [{
                label: 'Vendas por Horário',
                data: horarios.map(h => h.vendas),
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                borderColor: '#FF9800',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#FF9800',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#FF9800',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            return `${context[0].label}`;
                        },
                        label: function(context) {
                            const horario = horarios[context.dataIndex];
                            return [
                                `Vendas: ${horario.vendas}`,
                                `Valor: ${formatCurrency(horario.valor)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 12,
                        callback: function(value, index) {
                            return index % 2 === 0 ? this.getLabelForValue(value) : '';
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f3f4'
                    },
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// ===== FUNÇÕES DE DADOS =====
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
    
    // Agrupar vendas únicas
    relatorioState.vendasData.forEach(venda => {
        if (!vendasUnicas.has(venda.id_venda)) {
            vendasUnicas.set(venda.id_venda, {
                forma: venda.forma_pagamento,
                valor: parseFloat(venda.total_venda) || 0
            });
        }
    });
    
    // Contar por forma de pagamento
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

// ===== ATUALIZAÇÃO DOS GRÁFICOS =====
function updateAdditionalCharts() {
    if (relatorioState?.vendasData?.length) {
        createTopProdutosChart();
        createFormasPagamentoChart();
        createDiasSemanaChart();
        createHorariosChart();
        console.log('Gráficos adicionais atualizados');
    }
}

// ===== REDIMENSIONAMENTO =====
function resizeAdditionalCharts() {
    [topProdutosChart, formasPagamentoChart, diasSemanaChart, horariosChart].forEach(chart => {
        if (chart) chart.resize();
    });
}

// ===== INTEGRAÇÃO COM O SISTEMA PRINCIPAL =====
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar dados serem carregados
    setTimeout(() => {
        if (relatorioState?.vendasData?.length) {
            initializeAdditionalCharts();
        }
    }, 1000);
});

// Event listener para quando dados são atualizados
document.addEventListener('dataUpdated', () => {
    updateAdditionalCharts();
});

window.addEventListener('resize', () => {
    setTimeout(resizeAdditionalCharts, 100);
});

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.initializeAdditionalCharts = initializeAdditionalCharts;
window.updateAdditionalCharts = updateAdditionalCharts;
window.getTopProdutos = getTopProdutos;
window.getFormasPagamento = getFormasPagamento;
window.getVendasPorDiaSemana = getVendasPorDiaSemana;
window.getVendasPorHorario = getVendasPorHorario;