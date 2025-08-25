// ===== RELATÓRIO DE VENDAS - GRÁFICOS =====

let evolutionChart = null;

// ===== INICIALIZAÇÃO DO GRÁFICO =====
function initializeChart(vendasData) {
    const ctx = document.getElementById('vendas-evolution-chart');
    if (!ctx) {
        console.error('Canvas do gráfico não encontrado');
        return;
    }

    const chartType = document.getElementById('chart-type')?.value || 'valor';
    const chartPeriod = document.getElementById('chart-period')?.value || 'day';
    
    createEvolutionChart(ctx, vendasData, chartType, chartPeriod);
}

// ===== CRIAÇÃO DO GRÁFICO DE EVOLUÇÃO =====
function createEvolutionChart(ctx, vendasData, type, period) {
    // Destruir gráfico existente
    if (evolutionChart) {
        evolutionChart.destroy();
    }

    const chartData = processChartData(vendasData, type, period);
    
    const config = {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: createDatasets(chartData, type)
        },
        options: getChartOptions(type)
    };

    evolutionChart = new Chart(ctx, config);
}

// ===== PROCESSAMENTO DOS DADOS =====
function processChartData(vendasData, type, period) {
    const groupedData = groupDataByPeriod(vendasData, period);
    const labels = Object.keys(groupedData).sort();
    
    const data = {
        labels: labels.map(label => formatLabel(label, period)),
        valor: [],
        quantidade: []
    };

    labels.forEach(label => {
        const vendas = groupedData[label];
        
        // Calcular valor total (agrupando por id_venda para evitar duplicação)
        const vendasUnicas = {};
        vendas.forEach(venda => {
            if (!vendasUnicas[venda.id_venda]) {
                vendasUnicas[venda.id_venda] = {
                    total_venda: parseFloat(venda.total_venda) || 0,
                    quantidade_total: 0
                };
            }
        });

        // Calcular quantidade total de produtos
        vendas.forEach(venda => {
            if (vendasUnicas[venda.id_venda]) {
                vendasUnicas[venda.id_venda].quantidade_total += parseInt(venda.quantidade_unit) || 0;
            }
        });

        const totalValor = Object.values(vendasUnicas).reduce((sum, venda) => sum + venda.total_venda, 0);
        const totalQuantidade = Object.values(vendasUnicas).reduce((sum, venda) => sum + venda.quantidade_total, 0);

        data.valor.push(totalValor);
        data.quantidade.push(totalQuantidade);
    });

    return data;
}

function groupDataByPeriod(vendasData, period) {
    const grouped = {};

    vendasData.forEach(venda => {
        const date = new Date(venda.hora_venda);
        let key;

        switch (period) {
            case 'day':
                key = date.toISOString().split('T')[0]; // YYYY-MM-DD
                break;
            case 'week':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
                break;
            case 'month':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
            default:
                key = date.toISOString().split('T')[0];
        }

        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(venda);
    });

    return grouped;
}

function formatLabel(label, period) {
    const date = new Date(label);
    
    switch (period) {
        case 'day':
            return date.toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit' 
            });
        case 'week':
            const weekEnd = new Date(date);
            weekEnd.setDate(date.getDate() + 6);
            return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
        case 'month':
            return date.toLocaleDateString('pt-BR', { 
                month: 'short', 
                year: 'numeric' 
            });
        default:
            return date.toLocaleDateString('pt-BR');
    }
}

// ===== CRIAÇÃO DOS DATASETS =====
function createDatasets(chartData, type) {
    const datasets = [];

    if (type === 'valor' || type === 'ambos') {
        datasets.push({
            label: 'Valor (R$)',
            data: chartData.valor,
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            borderColor: '#FF9800',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#FF9800',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            yAxisID: 'y'
        });
    }

    if (type === 'quantidade' || type === 'ambos') {
        datasets.push({
            label: 'Quantidade',
            data: chartData.quantidade,
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderColor: '#2196F3',
            borderWidth: 3,
            fill: type === 'quantidade', // Só preencher se for só quantidade
            tension: 0.4,
            pointBackgroundColor: '#2196F3',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            yAxisID: type === 'ambos' ? 'y1' : 'y'
        });
    }

    return datasets;
}

