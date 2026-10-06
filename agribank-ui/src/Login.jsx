import React, { useState } from 'react';
import { LogIn, ShieldAlert, UserPlus } from 'lucide-react';
import { ticketService } from './services/api';

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  borderRadius: '8px',
  border: '1px solid #CBD5E0'
};

function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [accountType, setAccountType] = useState('USER');
  const [form, setForm] = useState({
    employeeCode: '', fullName: '', branchCode: '', email: '',
    password: '', confirmPassword: '', itRegistrationCode: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const session = mode === 'login'
        ? await ticketService.login({
            employeeCode: form.employeeCode,
            password: form.password,
            accountType
          })
        : await ticketService.register({
            employeeCode: form.employeeCode,
            fullName: form.fullName,
            branchCode: form.branchCode,
            email: form.email,
            password: form.password,
            accountType,
            itRegistrationCode: form.itRegistrationCode
          });
      onLoginSuccess(session);
    } catch (requestError) {
      setError(requestError.message || 'Không thể kết nối máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  return (
    <div className="login-page" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#A81C37', padding: '20px'
    }}>
      <section style={{
        width: '100%', maxWidth: '460px', backgroundColor: '#FFF', borderRadius: '16px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)', border: '3px solid #E2B13C', overflow: 'hidden'
      }}>
        <header style={{
          backgroundColor: '#A81C37', color: '#FFF', padding: '24px 20px', textAlign: 'center',
          borderBottom: '3px solid #E2B13C'
        }}>
          <ShieldAlert size={40} color="#E2B13C" style={{ marginBottom: '6px' }} />
          <h1 style={{ margin: 0, fontSize: '20px' }}>AGRIBANK HELPDESK</h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#F8D7DA' }}>
            Tài khoản nhân viên và kỹ sư CNTT
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '18px 24px 0' }}>
          {[
            ['USER', 'Nhân viên'],
            ['IT_STAFF', 'Kỹ sư IT']
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setAccountType(value); setError(''); }}
              aria-pressed={accountType === value}
              style={{
                padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
                border: `1px solid ${accountType === value ? '#A81C37' : '#CBD5E0'}`,
                color: accountType === value ? '#A81C37' : '#475569',
                background: accountType === value ? '#FFF5F5' : '#FFF'
              }}
            >{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '18px', padding: '16px 24px 0' }}>
          <button type="button" onClick={() => switchMode('login')} style={tabStyle(mode === 'login')}>
            Đăng nhập
          </button>
          <button type="button" onClick={() => switchMode('register')} style={tabStyle(mode === 'register')}>
            Đăng ký
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 24px 26px' }}>
          {error && <div role="alert" style={errorStyle}>{error}</div>}

          <Field label="Mã nhân viên" name="employeeCode" value={form.employeeCode}
            onChange={updateField} placeholder="Ví dụ: NV001" autoComplete="username" />

          {mode === 'register' && <>
            <Field label="Họ và tên" name="fullName" value={form.fullName}
              onChange={updateField} placeholder="Nguyễn Văn A" autoComplete="name" />
            <Field label="Mã chi nhánh" name="branchCode" value={form.branchCode}
              onChange={updateField} placeholder="Ví dụ: AGRI_HN_01" />
            <Field label="Email công việc" name="email" type="email" value={form.email}
              onChange={updateField} placeholder="ten@agribank.com.vn" autoComplete="email" />
            {accountType === 'IT_STAFF' && <Field label="Mã đăng ký kỹ sư IT" name="itRegistrationCode"
              value={form.itRegistrationCode} onChange={updateField} placeholder="Nhận từ quản trị hệ thống" />}
          </>}

          <Field label="Mật khẩu" name="password" type="password" value={form.password}
            onChange={updateField} placeholder={mode === 'register' ? 'Ít nhất 10 ký tự' : 'Nhập mật khẩu'}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
          {mode === 'register' && <Field label="Xác nhận mật khẩu" name="confirmPassword" type="password"
            value={form.confirmPassword} onChange={updateField} placeholder="Nhập lại mật khẩu"
            autoComplete="new-password" />}

          <button type="submit" className="btn-agri-primary" disabled={submitting}
            style={{ width: '100%', padding: '12px', marginTop: '8px', opacity: submitting ? 0.7 : 1 }}>
            {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            <span>{submitting ? 'ĐANG XỬ LÝ...' : mode === 'login' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN'}</span>
          </button>
          {mode === 'register' && accountType === 'IT_STAFF' && (
            <p style={{ margin: '12px 0 0', color: '#64748B', fontSize: '12px', lineHeight: 1.5 }}>
              Đăng ký kỹ sư IT cần mã do quản trị hệ thống cung cấp.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}

function Field({ label, name, value, onChange, type = 'text', ...inputProps }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label htmlFor={name} style={{ display: 'block', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
        {label}:
      </label>
      <input id={name} name={name} type={type} value={value} onChange={onChange} required
        style={fieldStyle} {...inputProps} />
    </div>
  );
}

const tabStyle = (active) => ({
  border: 0, borderBottom: `2px solid ${active ? '#A81C37' : 'transparent'}`,
  background: 'transparent', color: active ? '#A81C37' : '#64748B',
  fontWeight: 700, padding: '8px 0', cursor: 'pointer'
});

const errorStyle = {
  backgroundColor: '#FFF5F5', color: '#C53030', padding: '10px 12px', borderRadius: '8px',
  fontSize: '13px', marginBottom: '16px', border: '1px solid #FEB2B2'
};

export default Login;
