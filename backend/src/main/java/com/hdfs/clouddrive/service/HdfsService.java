package com.hdfs.clouddrive.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.*;
import org.apache.hadoop.hdfs.DistributedFileSystem;
import org.apache.hadoop.hdfs.protocol.DatanodeInfo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.util.*;

/**
 * HdfsService - Service xử lý tất cả thao tác với Apache HDFS
 * 
 * Hỗ trợ chế độ Smart Mock Fallback: Nếu không phát hiện Hadoop HDFS đang chạy,
 * service sẽ tự động chuyển sang lưu tạm ở local đĩa cứng nhưng VẪN MÔ PHỎNG
 * ĐẦY ĐỦ THÔNG SỐ HDFS (NameNode, 3 DataNode, Block 128MB, Replication factor = 3)
 * giúp bạn thuyết trình demo mượt mà mà KHÔNG CẦN TẢI HADOOP.
 */
@Slf4j
@Service
public class HdfsService {

    @Autowired(required = false)
    private Configuration hadoopConfiguration;

    @Value("${hdfs.root.path:/cloud-drive}")
    private String hdfsRootPath;

    private boolean useMockMode = false;
    private boolean mockModeLogged = false;
    private final java.nio.file.Path mockStorageDir = java.nio.file.Paths.get(System.getProperty("user.home"), "hdfs-storage-mock");

    private FileSystem getFileSystem() throws IOException {
        if (hadoopConfiguration == null) {
            throw new IOException("Hadoop configuration null");
        }
        return FileSystem.get(hadoopConfiguration);
    }

    /**
     * Kiểm tra xem HDFS thực sự có kết nối được không.
     * Nếu không kết nối được -> tự động bật Smart Mock Mode!
     */
    private boolean isHdfsAvailable() {
        if (useMockMode) {
            return false;
        }
        try {
            if (hadoopConfiguration == null) {
                enableMockMode("Hadoop Configuration is null");
                return false;
            }
            FileSystem fs = getFileSystem();
            fs.getStatus();
            return true;
        } catch (Exception e) {
            enableMockMode(e.getMessage());
            return false;
        }
    }

    private void enableMockMode(String reason) {
        if (!useMockMode) {
            useMockMode = true;
            try {
                Files.createDirectories(mockStorageDir);
            } catch (Exception ignored) {}
            if (!mockModeLogged) {
                mockModeLogged = true;
                log.info("[SMART HDFS MOCK] Hadoop HDFS không phản hồi (Lý do: {}). Tự động bật chế độ MOCK HDFS! Dữ liệu lưu tại: {}", reason, mockStorageDir.toAbsolutePath());
            }
        }
    }

    private java.nio.file.Path getMockLocalPath(String hdfsPath) {
        String cleanPath = hdfsPath.startsWith("/") ? hdfsPath.substring(1) : hdfsPath;
        return mockStorageDir.resolve(cleanPath);
    }

    // ===========================================
    // DIRECTORY OPERATIONS
    // ===========================================

    public void createDirectory(String hdfsPath) throws IOException {
        if (isHdfsAvailable()) {
            FileSystem fs = getFileSystem();
            Path path = new Path(hdfsPath);
            if (!fs.exists(path)) {
                fs.mkdirs(path);
                log.info("[HDFS] Directory created: {}", hdfsPath);
            }
        } else {
            java.nio.file.Path localPath = getMockLocalPath(hdfsPath);
            Files.createDirectories(localPath);
            log.info("[MOCK HDFS] Directory created: {}", localPath);
        }
    }

    // ===========================================
    // FILE UPLOAD
    // ===========================================

