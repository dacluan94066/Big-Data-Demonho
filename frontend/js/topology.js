/**
 * topology.js - HDFS Rack Awareness Visualizer & Disk Balancer Simulator
 */

let rackAState = 'ONLINE'; // 'ONLINE' | 'OFFLINE'
let balancerRunning = false;
let isBalanced = false;

function renderRackTopology() {
    const rackContainer = document.getElementById('rackTopologyContainer');
    if (!rackContainer) return;

    if (rackAState === 'ONLINE') {
        rackContainer.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
                <!-- RACK A -->
                <div style="background: rgba(13, 17, 23, 0.9); border: 2px solid rgba(56, 139, 253, 0.4); border-radius: 16px; padding: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); transition: all 0.3s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 16px;">
                        <div>
                            <span style="font-size:16px; font-weight:800; color:#58a6ff; display:flex; align-items:center; gap:8px;">
                                🏢 RACK A (/default-rack-A)
                            </span>
                            <span style="font-size:11px; color:var(--text-muted);">Vị trí: Tủ máy chủ Trung tâm - Khu A</span>
                        </div>
                        <span style="font-size:11px; padding:3px 10px; border-radius:20px; background:rgba(63,185,80,0.2); color:#3fb950; border:1px solid rgba(63,185,80,0.4); font-weight:700;">
                            ✓ ONLINE (POWER OK)
                        </span>
                    </div>

                    <!-- Server Nodes in Rack A -->
                    <div style="background: rgba(22, 27, 34, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong style="color:white; font-size:14px;">🖥️ DataNode-1</strong>
                            <span style="font-size:11px; color:#58a6ff; background:rgba(88,166,255,0.15); padding:2px 8px; border-radius:4px;">192.168.1.101</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">📌 Giữ <strong>Replica 1 (Primary Copy)</strong> của mọi HDFS Block</div>
                        <div style="font-size:11px; color:var(--text-muted);">Trạng thái Heartbeat: <span style="color:#3fb950; font-weight:600;">Active (mỗi 3s)</span></div>
                    </div>

                    <div style="font-size:12px; background:rgba(56,139,253,0.1); border-left:3px solid #388bfd; padding:8px 12px; border-radius:4px; color:#a5d6ff;">
                        💡 <strong>Chính sách Rack Awareness (Slide 15):</strong> Bản sao 1 luôn được gửi tới Rack A chứa máy khách (Client).
                    </div>
                </div>

                <!-- RACK B -->
                <div style="background: rgba(13, 17, 23, 0.9); border: 2px solid rgba(188, 140, 255, 0.4); border-radius: 16px; padding: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); transition: all 0.3s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 16px;">
                        <div>
                            <span style="font-size:16px; font-weight:800; color:#bc8cff; display:flex; align-items:center; gap:8px;">
                                🏢 RACK B (/default-rack-B)
                            </span>
                            <span style="font-size:11px; color:var(--text-muted);">Vị trí: Tủ máy chủ Dự phòng - Khu B (Khác tủ nguồn)</span>
                        </div>
                        <span style="font-size:11px; padding:3px 10px; border-radius:20px; background:rgba(63,185,80,0.2); color:#3fb950; border:1px solid rgba(63,185,80,0.4); font-weight:700;">
                            ✓ ONLINE (POWER OK)
                        </span>
                    </div>

                    <!-- Server Nodes in Rack B -->
                    <div style="background: rgba(22, 27, 34, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <strong style="color:white; font-size:14px;">🖥️ DataNode-2</strong>
                            <span style="font-size:11px; color:#bc8cff; background:rgba(188,140,255,0.15); padding:2px 8px; border-radius:4px;">192.168.1.102</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-secondary);">📌 Giữ <strong>Replica 2 (Backup Copy)</strong></div>
                    </div>

                    <div style="background: rgba(22, 27, 34, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <strong style="color:white; font-size:14px;">🖥️ DataNode-3</strong>
                            <span style="font-size:11px; color:#bc8cff; background:rgba(188,140,255,0.15); padding:2px 8px; border-radius:4px;">192.168.1.103</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-secondary);">📌 Giữ <strong>Replica 3 (Backup Copy)</strong></div>
                    </div>

                    <div style="font-size:12px; background:rgba(188,140,255,0.1); border-left:3px solid #bc8cff; padding:8px 12px; border-radius:4px; color:#d2a8ff;">
                        💡 <strong>Lý do chọn Rack B:</strong> Bản sao 2 và 3 nằm ở khác tủ mạng với Bản sao 1 để đề phòng mất điện nguyên tủ Rack A.
                    </div>
                </div>
            </div>
        `;
    } else {
        // OFF-LINE RACK A
        rackContainer.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
                <!-- RACK A (CRASHED) -->
                <div style="background: rgba(248, 81, 73, 0.1); border: 2px solid rgba(248, 81, 73, 0.8); border-radius: 16px; padding: 20px; box-shadow: 0 0 30px rgba(248,81,73,0.3); transition: all 0.3s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(248,81,73,0.3); padding-bottom: 12px; margin-bottom: 16px;">
                        <div>
                            <span style="font-size:16px; font-weight:800; color:#f85149; display:flex; align-items:center; gap:8px;">
                                💥 RACK A (/default-rack-A)
                            </span>
                            <span style="font-size:11px; color:#ff7b72;">CẢNH BÁO: TỦ MẠNG MẤT ĐIỆN HOÀN TOÀN</span>
                        </div>
                        <span style="font-size:11px; padding:3px 10px; border-radius:20px; background:rgba(248,81,73,0.3); color:#f85149; border:1px solid #f85149; font-weight:800;">
                            ⚡ POWER FAILURE
                        </span>
                    </div>

                    <div style="background: rgba(248, 81, 73, 0.15); border: 1px solid rgba(248, 81, 73, 0.3); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong style="color:#ff7b72; font-size:14px;">🖥️ DataNode-1</strong>
                            <span style="font-size:11px; color:#f85149; background:rgba(248,81,73,0.2); padding:2px 8px; border-radius:4px; font-weight:700;">UNREACHABLE</span>
                        </div>
                        <div style="font-size:12px; color:#ff7b72;">❌ Mất kết nối Heartbeat. Replica 1 tạm thời ngắt kết nối.</div>
                    </div>

                    <div style="font-size:12px; background:rgba(248,81,73,0.2); border-left:3px solid #f85149; padding:8px 12px; border-radius:4px; color:#ff7b72; font-weight:600;">
                        ⚠️ NameNode tự động chuyển hướng mọi yêu cầu đọc/ghi dữ liệu sang Rack B!
                    </div>
                </div>

                <!-- RACK B (DỰ PHÒNG CỨU HỘ) -->
                <div style="background: rgba(63, 185, 80, 0.1); border: 2px solid rgba(63, 185, 80, 0.8); border-radius: 16px; padding: 20px; box-shadow: 0 0 30px rgba(63,185,80,0.2); transition: all 0.3s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(63,185,80,0.3); padding-bottom: 12px; margin-bottom: 16px;">
                        <div>
                            <span style="font-size:16px; font-weight:800; color:#3fb950; display:flex; align-items:center; gap:8px;">
                                🛡️ RACK B (/default-rack-B) - CỨU HỘ DỮ LIỆU
                            </span>
                            <span style="font-size:11px; color:#56d364;">Trạng thái: Đang phục vụ 100% Request thay thế Rack A</span>
                        </div>
                        <span style="font-size:11px; padding:3px 10px; border-radius:20px; background:rgba(63,185,80,0.3); color:#3fb950; border:1px solid #3fb950; font-weight:800;">
                            ✓ 100% DATA SAFE
                        </span>
                    </div>

                    <div style="background: rgba(22, 27, 34, 0.8); border: 1px solid rgba(63,185,80,0.4); border-radius: 12px; padding: 14px; margin-bottom: 10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <strong style="color:white; font-size:14px;">🖥️ DataNode-2</strong>
                            <span style="font-size:11px; color:#3fb950; background:rgba(63,185,80,0.2); padding:2px 8px; border-radius:4px; font-weight:700;">SERVING READS</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-secondary);">📌 Đang phục vụ <strong>Replica 2</strong> cho toàn bộ Client.</div>
                    </div>

                    <div style="background: rgba(22, 27, 34, 0.8); border: 1px solid rgba(63,185,80,0.4); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <strong style="color:white; font-size:14px;">🖥️ DataNode-3</strong>
                            <span style="font-size:11px; color:#3fb950; background:rgba(63,185,80,0.2); padding:2px 8px; border-radius:4px; font-weight:700;">SERVING READS</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-secondary);">📌 Đang phục vụ <strong>Replica 3</strong> cho toàn bộ Client.</div>
                    </div>

                    <div style="font-size:12px; background:rgba(63,185,80,0.15); border-left:3px solid #3fb950; padding:8px 12px; border-radius:4px; color:#56d364; font-weight:600;">
                        🎉 <strong>Kết quả minh chứng (Slide 15):</strong> Dù Rack A bị sập nguồn hoàn toàn, toàn bộ hệ thống vẫn hoạt động liên tục không mất 1 byte dữ liệu!
                    </div>
                </div>
            </div>
        `;
    }
}

