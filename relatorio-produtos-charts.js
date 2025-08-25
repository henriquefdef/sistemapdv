// ===== RELATÓRIO DE PRODUTOS - GRÁFICOS =====

let categoriaChart = null;
let topProdutosValorChart = null;
let margemChart = null;
let estoqueStatusChart = null;
let marcasChart = null;
let faixaPrecoChart = null;

// ===== CORES E PALETA =====
const chartColors = {
    primary: ['#FF9800', '#FFB74D', '#FF8F00', '#FFA726', '#FFB74D'],
    secondary: ['#2196F3', '#64B5F6', '#1976D2', '#42A5F5', '#64B5F6'],
    success: ['#4CAF50', '#81C784', '#388E3C', '#66BB6A', '#81C784'],
    warning: ['#FFC107', '#FFD54F', '#F57F17', '#FFCA28', '#FFD54F'],
    error: ['#F44336', '#E57373', '#D32F2F', '#EF5350', '#E57373'],
    mixed: ['#FF9800', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#FF5722', '#795548', '#607D8B']
};

// ===== INICIALIZAÇÃO DOS GRÁFICOS =====
function initializeProdutosCharts() {
    console.log('Iniciando gráficos de produtos...');
    
    setTimeout(() => {
        if (!relatorioProdutosState?.produtosData?.length) {
            console.log('Dados ainda não carregados, tentando novamente...');
            setTimeout(initializeProdutosCharts, 1000);
            return;
        }

        try {
            createCategoriaChart();
            createTopProdutosValorChart();
            createMargemChart();
            createEstoqueStatusChart();
            createMarcasChart();
            createFaixaPrecoChart();
            console.log('Gráficos de produtos inicializados com sucesso');
        } catch (error) {
            console.error('Erro ao inicializar gráficos de produtos:', error);
        }
    }, 300);
}

// ===== GRÁFICO DE CATEGORIAS =====
function createCategoriaChart(metric = 'quantidade') {
    const ctx = document.getElementById('categoria-chart');
    if (!ctx) {
        console.error('Canvas categoria-chart não encontrado');
        return;
    }

    const categoriaData = getCategoriaDistribution(metric);
    
    if (categoriaChart) {
        categoriaChart.destroy();
    }

    categoriaChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categoriaData.map(item => item.nome),
            datasets: [{
                data: categoriaData.map(item => metric === 'valor' ? item.valor : item.quantidade),
                backgroundColor: chartColors.mixed.slice(0, categoriaData.length),
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
                        pointStyle: 'circle',
                        font: {
                            size: 11
                        }
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
                            const item = categoriaData[context.dataIndex];
                            const total = categoriaData.reduce((sum, cat) => 
                                sum + (metric === 'valor' ? cat.valor : cat.quantidade), 0);
                            const value = metric === 'valor' ? item.valor : item.quantidade;
                            const percentage = ((value / total) * 100).toFixed(1);
                            
                            return [
                                `${item.nome}`,
                                metric === 'valor' 
                                    ? `Valor: ${formatCurrency(item.valor)}`
                                    : `Produtos: ${item.quantidade}`,
                                `${percentage}% do total`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// ===== GRÁFICO TOP PRODUTOS POR VALOR =====
function createTopProdutosValorChart() {
    const ctx = document.getElementById('top-produtos-valor-chart');
    if (!ctx) {
        console.error('Canvas top-produtos-valor-chart não encontrado');
        return;
    }

    const topProdutos = getTopProdutosByValue(10);
    
    if (topProdutosValorChart) {
        topProdutosValorChart.destroy();
    }

    topProdutosValorChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topProdutos.map(p => p.nome.length > 15 ? p.nome.substring(0, 15) + '...' : p.nome),
            datasets: [{
                label: 'Valor em Estoque (R$)',
                data: topProdutos.map(p => p.valorTotal),
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
                                `Valor Total: ${formatCurrency(produto.valorTotal)}`,
                                `Preço: ${formatCurrency(produto.preco)}`,
                                `Estoque: ${produto.estoque} un`,
                                `Categoria: ${produto.categoria}`
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
                        },
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

// ===== GRÁFICO DE MARGEM =====
function createMargemChart(view = 'distribuicao') {
    const ctx = document.getElementById('margem-chart');
    if (!ctx) {
        console.error('Canvas margem-chart não encontrado');
        return;
    }

    const margemData = getMargemAnalysis(view);
    
    if (margemChart) {
        margemChart.destroy();
    }

    if (view === 'distribuicao') {
        margemChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: margemData.map(item => item.faixa),
                datasets: [{
                    label: 'Quantidade de Produtos',
                    data: margemData.map(item => item.quantidade),
                    backgroundColor: 'rgba(76, 175, 80, 0.8)',
                    borderColor: '#4CAF50',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
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
                        borderColor: '#4CAF50',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const item = margemData[context.dataIndex];
                                return `${item.quantidade} produtos`;
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
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f3f4'
                        },
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    } else {
        margemChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: margemData.map(item => item.categoria),
                datasets: [{
                    label: 'Margem Média (%)',
                    data: margemData.map(item => item.margemMedia),
                    backgroundColor: 'rgba(33, 150, 243, 0.8)',
                    borderColor: '#2196F3',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
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
                        borderColor: '#2196F3',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const item = margemData[context.dataIndex];
                                return [
                                    `Margem Média: ${item.margemMedia.toFixed(1)}%`,
                                    `Produtos: ${item.produtos}`
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
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f3f4'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    }
}

// ===== GRÁFICO STATUS DO ESTOQUE =====
function createEstoqueStatusChart() {
    const ctx = document.getElementById('estoque-status-chart');
    if (!ctx) {
        console.error('Canvas estoque-status-chart não encontrado');
        return;
    }

    const statusData = getEstoqueStatus();
    
    if (estoqueStatusChart) {
        estoqueStatusChart.destroy();
    }

    const statusColors = {
        'Sem Estoque': '#F44336',
        'Estoque Baixo': '#FFC107',
        'Estoque Normal': '#4CAF50',
        'Sem Limite Definido': '#2196F3'
    };

    estoqueStatusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: statusData.map(item => item.status),
            datasets: [{
                data: statusData.map(item => item.quantidade),
                backgroundColor: statusData.map(item => statusColors[item.status]),
                borderColor: '#fff',
                borderWidth: 2,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 11
                        }
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
                            const item = statusData[context.dataIndex];
                            const total = statusData.reduce((sum, s) => sum + s.quantidade, 0);
                            const percentage = ((item.quantidade / total) * 100).toFixed(1);
                            
                            return [
                                `${item.status}: ${item.quantidade} produtos`,
                                `${percentage}% do total`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// ===== GRÁFICO TOP MARCAS =====
function createMarcasChart(metric = 'quantidade') {
    const ctx = document.getElementById('marcas-chart');
    if (!ctx) {
        console.error('Canvas marcas-chart não encontrado');
        return;
    }

    const marcasData = getTopMarcas(metric, 10);
    
    if (marcasChart) {
        marcasChart.destroy();
    }

    marcasChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: marcasData.map(m => m.nome.length > 15 ? m.nome.substring(0, 15) + '...' : m.nome),
            datasets: [{
                label: metric === 'valor' ? 'Valor em Estoque (R$)' : 'Quantidade de Produtos',
                data: marcasData.map(m => metric === 'valor' ? m.valor : m.quantidade),
                backgroundColor: 'rgba(156, 39, 176, 0.8)',
                borderColor: '#9C27B0',
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
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
                    borderColor: '#9C27B0',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            return marcasData[context[0].dataIndex].nome;
                        },
                        label: function(context) {
                            const marca = marcasData[context.dataIndex];
                            return [
                                `Produtos: ${marca.quantidade}`,
                                `Valor: ${formatCurrency(marca.valor)}`
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
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f3f4'
                    },
                    ticks: {
                        callback: function(value) {
                            return metric === 'valor' ? formatCurrency(value) : value;
                        },
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

// ===== GRÁFICO FAIXA DE PREÇO =====
function createFaixaPrecoChart() {
    const ctx = document.getElementById('faixa-preco-chart');
    if (!ctx) {
        console.error('Canvas faixa-preco-chart não encontrado');
        return;
    }

    const faixaData = getFaixaPrecoDistribution();
    
    if (faixaPrecoChart) {
        faixaPrecoChart.destroy();
    }

    faixaPrecoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: faixaData.map(item => item.faixa),
            datasets: [{
                label: 'Quantidade de Produtos',
                data: faixaData.map(item => item.quantidade),
                backgroundColor: 'rgba(255, 87, 34, 0.8)',
                borderColor: '#FF5722',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
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
                    borderColor: '#FF5722',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const item = faixaData[context.dataIndex];
                            const total = faixaData.reduce((sum, f) => sum + f.quantidade, 0);
                            const percentage = ((item.quantidade / total) * 100).toFixed(1);
                            
                            return [
                                `${item.quantidade} produtos`,
                                `${percentage}% do total`
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
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f3f4'
                    },
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

// ===== FUNÇÕES DE ATUALIZAÇÃO =====
function updateCategoriaChart(metric) {
    createCategoriaChart(metric);
}

function updateMargemChart(view) {
    createMargemChart(view);
}

function updateMarcasChart(metric) {
    createMarcasChart(metric);
}

function updateProdutosCharts() {
    console.log('Atualizando gráficos de produtos...');
    
    if (!relatorioProdutosState?.produtosData?.length) {
        console.log('Dados não disponíveis para atualização');
        return;
    }

    try {
        // Obter valores atuais dos controles
        const categoriaMetric = document.getElementById('categoria-metric')?.value || 'quantidade';
        const margemView = document.getElementById('margem-view')?.value || 'distribuicao';
        const marcaMetric = document.getElementById('marca-metric')?.value || 'quantidade';
        
        createCategoriaChart(categoriaMetric);
        createTopProdutosValorChart();
        createMargemChart(margemView);
        createEstoqueStatusChart();
        createMarcasChart(marcaMetric);
        createFaixaPrecoChart();
        
        console.log('Gráficos de produtos atualizados com sucesso');
    } catch (error) {
        console.error('Erro ao atualizar gráficos de produtos:', error);
    }
}

// ===== REDIMENSIONAMENTO =====
function resizeProdutosCharts() {
    const charts = [
        categoriaChart, 
        topProdutosValorChart, 
        margemChart, 
        estoqueStatusChart, 
        marcasChart, 
        faixaPrecoChart
    ];
    
    charts.forEach(chart => {
        if (chart) {
            try {
                chart.resize();
            } catch (error) {
                console.warn('Erro ao redimensionar gráfico:', error);
            }
        }
    });
}

// ===== DESTRUIR GRÁFICOS =====
function destroyProdutosCharts() {
    const charts = [
        categoriaChart, 
        topProdutosValorChart, 
        margemChart, 
        estoqueStatusChart, 
        marcasChart, 
        faixaPrecoChart
    ];
    
    charts.forEach(chart => {
        if (chart) {
            try {
                chart.destroy();
            } catch (error) {
                console.warn('Erro ao destruir gráfico:', error);
            }
        }
    });
    
    // Resetar variáveis
    categoriaChart = null;
    topProdutosValorChart = null;
    margemChart = null;
    estoqueStatusChart = null;
    marcasChart = null;
    faixaPrecoChart = null;
}

// ===== EXPORTAÇÃO DE GRÁFICOS =====
function exportProdutosChartsAsImages() {
    const charts = [
        { chart: categoriaChart, name: 'distribuicao_categorias' },
        { chart: topProdutosValorChart, name: 'top_produtos_valor' },
        { chart: margemChart, name: 'analise_margem' },
        { chart: estoqueStatusChart, name: 'status_estoque' },
        { chart: marcasChart, name: 'top_marcas' },
        { chart: faixaPrecoChart, name: 'faixa_precos' }
    ];

    charts.forEach(({ chart, name }) => {
        if (chart) {
            try {
                const canvas = chart.canvas;
                const url = canvas.toDataURL('image/png');
                
                const link = document.createElement('a');
                link.download = `grafico_${name}_${new Date().toISOString().split('T')[0]}.png`;
                link.href = url;
                link.click();
            } catch (error) {
                console.error(`Erro ao exportar gráfico ${name}:`, error);
            }
        }
    });

    if (typeof showNotification === 'function') {
        showNotification('Gráficos exportados como imagens!', 'success');
    }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, aguardando dados para gráficos de produtos...');
});

// Aguardar dados serem carregados
document.addEventListener('userDataReady', () => {
    setTimeout(initializeProdutosCharts, 1500);
});

// Redimensionamento da janela
window.addEventListener('resize', () => {
    setTimeout(resizeProdutosCharts, 100);
});

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.initializeProdutosCharts = initializeProdutosCharts;
window.updateProdutosCharts = updateProdutosCharts;
window.updateCategoriaChart = updateCategoriaChart;
window.updateMargemChart = updateMargemChart;
window.updateMarcasChart = updateMarcasChart;
window.resizeProdutosCharts = resizeProdutosCharts;
window.destroyProdutosCharts = destroyProdutosCharts;
window.exportProdutosChartsAsImages = exportProdutosChartsAsImages;