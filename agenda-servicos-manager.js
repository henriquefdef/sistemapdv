// agenda-services-manager.js - Gerenciamento de Serviços
// ======================================================

class AgendaServicesManager {
    constructor(agendaModalsInstance) {
        this.agendaModals = agendaModalsInstance;
        this.services = [];
        this.currentService = null;
        this.elements = {};
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadServices();
    }

    initializeElements() {
        this.elements = {
            servicesList: document.getElementById('servicesList'),
            addServiceBtn: document.getElementById('addServiceBtn')
        };
    }

    setupEventListeners() {
        if (this.elements.addServiceBtn) {
            this.elements.addServiceBtn.addEventListener('click', () => {
                this.addNewService();
            });
        }
    }

    async loadServices() {
        try {
            this.setLoadingState(true);
            const services = await window.agendaSupabase.getServices();
            this.services = services || [];
            this.renderServices();
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
            this.showError('Erro ao carregar serviços');
        } finally {
            this.setLoadingState(false);
        }
    }

    renderServices() {
        if (!this.elements.servicesList) return;

        if (this.services.length === 0) {
            this.elements.servicesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>Nenhum serviço agendado</p>
                    <button class="btn btn-primary" onclick="window.servicesManager.addNewService()">
                        <i class="fas fa-plus"></i> Agendar Primeiro Serviço
                    </button>
                </div>
            `;
            return;
        }

        const servicesHtml = this.services.map(service => this.renderServiceCard(service)).join('');
        this.elements.servicesList.innerHTML = servicesHtml;
    }

    renderServiceCard(service) {
        const statusClass = this.getStatusClass(service.status);
        const statusText = this.getStatusText(service.status);
        
        return `
            <div class="service-card ${statusClass}" data-service-id="${service.id}">
                <div class="service-header">
                    <div class="service-info">
                        <h3>${service.client_name}</h3>
                        <p class="service-type">${service.service_type}</p>
                    </div>
                    <div class="service-status">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                </div>
                
                <div class="service-details">
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>${this.formatDate(service.service_date)}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${service.service_time}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-phone"></i>
                        <span>${service.client_phone}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>R$ ${parseFloat(service.price || 0).toFixed(2)}</span>
                    </div>
                </div>
                
                ${service.description ? `
                    <div class="service-description">
                        <p>${service.description}</p>
                    </div>
                ` : ''}
                
                <div class="service-actions">
                    <button class="btn-service-action btn-edit" onclick="window.servicesManager.editService(${service.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-service-action btn-delete" onclick="window.servicesManager.deleteService(${service.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-service-action btn-complete" onclick="window.servicesManager.completeService(${service.id})" title="Concluir">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </div>
        `;
    }

    getStatusClass(status) {
        const statusMap = {
            'pending': 'status-pending',
            'in_progress': 'status-progress',
            'completed': 'status-completed',
            'cancelled': 'status-cancelled'
        };
        return statusMap[status] || 'status-pending';
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pendente',
            'in_progress': 'Em Andamento',
            'completed': 'Concluído',
            'cancelled': 'Cancelado'
        };
        return statusMap[status] || 'Pendente';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    addNewService() {
        this.currentService = null;
        if (window.agendaModals) {
            window.agendaModals.openServiceModal();
        }
    }

    editService(serviceId) {
        const service = this.services.find(s => s.id === serviceId);
        if (service) {
            this.currentService = service;
            if (window.agendaModals) {
                window.agendaModals.openServiceModal(service);
            }
        }
    }

    async deleteService(serviceId) {
        if (!confirm('Tem certeza que deseja excluir este serviço?')) {
            return;
        }

        try {
            await window.agendaSupabase.deleteService(serviceId);
            this.services = this.services.filter(s => s.id !== serviceId);
            this.renderServices();
            this.showNotification('Serviço excluído com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao excluir serviço:', error);
            this.showError('Erro ao excluir serviço');
        }
    }

    async completeService(serviceId) {
        try {
            await window.agendaSupabase.updateServiceStatus(serviceId, 'completed');
            const service = this.services.find(s => s.id === serviceId);
            if (service) {
                service.status = 'completed';
            }
            this.renderServices();
            this.showNotification('Serviço marcado como concluído!', 'success');
        } catch (error) {
            console.error('Erro ao completar serviço:', error);
            this.showError('Erro ao completar serviço');
        }
    }

    async saveService(serviceData) {
        try {
            let savedService;
            
            if (this.currentService) {
                savedService = await window.agendaSupabase.updateService(this.currentService.id, serviceData);
                const index = this.services.findIndex(s => s.id === this.currentService.id);
                if (index !== -1) {
                    this.services[index] = savedService;
                }
            } else {
                savedService = await window.agendaSupabase.createService(serviceData);
                this.services.push(savedService);
            }
            
            this.renderServices();
            this.showNotification('Serviço salvo com sucesso!', 'success');
            return savedService;
        } catch (error) {
            console.error('Erro ao salvar serviço:', error);
            this.showError('Erro ao salvar serviço');
            throw error;
        }
    }

    setLoadingState(isLoading) {
        if (this.elements.servicesList) {
            if (isLoading) {
                this.elements.servicesList.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Carregando serviços...</p>
                    </div>
                `;
            }
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    clearError() {
        // Remove any error messages
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => el.remove());
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
        }
    }

    getCurrentService() {
        return this.currentService;
    }

    clearCurrentService() {
        this.currentService = null;
    }
}

// Initialize when DOM is ready
const initializeServicesManager = () => {
    if (window.agendaModals) {
        const servicesManager = new AgendaServicesManager(window.agendaModals);
        window.servicesManager = servicesManager;
    } else {
        setTimeout(initializeServicesManager, 100);
    }
};

// Try to initialize immediately, then with delay
setTimeout(initializeServicesManager, 700);

// Make class available globally for debugging
// window.AgendaServicesManager = AgendaServicesManager;