function toggleRackAOutage() {
    const statusMsg = document.getElementById('rackOutageStatus');
    if (rackAState === 'ONLINE') {
        rackAState = 'OFFLINE';
        renderRackTopology();
        if (statusMsg) {
            statusMsg.innerHTML = `
                <div style="background:rgba(248,81,73,0.15); border:1px solid #f85149; color:#ff7b72; padding:12px 16px; border-radius:10px; font-size:13px;">
                    ⚠️ <strong>CẢNH BÁO MẤT NGUỒN RACK A:</strong> NameNode phát hiện Rack A mất điện! Nhờ chính sách <strong>Rack Awareness (Slide 15)</strong> đặt Replica 2&3 tại Rack B, toàn bộ dữ liệu người dùng vẫn an toàn 100%!
                </div>
            `;
        }
        showToast('💥 Đã giả lập sập nguồn Tủ máy chủ Rack A!', 'warning');
    } else {
        rackAState = 'ONLINE';
        renderRackTopology();
        if (statusMsg) {
            statusMsg.innerHTML = `
                <div style="background:rgba(63,185,80,0.15); border:1px solid #3fb950; color:#56d364; padding:12px 16px; border-radius:10px; font-size:13px;">
                    ✓ <strong>ĐÃ KHÔI PHỤC RACK A:</strong> Tủ máy chủ Rack A đã có điện trở lại. Cụm HDFS đạt trạng thái 100% HEALTHY.
                </div>
            `;
        }
        showToast('✓ Đã khôi phục điện tủ máy chủ Rack A!', 'success');
    }
}

