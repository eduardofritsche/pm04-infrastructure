import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const FRONT_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';
const money = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* navegador sem storage: segue só em memória */
  }
}

export default function App() {
  const [page, setPage] = useState('loja');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [cart, setCart] = useState(() => load('kubeshop.cart', {}));
  const [customer, setCustomer] = useState(() => load('kubeshop.customer', { name: '', email: '' }));
  const [health, setHealth] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.products().then(setProducts).catch((e) => setError(e.message));
    api.health().then(setHealth).catch(() => setHealth({ status: 'error' }));
  }, []);
  useEffect(() => save('kubeshop.cart', cart), [cart]);
  useEffect(() => save('kubeshop.customer', customer), [customer]);

  const items = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => ({ product: products.find((p) => p._id === id), quantity }))
        .filter((i) => i.product),
    [cart, products]
  );
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.quantity * i.product.price, 0);

  const add = (id) => setCart((c) => ({ ...c, [id]: Math.min((c[id] || 0) + 1, 99) }));
  const change = (id, q) =>
    setCart((c) => {
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = Math.min(q, 99);
      return next;
    });

  async function checkout(e) {
    e.preventDefault();
    setError('');
    try {
      const order = await api.createOrder({
        customer,
        items: items.map((i) => ({ productId: i.product._id, quantity: i.quantity }))
      });
      setCart({});
      setNotice(`Pedido ${String(order._id).slice(-6).toUpperCase()} recebido! Total ${money(order.total)}.`);
      setPage('pedidos');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setPage('loja')}>
          <span className="logo">⎈</span> KubeShop
          <span className="version" title="Versão da imagem Docker">v{FRONT_VERSION}</span>
        </button>
        <nav>
          <button className={page === 'loja' ? 'active' : ''} onClick={() => setPage('loja')}>Produtos</button>
          <button className={page === 'pedidos' ? 'active' : ''} onClick={() => setPage('pedidos')}>Meus pedidos</button>
          <button className={`bag ${page === 'sacola' ? 'active' : ''}`} onClick={() => setPage('sacola')}>
            🛍️ Sacola {count > 0 && <span className="badge">{count}</span>}
          </button>
        </nav>
      </header>

      <main>
        {error && <div className="alert error" onClick={() => setError('')}>{error}</div>}
        {notice && <div className="alert ok" onClick={() => setNotice('')}>{notice}</div>}

        {page === 'loja' && (
          <>
            <section className="hero">
              <h1>Produtos para quem vive na nuvem</h1>
              <p>Loja oficial da Zibiska Korp. Escolha, coloque na sacola e acompanhe em “Meus pedidos”.</p>
            </section>
            <section className="grid">
              {products.map((p) => (
                <article key={p._id} className="card">
                  <div className="emoji">{p.emoji}</div>
                  <h3>{p.name}</h3>
                  <p className="desc">{p.description}</p>
                  <div className="row">
                    <strong>{money(p.price)}</strong>
                    <button className="primary" onClick={() => add(p._id)}>
                      {cart[p._id] ? `Na sacola (${cart[p._id]})` : 'Adicionar'}
                    </button>
                  </div>
                </article>
              ))}
              {products.length === 0 && !error && <p className="muted">Carregando produtos…</p>}
            </section>
          </>
        )}

        {page === 'sacola' && (
          <section className="panel">
            <h2>Sua sacola</h2>
            {items.length === 0 ? (
              <p className="muted">A sacola está vazia. <button className="link" onClick={() => setPage('loja')}>Ver produtos</button></p>
            ) : (
              <>
                <ul className="lines">
                  {items.map(({ product, quantity }) => (
                    <li key={product._id}>
                      <span className="emoji small">{product.emoji}</span>
                      <span className="grow">{product.name}</span>
                      <span className="qty">
                        <button onClick={() => change(product._id, quantity - 1)}>−</button>
                        {quantity}
                        <button onClick={() => change(product._id, quantity + 1)}>+</button>
                      </span>
                      <span className="price">{money(product.price * quantity)}</span>
                    </li>
                  ))}
                </ul>
                <p className="total">Total: <strong>{money(total)}</strong></p>
                <form className="checkout" onSubmit={checkout}>
                  <h3>Fechar pedido</h3>
                  <input required placeholder="Seu nome" value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                  <input required type="email" placeholder="Seu e-mail" value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                  <button className="primary" type="submit">Confirmar pedido</button>
                </form>
              </>
            )}
          </section>
        )}

        {page === 'pedidos' && <Orders customer={customer} setCustomer={setCustomer} />}
      </main>

      <footer>
        KubeShop · Zibiska Korp · frontend v{FRONT_VERSION} · API v{health?.version || '?'} · banco{' '}
        <span className={health?.database === 'ok' ? 'dot ok' : 'dot bad'}>{health?.database === 'ok' ? 'conectado' : 'indisponível'}</span>
      </footer>
    </div>
  );
}

function Orders({ customer, setCustomer }) {
  const [email, setEmail] = useState(customer.email);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  async function search(target) {
    if (!target) return;
    setError('');
    try {
      setOrders(await api.orders(target));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    search(customer.email);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="panel">
      <h2>Meus pedidos</h2>
      <form className="inline" onSubmit={(e) => { e.preventDefault(); setCustomer({ ...customer, email }); search(email); }}>
        <input type="email" required placeholder="E-mail usado no pedido" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="primary">Buscar</button>
      </form>
      {error && <div className="alert error">{error}</div>}
      {orders && orders.length === 0 && <p className="muted">Nenhum pedido para este e-mail.</p>}
      {orders?.map((o) => (
        <article key={o._id} className="order">
          <div className="row">
            <strong>Pedido #{String(o._id).slice(-6).toUpperCase()}</strong>
            <span className="status">{o.status}</span>
          </div>
          <p className="muted">{new Date(o.createdAt).toLocaleString('pt-BR')} · feito na versão {o.appVersion}</p>
          <ul>
            {o.items.map((i) => (
              <li key={i.sku}>{i.emoji} {i.quantity}× {i.name} — {money(i.subtotal)}</li>
            ))}
          </ul>
          <p className="total">Total: <strong>{money(o.total)}</strong></p>
        </article>
      ))}
    </section>
  );
}
