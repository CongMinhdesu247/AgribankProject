const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

const app = express();
const PORT = Number(process.env.PORT || 5000);
const scrypt = promisify(crypto.scrypt);
const isProduction = process.env.NODE_ENV === 'production';
const TOKEN_SECRET = process.env.SESSION_SECRET || (!isProduction ? crypto.randomBytes(32).toString('hex') : undefined);
const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const revokedTokens = new Map();
if (!TOKEN_SECRET || Buffer.byteLength(TOKEN_SECRET) < 32) {
  throw new Error('SESSION_SECRET must be configured with at least 32 bytes.');
}

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET chưa được cấu hình; phiên đăng nhập sẽ hết hiệu lực khi khởi động lại backend.');
}
if (!process.env.IT_REGISTRATION_CODE) {
  console.warn('IT_REGISTRATION_CODE chưa được cấu hình; đăng ký tài khoản kỹ sư IT đang bị khóa.');
}

// Allow the local Vite app by default; add the public frontend URL in CORS_ORIGINS on deployment.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '32kb', strict: true }));

// Per-process throttling. Use a shared store (for example Redis) with multiple replicas.
const rateBuckets = new Map();
const rateLimit = ({ windowMs, limit, key = (req) => req.ip }) => (req, res, next) => {
  const now = Date.now();
  const bucketKey = `${req.path}:${key(req)}`;
  let bucket = rateBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(bucketKey, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({ message: 'Quá nhiều yêu cầu; vui lòng thử lại sau.' });
  }
  next();
};
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key);
}, 60_000).unref();

// 1. Configure MySQL through environment variables for local and hosted environments.
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || (!isProduction ? 'root' : undefined),
  password: process.env.DB_PASSWORD ?? (!isProduction ? '' : undefined),
  database: process.env.DB_NAME || 'agribank_helpdesk',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
if (isProduction && (!process.env.DB_USER || !process.env.DB_PASSWORD)) {
  throw new Error('DB_USER and DB_PASSWORD must be configured.');
}