// --------------------------------------------------
// HDFS DISK BALANCER SIMULATOR
// --------------------------------------------------

function renderBalancerState() {
    const container = document.getElementById('balancerStateContainer');
    if (!container) return;

    if (!isBalanced) {
        // Imbalanced state
        container.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:20px;">
                <!-- Node 1 Imbalanced -->
                <div style="background:#0d1117; border:2px solid rgba(248,81,73,0.6); border-radius:12px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:white; font-size:14px;">🖥️ DataNode-1</strong>
                        <span style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(248,81,73,0.2); color:#f85149; font-weight:800;">🔴 88% FULL (IMBALANCED)</span>
                    </div>
                    <div style="height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden; margin-bottom:8px;">
                        <div style="width:88%; height:100%; background:linear-gradient(90deg, #f85149, #da3633); border-radius:6px;"></div>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); display:flex; justify-content:space-between;">
                        <span>Đã dùng: <strong>440 GB / 500 GB</strong></span>
                        <span style="color:#f85149; font-weight:700;">+40% vượt ngưỡng!</span>
                    </div>
                </div>

                <!-- Node 2 -->
                <div style="background:#0d1117; border:1px solid var(--border); border-radius:12px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:white; font-size:14px;">🖥️ DataNode-2</strong>
                        <span style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(63,185,80,0.15); color:#3fb950; font-weight:700;">🟢 32% USED</span>
                    </div>
                    <div style="height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden; margin-bottom:8px;">
                        <div style="width:32%; height:100%; background:#3fb950; border-radius:6px;"></div>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); display:flex; justify-content:space-between;">
                        <span>Đã dùng: <strong>160 GB / 500 GB</strong></span>
                        <span>Rảnh rỗi nhiều</span>
                    </div>
                </div>

                <!-- Node 3 -->
                <div style="background:#0d1117; border:1px solid var(--border); border-radius:12px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:white; font-size:14px;">🖥️ DataNode-3</strong>
                        <span style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(63,185,80,0.15); color:#3fb950; font-weight:700;">🟢 24% USED</span>
                    </div>
                    <div style="height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden; margin-bottom:8px;">
                        <div style="width:24%; height:100%; background:#3fb950; border-radius:6px;"></div>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); display:flex; justify-content:space-between;">
                        <span>Đã dùng: <strong>120 GB / 500 GB</strong></span>
                        <span>Rảnh rỗi nhiều</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Balanced state
        container.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:20px;">
                <!-- Node 1 Balanced -->
                <div style="background:#0d1117; border:2px solid rgba(63,185,80,0.6); border-radius:12px; padding:16px; box-shadow:0 0 15px rgba(63,185,80,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:white; font-size:14px;">🖥️ DataNode-1</strong>
                        <span style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(63,185,80,0.2); color:#3fb950; font-weight:800;">✓ 48% BALANCED</span>
                    </div>
                    <div style="height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden; margin-bottom:8px;">
                        <div style="width:48%; height:100%; background:#3fb950; border-radius:6px;"></div>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); display:flex; justify-content:space-between;">
                        <span>Đã dùng: <strong>240 GB / 500 GB</strong></span>
                        <span style="color:#3fb950; font-weight:700;">Cân bằng hoàn hảo</span>
                    </div>
                </div>

                <!-- Node 2 Balanced -->
                <div style="background:#0d1117; border:2px solid rgba(63,185,80,0.6); border-radius:12px; padding:16px; box-shadow:0 0 15px rgba(63,185,80,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:white; font-size:14px;">🖥️ DataNode-2</strong>
                        <span style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(63,185,80,0.2); color:#3fb950; font-weight:800;">✓ 48% BALANCED</span>
                    </div>
                    <div style="height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden; margin-bottom:8px;">
                        <div style="width:48%; height:100%; background:#3fb950; border-radius:6px;"></div>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); display:flex; justify-content:space-between;">
                        <span>Đã dùng: <strong>240 GB / 500 GB</strong></span>
                        <span style="color:#3fb950; font-weight:700;">Cân bằng hoàn hảo</span>
                    </div>
                </div>

                <!-- Node 3 Balanced -->
                <div style="background:#0d1117; border:2px solid rgba(63,185,80,0.6); border-radius:12px; padding:16px; box-shadow:0 0 15px rgba(63,185,80,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:white; font-size:14px;">🖥️ DataNode-3</strong>
                        <span style="font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(63,185,80,0.2); color:#3fb950; font-weight:800;">✓ 48% BALANCED</span>
                    </div>
                    <div style="height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden; margin-bottom:8px;">
                        <div style="width:48%; height:100%; background:#3fb950; border-radius:6px;"></div>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); display:flex; justify-content:space-between;">
                        <span>Đã dùng: <strong>240 GB / 500 GB</strong></span>
                        <span style="color:#3fb950; font-weight:700;">Cân bằng hoàn hảo</span>
                    </div>
                </div>
            </div>
        `;
    }
}

function runHdfsBalancer() {
    if (balancerRunning) return;
    balancerRunning = true;
    const btn = document.getElementById('btnRunBalancer');
    const logBox = document.getElementById('balancerLogConsole');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⚖️ Đang di chuyển Blocks cân bằng cụm...';
    }

    if (logBox) {
        logBox.innerHTML = `
            <div style="color:#58a6ff;">$ hdfs balancer -threshold 10</div>
            <div style="color:var(--text-muted);">[INFO] Connecting to NameNode at localhost/127.0.0.1:9000...</div>
            <div style="color:var(--text-muted);">[INFO] Cluster Utilization: 48.00%</div>
            <div style="color:#d29922;">[WARN] DataNode-1 (192.168.1.101) is OVER-UTILIZED: 88.00% (Threshold is 10%)</div>
            <div style="color:#388bfd;">[INFO] Moving 100 GB (800 blocks) from DataNode-1 to DataNode-2 (192.168.1.102)...</div>
            <div style="color:#388bfd;">[INFO] Moving 100 GB (800 blocks) from DataNode-1 to DataNode-3 (192.168.1.103)...</div>
        `;
    }

    setTimeout(() => {
        isBalanced = true;
        balancerRunning = false;
        renderBalancerState();

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔄 Đặt lại trạng thái lệch tải (Reset)';
            btn.onclick = resetBalancerState;
        }

        if (logBox) {
            logBox.innerHTML += `
                <div style="color:#3fb950; font-weight:bold;">[SUCCESS] Balancing succeeded! All DataNodes are within threshold 10% (Each Node ~48%).</div>
                <div style="color:#56d364;">[COMPLETE] Re-balancing 1,600 HDFS Blocks finished in 2.4s cleanly!</div>
            `;
        }
        showToast('⚖️ HDFS Balancer đã cân bằng dung lượng 3 DataNodes thành công!', 'success');
    }, 2000);
}

function resetBalancerState() {
    isBalanced = false;
    renderBalancerState();
    const btn = document.getElementById('btnRunBalancer');
    const logBox = document.getElementById('balancerLogConsole');
    if (btn) {
        btn.innerHTML = '⚖️ Run "hdfs balancer -threshold 10"';
        btn.onclick = runHdfsBalancer;
    }
    if (logBox) {
        logBox.innerHTML = '<div style="color:var(--text-muted);">Nhấn nút ở trên để mô phỏng lệnh hdfs balancer...</div>';
    }
    showToast('Đã đặt lại trạng thái lệch đĩa ban đầu', 'info');
}

// Auto init on load
document.addEventListener('DOMContentLoaded', () => {
    renderRackTopology();
    renderBalancerState();
});
