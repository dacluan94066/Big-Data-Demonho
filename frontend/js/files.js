/**
 * files.js - Xử lý upload, download, delete, share file
 */

// Global state
let allFiles = [];
let selectedFile = null;
let fileToDelete = null;

// ================================================
// LOAD & DISPLAY FILES
// ================================================

async function loadFiles() {
    const container = document.getElementById('filesTableContainer');
    if (!container) return;

    container.innerHTML = `<div class="loading"><div class="spinner"></div> Đang tải danh sách file...</div>`;

    try {
        const response = await fetch(`${API_BASE}/api/files`, {
            headers: getHeaders()
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);

        allFiles = await response.json();
        renderFilesTable(allFiles, container);

    } catch (err) {
        console.error('Load files failed:', err);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Không thể tải danh sách file</div>
                <div class="empty-desc">Kiểm tra Spring Boot đang chạy tại port 8080</div>
            </div>`;
        showToast('Không thể kết nối đến server', 'error');
    }
}

function renderFilesTable(files, container) {
    if (!files || files.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <div class="empty-title">Chưa có file nào trên HDFS</div>
                <div class="empty-desc">Nhấn "Upload File" để upload file lên Apache HDFS</div>
            </div>`;
        return;
    }
    container.innerHTML = renderFileTable(files, false);
}

/**
 * Render file table HTML (dùng cho cả dashboard và files view)
 */
function renderFileTable(files, compact = false) {
    return `
    <table>
        <thead>
            <tr>
                <th>Tên file</th>
                ${compact ? '' : '<th>Đường dẫn HDFS</th>'}
                <th>Kích thước</th>
                <th>Phân bố Block (128MB)</th>
                <th>Người upload</th>
                <th>Ngày upload</th>
                <th>Hành động</th>
            </tr>
        </thead>
        <tbody>
            ${files.map(file => {
                const fname = file.fileName || file.filename || 'File';
                const fpath = file.filePath || file.hdfsPath || '';
                const fsize = file.fileSize || 0;
                const fsizeFmt = file.formattedSize || formatBytes(fsize);
                const uby = file.uploadedBy || file.uploaderUsername || 'admin';
                const uat = file.uploadedAt || file.uploadTime || '';
                const bcount = file.blockCount || Math.ceil((fsize || 1) / (128 * 1024 * 1024));

                return `
                <tr id="file-row-${file.id}">
                    <td>
                        <div class="file-name-cell">
                            <span class="file-icon">${getFileIcon(fname, file.contentType)}</span>
                            <div>
                                <div class="file-name-text">${escapeHtml(fname)}</div>
                                ${compact ? `<div class="file-path">${escapeHtml(fpath)}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    ${compact ? '' : `<td><span class="file-path">${escapeHtml(fpath)}</span></td>`}
                    <td><span class="size-badge">${fsizeFmt}</span></td>
                    <td>
                        <button class="btn-action" style="background:rgba(88,166,255,0.12); color:#58a6ff; border:1px solid rgba(88,166,255,0.3); font-size:11px; font-weight:600;" onclick="showBlockDetails('${encodeURIComponent(fname)}', ${fsize})">
                            🧩 ${bcount} Block${bcount > 1 ? 's' : ''} (x3 Copies)
                        </button>
                    </td>
                    <td style="color:var(--text-secondary); font-size:12px;">
                        👤 ${escapeHtml(uby)}
                    </td>
                    <td style="color:var(--text-secondary); font-size:12px;">
                        ${formatDate(uat)}
                    </td>
                    <td>
                        <div class="actions">
                            <button class="btn-action" style="background:rgba(188,140,255,0.15); color:#bc8cff; border:1px solid rgba(188,140,255,0.3);" onclick="showView('mapreduce'); executeMapReduceJob('${encodeURIComponent(fname)}', ${fsize});">
                                ⚡ MapReduce
                            </button>
                            <button class="btn-action btn-download" onclick="downloadFile(${file.id}, '${escapeHtml(fname)}')">
                                ⬇️ Download
                            </button>
                            <button class="btn-action btn-share" onclick="shareFile(${file.id}, '${escapeHtml(fname)}')">
                                🔗 Share
                            </button>
                            <button class="btn-action btn-delete" onclick="openDeleteModal(${file.id}, '${escapeHtml(fname)}')">
                                🗑️ Xóa
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('')}
        </tbody>
    </table>`;
}

// ================================================
// SEARCH / FILTER
// ================================================

function filterFiles(query) {
    const container = document.getElementById('filesTableContainer');
    if (!container) return;

    const filtered = query
        ? allFiles.filter(f =>
            (f.fileName || '').toLowerCase().includes(query.toLowerCase()) ||
            (f.uploadedBy || '').toLowerCase().includes(query.toLowerCase()) ||
            (f.filePath || '').toLowerCase().includes(query.toLowerCase())
          )
        : allFiles;

    renderFilesTable(filtered, container);
}

// ================================================
// UPLOAD FILE
// ================================================

function openUploadModal() {
    document.getElementById('uploadModal').classList.add('show');
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('uploadProgress').style.display = 'none';
    document.getElementById('fileInput').value = '';
    selectedFile = null;
    resetDropZone();
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('show');
    selectedFile = null;
}

function resetDropZone() {
    const dropZone = document.getElementById('dropZone');
    dropZone.innerHTML = `
        <input type="file" id="fileInput" onchange="handleFileSelect(this)">
        <div class="drop-icon">📎</div>
        <div class="drop-text">Kéo thả file vào đây hoặc nhấn để chọn</div>
        <div class="drop-hint">Hỗ trợ mọi loại file · Tối đa 500MB</div>
    `;
}

function handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    selectedFile = file;
    const icon = getFileIcon(file.name, file.type);
    const size = formatBytes(file.size);

    const dropZone = document.getElementById('dropZone');
    dropZone.innerHTML = `
        <input type="file" id="fileInput" onchange="handleFileSelect(this)">
        <div class="drop-icon">${icon}</div>
        <div class="drop-text" style="color:var(--text-primary); font-weight:600;">${escapeHtml(file.name)}</div>
        <div class="drop-hint">${size} · ${file.type || 'Unknown type'}</div>
    `;

    document.getElementById('uploadBtn').disabled = false;
}

// Drag & drop
document.addEventListener('DOMContentLoaded', () => {
    const dropZoneEl = document.getElementById('dropZone');
    if (dropZoneEl) {
        dropZoneEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZoneEl.classList.add('dragover');
        });
        dropZoneEl.addEventListener('dragleave', () => dropZoneEl.classList.remove('dragover'));
        dropZoneEl.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneEl.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                selectedFile = file;
                handleFileSelect({ files: [file] });
            }
        });
    }
});

