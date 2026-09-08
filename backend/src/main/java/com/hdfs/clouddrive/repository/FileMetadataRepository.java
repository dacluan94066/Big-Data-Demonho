package com.hdfs.clouddrive.repository;

import com.hdfs.clouddrive.model.FileMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FileMetadataRepository extends JpaRepository<FileMetadata, Long> {

    /** Lấy danh sách file sắp xếp theo thời gian upload mới nhất */
    List<FileMetadata> findAllByOrderByUploadedAtDesc();

    /** Lấy danh sách file của một user cụ thể */
    List<FileMetadata> findByUploadedByOrderByUploadedAtDesc(String uploadedBy);

    /** Tính tổng dung lượng tất cả file */
    @Query("SELECT COALESCE(SUM(f.fileSize), 0) FROM FileMetadata f")
    Long sumFileSize();
}
