// inicio.js - JavaScript simplificado para a tela de início

// Inicialização
document.addEventListener('DOMContentLoaded', initializeApp);
document.addEventListener('userDataReady', loadUserAndDashboard);

function initializeApp() {
    updateTimeAndGreeting();
    setInterval(updateTimeAndGreeting, 60000); // Atualiza a cada minuto
    
    // Animações de entrada
    animateHeroElements();
    observeElements();
}

function loadUserAndDashboard() {
    const user = window.currentUser;
    const companyId = window.currentCompanyId;
    
    if (user) {
        updateUserName(user);
    }
    
    if (companyId) {
        loadDashboardData();
    }
}

// Atualiza nome do usuário
function updateUserName(userData) {
    const userNameEl = document.getElementById('user-name-hero');
    if (userNameEl && userData.nome) {
        const firstName = userData.nome.split(' ')[0];
        userNameEl.textContent = firstName;
        userNameEl.style.opacity = '0';
        
        // Animação de aparição do nome
        setTimeout(() => {
            userNameEl.style.transition = 'all 0.6s ease';
            userNameEl.style.opacity = '1';
            userNameEl.style.transform = 'translateY(0)';
        }, 800);
    }
}

// Atualiza horário e saudação
function updateTimeAndGreeting() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const hour = now.getHours();
    let greeting;
    
    if (hour < 12) {
        greeting = 'Bom dia';
    } else if (hour < 18) {
        greeting = 'Boa tarde';
    } else {
        greeting = 'Boa noite';
    }
    
    const timeEl = document.getElementById('current-time');
    const greetingEl = document.getElementById('greeting-text');
    
    if (timeEl) timeEl.textContent = timeStr;
    if (greetingEl) greetingEl.textContent = greeting;
}

// Animações do hero
function animateHeroElements() {
    const heroContent = document.querySelector('.hero-content');
    const heroVisual = document.querySelector('.hero-visual');
    
    if (heroContent) {
        heroContent.style.opacity = '0';
        heroContent.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            heroContent.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'translateY(0)';
        }, 200);
    }
    
    if (heroVisual) {
        heroVisual.style.opacity = '0';
        heroVisual.style.transform = 'translateX(50px)';
        
        setTimeout(() => {
            heroVisual.style.transition = 'all 1s cubic-bezier(0.4, 0, 0.2, 1)';
            heroVisual.style.opacity = '1';
            heroVisual.style.transform = 'translateX(0)';
        }, 400);
    }
}

// Observer para animações
function observeElements() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });
    
    // Anima cards quando aparecem
    document.querySelectorAll('.stat-item').forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `all 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.1}s`;
        observer.observe(el);
    });
}

// Carrega dados do dashboard
async function loadDashboardData() {
    const companyId = window.currentCompanyId;
    if (!companyId) return;
    
    try {
        const supabaseClient = window.supabaseClient || 
            supabase.createClient(
                'https://gnehkswoqlpchtlgyjyj.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWhrc3dvcWxwY2h0bGd5anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTY3NjYsImV4cCI6MjA2OTQ3Mjc2Nn0.8giA1bDvCzgvlcW_pkimGO9qHRF2I0QfhG6nx9U_tdY'
            );

        // Busca dados em paralelo
        const [salesData, stockData, clientsData] = await Promise.all([
            fetchTodaySales(supabaseClient, companyId),
            fetchStockData(supabaseClient, companyId),
            fetchClientsData(supabaseClient, companyId)
        ]);

        // Atualiza interface
        updateStats(salesData, stockData, clientsData);

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showErrorState();
    }
}

// Busca vendas de hoje - VERSÃO SIMPLIFICADA
async function fetchTodaySales(supabaseClient, companyId) {
    console.log('Buscando vendas para empresa:', companyId);

    // Buscar TODAS as vendas primeiro para debug
    const { data, error } = await supabaseClient
        .from('vendas')
        .select('id_venda, total_venda, hora_venda, status')
        .eq('id_empresa', companyId)
        .eq('status', 'ATIVO')
        .order('hora_venda', { ascending: false });

    if (error) {
        console.error('Erro ao buscar vendas:', error);
        throw error;
    }

    console.log('TODAS as vendas encontradas:', data?.length || 0);
    console.log('Primeiras 5 vendas:', data?.slice(0, 5));

    // Filtrar manualmente por data de hoje (data atual)
    const hoje = new Date().toLocaleDateString('pt-BR');
    console.log('Buscando vendas para a data de hoje:', hoje);
    const vendasHoje = data?.filter(venda => {
        if (!venda.hora_venda) return false;
        
        // Extrair data da hora_venda (independente do formato)
        const dataVenda = new Date(venda.hora_venda);
        const dataVendaStr = dataVenda.toLocaleDateString('pt-BR');
        
        console.log(`Venda ${venda.id_venda}: ${dataVendaStr} (${venda.hora_venda})`);
        return dataVendaStr === hoje;
    }) || [];

    console.log('Vendas de hoje filtradas:', vendasHoje.length);
    
    // Agrupar por id_venda único
    const vendasUnicas = new Set();
    let totalValue = 0;
    
    vendasHoje.forEach(venda => {
        if (!vendasUnicas.has(venda.id_venda)) {
            vendasUnicas.add(venda.id_venda);
            totalValue += parseFloat(venda.total_venda) || 0;
            console.log(`Venda única ${venda.id_venda}: R$ ${venda.total_venda}`);
        }
    });
    
    const count = vendasUnicas.size;
    
    console.log('RESULTADO FINAL:');
    console.log('- Quantidade de vendas:', count);
    console.log('- Valor total:', totalValue.toFixed(2));

    return { totalValue, count };
}

