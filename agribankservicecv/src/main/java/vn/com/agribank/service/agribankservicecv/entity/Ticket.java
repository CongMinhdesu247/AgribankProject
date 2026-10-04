package vn.com.agribank.service.agribankservicecv.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tickets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_code", nullable = false, unique = true, length = 30)
    private String ticketCode;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(nullable = false, length = 10)
    private String priority; // P1, P2, P3

    @Column(nullable = false, length = 20)
    private String status; // OPEN, IN_PROGRESS, RESOLVED, CLOSED

    @Column(name = "category_id", nullable = false)
    private Integer categoryId;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    @Column(name = "technician_id")
    private Long technicianId;

    @Column(name = "sla_due_at")
    private LocalDateTime slaDueAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}