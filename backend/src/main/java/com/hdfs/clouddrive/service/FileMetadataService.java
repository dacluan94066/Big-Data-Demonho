package com.hdfs.clouddrive.service;

import com.hdfs.clouddrive.dto.FileResponse;
import com.hdfs.clouddrive.model.FileMetadata;
import com.hdfs.clouddrive.repository.FileMetadataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * FileMetadataService - Xử lý CRUD cho metadata file trong MySQL
 *
 * Vai trò của MySQL trong hệ thống:
 * - Lưu metadata: tên file, đường dẫn HDFS, kích thước, loại file, ...
 * - Cho phép tìm kiếm, lọc file nhanh chóng
 * - KHÔNG lưu nội dung file (file lưu trên HDFS)
 *
 * Khi người dùng download file:
 * 1. Truy vấn MySQL lấy filePath (đường dẫn HDFS)
 * 2. Dùng filePath để đọc file từ HDFS
 * 3. Stream file về cho client
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileMetadataService {

    private final FileMetadataRepository fileMetadataRepository;

    /** Lưu metadata mới vào MySQL */
    public FileMetadata save(FileMetadata fileMetadata) {
        if (fileMetadata.getUploadedAt() == null) {
            fileMetadata.setUploadedAt(LocalDateTime.now());
        }
        FileMetadata saved = fileMetadataRepository.save(fileMetadata);
        log.info("[MySQL] File metadata saved: id={}, path={}", saved.getId(), saved.getFilePath());
        return saved;
    }

    /** Tìm metadata theo ID */
    public Optional<FileMetadata> findById(Long id) {
        return fileMetadataRepository.findById(id);
    }

    /** Lấy tất cả file metadata, sắp xếp mới nhất trước */
    public List<FileMetadata> findAll() {
        return fileMetadataRepository.findAllByOrderByUploadedAtDesc();
    }

    /** Xóa metadata khỏi MySQL (file trên HDFS đã xóa trước đó) */
    public void deleteById(Long id) {
        fileMetadataRepository.deleteById(id);
        log.info("[MySQL] File metadata deleted: id={}", id);
    }

    /** Tổng số file */
    public long getTotalFileCount() {
        return fileMetadataRepository.count();
    }

    /** Tổng dung lượng tất cả file (bytes) */
    public long getTotalStorageBytes() {
        Long total = fileMetadataRepository.sumFileSize();
        return total != null ? total : 0L;
    }

    /** Convert Entity → DTO để trả về API */
    public FileResponse toResponse(FileMetadata metadata) {
        FileResponse response = new FileResponse();
        response.setId(metadata.getId());
        response.setFileName(metadata.getFileName());
        response.setFilePath(metadata.getFilePath());
        response.setFileSize(metadata.getFileSize());
        response.setContentType(metadata.getContentType());
        response.setUploadedBy(metadata.getUploadedBy());
        response.setUploadedAt(metadata.getUploadedAt());
        response.setFormattedSize(formatFileSize(metadata.getFileSize()));
        return response;
    }

    /** Format bytes thành chuỗi dễ đọc */
    private String formatFileSize(Long bytes) {
        if (bytes == null || bytes == 0) return "0 B";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024L * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }
}
