package com.hdfs.clouddrive.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * FileMetadata - Entity tương ứng với bảng `files` trong MySQL
 *
 * =====================================================
 * ĐIỂM QUAN TRỌNG - Giải thích cho người nghe:
 * =====================================================
 * MySQL chỉ lưu METADATA của file, bao gồm:
 *   - Tên file (fileName)
 *   - Đường dẫn file trên HDFS (filePath)  ← quan trọng
 *   - Kích thước (fileSize)
 *   - Loại file (contentType)
 *   - Người upload (uploadedBy)
 *   - Thời gian upload (uploadedAt)
 *
 * NỘI DUNG FILE THỰC TẾ được lưu trên HDFS tại filePath.
 * Khi người dùng download, hệ thống đọc filePath từ MySQL,
 * sau đó dùng đường dẫn đó để đọc file từ HDFS.
 */
@Entity
@Table(name = "files")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FileMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Tên file gốc (ví dụ: test.pdf) */
    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    /** Đường dẫn file trên HDFS (ví dụ: /cloud-drive/test.pdf) */
    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    /** Kích thước file (bytes) */
    @Column(name = "file_size")
    private Long fileSize;

    /** MIME type (ví dụ: application/pdf, image/jpeg) */
    @Column(name = "content_type", length = 100)
    private String contentType;

    /** Username của người đã upload */
    @Column(name = "uploaded_by", length = 50)
    private String uploadedBy;

    /** Thời gian upload */
    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;
}
