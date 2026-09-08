package com.hdfs.clouddrive.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * FileResponse - DTO trả về thông tin file
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FileResponse {
    private Long id;
    private String fileName;
    private String filePath;       // Đường dẫn HDFS
    private Long fileSize;
    private String contentType;
    private String uploadedBy;
    private LocalDateTime uploadedAt;
    private String formattedSize;  // Kích thước đã format (ví dụ: 1.5 MB)
}
