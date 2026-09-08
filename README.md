# 🗄️ HDFS Cloud Drive Demo

> Ứng dụng demo minh họa cách lưu trữ file thực tế trên **Apache HDFS** với **Spring Boot** và **MySQL**.

---

## 📐 Kiến trúc hệ thống

```
   Người dùng
       │
       ▼
  ┌─────────┐
  │ Browser │  (HTML + CSS + JavaScript)
  │ Frontend│
  └────┬────┘
       │ HTTP REST API
       ▼
  ┌──────────────────┐
  │   Spring Boot    │  Port 8080
  │   REST API       │
  └─────┬────────────┘
        │
        ├──────────────────────┐
        ▼                      ▼
  ┌───────────┐          ┌───────────┐
  │   MySQL   │          │   HDFS    │
  │           │          │ NameNode  │
  │ Lưu       │          │ :9000     │
  │ METADATA  │          │           │
  │ (tên,     │          │ Lưu FILE  │
  │  kích     │          │ THỰC TẾ   │
  │  thước,   │          │ /cloud-   │
  │  path...) │          │ drive/    │
  └───────────┘          └───────────┘
```

---

## 🎓 Giải thích các khái niệm HDFS

### NameNode là gì?
- **NameNode** là node "master" trong HDFS cluster
- Lưu trữ **metadata** của toàn bộ hệ thống file: tên file, kích thước, vị trí block, quyền truy cập
- **KHÔNG** lưu dữ liệu thực tế
- Giao diện web: `http://localhost:9870`
- Nếu NameNode bị hỏng, toàn bộ cluster không hoạt động → cần cấu hình High Availability trong production

### DataNode là gì?
- **DataNode** là node "slave", lưu trữ dữ liệu thực tế
- Mỗi DataNode lưu một phần của file (block)
- DataNode gửi heartbeat đến NameNode mỗi 3 giây
- Nếu một DataNode bị hỏng, NameNode tự động sao chép dữ liệu sang DataNode khác

### Block trong HDFS là gì?
- File được chia thành các **Block** có kích thước cố định (mặc định **128MB**)
- Ví dụ: file 350MB → 3 blocks (128MB + 128MB + 94MB)
- Mỗi block được lưu ở **3 vị trí khác nhau** (replication factor = 3 mặc định)
- Lợi ích: **Fault tolerance** - nếu 1 máy hỏng, file vẫn còn nguyên

### Vì sao lưu file trên HDFS thay vì MySQL?
| Tiêu chí | MySQL | HDFS |
|---|---|---|
| Mục đích | Structured data, transactions | Big data, large files |
| Kích thước file | Vài KB - MB | TB, PB |
| Độ bền | High (ACID) | Very High (replication) |
| Hiệu suất ghi lớn | Kém | Tốt |
| Phân tán | Khó | Thiết kế sẵn |

### Vai trò của Spring Boot
- **REST API** nhận request từ Frontend
- **Điều phối** giữa HDFS và MySQL
- Khi upload: nhận file → ghi lên HDFS → lưu metadata vào MySQL
- Khi download: đọc đường dẫn HDFS từ MySQL → stream file từ HDFS về browser

### Vai trò của MySQL
- Lưu **metadata** của file: tên, kích thước, đường dẫn HDFS, người upload, thời gian
- **Tìm kiếm** file nhanh chóng theo tên, user, ngày
- **KHÔNG** lưu nội dung file → tiết kiệm DB storage
- Lưu share links để chia sẻ file

---

## 🛠️ Yêu cầu môi trường

| Phần mềm | Phiên bản | Link tải |
|---|---|---|
| Java JDK | 17+ | https://adoptium.net/ |
| Maven | 3.8+ | https://maven.apache.org/ |
| MySQL | 8.0+ | https://dev.mysql.com/downloads/ |
| Hadoop | 3.3.x | https://hadoop.apache.org/releases.html |
| winutils (Windows) | matching Hadoop | https://github.com/cdarlint/winutils |

