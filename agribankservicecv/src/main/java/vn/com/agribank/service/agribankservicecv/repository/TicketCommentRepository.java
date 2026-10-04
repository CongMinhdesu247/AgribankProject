package vn.com.agribank.service.agribankservicecv.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import vn.com.agribank.service.agribankservicecv.entity.TicketComment;

public interface TicketCommentRepository extends JpaRepository<TicketComment, Long> {
    List<TicketComment> findByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
