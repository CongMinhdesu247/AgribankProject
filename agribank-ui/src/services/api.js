// Đường dẫn cơ sở tới Server Backend Node.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const request = (path, options = {}) => {
  const token = localStorage.getItem('agri_token');
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
};

const postJson = (path, data) => request(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

const readError = async (response, fallback) => {
  const payload = await response.json().catch(() => null);
  return new Error(payload?.message || payload?.error || fallback);
};

export const ticketService = {
  register: async (accountData) => {
    const response = await postJson('/auth/register', accountData);
    if (!response.ok) throw await readError(response, 'Không thể đăng ký tài khoản');
    return response.json();
  },

  login: async (credentials) => {
    const response = await postJson('/auth/login', credentials);
    if (!response.ok) throw await readError(response, 'Không thể đăng nhập');
    return response.json();
  },

  logout: async () => {
    const response = await request('/auth/logout', { method: 'POST' });
    if (!response.ok && response.status !== 401) {
      throw await readError(response, 'Không thể kết thúc phiên đăng nhập');
    }
  },

  // 1. Lấy toàn bộ danh sách ticket từ CSDL MySQL qua Backend
  getAllTickets: async () => {
    try {
      const response = await request('/tickets');
      if (!response.ok) {
        throw new Error('Không thể tải danh sách ticket từ Server');
      }
      return await response.json();
    } catch (error) {
      console.error('Lỗi API getAllTickets:', error);
      return [];
    }
  },

  // 2. Tạo ticket mới và lưu trực tiếp vào CSDL MySQL
  createTicket: async (ticketData) => {
    try {
      const response = await request('/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: ticketData.title,
          description: ticketData.description,
          priority: ticketData.priority || 'P3',
          categoryId: ticketData.categoryId || 1,
          reporterId: ticketData.reporterId || 1
        }),
      });

      if (!response.ok) {
        throw await readError(response, 'Không thể tạo ticket mới');
      }

      return await response.json();
    } catch (error) {
      console.error('Lỗi API createTicket:', error);
      throw error;
    }
  },

  // 3. Cập nhật trạng thái ticket trong CSDL MySQL
  updateStatus: async (id, status, performedBy = 2) => {
    try {
      const response = await request(`/tickets/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, performedBy }),
      });

      if (!response.ok) {
        throw await readError(response, 'Không thể cập nhật trạng thái ticket');
      }

      return await response.json();
    } catch (error) {
      console.error('Lỗi API updateStatus:', error);
      throw error;
    }
  },

  // 4. Lấy danh sách tin nhắn/bình luận trao đổi của Ticket từ CSDL MySQL
  getComments: async (ticketId) => {
    try {
      const response = await request(`/tickets/${ticketId}/comments`);
      if (!response.ok) {
        throw new Error('Không thể tải bình luận');
      }
      return await response.json();
    } catch (error) {
      console.error('Lỗi API getComments:', error);
      return [];
    }
  },

  // 5. Thêm tin nhắn trao đổi mới vào CSDL MySQL
  addComment: async (ticketId, commentData) => {
    try {
      const response = await request(`/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: commentData.senderId,
          sender: commentData.sender || 'Người dùng',
          senderRole: commentData.senderRole || 'USER',
          text: commentData.text || commentData.content || ''
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể gửi bình luận');
      }

      return await response.json();
    } catch (error) {
      console.error('Lỗi API addComment:', error);
      throw error;
    }
  },
  getCategories: async () => {
    const response = await request('/categories');
    if (!response.ok) throw await readError(response, 'Lỗi lấy danh mục');
    return await response.json();
  },

  getNotifications: async (userId = 1) => {
    const response = await request(`/notifications?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw await readError(response, 'Không thể tải thông báo');
    return response.json();
  },

  markNotificationRead: async (notificationId, userId = 1) => {
    const response = await request(
      `/notifications/${notificationId}/read?userId=${encodeURIComponent(userId)}`,
      { method: 'PATCH' }
    );
    if (!response.ok) throw await readError(response, 'Không thể cập nhật thông báo');
    return response.json();
  },

  // Lấy danh sách người dùng từ DB
  getUsers: async () => {
    const response = await request('/users');
    if (!response.ok) throw await readError(response, 'Lỗi lấy người dùng');
    return await response.json();
  }
};
