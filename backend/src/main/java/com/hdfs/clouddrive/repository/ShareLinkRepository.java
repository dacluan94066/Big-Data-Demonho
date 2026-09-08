package com.hdfs.clouddrive.repository;

import com.hdfs.clouddrive.model.ShareLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShareLinkRepository extends JpaRepository<ShareLink, Long> {

    /** Tìm share link theo token UUID */
    Optional<ShareLink> findByShareToken(String shareToken);

    /** Lấy tất cả share links của một file */
    List<ShareLink> findByFile_IdOrderByCreatedAtDesc(Long fileId);

    /** Lấy tất cả share links của một user */
    List<ShareLink> findByCreatedByOrderByCreatedAtDesc(String createdBy);
}
