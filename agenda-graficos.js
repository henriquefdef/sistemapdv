// servicos-grafico.js - Dashboard de Serviços
// ============================================

// Usar as constantes já declaradas globalmente
// const SUPABASE_URL e SUPABASE_ANON_KEY já estão disponíveis
// const supabaseClient já está disponível

class ServicesDashboard {
    constructor() {
        this.charts = {};
        this.currentData = {
            appointments: [],
            services: [],
            clients: [],
            professionals: []
        };
        this.filters = {
            period: 'semana',
            professional: 'todos',
            startDate: null,
            endDate: null
        };
        this.pagination = {
            currentPage: 1,
            itemsPerPage: 10,
            totalItems: 0
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupDateRange();
        
        // Aguardar dados do usuário
        if (window.currentUser && window.currentCompanyId) {
            await this.loadAllData();
        } else {
            document.addEventListener('userDataReady', async () => {
                await this.loadAllData();
            });
        }
        
        console.log('🚀 Dashboard de Serviços carregado!');
    }

    setupEventListeners() {
        // Filtros
        document.getElementById('period-filter').addEventListener('change', (e) => {
            this.filters.period = e.target.value;
            this.handlePeriodChange();
        });

        document.getElementById('professional-filter').addEventListener('change', (e) => {
            this.filters.professional = e.target.value;
            this.refreshDashboard();
        });

        // Datas personalizadas
        document.getElementById('start-date').addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
            if (this.filters.period === 'custom') {
                this.refreshDashboard();
            }
        });

