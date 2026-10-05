import React, { useState, useEffect } from 'react';
import { ticketService } from './services/api';
import Login from './Login';
import Dashboard from './Dashboard';
import TicketChatModal from './TicketChatModal';
import { 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  ShieldAlert, 
  PlusCircle, 
  User, 
  LogOut,
  FileText,
  XCircle,
  MessageSquare,
  Bell
} from 'lucide-react';
import './App.css';

const TWO_DAYS_IN_MS = 2 * 24 * 60 * 60 * 1000;

const normalizeUserRole = (user) => {
  if (!user) return user;

  const role = String(user.role || user.accountType || user.type || user.userType || '').toUpperCase();
  if (['IT_STAFF', 'CAN_BO_IT', 'TECHNICIAN'].includes(role)) {
    return { ...user, role: 'IT_STAFF' };
  }
  if (['USER', 'CAN_BO_SU_DUNG', 'CAN_BO', 'REPORTER'].includes(role)) {
    return { ...user, role: 'USER' };
  }
  return user;
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedToken = localStorage.getItem('agri_token');
    const savedUser = localStorage.getItem('agri_user');
    return savedToken && savedUser ? normalizeUserRole(JSON.parse(savedUser)) : null;
  });

  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [categories, setCategories] = useState([]); // 🟢 State lưu danh mục sự cố
  const [loading, setLoading] = useState(false);
  
  // State quản lý Chat Modal
  const [activeChatTicket, setActiveChatTicket] = useState(null);

  // State quản lý Tìm kiếm & Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'P3',
    categoryId: 1,
    reporterId: 1
  });

  // Tải dữ liệu Tickets và Categories từ Backend
  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const ticketData = await ticketService.getAllTickets();
      setTickets(ticketData);

      // Gọi API lấy danh mục nếu dịch vụ hỗ trợ
      if (ticketService.getCategories) {
        const categoryData = await ticketService.getCategories();
        setCategories(categoryData);
        if (categoryData.length > 0 && !categoryData.some((category) => category.id === formData.categoryId)) {
          setFormData(prev => ({ ...prev, categoryId: categoryData[0].id }));
        }
      }
    } catch (error) {
      console.error("Lỗi khi kết nối Backend:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshNotifications = async () => {
    try {
      setNotifications(await ticketService.getNotifications(currentUser?.id || 1));
    } catch (error) {
      console.error('Lỗi khi tải thông báo:', error);
    }
  };

  useEffect(() => {
    if (!currentUser) return undefined;
    fetchData();
    refreshNotifications();
    const intervalId = window.setInterval(refreshNotifications, 15000);
    return () => window.clearInterval(intervalId);
  }, [currentUser]);

  const handleLoginSuccess = ({ user, token }) => {
    const normalizedUser = normalizeUserRole(user);
    localStorage.setItem('agri_token', token);
    localStorage.setItem('agri_user', JSON.stringify(normalizedUser));
    setCurrentUser(normalizedUser);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setNotifications([]);
    setNotificationsOpen(false);
    localStorage.removeItem('agri_token');
    localStorage.removeItem('agri_user');
  };

  const handleNotificationClick = async (notification) => {
    if (notification.readAt) return;
    try {
      await ticketService.markNotificationRead(notification.id, currentUser?.id || 1);
      setNotifications((previous) => previous.map((item) => item.id === notification.id
        ? { ...item, readAt: new Date().toISOString() }
        : item));
    } catch (error) {
      alert('Không thể cập nhật thông báo: ' + error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      alert("Vui lòng điền đầy đủ tiêu đề và mô tả sự cố!");
      return;
    }

    try {
      const nowISO = new Date().toISOString();

      const createdTicket = await ticketService.createTicket({
        ...formData,
        reporterId: currentUser?.id || 1,
        createdAt: nowISO
      });

      const successMessage = formData.priority === 'P1'
        ? createdTicket.telegramAlertSent === true
          ? `🚨 Ticket P1 ${createdTicket.ticketCode || ''} đã tạo và gửi cảnh báo Telegram thành công.`
          : `Ticket P1 ${createdTicket.ticketCode || ''} đã được tạo, nhưng Telegram chưa nhận được cảnh báo. Vui lòng báo trực tiếp bộ phận IT.`
        : "✅ Đã tạo Ticket thành công!";
      alert(successMessage);
      
      setFormData({ 
        title: '', 
        description: '', 
        priority: 'P3', 
        categoryId: categories[0]?.id || 1, 
        reporterId: currentUser?.id || 1 
      });
      fetchData(); // Tải lại dữ liệu
    } catch (error) {
      alert("Lỗi khi tạo Ticket: " + error.message);
    } 
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const performedBy = currentUser?.role === 'IT_STAFF' ? 2 : currentUser?.id || 1;
      await ticketService.updateStatus(id, newStatus, performedBy);
      fetchData();
    } catch (error) {
      alert("Lỗi khi cập nhật trạng thái: " + error.message);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterStatus('ALL');
    setFilterPriority('ALL');
  };

  const formatDateTime = (dateTimeValue) => {
    if (!dateTimeValue) return 'Vừa xong';
    try {
      const date = new Date(dateTimeValue);
      if (isNaN(date.getTime())) return dateTimeValue;
      return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return dateTimeValue;
    }
  };

  // LOGIC LỌC VÀ SẮP XẾP TICKET
  const processedTickets = tickets
    .filter((ticket) => {
      if (ticket.status === 'RESOLVED') {
        const completedTime = ticket.resolvedAt || ticket.updatedAt || ticket.slaDueAt;
        if (completedTime) {
          const timeDiff = Date.now() - new Date(completedTime).getTime();
          if (timeDiff >= TWO_DAYS_IN_MS) return false;
        }
      }

      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = term === '' ||
        (ticket.ticketCode && ticket.ticketCode.toLowerCase().includes(term)) ||
        (ticket.title && ticket.title.toLowerCase().includes(term)) ||
        (ticket.description && ticket.description.toLowerCase().includes(term));

      const matchesStatus = filterStatus === 'ALL' || ticket.status === filterStatus;
      const matchesPriority = filterPriority === 'ALL' || ticket.priority === filterPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      const statusWeight = { OPEN: 1, IN_PROGRESS: 1, RESOLVED: 2 };
      const weightA = statusWeight[a.status] || 1;
      const weightB = statusWeight[b.status] || 1;

      if (weightA !== weightB) return weightA - weightB;

      const priorityWeight = { P1: 1, P2: 2, P3: 3 };
      const pA = priorityWeight[a.priority] || 99;
      const pB = priorityWeight[b.priority] || 99;

      if (pA !== pB) return pA - pB;

      return (b.id || 0) - (a.id || 0);
    });

  if (!currentUser) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} />
        <SiteFooter />
      </>
    );
  }

  const renderFilterBar = () => (
    <div style={{
      display: 'flex',
      gap: '12px',
      marginBottom: '16px',
      flexWrap: 'wrap',
      backgroundColor: '#F8F9FA',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid #E9ECEF',
      alignItems: 'center'
    }}>
      <div style={{ flex: 1, minWidth: '220px' }}>
        <input 
          type="text" 
          placeholder="🔍 Tìm theo mã ticket, tiêu đề, nội dung..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #CED4DA',
            fontSize: '13px',
            outline: 'none'
          }}
        />
      </div>

      <div style={{ minWidth: '160px' }}>
        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #CED4DA',
            fontSize: '13px',
            backgroundColor: '#FFF'
          }}
        >
          <option value="ALL">📌 Tất cả trạng thái</option>
          <option value="OPEN">OPEN (Mới)</option>
          <option value="IN_PROGRESS">IN_PROGRESS (Đang xử lý)</option>
          <option value="RESOLVED">RESOLVED (Hoàn thành)</option>
        </select>
      </div>

      <div style={{ minWidth: '160px' }}>
        <select 
          value={filterPriority} 
          onChange={(e) => setFilterPriority(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #CED4DA',
            fontSize: '13px',
            backgroundColor: '#FFF'
          }}
        >
          <option value="ALL">⚡ Tất cả mức ưu tiên</option>
          <option value="P1">🚨 P1 - Nghiêm trọng</option>
          <option value="P2">⚠️ P2 - Cao</option>
          <option value="P3">🟢 P3 - Bình thường</option>
        </select>
      </div>

      {(searchTerm || filterStatus !== 'ALL' || filterPriority !== 'ALL') && (
        <button
          type="button"
          onClick={handleResetFilters}
          style={{
            padding: '8px 12px',
            backgroundColor: '#DC3545',
            color: '#FFF',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <XCircle size={14} />
          <span>Bỏ lọc</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="app-container">
      {/* Header Banner */}
      <header className="agri-header">
        <div className="banner-wrapper">
          <a className="agri-banner-link" href="https://www.agribank.com.vn/vn/home"
            target="_blank" rel="noreferrer" aria-label="Mở trang chủ Agribank">
            <img 
              src="/agribank-logo.jpg" 
              alt="Agribank" 
              className="agri-banner-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </a>
        </div>

        <div className="header-bar">
          <div className="header-title-container">
            <ShieldAlert size={22} className="gold-icon" />
            <div className="header-text">
              <h1 className="header-title-text">HỆ THỐNG HELPDESK BÁO LỖI CNTT</h1>
              <p className="header-subtitle-text">Trung Tâm Công Nghệ Thông Tin - Ngân Hàng Nông Nghiệp & PTNT Việt Nam</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right', fontSize: '13px' }}>
              <div style={{ fontWeight: '700', color: '#E2B13C', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={15} />
                <span>{currentUser.fullName}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#F8D7DA', opacity: 0.85 }}>
                Quyền: {currentUser.role === 'IT_STAFF' ? 'Kỹ sư IT Bảo trì' : 'Cán bộ Sử dụng'}
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                aria-label="Thông báo"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
                style={{
                  position: 'relative', display: 'grid', placeItems: 'center', width: '38px', height: '38px',
                  borderRadius: '50%', border: '1px solid #E2B13C', color: '#FFF',
                  background: 'rgba(255, 255, 255, 0.12)', cursor: 'pointer'
                }}
              >
                <Bell size={17} />
                {notifications.some((notification) => !notification.readAt) && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px', minWidth: '17px', height: '17px',
                    borderRadius: '9px', padding: '0 3px', background: '#DC2626', color: '#FFF',
                    fontSize: '10px', lineHeight: '17px', fontWeight: 700
                  }}>
                    {notifications.filter((notification) => !notification.readAt).length}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div style={{
                  position: 'absolute', zIndex: 20, top: '46px', right: 0, width: 'min(340px, 85vw)',
                  maxHeight: '360px', overflowY: 'auto', background: '#FFF', color: '#2D3748',
                  border: '1px solid #E2B13C', borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)'
                }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: 700 }}>
                    Thông báo
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '18px 14px', color: '#64748B', fontSize: '13px' }}>
                      Chưa có thông báo.
                    </div>
                  ) : notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      style={{
                        width: '100%', padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                        border: 0, borderBottom: '1px solid #E2E8F0',
                        background: notification.readAt ? '#FFF' : '#FFF8E7'
                      }}
                    >
                      <span style={{ display: 'block', fontSize: '13px', lineHeight: 1.45 }}>
                        {notification.message}
                      </span>
                      <span style={{ display: 'block', marginTop: '5px', color: '#64748B', fontSize: '11px' }}>
                        {formatDateTime(notification.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-refresh" onClick={fetchData} disabled={loading} title="Làm mới">
              <RefreshCw className={loading ? "spin" : ""} size={15} />
            </button>

            <button 
              type="button" 
              onClick={handleLogout}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid #E2B13C',
                color: '#FFF',
                padding: '8px 14px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <LogOut size={14} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* VIEW DÀNH CHO CÁN BỘ SỬ DỤNG (USER) */}
      {currentUser.role === 'USER' && (
        <div className="main-content" style={{ gridTemplateColumns: '380px 1fr' }}>
          <div className="card form-card">
            <div className="card-header">
              <PlusCircle size={20} className="card-icon" />
              <h2>Gửi Yêu Cầu Hỗ Trợ Mới</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tiêu đề sự cố:</label>
                <input 
                  type="text" 
                  placeholder="VD: Không hạch toán được"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>

              {/* 🟢 Bổ sung Dropdown chọn Danh Mục từ CSDL */}
              <div className="form-group">
                <label>Danh mục sự cố:</label>
                <select 
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({...formData, categoryId: Number(e.target.value)})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CED4DA',
                    fontSize: '13px',
                    backgroundColor: '#FFF'
                  }}
                >
                  {categories.length === 0 ? (
                    <option value="" disabled>Không tải được danh mục sự cố</option>
                  ) : categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Mức độ ưu tiên (SLA):</label>
                <select 
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  className={`priority-select p-${formData.priority.toLowerCase()}`}
                >
                  <option value="P3">P3 - BÌNH THƯỜNG (Xử lý trong 24h)</option>
                  <option value="P2">P2 - CAO (Xử lý trong 8h)</option>
                  <option value="P1">🚨 P1 - NGHIÊM TRỌNG (Bắn Cảnh Báo Telegram - 2h)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Mô tả chi tiết lỗi:</label>
                <textarea 
                  rows="4" 
                  placeholder="Mô tả các bước xảy ra lỗi, mã lỗi hiển thị..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>

              <button type="submit" className="btn-agri-primary" disabled={categories.length === 0}>
                <span className="btn-icon">✈</span>
                <span>Gửi Yêu Cầu Hỗ Trợ</span>
              </button>
            </form>
          </div>

          <div className="card list-card">
            <div className="card-header">
              <FileText size={20} className="card-icon" />
              <h2>Trạng Thái Ticket Đã Gửi ({processedTickets.length})</h2>
            </div>

            {renderFilterBar()}

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mã Ticket</th>
                    <th>Tiêu đề & Mô tả</th>
                    <th>Ưu tiên</th>
                    <th>Trạng thái</th>
                    <th>Thời gian gửi</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {processedTickets.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-table">Không tìm thấy ticket trùng khớp.</td>
                    </tr>
                  ) : (
                    processedTickets.map((t) => (
                      <tr key={t.id}>
                        <td><span className="ticket-code">{t.ticketCode}</span></td>
                        <td>
                          <div className="ticket-title">{t.title}</div>
                          <div className="ticket-desc">{t.description}</div>
                        </td>
                        <td>
                          <span className={`badge priority-${t.priority.toLowerCase()}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`badge status-${t.status.toLowerCase()}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="sla-time">
                          {formatDateTime(t.createdAt)}
                        </td>
                        <td>
                          <button 
                            type="button"
                            className="btn-action" 
                            style={{ 
                              backgroundColor: '#17A2B8', 
                              color: '#FFF', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                            onClick={() => setActiveChatTicket(t)}
                          >
                            <MessageSquare size={14} />
                            <span>Trao đổi</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DÀNH CHO NHÂN VIÊN CNTT BẢO TRÌ (IT_STAFF) */}
      {currentUser.role === 'IT_STAFF' && (
        <div className="main-content" style={{ gridTemplateColumns: '1fr' }}>
          <div className="card list-card">
            <Dashboard tickets={processedTickets} />

            <div className="card-header">
              <Clock size={20} className="card-icon" />
              <h2>Bảng Quản Lý & Tiếp Nhận Sự Cố CNTT ({processedTickets.length})</h2>
            </div>

            {renderFilterBar()}

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mã Ticket</th>
                    <th>Tiêu đề & Mô tả</th>
                    <th>Ưu tiên</th>
                    <th>Trạng thái</th>
                    <th>Hạn SLA</th>
                    <th>Thao tác IT Bảo trì</th>
                  </tr>
                </thead>
                <tbody>
                  {processedTickets.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-table">Không tìm thấy sự cố trùng khớp bộ lọc.</td>
                    </tr>
                  ) : (
                    processedTickets.map((t) => (
                      <tr key={t.id} className={t.priority === 'P1' ? 'row-p1' : ''}>
                        <td><span className="ticket-code">{t.ticketCode}</span></td>
                        <td>
                          <div className="ticket-title">{t.title}</div>
                          <div className="ticket-desc">{t.description}</div>
                        </td>
                        <td>
                          <span className={`badge priority-${t.priority.toLowerCase()}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`badge status-${t.status.toLowerCase()}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="sla-time">
                          {t.slaDueAt ? new Date(t.slaDueAt).toLocaleString('vi-VN') : 'N/A'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {t.status === 'OPEN' && (
                              <button 
                                className="btn-action action-process"
                                onClick={() => handleStatusChange(t.id, 'IN_PROGRESS')}
                              >
                                Tiếp nhận
                              </button>
                            )}
                            {t.status === 'IN_PROGRESS' && (
                              <button 
                                className="btn-action action-resolve"
                                onClick={() => handleStatusChange(t.id, 'RESOLVED')}
                              >
                                Đã xử lý
                              </button>
                            )}
                            {t.status === 'RESOLVED' && (
                              <span className="text-resolved" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle size={16}/> Hoàn thành
                              </span>
                            )}
                            
                            <button 
                              type="button"
                              className="btn-action" 
                              style={{ 
                                backgroundColor: '#17A2B8', 
                                color: '#FFF', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                              onClick={() => setActiveChatTicket(t)}
                            >
                              <MessageSquare size={14} />
                              <span>Trao đổi</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />

      {/* MODAL TRAO ĐỔI TRỰC TIẾP */}
      {activeChatTicket && (
        <TicketChatModal 
          ticket={activeChatTicket} 
          currentUser={currentUser} 
          onClose={() => setActiveChatTicket(null)} 
        />
      )}
    </div>
  );
}

function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand-row">
          <div>
            <a href="https://www.agribank.com.vn/vn/home" target="_blank" rel="noreferrer"
              aria-label="Mở trang chủ Agribank">
              <img className="site-footer-logo" src="/agribank-logo.jpg" alt="Agribank" />
            </a>
            <div className="site-footer-tagline">
              Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam
            </div>
          </div>
          <a className="site-footer-contact-cta" href="https://www.agribank.com.vn/vn/lien-he"
            target="_blank" rel="noreferrer">
            Liên hệ Agribank <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="site-footer-columns">
          <section>
            <h2>Hội sở</h2>
            <p>Số 2 Láng Hạ, phường Giảng Võ, thành phố Hà Nội</p>
            <p>Điện thoại: 1900 5588 18 / 024 3205 3205</p>
            <p>Email: cskh@agribank.com.vn</p>
            <a href="https://www.agribank.com.vn/vn/lien-he" target="_blank" rel="noreferrer">
              Liên hệ ngay <span aria-hidden="true">›</span>
            </a>
          </section>

          <section>
            <h2>Yêu cầu tư vấn</h2>
            <p>Để lại nhu cầu của bạn, Agribank sẽ liên hệ hỗ trợ trong thời gian sớm nhất.</p>
            <a href="https://www.agribank.com.vn/vn/lien-he" target="_blank" rel="noreferrer">
              Gửi yêu cầu tư vấn <span aria-hidden="true">›</span>
            </a>
          </section>

          <nav aria-label="Thông tin Agribank">
            <h2>Thông tin</h2>
            <a href="https://www.agribank.com.vn/vn/lien-he" target="_blank" rel="noreferrer">
              Liên hệ ngay <span aria-hidden="true">↗</span>
            </a>
            <a href="https://www.agribank.com.vn/vn/dieu-khoan-su-dung" target="_blank" rel="noreferrer">
              Điều khoản sử dụng <span aria-hidden="true">↗</span>
            </a>
            <a href="https://www.agribank.com.vn/vn/an-toan-bao-mat" target="_blank" rel="noreferrer">
              An toàn và bảo mật <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>

        <div className="site-footer-copyright">
          © {currentYear} Bản quyền thuộc về Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam
        </div>
      </div>
    </footer>
  );
}

export default App;
