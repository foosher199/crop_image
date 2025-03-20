// Import i18n module
import i18n from './i18n/index.js';

// 全局变量
const imageData = []; // 存储所有图片数据
let currentImageIndex = -1; // 当前选中的图片索引
let isDragging = false; // 是否正在拖动裁剪框
let isResizing = false; // 是否正在调整裁剪框大小
let resizeHandle = ''; // 当前操作的调整柄
let startX, startY; // 拖动/调整的起始位置
let cropStartX, cropStartY, cropStartWidth, cropStartHeight; // 裁剪框的起始状态

// DOM元素
const elements = {
    // 上传相关
    uploadArea: document.getElementById('upload-area'),
    fileInput: document.getElementById('file-input'),
    uploadProgress: document.getElementById('upload-progress'),
    uploadProgressFill: document.querySelector('#upload-progress .progress-fill'),
    uploadProgressText: document.querySelector('#upload-progress .progress-text'),
    
    // 预览相关
    previewSection: document.getElementById('preview-section'),
    imagesContainer: document.getElementById('images-container'),
    
    // 裁剪相关
    cropSection: document.getElementById('crop-section'),
    cropTypeRadios: document.querySelectorAll('input[name="crop-type"]'),
    ratioOptions: document.getElementById('ratio-options'),
    sizeOptions: document.getElementById('size-options'),
    aspectRatio: document.getElementById('aspect-ratio'),
    widthInput: document.getElementById('width-input'),
    heightInput: document.getElementById('height-input'),
    applyToAllBtn: document.getElementById('apply-to-all'),
    resetCropsBtn: document.getElementById('reset-crops'),
    currentImage: document.getElementById('current-image'),
    cropOverlay: document.getElementById('crop-overlay'),
    rotateLeftBtn: document.getElementById('rotate-left'),
    rotateRightBtn: document.getElementById('rotate-right'),
    
    // 下载相关
    downloadSection: document.getElementById('download-section'),
    outputFormat: document.getElementById('output-format'),
    outputQuality: document.getElementById('output-quality'),
    qualityValue: document.getElementById('quality-value'),
    processAllBtn: document.getElementById('process-all'),
    processingProgress: document.getElementById('processing-progress'),
    processingProgressFill: document.querySelector('#processing-progress .progress-fill'),
    processingProgressText: document.querySelector('#processing-progress .progress-text'),
    downloadZipBtn: document.getElementById('download-zip'),
    
    // Toast提示
    toastContainer: document.getElementById('toast-container'),
    
    // 语言选择器
    languageSelector: document.getElementById('language-selector')
};

// 初始化应用
function initApp() {
    // 初始化i18n
    i18n.init();
    
    // 设置语言选择器事件监听
    setupLanguageSwitcher();
    
    // 设置其他事件监听器
    setupEventListeners();
    setupResizeHandles();
    
    // 初始化滚动提示
    setupScrollHint();
    
    // 初始化质量值显示
    updateQualityValue();
}

// 设置语言切换器
function setupLanguageSwitcher() {
    if (elements.languageSelector) {
        // 设置初始值为当前语言
        elements.languageSelector.value = i18n.getCurrentLanguage();
        
        // 语言切换事件
        elements.languageSelector.addEventListener('change', function() {
            const selectedLang = this.value;
            i18n.setLanguage(selectedLang);
        });
    }
}

// 设置所有事件监听器
function setupEventListeners() {
    // 文件上传相关事件
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleFileDrop);
    
    // 裁剪相关事件
    elements.cropTypeRadios.forEach(radio => {
        radio.addEventListener('change', handleCropTypeChange);
    });
    elements.aspectRatio.addEventListener('change', handleAspectRatioChange);
    elements.widthInput.addEventListener('input', handleSizeChange);
    elements.heightInput.addEventListener('input', handleSizeChange);
    elements.applyToAllBtn.addEventListener('click', applyCurrentCropToAll);
    elements.resetCropsBtn.addEventListener('click', resetAllCrops);
    elements.rotateLeftBtn.addEventListener('click', () => rotateImage(-90));
    elements.rotateRightBtn.addEventListener('click', () => rotateImage(90));
    
    // 裁剪框拖动和调整事件
    elements.cropOverlay.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', updateDragOrResize);
    document.addEventListener('mouseup', stopDragOrResize);
    
    // 下载相关事件
    elements.outputQuality.addEventListener('input', updateQualityValue);
    elements.processAllBtn.addEventListener('click', processAllImages);
    elements.downloadZipBtn.addEventListener('click', downloadProcessedImages);
}

