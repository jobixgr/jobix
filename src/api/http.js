// Ελαφρύ HTTP client για το δικό μας backend.

const TOKEN_KEY = 'jobix_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Χρόνος αναμονής. Χωρίς αυτό, αν το δίκτυο κολλήσει (τυπικό σε συνεργείο
// με κακό σήμα), το request μένει σε εκκρεμότητα ΓΙΑ ΠΑΝΤΑ και ο χρήστης
// βλέπει spinner που δεν σταματά ποτέ.
const DEFAULT_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', retriable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retriable = retriable;  // αν αξίζει να ξαναδοκιμάσει ο χρήστης
  }
}

export async function apiFetch(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    // Ξεχωρίζουμε «έληξε ο χρόνος» από «δεν υπάρχει δίκτυο»: ο χρήστης
    // πρέπει να ξέρει αν φταίει το σήμα του ή ο server.
    if (e.name === 'AbortError') {
      throw new ApiError('Το αίτημα άργησε πολύ. Ελέγξτε τη σύνδεσή σας.', {
        code: 'timeout', retriable: true,
      });
    }
    throw new ApiError('Δεν υπάρχει σύνδεση στο διαδίκτυο.', {
      code: 'offline', retriable: true,
    });
  }
  clearTimeout(timer);

  let data = null;
  try { data = await res.json(); } catch { /* κενή απάντηση */ }

  if (!res.ok) {
    // 5xx και 429 αξίζει να ξαναδοκιμαστούν. 4xx (π.χ. λάθος κωδικός) όχι.
    const retriable = res.status >= 500 || res.status === 429;
    throw new ApiError((data && data.error) || `HTTP ${res.status}`, {
      status: res.status,
      code: retriable ? 'server' : 'client',
      retriable,
    });
  }
  return data;
}
