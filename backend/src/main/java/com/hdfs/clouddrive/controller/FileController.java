package com.hdfs.clouddrive.controller;

import com.hdfs.clouddrive.dto.FileResponse;
import com.hdfs.clouddrive.model.FileMetadata;
import com.hdfs.clouddrive.model.ShareLink;
import com.hdfs.clouddrive.service.FileMetadataService;
import com.hdfs.clouddrive.service.HdfsService;
import com.hdfs.clouddrive.service.ShareService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * FileController - REST API xử lý upload, download, delete file
 *
 * API Endpoints:
 *   POST   /api/files/upload          → Upload file lên HDFS + lưu metadata MySQL
 *   GET    /api/files                 → Lấy danh sách file (metadata từ MySQL)
 *   GET    /api/files/{id}            → Lấy thông tin file theo ID
 *   GET    /api/files/{id}/download   → Download file từ HDFS
 *   DELETE /api/files/{id}            → Xóa file khỏi HDFS + MySQL
 *   POST   /api/files/{id}/share      → Tạo share link
 *   GET    /api/files/stats           → Thống kê tổng quan
 */
@Slf4j
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final HdfsService hdfsService;
    private final FileMetadataService fileMetadataService;
    private final ShareService shareService;

    // ===========================================
    // UPLOAD FILE
    // ===========================================

    /**
     * POST /api/files/upload
     *
     * Quy trình xử lý:
     * 1. Nhận MultipartFile từ Frontend
     * 2. Kiểm tra file hợp lệ
     * 3. Upload file lên HDFS tại /cloud-drive/{filename}
     * 4. Lưu metadata vào MySQL
     * 5. Trả về thông tin file đã upload
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "X-Username", defaultValue = "admin") String username) {

        // Kiểm tra file không rỗng
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Không thể upload file rỗng"));
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Tên file không hợp lệ"));
        }

        // Làm sạch tên file (xóa ký tự đặc biệt)
        String safeFilename = originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
        String hdfsPath = hdfsService.getHdfsRootPath() + "/" + safeFilename;

        log.info("[Upload] User '{}' uploading '{}' → HDFS: {}", username, originalFilename, hdfsPath);

        try {
            // ==========================================
            // BƯỚC 1: Upload file thực tế lên HDFS
            // ==========================================
            hdfsService.uploadFile(hdfsPath, file.getInputStream());
            log.info("[Upload] ✓ File uploaded to HDFS: {}", hdfsPath);

            // ==========================================
            // BƯỚC 2: Lưu METADATA vào MySQL
            // Không lưu nội dung file - chỉ lưu metadata!
            // ==========================================
            FileMetadata metadata = new FileMetadata();
            metadata.setFileName(originalFilename);
            metadata.setFilePath(hdfsPath);          // Đường dẫn trên HDFS
            metadata.setFileSize(file.getSize());
            metadata.setContentType(file.getContentType());
            metadata.setUploadedBy(username);

            FileMetadata saved = fileMetadataService.save(metadata);
            log.info("[Upload] ✓ Metadata saved to MySQL: id={}", saved.getId());

            return ResponseEntity.ok(Map.of(
                    "message", "Upload thành công",
                    "file", fileMetadataService.toResponse(saved),
                    "hdfsPath", hdfsPath,
                    "info", "File đã được lưu lên HDFS tại: " + hdfsPath
            ));

        } catch (IOException e) {
            log.error("[Upload] Failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "error", "Upload thất bại: " + e.getMessage(),
                            "hint", "Kiểm tra HDFS có đang chạy không tại http://localhost:9870"
                    ));
        }
    }

    // ===========================================
    // GET ALL FILES
    // ===========================================

    /**
     * GET /api/files
     * Lấy danh sách file từ MySQL (chỉ metadata, không phải nội dung file)
     */
    @GetMapping
    public ResponseEntity<List<FileResponse>> getAllFiles() {
        List<FileResponse> files = fileMetadataService.findAll().stream()
                .map(fileMetadataService::toResponse)
                .collect(Collectors.toList());
        log.debug("[Files] Returning {} files", files.size());
        return ResponseEntity.ok(files);
    }

    // ===========================================
    // GET FILE BY ID
    // ===========================================

    /**
     * GET /api/files/{id}
     * Lấy thông tin metadata của một file theo ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getFileById(@PathVariable Long id) {
        return fileMetadataService.findById(id)
                .map(file -> ResponseEntity.ok((Object) fileMetadataService.toResponse(file)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "File không tồn tại: " + id)));
    }

    // ===========================================
    // DOWNLOAD FILE FROM HDFS
    // ===========================================

    /**
     * GET /api/files/{id}/download
     *
     * Quy trình download:
     * 1. Tìm metadata trong MySQL → lấy filePath (đường dẫn HDFS)
     * 2. Đọc file từ HDFS theo filePath
     * 3. Stream file về browser
     *
     * File KHÔNG được đọc từ MySQL!
     * MySQL chỉ cung cấp đường dẫn để biết file ở đâu trên HDFS.
     */
    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> downloadFile(@PathVariable Long id) {
        Optional<FileMetadata> fileOpt = fileMetadataService.findById(id);
        if (fileOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        FileMetadata file = fileOpt.get();

        try {
            log.info("[Download] Reading file from HDFS: {}", file.getFilePath());

            // Đọc file từ HDFS - không phải từ MySQL!
            byte[] data = hdfsService.downloadFile(file.getFilePath());

            String contentType = file.getContentType() != null ?
                    file.getContentType() : "application/octet-stream";

            log.info("[Download] ✓ File downloaded: {} ({} bytes)", file.getFileName(), data.length);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + file.getFileName() + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .contentLength(data.length)
                    .body(data);

        } catch (IOException e) {
            log.error("[Download] Failed for {}: {}", file.getFilePath(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // ===========================================
    // DELETE FILE
    // ===========================================

    /**
     * DELETE /api/files/{id}
     *
     * Quy trình xóa:
     * 1. Tìm metadata trong MySQL
     * 2. Xóa file khỏi HDFS
     * 3. Xóa metadata khỏi MySQL
     * (share links sẽ tự xóa do ON DELETE CASCADE)
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFile(@PathVariable Long id) {
        Optional<FileMetadata> fileOpt = fileMetadataService.findById(id);
        if (fileOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "File không tồn tại: " + id));
        }

        FileMetadata file = fileOpt.get();

        try {
            log.info("[Delete] Deleting file: {} from HDFS: {}", file.getFileName(), file.getFilePath());

            // Bước 1: Xóa file khỏi HDFS
            hdfsService.deleteFile(file.getFilePath());
            log.info("[Delete] ✓ File deleted from HDFS");

            // Bước 2: Xóa metadata khỏi MySQL
            fileMetadataService.deleteById(id);
            log.info("[Delete] ✓ Metadata deleted from MySQL");

            return ResponseEntity.ok(Map.of(
                    "message", "Xóa file thành công",
                    "deletedFile", file.getFileName()
            ));

        } catch (IOException e) {
            log.error("[Delete] Failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Xóa file thất bại: " + e.getMessage()));
        }
    }

    // ===========================================
    // SHARE FILE
    // ===========================================

    /**
     * POST /api/files/{id}/share
     * Tạo link chia sẻ file (có thể mở không cần đăng nhập)
     */
    @PostMapping("/{id}/share")
    public ResponseEntity<?> shareFile(
            @PathVariable Long id,
            @RequestHeader(value = "X-Username", defaultValue = "admin") String username) {

        if (fileMetadataService.findById(id).isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "File không tồn tại: " + id));
        }

        try {
            // Tạo share link với thời hạn 7 ngày
            ShareLink shareLink = shareService.createShareLink(id, username, 24 * 7);

            String shareUrl = "/api/share/" + shareLink.getShareToken();

            return ResponseEntity.ok(Map.of(
                    "shareToken", shareLink.getShareToken(),
                    "shareUrl", shareUrl,
                    "fullUrl", "http://localhost:8080" + shareUrl,
                    "expiredAt", shareLink.getExpiredAt().toString(),
                    "message", "Link chia sẻ đã được tạo (có hiệu lực 7 ngày)"
            ));

        } catch (Exception e) {
            log.error("[Share] Failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Tạo share link thất bại: " + e.getMessage()));
        }
    }

    // ===========================================
    // STATS
    // ===========================================

    /**
     * GET /api/files/stats
     * Thống kê tổng quan
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        long totalFiles = fileMetadataService.getTotalFileCount();
        long totalBytes = fileMetadataService.getTotalStorageBytes();

        return ResponseEntity.ok(Map.of(
                "totalFiles", totalFiles,
                "totalStorageBytes", totalBytes,
                "totalStorageFormatted", formatBytes(totalBytes)
        ));
    }

    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024L * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }
}
