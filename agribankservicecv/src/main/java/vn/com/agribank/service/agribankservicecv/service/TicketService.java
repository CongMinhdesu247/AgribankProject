package vn.com.agribank.service.agribankservicecv.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.com.agribank.service.agribankservicecv.entity.Ticket;
import vn.com.agribank.service.agribankservicecv.entity.TicketNotification;
import vn.com.agribank.service.agribankservicecv.repository.TicketRepository;
import vn.com.agribank.service.agribankservicecv.repository.TicketNotificationRepository;

@Service
public class TicketService {

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private TelegramService telegramService;

    @Autowired
    private TicketNotificationRepository notificationRepository;

    public List<Ticket> getAllTickets() {
        return ticketRepository.findAll();
    }

    public Ticket createTicket(Ticket ticket) {
        String generatedCode = "TCK-" + (System.currentTimeMillis() % 1000000);
        ticket.setTicketCode(generatedCode);
        ticket.setStatus("OPEN");

        LocalDateTime now = LocalDateTime.now();
        if ("P1".equalsIgnoreCase(ticket.getPriority())) {
            ticket.setSlaDueAt(now.plusHours(2));
        } else if ("P2".equalsIgnoreCase(ticket.getPriority())) {
            ticket.setSlaDueAt(now.plusHours(8));
        } else {
            ticket.setSlaDueAt(now.plusHours(24));
        }

        Ticket savedTicket = ticketRepository.save(ticket);

        if ("P1".equalsIgnoreCase(savedTicket.getPriority())) {
            telegramService.sendP1Alert(
                savedTicket.getTicketCode(),
                savedTicket.getTitle(),
                savedTicket.getDescription()
            );
        }

        return savedTicket;
    }

    /**
     * 1. Phân công Chuyên viên CNTT tiếp nhận Ticket
     */
    public Ticket assignTechnician(Long ticketId, Long technicianId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Ticket với ID: " + ticketId));
        
        ticket.setTechnicianId(technicianId);
        ticket.setStatus("IN_PROGRESS"); // Đổi trạng thái sang Đang xử lý
        return ticketRepository.save(ticket);
    }

    /**
     * 2. Cập nhật Trạng thái Ticket (RESOLVED, CLOSED...)
     */
    @Transactional
    public Ticket updateTicketStatus(Long ticketId, String newStatus) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Ticket với ID: " + ticketId));
        
        String normalizedStatus = newStatus.trim().toUpperCase();
        boolean newlyResolved = "RESOLVED".equals(normalizedStatus)
                && !"RESOLVED".equalsIgnoreCase(ticket.getStatus());
        ticket.setStatus(normalizedStatus);
        Ticket savedTicket = ticketRepository.save(ticket);

        if (newlyResolved && savedTicket.getReporterId() != null) {
            TicketNotification notification = new TicketNotification();
            notification.setUserId(savedTicket.getReporterId());
            notification.setTicketId(savedTicket.getId());
            notification.setType("TICKET_RESOLVED");
            notification.setMessage(String.format(
                    "Sự cố \"%s\" (%s) đã được giải quyết.",
                    savedTicket.getTitle(), savedTicket.getTicketCode()));
            notificationRepository.save(notification);
        }

        return savedTicket;
    }
}
