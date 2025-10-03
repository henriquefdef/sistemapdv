// Configurações do Supabase
const SUPABASE_URL = 'https://gnehkswoqlpchtlgyjyj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWhrc3dvcWxwY2h0bGd5anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTY3NjYsImV4cCI6MjA2OTQ3Mjc2Nn0.8giA1bDvCzgvlcW_pkimGO9qHRF2I0QfhG6nx9U_tdY';

let supabaseClient;

// Verificar se o Supabase carregou
window.addEventListener('load', () => {
    if (typeof supabase === 'undefined') {
        showMessage('❌ Erro de conexão. Recarregue a página ou verifique sua internet.', 'text-red-500');
    }
});

// Inicializar cliente Supabase
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
    console.error('Erro ao inicializar Supabase:', error);
    showMessage('❌ Erro de inicialização. Recarregue a página.', 'text-red-500');
}

// Elementos do DOM
const signupForm = document.getElementById('signup-form');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const messageDiv = document.getElementById('message');
const successOverlay = document.getElementById('success-overlay');
const popupTitle = document.getElementById('popup-title');
const popupMessage = document.getElementById('popup-message');
const closePopupButton = document.getElementById('close-popup');

// Elementos para os requisitos da senha
const lengthReq = document.getElementById('length-req');
const upperReq = document.getElementById('upper-req');
const lowerReq = document.getElementById('lower-req');
const numberReq = document.getElementById('number-req');

// Função para mostrar mensagens
function showMessage(message, className) {
    messageDiv.innerHTML = message;
    messageDiv.className = `text-center text-sm font-medium mt-3 ${className}`;
}

// Função para mostrar popup de sucesso
function showSuccessPopup(title, msg) {
    popupTitle.innerHTML = title;
    popupMessage.innerHTML = msg;
    successOverlay.classList.add('active');
}

// Função para gerar ID da empresa
function generateCompanyId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Função para salvar dados do usuário
async function saveUserData(authUserId, userData) {
    try {
        // 1. Verificar se já existe um usuário com este auth_user_id
        const { data: existingUser, error: checkError } = await supabaseClient
            .from('user')
            .select('id')
            .eq('auth_user_id', authUserId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 = "Row not found" - isso é esperado para novos usuários
            console.error('Erro ao verificar usuário existente:', checkError);
            throw checkError;
        }

        // 2. Se já existe, não inserir novamente
        if (existingUser) {
            console.log('Usuário já existe na tabela user, pulando inserção');
            return existingUser;
        }

        // 3. Se não existe, criar novo
        const companyId = generateCompanyId();
        
        const { data, error } = await supabaseClient
            .from('user')
            .insert([
                {
                    nome: userData.name,
                    telefone: userData.phone,
                    email: userData.email,
                    funcao: 'empreendedor',
                    id_empresa: companyId,
                    auth_user_id: authUserId, 
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Erro ao salvar dados do usuário:', error);
            throw error;
        }
        
        console.log('Novo usuário criado com sucesso:', data);
        return data;
        
    } catch (error) {
        console.error('Erro na função saveUserData:', error);
        throw error;
    }
}

// Validação em tempo real da senha
passwordInput.addEventListener('input', validatePassword);

function validatePassword() {
    const password = passwordInput.value;
    let allValid = true;

    // Regra 1: Mínimo de 8 caracteres
    if (password.length >= 8) {
        lengthReq.classList.replace('req-unmet', 'req-met');
    } else {
        lengthReq.classList.replace('req-met', 'req-unmet');
        allValid = false;
    }

    // Regra 2: Pelo menos 1 letra maiúscula
    if (/[A-Z]/.test(password)) {
        upperReq.classList.replace('req-unmet', 'req-met');
    } else {
        upperReq.classList.replace('req-met', 'req-unmet');
        allValid = false;
    }

    // Regra 3: Pelo menos 1 letra minúscula
    if (/[a-z]/.test(password)) {
        lowerReq.classList.replace('req-unmet', 'req-met');
    } else {
        lowerReq.classList.replace('req-met', 'req-unmet');
        allValid = false;
    }

    // Regra 4: Pelo menos 1 número
    if (/[0-9]/.test(password)) {
        numberReq.classList.replace('req-unmet', 'req-met');
    } else {
        numberReq.classList.replace('req-met', 'req-unmet');
        allValid = false;
    }
    
    return allValid;
}

// Formatação automática do telefone
phoneInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        e.target.value = value;
    }
});