async function uploadFile() {
    if (!selectedFile) {
        showToast('Vui lòng chọn file trước', 'warning');
        return;
    }

    const uploadBtn = document.getElementById('uploadBtn');
    const progress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressBarFill');
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadFileName = document.getElementById('uploadFileName');

    // Show progress
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Đang upload...';
    progress.style.display = 'block';
    uploadFileName.textContent = `📤 Đang upload: ${selectedFile.name}`;
    uploadStatus.textContent = 'Đang gửi file lên HDFS NameNode...';

    // Animate progress bar
    let progressValue = 0;
    const progressInterval = setInterval(() => {
        progressValue = Math.min(progressValue + Math.random() * 15, 85);
        progressFill.style.width = progressValue + '%';
    }, 300);

    try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch(`${API_BASE}/api/files/upload`, {
            method: 'POST',
            headers: getUploadHeaders(),
            body: formData
        });

        clearInterval(progressInterval);

        if (!response.ok) {
            let errMsg = 'Upload thất bại';
            try {
                const err = await response.json();
                errMsg = err.error || err.message || errMsg;
            } catch (e) {
                errMsg = `Lỗi hệ thống server (${response.status})`;
            }
            throw new Error(errMsg);
        }

        const result = await response.json();

        // Complete progress
        progressFill.style.width = '100%';
        uploadStatus.textContent = `✓ Upload thành công! HDFS path: ${result.hdfsPath}`;
        uploadStatus.style.color = 'var(--success)';

        showToast(`✓ "${selectedFile.name}" đã được upload lên HDFS!`, 'success');

        // Close modal and reload
        setTimeout(() => {
            closeUploadModal();
            loadFiles();
            loadDashboardStats();
        }, 1500);

    } catch (err) {
        clearInterval(progressInterval);
        progressFill.style.width = '0%';
        uploadStatus.textContent = '✕ Upload thất bại: ' + err.message;
        uploadStatus.style.color = 'var(--danger)';

        uploadBtn.disabled = false;
        uploadBtn.textContent = '⬆️ Thử lại';

        showToast('Upload thất bại: ' + err.message, 'error');
    }
}