---

## 🚀 Hướng dẫn cài đặt và chạy

### Bước 1: Cài Java 17

```powershell
# Kiểm tra Java đã cài chưa
java -version
# Phải thấy: java version "17.x.x"

# Nếu chưa cài: download từ https://adoptium.net/
# Sau đó set JAVA_HOME:
# System Properties → Advanced → Environment Variables
# New System Variable: JAVA_HOME = C:\Program Files\Java\jdk-17
```

### Bước 2: Cài Maven

```powershell
# Download Maven từ: https://maven.apache.org/download.cgi
# Giải nén vào C:\apache-maven-3.9.x
# Thêm vào PATH: C:\apache-maven-3.9.x\bin

# Kiểm tra:
mvn -version
```

### Bước 3: Cài MySQL

```powershell
# Download MySQL Installer từ: https://dev.mysql.com/downloads/installer/
# Cài MySQL Server với password root: 123456
# Hoặc đổi password trong application.properties
```

### Bước 4: Cài Hadoop trên Windows

**4a. Download Hadoop:**
```
https://hadoop.apache.org/releases.html
→ Download hadoop-3.3.6.tar.gz
→ Giải nén vào C:\hadoop
```

**4b. Cài winutils.exe (bắt buộc trên Windows):**
```
https://github.com/cdarlint/winutils
→ Download bin/winutils.exe và bin/hadoop.dll từ thư mục hadoop-3.3.6
→ Copy vào C:\hadoop\bin\
```

**4c. Set Environment Variables:**
```
HADOOP_HOME = C:\hadoop
Thêm vào PATH: %HADOOP_HOME%\bin
```

**4d. Cấu hình HDFS:**

Tạo thư mục data:
```powershell
mkdir C:\hadoop\data\namenode
mkdir C:\hadoop\data\datanode
```

Sửa file `C:\hadoop\etc\hadoop\core-site.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <property>
    <name>fs.defaultFS</name>
    <value>hdfs://localhost:9000</value>
  </property>
</configuration>
```

Sửa file `C:\hadoop\etc\hadoop\hdfs-site.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <property>
    <name>dfs.replication</name>
    <value>1</value>
  </property>
  <property>
    <name>dfs.namenode.name.dir</name>
    <value>file:///C:/hadoop/data/namenode</value>
  </property>
  <property>
    <name>dfs.datanode.data.dir</name>
    <value>file:///C:/hadoop/data/datanode</value>
  </property>
  <property>
    <name>dfs.permissions.enabled</name>
    <value>false</value>
  </property>
</configuration>
```

Sửa file `C:\hadoop\etc\hadoop\hadoop-env.cmd`:
```cmd
set JAVA_HOME=C:\Program Files\Java\jdk-17
```

### Bước 5: Format và khởi động HDFS

```powershell
# Format NameNode (chỉ làm 1 lần đầu tiên!)
hdfs namenode -format

# Khởi động HDFS
%HADOOP_HOME%\sbin\start-dfs.cmd

# Kiểm tra HDFS đang chạy:
# Mở: http://localhost:9870

# Tạo thư mục /cloud-drive trên HDFS
hdfs dfs -mkdir -p /cloud-drive

# Tạo file demo
hdfs dfs -put - /cloud-drive/data.txt << EOF
Apache HDFS Demo
This file is stored in HDFS.
Spring Boot is communicating with HDFS.
EOF

# Liệt kê file trên HDFS
hdfs dfs -ls /cloud-drive
```

> **Lưu ý**: Nếu gặp lỗi permission khi format, chạy PowerShell/CMD với quyền Administrator.

### Bước 6: Cấu hình MySQL

```powershell
# Kết nối MySQL
mysql -u root -p

# Tạo database và tables
source d:\DaiHocNam4\bigdata\doandemo\backend\src\main\resources\schema.sql

# Insert demo data
source d:\DaiHocNam4\bigdata\doandemo\backend\src\main\resources\data.sql
```

