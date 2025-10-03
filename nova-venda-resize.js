// Sistema de Redimensionamento da Barra de Acesso Rápido
// ================================================================

class BarraResizeSystem {
    constructor() {
        this.isResizing = false;
        this.startY = 0;
        this.startHeight = 0;
        this.minHeight = 180; // Altura mínima em pixels
        this.maxHeight = 0; // Será calculado dinamicamente
        this.currentHeight = 370; // Altura inicial
        this.storageKey = 'lume-barra-height';
        
        this.init();
    }
    
    init() {
        this.createResizeHandle();
        this.calculateMaxHeight(); // Calcular limites ANTES de carregar altura salva
        this.loadSavedHeight();
        this.bindEvents();
        
        // Recalcular altura máxima quando a janela redimensionar
        window.addEventListener('resize', () => {
            this.calculateMaxHeight();
        });
    }
    
    createResizeHandle() {
        const barra = document.querySelector('.bottom-products-bar');
        if (!barra) return;
        
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.setAttribute('title', 'Arrastar para redimensionar');
        
        barra.appendChild(handle);
        this.handle = handle;
    }
    
    calculateMaxHeight() {
        const headerHeight = 60; // var(--header-height)
        const searchAreaHeight = 80; // ~2cm + margem
        const viewportHeight = window.innerHeight;
        
        this.maxHeight = viewportHeight - headerHeight - searchAreaHeight;
        
        // Garantir que a altura atual não exceda o máximo
        if (this.currentHeight > this.maxHeight) {
            this.currentHeight = this.maxHeight;
            this.applyHeight();
        }
    }
    
    loadSavedHeight() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const height = parseInt(saved);
                console.log('📖 Altura encontrada no localStorage:', height + 'px');
                if (height >= this.minHeight && height <= this.maxHeight) {
                    this.currentHeight = height;
                    this.applyHeight();
                    console.log('✅ Altura restaurada:', height + 'px');
                } else {
                    console.log('⚠️ Altura fora dos limites, usando padrão');
                }
            } else {
                console.log('ℹ️ Nenhuma altura salva encontrada, usando padrão');
            }
        } catch (error) {
            console.warn('Erro ao carregar altura salva:', error);
        }
    }
    
    saveHeight() {
        try {
            localStorage.setItem(this.storageKey, this.currentHeight.toString());
            console.log('💾 Altura salva no localStorage:', this.currentHeight + 'px');
        } catch (error) {
            console.warn('Erro ao salvar altura:', error);
        }
    }
    
    applyHeight() {
        const barra = document.querySelector('.bottom-products-bar');
        if (!barra) return;
        
        // Atualizar CSS custom property
        document.documentElement.style.setProperty('--bottom-bar-height', `${this.currentHeight}px`);
        
        // Aplicar altura diretamente também
        barra.style.height = `${this.currentHeight}px`;
        
        // Verificar limites para feedback visual
        this.updateHandleFeedback();
    }
    
    updateHandleFeedback() {
        if (!this.handle) return;
        
        this.handle.classList.remove('at-min', 'at-max');
        
        if (this.currentHeight <= this.minHeight) {
            this.handle.classList.add('at-min');
        } else if (this.currentHeight >= this.maxHeight) {
            this.handle.classList.add('at-max');
        }
    }
    
    bindEvents() {
        if (!this.handle) return;
        
        // Mouse events
        this.handle.addEventListener('mousedown', (e) => {
            this.startResize(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isResizing) {
                this.doResize(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.stopResize();
        });
        
        // Touch events para dispositivos móveis
        this.handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startResize(touch);
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (this.isResizing) {
                e.preventDefault();
                const touch = e.touches[0];
                this.doResize(touch);
            }
        }, { passive: false });
        
        document.addEventListener('touchend', () => {
            this.stopResize();
        });
    }
    
    startResize(event) {
        this.isResizing = true;
        this.startY = event.clientY;
        this.startHeight = this.currentHeight;
        
        // Adicionar classe para feedback visual
        const mainContent = document.querySelector('.main-content-area');
        if (mainContent) {
            mainContent.classList.add('resizing');
        }
        
        // Prevenir seleção de texto
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'row-resize';
    }
    
    doResize(event) {
        if (!this.isResizing) return;
        
        const deltaY = this.startY - event.clientY; // Invertido: arrastar para cima aumenta
        const newHeight = this.startHeight + deltaY;
        
        // Aplicar limites
        this.currentHeight = Math.max(this.minHeight, Math.min(this.maxHeight, newHeight));
        
        this.applyHeight();
    }
    
    stopResize() {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        
        // Remover classe de feedback visual
        const mainContent = document.querySelector('.main-content-area');
        if (mainContent) {
            mainContent.classList.remove('resizing');
        }
        
        // Restaurar cursor e seleção
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // Salvar altura
        this.saveHeight();
        
        // Mostrar feedback ao usuário
        this.showResizeFeedback();
    }
    
    showResizeFeedback() {
        const percentage = Math.round(((this.currentHeight - this.minHeight) / (this.maxHeight - this.minHeight)) * 100);
        
        let message = `Barra redimensionada: ${this.currentHeight}px`;
        
        if (this.currentHeight <= this.minHeight) {
            message += ' (altura mínima)';
        } else if (this.currentHeight >= this.maxHeight) {
            message += ' (altura máxima)';
        } else {
            message += ` (${percentage}%)`;
        }
        
        // Mostrar notificação se a função existir
        if (typeof showNotification === 'function') {
            showNotification(message, 'info');
        } else {
            console.log(message);
        }
    }
    
    // Métodos públicos para controle programático
    resetToDefault() {
        this.currentHeight = 370;
        this.applyHeight();
        this.saveHeight();
        
        if (typeof showNotification === 'function') {
            showNotification('Altura da barra restaurada ao padrão', 'success');
        }
    }
    
    setHeight(height) {
        const newHeight = Math.max(this.minHeight, Math.min(this.maxHeight, height));
        this.currentHeight = newHeight;
        this.applyHeight();
        this.saveHeight();
        return newHeight;
    }
    
    getHeight() {
        return this.currentHeight;
    }
    
    destroy() {
        if (this.handle) {
            this.handle.remove();
        }
        
        document.removeEventListener('mousemove', this.doResize);
        document.removeEventListener('mouseup', this.stopResize);
        document.removeEventListener('touchmove', this.doResize);
        document.removeEventListener('touchend', this.stopResize);
    }
}

// Inicializar sistema quando DOM estiver pronto
let barraResizeSystem;

function initBarraResize() {
    if (document.querySelector('.bottom-products-bar')) {
        barraResizeSystem = new BarraResizeSystem();
        console.log('✅ Sistema de redimensionamento da barra inicializado');
        console.log('📏 Altura atual:', barraResizeSystem.currentHeight + 'px');
        console.log('💾 Chave localStorage:', barraResizeSystem.storageKey);
        
        // Expor para uso global
        window.barraResize = barraResizeSystem;
    }
}

// Inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBarraResize);
} else {
    // Aguardar um pouco para garantir que outros elementos foram criados
    setTimeout(initBarraResize, 500);
}

// Re-inicializar se necessário (para compatibilidade)
document.addEventListener('userDataReady', () => {
    setTimeout(() => {
        if (!barraResizeSystem) {
            initBarraResize();
        }
    }, 1000);
});

// Exportar para uso global
window.initBarraResize = initBarraResize;