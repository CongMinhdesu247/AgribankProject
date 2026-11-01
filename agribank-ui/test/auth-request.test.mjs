import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForApi, readApiError } from '../src/services/auth-request.js';

test('waits through a cold start and an HTML loading page until JSON readiness', async () => {
  let time = 0;
  const replies = [
    new Response('<html>502</html>', { status: 502 }),
    new Response('<html>Starting...</html>'),
    Response.json({ status: 'ok' }),
  ];
  let requests = 0;
  await waitForApi({
    fetchHealth: async () => replies[requests++],
    now: () => time,
    sleep: async (ms) => { time += ms; },
  });
  assert.equal(requests, 3);
});

test('connection failures stop at the deadline with an actionable message', async () => {
  let time = 0;
  let requests = 0;
  await assert.rejects(waitForApi({
    timeoutMs: 5_000,
    fetchHealth: async () => { requests++; throw new TypeError('Failed to fetch'); },
    now: () => time,
    sleep: async (ms) => { time += ms; },
  }), /Máy chủ đang khởi động/);
  assert.equal(time, 5_000);
  assert.equal(requests, 3);
});

test('does not poll indefinitely when readiness route is missing', async () => {
  await assert.rejects(waitForApi({ fetchHealth: async () => new Response('', { status: 404 }) }),
    /Không tìm thấy đường kiểm tra API/);
});

test('distinguishes an HTML gateway error from invalid credentials and duplicate accounts', async () => {
  assert.match((await readApiError(new Response('<html>502</html>', { status: 502 }), 'Đăng nhập lỗi')).message,
    /Máy chủ đang khởi động/);
  for (const status of [401, 409]) {
    assert.equal((await readApiError(Response.json({ message: 'Lỗi tài khoản cụ thể' }, { status }), 'Lỗi')).message,
      'Lỗi tài khoản cụ thể');
  }
});
