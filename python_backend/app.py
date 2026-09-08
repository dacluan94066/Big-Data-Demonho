import os
import sys

# Ensure UTF-8 output on Windows terminal
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

import uuid
import math
import time
import shutil
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pymysql
import sqlite3

# =====================================================
# HDFS Cloud Drive - Python Flask Backend
# =====================================================

app = Flask(__name__)
CORS(app)  # Cho phép tất cả các nguồn frontend truy cập API

# -----------------------------------------------------
# Cấu hình lưu trữ Mock HDFS
# -----------------------------------------------------
STORAGE_DIR = os.path.join(os.path.expanduser("~"), "hdfs-storage-mock")
os.makedirs(STORAGE_DIR, exist_ok=True)

# -----------------------------------------------------
# Kết nối Database (Thử MySQL trước, nếu thất bại tự chuyển SQLite)
# -----------------------------------------------------
MYSQL_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': '123456',
    'database': 'hdfs_cloud_drive',
    'charset': 'utf8mb4',
    'autocommit': True,
    'cursorclass': pymysql.cursors.DictCursor
}

USE_SQLITE = False
SQLITE_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hdfs_cloud_drive.db")

def init_db():
    global USE_SQLITE
    try:
        conn = pymysql.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        conn.close()
        print("✅ Kết nối MySQL thành công (database: hdfs_cloud_drive)")
        USE_SQLITE = False
    except Exception as e:
        print(f"⚠️ Không thể kết nối MySQL ({e}). Tự động dùng SQLite tạm thời!")
        USE_SQLITE = True
        conn = sqlite3.connect(SQLITE_DB)
        cursor = conn.cursor()
        
        # Tạo bảng trong SQLite nếu dùng SQLite
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT,
                full_name TEXT,
                role TEXT DEFAULT 'USER'
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                hdfs_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                content_type TEXT,
                upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                uploader_username TEXT NOT NULL,
                block_count INTEGER DEFAULT 1,
                replication_factor INTEGER DEFAULT 3
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS share_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                share_token TEXT UNIQUE NOT NULL,
                file_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                access_count INTEGER DEFAULT 0
            )
        ''')
        
        # Thêm 3 user mẫu nếu chưa có
        cursor.execute("SELECT COUNT(*) FROM users")
        user_res = cursor.fetchone()
        user_count = user_res[0] if isinstance(user_res, (tuple, list)) else (user_res.get('COUNT(*)', 0) if isinstance(user_res, dict) else 0)
        if user_count == 0:
            cursor.executemany('''
                INSERT INTO users (username, password, email, full_name, role)
                VALUES (?, ?, ?, ?, ?)
            ''', [
                ('admin', '123456', 'admin@clouddrive.vn', 'Quản trị viên', 'ADMIN'),
                ('demo', 'demo123', 'demo@clouddrive.vn', 'Người dùng Demo', 'USER'),
                ('hdfs', 'hdfs123', 'hdfs@apache.org', 'Hadoop Engineer', 'USER')
            ])
            conn.commit()

        # Seed file mẫu nếu chưa có (1 block, 3 blocks, 5 blocks)
        cursor.execute("SELECT COUNT(*) FROM files")
        file_res = cursor.fetchone()
        file_count = file_res[0] if isinstance(file_res, (tuple, list)) else (file_res.get('COUNT(*)', 0) if isinstance(file_res, dict) else 0)
        if file_count == 0:
            if USE_SQLITE:
                cursor.executemany('''
                    INSERT INTO files (filename, hdfs_path, file_size, content_type, uploader_username, block_count, replication_factor)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', [
                    ('BigData_WebLogs_Dataset_2026.csv', '/cloud-drive/BigData_WebLogs_Dataset_2026.csv', 316043776, 'text/csv', 'admin', 3, 3),
                    ('Hadoop_Cluster_Metrics_Backup.tar.gz', '/cloud-drive/Hadoop_Cluster_Metrics_Backup.tar.gz', 545259520, 'application/gzip', 'admin', 5, 3),
                    ('BaoCao_KienTruc_HDFS_Apache.pdf', '/cloud-drive/BaoCao_KienTruc_HDFS_Apache.pdf', 16148070, 'application/pdf', 'admin', 1, 3)
                ])
            else:
                cursor.executemany('''
                    INSERT INTO files (file_name, file_path, file_size, content_type, uploaded_by)
                    VALUES (%s, %s, %s, %s, %s)
                ''', [
                    ('BigData_WebLogs_Dataset_2026.csv', '/cloud-drive/BigData_WebLogs_Dataset_2026.csv', 316043776, 'text/csv', 'admin'),
                    ('Hadoop_Cluster_Metrics_Backup.tar.gz', '/cloud-drive/Hadoop_Cluster_Metrics_Backup.tar.gz', 545259520, 'application/gzip', 'admin'),
                    ('BaoCao_KienTruc_HDFS_Apache.pdf', '/cloud-drive/BaoCao_KienTruc_HDFS_Apache.pdf', 16148070, 'application/pdf', 'admin')
                ])
            conn.commit()

        conn.close()
        print("✅ Khởi tạo DB & Dữ liệu mẫu thành công!")

