package vn.com.agribank.service.agribankservicecv.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import vn.com.agribank.service.agribankservicecv.entity.Ticket;
import vn.com.agribank.service.agribankservicecv.service.TicketService;

@RestController
@RequestMapping("/api/v1/tickets")
@CrossOrigin(origins = "http://localhost:5173")
public class TicketController {

    private final List<Map<String, Object>> commentStore = new CopyOnWriteArrayList<>();
    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @GetMapping
    public ResponseEntity<List<Ticket>> getAllTickets() {
        return ResponseEntity.ok(ticketService.getAllTickets());
    }

    @PostMapping
    public ResponseEntity<Ticket> createTicket(@RequestBody Ticket ticket) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ticketService.createTicket(ticket));
    }

    @PatchMapping("/{ticketId}/status")
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

    @GetMapping("/{ticketId}/comments")
    public ResponseEntity<List<Map<String, Object>>> getComments(@PathVariable Long ticketId) {
        List<Map<String, Object>> comments = commentStore.stream()
                .filter(comment -> ticketId.equals(comment.get("ticketId")))
                .toList();
        return ResponseEntity.ok(comments);
    }

    @PostMapping("/{ticketId}/comments")
    public ResponseEntity<Map<String, Object>> addComment(
            @PathVariable Long ticketId,
            @RequestBody Map<String, Object> commentData) {
        Map<String, Object> comment = new HashMap<>(commentData);
        comment.put("id", System.currentTimeMillis());
        comment.put("ticketId", ticketId);
        comment.put("createdAt", LocalDateTime.now());
        commentStore.add(comment);
        return ResponseEntity.status(HttpStatus.CREATED).body(comment);
    }
}
