/**
 * Apache Hadoop MapReduce Engine Simulator JavaScript
 */

function executeMapReduceJob(fileNameParam, fileSizeParam) {
    const container = document.getElementById('mapreduceResultsContainer');
    if (!container) return;

    let fileName = fileNameParam;
    let fileSize = fileSizeParam;

    if (!fileName) {
        const select = document.getElementById('mrDatasetSelect');
        if (select && select.value) {
            const parts = select.value.split('|');
            fileName = parts[0];
            fileSize = parseInt(parts[1]) || 316043776;
        } else {
            fileName = 'BigData_WebLogs_Dataset_2026.csv';
            fileSize = 316043776;
        }
    }

    // Show Loading state
    container.innerHTML = `
        <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:16px; padding:32px; text-align:center;">
            <div class="spinner" style="width:36px; height:36px; border-width:3px; margin:0 auto 16px;"></div>
            <h4 style="font-size:16px; color:#58a6ff; font-weight:700;">⚡ Khởi tạo MapReduce Job trên Cluster...</h4>
            <p style="font-size:13px; color:var(--text-secondary);">Phân bổ HDFS Input Splits & Gửi MapTasks tới các DataNodes...</p>
        </div>
    `;

    fetch('/api/mapreduce/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileName, fileSize: fileSize })
    })
    .then(res => res.json())
    .then(data => {
        renderMapReduceResults(data);
    })
    .catch(err => {
        console.error("MapReduce Execution Error:", err);
        showToast("Lỗi khởi chạy MapReduce Job", "error");
    });
}

