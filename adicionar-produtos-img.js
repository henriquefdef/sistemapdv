// ===== ADICIONAR PRODUTOS - GERENCIAMENTO DE IMAGENS =====

// Variáveis globais para controle das imagens
window.productImages = [];
let dragCounter = 0;

// Configurações
const CONFIG = {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1, // Apenas 1 imagem permitida
    acceptedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    supabaseStorageBucket: 'product-images'
};

// ===== INICIALIZAÇÃO =====
function initializeImageUpload() {
    const uploadArea = document.getElementById('image-upload-area');
    const fileInput = document.getElementById('image-input');
    const previewContainer = document.getElementById('image-preview-container');

    if (!uploadArea || !fileInput || !previewContainer) {
        console.warn('Elementos de upload de imagem não encontrados');
        return;
    }

    setupDragAndDrop(uploadArea, fileInput);
    setupFileInput(fileInput);
    setupClickToUpload(uploadArea, fileInput);

    console.log('Sistema de upload de imagens inicializado');
}

// ===== DRAG AND DROP =====
function setupDragAndDrop(uploadArea, fileInput) {
    // Previne comportamento padrão do browser
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Destaque visual quando arrastar sobre a área
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            dragCounter++;
            uploadArea.classList.add('drag-over');
        }, false);
    });

    ['dragleave'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            dragCounter--;
            if (dragCounter === 0) {
                uploadArea.classList.remove('drag-over');
            }
        }, false);
    });

    // Handle do drop
    uploadArea.addEventListener('drop', (e) => {
        dragCounter = 0;
        uploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        handleFiles(files);
    }, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// ===== CLICK PARA UPLOAD =====
function setupClickToUpload(uploadArea, fileInput) {
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
}

// ===== INPUT DE ARQUIVO =====
function setupFileInput(fileInput) {
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        // Limpa o input para permitir selecionar o mesmo arquivo novamente
        e.target.value = '';
    });
}

// ===== PROCESSAMENTO DOS ARQUIVOS =====
async function handleFiles(files) {
    const fileArray = Array.from(files);
    
    // Se já tem imagem, remove a anterior
    if (window.productImages.length > 0) {
        showImageError('Apenas 1 imagem é permitida. A imagem anterior será substituída.');
        window.productImages = []; // Limpa array
    }
    
    // Pega apenas o primeiro arquivo
    const file = fileArray[0];
    if (!file) return;
    
    if (validateFile(file)) {
        await processFile(file);
        updateImagePreviews();
    }
}

// ===== VALIDAÇÃO DE ARQUIVO =====
function validateFile(file) {
    // Verificar tipo
    if (!CONFIG.acceptedTypes.includes(file.type)) {
        showImageError(`Tipo de arquivo não suportado: ${file.name}`);
        return false;
    }

    // Verificar tamanho
    if (file.size > CONFIG.maxFileSize) {
        showImageError(`Arquivo muito grande: ${file.name} (máx. 5MB)`);
        return false;
    }

    // Verificar se já existe
    const existingImage = window.productImages.find(img => 
        img.name === file.name && img.size === file.size
    );
    
    if (existingImage) {
        showImageError(`Imagem já adicionada: ${file.name}`);
        return false;
    }

    return true;
}

// ===== PROCESSAMENTO DO ARQUIVO =====
async function processFile(file) {
    try {
        // Gerar thumbnail para preview
        const thumbnail = await generateThumbnail(file);
        
        // Comprimir imagem para upload
        const compressedBlob = await compressImageForUpload(file);
        
        // Criar objeto da imagem
        const imageObj = {
            id: generateImageId(),
            file: file, // Arquivo original para referência
            compressedFile: compressedBlob, // Arquivo comprimido para upload
            name: file.name,
            size: file.size,
            compressedSize: compressedBlob.size,
            type: file.type,
            thumbnail: thumbnail,
            uploaded: false,
            url: null,
            supabaseUrl: null
        };

        // Adicionar à lista global
        window.productImages.push(imageObj);
        
        console.log(`Imagem processada: ${file.name} (${(compressedBlob.size/1024).toFixed(1)}KB)`);
        
    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        showImageError(`Erro ao processar ${file.name}`);
    }
}

// ===== GERAÇÃO DE THUMBNAIL E COMPRESSÃO =====
function generateThumbnail(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Dimensões do thumbnail para preview
                const maxSize = 300;
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Desenhar imagem redimensionada
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converter para base64
                const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
                resolve(thumbnail);
            };
            
            img.onerror = () => reject(new Error('Erro ao carregar imagem'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsDataURL(file);
    });
}

