package com.hdfs.clouddrive.service;

import com.hdfs.clouddrive.model.FileMetadata;
import com.hdfs.clouddrive.model.ShareLink;
import com.hdfs.clouddrive.repository.FileMetadataRepository;
import com.hdfs.clouddrive.repository.ShareLinkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * ShareService - Xử lý tạo và quản lý share link
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShareService {

    private final ShareLinkRepository shareLinkRepository;
    private final FileMetadataRepository fileMetadataRepository;

    /**
     * Tạo link chia sẻ cho file
     *
     * @param fileId      ID file cần share
     * @param createdBy   Username người tạo link
     * @param expireHours Số giờ link còn hiệu lực (null = không hết hạn)
     * @return ShareLink đã tạo
     */
    public ShareLink createShareLink(Long fileId, String createdBy, Integer expireHours) {
        FileMetadata file = fileMetadataRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("File not found: " + fileId));

        ShareLink shareLink = new ShareLink();
        shareLink.setFile(file);
        shareLink.setShareToken(UUID.randomUUID().toString()); // Token ngẫu nhiên duy nhất
        shareLink.setCreatedBy(createdBy);
        shareLink.setCreatedAt(LocalDateTime.now());

        // Thời gian hết hạn
        if (expireHours != null && expireHours > 0) {
            shareLink.setExpiredAt(LocalDateTime.now().plusHours(expireHours));
        } else {
            // Mặc định 7 ngày
            shareLink.setExpiredAt(LocalDateTime.now().plusDays(7));
        }

        ShareLink saved = shareLinkRepository.save(shareLink);
        log.info("[Share] Link created: token={} for file: {}", saved.getShareToken(), file.getFileName());
        return saved;
    }

    /**
     * Tìm share link theo token
     */
    public Optional<ShareLink> findByToken(String token) {
        return shareLinkRepository.findByShareToken(token);
    }

    /**
     * Kiểm tra share link còn hiệu lực không
     */
    public boolean isValid(ShareLink shareLink) {
        if (shareLink.getExpiredAt() == null) return true;
        return LocalDateTime.now().isBefore(shareLink.getExpiredAt());
    }

    /**
     * Lấy tất cả share links của một user
     */
    public List<ShareLink> getShareLinksByUser(String username) {
        return shareLinkRepository.findByCreatedByOrderByCreatedAtDesc(username);
    }

    /**
     * Lấy tất cả share links của một file
     */
    public List<ShareLink> getShareLinksForFile(Long fileId) {
        return shareLinkRepository.findByFile_IdOrderByCreatedAtDesc(fileId);
    }
}