Hoặc dùng MySQL Workbench:
1. File → Open SQL Script → chọn `schema.sql` → Execute
2. File → Open SQL Script → chọn `data.sql` → Execute

### Bước 7: Cấu hình Spring Boot

Mở file `backend/src/main/resources/application.properties`:
```properties
# Đổi password MySQL nếu khác
spring.datasource.password=123456

# Địa chỉ HDFS NameNode (mặc định localhost:9000)
hdfs.uri=hdfs://localhost:9000
```

### Bước 8: Chạy Spring Boot

```powershell
cd d:\DaiHocNam4\bigdata\doandemo\backend

# Build project
mvn clean install -DskipTests

# Chạy ứng dụng
mvn spring-boot:run

# Hoặc chạy jar:
java --add-opens java.base/java.lang=ALL-UNNAMED ^
     --add-opens java.base/java.util=ALL-UNNAMED ^
     --add-opens java.base/java.io=ALL-UNNAMED ^
     --add-opens java.base/java.net=ALL-UNNAMED ^
     -jar target/cloud-drive-1.0.0.jar
```

Đợi thấy log:
```
Started CloudDriveApplication in X.XXX seconds
```

### Bước 9: Mở Frontend

```powershell
# Mở trực tiếp file HTML trong browser
start d:\DaiHocNam4\bigdata\doandemo\frontend\index.html

# Hoặc dùng VS Code Live Server, hoặc Python HTTP server:
cd d:\DaiHocNam4\bigdata\doandemo\frontend
python -m http.server 3000
# Sau đó mở: http://localhost:3000
```

**Đăng nhập:** `admin` / `123456`

---

## 🧪 Cách test upload/download

### Test qua UI:
1. Mở `frontend/index.html` trong browser
2. Đăng nhập với `admin/123456`
3. Nhấn "Upload File" → chọn file → Upload
4. Xem file xuất hiện trong danh sách
5. Nhấn "Download" để tải về
6. Mở `http://localhost:9870` → Utilities → Browse → `/cloud-drive` để verify file trên HDFS

### Test qua API (curl):
```powershell
# Upload file
curl -X POST http://localhost:8080/api/files/upload ^
  -H "X-Username: admin" ^
  -F "file=@C:\path\to\testfile.pdf"

# Xem danh sách file
curl http://localhost:8080/api/files

# Kiểm tra HDFS status
curl http://localhost:8080/api/hdfs/status

# Download file (id=1)
curl -O -J http://localhost:8080/api/files/1/download
```

---

## 🔍 Cách kiểm tra file trên HDFS

### 1. Web UI (dễ nhất):
```
http://localhost:9870
→ Utilities → Browse the file system
→ Nhập: /cloud-drive
→ Xem danh sách file
```

### 2. Command line:
```powershell
# Liệt kê file
hdfs dfs -ls /cloud-drive

# Xem nội dung file text
hdfs dfs -cat /cloud-drive/data.txt

# Xem thông tin chi tiết (block, replication)
hdfs dfs -stat "%b %r %n" /cloud-drive/*

# Xem block locations của file
hdfs fsck /cloud-drive/yourfile.pdf -files -blocks -locations
```

---

## ❌ Lỗi thường gặp và cách xử lý

### Lỗi 1: `ERROR: JAVA_HOME is not set`
```
# Giải pháp: Set JAVA_HOME trong hadoop-env.cmd
set JAVA_HOME=C:\Program Files\Java\jdk-17
```

### Lỗi 2: `winutils.exe: Access is denied`
```
# Giải pháp 1: Chạy CMD/PowerShell với quyền Administrator
# Giải pháp 2: Cấp full permission cho thư mục hadoop\bin
icacls "C:\hadoop\bin" /grant Everyone:F
```

### Lỗi 3: `NameNode is in safe mode`
```powershell
# Tắt safe mode
hdfs dfsadmin -safemode leave
```

