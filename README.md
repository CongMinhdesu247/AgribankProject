Agribank Helpdesk
Ứng dụng quản lý yêu cầu hỗ trợ CNTT: nhân viên báo sự cố, kỹ sư IT tiếp nhận và cập nhật tiến độ xử lý.
Chức năng
- Đăng ký, đăng nhập và phân quyền nhân viên / kỹ sư IT.
- Tạo ticket theo danh mục, mức ưu tiên và thời hạn SLA.
- Theo dõi trạng thái, trao đổi qua bình luận và nhận thông báo xử lý.
- Xem thống kê sự cố trên dashboard.
Công nghệ
Thành phần	Công nghệ
Frontend	React, Vite, Recharts
Backend triển khai	Node.js, Express
Database	MySQL
Triển khai	Docker Compose, Cloudflare Tunnel


Chạy bằng Docker
Chạy tại thư mục gốc dự án trên Ubuntu, cần Docker Compose và Python 3:
python3 ops/init-env.py  # Chỉ chạy lần đầu để tạo .env
sudo docker compose --parallel 1 build
sudo docker compose up -d --wait --wait-timeout 300
Truy cập trên máy chạy Docker: http://127.0.0.1:8093.
Lần đầu khởi chạy sẽ tạo database riêng. Giữ kín file .env; dữ liệu được lưu trong Docker volume.