// 设置裁剪框的调整柄
function setupResizeHandles() {
    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(position => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${position}`;
        handle.dataset.position = position;
        handle.addEventListener('mousedown', startResizing);
        elements.cropOverlay.appendChild(handle);
    });
}

// 处理文件选择
function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        processFiles(files);
    }
}

// 处理拖拽文件 - 拖拽悬停
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.uploadArea.classList.add('highlight');
}

// 处理拖拽文件 - 拖拽离开
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.uploadArea.classList.remove('highlight');
}

// 处理拖拽文件 - 文件放置
function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.uploadArea.classList.remove('highlight');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processFiles(files);
    }
}

// 处理文件上传和加载
function processFiles(files) {
    // 只处理图片文件
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showToast(i18n.translate('errorInvalidFiles'), 'error');
        return;
    }
    
    // 显示上传进度条
    elements.uploadProgress.style.display = 'block';
    let loadedCount = 0;
    
    // 遍历处理每一个文件
    imageFiles.forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // 创建图片对象用于获取图片尺寸
            const img = new Image();
            img.onload = function() {
                // 创建图片数据对象
                const image = {
                    id: Date.now() + index, // 生成唯一ID
                    file: file,             // 原始文件
                    src: e.target.result,   // 图片数据URL
                    name: file.name,        // 文件名
                    type: file.type,        // 文件类型
                    size: formatFileSize(file.size), // 格式化后的文件大小
                    width: img.naturalWidth,       // 图片原始宽度
                    height: img.naturalHeight,     // 图片原始高度
                    rotation: 0,            // 旋转角度
                    crop: {                 // 初始裁剪信息设为整个图片
                        x: 0,
                        y: 0,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    }
                };
                
                console.log(`加载图片: ${image.name}, 尺寸: ${image.width}x${image.height}`);
                
                // 添加到图片数据数组
                imageData.push(image);
                
                // 更新上传进度
                loadedCount++;
                const progress = Math.round((loadedCount / imageFiles.length) * 100);
                updateUploadProgress(progress);
                
                // 上传完成后处理
                if (loadedCount === imageFiles.length) {
                    setTimeout(() => {
                        // 隐藏上传进度，显示预览和裁剪区域
                        elements.uploadProgress.style.display = 'none';
                        elements.previewSection.style.display = 'block';
                        elements.cropSection.style.display = 'block';
                        elements.downloadSection.style.display = 'block';
                        
                        // 显示上传的图片
                        renderImagePreviews();
                        
                        // 如果还没有选择图片，默认选择第一张
                        if (currentImageIndex === -1 && imageData.length > 0) {
                            selectImage(0);
                        }
                    }, 500);
                }
            };
            img.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
    });
    
    // 上传完成提示
    showToast(i18n.translate('successUpload'), 'success');
}

// 更新上传进度条
function updateUploadProgress(percent) {
    elements.uploadProgressFill.style.width = `${percent}%`;
    elements.uploadProgressText.textContent = `${percent}%`;
}

// 显示图片预览缩略图
function renderImagePreviews() {
    // 清空容器
    elements.imagesContainer.innerHTML = '';
    
    // 确保imagesContainer始终使用grid-view类
    elements.imagesContainer.className = 'grid-view';
    
    // 遍历所有图片数据创建预览
    imageData.forEach((image, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.index = index;
        
        // 添加选中状态
        if (index === currentImageIndex) {
            imageItem.classList.add('selected');
        }
        
        // 创建预览内容
        imageItem.innerHTML = `
            <div class="image-container">
                <img src="${image.src}" alt="${image.name}">
                <div class="select-overlay"></div>
            </div>
            <div class="image-info">
                <div class="image-name">${image.name}</div>
                <div class="image-meta">
                    <span>${image.width} × ${image.height}</span>
                    <span>${image.size}</span>
                </div>
            </div>
        `;
        
        // 点击选择图片
        imageItem.addEventListener('click', () => {
            selectImage(index);
        });
        
        // 添加到容器中
        elements.imagesContainer.appendChild(imageItem);
    });
    
    // 添加滚动监听
    setupScrollHint();
}

// 设置滚动提示
function setupScrollHint() {
    const container = elements.imagesContainer;
    const scrollHint = document.querySelector('.scroll-hint');
    
    // 检查是否需要滚动
    function checkScrollNeeded() {
        if (container.scrollHeight > container.clientHeight) {
            scrollHint.classList.add('visible');
        } else {
            scrollHint.classList.remove('visible');
        }
    }
    
    // 监听滚动事件
    container.addEventListener('scroll', function() {
        // 当用户滚动到底部时隐藏提示
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 10) {
            scrollHint.classList.remove('visible');
        } else if (container.scrollHeight > container.clientHeight) {
            // 否则，如果内容超出了容器高度，则显示提示
            scrollHint.classList.add('visible');
        }
    });
    
    // 初始检查
    setTimeout(checkScrollNeeded, 200); // 延迟检查，确保图片已经加载并计算了正确的高度
    
    // 当窗口大小改变时，重新检查
    window.addEventListener('resize', checkScrollNeeded);
}

// 选择图片进行编辑
function selectImage(index) {
    if (index < 0 || index >= imageData.length) return;
    
    // 更新当前索引
    currentImageIndex = index;
    
    // 更新缩略图选中状态
    document.querySelectorAll('.image-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    // 更新当前图片预览
    const image = imageData[index];
    elements.currentImage.src = image.src;
    elements.currentImage.style.transform = `rotate(${image.rotation}deg)`;
    
    // 图片加载完成后再更新裁剪框
    elements.currentImage.onload = function() {
        // 更新裁剪框位置和大小
        updateCropOverlay(image.crop);
    };
    
    // 如果图片已经加载完成，直接更新裁剪框
    if (elements.currentImage.complete) {
        updateCropOverlay(image.crop);
    }
}

// 更新裁剪框的位置和大小
function updateCropOverlay(crop) {
    if (currentImageIndex === -1) return;
    
    const image = imageData[currentImageIndex];
    const imgElement = elements.currentImage;
    
    // 等待图片加载完成，确保尺寸已经可用
    if (!imgElement.complete) {
        imgElement.onload = function() {
            updateCropOverlay(crop);
        };
        return;
    }
    
    // 确保图片尺寸有效
    if (!imgElement.naturalWidth || !imgElement.width) {
        console.warn('图片尺寸无效，无法显示裁剪框');
        return;
    }
    
    // 计算图片的显示尺寸与实际尺寸的比例
    const displayWidth = imgElement.width || imgElement.clientWidth;
    const displayHeight = imgElement.height || imgElement.clientHeight;
    const scaleX = displayWidth / imgElement.naturalWidth;
    const scaleY = displayHeight / imgElement.naturalHeight;
    
    // 调整裁剪框 - 将原图像素值转换为显示像素值
    elements.cropOverlay.style.left = `${crop.x * scaleX}px`;
    elements.cropOverlay.style.top = `${crop.y * scaleY}px`;
    elements.cropOverlay.style.width = `${crop.width * scaleX}px`;
    elements.cropOverlay.style.height = `${crop.height * scaleY}px`;
    
    // 输出调试信息
    console.log('显示裁剪框:', {
        naturalSize: `${imgElement.naturalWidth}x${imgElement.naturalHeight}`,
        displaySize: `${displayWidth}x${displayHeight}`,
        scale: `${scaleX}x${scaleY}`,
        crop: crop,
        left: `${crop.x * scaleX}px`,
        top: `${crop.y * scaleY}px`,
        width: `${crop.width * scaleX}px`,
        height: `${crop.height * scaleY}px`
    });
    
    // 添加调整柄，如果还没有
    if (elements.cropOverlay.querySelectorAll('.resize-handle').length === 0) {
        setupResizeHandles();
    }
}

// 处理裁剪类型变化
function handleCropTypeChange(event) {
    const type = event.target.value;
    
    // 显示/隐藏对应的选项
    if (type === 'ratio') {
        elements.ratioOptions.style.display = 'block';
        elements.sizeOptions.style.display = 'none';
        handleAspectRatioChange();
    } else if (type === 'size') {
        elements.ratioOptions.style.display = 'none';
        elements.sizeOptions.style.display = 'block';
        handleSizeChange();
    } else { // custom
        elements.ratioOptions.style.display = 'none';
        elements.sizeOptions.style.display = 'none';
    }
}

// 处理宽高比变化
function handleAspectRatioChange() {
    if (currentImageIndex === -1) return;
    
    const ratioValue = elements.aspectRatio.value;
    const [widthRatio, heightRatio] = ratioValue.split(':').map(Number);
    const aspectRatio = widthRatio / heightRatio;
    
    // 获取当前裁剪框数据
    const cropElement = elements.cropOverlay;
    const currentWidth = parseInt(cropElement.style.width) || 200;
    
    // 根据宽高比调整高度
    const newHeight = currentWidth / aspectRatio;
    cropElement.style.height = `${newHeight}px`;
    
    // 更新图片数据中的裁剪信息
    updateCropData();
}

// 处理固定尺寸变化
function handleSizeChange() {
    if (currentImageIndex === -1) return;
    
    const widthValue = elements.widthInput.value;
    const heightValue = elements.heightInput.value;
    
    if (widthValue && heightValue) {
        const width = parseInt(widthValue);
        const height = parseInt(heightValue);
        
        if (width > 0 && height > 0) {
            const image = imageData[currentImageIndex];
            const scale = elements.currentImage.width / image.width;
            
            // 调整裁剪框到指定尺寸
            elements.cropOverlay.style.width = `${width * scale}px`;
            elements.cropOverlay.style.height = `${height * scale}px`;
            
            // 更新图片数据中的裁剪信息
            updateCropData();
        }
    }
}

// 开始拖动裁剪框
function startDragging(event) {
    // 确保不是从调整柄开始的拖动
    if (event.target !== elements.cropOverlay) return;
    
    event.preventDefault();
    isDragging = true;
    
    // 记录起始位置
    startX = event.clientX;
    startY = event.clientY;
    
    // 记录裁剪框的起始位置
    const style = window.getComputedStyle(elements.cropOverlay);
    cropStartX = parseInt(style.left) || 0;
    cropStartY = parseInt(style.top) || 0;
    
    // 添加移动中的样式
    elements.cropOverlay.classList.add('dragging');
}

// 开始调整裁剪框大小
function startResizing(event) {
    event.preventDefault();
    event.stopPropagation();
    
    isResizing = true;
    resizeHandle = event.target.dataset.position;
    
    // 记录起始位置
    startX = event.clientX;
    startY = event.clientY;
    
    // 记录裁剪框的起始状态
    const style = window.getComputedStyle(elements.cropOverlay);
    cropStartX = parseInt(style.left) || 0;
    cropStartY = parseInt(style.top) || 0;
    cropStartWidth = parseInt(style.width) || 200;
    cropStartHeight = parseInt(style.height) || 200;
    
    // 添加调整中的样式
    elements.cropOverlay.classList.add('resizing');
}

// 更新拖动或调整大小的位置
function updateDragOrResize(event) {
    if (!isDragging && !isResizing) return;
    
    event.preventDefault();
    
    // 计算移动距离
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    
    // 获取图片容器的边界
    const imgElement = elements.currentImage;
    const imgRect = imgElement.getBoundingClientRect();
    
    if (isDragging) {
        // 计算新位置
        let newLeft = cropStartX + deltaX;
        let newTop = cropStartY + deltaY;
        
        // 获取裁剪框尺寸
        const width = parseInt(elements.cropOverlay.style.width) || 200;
        const height = parseInt(elements.cropOverlay.style.height) || 200;
        
        // 限制不超出图片边界
        newLeft = Math.max(0, Math.min(newLeft, imgRect.width - width));
        newTop = Math.max(0, Math.min(newTop, imgRect.height - height));
        
        // 更新裁剪框位置
        elements.cropOverlay.style.left = `${newLeft}px`;
        elements.cropOverlay.style.top = `${newTop}px`;
    } else if (isResizing) {
        // 获取当前裁剪框状态
        const cropElement = elements.cropOverlay;
        let newLeft = cropStartX;
        let newTop = cropStartY;
        let newWidth = cropStartWidth;
        let newHeight = cropStartHeight;
        
        // 根据不同的调整柄更新裁剪框
        switch (resizeHandle) {
            case 'se': // 右下角
                newWidth = Math.max(50, cropStartWidth + deltaX);
                newHeight = Math.max(50, cropStartHeight + deltaY);
                break;
            case 'sw': // 左下角
                newLeft = cropStartX + deltaX;
                newWidth = Math.max(50, cropStartWidth - deltaX);
                newHeight = Math.max(50, cropStartHeight + deltaY);
                break;
            case 'ne': // 右上角
                newTop = cropStartY + deltaY;
                newWidth = Math.max(50, cropStartWidth + deltaX);
                newHeight = Math.max(50, cropStartHeight - deltaY);
                break;
            case 'nw': // 左上角
                newLeft = cropStartX + deltaX;
                newTop = cropStartY + deltaY;
                newWidth = Math.max(50, cropStartWidth - deltaX);
                newHeight = Math.max(50, cropStartHeight - deltaY);
                break;
        }
        
        // 限制不超出图片边界
        newLeft = Math.max(0, Math.min(newLeft, imgRect.width - 50));
        newTop = Math.max(0, Math.min(newTop, imgRect.height - 50));
        newWidth = Math.min(newWidth, imgRect.width - newLeft);
        newHeight = Math.min(newHeight, imgRect.height - newTop);
        
        // 更新裁剪框
        cropElement.style.left = `${newLeft}px`;
        cropElement.style.top = `${newTop}px`;
        cropElement.style.width = `${newWidth}px`;
        cropElement.style.height = `${newHeight}px`;
        
        // 如果是固定比例，则保持比例
        if (document.getElementById('crop-ratio').checked) {
            handleAspectRatioChange();
        }
    }
}

// 停止拖动或调整大小
function stopDragOrResize(event) {
    if (isDragging || isResizing) {
        // 移除拖动/调整中的样式
        elements.cropOverlay.classList.remove('dragging', 'resizing');
        
        isDragging = false;
        isResizing = false;
        resizeHandle = '';
        
        // 更新图片数据中的裁剪信息
        updateCropData();
    }
}

// 更新图片数据中的裁剪信息
function updateCropData() {
    if (currentImageIndex === -1) return;
    
    const image = imageData[currentImageIndex];
    const cropElement = elements.cropOverlay;
    const imgElement = elements.currentImage;
    
    // 获取裁剪框的位置和尺寸（像素值）
    const left = parseInt(cropElement.style.left) || 0;
    const top = parseInt(cropElement.style.top) || 0;
    const width = parseInt(cropElement.style.width) || 200;
    const height = parseInt(cropElement.style.height) || 200;
    
    // 确保图片已加载
    if (!imgElement.complete || !imgElement.naturalWidth) {
        console.warn('图片尚未完全加载，无法准确计算裁剪区域');
        return;
    }
    
    // 计算图片的实际尺寸与显示尺寸的比例
    const displayWidth = imgElement.width || imgElement.clientWidth;
    const displayHeight = imgElement.height || imgElement.clientHeight;
    
    if (!displayWidth || !displayHeight) {
        console.warn('无法获取图片显示尺寸');
        return;
    }
    
    const scaleX = imgElement.naturalWidth / displayWidth;
    const scaleY = imgElement.naturalHeight / displayHeight;
    
    console.log('缩放比例计算:', {
        naturalWidth: imgElement.naturalWidth,
        naturalHeight: imgElement.naturalHeight,
        displayWidth,
        displayHeight,
        scaleX,
        scaleY
    });
    
    // 计算裁剪数据（相对于原图的像素位置）
    const cropData = {
        x: Math.round(left * scaleX),
        y: Math.round(top * scaleY),
        width: Math.round(width * scaleX),
        height: Math.round(height * scaleY)
    };
    
    // 确保裁剪区域不超出图片边界
    cropData.x = Math.max(0, Math.min(cropData.x, image.width - 1));
    cropData.y = Math.max(0, Math.min(cropData.y, image.height - 1));
    cropData.width = Math.min(cropData.width, image.width - cropData.x);
    cropData.height = Math.min(cropData.height, image.height - cropData.y);
    
    // 确保裁剪区域至少为1x1像素
    cropData.width = Math.max(1, cropData.width);
    cropData.height = Math.max(1, cropData.height);
    
    // 更新图片数据
    image.crop = cropData;
    
    // 输出调试信息
    console.log('更新裁剪数据:', cropData);
}

// 旋转图片
function rotateImage(degrees) {
    if (currentImageIndex === -1) return;
    
    const image = imageData[currentImageIndex];
    image.rotation = (image.rotation + degrees) % 360;
    
    // 更新图片旋转样式
    elements.currentImage.style.transform = `rotate(${image.rotation}deg)`;
}

// 应用当前裁剪设置到所有图片
function applyCurrentCropToAll() {
    if (currentImageIndex < 0 || imageData.length === 0) return;
    
    const currentCrop = imageData[currentImageIndex].crop;
    
    // 应用当前裁剪设置到所有图片
    imageData.forEach(img => {
        img.crop = { ...currentCrop };
    });
    
    showToast(i18n.translate('appliedToAll'), 'success');
}

// 重置所有裁剪设置
function resetAllCrops() {
    imageData.forEach(img => {
        img.crop = {
            x: 0,
            y: 0,
            width: img.width,
            height: img.height,
            rotation: 0
        };
    });
    
    // 如果有选中的图片，更新裁剪框显示
    if (currentImageIndex >= 0) {
        updateCropOverlay(imageData[currentImageIndex].crop);
    }
    
    showToast(i18n.translate('resetAll'), 'success');
}

// 更新质量值显示
function updateQualityValue() {
    const value = elements.outputQuality.value;
    elements.qualityValue.textContent = `${value}%`;
}

// 处理所有图片
function processAllImages() {
    if (imageData.length === 0) {
        showToast(i18n.translate('errorNoImages'), 'error');
        return;
    }
    
    // 确保所有图片的裁剪数据都是最新的
    if (currentImageIndex !== -1) {
        updateCropData();
    }
    
    // 显示处理进度条
    elements.processingProgress.style.display = 'block';
    elements.processAllBtn.disabled = true;
    elements.downloadZipBtn.style.display = 'none'; // 隐藏下载按钮
    
    // 准备处理参数
    const format = elements.outputFormat.value;
    const quality = parseInt(elements.outputQuality.value) / 100;
    
    // 处理所有图片
    const processedImages = [];
    let processedCount = 0;
    
    // 使用Promise管理异步加载
    const promises = imageData.map((image, index) => {
        return new Promise((resolve) => {
            // 创建一个新的Image对象用于加载原始图片
            const originalImg = new Image();
            originalImg.crossOrigin = 'Anonymous'; // 处理跨域问题
            
            originalImg.onload = function() {
                // 输出调试信息
                console.log(`准备处理图片 ${index}: ${image.name}`);
                console.log('裁剪信息:', image.crop);
                console.log('原始尺寸:', originalImg.width, 'x', originalImg.height);
                
                // 创建离屏canvas进行裁剪处理
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 设置canvas尺寸为裁剪后的尺寸
                let canvasWidth = image.crop.width;
                let canvasHeight = image.crop.height;
                
                // 处理旋转导致的尺寸变化
                if (Math.abs(image.rotation) === 90 || Math.abs(image.rotation) === 270) {
                    canvasWidth = image.crop.height;
                    canvasHeight = image.crop.width;
                }
                
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                
                // 根据旋转角度调整
                if (image.rotation !== 0) {
                    // 移动原点到canvas中心
                    ctx.save();
                    ctx.translate(canvas.width / 2, canvas.height / 2);
                    ctx.rotate((image.rotation * Math.PI) / 180);
                    
                    // 根据旋转角度的不同，调整绘制位置
                    if (Math.abs(image.rotation) === 90 || Math.abs(image.rotation) === 270) {
                        ctx.drawImage(
                            originalImg,
                            image.crop.x, image.crop.y, image.crop.width, image.crop.height,
                            -canvas.height / 2, -canvas.width / 2, image.crop.width, image.crop.height
                        );
                    } else {
                        ctx.drawImage(
                            originalImg,
                            image.crop.x, image.crop.y, image.crop.width, image.crop.height,
                            -canvas.width / 2, -canvas.height / 2, image.crop.width, image.crop.height
                        );
                    }
                    ctx.restore();
                } else {
                    // 不旋转，直接裁剪
                    ctx.drawImage(
                        originalImg,
                        image.crop.x, image.crop.y, image.crop.width, image.crop.height,
                        0, 0, canvas.width, canvas.height
                    );
                }
                
                // 为了调试，在页面上显示裁剪后的图像
                const debugImg = document.createElement('img');
                debugImg.style.display = 'none'; // 调试时可以设为'block'
                debugImg.style.maxWidth = '200px';
                debugImg.style.border = '1px solid red';
                document.body.appendChild(debugImg);
                
                // 转换为dataURL
                let mimeType;
                switch (format) {
                    case 'jpeg':
                        mimeType = 'image/jpeg';
                        break;
                    case 'png':
                        mimeType = 'image/png';
                        break;
                    case 'webp':
                        mimeType = 'image/webp';
                        break;
                    default:
                        mimeType = 'image/jpeg';
                }
                
                const dataURL = canvas.toDataURL(mimeType, quality);
                debugImg.src = dataURL; // 用于调试
                
                // 添加到处理后的图片数组
                processedImages.push({
                    name: generateOutputFilename(image.name, format),
                    data: dataURL
                });
                
                // 更新进度
                processedCount++;
                const progress = Math.round((processedCount / imageData.length) * 100);
                updateProcessingProgress(progress);
                
                // 解析Promise
                resolve();
                
                // 如果是最后一张图片处理完成
                if (processedCount === imageData.length) {
                    // 存储处理后的图片供下载
                    setTimeout(() => {
                        window.processedImageData = processedImages;
                        elements.downloadZipBtn.style.display = 'block';
                        showToast(i18n.translate('successProcess'), 'success');
                    }, 100);
                }
            };
            
            // 处理加载错误
            originalImg.onerror = function() {
                console.error(`图片 ${image.name} 加载失败`);
                resolve(); // 即使失败也解析Promise以继续处理其他图片
            };
            
            // 开始加载图片
            originalImg.src = image.src;
        });
    });
    
    // 当所有图片处理完成后
    Promise.all(promises).then(() => {
        console.log('所有图片处理Promise已完成');
    });
}

// 更新处理进度条
function updateProcessingProgress(percent) {
    elements.processingProgressFill.style.width = `${percent}%`;
    elements.processingProgressText.textContent = `${percent}%`;
    
    // 如果进度达到100%，启用处理按钮并显示下载按钮
    if (percent === 100) {
        setTimeout(() => {
            elements.processingProgress.style.display = 'none';
            elements.processAllBtn.disabled = false;
            elements.downloadZipBtn.style.display = 'flex'; // 显示下载按钮
        }, 500);
    }
}

// 下载处理后的图片
function downloadProcessedImages() {
    if (!window.processedImageData || window.processedImageData.length === 0) {
        showToast(i18n.translate('errorNoProcessedImages'), 'error');
        return;
    }
    
    // 创建ZIP文件
    const zip = new JSZip();
    
    // 添加所有图片到ZIP
    window.processedImageData.forEach(image => {
        // 将dataURL转换为二进制数据
        const binary = atob(image.data.split(',')[1]);
        const array = [];
        for (let i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
        }
        const blob = new Uint8Array(array);
        
        // 添加到ZIP
        zip.file(image.name, blob, {binary: true});
    });
    
    // 生成并下载ZIP文件
    zip.generateAsync({type: 'blob'}).then(function(content) {
        // 使用FileSaver.js下载文件
        saveAs(content, 'cropped-images.zip');
    });
}

// 生成输出文件名
function generateOutputFilename(originalName, format) {
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
    return `${nameWithoutExt}_cropped.${format}`;
}

// 格式化文件大小显示
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 显示Toast提示消息
function showToast(message, type = 'info', duration = 3000) {
    // 创建Toast元素
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // 根据类型设置图标
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    // 设置内容
    toast.innerHTML = `<i class="fas fa-${icon}"></i>${message}`;
    
    // 获取应用操作区域的位置
    const cropActionsArea = document.querySelector('.crop-actions-area');
    if (cropActionsArea) {
        const rect = cropActionsArea.getBoundingClientRect();
        // 设置Toast容器的位置为应用操作区域顶部
        elements.toastContainer.style.top = `${rect.top - 60}px`;
    }
    
    // 添加到容器，新的Toast放在最前面
    elements.toastContainer.insertBefore(toast, elements.toastContainer.firstChild);
    
    // 显示动画
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 自动关闭
    setTimeout(() => {
        toast.classList.remove('show');
        // 动画结束后移除元素
        setTimeout(() => {
            if (elements.toastContainer.contains(toast)) {
                elements.toastContainer.removeChild(toast);
            }
        }, 400);
    }, duration);
}

// 应用初始化
document.addEventListener('DOMContentLoaded', initApp); 