const toPublicUser = (user) => ({
  id: user.id,
  employeeCode: user.employee_code,
  username: user.username,
  fullName: user.full_name,
  email: user.email,
  branchCode: user.branch_code,
  role: user.role === 'TECHNICIAN' ? 'IT_STAFF' : 'USER'
});

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('base64url');
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt}$${key.toString('base64url')}`;
};

const verifyPassword = async (password, storedValue) => {
  if (!storedValue?.startsWith('scrypt$')) {
    const supplied = Buffer.from(password);
    const existing = Buffer.from(storedValue || '');
    const valid = supplied.length === existing.length && crypto.timingSafeEqual(supplied, existing);
    return { valid, needsUpgrade: valid };
  }

  const [, n, r, p, salt, expectedKey] = storedValue.split('$');
  const expected = Buffer.from(expectedKey || '', 'base64url');
  if (!expected.length) return { valid: false, needsUpgrade: false };
  const actual = await scrypt(password, salt, expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024
  });
  return { valid: crypto.timingSafeEqual(actual, expected), needsUpgrade: false };
};

const createToken = (user) => {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    expiresAt: Date.now() + TOKEN_LIFETIME_MS
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const authenticate = async (req, res, next) => {
  try {
    const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const [payload, signature, extra] = (token || '').split('.');
    if (!payload || !signature || extra) return res.status(401).json({ message: 'Vui lòng đăng nhập lại' });

    const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest();
    const suppliedSignature = Buffer.from(signature, 'base64url');
    if (expectedSignature.length !== suppliedSignature.length || !crypto.timingSafeEqual(expectedSignature, suppliedSignature)) {
      return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ' });
    }

    const tokenData = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!tokenData.id || tokenData.expiresAt <= Date.now()) {
      return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn' });
    }
    const tokenFingerprint = crypto.createHash('sha256').update(token).digest('hex');
    if (revokedTokens.has(tokenFingerprint)) {
      return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn' });
    }

    const [rows] = await db.query(
      'SELECT id, username, employee_code, full_name, email, role, branch_code FROM users WHERE id = ?',
      [tokenData.id]
    );
    if (!rows.length) return res.status(401).json({ message: 'Tài khoản không còn tồn tại' });

    req.user = toPublicUser(rows[0]);
    next();
  } catch (error) {
    next(error);
  }
};

app.post('/api/auth/logout', authenticate, (req, res) => {
  const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (token) {
    const fingerprint = crypto.createHash('sha256').update(token).digest('hex');
    revokedTokens.set(fingerprint, Date.now() + TOKEN_LIFETIME_MS);
  }
  res.sendStatus(204);
});
setInterval(() => {
  const now = Date.now();
  for (const [fingerprint, expiresAt] of revokedTokens) {
    if (expiresAt <= now) revokedTokens.delete(fingerprint);
  }
}, 60_000).unref();

const requireTechnician = (req, res, next) => {
  if (req.user?.role !== 'IT_STAFF') {
    return res.status(403).json({ message: 'Chỉ kỹ sư IT được thực hiện thao tác này' });
  }
  next();
};

app.post('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5 }), async (req, res) => {
  try {
    const { employeeCode, fullName, branchCode, email, password, accountType, itRegistrationCode } = req.body;
    const normalizedCode = String(employeeCode || '').trim().toUpperCase();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = accountType === 'IT_STAFF' ? 'TECHNICIAN' : accountType === 'USER' ? 'REPORTER' : null;

    if (!/^[A-Z0-9._-]{2,30}$/.test(normalizedCode)) {
      return res.status(400).json({ message: 'Mã nhân viên cần có 2–30 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới' });
    }
    if (!String(fullName || '').trim() || String(fullName).trim().length > 100) {
      return res.status(400).json({ message: 'Vui lòng nhập họ và tên (tối đa 100 ký tự)' });
    }
    if (!String(branchCode || '').trim() || String(branchCode).trim().length > 20) {
      return res.status(400).json({ message: 'Vui lòng nhập mã chi nhánh (tối đa 20 ký tự)' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 100) {
      return res.status(400).json({ message: 'Vui lòng nhập email hợp lệ' });
    }
    if (typeof password !== 'string' || password.length < 10) {
      return res.status(400).json({ message: 'Mật khẩu cần có ít nhất 10 ký tự' });
    }
    if (!normalizedRole) {
      return res.status(400).json({ message: 'Loại tài khoản không hợp lệ' });
    }
    if (normalizedRole === 'TECHNICIAN') {
      const expectedCode = process.env.IT_REGISTRATION_CODE;
      if (!expectedCode || itRegistrationCode !== expectedCode) {
        return res.status(403).json({ message: 'Mã đăng ký kỹ sư IT không hợp lệ hoặc chưa được cấu hình' });
      }
    }

    const passwordHash = await hashPassword(password);
    const [result] = await db.query(
      `INSERT INTO users (username, employee_code, password, full_name, email, role, branch_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [normalizedCode, normalizedCode, passwordHash, String(fullName).trim(), normalizedEmail,
        normalizedRole, String(branchCode).trim().toUpperCase()]
    );
    const [rows] = await db.query(
      'SELECT id, username, employee_code, full_name, email, role, branch_code FROM users WHERE id = ?',
      [result.insertId]
    );
    const user = toPublicUser(rows[0]);
    res.status(201).json({ token: createToken(user), user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Mã nhân viên hoặc email đã được đăng ký' });
    }
    console.error('Register error:', error.code || error.name);
    res.status(500).json({ message: 'Không thể tạo tài khoản lúc này' });
  }
});

app.post('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8
}), async (req, res) => {
  try {
    const employeeCode = String(req.body.employeeCode || '').trim().toUpperCase();
    const { password, accountType } = req.body;
    const expectedRole = accountType === 'IT_STAFF' ? 'TECHNICIAN' : accountType === 'USER' ? 'REPORTER' : null;
    if (!employeeCode || typeof password !== 'string' || !expectedRole) {
      return res.status(400).json({ message: 'Vui lòng nhập mã nhân viên, mật khẩu và đúng loại tài khoản' });
    }

    const [rows] = await db.query(
      'SELECT id, username, employee_code, password, full_name, email, role, branch_code FROM users WHERE employee_code = ?',
      [employeeCode]
    );
    const account = rows[0];
    if (!account || account.role !== expectedRole) {
      return res.status(401).json({ message: 'Mã nhân viên, mật khẩu hoặc loại tài khoản không đúng' });
    }

    const passwordCheck = await verifyPassword(password, account.password);
    if (!passwordCheck.valid) {
      return res.status(401).json({ message: 'Mã nhân viên, mật khẩu hoặc loại tài khoản không đúng' });
    }
    if (passwordCheck.needsUpgrade) {
      await db.query('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(password), account.id]);
    }

    const user = toPublicUser(account);
    res.json({ token: createToken(user), user });
  } catch (error) {
    console.error('Login error:', error.code || error.name);
    res.status(500).json({ message: 'Không thể đăng nhập lúc này' });
  }
});