// ===== OPÇÕES DO GRÁFICO =====
function getChartOptions(type) {
    const scales = {
        x: {
            grid: {
                display: false
            },
            ticks: {
                font: {
                    size: 11,
                    weight: '500'
                },
                color: '#666',
                maxRotation: 45
            }
        },
        y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: {
                color: '#f1f3f4',
                borderDash: [2, 2]
            },
            ticks: {
                font: {
                    size: 11
                },
                color: '#666',
                callback: function(value) {
                    if (type === 'valor' || (type === 'ambos')) {
                        return new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        }).format(value);
                    }
                    return value.toLocaleString('pt-BR');
                }
            }
        }
    };

    // Adicionar eixo Y secundário para gráfico "ambos"
    if (type === 'ambos') {
        scales.y1 = {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: {
                drawOnChartArea: false,
            },
            ticks: {
                font: {
                    size: 11
                },
                color: '#666',
                callback: function(value) {
                    return value.toLocaleString('pt-BR');
                }
            }
        };
    }

    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index'
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                align: 'end',
                labels: {
                    boxWidth: 12,
                    boxHeight: 12,
                    borderRadius: 6,
                    useBorderRadius: true,
                    font: {
                        size: 12,
                        weight: '500'
                    },
                    color: '#666',
                    padding: 20
                }
            },
            tooltip: {
                backgroundColor: 'rgba(44, 62, 80, 0.95)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#FF9800',
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                titleFont: {
                    size: 13,
                    weight: '600'
                },
                bodyFont: {
                    size: 12
                },
                callbacks: {
                    title: function(context) {
                        return context[0].label;
                    },
                    label: function(context) {
                        const datasetLabel = context.dataset.label;
                        const value = context.parsed.y;
                        
                        if (datasetLabel.includes('Valor')) {
                            return `${datasetLabel}: ${new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                            }).format(value)}`;
                        } else {
                            return `${datasetLabel}: ${value.toLocaleString('pt-BR')} itens`;
                        }
                    }
                }
            }
        },
        scales: scales,
        elements: {
            point: {
                hoverBorderWidth: 3
            },
            line: {
                borderCapStyle: 'round',
                borderJoinStyle: 'round'
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        }
    };
}

// ===== FUNÇÃO DE ATUALIZAÇÃO =====
function updateChart(vendasData, type, period) {
    if (!evolutionChart) {
        console.warn('Gráfico não inicializado');
        return;
    }

    const chartData = processChartData(vendasData, type, period);
    
    // Atualizar labels
    evolutionChart.data.labels = chartData.labels;
    
    // Atualizar datasets
    evolutionChart.data.datasets = createDatasets(chartData, type);
    
    // Atualizar opções (principalmente scales)
    evolutionChart.options = getChartOptions(type);
    
    // Redesenhar gráfico
    evolutionChart.update('active');
}

// ===== FUNÇÕES DE ANÁLISE ADICIONAL =====
function getChartSummary(vendasData) {
    if (!vendasData || vendasData.length === 0) {
        return {
            totalVendas: 0,
            mediaVendasDia: 0,
            maiorVenda: 0,
            menorVenda: 0,
            tendencia: 'estável'
        };
    }

    // Agrupar vendas únicas por ID
    const vendasUnicas = {};
    vendasData.forEach(venda => {
        if (!vendasUnicas[venda.id_venda]) {
            vendasUnicas[venda.id_venda] = {
                total: parseFloat(venda.total_venda) || 0,
                data: new Date(venda.hora_venda)
            };
        }
    });

    const valores = Object.values(vendasUnicas).map(v => v.total);
    const datasUnicas = [...new Set(vendasData.map(v => v.hora_venda.split('T')[0]))];

    const totalVendas = valores.reduce((sum, val) => sum + val, 0);
    const mediaVendasDia = totalVendas / datasUnicas.length;
    const maiorVenda = Math.max(...valores);
    const menorVenda = Math.min(...valores);

    // Calcular tendência simples
    const tendencia = calcularTendencia(vendasUnicas);

    return {
        totalVendas,
        mediaVendasDia,
        maiorVenda,
        menorVenda,
        tendencia
    };
}

