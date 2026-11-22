async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
  return body;
}

export const api = {
  health: () => request('/api/health'),
  products: () => request('/api/products'),
  createOrder: (order) => request('/api/orders', { method: 'POST', body: JSON.stringify(order) }),
  orders: (email) => request(`/api/orders?email=${encodeURIComponent(email)}`)
};
