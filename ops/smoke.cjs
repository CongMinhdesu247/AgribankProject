// Run on HP: docker compose exec -T api node < ops/smoke.cjs
// Creates 3 synthetic accounts and 1 ticket. Never prints credentials or tokens.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = 'http://web:3000/api';
const suffix = crypto.randomBytes(5).toString('hex');
const password = crypto.randomBytes(24).toString('hex');
async function call(route, { token, method = 'GET', body, status = 200 } = {}) {
  const res = await fetch(base + route, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(res.status, status, `${method} ${route}: expected ${status}, got ${res.status}`);
  return res.status === 204 ? null : res.json();
}
async function register(role, label) {
  return call('/auth/register', { method: 'POST', status: 201, body: {
    employeeCode: `HP${label}${suffix}`, fullName: `HP smoke ${label}`, branchCode: 'DEMO',
    email: `hp-${label}-${suffix}@example.invalid`, password, accountType: role,
    ...(role === 'IT_STAFF' ? { itRegistrationCode: process.env.IT_REGISTRATION_CODE } : {}),
  } });
}
(async () => {
  assert.ok(process.env.IT_REGISTRATION_CODE, 'IT_REGISTRATION_CODE must be set for this test');
  assert.equal((await call('/health')).status, 'ok');
  await call('/tickets', { status: 401 });
  const a = await register('USER', 'A');
  const b = await register('USER', 'B');
  const it = await register('IT_STAFF', 'IT');
  const login = await call('/auth/login', { method: 'POST', body: {
    employeeCode: a.user.employeeCode, password, accountType: 'USER',
  } });
  assert.ok(login.token);
  const categories = await call('/categories', { token: a.token });
  assert.ok(categories.length > 0);
  await call('/tickets', { method: 'POST', token: a.token, status: 400,
    body: { title: '', description: 'Invalid demo', categoryId: categories[0].id } });
  const ticket = await call('/tickets', { method: 'POST', token: a.token, status: 201,
    body: { title: `HP deployment smoke ${suffix}`, description: 'Synthetic deployment check', priority: 'P3', categoryId: categories[0].id } });
  assert.ok((await call('/tickets', { token: a.token })).some(t => t.id === ticket.id));
  assert.ok(!(await call('/tickets', { token: b.token })).some(t => t.id === ticket.id));
  await call(`/tickets/${ticket.id}/comments`, { token: b.token, status: 404 });
  await call(`/tickets/${ticket.id}/comments`, { token: b.token, method: 'POST', status: 404, body: { text: 'Forbidden' } });
  await call(`/tickets/${ticket.id}/status`, { token: a.token, method: 'PATCH', status: 403, body: { status: 'RESOLVED' } });
  await call('/users', { token: a.token, status: 403 });
  await call(`/tickets/${ticket.id}/comments`, { token: a.token, method: 'POST', status: 201, body: { text: 'Synthetic comment' } });
  await call(`/tickets/${ticket.id}/status`, { token: it.token, method: 'PATCH', body: { status: 'RESOLVED' } });
  assert.ok((await call('/notifications', { token: a.token })).some(n => n.ticketId === ticket.id));
  await call('/auth/logout', { token: a.token, method: 'POST', status: 204 });
  await call('/tickets', { token: a.token, status: 401 });
  console.log('PASS: health, registration/login, ticket, comment, role/owner isolation, notification, logout.');
  console.log(`Synthetic records retained: suffix ${suffix}; ticket ${ticket.id}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
