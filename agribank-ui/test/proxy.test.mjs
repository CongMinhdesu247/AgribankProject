import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { waitForApi } from '../src/services/auth-request.js';

test('proxy wakes the API before a single registration POST and preserves auth responses', async (t) => {
  let checks = 0;
  let registrations = 0;
  const backend = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      checks++;
      res.writeHead(checks === 1 ? 503 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: checks === 1 ? 'unavailable' : 'ok' }));
      return;
    }
    assert.equal(req.headers.origin, undefined);
    let body = '';
    for await (const chunk of req) body += chunk;
    assert.equal(JSON.parse(body).employeeCode, 'TEST001');
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/auth/register') {
      registrations++;
      res.writeHead(201).end(JSON.stringify({ token: 'test-session', user: { employeeCode: 'TEST001' } }));
    } else if (req.url === '/api/auth/login') {
      res.writeHead(401).end(JSON.stringify({ message: 'Sai thông tin đăng nhập' }));
    } else res.writeHead(404).end('{}');
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  t.after(() => backend.close());
  const proxy = spawn(process.execPath, ['server.cjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: '0', API_UPSTREAM: `http://127.0.0.1:${backend.address().port}` },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  t.after(() => proxy.kill());
  // The runtime reports its actual ephemeral port through its normal startup log.
  const [output] = await once(proxy.stdout, 'data');
  const port = String(output).match(/port (\d+)/)?.[1];
  assert.ok(port && port !== '0');
  const base = `http://127.0.0.1:${port}`;
  await waitForApi({ fetchHealth: () => fetch(`${base}/api/health`), retryMs: 1 });
  const options = { method: 'POST', headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ employeeCode: 'TEST001' }) };
  const registration = await fetch(`${base}/api/auth/register`, options);
  assert.equal(registration.status, 201);
  assert.equal((await registration.json()).token, 'test-session');
  assert.equal(checks, 2);
  assert.equal(registrations, 1);
  const login = await fetch(`${base}/api/auth/login`, options);
  assert.equal(login.status, 401);
  assert.equal((await login.json()).message, 'Sai thông tin đăng nhập');
  await new Promise((resolve) => backend.close(resolve));
  const unavailable = await fetch(`${base}/api/health`);
  assert.equal(unavailable.status, 502);
  assert.match((await unavailable.json()).message, /API chưa sẵn sàng/);
});