// ===== COMPRESSÃO DA IMAGEM PARA UPLOAD =====
function compressImageForUpload(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Tamanho maior para melhor qualidade - 400px (mantém detalhes)
                const maxSize = 400;
                let { width, height } = img;
                
                // Redimensionar mantendo proporção
                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Melhor qualidade de redimensionamento
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Desenhar imagem redimensionada
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converter para blob com qualidade melhor
                canvas.toBlob((blob) => {
                    if (blob) {
                        console.log(`Imagem comprimida: ${file.name} - ${(file.size/1024).toFixed(1)}KB → ${(blob.size/1024).toFixed(1)}KB`);
                        resolve(blob);
                    } else {
                        reject(new Error('Erro ao comprimir imagem'));
                    }
                }, 'image/jpeg', 0.7); // Qualidade 70% - boa qualidade e tamanho razoável
            };
            
            img.onerror = () => reject(new Error('Erro ao carregar imagem'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsDataURL(file);
    });
}

// ===== ATUALIZAÇÃO DA INTERFACE =====
function updateImagePreviews() {
    const container = document.getElementById('image-preview-container');
    
    if (window.productImages.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = window.productImages.map((image, index) => `
        <div class="image-preview" data-image-id="${image.id}">
            <img src="${image.thumbnail}" alt="${image.name}" loading="lazy">
            <button class="image-remove" onclick="removeImage('${image.id}')" title="Remover imagem">
                <i class="fas fa-times"></i>
            </button>
            <div class="image-info">
                <div class="image-name">${truncateName(image.name, 20)}</div>
                <div class="image-size">
                    ${image.compressedSize ? formatFileSize(image.compressedSize) : formatFileSize(image.size)}
                    ${image.compressedSize && image.compressedSize !== image.size ? 
                        `<small style="color: #10b981;">(comprimida)</small>` : ''
                    }
                </div>
                ${image.uploaded ? 
                    '<div class="upload-status success"><i class="fas fa-check"></i> Enviada</div>' :
                    '<div class="upload-status pending"><i class="fas fa-clock"></i> Pendente</div>'
                }
            </div>
        </div>
    `).join('');

    // Adicionar CSS dinâmico se não existir
    addImagePreviewStyles();
}

// ===== REMOÇÃO DE IMAGEM =====
window.removeImage = function(imageId) {
    const imageIndex = window.productImages.findIndex(img => img.id === imageId);
    
    if (imageIndex === -1) {
        console.error('Imagem não encontrada:', imageId);
        return;
    }

    const image = window.productImages[imageIndex];
    
    // Se a imagem já foi enviada para o Supabase, marca para exclusão
    if (image.uploaded && image.supabaseUrl) {
        image.markedForDeletion = true;
    } else {
        // Remove da lista se ainda não foi enviada
        window.productImages.splice(imageIndex, 1);
    }

    updateImagePreviews();
    console.log(`Imagem removida: ${image.name}`);
}

// ===== UPLOAD PARA SUPABASE =====
async function saveProductImages(productId, images) {
    console.log(`Iniciando upload de ${images.length} imagens para produto ${productId}`);
    
    const uploadPromises = images
        .filter(img => !img.uploaded && !img.markedForDeletion)
        .map(img => uploadImageToSupabase(productId, img));

    const results = await Promise.allSettled(uploadPromises);
    
    // Processar resultados
    let successCount = 0;
    let errorCount = 0;
    
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            successCount++;
        } else {
            errorCount++;
            console.error('Erro no upload:', result.reason);
        }
    });

    // Deletar imagens marcadas para exclusão
    const deletePromises = images
        .filter(img => img.markedForDeletion && img.supabaseUrl)
        .map(img => deleteImageFromSupabase(img.supabaseUrl));

    await Promise.allSettled(deletePromises);

    console.log(`Upload concluído: ${successCount} sucessos, ${errorCount} erros`);
    
    return {
        success: errorCount === 0,
        uploaded: successCount,
        errors: errorCount
    };
}

