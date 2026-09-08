-- =====================================================
-- HDFS Cloud Drive Demo - Database Schema
-- =====================================================
-- Chạy file này bằng MySQL Workbench hoặc:
--   mysql -u root -p < schema.sql
-- =====================================================

CREATE DATABASE IF NOT EXISTS hdfs_cloud_drive
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE hdfs_cloud_drive;

-- =====================================================
-- Bảng users: Thông tin người dùng
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50)  NOT NULL UNIQUE COMMENT 'Tên đăng nhập',
    password   VARCHAR(255) NOT NULL           COMMENT 'Mật khẩu (demo: plain text)',
    full_name  VARCHAR(100)                    COMMENT 'Họ tên đầy đủ',
    email      VARCHAR(100)                    COMMENT 'Email',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo tài khoản'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Bảng người dùng';

-- =====================================================
-- Bảng files: METADATA của file
--
-- !! QUAN TRỌNG !!
-- Bảng này CHỈ lưu metadata, KHÔNG lưu nội dung file.
-- Nội dung file thực tế được lưu trên HDFS tại file_path.
-- =====================================================
CREATE TABLE IF NOT EXISTS files (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    file_name    VARCHAR(255) NOT NULL COMMENT 'Tên file gốc (ví dụ: test.pdf)',
    file_path    VARCHAR(500) NOT NULL COMMENT 'Đường dẫn HDFS (ví dụ: /cloud-drive/test.pdf)',
    file_size    BIGINT               COMMENT 'Kích thước file (bytes)',
    content_type VARCHAR(100)         COMMENT 'MIME type (ví dụ: application/pdf)',
    uploaded_by  VARCHAR(50)          COMMENT 'Username người upload',
    uploaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian upload',

    INDEX idx_uploaded_by  (uploaded_by),
    INDEX idx_uploaded_at  (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Metadata của file - Nội dung file lưu trên HDFS';

-- =====================================================
-- Bảng share_links: Link chia sẻ file
-- =====================================================
CREATE TABLE IF NOT EXISTS share_links (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    file_id     BIGINT      NOT NULL               COMMENT 'ID file được chia sẻ',
    share_token VARCHAR(36) NOT NULL UNIQUE         COMMENT 'Token UUID duy nhất',
    created_by  VARCHAR(50)                         COMMENT 'Người tạo link',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
    expired_at  TIMESTAMP                           COMMENT 'Ngày hết hạn (NULL = không hết hạn)',

    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    INDEX idx_share_token (share_token),
    INDEX idx_file_id     (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Link chia sẻ file công khai';

SELECT 'Schema created successfully!' AS result;
