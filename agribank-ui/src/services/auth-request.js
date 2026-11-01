const unavailableMessage = 'Máy chủ đang khởi động hoặc tạm thời chưa sẵn sàng. Vui lòng thử lại sau khoảng một phút.';

// Only readiness GETs may be repeated. Replaying a registration POST can create
// an account even when the original response was lost.
export async function waitForApi({ fetchHealth, timeoutMs = 90_000, retryMs = 2_000,
  now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    let response;
    let payload;
    try {
      response = await fetchHealth(AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - now()))));
      payload = await response.json().catch(() => null);
    } catch {
      // A waking service may close the connection before returning HTTP headers.
    }
    if (response?.ok && payload?.status === 'ok') return;
    if (response?.status === 404) throw new Error('Không tìm thấy đường kiểm tra API. Vui lòng kiểm tra cấu hình máy chủ.');
    const remaining = deadline - now();
    if (remaining > 0) await sleep(Math.min(retryMs, remaining));
  }
  throw new Error(unavailableMessage);
}

export async function readApiError(response, fallback) {
  const payload = await response.json().catch(() => null);
  return new Error(payload?.message || payload?.error
    || ([502, 503, 504].includes(response.status) ? unavailableMessage : fallback));
}
