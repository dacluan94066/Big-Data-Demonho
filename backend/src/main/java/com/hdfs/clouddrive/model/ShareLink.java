package com.hdfs.clouddrive.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * ShareLink - Entity tương ứng với bảng `share_links` trong MySQL
 *
 * Lưu thông tin về các link chia sẻ file.
 * Người dùng có thể tạo link và chia sẻ cho người khác mà không cần đăng nhập.
 */
@Entity
@Table(name = "share_links")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShareLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** File được chia sẻ */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "file_id", nullable = false)
    private FileMetadata file;

    /** Token duy nhất (UUID) - dùng trong URL chia sẻ */
    @Column(name = "share_token", nullable = false, unique = true, length = 36)
    private String shareToken;

    /** Người tạo link */
    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /** Thời gian hết hạn (null = không hết hạn) */
    @Column(name = "expired_at")
    private LocalDateTime expiredAt;
}
