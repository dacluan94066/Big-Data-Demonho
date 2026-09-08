/**
 * auth.js - Authentication + Shared Utility Functions
 * Được load đầu tiên - tất cả utility functions nằm ở đây
 * để các file khác có thể dùng.
 */

const API_BASE = (window.location.origin && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:5000';

/**
 * Lấy username đang đăng nhập từ localStorage
 */
function getCurrentUser() {
    let token = localStorage.getItem('token');
    let username = localStorage.getItem('username');
    let fullName = localStorage.getItem('fullName');

    if (!token || !username) {
        token = 'demo-token-admin';
        username = 'admin';
        fullName = 'Quản trị viên (Admin)';
        localStorage.setItem('token', token);
        localStorage.setItem('username', username);
        localStorage.setItem('fullName', fullName);
    }

    return {
        token: token,
        username: username,
        fullName: fullName || username
    };
}

function requireAuth() {
    getCurrentUser(); // Tự động đăng nhập admin nếu chưa có session
    return true;
}

/**
 * Đăng xuất - xóa session và redirect về login
 */
function logout() {
    if (confirm('Bạn có muốn làm mới phiên làm việc Demo?')) {
        localStorage.setItem('token', 'demo-token-admin');
        localStorage.setItem('username', 'admin');
        localStorage.setItem('fullName', 'Quản trị viên (Admin)');
        window.location.href = 'dashboard.html';
    }
}

/**
 * Tạo headers chuẩn cho API calls
 */
function getHeaders() {
    const user = getCurrentUser();
    return {
        'Content-Type': 'application/json',
        'X-Username': user.username || 'admin'
    };
}

/**
 * Tạo headers cho upload (không có Content-Type - để browser tự set boundary)
 */
function getUploadHeaders() {
    const user = getCurrentUser();
    return {
        'X-Username': user.username || 'admin'
    };
}

// ================================================
// SHARED UTILITY FUNCTIONS
// (định nghĩa ở đây để tất cả scripts có thể dùng)
// ================================================

/** Format bytes thành chuỗi dễ đọc */
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/** Format date string sang dạng Vi locale */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return dateStr; }
}

/** Lấy emoji icon phù hợp với loại file */
function getFileIcon(filename, contentType) {
    const ext = (filename || '').split('.').pop()?.toLowerCase();
    const type = contentType || '';
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext) || type.startsWith('image/')) return '🖼️';
    if (['mp4','avi','mov','mkv'].includes(ext) || type.startsWith('video/')) return '🎬';
    if (['mp3','wav','ogg','flac'].includes(ext) || type.startsWith('audio/')) return '🎵';
    if (ext === 'pdf') return '📄';
    if (['doc','docx'].includes(ext)) return '📝';
    if (['xls','xlsx'].includes(ext)) return '📊';
    if (['ppt','pptx'].includes(ext)) return '📑';
    if (['zip','rar','7z','tar','gz'].includes(ext)) return '🗜️';
    if (['js','ts','py','java','go','rs','cpp','c'].includes(ext)) return '💻';
    if (['json','xml','yml','yaml'].includes(ext)) return '⚙️';
    if (['txt','md','csv','log'].includes(ext)) return '📃';
    return '📁';
}

/** Copy text vào clipboard */
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã copy vào clipboard!', 'success');
    }).catch(() => {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Đã copy!', 'success');
    });
}
