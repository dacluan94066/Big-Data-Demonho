-- =====================================================
-- HDFS Cloud Drive Demo - Sample Data
-- =====================================================
-- Chạy file này SAU KHI đã chạy schema.sql:
--   mysql -u root -p < data.sql
-- =====================================================

USE hdfs_cloud_drive;

-- Xóa dữ liệu cũ (demo reset)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE share_links;
TRUNCATE TABLE files;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- Demo Users
-- =====================================================
INSERT INTO users (username, password, full_name, email, created_at) VALUES
('admin',  '123456',  'Administrator',  'admin@hdfs-demo.com',  NOW()),
('demo',   'demo123', 'Demo User',      'demo@hdfs-demo.com',   NOW()),
('hdfs',   'hdfs123', 'HDFS Engineer',  'hdfs@hdfs-demo.com',   NOW());

-- =====================================================
-- Lưu ý:
-- Bảng `files` sẽ được tự động populate khi bạn upload
-- file qua giao diện web hoặc API.
--
-- Để demo nhanh, hãy upload file qua UI sau khi
-- khởi động ứng dụng.
-- =====================================================

SELECT 'Sample data loaded!' AS result;
SELECT CONCAT('Users created: ', COUNT(*), ' users') AS info FROM users;