// Kiểm tra kết nối MySQL khi khởi động Server
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ Đã kết nối thành công tới Database MySQL agribank_helpdesk!');
    connection.release();
  } catch (error) {
    console.error('❌ Lỗi kết nối MySQL. Vui lòng bật module MySQL trong XAMPP!');
    console.error(error.code || error.name);
  }
})();

// ==========================================
// 2. CÁC REST API ENDPOINTS TƯƠNG TÁC DATABASE
// ==========================================

// GET: Lấy danh sách toàn bộ Ticket
app.get('/api/tickets', authenticate, async (req, res) => {
  try {
    const query = `
      SELECT 
        t.id,
        t.ticket_code AS ticketCode,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.category_id AS categoryId,
        c.name AS categoryName,
        t.reporter_id AS reporterId,
        u.full_name AS reporterName,
        t.technician_id AS technicianId,
        tech.full_name AS technicianName,
        t.sla_due_at AS slaDueAt,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM tickets t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.reporter_id = u.id
      LEFT JOIN users tech ON t.technician_id = tech.id
      WHERE (t.status <> 'RESOLVED'
         OR t.updated_at > DATE_SUB(NOW(), INTERVAL 2 DAY))
         AND (? = 'IT_STAFF' OR t.reporter_id = ?)
      ORDER BY t.created_at DESC
    `;
    const [rows] = await db.execute(query, [req.user.role, req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách ticket' });
  }
});

// POST: Tạo Ticket mới (Tự động tra cứu SLA từ bảng sla_configs)
app.post('/api/tickets', authenticate, rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, key: (req) => String(req.user.id) }), async (req, res) => {
  try {
    const { title, description, priority, categoryId } = req.body;

    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200 ||
        typeof description !== 'string' || !description.trim() || description.length > 10000) {
      return res.status(400).json({ message: 'Tiêu đề hoặc mô tả không hợp lệ.' });
    }

    const selectedPriority = String(priority || 'P3').toUpperCase();
    if (!['P1', 'P2', 'P3'].includes(selectedPriority)) {
      return res.status(400).json({ message: 'Mức độ ưu tiên không hợp lệ.' });
    }
    const selectedCategory = Number(categoryId || 1);
    if (!Number.isSafeInteger(selectedCategory) || selectedCategory < 1) {
      return res.status(400).json({ message: 'Danh mục không hợp lệ.' });
    }
    const selectedReporter = req.user.id;

    const [categoryRows] = await db.query(
      'SELECT id FROM categories WHERE id = ?',
      [selectedCategory]
    );
    if (categoryRows.length === 0) {
      return res.status(400).json({ message: 'Danh mục sự cố không hợp lệ' });
    }

    // Lấy thời hạn SLA từ bảng sla_configs
    const [slaRows] = await db.query(
      'SELECT max_resolution_hours FROM sla_configs WHERE priority = ?', 
      [selectedPriority]
    );
    const maxHours = slaRows.length > 0 ? slaRows[0].max_resolution_hours : 24;

    // Sinh mã Ticket chuẩn định dạng: TCK-YYYYMMDD-XXX
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const randomNum = Math.floor(100 + Math.random() * 900);
    const ticketCode = `TCK-${dateStr}-${randomNum}`;

    // Thêm ticket mới
    const [result] = await db.query(
      `INSERT INTO tickets 
        (ticket_code, title, description, priority, category_id, reporter_id, sla_due_at) 
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
      [ticketCode, title.trim(), description.trim(), selectedPriority, selectedCategory, selectedReporter, maxHours]
    );

    const ticketId = result.insertId;

    // Ghi nhận nhật ký vào bảng ticket_logs
    await db.query(
      `INSERT INTO ticket_logs (ticket_id, performed_by, action_type, comment) 
       VALUES (?, ?, 'CREATED', 'Khởi tạo yêu cầu hỗ trợ sự cố mới')`,
      [ticketId, selectedReporter]
    );

    const [newTicket] = await db.query(
      `SELECT t.id, t.ticket_code AS ticketCode, t.title, t.description, t.priority, t.status, 
              t.sla_due_at AS slaDueAt, t.created_at AS createdAt 
       FROM tickets t WHERE t.id = ?`, 
      [ticketId]
    );

    res.status(201).json(newTicket[0]);
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi tạo ticket mới' });
  }
});

// PATCH: Cập nhật trạng thái Ticket (OPEN -> IN_PROGRESS -> RESOLVED)
app.patch('/api/tickets/:id/status', authenticate, requireTechnician, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = new Set(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
    const normalizedStatus = String(status || '').toUpperCase();
    if (!validStatuses.has(normalizedStatus)) {
      return res.status(400).json({ message: 'Trạng thái ticket không hợp lệ' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [tickets] = await connection.query(
      `SELECT id, status, reporter_id AS reporterId, ticket_code AS ticketCode, title
       FROM tickets WHERE id = ? FOR UPDATE`,
      [id]
    );
    if (tickets.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy ticket' });
    }

    await connection.query('UPDATE tickets SET status = ? WHERE id = ?', [normalizedStatus, id]);

    // Ghi lịch sử chuyển trạng thái
    await connection.query(
      `INSERT INTO ticket_logs (ticket_id, performed_by, action_type, comment) 
       VALUES (?, ?, 'STATUS_CHANGED', ?)`,
      [id, req.user.id, `Cập nhật trạng thái sang: ${normalizedStatus}`]
    );

    if (normalizedStatus === 'RESOLVED' && tickets[0].status !== 'RESOLVED') {
      await connection.query(
        `INSERT INTO notifications (user_id, ticket_id, type, message)
         VALUES (?, ?, 'TICKET_RESOLVED', ?)`,
        [
          tickets[0].reporterId,
          id,
          `Sự cố "${tickets[0].title}" (${tickets[0].ticketCode}) đã được giải quyết.`
        ]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(400).json({ message: 'Lỗi khi cập nhật trạng thái' });
  } finally {
    connection?.release();
  }
});

// GET: Lấy toàn bộ tin nhắn phản hồi của 1 Ticket
app.get('/api/tickets/:ticketId/comments', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const query = `
      SELECT 
        l.id,
        l.ticket_id AS ticketId,
        l.performed_by AS performedBy,
        u.full_name AS sender,
        l.action_type AS actionType,
        l.comment AS text,
        l.created_at AS createdAt
      FROM ticket_logs l
      JOIN users u ON l.performed_by = u.id
      WHERE l.ticket_id = ? AND l.action_type = 'COMMENT'
      ORDER BY l.created_at ASC
    `;
    const [access] = await db.execute(
      "SELECT id FROM tickets WHERE id = ? AND (? = 'IT_STAFF' OR reporter_id = ?)",
      [ticketId, req.user.role, req.user.id]
    );
    if (!access.length) return res.status(404).json({ message: 'Không tìm thấy ticket' });
    const [rows] = await db.execute(query, [ticketId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy tin nhắn' });
  }
});

// POST: Gửi tin nhắn phản hồi mới
app.post('/api/tickets/:ticketId/comments', authenticate, rateLimit({ windowMs: 60 * 60 * 1000, limit: 60, key: (req) => String(req.user.id) }), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    if (typeof text !== 'string' || !text.trim() || text.length > 5000) {
      return res.status(400).json({ message: 'Nội dung bình luận không hợp lệ.' });
    }
    const [access] = await db.execute(
      "SELECT id FROM tickets WHERE id = ? AND (? = 'IT_STAFF' OR reporter_id = ?)",
      [ticketId, req.user.role, req.user.id]
    );
    if (!access.length) return res.status(404).json({ message: 'Không tìm thấy ticket' });

    const [result] = await db.query(
      `INSERT INTO ticket_logs (ticket_id, performed_by, action_type, comment) 
       VALUES (?, ?, 'COMMENT', ?)`,
      [ticketId, userId, text.trim()]
    );

    const [newComment] = await db.query(
      `SELECT l.id, l.ticket_id AS ticketId, u.full_name AS sender, l.comment AS text, l.created_at AS createdAt 
       FROM ticket_logs l 
       JOIN users u ON l.performed_by = u.id 
       WHERE l.id = ?`,
      [result.insertId]
    );

    res.status(201).json(newComment[0]);
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi gửi tin nhắn' });
  }
});

// GET: Lấy danh sách danh mục sự cố
app.get('/api/categories', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categories ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy danh sách danh mục' });
    }
});

app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, ticket_id AS ticketId, type, message,
              created_at AS createdAt, read_at AS readAt
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải thông báo' });
  }
});

app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const [result] = await db.query(
      'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      const [rows] = await db.query(
        'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy thông báo' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật thông báo' });
  }
});

// GET: Lấy danh sách người dùng cho kỹ sư IT
app.get('/api/users', authenticate, requireTechnician, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, username, full_name, email, role, branch_code FROM users');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy danh sách người dùng' });
    }
});

// Khởi chạy Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server Backend Node.js đang chạy tại http://localhost:${PORT}`);
});