### Lỗi 4: `Connection refused to localhost:9000`
```powershell
# Kiểm tra HDFS có đang chạy không
jps
# Phải thấy: NameNode, DataNode

# Nếu không thấy, khởi động lại:
%HADOOP_HOME%\sbin\stop-dfs.cmd
%HADOOP_HOME%\sbin\start-dfs.cmd
```

### Lỗi 5: Spring Boot lỗi `InaccessibleObjectException`
```
# Thêm JVM args vào lệnh chạy:
java --add-opens java.base/java.lang=ALL-UNNAMED ...
# (Đã được cấu hình sẵn trong pom.xml)
```

### Lỗi 6: MySQL `Access denied for user 'root'`
```
# Sửa password trong application.properties:
spring.datasource.password=YOUR_ACTUAL_PASSWORD
```

### Lỗi 7: CORS Error trong browser
```
# Đảm bảo Spring Boot đang chạy trên port 8080
# WebConfig.java đã cấu hình CORS cho tất cả origins
```

### Lỗi 8: `DatanodeRegistrationException`
```
# Format lại NameNode (cẩn thận: xóa tất cả data!)
%HADOOP_HOME%\sbin\stop-dfs.cmd
rm -rf C:\hadoop\data\*
mkdir C:\hadoop\data\namenode
mkdir C:\hadoop\data\datanode
hdfs namenode -format
%HADOOP_HOME%\sbin\start-dfs.cmd
```

---

## 🎬 Kịch bản Demo 5-10 phút

### Bước 1 — Giới thiệu kiến trúc (1 phút)
> *"Đây là ứng dụng HDFS Cloud Drive — một minh họa thực tế về cách Apache HDFS lưu trữ file trong môi trường big data. Kiến trúc gồm 3 lớp: Frontend giao tiếp với Spring Boot, Spring Boot phân phối công việc giữa MySQL và HDFS."*

Mở `http://localhost:9870` → Giới thiệu HDFS Web UI.
> *"NameNode quản lý metadata — nó biết mọi file có ở đâu, nhưng không lưu nội dung file. DataNode mới là nơi lưu dữ liệu thực tế."*

### Bước 2 — Đăng nhập (30 giây)
Mở `frontend/index.html` → Đăng nhập `admin/123456`.
> *"Dashboard hiển thị tổng số file và dung lượng đang lưu trên HDFS."*

### Bước 3 — Upload file (1-2 phút)
Nhấn "Upload File" → Chọn một file PDF hoặc ảnh.
> *"Khi tôi nhấn Upload, Spring Boot sẽ làm 2 việc:*
> *1. Ghi file thực tế lên HDFS tại đường dẫn /cloud-drive/[tên-file]*
> *2. Lưu metadata vào MySQL: tên file, kích thước, đường dẫn HDFS, thời gian upload*
> *MySQL chỉ biết rằng file nằm ở /cloud-drive/[tên-file] — nó không chứa nội dung file!"*

### Bước 4 — Kiểm tra HDFS (1 phút)
Chuyển sang tab `http://localhost:9870` → Utilities → Browse → `/cloud-drive`.
> *"File vừa upload đã xuất hiện trên HDFS! Bạn có thể thấy block size là 128MB và replication factor là 1 (vì chúng ta chỉ có 1 DataNode cho demo)."*

### Bước 5 — HDFS Status page (1 phút)
Trong ứng dụng, click "HDFS Status" ở sidebar.
> *"Trang này truy vấn trực tiếp HDFS API để lấy thông tin cluster: capacity, dung lượng đã dùng, số DataNode, danh sách file trong /cloud-drive."*

### Bước 6 — Download (30 giây)
Click "Download" trên một file.
> *"Spring Boot đọc đường dẫn HDFS từ MySQL, sau đó stream file từ HDFS về browser. File không đi qua MySQL!"*

### Bước 7 — Share Link (1 phút)
Click "Share" → Copy link → Mở tab ẩn danh → Paste link.
> *"Link chia sẻ được lưu trong MySQL với token UUID. Khi người khác mở link, backend tìm token trong MySQL để biết file ở đâu trên HDFS, sau đó download từ HDFS."*

