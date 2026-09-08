package com.hdfs.clouddrive.controller;

import com.hdfs.clouddrive.model.ShareLink;
import com.hdfs.clouddrive.service.HdfsService;
import com.hdfs.clouddrive.service.ShareService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

/**
 * ShareController - Xử lý truy cập file qua share link
 *
 * API:
 *   GET /api/share/{token}       → Download file từ share link
 *   GET /api/share/{token}/info  → Xem thông tin share link (không download)
 */
@Slf4j
@RestController
@RequestMapping("/api/share")
@RequiredArgsConstructor
public class ShareController {

    private final ShareService shareService;
    private final HdfsService hdfsService;

    /**
     * GET /api/share/{token}
     *
     * Cho phép download file mà không cần đăng nhập.
     * Quy trình:
     * 1. Tìm ShareLink theo token trong MySQL
     * 2. Kiểm tra link còn hiệu lực không
     * 3. Đọc file từ HDFS theo filePath trong metadata
     * 4. Stream file về browser
     */
    @GetMapping("/{token}")
    public ResponseEntity<byte[]> accessSharedFile(@PathVariable String token) {
        log.info("[Share] Accessing shared file with token: {}", token);

        Optional<ShareLink> shareLinkOpt = shareService.findByToken(token);

        if (shareLinkOpt.isEmpty()) {
            log.warn("[Share] Token not found: {}", token);
            return ResponseEntity.notFound().build();
        }

        ShareLink shareLink = shareLinkOpt.get();

        // Kiểm tra link đã hết hạn chưa
        if (!shareService.isValid(shareLink)) {
            log.warn("[Share] Token expired: {}", token);
            return ResponseEntity.status(HttpStatus.GONE)
                    .body("Link chia sẻ này đã hết hạn.".getBytes());
        }

        try {
            String hdfsPath = shareLink.getFile().getFilePath();
            String fileName = shareLink.getFile().getFileName();
            String contentType = shareLink.getFile().getContentType();

            log.info("[Share] Downloading shared file: {} from HDFS: {}", fileName, hdfsPath);

            // Đọc file từ HDFS (không từ MySQL)
            byte[] data = hdfsService.downloadFile(hdfsPath);

            if (contentType == null) {
                contentType = "application/octet-stream";
            }

            log.info("[Share] ✓ Shared file served: {} ({} bytes)", fileName, data.length);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .contentLength(data.length)
                    .body(data);

        } catch (IOException e) {
            log.error("[Share] Download failed for token {}: {}", token, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/share/{token}/info
     * Lấy thông tin về share link (metadata) - không download file
     */
    @GetMapping("/{token}/info")
    public ResponseEntity<?> getShareInfo(@PathVariable String token) {
        Optional<ShareLink> shareLinkOpt = shareService.findByToken(token);

        if (shareLinkOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        ShareLink shareLink = shareLinkOpt.get();
        boolean valid = shareService.isValid(shareLink);

        return ResponseEntity.ok(Map.of(
                "fileName", shareLink.getFile().getFileName(),
                "fileSize", shareLink.getFile().getFileSize(),
                "contentType", shareLink.getFile().getContentType() != null ?
                        shareLink.getFile().getContentType() : "unknown",
                "createdBy", shareLink.getCreatedBy() != null ? shareLink.getCreatedBy() : "unknown",
                "createdAt", shareLink.getCreatedAt().toString(),
                "expiredAt", shareLink.getExpiredAt() != null ?
                        shareLink.getExpiredAt().toString() : "Không hết hạn",
                "isValid", valid,
                "status", valid ? "ACTIVE" : "EXPIRED"
        ));
    }
}
