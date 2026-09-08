package com.hdfs.clouddrive.config;

import org.apache.hadoop.conf.Configuration;
import org.springframework.beans.factory.annotation.Value;

/**
 * HdfsConfig - Cấu hình kết nối đến Apache HDFS
 *
 * NameNode là gì?
 *   - NameNode là "Master" node trong HDFS cluster.
 *   - Nó quản lý metadata của hệ thống file: tên file, kích thước,
 *     vị trí các block trên DataNode, quyền truy cập...
 *   - NameNode KHÔNG lưu trữ dữ liệu thực tế.
 *   - Giao diện web: http://localhost:9870
 *
 * DataNode là gì?
 *   - DataNode là "Slave" node, nơi dữ liệu thực tế được lưu.
 *   - Dữ liệu được chia thành các "Block" (mặc định 128MB mỗi block).
 *   - DataNode báo cáo định kỳ với NameNode về trạng thái của mình.
 */
@org.springframework.context.annotation.Configuration
public class HdfsConfig {

    @Value("${hdfs.uri}")
    private String hdfsUri;

    /**
     * Tạo Hadoop Configuration bean
     * Bean này sẽ được inject vào HdfsService để tạo kết nối HDFS
     */
    @org.springframework.context.annotation.Bean
    public Configuration hadoopConfiguration() {
        Configuration config = new Configuration();

        // Địa chỉ NameNode - HDFS sẽ kết nối qua RPC port 9000
        config.set("fs.defaultFS", hdfsUri);

        // Cho phép dùng hostname thay vì IP của DataNode
        // Cần thiết khi chạy trên Windows/localhost
        config.set("dfs.client.use.datanode.hostname", "true");

        // Tắt kiểm tra permissions (phù hợp môi trường dev/demo)
        config.set("dfs.permissions.enabled", "false");

        // Tắt Kerberos authentication (không cần cho demo)
        config.set("hadoop.security.authentication", "simple");
        config.set("hadoop.security.authorization", "false");

        return config;
    }
}
