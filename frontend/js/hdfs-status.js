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

// ================================================
// FAULT TOLERANCE SIMULATION FUNCTIONS
// ================================================

async function loadClusterNodesState() {
    try {
        const res = await fetch('/api/hdfs/nodes/state');
        const data = await res.json();

        // Render Event Logs
        const logsContainer = document.getElementById('clusterEventLogs');
        if (logsContainer && data.events) {
            logsContainer.innerHTML = data.events.map(e => {
                let color = '#58a6ff';
                if (e.level === 'WARNING' || e.level === 'ALERT') color = '#f85149';
                if (e.level === 'SUCCESS') color = '#3fb950';
                return `<div style="margin-bottom:4px; line-height:1.5;">
                    <span style="color:var(--text-muted);">[${e.time}]</span> 
                    <strong style="color:${color};">${e.msg}</strong>
                </div>`;
            }).join('');
        }

        // Render 3 Visual DataNodes Cards Grid
        const gridContainer = document.getElementById('dataNodeCardsGrid');
        if (gridContainer && data.nodes) {
            gridContainer.innerHTML = data.nodes.map(node => {
                const isHealthy = node.status === 'HEALTHY';
                const bgStyle = isHealthy 
                    ? 'background:rgba(22,27,34,0.95); border:1px solid rgba(63,185,80,0.3);' 
                    : 'background:rgba(40,16,20,0.95); border:2px solid #f85149; box-shadow:0 0 16px rgba(248,81,73,0.3);';
                
                const badgeStyle = isHealthy 
                    ? 'background:rgba(63,185,80,0.15); color:#3fb950;' 
                    : 'background:#f85149; color:white; font-weight:800;';
                    
                return `
                    <div style="${bgStyle} border-radius:12px; padding:14px; position:relative; transition:all 0.3s ease;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div style="font-weight:700; font-size:13px; color:white;">🖥️ ${node.hostname}</div>
                            <span style="font-size:11px; padding:2px 8px; border-radius:4px; ${badgeStyle}">
                                ${isHealthy ? '🟢 HEALTHY' : '🚨 DEAD (TIMEOUT)'}
                            </span>
                        </div>
                        <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">
                            IP: <code>${node.ip}</code> | Rack: <code>${node.rack}</code>
                        </div>
                        
                        <div style="font-size:12px; color:var(--text-secondary); line-height:1.6;">
                            <div style="display:flex; justify-content:space-between;">
                                <span>Dung lượng đĩa:</span>
                                <strong style="color:${isHealthy ? 'var(--text-primary)' : '#f85149'};">${isHealthy ? `${node.usedGb} GB / ${node.capacityGb} GB` : 'DISCONNECTED'}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Tải CPU / RAM:</span>
                                <span>${isHealthy ? `${node.cpuPercent}% / ${node.ramPercent}%` : '0%'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Số Block đang lưu:</span>
                                <span>${isHealthy ? `${node.blocksCount} Blocks` : '0 Blocks (Offline)'}</span>
                            </div>
                        </div>

                        ${!isHealthy ? `
                            <div style="margin-top:10px; background:rgba(248,81,73,0.15); border:1px solid rgba(248,81,73,0.3); border-radius:6px; padding:6px 10px; font-size:11px; color:#f85149; font-weight:600;">
                                ⚠️ Mất kết nối Heartbeat (>10m)! NameNode đang báo nguy cấp.
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }

        // Render Cluster Health Badge
        const healthBadge = document.getElementById('clusterHealthBadge');
        if (healthBadge && data.summary) {
            if (data.summary.deadNodes > 0) {
                healthBadge.style.background = '#f85149';
                healthBadge.style.color = 'white';
                healthBadge.textContent = `🚨 UNHEALTHY (${data.summary.deadNodes} DEAD DATANODE)`;
            } else if (data.summary.underReplicatedBlocks > 0) {
                healthBadge.style.background = 'rgba(227,179,65,0.2)';
                healthBadge.style.color = '#e3b341';
                healthBadge.textContent = `⚠️ UNDER-REPLICATED (${data.summary.underReplicatedBlocks} BLOCKS)`;
            } else {
                healthBadge.style.background = 'rgba(63,185,80,0.15)';
                healthBadge.style.color = '#3fb950';
                healthBadge.textContent = '✓ CLUSTER HEALTHY (3/3 ACTIVE)';
            }
        }

        // Update Under Replicated Count badge if exists
        const underRepEl = document.getElementById('statUnderReplicated');
        if (underRepEl && data.summary) {
            underRepEl.textContent = data.summary.underReplicatedBlocks;
            underRepEl.style.color = data.summary.underReplicatedBlocks > 0 ? '#f85149' : '#3fb950';
        }

        // Update top stats
        const activeNodesEl = document.getElementById('hdfsDataNodes');
        const activeNodesSubEl = document.getElementById('hdfsDataNodesSub');
        if (activeNodesEl && data.summary) {
            activeNodesEl.textContent = `${data.summary.activeNodes} / ${data.summary.totalNodes}`;
            activeNodesEl.style.color = data.summary.deadNodes > 0 ? '#f85149' : 'var(--text-primary)';
            if (activeNodesSubEl) {
                activeNodesSubEl.textContent = data.summary.deadNodes > 0 ? `⚠️ ${data.summary.deadNodes} Node bị sập (DEAD)` : '3/3 Active';
            }
        }
    } catch (err) {
        console.error("Failed to load cluster nodes state", err);
    }
}

async function toggleDataNodeCrash(nodeId = 'dn2') {
    try {
        const res = await fetch('/api/hdfs/nodes/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: nodeId })
        });
        const data = await res.json();
        if (data.node.status === 'DEAD') {
            showToast(`🚨 DataNode ${data.node.hostname} đã sập! Under-Replicated Blocks: ${data.underReplicatedBlocks}`, 'error');
        } else {
            showToast(`🟢 DataNode ${data.node.hostname} đã hoạt động lại!`, 'success');
        }
        loadClusterNodesState();
        loadHdfsStatus();
    } catch (err) {
        showToast('Lỗi giả lập DataNode', 'error');
    }
}

async function triggerAutoHealing() {
    try {
        const res = await fetch('/api/hdfs/nodes/heal', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(`🔄 NameNode Auto-Healing thành công! 3 blocks đã được nhân bản bù.`, 'success');
        } else {
            showToast(`❌ ${data.message || 'Auto-Healing thất bại'}`, 'error');
        }
        loadClusterNodesState();
        loadHdfsStatus();
    } catch (err) {
        showToast('Lỗi Auto-Healing', 'error');
    }
}

async function resetAllDataNodes() {
    try {
        await fetch('/api/hdfs/nodes/reset', { method: 'POST' });
        showToast('🟢 Đã khôi phục 100% DataNodes về trạng thái HEALTHY', 'success');
        loadClusterNodesState();
        loadHdfsStatus();
    } catch (err) {
        showToast('Lỗi Reset DataNodes', 'error');
    }
}

// Auto load cluster events periodically
setInterval(loadClusterNodesState, 5000);
loadClusterNodesState();

