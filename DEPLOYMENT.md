# Sửa lỗi đăng nhập/đăng ký trên Render

## Kết quả kiểm tra ngày 01/11/2026

- `agribank-ui.onrender.com/api/auth/login` và `/api/auth/register` ban đầu trả về HTTP 502 (HTML).
- API trực tiếp trả về `/health` HTTP 200. Sau khi API sẵn sàng, cùng đường đăng nhập qua giao diện trả về JSON bình thường.
- Yêu cầu đăng nhập bằng tài khoản chẩn đoán không tồn tại trả về HTTP 401 đúng dự kiến: truy vấn bảng tài khoản hoạt động.
- Đã kiểm tra trên Render: `API_UPSTREAM=https://agribank-api.onrender.com` đúng; không cần đổi thông tin Aiven để xử lý lỗi 502 này.
- Hai dịch vụ dùng gói Free. Render cho dịch vụ ngủ sau 15 phút không có lưu lượng và cần khoảng một phút để khởi động lại: https://render.com/docs/free#spinning-down-on-idle
- Nhật ký Render xác nhận API bắt đầu chạy lại lúc 17:53:26 và kết nối MySQL thành công lúc 17:53:30, sau thời điểm chụp lỗi 17:51.

## Thay đổi

Giao diện chờ phản hồi readiness JSON hợp lệ trong tối đa 90 giây trước khi gửi đăng nhập/đăng ký. Chỉ yêu cầu GET kiểm tra được thử lại; POST đăng ký/đăng nhập được gửi một lần. Proxy ánh xạ `/api/health` sang `/health` của backend. Thông báo cho người dùng phân biệt lỗi máy chủ chưa sẵn sàng với lỗi tài khoản.

## Đưa bản sửa lên dịch vụ hiện có

1. Đẩy các thay đổi của bản sửa lên nhánh `main` của repository đang liên kết với Render sau khi kiểm tra diff.
2. Đợi `agribank-ui` tự triển khai, hoặc chọn Manual Deploy → Deploy latest commit trong dịch vụ này. Không cần triển khai lại backend cho bản sửa này.
3. Giữ `API_UPSTREAM=https://agribank-api.onrender.com`. Không thêm `/api` vào biến này. Giao diện production mặc định dùng `/api` cùng tên miền.
4. Mở `https://agribank-ui.onrender.com/api/health`: sau khi khởi động cần nhận JSON `{"status":"ok"}`. Tải lại trang giao diện để lấy bản JavaScript mới.
5. Đăng nhập bằng tài khoản hợp lệ; thử đăng ký với mã nhân viên/email chưa sử dụng. Tài khoản IT vẫn cần mã mời do quản trị viên cung cấp.
6. Sau hơn 15 phút không truy cập, kiểm tra lại: giao diện cần hiện trạng thái đang kết nối và tự chờ API; không nhấn gửi liên tục.

Bản sửa không thay đổi database, không tạo tài khoản thử trên Aiven, không nâng cấp gói trả phí. Các kiểm thử cục bộ dùng backend giả lập; việc đăng nhập/đăng ký thành công với tài khoản thật vẫn cần xác nhận sau triển khai.

## Kiểm tra cục bộ

Trong thư mục `agribank-ui`: `npm ci`, `npm test`, `npm run build`. Quay lại bản triển khai trước trong Render nếu phát sinh vấn đề.