        document.getElementById('end-date').addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
            if (this.filters.period === 'custom') {
                this.refreshDashboard();
            }
        });

        // Botões
        document.getElementById('refresh-dashboard').addEventListener('click', () => {
            this.refreshDashboard();
        });

        document.getElementById('export-data').addEventListener('click', () => {
            this.exportData();
        });

        // Timeline chart filter
        document.getElementById('timeline-filter').addEventListener('change', (e) => {
            this.updateTimelineChart(e.target.value);
        });

        // Busca na tabela
        document.getElementById('table-search').addEventListener('input', (e) => {
            this.filterTable(e.target.value);
        });

        document.getElementById('table-status-filter').addEventListener('change', (e) => {
            this.filterTableByStatus(e.target.value);
        });

        // Paginação
        document.getElementById('prev-page').addEventListener('click', () => {
            this.changePage(this.pagination.currentPage - 1);
        });

        document.getElementById('next-page').addEventListener('click', () => {
            this.changePage(this.pagination.currentPage + 1);
        });
    }

    setupDateRange() {
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
        
        document.getElementById('start-date').value = this.formatDate(startOfWeek);
        document.getElementById('end-date').value = this.formatDate(endOfWeek);
    }

    handlePeriodChange() {
        const customRange = document.getElementById('custom-date-range');
        
        if (this.filters.period === 'custom') {
            customRange.classList.remove('hidden');
        } else {
            customRange.classList.add('hidden');
            this.setDateRange();
            this.refreshDashboard();
        }
    }

    setDateRange() {
        const today = new Date();
        let startDate, endDate;

        switch (this.filters.period) {
            case 'hoje':
                startDate = new Date(today);
                endDate = new Date(today);
                break;
            case 'semana':
                startDate = new Date(today.setDate(today.getDate() - today.getDay()));
                endDate = new Date(today.setDate(today.getDate() - today.getDay() + 6));
                break;
            case 'mes':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'trimestre':
                const currentQuarter = Math.floor(today.getMonth() / 3);
                startDate = new Date(today.getFullYear(), currentQuarter * 3 - 3, 1);
                endDate = new Date(today.getFullYear(), currentQuarter * 3, 0);
                break;
            case 'ano':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                break;
        }

        this.filters.startDate = this.formatDate(startDate);
        this.filters.endDate = this.formatDate(endDate);
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    // ===== CARREGAMENTO DE DADOS =====
    
    async loadAllData() {
        this.showLoading(true);
        
        try {
            await Promise.all([
                this.loadAppointments(),
                this.loadServices(),
                this.loadClients(),
                this.loadProfessionals()
            ]);

            this.calculateMetrics();
            this.renderCharts();
            this.renderTable();
            this.renderTopClients();
            this.renderHeatmap();

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showNotification('Erro ao carregar dados do dashboard', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadAppointments() {
        try {
            if (!window.currentCompanyId) {
                console.warn('ID da empresa não encontrado');
                return;
            }

            // Verificar se as datas foram definidas corretamente
            if (!this.filters.startDate || !this.filters.endDate || 
                this.filters.startDate === 'null' || this.filters.endDate === 'null') {
                console.log('Datas inválidas, redefinindo período padrão');
                this.setDateRange(); // Usar a função que já existe
            }

            console.log('Carregando agendamentos entre:', this.filters.startDate, 'e', this.filters.endDate);

            // Primeiro buscar os agendamentos
            const { data: appointments, error: appointmentsError } = await supabaseClient
                .from('agendamentos')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .gte('data_agendamento', this.filters.startDate)
                .lte('data_agendamento', this.filters.endDate)
                .order('data_agendamento', { ascending: false })
                .order('hora_inicio', { ascending: false });

            if (appointmentsError) throw appointmentsError;

            console.log('Agendamentos encontrados:', appointments?.length || 0);

            // Buscar clientes relacionados - usando id_cliente que é STRING
            const clientIds = [...new Set(appointments.map(apt => apt.id_cliente).filter(id => id))];
            let clients = [];
            if (clientIds.length > 0) {
                // Como id_cliente é string, buscar pelos nomes diretamente
                const { data: clientsData, error: clientsError } = await supabaseClient
                    .from('clientes')
                    .select('id, nome, telefone, email')
                    .in('nome', clientIds); // id_cliente é na verdade o NOME do cliente
                
                if (!clientsError) {
                    clients = clientsData || [];
                } else {
                    console.warn('Erro ao buscar clientes:', clientsError);
                }
            }

            // Buscar serviços relacionados - usando id_servico que é STRING  
            const serviceIds = [...new Set(appointments.map(apt => apt.id_servico).filter(id => id))];
            let services = [];
            if (serviceIds.length > 0) {
                // Como id_servico é string, buscar pelos nomes diretamente
                const { data: servicesData, error: servicesError } = await supabaseClient
                    .from('servicos')
                    .select('id, nome, preco, duracao, categoria')
                    .in('nome', serviceIds); // id_servico é na verdade o NOME do serviço
                
                if (!servicesError) {
                    services = servicesData || [];
                } else {
                    console.warn('Erro ao buscar serviços:', servicesError);
                }
            }

            // Combinar os dados usando NOMES como chave (conforme CSV mostra)
            this.currentData.appointments = appointments.map(apt => {
                const client = clients.find(c => c.nome === apt.id_cliente);
                const service = services.find(s => s.nome === apt.id_servico);
                
                return {
                    ...apt,
                    clientes: client || { nome: apt.id_cliente || 'Cliente não encontrado' },
                    servicos: service || { nome: apt.id_servico || 'Serviço não encontrado', preco: apt.valor || 0 }
                };
            });

            console.log('Agendamentos carregados com dados relacionados:', this.currentData.appointments.length);

        } catch (error) {
            console.error('Erro ao carregar agendamentos:', error);
            this.currentData.appointments = [];
        }
    }

    async loadServices() {
        try {
            if (!window.currentCompanyId) return;

            const { data, error } = await supabaseClient
                .from('servicos')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .eq('ativo', true)
                .order('nome');

            if (error) throw error;

            this.currentData.services = data || [];

        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
            this.currentData.services = [];
        }
    }

    async loadClients() {
        try {
            if (!window.currentCompanyId) return;

            const { data, error } = await supabaseClient
                .from('clientes')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .order('nome');

            if (error) throw error;

            this.currentData.clients = data || [];

        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            this.currentData.clients = [];
        }
    }

    async loadProfessionals() {
        try {
            if (!window.currentCompanyId) return;

            const { data, error } = await supabaseClient
                .from('user')
                .select('auth_user_id, nome')
                .eq('id_empresa', window.currentCompanyId)
                .order('nome');

            if (error) throw error;

            this.currentData.professionals = data || [];
            this.populateProfessionalFilter();

        } catch (error) {
            console.error('Erro ao carregar profissionais:', error);
            this.currentData.professionals = [];
        }
    }

    populateProfessionalFilter() {
        const select = document.getElementById('professional-filter');
        select.innerHTML = '<option value="todos">Todos os Profissionais</option>';

        this.currentData.professionals.forEach(prof => {
            const option = document.createElement('option');
            option.value = prof.nome;
            option.textContent = prof.nome;
            select.appendChild(option);
        });
    }

    // ===== CÁLCULO DE MÉTRICAS =====
    
    calculateMetrics() {
        // Aplicar filtro e deduplicação por agendamento (group_id/id)
        const filteredAppointments = this.getUniqueFilteredAppointments();

        // Métricas atuais com base em agendamentos únicos
        const totalAppointments = filteredAppointments.length;
        const totalRevenue = filteredAppointments
            .filter(apt => apt.status === 'concluido')
            .reduce((sum, apt) => sum + parseFloat(apt.valor || 0), 0);
        
        const completedAppointments = filteredAppointments.filter(apt => apt.status === 'concluido').length;
        const cancelledAppointments = filteredAppointments.filter(apt => apt.status === 'cancelado').length;
        
        const completionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments * 100) : 0;
        const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments * 100) : 0;

        // Métricas do período anterior para comparação
        const previousMetrics = this.calculatePreviousPeriodMetrics();

        // Atualizar DOM
        this.updateMetricCard('total-appointments', totalAppointments, previousMetrics.appointments);
        this.updateMetricCard('total-revenue', `R$ ${totalRevenue.toFixed(2)}`, previousMetrics.revenue);
        this.updateMetricCard('completion-rate', `${completionRate.toFixed(1)}%`, previousMetrics.completion);
        this.updateMetricCard('cancellation-rate', `${cancellationRate.toFixed(1)}%`, previousMetrics.cancellation);
    }

    calculatePreviousPeriodMetrics() {
        // Implementação simplificada - calcula período anterior
        // Em uma implementação real, buscaria dados do período anterior
        return {
            appointments: Math.random() * 20 - 10, // Simular variação
            revenue: Math.random() * 2000 - 1000,
            completion: Math.random() * 10 - 5,
            cancellation: Math.random() * 5 - 2.5
        };
    }

    updateMetricCard(metricId, value, change) {
        document.getElementById(metricId).textContent = value;
        
        const changeElement = document.getElementById(metricId.replace('total-', '').replace('completion-', '').replace('cancellation-', '') + '-change');
        if (changeElement) {
            const changeValue = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
            changeElement.textContent = changeValue;
            
            changeElement.className = 'metric-change';
            if (change > 0) {
                changeElement.classList.add('positive');
            } else if (change < 0) {
                changeElement.classList.add('negative');
            } else {
                changeElement.classList.add('neutral');
            }
        }
    }

    // ===== RENDERIZAÇÃO DE GRÁFICOS =====
    
    renderCharts() {
        this.renderTimelineChart();
        this.renderServicesChart();
        this.renderProfessionalsChart();
        this.renderStatusChart();
    }

    renderTimelineChart(type = 'appointments') {
        const ctx = document.getElementById('timeline-chart').getContext('2d');
        
        if (this.charts.timeline) {
            this.charts.timeline.destroy();
        }

        const timelineData = this.generateTimelineData(type);

        this.charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timelineData.labels,
                datasets: [{
                    label: type === 'appointments' ? 'Agendamentos' : 'Receita (R$)',
                    data: timelineData.data,
                    borderColor: '#FF8A00',
                    backgroundColor: 'rgba(255, 138, 0, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    generateTimelineData(type) {
        const appointments = this.getUniqueFilteredAppointments();
        const labels = [];
        const data = [];

        // Agrupar por data
        const groupedData = {};
        appointments.forEach(apt => {
            const date = apt.data_agendamento;
            if (!groupedData[date]) {
                groupedData[date] = { appointments: 0, revenue: 0 };
            }
            groupedData[date].appointments++;
            if (apt.status === 'concluido') {
                groupedData[date].revenue += parseFloat(apt.valor || 0);
            }
        });

        // Ordenar por data e criar arrays
        Object.keys(groupedData)
            .sort()
            .forEach(date => {
                labels.push(this.formatDateBR(date));
                data.push(type === 'appointments' ? groupedData[date].appointments : groupedData[date].revenue);
            });

        return { labels, data };
    }

    renderServicesChart() {
        const ctx = document.getElementById('services-chart').getContext('2d');
        
        if (this.charts.services) {
            this.charts.services.destroy();
        }

        const servicesData = this.generateServicesData();

        this.charts.services = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: servicesData.labels,
                datasets: [{
                    data: servicesData.data,
                    backgroundColor: [
                        '#FF8A00',
                        '#FFB347',
                        '#FFA500',
                        '#FF7F00',
                        '#FF6347'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    generateServicesData() {
        const appointments = this.getUniqueFilteredAppointments();
        const serviceCount = {};

        appointments.forEach(apt => {
            const serviceName = apt.servicos?.nome || 'Serviço não encontrado';
            serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;
        });

        const labels = Object.keys(serviceCount);
        const data = Object.values(serviceCount);

        return { labels, data };
    }

    renderProfessionalsChart() {
        const ctx = document.getElementById('professionals-chart').getContext('2d');
        
        if (this.charts.professionals) {
            this.charts.professionals.destroy();
        }

        const professionalsData = this.generateProfessionalsData();

        this.charts.professionals = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: professionalsData.labels,
                datasets: [{
                    label: 'Agendamentos',
                    data: professionalsData.data,
                    backgroundColor: '#FF8A00'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    generateProfessionalsData() {
        const appointments = this.getUniqueFilteredAppointments();
        const professionalCount = {};

        appointments.forEach(apt => {
            const professionalName = apt.profissional || 'Não informado';
            professionalCount[professionalName] = (professionalCount[professionalName] || 0) + 1;
        });

        const labels = Object.keys(professionalCount);
        const data = Object.values(professionalCount);

        return { labels, data };
    }

    renderStatusChart() {
        const ctx = document.getElementById('status-chart').getContext('2d');
        
        if (this.charts.status) {
            this.charts.status.destroy();
        }

        const statusData = this.generateStatusData();

        this.charts.status = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: statusData.labels,
                datasets: [{
                    data: statusData.data,
                    backgroundColor: [
                        '#3b82f6', // agendado
                        '#10b981', // concluido
                        '#ef4444', // cancelado
                        '#f59e0b'  // em_andamento
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    generateStatusData() {
        const appointments = this.getUniqueFilteredAppointments();
        const statusCount = {};

        appointments.forEach(apt => {
            const status = this.getStatusLabel(apt.status);
            statusCount[status] = (statusCount[status] || 0) + 1;
        });

        const labels = Object.keys(statusCount);
        const data = Object.values(statusCount);

        return { labels, data };
    }

    // ===== HEATMAP E TOP CLIENTES =====
    
    renderHeatmap() {
        const heatmapContainer = document.getElementById('heatmap-chart');
        const heatmapData = this.generateHeatmapData();
        
        heatmapContainer.innerHTML = '';

        // Cabeçalho vazio
        const emptyHeader = document.createElement('div');
        heatmapContainer.appendChild(emptyHeader);

        // Dias da semana
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        days.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'heatmap-day';
            dayElement.textContent = day;
            heatmapContainer.appendChild(dayElement);
        });

        // Horários e células
        for (let hour = 7; hour <= 18; hour++) {
            // Rótulo da hora
            const hourElement = document.createElement('div');
            hourElement.className = 'heatmap-hour';
            hourElement.textContent = `${hour}:00`;
            heatmapContainer.appendChild(hourElement);

            // Células para cada dia da semana
            for (let day = 0; day < 7; day++) {
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';
                
                const intensity = heatmapData[day] && heatmapData[day][hour] || 0;
                const intensityLevel = Math.min(5, Math.floor(intensity / 2));
                
                cell.classList.add(`intensity-${intensityLevel}`);
                cell.textContent = intensity > 0 ? intensity : '';
                cell.title = `${days[day]} ${hour}:00 - ${intensity} agendamentos`;
                
                heatmapContainer.appendChild(cell);
            }
        }
    }

    generateHeatmapData() {
        const appointments = this.getUniqueFilteredAppointments();
        const heatmapData = {};

        appointments.forEach(apt => {
            if (!apt.hora_inicio) return;

            const date = new Date(apt.data_agendamento);
            const dayOfWeek = date.getDay();
            const hour = parseInt(apt.hora_inicio.split(':')[0]);

            if (!heatmapData[dayOfWeek]) {
                heatmapData[dayOfWeek] = {};
            }

            heatmapData[dayOfWeek][hour] = (heatmapData[dayOfWeek][hour] || 0) + 1;
        });

        return heatmapData;
    }

    renderTopClients() {
        const container = document.getElementById('top-clients');
        const topClients = this.generateTopClientsData();

        container.innerHTML = '';

        topClients.forEach((client, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';

            item.innerHTML = `
                <div class="ranking-position ${index < 3 ? 'top-3' : ''}">${index + 1}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${client.name}</div>
                    <div class="ranking-details">${client.appointments} agendamentos</div>
                </div>
                <div class="ranking-value">R$ ${client.revenue.toFixed(2)}</div>
            `;

            container.appendChild(item);
        });
    }

    generateTopClientsData() {
        const appointments = this.getUniqueFilteredAppointments();
        const clientData = {};

        appointments.forEach(apt => {
            const clientName = apt.clientes?.nome || 'Cliente não encontrado';
            if (!clientData[clientName]) {
                clientData[clientName] = { appointments: 0, revenue: 0 };
            }
            clientData[clientName].appointments++;
            if (apt.status === 'concluido') {
                clientData[clientName].revenue += parseFloat(apt.valor || 0);
            }
        });

        return Object.entries(clientData)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }

    // ===== TABELA =====
    
    renderTable() {
        const tbody = document.getElementById('appointments-tbody');
        const appointments = this.getFilteredAppointments();
        
        tbody.innerHTML = '';

        // Paginação
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
        const endIndex = startIndex + this.pagination.itemsPerPage;
        const paginatedAppointments = appointments.slice(startIndex, endIndex);

        paginatedAppointments.forEach(apt => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${this.formatDateBR(apt.data_agendamento)}</td>
                <td>${apt.hora_inicio ? apt.hora_inicio.substring(0, 5) : '-'}</td>
                <td>${apt.clientes?.nome || 'Cliente não encontrado'}</td>
                <td>${apt.servicos?.nome || 'Serviço não encontrado'}</td>
                <td>${apt.profissional || 'Não informado'}</td>
                <td>R$ ${parseFloat(apt.valor || 0).toFixed(2)}</td>
                <td><span class="status-badge status-${apt.status}">${this.getStatusLabel(apt.status)}</span></td>
                <td>
                    <button class="btn-pagination" onclick="dashboard.viewAppointment('${apt.id}')" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });

        this.updatePagination(appointments.length);
    }

    updatePagination(totalItems) {
        this.pagination.totalItems = totalItems;
        const totalPages = Math.ceil(totalItems / this.pagination.itemsPerPage);

        // Atualizar info
        const startItem = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage + 1;
        const endItem = Math.min(this.pagination.currentPage * this.pagination.itemsPerPage, totalItems);
        
        document.getElementById('pagination-info').textContent = 
            `Mostrando ${startItem} a ${endItem} de ${totalItems} resultados`;

        // Atualizar botões
        document.getElementById('prev-page').disabled = this.pagination.currentPage === 1;
        document.getElementById('next-page').disabled = this.pagination.currentPage === totalPages;

        // Atualizar números das páginas
        this.renderPageNumbers(totalPages);
    }

    renderPageNumbers(totalPages) {
        const container = document.getElementById('page-numbers');
        container.innerHTML = '';

        const maxVisible = 5;
        let startPage = Math.max(1, this.pagination.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('div');
            pageBtn.className = `page-number ${i === this.pagination.currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => this.changePage(i));
            container.appendChild(pageBtn);
        }
    }

    changePage(page) {
        const totalPages = Math.ceil(this.pagination.totalItems / this.pagination.itemsPerPage);
        
        if (page >= 1 && page <= totalPages) {
            this.pagination.currentPage = page;
            this.renderTable();
        }
    }

    // ===== FILTROS E BUSCA =====
    
    getFilteredAppointments() {
        let filtered = this.currentData.appointments;

        // Filtrar por profissional
        if (this.filters.professional !== 'todos') {
            filtered = filtered.filter(apt => apt.profissional === this.filters.professional);
        }

        return filtered;
    }

    // Retorna a lista de agendamentos já deduplicada por group_id/id
    getUniqueFilteredAppointments() {
        const filtered = this.getFilteredAppointments();
        return this.dedupeAppointments(filtered);
    }

    // Deduplica considerando um único agendamento para múltiplos horários
    dedupeAppointments(appointments) {
        const map = new Map();
        appointments.forEach(apt => {
            const key = apt.group_id || apt.id || `${apt.data_agendamento}|${apt.clientes?.nome || ''}|${apt.servicos?.nome || ''}`;
            if (!map.has(key)) {
                map.set(key, apt);
            }
        });
        return Array.from(map.values());
    }

    filterTable(searchTerm) {
        // Implementar busca na tabela
        this.searchTerm = searchTerm.toLowerCase();
        this.pagination.currentPage = 1;
        this.renderTable();
    }

    filterTableByStatus(status) {
        // Implementar filtro por status
        this.statusFilter = status;
        this.pagination.currentPage = 1;
        this.renderTable();
    }

    // ===== UTILITÁRIOS =====
    
    formatDateBR(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    getStatusLabel(status) {
        const labels = {
            'agendado': 'Agendado',
            'concluido': 'Concluído',
            'cancelado': 'Cancelado',
            'em_andamento': 'Em Andamento'
        };
        return labels[status] || status;
    }

    updateTimelineChart(type) {
        this.renderTimelineChart(type);
    }

    viewAppointment(id) {
        // Implementar visualização de agendamento
        console.log('Ver agendamento:', id);
    }

    async refreshDashboard() {
        this.setDateRange();
        await this.loadAllData();
    }

    exportData() {
        // Exportação de dados em CSV otimizado para Excel (pt-BR)
        const data = this.getFilteredAppointments();
        const csv = this.convertToCSV(data);
        this.downloadCSV(csv, 'relatorio-servicos.csv');
    }

    convertToCSV(data) {
        const delimiter = ';';
        const headers = ['Data', 'Horário', 'Cliente', 'Serviço', 'Profissional', 'Valor', 'Status'];

        const escape = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const rows = data.map(apt => {
            const valor = parseFloat(apt.valor || 0)
                .toFixed(2)
                .replace('.', ','); // decimal vírgula para Excel pt-BR

            const cols = [
                this.formatDateBR(apt.data_agendamento),
                apt.hora_inicio ? apt.hora_inicio.substring(0, 5) : '-',
                apt.clientes?.nome || 'Cliente não encontrado',
                apt.servicos?.nome || 'Serviço não encontrado',
                apt.profissional || 'Não informado',
                valor,
                this.getStatusLabel(apt.status)
            ];
            return cols.map(escape).join(delimiter);
        });

        const headerLine = headers.map(escape).join(delimiter);
        // dica para Excel reconhecer separador
        const sepHint = 'sep=;';
        return [sepHint, headerLine, ...rows].join('\n');
    }

    downloadCSV(csv, filename) {
        // Gerar arquivo em UTF-16LE com BOM (compatibilidade total com Excel/Windows)
        // Mantém acentuação correta e evita caracteres quebrados como "Ã".

        const stringToUTF16LE = (str) => {
            const buf = new Uint8Array(str.length * 2);
            for (let i = 0; i < str.length; i++) {
                const code = str.charCodeAt(i);
                buf[i * 2] = code & 0xFF;         // low byte
                buf[i * 2 + 1] = code >> 8;       // high byte
            }
            return buf;
        };

        const bom = new Uint8Array([0xFF, 0xFE]); // BOM UTF-16LE
        const utf16Content = stringToUTF16LE(csv);
        const blob = new Blob([bom, utf16Content], { type: 'text/csv;charset=utf-16le;' });

        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showNotification(message, type = 'info') {
        // Remover notificação existente
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'notification';
        
        const bgColor = {
            'success': '#10b981',
            'error': '#ef4444',
            'warning': '#f59e0b',
            'info': '#3b82f6'
        }[type];
        
        const icon = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        }[type];
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-weight: 500;
            z-index: 1001;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideIn 0.3s ease;
            max-width: 400px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        notification.innerHTML = `
            <span>${icon}</span>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
    }
}

// ===== INICIALIZAÇÃO =====
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
    dashboard = new ServicesDashboard();
    
    // Disponibilizar globalmente
    window.dashboard = dashboard;
    
    console.log('🚀 Dashboard de Serviços inicializado!');
});

// Disponibilizar classe globalmente
window.ServicesDashboard = ServicesDashboard;