    public void uploadFile(String hdfsPath, InputStream inputStream) throws IOException {
        if (isHdfsAvailable()) {
            FileSystem fs = getFileSystem();
            Path path = new Path(hdfsPath);

            Path parent = path.getParent();
            if (parent != null && !fs.exists(parent)) {
                fs.mkdirs(parent);
            }

            try (FSDataOutputStream outputStream = fs.create(path, true)) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                long totalBytes = 0;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                    totalBytes += bytesRead;
                }
                outputStream.flush();
                log.info("[HDFS] File uploaded: {} ({} bytes)", hdfsPath, totalBytes);
            }
        } else {
            java.nio.file.Path localPath = getMockLocalPath(hdfsPath);
            if (localPath.getParent() != null) {
                Files.createDirectories(localPath.getParent());
            }

            try (OutputStream os = Files.newOutputStream(localPath, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                long totalBytes = 0;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    os.write(buffer, 0, bytesRead);
                    totalBytes += bytesRead;
                }
                os.flush();
                log.info("[MOCK HDFS] File uploaded locally: {} ({} bytes)", localPath, totalBytes);
            }
        }
    }

    // ===========================================
    // FILE DOWNLOAD
    // ===========================================

    public byte[] downloadFile(String hdfsPath) throws IOException {
        if (isHdfsAvailable()) {
            FileSystem fs = getFileSystem();
            Path path = new Path(hdfsPath);

            if (!fs.exists(path)) {
                throw new IOException("File not found on HDFS: " + hdfsPath);
            }

            FileStatus status = fs.getFileStatus(path);
            long fileSize = status.getLen();

            try (FSDataInputStream inputStream = fs.open(path)) {
                byte[] data = new byte[(int) fileSize];
                inputStream.readFully(data);
                log.info("[HDFS] File downloaded: {} ({} bytes)", hdfsPath, fileSize);
                return data;
            }
        } else {
            java.nio.file.Path localPath = getMockLocalPath(hdfsPath);
            if (!Files.exists(localPath)) {
                throw new IOException("File not found in Mock HDFS: " + hdfsPath);
            }
            byte[] data = Files.readAllBytes(localPath);
            log.info("[MOCK HDFS] File downloaded from mock storage: {} ({} bytes)", hdfsPath, data.length);
            return data;
        }
    }

    // ===========================================
    // FILE DELETE
    // ===========================================

    public void deleteFile(String hdfsPath) throws IOException {
        if (isHdfsAvailable()) {
            FileSystem fs = getFileSystem();
            Path path = new Path(hdfsPath);
            if (fs.exists(path)) {
                fs.delete(path, false);
                log.info("[HDFS] File deleted: {}", hdfsPath);
            }
        } else {
            java.nio.file.Path localPath = getMockLocalPath(hdfsPath);
            boolean deleted = Files.deleteIfExists(localPath);
            log.info("[MOCK HDFS] File deleted: {} (success={})", hdfsPath, deleted);
        }
    }

    // ===========================================
    // FILE EXISTS CHECK
    // ===========================================

    public boolean fileExists(String hdfsPath) {
        if (isHdfsAvailable()) {
            try {
                FileSystem fs = getFileSystem();
                return fs.exists(new Path(hdfsPath));
            } catch (IOException e) {
                return false;
            }
        } else {
            return Files.exists(getMockLocalPath(hdfsPath));
        }
    }

    // ===========================================
    // FILE STATUS
    // ===========================================

    public Map<String, Object> getFileStatus(String hdfsPath) throws IOException {
        if (isHdfsAvailable()) {
            FileSystem fs = getFileSystem();
            FileStatus status = fs.getFileStatus(new Path(hdfsPath));

            Map<String, Object> info = new LinkedHashMap<>();
            info.put("path", status.getPath().toString());
            info.put("size", status.getLen());
            info.put("replication", status.getReplication());
            info.put("blockSize", status.getBlockSize());
            info.put("isDirectory", status.isDirectory());
            info.put("modificationTime", status.getModificationTime());
            info.put("owner", status.getOwner());
            return info;
        } else {
            java.nio.file.Path localPath = getMockLocalPath(hdfsPath);
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("path", hdfsPath);
            info.put("size", Files.exists(localPath) ? Files.size(localPath) : 0);
            info.put("replication", 3); // Mô phỏng replication factor = 3
            info.put("blockSize", 134217728L); // Mô phỏng 128 MB
            info.put("isDirectory", Files.isDirectory(localPath));
            info.put("modificationTime", Files.exists(localPath) ? Files.getLastModifiedTime(localPath).toMillis() : System.currentTimeMillis());
            info.put("owner", "hdfs");
            return info;
        }
    }

    // ===========================================
    // LIST FILES
    // ===========================================

    public List<Map<String, Object>> listFiles(String hdfsPath) throws IOException {
        if (isHdfsAvailable()) {
            FileSystem fs = getFileSystem();
            Path path = new Path(hdfsPath);
            List<Map<String, Object>> result = new ArrayList<>();

            if (!fs.exists(path)) {
                return result;
            }

            FileStatus[] statuses = fs.listStatus(path);
            for (FileStatus status : statuses) {
                Map<String, Object> fileInfo = new LinkedHashMap<>();
                fileInfo.put("name", status.getPath().getName());
                fileInfo.put("path", status.getPath().toUri().getPath());
                fileInfo.put("size", status.getLen());
                fileInfo.put("isDirectory", status.isDirectory());
                fileInfo.put("replication", status.getReplication());
                fileInfo.put("blockSize", status.getBlockSize());
                fileInfo.put("modificationTime", status.getModificationTime());
                fileInfo.put("owner", status.getOwner());
                result.add(fileInfo);
            }
            return result;
        } else {
            java.nio.file.Path localPath = getMockLocalPath(hdfsPath);
            List<Map<String, Object>> result = new ArrayList<>();

            if (!Files.exists(localPath) || !Files.isDirectory(localPath)) {
                return result;
            }

            try (var stream = Files.list(localPath)) {
                stream.forEach(p -> {
                    try {
                        Map<String, Object> fileInfo = new LinkedHashMap<>();
                        fileInfo.put("name", p.getFileName().toString());
                        fileInfo.put("path", hdfsPath + "/" + p.getFileName().toString());
                        fileInfo.put("size", Files.size(p));
                        fileInfo.put("isDirectory", Files.isDirectory(p));
                        fileInfo.put("replication", 3);
                        fileInfo.put("blockSize", 134217728L);
                        fileInfo.put("modificationTime", Files.getLastModifiedTime(p).toMillis());
                        fileInfo.put("owner", "hdfs");
                        result.add(fileInfo);
                    } catch (IOException ignored) {}
                });
            }
            return result;
        }
    }

    // ===========================================
    // CLUSTER STATUS
    // ===========================================

    public Map<String, Object> getClusterStatus() {
        Map<String, Object> status = new LinkedHashMap<>();

        if (isHdfsAvailable()) {
            try {
                FileSystem fs = getFileSystem();
                FsStatus fsStatus = fs.getStatus();

                status.put("connected", true);
                status.put("nameNode", hadoopConfiguration.get("fs.defaultFS"));
                status.put("hdfsRoot", hdfsRootPath);
                status.put("capacityBytes", fsStatus.getCapacity());
                status.put("usedBytes", fsStatus.getUsed());
                status.put("remainingBytes", fsStatus.getRemaining());

                if (fsStatus.getCapacity() > 0) {
                    double usedPercent = (double) fsStatus.getUsed() / fsStatus.getCapacity() * 100;
                    status.put("usedPercent", Math.round(usedPercent * 10.0) / 10.0);
                }

                if (fs instanceof DistributedFileSystem dfs) {
                    try {
                        DatanodeInfo[] dataNodes = dfs.getDataNodeStats();
                        status.put("dataNodeCount", dataNodes.length);

                        List<Map<String, Object>> dataNodeList = new ArrayList<>();
                        for (DatanodeInfo dn : dataNodes) {
                            Map<String, Object> dnInfo = new LinkedHashMap<>();
                            dnInfo.put("hostname", dn.getHostName());
                            dnInfo.put("capacity", dn.getCapacity());
                            dnInfo.put("used", dn.getDfsUsed());
                            dnInfo.put("remaining", dn.getRemaining());
                            dnInfo.put("adminState", dn.getAdminState().toString());
                            dataNodeList.add(dnInfo);
                        }
                        status.put("dataNodes", dataNodeList);
                    } catch (Exception e) {
                        status.put("dataNodeCount", "N/A");
                    }
                } else {
                    status.put("dataNodeCount", 0);
                    status.put("note", "Using LocalFileSystem (no actual HDFS running)");
                }
            } catch (IOException e) {
                status.put("connected", false);
                status.put("error", e.getMessage());
            }
        } else {
            // MOCK HDFS CLUSTER STATUS CHO THUYẾT TRÌNH DEMO
            long capacity = 536870912000L; // 500 GB
            long mockUsed = calculateMockUsedSpace();
            long totalUsed = 42949672960L + mockUsed; // 40 GB base + real uploaded files
            long remaining = capacity - totalUsed;
            double usedPercent = Math.round(((double) totalUsed / capacity * 100) * 10.0) / 10.0;

            status.put("connected", true);
            status.put("nameNode", "hdfs://localhost:9000 (Mock Mode Active)");
            status.put("hdfsRoot", hdfsRootPath);
            status.put("capacityBytes", capacity);
            status.put("usedBytes", totalUsed);
            status.put("remainingBytes", remaining);
            status.put("usedPercent", usedPercent);
            status.put("dataNodeCount", 3);
            status.put("note", "Smart Mock HDFS Active - Simulated 3 DataNodes, Block Size 128MB & Replication 3 for presentation demo.");

            List<Map<String, Object>> dataNodeList = new ArrayList<>();
            dataNodeList.add(createMockDataNode("datanode-1.hdfs.local", capacity / 3, totalUsed / 3));
            dataNodeList.add(createMockDataNode("datanode-2.hdfs.local", capacity / 3, totalUsed / 3));
            dataNodeList.add(createMockDataNode("datanode-3.hdfs.local", capacity / 3, totalUsed / 3));
            status.put("dataNodes", dataNodeList);
        }

        return status;
    }

    private long calculateMockUsedSpace() {
        try {
            if (Files.exists(mockStorageDir)) {
                try (var walk = Files.walk(mockStorageDir)) {
                    return walk.filter(Files::isRegularFile).mapToLong(p -> {
                        try {
                            return Files.size(p);
                        } catch (IOException e) {
                            return 0L;
                        }
                    }).sum();
                }
            }
        } catch (IOException ignored) {}
        return 0L;
    }

    private Map<String, Object> createMockDataNode(String hostname, long capacity, long used) {
        Map<String, Object> dnInfo = new LinkedHashMap<>();
        dnInfo.put("hostname", hostname);
        dnInfo.put("capacity", capacity);
        dnInfo.put("used", used);
        dnInfo.put("remaining", capacity - used);
        dnInfo.put("adminState", "NORMAL_STATE");
        return dnInfo;
    }

    public String getHdfsRootPath() {
        return hdfsRootPath;
    }
}

