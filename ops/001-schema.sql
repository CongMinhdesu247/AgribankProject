-- Fresh MySQL volume ONLY. Existing databases need reviewed migrations, not this file.
-- V2, V3 and V4 from the source run next via docker-entrypoint-initdb.d.
CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  role ENUM('REPORTER','TECHNICIAN') NOT NULL DEFAULT 'REPORTER',
  branch_code VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categories (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sla_configs (
  priority VARCHAR(10) NOT NULL PRIMARY KEY,
  max_resolution_hours INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Initial demo policy; review these hours before real use.
INSERT INTO sla_configs VALUES ('P1',4),('P2',8),('P3',24);

CREATE TABLE tickets (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_code VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'P3',
  status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  category_id INT NOT NULL,
  reporter_id BIGINT NOT NULL,
  technician_id BIGINT NULL,
  sla_due_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tickets_reporter_created (reporter_id, created_at),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (technician_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ticket_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  performed_by BIGINT NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_logs_ticket_created (ticket_id, created_at),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
