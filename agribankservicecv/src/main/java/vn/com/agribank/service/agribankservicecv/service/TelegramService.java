package vn.com.agribank.service.agribankservicecv.service;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class TelegramService {

    @Value("${telegram.bot.token}")
    private String botToken;

    @Value("${telegram.bot.chat-id}")
    private String chatId;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Gửi cảnh báo khẩn cấp cho sự cố P1 tới Telegram
     */
    public void sendP1Alert(String ticketCode, String title, String description) {
        String url = "https://api.telegram.org/bot" + botToken + "/sendMessage";

        // Định dạng nội dung tin nhắn cảnh báo
        String messageText = String.format(
            "🚨 *CẢNH BÁO SỰ CỐ NGHIÊM TRỌNG (P1)* 🚨\n\n" +
            "📌 *Mã Ticket:* `%s`\n" +
            "⚠️ *Tiêu đề:* %s\n" +
            "📝 *Mô tả:* %s\n\n" +
            "⚡ *Yêu cầu:* Lãnh đạo & Chuyên viên CNTT tiếp nhận xử lý ngay trong 2 giờ!",
            ticketCode, title, description
        );

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("chat_id", chatId);
        requestBody.put("text", messageText);
        requestBody.put("parse_mode", "Markdown");

        try {
            restTemplate.postForObject(url, requestBody, String.class);
            System.out.println(">>> [TELEGRAM SUCCESS] Đã gửi cảnh báo P1 cho ticket: " + ticketCode);
        } catch (Exception e) {
            System.err.println("❌ [TELEGRAM ERROR] Không thể gửi tin nhắn: " + e.getMessage());
        }
    }
}