// Busca dados de estoque
async function fetchStockData(supabaseClient, companyId) {
    const { data, error } = await supabaseClient
        .from('produtos')
        .select('quantidade_estoque')
        .eq('id_empresa', companyId);

    if (error) throw error;

    const totalStock = data.reduce((sum, product) => sum + (product.quantidade_estoque || 0), 0);
    return { totalStock };
}

// Busca dados de clientes
async function fetchClientsData(supabaseClient, companyId) {
    const { error, count } = await supabaseClient
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('id_empresa', companyId);

    if (error) throw error;
    return { totalClients: count || 0 };
}

// Atualiza estatísticas
function updateStats(salesData, stockData, clientsData) {
    // Vendas de hoje
    const todaySalesEl = document.getElementById('today-sales');
    if (todaySalesEl) {
        animateValue(todaySalesEl, 0, salesData.totalValue, (value) => 
            value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        );
    }

    // Número de vendas
    const todayOrdersEl = document.getElementById('today-orders');
    if (todayOrdersEl) {
        animateValue(todayOrdersEl, 0, salesData.count, (value) => 
            Math.floor(value).toString()
        );
    }

    // Estoque total
    const totalStockEl = document.getElementById('total-stock');
    if (totalStockEl) {
        animateValue(totalStockEl, 0, stockData.totalStock, (value) => 
            Math.floor(value).toLocaleString('pt-BR')
        );
    }

    // Total de clientes
    const totalClientsEl = document.getElementById('total-clients');
    if (totalClientsEl) {
        animateValue(totalClientsEl, 0, clientsData.totalClients, (value) => 
            Math.floor(value).toLocaleString('pt-BR')
        );
    }
}

// Animação de valores numéricos
function animateValue(element, start, end, formatter) {
    const duration = 2000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out cubic)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = start + (end - start) * easeOut;
        
        element.textContent = formatter(currentValue);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = formatter(end);
        }
    }
    
    requestAnimationFrame(update);
}

// Estado de erro
function showErrorState() {
    const statsElements = [
        'today-sales',
        'today-orders', 
        'total-stock',
        'total-clients'
    ];
    
    statsElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '--';
            el.style.color = '#ef4444';
        }
    });
}

// Efeitos visuais avançados
document.addEventListener('DOMContentLoaded', () => {
    // Parallax suave nos elementos flutuantes
    const floatingElements = document.querySelectorAll('.element');
    
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        floatingElements.forEach((element, index) => {
            const speed = (index + 1) * 0.5;
            const x = (mouseX - 0.5) * speed * 20;
            const y = (mouseY - 0.5) * speed * 20;
            
            element.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
    
    // Scroll suave para seções
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        heroSection.addEventListener('wheel', (e) => {
            if (e.deltaY > 0) {
                // Scroll para baixo
                const quickStats = document.querySelector('.quick-stats');
                if (quickStats) {
                    quickStats.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    }
});

// Performance optimization
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Lazy loading para imagens
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Inicializa otimizações
document.addEventListener('DOMContentLoaded', () => {
    lazyLoadImages();
    
    // Preload de páginas importantes
    const importantLinks = [
        'nova-venda.html',
        'lista-produtos.html',
        'clientes.html'
    ];
    
    importantLinks.forEach(link => {
        const linkEl = document.createElement('link');
        linkEl.rel = 'prefetch';
        linkEl.href = link;
        document.head.appendChild(linkEl);
    });
});

// Error handling global
window.addEventListener('error', (e) => {
    console.error('Erro global capturado:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise rejeitada:', e.reason);
    e.preventDefault();
});