def get_db_connection():
    if USE_SQLITE:
        conn = sqlite3.connect(SQLITE_DB)
        conn.row_factory = sqlite3.Row
        return conn
    else:
        return pymysql.connect(**MYSQL_CONFIG)

init_db()

# -----------------------------------------------------
# Helper Functions
# -----------------------------------------------------
def dict_from_row(row):
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return dict(row)

def rows_to_list(rows):
    return [dict_from_row(r) for r in rows]

def get_username_from_request():
    return request.headers.get('X-Username', 'admin')

def calculate_block_count(file_size):
    block_size = 128 * 1024 * 1024  # 128 MB
    if file_size == 0:
        return 1
    return math.ceil(file_size / block_size)

def map_file_row(r):
    if not r:
        return None
    r = dict_from_row(r)
    filename = r.get('file_name') or r.get('filename') or 'unnamed'
    hdfs_path = r.get('file_path') or r.get('hdfs_path') or f"/cloud-drive/{filename}"
    file_size = r.get('file_size') or 0
    content_type = r.get('content_type') or 'application/octet-stream'
    uploader = r.get('uploaded_by') or r.get('uploader_username') or 'admin'
    upload_time = str(r.get('uploaded_at') or r.get('upload_time') or datetime.now())
    block_count = r.get('block_count') if ('block_count' in r and r['block_count'] is not None) else calculate_block_count(file_size)
    replication = r.get('replication_factor') if ('replication_factor' in r and r['replication_factor'] is not None) else 3

    return {
        'id': r['id'],
        'filename': filename,
        'hdfsPath': hdfs_path,
        'fileSize': file_size,
        'contentType': content_type,
        'uploadTime': upload_time,
        'uploaderUsername': uploader,
        'blockCount': block_count,
        'replicationFactor': replication
    }

# =====================================================
# REST APIs - AUTH CONTROLLER
# =====================================================

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Tên đăng nhập và mật khẩu không được trống', 'error': 'Tên đăng nhập và mật khẩu không được trống'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_SQLITE:
        cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    else:
        cursor.execute("SELECT * FROM users WHERE username = %s AND password = %s", (username, password))
    
    user = dict_from_row(cursor.fetchone())
    conn.close()

    if not user:
        return jsonify({'message': 'Tài khoản hoặc mật khẩu không chính xác', 'error': 'Tài khoản hoặc mật khẩu không chính xác'}), 401

    token = f"demo-token-{uuid.uuid4()}"
    full_name = user.get('full_name') or user.get('fullName') or user['username']
    return jsonify({
        'token': token,
        'username': user['username'],
        'fullName': full_name,
        'message': 'Đăng nhập thành công',
        'error': None,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'fullName': full_name,
            'role': user['role']
        }
    })


@app.route('/api/auth/me', methods=['GET'])
def get_current_user_info():
    username = get_username_from_request()
    conn = get_db_connection()
    cursor = conn.cursor()
    if USE_SQLITE:
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    else:
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = dict_from_row(cursor.fetchone())
    conn.close()

    if not user:
        return jsonify({'message': 'User not found'}), 44
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'email': user['email'],
        'fullName': user.get('full_name') or user.get('fullName') or user['username'],
        'role': user['role']
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    return jsonify({'message': 'Logged out successfully'})

# =====================================================
# REST APIs - FILE CONTROLLER
# =====================================================

@app.route('/api/files', methods=['GET', 'OPTIONS'])
def get_files():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_SQLITE:
        cursor.execute("SELECT * FROM files ORDER BY id DESC")
    else:
        cursor.execute("SELECT * FROM files ORDER BY id DESC")
    
    rows = rows_to_list(cursor.fetchall())
    conn.close()

    result = [map_file_row(r) for r in rows if r]
    return jsonify(result)

