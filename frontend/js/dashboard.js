/**
 * dashboard.js - Main dashboard logic
 * Quản lý navigation, page init, stats
 */

// ================================================
// INITIALIZATION
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    // Kiểm tra auth
    if (!requireAuth()) return;

    // Hiển thị thông tin user
    const user = getCurrentUser();
    const usernameEl = document.getElementById('sidebarUsername');
    const avatarEl = document.getElementById('userAvatar');
    if (usernameEl) usernameEl.textContent = user.fullName || user.username;
    if (avatarEl) avatarEl.textContent = (user.username || 'A')[0].toUpperCase();

    // Load initial data
    loadDashboardStats();
    loadRecentFiles();
    checkHdfsConnection();
});

// ================================================
// VIEW NAVIGATION
// ================================================

const viewConfig = {
    'dashboard': { title: 'Dashboard',       subtitle: 'Tổng quan hệ thống' },
    'files':     { title: 'My Files',        subtitle: 'Quản lý file lưu trữ trên HDFS' },
    'shared':    { title: 'Shared Files',    subtitle: 'Link chia sẻ file công khai' },
    'hdfs':      { title: 'HDFS Status',     subtitle: 'Trạng thái Apache HDFS Cluster' },
    'topology':  { title: 'Rack & Balancer', subtitle: '🌐 HDFS Rack Awareness & Storage Balancer (Slide 15)' }
};

function showView(viewName) {
    // Ẩn tất cả views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Hiện view được chọn
    const viewEl = document.getElementById('view-' + viewName);
    const navEl = document.getElementById('nav-' + viewName);
    if (viewEl) viewEl.classList.add('active');
    if (navEl) navEl.classList.add('active');

    // Cập nhật header
    const config = viewConfig[viewName] || {};
    const titleEl = document.getElementById('pageTitle');
    const subtitleEl = document.getElementById('pageSubtitle');
    if (titleEl) titleEl.textContent = config.title || viewName;
    if (subtitleEl) subtitleEl.textContent = config.subtitle || '';

    // Load data cho từng view
    if (viewName === 'dashboard') {
        loadDashboardStats();
        loadRecentFiles();
    } else if (viewName === 'files') {
        loadFiles();
    } else if (viewName === 'hdfs') {
        loadHdfsStatus();
    } else if (viewName === 'shared') {
        loadSharedLinks();
    } else if (viewName === 'topology') {
        if (typeof renderRackTopology === 'function') {
            renderRackTopology();
        }
        if (typeof renderBalancerState === 'function') {
            renderBalancerState();
        }
    }
}

// ================================================
// DASHBOARD STATS
// ================================================

async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_BASE}/api/files/stats`, {
            headers: getHeaders()
        });
        const data = await response.json();

        document.getElementById('statTotalFiles').textContent = data.totalFiles ?? '0';
        document.getElementById('statTotalStorage').textContent = data.totalStorageFormatted || '0 B';
    } catch (err) {
        console.error('Failed to load stats:', err);
        document.getElementById('statTotalFiles').textContent = '?';
        document.getElementById('statTotalStorage').textContent = '?';
    }
}

// ================================================
// RECENT FILES (for dashboard)
// ================================================

async function loadRecentFiles() {
    const container = document.getElementById('recentFilesTable');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/api/files`, {
            headers: getHeaders()
        });
        const files = await response.json();

        if (!Array.isArray(files) || files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📂</div>
                    <div class="empty-title">Chưa có file nào</div>
                    <div class="empty-desc">Nhấn "Upload File" để bắt đầu upload lên HDFS</div>
                </div>`;
            return;
        }

        // Show only recent 5
        const recent = files.slice(0, 5);
        container.innerHTML = renderFileTable(recent, true);

    } catch (err) {
        container.innerHTML = `<div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <div class="empty-title">Không thể tải danh sách file</div>
            <div class="empty-desc">Kiểm tra Spring Boot đang chạy</div>
        </div>`;
    }
}

// ================================================
// HDFS STATUS in sidebar
// ================================================

async function checkHdfsConnection() {
    const indicator = document.getElementById('sidebarHdfsStatus');
    if (!indicator) return;

    try {
        const response = await fetch(`${API_BASE}/api/hdfs/ping`);
        const data = await response.json();

        if (data.status === 'CONNECTED') {
            indicator.innerHTML = `<div class="dot online"></div><span style="color: var(--success);">Connected</span>`;
            document.getElementById('statHdfsStatus').textContent = 'Online';
            document.getElementById('statHdfsBadge').textContent = '✓ Connected';
            document.getElementById('statHdfsBadge').className = 'stat-badge badge-success';

            // Load DataNode count
            loadDataNodeCount();
        } else {
            throw new Error('Disconnected');
        }
    } catch (err) {
        indicator.innerHTML = `<div class="dot offline"></div><span style="color: var(--danger);">Offline</span>`;
        document.getElementById('statHdfsStatus').textContent = 'Offline';
        document.getElementById('statHdfsBadge').textContent = '✗ No Connection';
        document.getElementById('statHdfsBadge').className = 'stat-badge badge-danger';
        document.getElementById('statDataNodes').textContent = '—';
    }
}

async function loadDataNodeCount() {
    try {
        const response = await fetch(`${API_BASE}/api/hdfs/status`);
        const data = await response.json();
        const count = data.dataNodeCount;
        document.getElementById('statDataNodes').textContent =
            (count !== undefined && count !== 'N/A') ? count : '—';
    } catch (err) {
        document.getElementById('statDataNodes').textContent = '—';
    }
}

// ================================================
// LOAD SHARED LINKS
// ================================================

async function loadSharedLinks() {
    const container = document.getElementById('sharedLinksContainer');
    if (!container) return;

    // For demo: show info about shared links from localStorage
    const sharedLinks = JSON.parse(localStorage.getItem('sharedLinks') || '[]');

    if (sharedLinks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔗</div>
                <div class="empty-title">Chưa có share link nào</div>
                <div class="empty-desc">Vào "My Files" và nhấn "Share" để tạo link chia sẻ</div>
            </div>`;
        return;
    }

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>File</th>
                    <th>Share Link</th>
                    <th>Hết hạn</th>
                    <th>Hành động</th>
                </tr>
            </thead>
            <tbody>
                ${sharedLinks.map(link => `
                    <tr>
                        <td>${link.fileName}</td>
                        <td><span class="code-path" style="font-size:11px;">${link.fullUrl}</span></td>
                        <td style="font-size:12px; color:var(--text-secondary);">${formatDate(link.expiredAt)}</td>
                        <td>
                            <div class="actions">
                                <button class="btn-action btn-download" onclick="window.open('${link.fullUrl}', '_blank')">
                                    ⬇️ Open
                                </button>
                                <button class="btn-action" onclick="copyText('${link.fullUrl}')">
                                    📋 Copy
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
}

// ================================================
// UTILITY: TOAST NOTIFICATIONS
// ================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