// Event listener para o formulário de cadastro
signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Limpar mensagens anteriores
    showMessage('', '');
    
    // Validar campos obrigatórios
    if (!nameInput.value.trim()) {
        showMessage('❌ Por favor, preencha seu nome.', 'text-red-500');
        nameInput.focus();
        return;
    }
    
    if (!emailInput.value.trim()) {
        showMessage('❌ Por favor, preencha seu email.', 'text-red-500');
        emailInput.focus();
        return;
    }
    
    if (!phoneInput.value.trim()) {
        showMessage('❌ Por favor, preencha seu telefone.', 'text-red-500');
        phoneInput.focus();
        return;
    }
    
    // Validar senha
    if (!validatePassword()) {
        showMessage('❌ A senha não atende aos requisitos mínimos.', 'text-red-500');
        passwordInput.focus();
        return;
    }
    
    // Verificar se as senhas coincidem
    if (passwordInput.value !== confirmPasswordInput.value) {
        showMessage('❌ As senhas não coincidem.', 'text-red-500');
        confirmPasswordInput.focus();
        return;
    }
    
    // Validar email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.value)) {
        showMessage('❌ Por favor, insira um email válido.', 'text-red-500');
        emailInput.focus();
        return;
    }
    
    // Mostrar loading
    const submitButton = signupForm.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = 'Criando conta...';
    submitButton.disabled = true;
    
    try {
        // Verificar se o Supabase está disponível
        if (!supabaseClient) {
            throw new Error('Erro de conexão com o servidor. Recarregue a página.');
        }
        
        // Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: emailInput.value.trim(),
            password: passwordInput.value,
            options: {
                data: {
                    name: nameInput.value.trim(),
                    phone: phoneInput.value.trim()
                }
            }
        });
        
        if (authError) {
            console.error('Erro de autenticação:', authError);
            
            // Tratar erros específicos
            if (authError.message.includes('already registered')) {
                throw new Error('Este email já está cadastrado. Tente fazer login.');
            } else if (authError.message.includes('Invalid email')) {
                throw new Error('Email inválido. Verifique e tente novamente.');
            } else if (authError.message.includes('Password')) {
                throw new Error('Senha muito fraca. Tente uma senha mais forte.');
            } else {
                throw new Error(authError.message || 'Erro ao criar conta. Tente novamente.');
            }
        }
        
        if (!authData.user) {
            throw new Error('Erro inesperado. Tente novamente.');
        }
        
        // Salvar dados adicionais na tabela user
        await saveUserData(authData.user.id, {
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            email: emailInput.value.trim()
        });
        
        // Limpar formulário
        signupForm.reset();
        
        // Resetar validação visual da senha
        lengthReq.classList.replace('req-met', 'req-unmet');
        upperReq.classList.replace('req-met', 'req-unmet');
        lowerReq.classList.replace('req-met', 'req-unmet');
        numberReq.classList.replace('req-met', 'req-unmet');
        
        // Mostrar popup de sucesso
        showSuccessPopup(
            'Cadastro Realizado!', 
            'Um e-mail de confirmação foi enviado para <strong>' + emailInput.value + '</strong>. Por favor, verifique sua caixa de entrada e <strong>pasta de spam</strong> para ativar sua conta.'
        );
        
    } catch (error) {
        console.error('Erro no cadastro:', error);
        showMessage(`❌ ${error.message}`, 'text-red-500');
    } finally {
        // Restaurar botão
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});

// Fechar popup
closePopupButton.addEventListener('click', () => {
    successOverlay.classList.remove('active');
});

// Fechar popup ao clicar fora dele
successOverlay.addEventListener('click', function(e) {
    if (e.target === successOverlay) {
        successOverlay.classList.remove('active');
    }
});

// Fechar popup com ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && successOverlay.classList.contains('active')) {
        successOverlay.classList.remove('active');
    }
});

// Validação em tempo real para confirmação de senha
confirmPasswordInput.addEventListener('input', function() {
    if (confirmPasswordInput.value && passwordInput.value !== confirmPasswordInput.value) {
        confirmPasswordInput.style.borderColor = '#ef4444';
    } else {
        confirmPasswordInput.style.borderColor = '#e5e7eb';
    }
});

// Validação em tempo real para email
emailInput.addEventListener('blur', function() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailInput.value && !emailRegex.test(emailInput.value)) {
        emailInput.style.borderColor = '#ef4444';
        showMessage('❌ Email inválido.', 'text-red-500');
    } else {
        emailInput.style.borderColor = '#e5e7eb';
        if (messageDiv.innerHTML.includes('Email inválido')) {
            showMessage('', '');
        }
    }
});

// Limpar mensagem de erro quando usuário começar a digitar
[nameInput, emailInput, phoneInput, passwordInput, confirmPasswordInput].forEach(input => {
    input.addEventListener('input', function() {
        if (messageDiv.innerHTML.includes('❌')) {
            showMessage('', '');
        }
    });
});

console.log('✅ Sistema de cadastro carregado com sucesso!');