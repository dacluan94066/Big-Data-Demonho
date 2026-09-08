/**
 * hdfs-status.js - Hiển thị thông tin HDFS Cluster
 *
 * Mục đích: Khi thuyết trình, mở trang này để chứng minh
 * ứng dụng đang thực sự giao tiếp với Apache HDFS.
 */

// ================================================
// LOAD HDFS STATUS
// ================================================

async function loadHdfsStatus() {
    const banner = document.getElementById('hdfsConnectionBanner');
    const filesList = document.getElementById('hdfsFilesList');

    // Show loading state
    if (banner) {
        banner.className = 'connection-banner loading';
        banner.innerHTML = `<div class="spinner"></div><span>Đang kết nối đến HDFS NameNode (localhost:9000)...</span>`;
    }
    if (filesList) {
        filesList.innerHTML = `<div class="loading"><div class="spinner"></div> Đang tải danh sách file từ HDFS...</div>`;
    }

    try {
        const response = await fetch(`${API_BASE}/api/hdfs/status`);
        const data = await response.json();

        if (data.connected) {
            renderHdfsConnected(data);
        } else {
            renderHdfsDisconnected(data);
        }

    } catch (err) {
        renderHdfsDisconnected({ error: 'Không thể kết nối đến Spring Boot. Kiểm tra backend đang chạy.' });
    }
}

// ================================================
// RENDER: CONNECTED
// ================================================

function renderHdfsConnected(data) {
    // Banner
    const banner = document.getElementById('hdfsConnectionBanner');
    if (banner) {
        banner.className = 'connection-banner connected';
        banner.innerHTML = `
            <span style="font-size:20px;">✅</span>
            <div>
                <strong>HDFS Status: CONNECTED</strong><br>
                <small style="opacity:0.8;">Kết nối thành công đến NameNode · ${data.nameNode || 'localhost:9000'}</small>
            </div>`;
    }

    // NameNode info
    setHdfsInfoValue('hdfsNameNode', data.nameNode || 'hdfs://localhost:9000');
    setHdfsInfoValue('hdfsRootPath', data.hdfsRoot || '/cloud-drive');
    setHdfsInfoValue('hdfsDataNodes', data.dataNodeCount !== undefined ? data.dataNodeCount : '—');
    setHdfsInfoValue('hdfsFileCount', data.fileCountOnHdfs !== undefined ? data.fileCountOnHdfs : '—');

    // Storage bar
    renderStorageBar(data);

    // Files list
    renderHdfsFilesList(data.files || []);
}

function setHdfsInfoValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ================================================
// RENDER: STORAGE BAR
// ================================================

function renderStorageBar(data) {
    const capacity = data.capacityBytes || 0;
    const used = data.usedBytes || 0;
    const remaining = data.remainingBytes || 0;
    const percent = capacity > 0 ? ((used / capacity) * 100).toFixed(1) : 0;

    const percentEl = document.getElementById('hdfsUsedPercent');
    if (percentEl) percentEl.textContent = `${percent}% đã sử dụng`;

    const barEl = document.getElementById('hdfsStorageBar');
    if (barEl) {
        setTimeout(() => { barEl.style.width = percent + '%'; }, 100);
    }

    const usedEl = document.getElementById('hdfsUsed');
    const remEl = document.getElementById('hdfsRemaining');
    const capEl = document.getElementById('hdfsCapacity');

    if (usedEl) usedEl.textContent = formatBytes(used);
    if (remEl) remEl.textContent = formatBytes(remaining);
    if (capEl) capEl.textContent = formatBytes(capacity);
}

// ================================================
// RENDER: HDFS FILES LIST
// ================================================

function renderHdfsFilesList(files) {
    const container = document.getElementById('hdfsFilesList');
    if (!container) return;

    const subtitleEl = document.getElementById('hdfsFilesSubtitle');

    if (!files || files.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <div class="empty-title">Thư mục /cloud-drive trống</div>
                <div class="empty-desc">Upload file để xem chúng xuất hiện trên HDFS</div>
            </div>`;
        if (subtitleEl) subtitleEl.textContent = 'Thư mục /cloud-drive · 0 file';
        return;
    }

    if (subtitleEl) subtitleEl.textContent = `Thư mục /cloud-drive · ${files.length} file`;

    container.innerHTML = files.map(file => {
        const icon = file.isDirectory ? '📁' : getFileIcon(file.name, '');
        const size = file.isDirectory ? '—' : formatBytes(file.size);
        const bcount = Math.ceil((file.size || 1) / (128 * 1024 * 1024));
        const date = file.modificationTime
            ? new Date(file.modificationTime).toLocaleString('vi-VN')
            : '—';

        return `
            <div class="hdfs-file-row">
                <div class="hdfs-file-name">
                    <span style="margin-right:8px;">${icon}</span>
                    <strong>${escapeHtml(file.path || file.name)}</strong>
                </div>
                <div class="hdfs-file-meta" style="display:flex; align-items:center; gap:12px;">
                    <span title="Kích thước">📦 ${size}</span>
                    <button class="btn-action" style="background:rgba(88,166,255,0.12); color:#58a6ff; border:1px solid rgba(88,166,255,0.3); font-size:11px; font-weight:600;" onclick="showBlockDetails('${escapeHtml(file.name)}', ${file.size || 0})">
                        🧩 Xem ${bcount} Block(s)
                    </button>
                    <span title="Ngày sửa đổi">🕐 ${date}</span>
                </div>
            </div>`;
    }).join('');
}

// ================================================
// RENDER: DISCONNECTED
// ================================================

function renderHdfsDisconnected(data) {
    const banner = document.getElementById('hdfsConnectionBanner');
    if (banner) {
        banner.className = 'connection-banner disconnected';
        banner.innerHTML = `
            <span style="font-size:20px;">❌</span>
            <div>
                <strong>HDFS Status: DISCONNECTED</strong><br>
                <small style="opacity:0.8;">${data.error || 'Không thể kết nối đến HDFS NameNode'}</small>
            </div>`;
    }

    // Reset values
    ['hdfsNameNode','hdfsRootPath','hdfsDataNodes','hdfsFileCount'].forEach(id => {
        setHdfsInfoValue(id, '—');
    });

    ['hdfsUsedPercent','hdfsUsed','hdfsRemaining','hdfsCapacity'].forEach(id => {
        setHdfsInfoValue(id, '—');
    });

    const filesList = document.getElementById('hdfsFilesList');
    if (filesList) {
        filesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Không thể kết nối HDFS</div>
                <div class="empty-desc">
                    Đảm bảo Hadoop đang chạy:<br>
                    <code style="font-size:12px; color:var(--accent);">start-dfs.sh</code> hoặc
                    <code style="font-size:12px; color:var(--accent);">%HADOOP_HOME%\\sbin\\start-dfs.cmd</code>
                </div>
            </div>`;
    }
}
