import React from 'react';
import { 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp 
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

function Dashboard({ tickets }) {
  // 1. Tính toán các chỉ số KPI
  const totalTickets = tickets.length;

  const p1Count = tickets.filter(t => t.priority === 'P1').length;
  const p2Count = tickets.filter(t => t.priority === 'P2').length;
  const p3Count = tickets.filter(t => t.priority === 'P3').length;

  const openCount = tickets.filter(t => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

  const now = Date.now();
  const breachedTickets = tickets.filter(t => {
    if (t.status === 'RESOLVED') return false;
    if (!t.slaDueAt) return false;
    return new Date(t.slaDueAt).getTime() < now;
  }).length;

  const slaComplianceRate = totalTickets > 0 
    ? Math.round(((totalTickets - breachedTickets) / totalTickets) * 100)
    : 100;

  // 2. Dữ liệu Biểu đồ tròn theo mức độ ưu tiên P1, P2, P3
  const priorityChartData = [
    { name: 'P1 - Khẩn cấp', value: p1Count, color: '#DC2626' },
    { name: 'P2 - Mức cao', value: p2Count, color: '#F59E0B' },
    { name: 'P3 - Bình thường', value: p3Count, color: '#3B82F6' }
  ].filter(item => item.value > 0); // Lọc chỉ hiển thị các mục có số lượng > 0

  // 3. Dữ liệu Biểu đồ cột theo trạng thái xử lý
  const statusChartData = [
    { name: 'Mới (Open)', count: openCount, fill: '#3B82F6' },
    { name: 'Đang xử lý', count: inProgressCount, fill: '#F59E0B' },
    { name: 'Hoàn thành', count: resolvedCount, fill: '#10B981' },
    { name: 'Quá hạn SLA', count: breachedTickets, fill: '#DC2626' }
  ];

  return (
    <div className="dashboard-container" style={{ marginBottom: '24px' }}>
      {/* Header Dashboard */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <BarChart3 size={20} color="#A81C37" />
        <h2 style={{ margin: 0, fontSize: '18px', color: '#1E293B', fontWeight: '700' }}>
          Thống Kê Hiệu Suất & Cam Kết Dịch Vụ (SLA)
        </h2>
      </div>

      {/* Lưới 4 Thẻ KPI (Đã loại bỏ thẻ Sự Cố P1) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Tổng Sự Cố */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <div className="kpi-header">
            <span>Tổng Sự Cố</span>
            <Clock size={18} color="#3B82F6" />
          </div>
          <div className="kpi-value">{totalTickets}</div>
          <div className="kpi-subtext">Đã ghi nhận trong hệ thống</div>
        </div>

        {/* Card 2: Cần Xử Lý */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="kpi-header">
            <span>Cần Xử Lý</span>
            <AlertCircle size={18} color="#F59E0B" />
          </div>
          <div className="kpi-value" style={{ color: '#D97706' }}>{openCount + inProgressCount}</div>
          <div className="kpi-subtext">{openCount} Mới | {inProgressCount} Đang tiếp nhận</div>
        </div>

        {/* Card 3: Đã Xử Lý */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="kpi-header">
            <span>Đã Xử Lý</span>
            <CheckCircle2 size={18} color="#10B981" />
          </div>
          <div className="kpi-value" style={{ color: '#059669' }}>{resolvedCount}</div>
          <div className="kpi-subtext">Hoàn thành nhiệm vụ</div>
        </div>

        {/* Card 4: Tuân Thủ SLA */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <div className="kpi-header">
            <span>Tuân Thủ SLA</span>
            <TrendingUp size={18} color="#8B5CF6" />
          </div>
          <div className="kpi-value" style={{ color: slaComplianceRate >= 90 ? '#059669' : '#DC2626' }}>
            {slaComplianceRate}%
          </div>
          <div className="kpi-subtext">
            {breachedTickets > 0 ? `🚨 ${breachedTickets} ticket quá hạn` : '✅ Đạt chuẩn 100% đúng hạn'}
          </div>
        </div>
      </div>

      {/* Lưới Chứa 2 Biểu Đồ Animated */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
        backgroundColor: '#F8FAFC',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0'
      }}>
        {/* BIỂU ĐỒ TRÒN: SƠ ĐỒ SỰ CỐ (Mức độ P1, P2, P3) */}
        <div style={{ backgroundColor: '#FFF', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1E293B', fontWeight: '600', textAlign: 'center' }}>
            Sơ Đồ Sự Cố
          </h4>
          <div style={{ width: '100%', height: 220 }}>
            {priorityChartData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
                Chưa có dữ liệu sự cố
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  >
                    {priorityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Ticket`, 'Số lượng']} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* BIỂU ĐỒ CỘT: TRẠNG THÁI XỬ LÝ & SLA */}
        <div style={{ backgroundColor: '#FFF', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1E293B', fontWeight: '600', textAlign: 'center' }}>
            Trạng Thái Xử Lý & Vi Phạm SLA
          </h4>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip formatter={(value) => [`${value} Ticket`, 'Số lượng']} />
                <Bar 
                  dataKey="count" 
                  radius={[6, 6, 0, 0]} 
                  isAnimationActive={true} 
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`bar-cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;