function calcularTendencia(vendasUnicas) {
    const vendas = Object.values(vendasUnicas).sort((a, b) => a.data - b.data);
    
    if (vendas.length < 2) return 'estável';

    const metadeInicial = vendas.slice(0, Math.floor(vendas.length / 2));
    const metadeFinal = vendas.slice(Math.ceil(vendas.length / 2));

    const mediaInicial = metadeInicial.reduce((sum, v) => sum + v.total, 0) / metadeInicial.length;
    const mediaFinal = metadeFinal.reduce((sum, v) => sum + v.total, 0) / metadeFinal.length;

    const diferenca = ((mediaFinal - mediaInicial) / mediaInicial) * 100;

    if (diferenca > 5) return 'crescimento';
    if (diferenca < -5) return 'declínio';
    return 'estável';
}

// ===== FUNÇÕES DE EXPORTAÇÃO DE GRÁFICO =====
function exportChartAsImage() {
    if (!evolutionChart) {
        console.warn('Gráfico não disponível para exportação');
        return;
    }

    try {
        const canvas = evolutionChart.canvas;
        const url = canvas.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.download = `grafico_vendas_${new Date().toISOString().split('T')[0]}.png`;
        link.href = url;
        link.click();

        if (typeof showNotification === 'function') {
            showNotification('Gráfico exportado como imagem!', 'success');
        }
    } catch (error) {
        console.error('Erro ao exportar gráfico:', error);
        if (typeof showNotification === 'function') {
            showNotification('Erro ao exportar gráfico', 'error');
        }
    }
}

// ===== CONFIGURAÇÕES DE RESPONSIVIDADE =====
function handleChartResize() {
    if (evolutionChart) {
        evolutionChart.resize();
    }
}

// Event listener para redimensionamento
window.addEventListener('resize', handleChartResize);

// ===== FUNÇÕES DE CORES DINÂMICAS =====
function getColorPalette() {
    return {
        primary: '#FF9800',
        primaryLight: '#FFB74D',
        primaryDark: '#F57C00',
        secondary: '#2196F3',
        secondaryLight: '#64B5F6',
        secondaryDark: '#1976D2',
        success: '#4CAF50',
        warning: '#FFC107',
        error: '#F44336',
        info: '#00BCD4',
        gray: '#757575'
    };
}

function generateGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// ===== ANIMAÇÕES CUSTOMIZADAS =====
function addChartAnimations() {
    if (!evolutionChart) return;

    evolutionChart.options.animation = {
        duration: 2000,
        easing: 'easeInOutQuart',
        onProgress: function(animation) {
            const progress = animation.currentStep / animation.numSteps;
            // Você pode adicionar efeitos customizados baseados no progresso aqui
        },
        onComplete: function() {
            // Animação completa
            console.log('Animação do gráfico concluída');
        }
    };
}

// ===== INTERAÇÕES AVANÇADAS =====
function addChartInteractions() {
    if (!evolutionChart) return;

    const canvas = evolutionChart.canvas;
    
    canvas.addEventListener('click', (event) => {
        const points = evolutionChart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
        
        if (points.length > 0) {
            const firstPoint = points[0];
            const label = evolutionChart.data.labels[firstPoint.index];
            const value = evolutionChart.data.datasets[firstPoint.datasetIndex].data[firstPoint.index];
            
            console.log(`Clicou em: ${label} - Valor: ${value}`);
            
            // Você pode adicionar ações customizadas aqui
            // Por exemplo, mostrar detalhes, navegar para drill-down, etc.
        }
    });
}

// ===== PLUGIN CUSTOMIZADO PARA ANOTAÇÕES =====
const annotationPlugin = {
    id: 'customAnnotations',
    afterDraw: function(chart) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        
        // Exemplo: linha de meta
        if (chart.options.plugins?.customAnnotations?.showGoalLine) {
            const goalValue = chart.options.plugins.customAnnotations.goalValue;
            const yScale = chart.scales.y;
            const yPos = yScale.getPixelForValue(goalValue);
            
            ctx.save();
            ctx.strokeStyle = '#FF5722';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(chartArea.left, yPos);
            ctx.lineTo(chartArea.right, yPos);
            ctx.stroke();
            
            // Label da meta
            ctx.font = '12px Arial';
            ctx.fillStyle = '#FF5722';
            ctx.textAlign = 'right';
            ctx.fillText(`Meta: ${goalValue}`, chartArea.right - 10, yPos - 5);
            ctx.restore();
        }
    }
};

// Registrar plugin
if (typeof Chart !== 'undefined') {
    Chart.register(annotationPlugin);
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.initializeChart = initializeChart;
window.updateChart = updateChart;
window.exportChartAsImage = exportChartAsImage;
window.getChartSummary = getChartSummary;