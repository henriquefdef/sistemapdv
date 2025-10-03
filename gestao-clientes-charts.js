// ===== GESTÃO DE CLIENTES - GRÁFICOS E VISUALIZAÇÕES =====

// ===== RENDERIZAÇÃO DE GRÁFICOS =====
function renderCharts() {
    renderCidadesChart();
    renderInatividadeChart();
    renderPadraoComprasChart();
    renderEvolucaoClientesChart();
}

function renderCidadesChart() {
    const ctx = document.getElementById('cidades-chart');
    if (!ctx) return;

    // Obter o tipo de filtro selecionado
    const locationFilter = document.getElementById('location-filter');
    const filterType = locationFilter ? locationFilter.value : 'cidade';
    
    // Agrupar clientes por localização (cidade ou bairro)
    const locationsCount = {};
    gestaoState.processedClients.forEach(client => {
        let location;
        if (filterType === 'bairro') {
            location = client.bairro || 'Não informado';
        } else {
            location = client.cidade || 'Não informado';
        }
        locationsCount[location] = (locationsCount[location] || 0) + 1;
    });

    // Pegar top 10 localizações
    const sortedLocations = Object.entries(locationsCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

    if (gestaoState.charts.cidades) {
        gestaoState.charts.cidades.destroy();
    }

    const chartTitle = filterType === 'bairro' ? 'bairros' : 'cidades';
    
    gestaoState.charts.cidades = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedLocations.map(([location]) => location),
            datasets: [{
                data: sortedLocations.map(([, count]) => count),
                backgroundColor: [
                    '#FF9800', '#FFB74D', '#FFC107', '#FF5722', '#4CAF50',
                    '#2196F3', '#9C27B0', '#607D8B', '#795548', '#E91E63'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
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
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((context.parsed / total) * 100);
                            return `${context.label}: ${context.parsed} clientes (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderInatividadeChart() {
    const ctx = document.getElementById('inatividade-chart');
    if (!ctx) return;

    // Agrupar clientes por período de inatividade
    const inatividade = {
        '0-30 dias': 0,
        '31-60 dias': 0,
        '61-90 dias': 0,
        '91-180 dias': 0,
        'Mais de 180 dias': 0,
        'Sem compras': 0
    };

    gestaoState.processedClients.forEach(client => {
        const dias = client.dias_sem_comprar;
        if (dias === null) {
            inatividade['Sem compras']++;
        } else if (dias <= 30) {
            inatividade['0-30 dias']++;
        } else if (dias <= 60) {
            inatividade['31-60 dias']++;
        } else if (dias <= 90) {
            inatividade['61-90 dias']++;
        } else if (dias <= 180) {
            inatividade['91-180 dias']++;
        } else {
            inatividade['Mais de 180 dias']++;
        }
    });

    if (gestaoState.charts.inatividade) {
        gestaoState.charts.inatividade.destroy();
    }

    gestaoState.charts.inatividade = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(inatividade),
            datasets: [{
                label: 'Número de Clientes',
                data: Object.values(inatividade),
                backgroundColor: [
                    '#4CAF50', '#8BC34A', '#FFC107', '#FF9800', '#FF5722', '#F44336'
                ],
                borderColor: [
                    '#388E3C', '#689F38', '#F57F17', '#F57C00', '#D84315', '#C62828'
                ],
                borderWidth: 1
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
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} clientes`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderPadraoComprasChart() {
    const ctx = document.getElementById('padrao-compras-chart');
    if (!ctx) return;

    // Classificar clientes por padrão de compras
    const padroes = {
        'Primeira Compra': 0,
        'Em Desenvolvimento': 0,
        'Cliente Fiel': 0,
        'Cliente VIP': 0
    };

    gestaoState.processedClients.forEach(client => {
        if (client.total_compras === 1) {
            padroes['Primeira Compra']++;
        } else if (client.total_compras <= 3) {
            padroes['Em Desenvolvimento']++;
        } else if (client.total_compras <= 10) {
            padroes['Cliente Fiel']++;
        } else {
            padroes['Cliente VIP']++;
        }
    });

    if (gestaoState.charts.padraoCompras) {
        gestaoState.charts.padraoCompras.destroy();
    }

    gestaoState.charts.padraoCompras = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(padroes),
            datasets: [{
                data: Object.values(padroes),
                backgroundColor: ['#FFC107', '#FF9800', '#4CAF50', '#2196F3'],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

function renderEvolucaoClientesChart() {
    const ctx = document.getElementById('evolucao-clientes-chart');
    if (!ctx) return;

    // Agrupar vendas por mês para ver evolução
    const monthlyData = {};
    
    gestaoState.salesData.forEach(sale => {
        const date = new Date(sale.hora_venda);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                novos: new Set(),
                recorrentes: new Set(),
                total: new Set()
            };
        }

        monthlyData[monthKey].total.add(sale.cliente_nome);
    });

    // Identificar clientes novos vs recorrentes
    const clientFirstPurchase = {};
    gestaoState.salesData.forEach(sale => {
        const cliente = sale.cliente_nome;
        const date = new Date(sale.hora_venda);
        
        if (!clientFirstPurchase[cliente] || date < clientFirstPurchase[cliente]) {
            clientFirstPurchase[cliente] = date;
        }
    });

    // Classificar por mês
    Object.keys(monthlyData).forEach(month => {
        const [year, monthNum] = month.split('-');
        const monthStart = new Date(year, monthNum - 1, 1);
        const monthEnd = new Date(year, monthNum, 0);

        monthlyData[month].total.forEach(cliente => {
            const firstPurchase = clientFirstPurchase[cliente];
            if (firstPurchase >= monthStart && firstPurchase <= monthEnd) {
                monthlyData[month].novos.add(cliente);
            } else {
                monthlyData[month].recorrentes.add(cliente);
            }
        });
    });

    // Preparar dados para o gráfico (últimos 6 meses)
    const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
    
    const novosData = sortedMonths.map(month => monthlyData[month].novos.size);
    const recorrentesData = sortedMonths.map(month => monthlyData[month].recorrentes.size);
    const labels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    });

    if (gestaoState.charts.evolucaoClientes) {
        gestaoState.charts.evolucaoClientes.destroy();
    }

    gestaoState.charts.evolucaoClientes = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Novos Clientes',
                    data: novosData,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    fill: true
                },
                {
                    label: 'Clientes Recorrentes',
                    data: recorrentesData,
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// ===== WHATSAPP E COMUNICAÇÃO =====
function sendClientWhatsAppAction(clientName, phone, tipoCliente) {
    if (!phone) {
        showNotification('Cliente não possui telefone cadastrado', 'warning');
        return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
        showNotification('Número de telefone inválido', 'error');
        return;
    }

    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
    const message = generateClientMessage(clientName, tipoCliente);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    showNotification(`Mensagem enviada para ${clientName}`, 'success');
}

function sendFrequencyWhatsApp(clientName, phone, productName, frequency) {
    if (!phone) {
        showNotification('Cliente não possui telefone cadastrado', 'warning');
        return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

    const message = `Olá ${clientName}! 

Como você está? Espero que esteja tudo bem!

Notei que já faz um tempo desde sua última compra do produto *${productName}*. 

Considerando que a frequência de uso é de *${frequency}*, imagino que você já deve estar precisando repor! 

Que tal dar uma passadinha aqui na loja para dar uma olhada? Temos sempre novidades e promoções especiais para nossos clientes fiéis como você!

Qualquer dúvida, estou aqui para ajudar! 

Abraços!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    showNotification(`Lembrete de recompra enviado para ${clientName}`, 'success');
}

function generateClientMessage(clientName, tipoCliente) {
    const messages = {
        'primeira_compra': `Olá ${clientName}! 

Que bom ter você como nosso cliente! Esperamos que tenha gostado da sua primeira experiência conosco.

Temos sempre novidades e promoções especiais. Que tal dar uma olhada no que temos de novo?

Estamos aqui para qualquer dúvida!

Abraços!`,
        
        'desenvolvimento': `Olá ${clientName}! 

É sempre um prazer atendê-lo! Notamos que você já fez algumas compras conosco e estamos muito felizes com isso.

Preparamos algumas sugestões especiais que podem interessar você. Que tal dar uma passadinha para conhecer?

Aguardamos sua visita!

Abraços!`,
        
        'fiel': `Olá ${clientName}! 

Você é um dos nossos clientes mais especiais! Sua fidelidade é muito importante para nós.

Temos algumas novidades exclusivas que separamos especialmente para clientes como você. 

Quando puder, venha nos visitar para conhecer as novidades!

Muito obrigado pela confiança!

Abraços!`,
        
        'novo': `Olá ${clientName}! 

Esperamos que esteja tudo bem! 

Temos novidades incríveis na loja que achamos que você vai gostar. Que tal dar uma passadinha para conhecer?

Estamos sempre aqui para atendê-lo da melhor forma!

Abraços!`
    };

    return messages[tipoCliente] || messages['novo'];
}

function exportTopClientesWhatsApp() {
    const rankingType = document.getElementById('ranking-type')?.value || 'valor';
    let sortedClients = [...gestaoState.processedClients];

    switch (rankingType) {
        case 'quantidade':
            sortedClients.sort((a, b) => b.total_compras - a.total_compras);
            break;
        case 'frequencia':
            sortedClients.sort((a, b) => {
                const freqA = a.dias_sem_comprar || 999;
                const freqB = b.dias_sem_comprar || 999;
                return freqA - freqB;
            });
            break;
        default:
            sortedClients.sort((a, b) => b.total_gasto - a.total_gasto);
    }

    const top20WithPhone = sortedClients
        .slice(0, 20)
        .filter(client => client.telefone);

    if (top20WithPhone.length === 0) {
        showNotification('Nenhum cliente do top 20 possui telefone cadastrado', 'warning');
        return;
    }

    const message = `Olá! 

Você está entre nossos clientes mais especiais! 

Preparamos ofertas exclusivas para nossos melhores clientes. Venha conferir nossas novidades e promoções!

Aguardamos sua visita!

Abraços!`;

    const encodedMessage = encodeURIComponent(message);

    top20WithPhone.forEach((client, index) => {
        setTimeout(() => {
            const cleanPhone = client.telefone.replace(/\D/g, '');
            const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
            const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
        }, index * 1000); // Delay de 1 segundo entre cada abertura
    });

    showNotification(`Enviando mensagens para ${top20WithPhone.length} clientes do top 20`, 'success');
}

// ===== EXPORTAR PARA WINDOW =====
window.renderCharts = renderCharts;
window.renderCidadesChart = renderCidadesChart;
window.renderInatividadeChart = renderInatividadeChart;
window.renderPadraoComprasChart = renderPadraoComprasChart;
window.renderEvolucaoClientesChart = renderEvolucaoClientesChart;
window.sendClientWhatsAppAction = sendClientWhatsAppAction;
window.sendFrequencyWhatsApp = sendFrequencyWhatsApp;
window.generateClientMessage = generateClientMessage;
window.exportTopClientesWhatsApp = exportTopClientesWhatsApp;

console.log('📊 Gestão de Clientes - Charts carregado');