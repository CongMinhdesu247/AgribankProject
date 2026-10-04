package vn.com.agribank.service.agribankservicecv.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import vn.com.agribank.service.agribankservicecv.entity.Ticket;
import vn.com.agribank.service.agribankservicecv.repository.TicketRepository;

@Service
public class TicketService {

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private TelegramService telegramService;

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
    public Ticket updateTicketStatus(Long ticketId, String newStatus) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Ticket với ID: " + ticketId));
        
        ticket.setStatus(newStatus.toUpperCase());
        return ticketRepository.save(ticket);
    }
}