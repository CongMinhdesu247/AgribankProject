package vn.com.agribank.service.agribankservicecv.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import vn.com.agribank.service.agribankservicecv.entity.TicketNotification;

public interface TicketNotificationRepository extends JpaRepository<TicketNotification, Long> {
    List<TicketNotification> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<TicketNotification> findByIdAndUserId(Long id, Long userId);
}
