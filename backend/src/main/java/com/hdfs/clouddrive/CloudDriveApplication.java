package com.hdfs.clouddrive;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * HDFS Cloud Drive Demo Application
 *
 * Kiến trúc hệ thống:
 *   User → Frontend → Spring Boot REST API → HDFS (lưu file) + MySQL (lưu metadata)
 *
 * Điểm quan trọng:
 *   - File THỰC TẾ được lưu trên Apache HDFS (/cloud-drive/)
 *   - MySQL chỉ lưu METADATA (tên file, kích thước, đường dẫn HDFS, ...)
 */
@SpringBootApplication
public class CloudDriveApplication {

    public static void main(String[] args) {
        SpringApplication.run(CloudDriveApplication.class, args);
    }
}
