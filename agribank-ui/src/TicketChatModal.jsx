import React, { useState, useEffect } from 'react';
import { ticketService } from './services/api';
import { X, Send } from 'lucide-react';

function TicketChatModal({ ticket, currentUser, onClose }) {
  const [comments, setComments] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  // Tải danh sách bình luận khi mở khung chat
  const fetchComments = async () => {
    if (!ticket?.id) return;
    try {
      const data = await ticketService.getComments(ticket.id);
      setComments(data);
    } catch (error) {
      console.error("Lỗi khi tải bình luận:", error);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [ticket]);

  // Xử lý gửi tin nhắn
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    try {
      setLoading(true);

      // Kiểm tra an toàn trước khi gọi hàm
      if (typeof ticketService.addComment !== 'function') {
        throw new Error("Hàm addComment chưa được khai báo trong ticketService.");
      }

      await ticketService.addComment(ticket.id, {
        sender: currentUser?.fullName || 'Người dùng',
        senderRole: currentUser?.role || 'USER',
        text: inputText
      });

      setInputText('');
      await fetchComments(); // Tải lại danh sách tin nhắn mới
    } catch (error) {
      alert("Lỗi khi gửi phản hồi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        width: '460px',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header Modal */}
        <div style={{
          backgroundColor: '#A80000',
          color: '#FFFFFF',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
            💬 Trao đổi [{ticket.ticketCode}] {ticket.title}
          </h3>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nội dung tin nhắn */}
        <div style={{
          padding: '16px',
          height: '280px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          backgroundColor: '#F8F9FA'
        }}>
          {comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginTop: 'auto', marginBottom: 'auto' }}>
              Chưa có phản hồi nào. Hãy gửi tin nhắn đầu tiên!
            </div>
          ) : (
            comments.map((msg) => {
              const senderName = msg.sender || msg.senderName || 'Người dùng';
              const isMe = senderName === currentUser?.fullName;
              return (
                <div 
                  key={msg.id} 
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    backgroundColor: isMe ? '#D1E7DD' : '#FFFFFF',
                    border: '1px solid #CED4DA',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    maxWidth: '80%'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#495057', marginBottom: '2px' }}>
                    {senderName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#212529', wordBreak: 'break-word' }}>
                    {msg.text}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6C757D', textAlign: 'right', marginTop: '4px' }}>
                    {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Khung nhập và gửi tin nhắn */}
        <form onSubmit={handleSend} style={{ padding: '12px', display: 'flex', gap: '8px', borderTop: '1px solid #DEE2E6' }}>
          <input 
            type="text" 
            placeholder="Nhập nội dung trao đổi..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #CED4DA',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button 
            type="submit" 
            disabled={loading || !inputText.trim()}
            style={{
              backgroundColor: '#A80000',
              color: '#FFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: (!inputText.trim() || loading) ? 0.6 : 1
            }}
          >
            <Send size={14} />
            <span>Gửi</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default TicketChatModal;
