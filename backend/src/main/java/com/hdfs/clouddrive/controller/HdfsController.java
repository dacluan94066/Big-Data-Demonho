package com.hdfs.clouddrive.controller;

import com.hdfs.clouddrive.service.FileMetadataService;
import com.hdfs.clouddrive.service.HdfsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * HdfsController - API trả về thông tin trạng thái HDFS
 *
 * Dùng trong trang /hdfs-status để demo:
 * - HDFS có đang chạy không
 * - Capacity, Used, Remaining
 * - Số DataNode
 * - Danh sách file trên HDFS
 */
@Slf4j
@RestController
@RequestMapping("/api/hdfs")
@RequiredArgsConstructor
public class HdfsController {

    private final HdfsService hdfsService;
    private final FileMetadataService fileMetadataService;

    /**
     * GET /api/hdfs/status
     *
     * Trả về:
     * - connected: true/false
     * - nameNode: địa chỉ NameNode
     * - hdfsRoot: thư mục gốc trên HDFS
     * - capacityBytes, usedBytes, remainingBytes
     * - dataNodeCount: số DataNode đang active
     * - files: danh sách file trong /cloud-drive
     * - totalFilesInMySQL: số file trong MySQL
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getHdfsStatus() {
        log.info("[HDFS Status] Getting cluster status...");

        // Lấy thông tin cluster từ HDFS
        Map<String, Object> status = hdfsService.getClusterStatus();

        // Thêm thông tin thống kê từ MySQL
        status.put("totalFilesInMySQL", fileMetadataService.getTotalFileCount());
        status.put("totalStorageBytesInMySQL", fileMetadataService.getTotalStorageBytes());

        // Lấy danh sách file trên HDFS /cloud-drive
        try {
            List<Map<String, Object>> files = hdfsService.listFiles(hdfsService.getHdfsRootPath());
            status.put("files", files);
            status.put("fileCountOnHdfs", files.size());
        } catch (Exception e) {
            status.put("files", List.of());
            status.put("fileCountOnHdfs", 0);
            log.warn("[HDFS Status] Cannot list files: {}", e.getMessage());
        }

        return ResponseEntity.ok(status);
    }

    /**
     * GET /api/hdfs/files
     * Liệt kê file trong HDFS root directory
     */
    @GetMapping("/files")
    public ResponseEntity<?> listHdfsFiles() {
        try {
            List<Map<String, Object>> files = hdfsService.listFiles(hdfsService.getHdfsRootPath());
            return ResponseEntity.ok(Map.of(
                    "path", hdfsService.getHdfsRootPath(),
                    "files", files,
                    "count", files.size()
            ));
        } catch (Exception e) {
            log.error("[HDFS Files] Error: {}", e.getMessage());
            return ResponseEntity.ok(Map.of(
                    "path", hdfsService.getHdfsRootPath(),
                    "files", List.of(),
                    "count", 0,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * GET /api/hdfs/ping
     * Kiểm tra kết nối HDFS đơn giản
     */
    @GetMapping("/ping")
    public ResponseEntity<?> ping() {
        Map<String, Object> clusterStatus = hdfsService.getClusterStatus();
        boolean connected = Boolean.TRUE.equals(clusterStatus.get("connected"));
        return ResponseEntity.ok(Map.of(
                "status", connected ? "CONNECTED" : "DISCONNECTED",
                "message", connected ? "HDFS đang hoạt động bình thường" : "Không thể kết nối HDFS"
        ));
    }
}
