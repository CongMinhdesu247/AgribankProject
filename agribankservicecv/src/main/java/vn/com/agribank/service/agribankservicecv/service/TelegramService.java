package vn.com.agribank.service.agribankservicecv.service;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

@Service
public class TelegramService {

    private static final Logger logger = LoggerFactory.getLogger(TelegramService.class);

    @Value("${telegram.bot.token:}")
    private String botToken;

    @Value("${telegram.bot.chat-id:}")
    private String chatId;

    private final RestTemplate restTemplate = new RestTemplate();

    public boolean sendP1Alert(String ticketCode, String title, String description) {
        if (isBlank(botToken) || isBlank(chatId)) {
            logger.error("Không gửi được cảnh báo P1: Railway chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_BOT_CHAT_ID");
            return false;
        }

        String messageText = "🚨 CẢNH BÁO SỰ CỐ NGHIÊM TRỌNG (P1) 🚨\n\n"
                + "📌 Mã Ticket: " + truncate(ticketCode, 100) + "\n"
                + "⚠️ Tiêu đề: " + truncate(title, 500) + "\n"
                + "📝 Mô tả: " + truncate(description, 3000) + "\n\n"
                + "⚡ Yêu cầu: Bộ phận CNTT tiếp nhận và xử lý khẩn cấp.";

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("chat_id", chatId.trim());
        requestBody.put("text", messageText);

        try {
            String url = "https://api.telegram.org/bot" + botToken.trim() + "/sendMessage";
            ResponseEntity<Map> response = restTemplate.postForEntity(url, requestBody, Map.class);
            Map<?, ?> responseBody = response.getBody();
            if (response.getStatusCode().is2xxSuccessful()
                    && responseBody != null
                    && Boolean.TRUE.equals(responseBody.get("ok"))) {
                logger.info("Telegram đã nhận cảnh báo P1 cho ticket {}", ticketCode);
                return true;
            }

            Object descriptionFromTelegram = responseBody == null ? null : responseBody.get("description");
            logger.error("Telegram từ chối cảnh báo P1 cho ticket {}: {}",
                    ticketCode, descriptionFromTelegram == null ? "phản hồi không hợp lệ" : descriptionFromTelegram);
        } catch (RestClientResponseException exception) {
            logger.error("Telegram trả HTTP {} khi gửi cảnh báo P1 cho ticket {}: {}",
                    exception.getStatusCode().value(), ticketCode, exception.getResponseBodyAsString());
        } catch (Exception exception) {
            // Không log URL hay exception message vì URL Telegram chứa bot token.
            logger.error("Lỗi kết nối Telegram khi gửi cảnh báo P1 cho ticket {} ({})",
                    ticketCode, exception.getClass().getSimpleName());
        }

        return false;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String truncate(String value, int maxCodePoints) {
        if (value == null) return "";
        int codePointCount = value.codePointCount(0, value.length());
        if (codePointCount <= maxCodePoints) return value;
        int endIndex = value.offsetByCodePoints(0, maxCodePoints - 1);
        return value.substring(0, endIndex) + "…";
    }
}