function renderMapReduceResults(data) {
    const container = document.getElementById('mapreduceResultsContainer');
    if (!container) return;

    const mappersHtml = data.mappers.map((m, idx) => `
        <div style="background:rgba(13,17,23,0.9); border:1px solid rgba(88,166,255,0.25); border-radius:12px; padding:16px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="background:rgba(88,166,255,0.15); color:#58a6ff; font-weight:700; font-size:12px; padding:4px 10px; border-radius:6px;">
                        📌 Mapper #${idx + 1} (${m.mapperId})
                    </span>
                    <strong style="color:var(--text-primary); font-size:13px;">${m.blockId}</strong>
                </div>
                <span class="tech-badge badge-mysql" style="font-size:11px;">📍 ${m.node} (${m.nodeIp})</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; font-size:12px; color:var(--text-secondary); margin-top:8px;">
                <div>📦 Kích thước Block: <strong style="color:var(--text-primary);">${formatBytes(m.blockSize)}</strong></div>
                <div>📊 Bản ghi đã quét: <strong style="color:var(--success);">${m.recordsProcessed.toLocaleString()} rows</strong></div>
                <div>⏱️ Thời gian Mapper: <strong style="color:#e3b341;">${m.mapTimeMs} ms</strong></div>
                <div>🛡️ Data Locality: <strong style="color:#58a6ff;">✓ NODE_LOCAL</strong></div>
            </div>
            <div style="margin-top:10px; background:rgba(48,54,61,0.4); border-radius:6px; height:6px; overflow:hidden;">
                <div style="background:linear-gradient(90deg, #1f6feb, #388bfd); height:100%; width:100%; transition:width 1s ease;"></div>
            </div>
        </div>
    `).join('');

    const statusCounts = data.analytics.httpStatusCounts;
    const topIPs = data.analytics.topIPs;
    const perf = data.analytics.performance;

    container.innerHTML = `
        <!-- Job Execution Overview Banner -->
        <div style="background:rgba(13,17,23,0.9); border:1px solid rgba(63,185,80,0.3); border-radius:16px; padding:20px; margin-bottom:24px; box-shadow:0 8px 24px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                <div>
                    <div style="font-size:11px; text-transform:uppercase; color:var(--success); font-weight:700; letter-spacing:0.5px;">✓ MAPREDUCE JOB COMPLETED SUCCESSFULLY</div>
                    <h3 style="font-size:18px; font-weight:800; color:white; margin:4px 0;">${data.jobName}</h3>
                    <div style="font-size:12px; color:var(--text-secondary);">
                        JobID: <code>${data.jobId}</code> | File: <strong>${data.filename}</strong> (${data.fileSizeFormatted})
                    </div>
                </div>
                <div style="display:flex; gap:16px; flex-wrap:wrap;">
                    <div style="background:rgba(88,166,255,0.1); border:1px solid rgba(88,166,255,0.25); padding:10px 16px; border-radius:12px; text-align:center;">
                        <div style="font-size:11px; color:var(--text-muted);">Tốc độ MapReduce</div>
                        <div style="font-size:20px; font-weight:800; color:#58a6ff;">${perf.hdfsMapReduceTimeSec}s</div>
                    </div>
                    <div style="background:rgba(227,179,65,0.1); border:1px solid rgba(227,179,65,0.25); padding:10px 16px; border-radius:12px; text-align:center;">
                        <div style="font-size:11px; color:var(--text-muted);">Xử lý đơn máy (Single Node)</div>
                        <div style="font-size:20px; font-weight:800; color:#e3b341;">${perf.singleNodeTimeSec}s</div>
                    </div>
                    <div style="background:rgba(63,185,80,0.15); border:1px solid rgba(63,185,80,0.3); padding:10px 16px; border-radius:12px; text-align:center;">
                        <div style="font-size:11px; color:var(--text-muted);">Tăng tốc (Speedup)</div>
                        <div style="font-size:20px; font-weight:800; color:#3fb950;">${perf.speedupFactor}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 4-Phase MapReduce Pipeline Visualizer -->
        <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:16px; padding:20px; margin-bottom:24px;">
            <h4 style="font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:16px;">
                🔄 Luồng xử lý 4 Giai đoạn MapReduce (Distributed Execution Pipeline)
            </h4>
            
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;">
                <div style="background:#0d1117; border:1px solid var(--border); border-radius:10px; padding:14px;">
                    <div style="color:#58a6ff; font-weight:700; font-size:12px;">1. INPUT SPLIT</div>
                    <div style="font-size:18px; font-weight:700; color:white; margin:4px 0;">${data.numBlocks} Blocks</div>
                    <div style="font-size:11px; color:var(--text-muted);">Chiến lược 128MB / Block</div>
                </div>
                <div style="background:#0d1117; border:1px solid var(--border); border-radius:10px; padding:14px;">
                    <div style="color:#bc8cff; font-weight:700; font-size:12px;">2. MAP PHASE</div>
                    <div style="font-size:18px; font-weight:700; color:white; margin:4px 0;">${data.mappers.length} Parallel Mappers</div>
                    <div style="font-size:11px; color:var(--text-muted);">Data Locality = 100%</div>
                </div>
                <div style="background:#0d1117; border:1px solid var(--border); border-radius:10px; padding:14px;">
                    <div style="color:#e3b341; font-weight:700; font-size:12px;">3. SHUFFLE & SORT</div>
                    <div style="font-size:18px; font-weight:700; color:white; margin:4px 0;">${data.shuffleTimeMs} ms</div>
                    <div style="font-size:11px; color:var(--text-muted);">Phân vùng Key-Value</div>
                </div>
                <div style="background:#0d1117; border:1px solid var(--border); border-radius:10px; padding:14px;">
                    <div style="color:#3fb950; font-weight:700; font-size:12px;">4. REDUCE PHASE</div>
                    <div style="font-size:18px; font-weight:700; color:white; margin:4px 0;">${data.reduceTasks.length} Reducers</div>
                    <div style="font-size:11px; color:var(--text-muted);">Tổng hợp dữ liệu kết quả</div>
                </div>
            </div>

            <!-- Mappers Detail Breakdown -->
            <div style="margin-top:16px;">
                <h5 style="font-size:13px; font-weight:700; color:var(--text-secondary); margin-bottom:12px;">
                    🧩 Chi tiết các MapTasks chạy song song trên DataNodes:
                </h5>
                ${mappersHtml}
            </div>
        </div>

        <!-- Log Analytics Output Results -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
            <!-- HTTP Status Distribution -->
            <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:16px; padding:20px;">
                <h4 style="font-size:15px; font-weight:700; color:#58a6ff; margin-bottom:14px;">
                    📊 Kết quả Thống kê HTTP Response Codes (Reducer Output)
                </h4>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">
                            <span style="color:#3fb950;">✓ 200 OK</span>
                            <span>${statusCounts['200 OK'].toLocaleString()} requests (83.8%)</span>
                        </div>
                        <div style="background:var(--bg-tertiary); height:8px; border-radius:4px; overflow:hidden;">
                            <div style="background:#3fb950; height:100%; width:83.8%;"></div>
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">
                            <span style="color:#58a6ff;">ℹ️ 301 Moved Permanently</span>
                            <span>${statusCounts['301 Moved Permanently'].toLocaleString()} requests (8.1%)</span>
                        </div>
                        <div style="background:var(--bg-tertiary); height:8px; border-radius:4px; overflow:hidden;">
                            <div style="background:#58a6ff; height:100%; width:8.1%;"></div>
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">
                            <span style="color:#e3b341;">⚠️ 404 Not Found</span>
                            <span>${statusCounts['404 Not Found'].toLocaleString()} requests (6.6%)</span>
                        </div>
                        <div style="background:var(--bg-tertiary); height:8px; border-radius:4px; overflow:hidden;">
                            <div style="background:#e3b341; height:100%; width:6.6%;"></div>
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">
                            <span style="color:#f85149;">🚨 500 Internal Server Error</span>
                            <span>${statusCounts['500 Internal Server Error'].toLocaleString()} requests (1.4%)</span>
                        </div>
                        <div style="background:var(--bg-tertiary); height:8px; border-radius:4px; overflow:hidden;">
                            <div style="background:#f85149; height:100%; width:1.4%;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Top Client IPs -->
            <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:16px; padding:20px;">
                <h4 style="font-size:15px; font-weight:700; color:#bc8cff; margin-bottom:14px;">
                    🌐 Top IP Truy Cập Cao Nhất (Reducer Key Aggregation)
                </h4>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${topIPs.map((ip, i) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#0d1117; padding:10px 14px; border-radius:8px; font-size:12px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="color:var(--text-muted); font-weight:700;">#${i+1}</span>
                                <strong style="font-family:monospace; color:white;">${ip.ip}</strong>
                                <span style="font-size:11px; color:var(--text-secondary);">${ip.country}</span>
                            </div>
                            <span style="color:#bc8cff; font-weight:700;">${ip.requests.toLocaleString()} reqs</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}