@app.route('/api/files/upload', methods=['POST', 'OPTIONS'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'message': 'Không tìm thấy file'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'message': 'Tên file rỗng'}), 400

    username = get_username_from_request()
    filename = file.filename
    clean_filename = f"{int(time.time())}_{filename}"
    hdfs_path = f"/cloud-drive/{clean_filename}"
    
    local_target_path = os.path.join(STORAGE_DIR, clean_filename)
    file.save(local_target_path)
    file_size = os.path.getsize(local_target_path)
    content_type = file.content_type or 'application/octet-stream'
    block_count = calculate_block_count(file_size)

    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_SQLITE:
        cursor.execute('''
            INSERT INTO files (filename, hdfs_path, file_size, content_type, uploader_username, block_count, replication_factor)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (filename, hdfs_path, file_size, content_type, username, block_count, 3))
        file_id = cursor.lastrowid
        conn.commit()
    else:
        cursor.execute('''
            INSERT INTO files (file_name, file_path, file_size, content_type, uploaded_by)
            VALUES (%s, %s, %s, %s, %s)
        ''', (filename, hdfs_path, file_size, content_type, username))
        file_id = cursor.lastrowid
        conn.commit()

    conn.close()

    return jsonify({
        'id': file_id,
        'filename': filename,
        'hdfsPath': hdfs_path,
        'fileSize': file_size,
        'contentType': content_type,
        'uploadTime': datetime.now().isoformat(),
        'uploaderUsername': username,
        'blockCount': block_count,
        'replicationFactor': 3
    })

@app.route('/api/files/download/<int:file_id>', methods=['GET', 'OPTIONS'])
@app.route('/api/files/<int:file_id>/download', methods=['GET', 'OPTIONS'])
def download_file(file_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_SQLITE:
        cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
    else:
        cursor.execute("SELECT * FROM files WHERE id = %s", (file_id,))
        
    f = map_file_row(cursor.fetchone())
    conn.close()

    if not f:
        return jsonify({'message': 'File metadata not found'}), 404

    clean_filename = f['hdfsPath'].replace('/cloud-drive/', '')
    local_path = os.path.join(STORAGE_DIR, clean_filename)

    if not os.path.exists(local_path):
        with open(local_path, 'wb') as tmp:
            tmp.write(f"Sample demo content for {f['filename']}".encode('utf-8'))

    return send_file(local_path, as_attachment=True, download_name=f['filename'])

@app.route('/api/files/<int:file_id>/share', methods=['POST', 'OPTIONS'])
def share_file_by_id(file_id):
    token = str(uuid.uuid4())[:8]
    expires_at = datetime.now() + timedelta(hours=24)
    conn = get_db_connection()
    cursor = conn.cursor()
    if USE_SQLITE:
        cursor.execute('INSERT INTO share_links (share_token, file_id, expires_at) VALUES (?, ?, ?)',
                       (token, file_id, expires_at.strftime('%Y-%m-%d %H:%M:%S')))
        conn.commit()
    else:
        cursor.execute('INSERT INTO share_links (share_token, file_id, created_by, expired_at) VALUES (%s, %s, %s, %s)',
                       (token, file_id, 'admin', expires_at.strftime('%Y-%m-%d %H:%M:%S')))
        conn.commit()
    conn.close()
    return jsonify({
        'shareToken': token,
        'shareUrl': f"{request.host_url}api/share/{token}",
        'expiresAt': expires_at.isoformat()
    })

@app.route('/api/files/<int:file_id>', methods=['DELETE', 'OPTIONS'])
def delete_file(file_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_SQLITE:
        cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
    else:
        cursor.execute("SELECT * FROM files WHERE id = %s", (file_id,))
        
    f = map_file_row(cursor.fetchone())
    
    if f:
        clean_filename = f['hdfsPath'].replace('/cloud-drive/', '')
        local_path = os.path.join(STORAGE_DIR, clean_filename)
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass
        
        if USE_SQLITE:
            cursor.execute("DELETE FROM share_links WHERE file_id = ?", (file_id,))
            cursor.execute("DELETE FROM files WHERE id = ?", (file_id,))
            conn.commit()
        else:
            cursor.execute("DELETE FROM share_links WHERE file_id = %s", (file_id,))
            cursor.execute("DELETE FROM files WHERE id = %s", (file_id,))
            conn.commit()
            
    conn.close()
    return jsonify({'message': 'File deleted successfully'})

@app.route('/api/files/stats', methods=['GET', 'OPTIONS'])
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_SQLITE:
        cursor.execute("SELECT * FROM files")
    else:
        cursor.execute("SELECT * FROM files")
        
    rows = rows_to_list(cursor.fetchall())
    conn.close()

    mapped_rows = [map_file_row(r) for r in rows if r]
    total_files = len(mapped_rows)
    total_size = sum(r['fileSize'] for r in mapped_rows)
    total_blocks = sum(r['blockCount'] for r in mapped_rows)

    return jsonify({
        'totalFiles': total_files,
        'totalSizeBytes': total_size,
        'formattedTotalSize': format_bytes(total_size),
        'totalStorageFormatted': format_bytes(total_size),
        'blockCount': total_blocks
    })

def format_bytes(b):
    if b == 0:
        return '0 B'
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    i = int(math.floor(math.log(b, 1024)))
    p = math.pow(1024, i)
    s = round(b / p, 2)
    return f"{s} {units[i]}"

# =====================================================
# REST APIs - SHARE CONTROLLER
# =====================================================

@app.route('/api/share/create', methods=['POST'])
def create_share_link():
    data = request.json or {}
    file_id = data.get('fileId')
    expires_hours = data.get('expiresHours', 24)

    if not file_id:
        return jsonify({'message': 'fileId required'}), 400

    token = str(uuid.uuid4())[:8]
    expires_at = datetime.now() + timedelta(hours=int(expires_hours))

    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_SQLITE:
        cursor.execute('''
            INSERT INTO share_links (share_token, file_id, expires_at)
            VALUES (?, ?, ?)
        ''', (token, file_id, expires_at.strftime('%Y-%m-%d %H:%M:%S')))
        conn.commit()
    else:
        cursor.execute('''
            INSERT INTO share_links (share_token, file_id, expires_at)
            VALUES (%s, %s, %s)
        ''', (token, file_id, expires_at.strftime('%Y-%m-%d %H:%M:%S')))
        
    conn.close()

    return jsonify({
        'shareToken': token,
        'shareUrl': f"http://localhost:8080/api/share/{token}",
        'expiresAt': expires_at.isoformat()
    })

@app.route('/api/share/<share_token>', methods=['GET'])
def get_share_info(share_token):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_SQLITE:
        cursor.execute('''
            SELECT s.*, f.filename, f.file_size, f.content_type, f.uploader_username, f.upload_time
            FROM share_links s JOIN files f ON s.file_id = f.id
            WHERE s.share_token = ?
        ''', (share_token,))
    else:
        cursor.execute('''
            SELECT s.*, f.filename, f.file_size, f.content_type, f.uploader_username, f.upload_time
            FROM share_links s JOIN files f ON s.file_id = f.id
            WHERE s.share_token = %s
        ''', (share_token,))
        
    row = dict_from_row(cursor.fetchone())
    
    if not row:
        conn.close()
        return jsonify({'message': 'Link chia sẻ không tồn tại hoặc đã hết hạn'}), 404

    # Cập nhật số lượt truy cập
    if USE_SQLITE:
        cursor.execute("UPDATE share_links SET access_count = access_count + 1 WHERE share_token = ?", (share_token,))
        conn.commit()
    else:
        cursor.execute("UPDATE share_links SET access_count = access_count + 1 WHERE share_token = %s", (share_token,))
        
    conn.close()

    return jsonify({
        'shareToken': row['share_token'],
        'fileId': row['file_id'],
        'filename': row['filename'],
        'fileSize': row['file_size'],
        'contentType': row['content_type'],
        'uploaderUsername': row['uploader_username'],
        'uploadTime': str(row['upload_time']),
        'expiresAt': str(row['expires_at']),
        'accessCount': row['access_count'] + 1
    })

@app.route('/api/share/<share_token>/download', methods=['GET'])
def download_shared_file(share_token):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_SQLITE:
        cursor.execute('''
            SELECT f.* FROM share_links s JOIN files f ON s.file_id = f.id
            WHERE s.share_token = ?
        ''', (share_token,))
    else:
        cursor.execute('''
            SELECT f.* FROM share_links s JOIN files f ON s.file_id = f.id
            WHERE s.share_token = %s
        ''', (share_token,))
        
    f = dict_from_row(cursor.fetchone())
    conn.close()

    if not f:
        return jsonify({'message': 'File not found'}), 404

    clean_filename = f['hdfs_path'].replace('/cloud-drive/', '')
    local_path = os.path.join(STORAGE_DIR, clean_filename)

    if not os.path.exists(local_path):
        with open(local_path, 'wb') as tmp:
            tmp.write(f"Sample demo content for {f['filename']}".encode('utf-8'))

    return send_file(local_path, as_attachment=True, download_name=f['filename'])

# =====================================================
# REST APIs - HDFS CONTROLLER
# =====================================================

@app.route('/api/hdfs/status', methods=['GET', 'OPTIONS'])
def get_hdfs_status():
    capacity = 536870912000  # 500 GB
    
    conn = get_db_connection()
    cursor = conn.cursor()
    if USE_SQLITE:
        cursor.execute("SELECT * FROM files ORDER BY id DESC")
    else:
        cursor.execute("SELECT * FROM files ORDER BY id DESC")
    rows = rows_to_list(cursor.fetchall())
    conn.close()

    mapped_files = [map_file_row(r) for r in rows if r]
    total_local = sum(r['fileSize'] for r in mapped_files)
    used = 42949672960 + total_local  # 40 GB base demo
    remaining = capacity - used
    used_percent = round((used / capacity) * 100, 1)

    hdfs_file_list = []
    for f in mapped_files:
        hdfs_file_list.append({
            'name': f['filename'],
            'path': f['hdfsPath'],
            'size': f['fileSize'],
            'blockSize': 134217728,  # 128 MB block size
            'replication': f['replicationFactor'],
            'isDirectory': False,
            'modificationTime': f['uploadTime']
        })

    return jsonify({
        'connected': True,
        'nameNode': 'hdfs://localhost:9000 (Python Mock Mode Active)',
        'hdfsRoot': '/cloud-drive',
        'capacityBytes': capacity,
        'usedBytes': used,
        'remainingBytes': remaining,
        'usedPercent': used_percent,
        'dataNodeCount': 3,
        'fileCountOnHdfs': len(hdfs_file_list),
        'files': hdfs_file_list,
        'note': 'Python Backend Active - Perfectly simulating Apache HDFS with 3 DataNodes & 128MB Blocks!',
        'dataNodes': [
            {'hostname': 'datanode-1.hdfs.local', 'capacity': capacity // 3, 'used': used // 3, 'remaining': remaining // 3, 'adminState': 'NORMAL_STATE'},
            {'hostname': 'datanode-2.hdfs.local', 'capacity': capacity // 3, 'used': used // 3, 'remaining': remaining // 3, 'adminState': 'NORMAL_STATE'},
            {'hostname': 'datanode-3.hdfs.local', 'capacity': capacity // 3, 'used': used // 3, 'remaining': remaining // 3, 'adminState': 'NORMAL_STATE'}
        ]
    })

@app.route('/api/hdfs/ping', methods=['GET'])
def hdfs_ping():
    return jsonify({
        'status': 'CONNECTED',
        'message': 'Python HDFS Backend Service is running successfully!'
    })


# -----------------------------------------------------
# CORS Preflight & Headers Handling
# -----------------------------------------------------
@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Username'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        return response, 200

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Username'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return response

# -----------------------------------------------------
# Serve Frontend directly at http://localhost:8080/
# -----------------------------------------------------
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

@app.route('/', methods=['GET'])
def serve_index():
    return send_file(os.path.join(FRONTEND_DIR, 'dashboard.html'))

@app.route('/<path:filename>', methods=['GET'])
def serve_static(filename):
    if filename.startswith('api/'):
        return jsonify({'message': 'API endpoint not found'}), 404
    file_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_file(file_path)
    return send_file(os.path.join(FRONTEND_DIR, 'dashboard.html'))

# =====================================================
# MAIN ENTRY POINT
# =====================================================
if __name__ == '__main__':
    print("=" * 60)
    print("🚀 HDFS CLOUD DRIVE - FAST PYTHON SERVER (WAITRESS)")
    print(" App URL: http://localhost:5000")
    print(" Database: MySQL / SQLite (Tự động thích ứng)")
    print(" Storage: Smart Mock HDFS Mode (Ổ C:\\Users\\...\\hdfs-storage-mock)")
    print("=" * 60)
    try:
        from waitress import serve
        serve(app, host='0.0.0.0', port=5000, threads=8)
    except Exception as e:
        app.run(host='127.0.0.1', port=5000, debug=False, threaded=True)



