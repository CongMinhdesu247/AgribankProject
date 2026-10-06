package vn.com.agribank.service.agribankservicecv.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import vn.com.agribank.service.agribankservicecv.entity.Ticket;
import vn.com.agribank.service.agribankservicecv.entity.TicketComment;
import vn.com.agribank.service.agribankservicecv.entity.TicketNotification;
import vn.com.agribank.service.agribankservicecv.repository.TicketCommentRepository;
import vn.com.agribank.service.agribankservicecv.repository.TicketNotificationRepository;
import vn.com.agribank.service.agribankservicecv.service.TicketService;

@RestController
@RequestMapping("/api")
public class TicketController {

    private final TicketService ticketService;
    private final TicketCommentRepository commentRepository;
    private final TicketNotificationRepository notificationRepository;
    private final JdbcTemplate jdbcTemplate;

    public TicketController(
            TicketService ticketService,
            TicketCommentRepository commentRepository,
            TicketNotificationRepository notificationRepository,
            JdbcTemplate jdbcTemplate) {
        this.ticketService = ticketService;
        this.commentRepository = commentRepository;
        this.notificationRepository = notificationRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/tickets")
    public ResponseEntity<List<Ticket>> getAllTickets(HttpServletRequest request) {
        if ("TECHNICIAN".equals(request.getAttribute("authRole"))) {
            return ResponseEntity.ok(ticketService.getAllTickets());
        }
        return ResponseEntity.ok(ticketService.getTicketsForReporter((Long) request.getAttribute("authUserId")));
    }

    @PostMapping("/tickets")
    public ResponseEntity<Ticket> createTicket(@RequestBody Ticket ticket, HttpServletRequest request) {
        ticket.setReporterId((Long) request.getAttribute("authUserId"));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ticketService.createTicket(ticket));
    }

    @PatchMapping("/tickets/{ticketId}/status")
    public ResponseEntity<Ticket> updateTicketStatus(
            @PathVariable Long ticketId,
            @RequestBody Map<String, Object> request) {
        Object rawStatus = request.get("status");
        String status = rawStatus instanceof String ? (String) rawStatus : null;
        if (status == null || status.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái không được để trống");
        }
        return ResponseEntity.ok(ticketService.updateTicketStatus(ticketId, status));
    }

    @GetMapping("/tickets/{ticketId}/comments")
    public ResponseEntity<List<Map<String, Object>>> getComments(@PathVariable Long ticketId) {
        List<Map<String, Object>> comments = commentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId)
                .stream()
                .map(this::toCommentResponse)
                .toList();
        return ResponseEntity.ok(comments);
    }

    @PostMapping("/tickets/{ticketId}/comments")
    public ResponseEntity<Map<String, Object>> addComment(
            @PathVariable Long ticketId,
            @RequestBody Map<String, Object> commentData,
            HttpServletRequest request) {
        String text = firstString(commentData, "text", "content");
        if (text.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nội dung trao đổi không được để trống");
        }

        TicketComment comment = new TicketComment();
        comment.setTicketId(ticketId);
        Long senderId = (Long) request.getAttribute("authUserId");
        comment.setSenderId(senderId);
        comment.setSenderName(jdbcTemplate.queryForObject(
                "SELECT full_name FROM users WHERE id = ?", String.class, senderId));
        comment.setSenderRole("TECHNICIAN".equals(request.getAttribute("authRole")) ? "IT_STAFF" : "USER");
        comment.setContent(text);

        TicketComment savedComment = commentRepository.save(comment);
        return ResponseEntity.status(HttpStatus.CREATED).body(toCommentResponse(savedComment));
    }

    @GetMapping("/categories")
    public ResponseEntity<List<Map<String, Object>>> getCategories() {
        return ResponseEntity.ok(List.of(
            Map.of("id", 1, "name", "Core Banking"),
            Map.of("id", 2, "name", "Phần mềm & ứng dụng"),
            Map.of("id", 3, "name", "Mạng & Thẻ ATM")
        ));
    }

    @GetMapping("/notifications")
    public ResponseEntity<List<Map<String, Object>>> getNotifications(
            @RequestParam(required = false) Long ignoredUserId, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("authUserId");
        List<Map<String, Object>> notifications = notificationRepository
                .findTop50ByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toNotificationResponse)
                .toList();
        return ResponseEntity.ok(notifications);
    }

    @PatchMapping("/notifications/{notificationId}/read")
    public ResponseEntity<Map<String, Object>> markNotificationRead(
            @PathVariable Long notificationId,
            @RequestParam(required = false) Long ignoredUserId, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("authUserId");
        TicketNotification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy thông báo"));
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getUsers() {
        return ResponseEntity.ok(List.of());
    }

    private Map<String, Object> toCommentResponse(TicketComment comment) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", comment.getId());
        response.put("ticketId", comment.getTicketId());
        response.put("senderId", comment.getSenderId());
        response.put("sender", comment.getSenderName());
        response.put("senderRole", comment.getSenderRole());
        response.put("text", comment.getContent());
        response.put("createdAt", comment.getCreatedAt());
        return response;
    }

    private Map<String, Object> toNotificationResponse(TicketNotification notification) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", notification.getId());
        response.put("ticketId", notification.getTicketId());
        response.put("type", notification.getType());
        response.put("message", notification.getMessage());
        response.put("createdAt", notification.getCreatedAt());
        response.put("readAt", notification.getReadAt());
        return response;
    }

    private String firstString(Map<String, Object> values, String... keys) {
        for (String key : keys) {
            Object value = values.get(key);
            if (value instanceof String text && !text.isBlank()) return text.trim();
        }
        return "";
    }
}