async function uploadImageToSupabase(productId, imageObj) {
    try {
        // Buscar dados do produto para pegar o SKU
        const { data: productData, error: productError } = await supabaseClient
            .from('produtos')
            .select('codigo_sku')
            .eq('id', productId)
            .single();

        if (productError) throw productError;

        if (!productData.codigo_sku) {
            throw new Error('Produto deve ter um código SKU para fazer upload de imagens');
        }

        // Gerar nome do arquivo usando a estrutura: empresa/SKU.extensao
        const fileExt = imageObj.name.split('.').pop();
        const empresaId = window.currentCompanyId;
        const sku = productData.codigo_sku;
        
        // Nome do arquivo: empresa/SKU.extensao (sem numeração, pois é apenas 1)
        const fileName = `${empresaId}/${sku}.${fileExt}`;
        
        // Upload para o storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from(CONFIG.supabaseStorageBucket)
            .upload(fileName, imageObj.compressedFile, { // Usa arquivo comprimido
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // Obter URL pública
        const { data: urlData } = supabaseClient.storage
            .from(CONFIG.supabaseStorageBucket)
            .getPublicUrl(fileName);

        // Salvar referência no banco
        const { data: dbData, error: dbError } = await supabaseClient
            .from('produto_imagens')
            .insert({
                produto_id: productId,
                url: urlData.publicUrl,
                nome_arquivo: imageObj.name,
                tamanho: imageObj.compressedSize, // Salva tamanho comprimido
                tipo: 'image/jpeg', // Sempre JPEG após compressão
                sku: productData.codigo_sku,
                id_empresa: window.currentCompanyId,
                auth_user_id: window.currentUser?.auth_user_id || window.currentUser?.id
            })
            .select();

        if (dbError) throw dbError;

        // Atualizar objeto da imagem
        imageObj.uploaded = true;
        imageObj.supabaseUrl = urlData.publicUrl;
        imageObj.dbId = dbData[0].id;

        console.log(`Imagem enviada com sucesso: ${fileName}`);
        return { success: true, image: imageObj };

    } catch (error) {
        console.error(`Erro ao enviar imagem ${imageObj.name}:`, error);
        throw error;
    }
}

async function deleteImageFromSupabase(imageUrl) {
    try {
        // Extrair caminho do arquivo da URL
        const urlParts = imageUrl.split('/');
        const fileName = urlParts.slice(-2).join('/'); // empresa_id/sku_numero.ext

        // Deletar do storage
        const { error: storageError } = await supabaseClient.storage
            .from(CONFIG.supabaseStorageBucket)
            .remove([fileName]);

        if (storageError) throw storageError;

        // Deletar do banco
        const { error: dbError } = await supabaseClient
            .from('produto_imagens')
            .delete()
            .eq('url', imageUrl);

        if (dbError) throw dbError;

        console.log(`Imagem deletada: ${fileName}`);

    } catch (error) {
        console.error('Erro ao deletar imagem:', error);
        throw error;
    }
}

// ===== CARREGAMENTO DE IMAGENS EXISTENTES =====
async function loadProductImages(productId) {
    try {
        const { data, error } = await supabaseClient
            .from('produto_imagens')
            .select('*')
            .eq('produto_id', productId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Converter para formato interno
        window.productImages = data.map(dbImage => ({
            id: dbImage.id,
            name: dbImage.nome_arquivo,
            size: dbImage.tamanho,
            type: dbImage.tipo,
            thumbnail: dbImage.url, // Usar URL completa como thumbnail
            uploaded: true,
            url: dbImage.url,
            supabaseUrl: dbImage.url,
            dbId: dbImage.id
        }));

        updateImagePreviews();
        console.log(`Carregadas ${data.length} imagens do produto ${productId}`);

    } catch (error) {
        console.error('Erro ao carregar imagens:', error);
    }
}

// ===== LIMPEZA =====
window.clearImages = function() {
    window.productImages = [];
    updateImagePreviews();
    console.log('Lista de imagens limpa');
}

// ===== FUNÇÕES AUXILIARES =====
function generateImageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function truncateName(name, maxLength) {
    if (name.length <= maxLength) return name;
    
    const ext = name.split('.').pop();
    const nameWithoutExt = name.slice(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.slice(0, maxLength - ext.length - 4) + '...';
    
    return `${truncated}.${ext}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showImageError(message) {
    // Usar a função de notificação do arquivo principal se existir
    if (typeof showErrorMessage === 'function') {
        showErrorMessage(message);
    } else {
        alert(message);
    }
}

function addImagePreviewStyles() {
    if (document.getElementById('image-preview-styles')) return;

    const style = document.createElement('style');
    style.id = 'image-preview-styles';
    style.textContent = `
        .image-preview {
            position: relative;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            background: white;
        }

        .image-preview img {
            width: 100%;
            height: 150px;
            object-fit: cover;
            display: block;
        }

        .image-remove {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            background-color: rgba(239, 68, 68, 0.9);
            color: white;
            border: none;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            transition: background-color 0.2s;
            z-index: 10;
        }

        .image-remove:hover {
            background-color: #dc2626;
        }

        .image-info {
            padding: 0.75rem;
            border-top: 1px solid #f3f4f6;
        }

        .image-name {
            font-size: 0.75rem;
            font-weight: 500;
            color: #374151;
            margin-bottom: 0.25rem;
        }

        .image-size {
            font-size: 0.6875rem;
            color: #6b7280;
            margin-bottom: 0.5rem;
        }

        .upload-status {
            font-size: 0.6875rem;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }

        .upload-status.success {
            color: #10b981;
        }

        .upload-status.pending {
            color: #f59e0b;
        }

        .image-upload-area.drag-over {
            border-color: #FF9800;
            background-color: rgba(255, 152, 0, 0.05);
            transform: scale(1.02);
        }
    `;
    
    document.head.appendChild(style);
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.initializeImageUpload = initializeImageUpload;
window.saveProductImages = saveProductImages;
window.loadProductImages = loadProductImages;
window.clearImages = clearImages;