### Bước 8 — Delete (30 giây)
Delete file → Mở HDFS Web UI để verify file đã biến mất.
> *"Xóa file là 2 bước: xóa khỏi HDFS trước, sau đó xóa metadata trong MySQL. MySQL dùng CASCADE nên share links cũng tự xóa."*

### Bước 9 — Tổng kết (1 phút)
> *"Đây là mô hình lưu trữ phân tán điển hình trong big data:*
> - *Database (MySQL) lưu metadata — giúp tìm kiếm nhanh*
> - *HDFS lưu file thực tế — có thể scale đến hàng petabyte*
> - *Spring Boot làm cầu nối giữa user và hệ thống lưu trữ*
> - *Trong production thực tế (Hadoop cluster đầy đủ), file được replicate 3 lần trên các DataNode khác nhau để đảm bảo fault tolerance"*

---

## 📁 Cấu trúc thư mục

```
doandemo/
├── backend/
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/hdfs/clouddrive/
│       │   ├── CloudDriveApplication.java    ← Main class
│       │   ├── config/
│       │   │   ├── HdfsConfig.java           ← Hadoop Configuration bean
│       │   │   └── WebConfig.java            ← CORS config
│       │   ├── controller/
│       │   │   ├── AuthController.java       ← POST /api/auth/login
│       │   │   ├── FileController.java       ← CRUD + upload + download
│       │   │   ├── HdfsController.java       ← GET /api/hdfs/status
│       │   │   └── ShareController.java      ← GET /api/share/{token}
│       │   ├── service/
│       │   │   ├── HdfsService.java          ← ⭐ TẤT CẢ thao tác HDFS
│       │   │   ├── FileMetadataService.java  ← CRUD metadata MySQL
│       │   │   └── ShareService.java         ← Quản lý share link
│       │   ├── model/
│       │   │   ├── User.java
│       │   │   ├── FileMetadata.java         ← ⭐ Entity lưu metadata
│       │   │   └── ShareLink.java
│       │   ├── repository/
│       │   │   ├── UserRepository.java
│       │   │   ├── FileMetadataRepository.java
│       │   │   └── ShareLinkRepository.java
│       │   └── dto/
│       │       ├── LoginRequest.java
│       │       ├── LoginResponse.java
│       │       └── FileResponse.java
│       └── resources/
│           ├── application.properties        ← ⭐ Cấu hình DB + HDFS
│           ├── schema.sql                    ← DDL tạo bảng
│           └── data.sql                      ← Dữ liệu demo
├── frontend/
│   ├── index.html                            ← Trang đăng nhập
│   ├── dashboard.html                        ← Ứng dụng chính
│   └── js/
│       ├── auth.js                           ← Session management
│       ├── dashboard.js                      ← Navigation + stats
│       ├── files.js                          ← Upload/download/delete/share
│       └── hdfs-status.js                    ← Trang HDFS Status
└── README.md
```

---

## 🔌 API Reference

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |
| POST | `/api/files/upload` | Upload file → HDFS |
| GET | `/api/files` | Danh sách file (metadata từ MySQL) |
| GET | `/api/files/{id}` | Thông tin file theo ID |
| GET | `/api/files/{id}/download` | Download file từ HDFS |
| DELETE | `/api/files/{id}` | Xóa khỏi HDFS + MySQL |
| POST | `/api/files/{id}/share` | Tạo share link |
| GET | `/api/files/stats` | Thống kê tổng quan |
| GET | `/api/share/{token}` | Download file qua share link |
| GET | `/api/share/{token}/info` | Thông tin share link |
| GET | `/api/hdfs/status` | Trạng thái HDFS cluster |
| GET | `/api/hdfs/files` | Danh sách file trên HDFS |
| GET | `/api/hdfs/ping` | Kiểm tra kết nối HDFS |