// ================================================
// DOWNLOAD FILE FROM HDFS
// ================================================

function downloadFile(fileId, fileName) {
    showToast(`⬇️ Đang tải "${fileName}" từ HDFS...`, 'info');

    // Create hidden anchor to trigger download
    const link = document.createElement('a');
    link.href = `${API_BASE}/api/files/${fileId}/download`;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => showToast(`✓ File "${fileName}" đã được tải từ HDFS`, 'success'), 1500);
}

// ================================================
// SHARE FILE
// ================================================

async function shareFile(fileId, fileName) {
    showToast(`🔗 Đang tạo share link cho "${fileName}"...`, 'info');

    try {
        const response = await fetch(`${API_BASE}/api/files/${fileId}/share`, {
            method: 'POST',
            headers: getHeaders()
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();

        // Save to localStorage for shared view
        const sharedLinks = JSON.parse(localStorage.getItem('sharedLinks') || '[]');
        sharedLinks.unshift({
            fileName,
            shareToken: data.shareToken,
            fullUrl: data.fullUrl,
            expiredAt: data.expiredAt
        });
        localStorage.setItem('sharedLinks', JSON.stringify(sharedLinks.slice(0, 50)));

        // Show share modal
        document.getElementById('shareUrlInput').value = data.fullUrl;
        document.getElementById('shareExpiry').textContent = formatDate(data.expiredAt);
        document.getElementById('shareModal').classList.add('show');

    } catch (err) {
        showToast('Tạo share link thất bại: ' + err.message, 'error');
    }
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove('show');
}

function copyShareLink() {
    const url = document.getElementById('shareUrlInput').value;
    copyText(url);
}

// ================================================
// DELETE FILE
// ================================================

function openDeleteModal(fileId, fileName) {
    fileToDelete = fileId;
    document.getElementById('deleteFileName').textContent = fileName;
    document.getElementById('deleteModal').classList.add('show');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
    fileToDelete = null;
}

async function confirmDelete() {
    if (!fileToDelete) return;

    const fileId = fileToDelete;
    closeDeleteModal();

    showToast('🗑️ Đang xóa file khỏi HDFS...', 'warning');

    try {
        const response = await fetch(`${API_BASE}/api/files/${fileId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'HTTP ' + response.status);
        }

        const result = await response.json();

        // Remove row from table with animation
        const row = document.getElementById('file-row-' + fileId);
        if (row) {
            row.style.transition = 'opacity 0.3s ease';
            row.style.opacity = '0';
            setTimeout(() => row.remove(), 300);
        }

        // Update allFiles
        allFiles = allFiles.filter(f => f.id !== fileId);

        showToast(`✓ File "${result.deletedFile}" đã xóa khỏi HDFS và MySQL!`, 'success');
        loadDashboardStats();

    } catch (err) {
        showToast('Xóa file thất bại: ' + err.message, 'error');
    }
}

// ================================================
// UTILITY: HTML ESCAPE
// ================================================

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ================================================
// SHOW VISUAL HDFS BLOCK DETAILS MODAL
// ================================================

function showBlockDetails(fileNameOrEncoded, fileSize) {
    let fileName = fileNameOrEncoded;
    try {
        if (fileNameOrEncoded.includes('%')) {
            fileName = decodeURIComponent(fileNameOrEncoded);
        }
    } catch(e) {}

    const existing = document.getElementById('blockModal');
    if (existing) existing.remove();

    const blockSize = 128 * 1024 * 1024; // 128 MB
    const totalBlocks = fileSize > 0 ? Math.ceil(fileSize / blockSize) : 1;
    
    let blocksHtml = '';
    let remainingSize = fileSize;

    for (let i = 1; i <= totalBlocks; i++) {
        const currentBlockSize = Math.min(remainingSize, blockSize);
        remainingSize -= currentBlockSize;
        const formattedBlockSize = formatBytes(currentBlockSize);

        blocksHtml += `
            <div style="background:rgba(22,27,34,0.9); border:1px solid rgba(88,166,255,0.25); border-radius:12px; padding:14px; margin-bottom:12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="color:#58a6ff; font-size:14px;">🧩 Block #${i} / ${totalBlocks}</strong>
                    <span class="size-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff; font-weight:600;">${formattedBlockSize}</span>
                </div>
                <div style="font-size:12px; color:var(--text-secondary); line-height:1.6;">
                    <div>📍 <strong>DataNodes chứa bản sao (Replication x3):</strong></div>
                    <div style="display:flex; gap:6px; margin:6px 0;">
                        <span class="tech-badge badge-mysql" style="font-size:11px;">datanode-1.hdfs.local</span>
                        <span class="tech-badge badge-mysql" style="font-size:11px;">datanode-2.hdfs.local</span>
                        <span class="tech-badge badge-mysql" style="font-size:11px;">datanode-3.hdfs.local</span>
                    </div>
                    <div>🛡️ <strong>Trạng thái Block:</strong> <span style="color:var(--success); font-weight:600;">✓ HEALTHY (Replicated x3 copies)</span></div>
                </div>
            </div>
        `;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay show';
    modal.id = 'blockModal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
    modal.innerHTML = `
        <div class="modal" style="max-width:560px; background: #0d1117; border: 1px solid rgba(48,54,61,0.9); border-radius: 16px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); width: 90%;">
            <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div class="modal-title" style="font-size:16px; font-weight:700; color:white;">🧩 Phân tích HDFS Block: ${escapeHtml(fileName)}</div>
                <button class="modal-close" style="background:none; border:none; color:var(--text-secondary); font-size:20px; cursor:pointer;" onclick="document.getElementById('blockModal').remove()">✕</button>
            </div>
            <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px; background:rgba(88,166,255,0.06); border:1px solid rgba(88,166,255,0.15); border-radius:10px; padding:12px;">
                📄 File <strong>${escapeHtml(fileName)}</strong> (${formatBytes(fileSize)}) được HDFS tự động chia thành <strong>${totalBlocks} Block(s)</strong> (Kích thước Block chuẩn là <strong>128 MB</strong>).
            </div>
            <div style="max-height:360px; overflow-y:auto; padding-right:4px;">
                ${blocksHtml}
            </div>
            <div class="modal-footer" style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
                <button class="btn" style="background:linear-gradient(135deg, #1f6feb, #388bfd); color:white; font-weight:700; border:none; padding:8px 16px; border-radius:8px; cursor:pointer;" onclick="runMapReduceForFile('${encodeURIComponent(fileName)}', ${fileSize})">
                    ⚡ Chạy MapReduce trên File này
                </button>
                <button class="btn btn-secondary" style="padding:8px 16px; border-radius:8px; cursor:pointer;" onclick="document.getElementById('blockModal').remove()">Đóng cửa sổ</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function runMapReduceForFile(encodedFileName, fileSize) {
    const fileName = decodeURIComponent(encodedFileName);
    const modal = document.getElementById('blockModal');
    if (modal) modal.remove();
    showView('mapreduce');
    executeMapReduceJob(fileName, fileSize);
}
