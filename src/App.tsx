import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AccountReport, AccountReportReason, AccountReportStatus, CartItem, ClientInvoice, Dashboard, DeliveredAccount, DeliveryDraft, DeliveryParserItem, DeliveryParserPreview, EmailStatus, Notification, Order, OrderItem, OrderStatus, Payment, Product, ProviderConfig, ProviderDelivery, ProviderPayout, Role, SystemLog, User, WhatsAppBridgeStatus, WhatsAppInboundMessage } from "./types";
import centroDigitalLogo from "./assets/centro-digital-imagotipo.png";
import centroDigitalWordmark from "./assets/centro-digital-wordmark.png";
import servimilLogo from "./assets/clients/servimil.png";
import loginBackgroundOne from "./assets/login-background-1.mp4";
import loginBackgroundTwo from "./assets/login-background-2.mp4";
import netflixLogo from "./assets/brands/netflix.svg";
import disneyPlusLogo from "./assets/brands/disney-plus.svg";
import hboMaxLogo from "./assets/brands/hbo-max.svg";
import primeVideoLogo from "./assets/brands/prime-video.svg";
import crunchyrollLogo from "./assets/brands/crunchyroll.svg";
import paramountPlusLogo from "./assets/brands/paramount-plus.svg";
import appleTvLogo from "./assets/brands/apple-tv.svg";
import plexLogo from "./assets/brands/plex.svg";
import vixLogo from "./assets/brands/vix.svg";
import directvGoLogo from "./assets/brands/directv-go.svg";
import spotifyLogo from "./assets/brands/spotify.svg";
import youtubeLogo from "./assets/brands/youtube.svg";
import xboxLogo from "./assets/brands/xbox.svg";
import chatgptLogo from "./assets/brands/chatgpt.svg";

const API_URL = import.meta.env.VITE_API_URL || "";
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const accountReportReasonOptions: Array<{ value: AccountReportReason; label: string }> = [
  { value: "defective", label: "La cuenta presenta fallas" },
  { value: "missing_code", label: "Falta el codigo de acceso" },
  { value: "expired", label: "La cuenta esta vencida" },
  { value: "screen_changed", label: "Cambiaron o eliminaron la pantalla" },
  { value: "credentials_invalid", label: "Usuario o contrasena no funcionan" },
  { value: "profile_missing", label: "No aparece el perfil asignado" },
  { value: "other", label: "Otro inconveniente" }
];
const accountReportStatusOptions: Array<{ value: AccountReportStatus; label: string }> = [
  { value: "open", label: "Abierto" },
  { value: "reviewing", label: "En revision" },
  { value: "resolved", label: "Resuelto" },
  { value: "rejected", label: "Cerrado sin cambio" }
];

function accountReportReasonLabel(reason: AccountReportReason) {
  return accountReportReasonOptions.find((option) => option.value === reason)?.label || reason;
}

function accountReportStatusLabel(status: AccountReportStatus) {
  return accountReportStatusOptions.find((option) => option.value === status)?.label || status;
}

async function evidenceImageDataUrl(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen valido.");
  if (file.size > 10 * 1024 * 1024) throw new Error("La imagen no puede superar 10 MB.");
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No fue posible procesar la imagen."));
      element.src = sourceUrl;
    });
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > 2_100_000) dataUrl = canvas.toDataURL("image/jpeg", 0.62);
    if (dataUrl.length > 2_100_000) throw new Error("La evidencia sigue siendo demasiado pesada. Usa una captura mas pequena.");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date(value));
}

function dateTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function orderLabel(order?: Pick<Order, "id" | "order_number"> | null) {
  return order?.order_number || (order?.id ? `#${order.id.slice(0, 8)}` : "-");
}

function invoiceStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviada",
    paid: "Pagada",
    cancelled: "Cancelada"
  };
  return labels[String(status || "").toLowerCase()] || status || "-";
}

function readablePassword(value?: string | null) {
  if (!value) return "-";
  if (value === "***") return "Pendiente de actualizacion";
  return value;
}

function accountScreen(value?: string | null) {
  return String(value || "").match(/(?:^|\n)Pantalla:\s*(.+?)(?=\n|$)/i)?.[1]?.trim() || "";
}

function visibleAccountNotes(value?: string | null) {
  return String(value || "")
    .replace(/(?:^|\n)Pantalla:\s*.+?(?=\n|$)/gi, "")
    .trim();
}

function normalizePhoneForCompare(value?: string | null) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

function isServimilClient(user?: Pick<User, "name" | "email" | "role"> | null) {
  if (!user || user.role !== "client") return false;
  return user.name?.toLowerCase().includes("servimil") || user.email === "cliente@centrodigital.local";
}

const brandLabels: Record<string, string> = {
  netflix: "N",
  disney: "D+",
  hbo: "MAX",
  amazon: "a",
  crunchyroll: "CR",
  paramount: "P+",
  apple: "TV",
  plex: "PX",
  vix: "VX",
  iptv: "IP",
  directv: "GO",
  spotify: "SP",
  youtube: "YT",
  xbox: "XB",
  chatgpt: "AI"
};

const brandLogos: Record<string, { src?: string; label: string; alt: string; wide?: boolean }> = {
  netflix: { src: netflixLogo, label: "N", alt: "Netflix" },
  disney: { src: disneyPlusLogo, label: "D+", alt: "Disney+", wide: true },
  hbo: { src: hboMaxLogo, label: "MAX", alt: "HBO Max" },
  amazon: { src: primeVideoLogo, label: "PV", alt: "Prime Video", wide: true },
  crunchyroll: { src: crunchyrollLogo, label: "CR", alt: "Crunchyroll" },
  paramount: { src: paramountPlusLogo, label: "P+", alt: "Paramount+" },
  apple: { src: appleTvLogo, label: "TV", alt: "Apple TV" },
  plex: { src: plexLogo, label: "PX", alt: "Plex" },
  vix: { src: vixLogo, label: "VIX", alt: "ViX", wide: true },
  iptv: { label: "IPTV", alt: "IPTV" },
  directv: { src: directvGoLogo, label: "DGO", alt: "DIRECTV GO", wide: true },
  spotify: { src: spotifyLogo, label: "SP", alt: "Spotify" },
  youtube: { src: youtubeLogo, label: "YT", alt: "YouTube Premium" },
  xbox: { src: xboxLogo, label: "XB", alt: "Xbox Game Pass" },
  chatgpt: { src: chatgptLogo, label: "AI", alt: "ChatGPT" }
};

const statusLabels: Record<OrderStatus, string> = {
  admin_payment_pending: "Pago admin pendiente",
  provider_delivery_pending: "Pendiente proveedor",
  wallet_pending: "Pendiente legado",
  payout_processing: "Pagando proveedor",
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  pending: "Pendiente",
  processing: "En proceso",
  delivered: "Entregado",
  payout_failed: "Pago proveedor fallido",
  payment_failed: "Pago fallido",
  cancelled: "Cancelado"
};

type View = "auth" | "catalog" | "cart" | "client" | "provider" | "admin";

function BrandLogo({ brandKey, name, small = false }: { brandKey?: string | null; name: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const logo = brandLogos[brandKey || ""];
  const fallback = logo?.label || brandLabels[brandKey || ""] || name.slice(0, 2).toUpperCase();
  const className = `logo-box${small ? " small" : ""}${logo?.wide ? " wide" : ""}${logo?.src && !failed ? " has-image" : ""}`;

  return (
    <div className={className} aria-label={logo?.alt || name} title={logo?.alt || name}>
      {logo?.src && !failed ? (
        <img src={logo.src} alt={logo.alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}

function getDefaultViewByRole(role?: Role): View {
  if (role === "client") return "catalog";
  if (role === "provider") return "provider";
  if (role === "admin") return "admin";
  return "auth";
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppBridgeStatus | null>(null);
  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [pendingPayouts, setPendingPayouts] = useState<ProviderPayout[]>([]);
  const [pendingDeliveryOrders, setPendingDeliveryOrders] = useState<Order[]>([]);
  const [trashedOrders, setTrashedOrders] = useState<Order[]>([]);
  const [providerDeliveries, setProviderDeliveries] = useState<ProviderDelivery[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [clientInvoices, setClientInvoices] = useState<ClientInvoice[]>([]);
  const [deliveryDrafts, setDeliveryDrafts] = useState<DeliveryDraft[]>([]);
  const [whatsappInboundMessages, setWhatsappInboundMessages] = useState<WhatsAppInboundMessage[]>([]);
  const [adminLogs, setAdminLogs] = useState<SystemLog[]>([]);
  const [accountReports, setAccountReports] = useState<AccountReport[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [view, setView] = useState<View>(token ? "auth" : "auth");
  const [selectedAddedProduct, setSelectedAddedProduct] = useState<Product | null>(null);
  const [addedDetailOpen, setAddedDetailOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  useEffect(() => {
    if (token) loadMe(token);
  }, []);

  useEffect(() => {
    if (!user || !token) return;
    if (user.role === "client") {
      loadProducts();
      refreshClientData();
    }
    if (user.role === "provider") refreshProviderData();
    if (user.role === "admin") refreshAdminData();
    if (user.role === "admin") {
      loadProducts();
    }
  }, [user, token]);

  useEffect(() => {
    if (!user || !token || user.role !== "provider") return;
    refreshProviderData();
    const interval = window.setInterval(() => {
      const activeElement = document.activeElement;
      const skipOrders = activeElement instanceof HTMLElement && Boolean(activeElement.closest(".delivery-form"));
      refreshProviderData({ skipOrders });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [user, token]);

  useEffect(() => {
    if (!user || !token || user.role !== "admin") return;
    refreshAdminData();
    const interval = window.setInterval(refreshAdminData, 10000);
    return () => window.clearInterval(interval);
  }, [user, token]);

  useEffect(() => {
    if (!user || !token || user.role !== "client") return;
    refreshClientData();
    const interval = window.setInterval(refreshClientData, 5000);
    return () => window.clearInterval(interval);
  }, [user, token]);

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "No se pudo completar la solicitud");
    return data as T;
  }

  async function loadProducts() {
    const data = await request<{ products: Product[] }>(user?.role === "admin" ? "/api/admin/products" : "/api/products");
    setProducts(data.products);
    if (user?.role === "client") {
      const latestById = new Map(data.products.map((product) => [product.id, product]));
      setCart((current) => current.flatMap((item) => {
        const latest = latestById.get(item.product.id);
        return latest ? [{ ...item, product: latest }] : [];
      }));
      setSelectedAddedProduct((current) => current ? latestById.get(current.id) || null : null);
    }
    return data.products;
  }

  async function loadMe(activeToken = token) {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${activeToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error);
      setUser(data.user);
      setView(getDefaultViewByRole(data.user.role));
    } catch {
      logout();
    }
  }

  async function loadOrders() {
    const data = await request<{ orders: Order[] }>("/api/orders");
    setOrders(normalizeOrders(data.orders));
  }

  async function loadDashboard() {
    const data = await request<{ kpis: Omit<Dashboard, "recentOrders" | "movements" | "latestPayments" | "providerPayouts" | "monthlyStatements">; recentOrders: Order[]; latestPayments: Payment[]; providerPayouts: ProviderPayout[]; monthlyStatements: Dashboard["monthlyStatements"]; movements: Dashboard["movements"] }>("/api/admin/dashboard");
    setDashboard({ ...data.kpis, recentOrders: normalizeOrders(data.recentOrders), latestPayments: data.latestPayments || [], providerPayouts: data.providerPayouts || [], monthlyStatements: data.monthlyStatements || [], movements: data.movements });
  }

  async function loadUsers() {
    const data = await request<{ users: User[] }>("/api/admin/users");
    setUsers(data.users);
  }

  async function loadClientInvoices() {
    if (user?.role !== "admin") return;
    const data = await request<{ invoices: ClientInvoice[] }>("/api/admin/invoices");
    setClientInvoices(data.invoices || []);
  }

  async function loadProviderConfig() {
    const data = await request<{ config: ProviderConfig }>("/api/admin/provider-config");
    setProviderConfig(data.config);
  }

  async function loadWhatsAppStatus() {
    if (user?.role !== "admin") return;
    const data = await request<{ status: WhatsAppBridgeStatus }>("/api/admin/whatsapp/status");
    setWhatsappStatus(data.status);
    if (data.status.qrPending) {
      const qrData = await request<{ qr: string | null }>("/api/admin/whatsapp/qr");
      setWhatsappQr(qrData.qr);
    } else {
      setWhatsappQr(null);
    }
  }

  async function loadEmailStatus() {
    if (user?.role !== "admin") return;
    const data = await request<{ status: EmailStatus }>("/api/admin/email/status");
    setEmailStatus(data.status);
  }

  async function loadPendingPayouts() {
    if (user?.role !== "admin") return;
    const data = await request<{ payouts: ProviderPayout[] }>("/api/admin/payouts/pending");
    setPendingPayouts(data.payouts || []);
  }

  async function loadPendingDeliveryOrders() {
    if (user?.role !== "admin") return;
    const data = await request<{ orders: Order[] }>("/api/admin/orders/pending-delivery");
    setPendingDeliveryOrders(normalizeOrders(data.orders || []));
  }

  async function loadTrashedOrders() {
    if (user?.role !== "admin") return;
    const data = await request<{ orders: Order[] }>("/api/admin/orders/trash");
    setTrashedOrders(normalizeOrders(data.orders || []));
  }

  async function loadDeliveryDrafts() {
    if (user?.role !== "admin") return;
    const data = await request<{ drafts: DeliveryDraft[] }>("/api/admin/delivery-drafts");
    setDeliveryDrafts(data.drafts || []);
  }

  async function loadWhatsAppInbound() {
    if (user?.role !== "admin") return;
    const data = await request<{ messages: WhatsAppInboundMessage[] }>("/api/admin/whatsapp/inbound");
    setWhatsappInboundMessages(data.messages || []);
  }

  async function loadAdminLogs() {
    if (user?.role !== "admin") return;
    const data = await request<{ logs: SystemLog[] }>("/api/admin/logs");
    setAdminLogs(data.logs || []);
  }

  async function loadAccountReports() {
    if (user?.role !== "admin") return;
    const data = await request<{ reports: AccountReport[] }>("/api/admin/account-reports");
    setAccountReports(data.reports || []);
  }

  async function loadProviderDeliveries() {
    if (user?.role !== "provider") return;
    const data = await request<{ deliveries: ProviderDelivery[] }>("/api/provider/deliveries");
    setProviderDeliveries(data.deliveries || []);
  }

  async function loadNotifications() {
    if (!user || !["client", "admin"].includes(user.role)) return;
    const data = await request<{ notifications: Notification[] }>("/api/notifications");
    setNotifications(data.notifications || []);
  }

  async function loadUnreadNotifications() {
    if (!user || !["client", "admin"].includes(user.role)) return;
    const data = await request<{ count: number }>("/api/notifications/unread-count");
    setUnreadNotifications(data.count || 0);
  }

  async function refreshClientData() {
    await Promise.all([loadProducts(), loadOrders(), loadNotifications(), loadUnreadNotifications()]);
  }

  async function refreshProviderData(options: { skipOrders?: boolean } = {}) {
    await Promise.all([options.skipOrders ? Promise.resolve() : loadOrders(), loadProviderDeliveries()]);
  }

  async function refreshAdminData() {
    await Promise.all([loadDashboard(), loadOrders(), loadUsers(), loadProducts(), loadClientInvoices(), loadProviderConfig(), loadPendingPayouts(), loadPendingDeliveryOrders(), loadTrashedOrders(), loadWhatsAppStatus(), loadEmailStatus(), loadDeliveryDrafts(), loadWhatsAppInbound(), loadAdminLogs(), loadAccountReports(), loadNotifications(), loadUnreadNotifications()]);
  }

  async function submitAccountReport(input: { delivered_account_id: string; reason: AccountReportReason; details: string; evidence_data_url: string }) {
    setBusy(true);
    try {
      const result = await request<{ report: AccountReport; message: string }>("/api/account-reports", {
        method: "POST",
        body: JSON.stringify(input)
      });
      setNotice(result.message || "Reporte enviado correctamente.");
      await refreshClientData().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function updateAccountReport(reportId: string, status: AccountReportStatus, adminNotes: string) {
    const result = await request<{ report: AccountReport; message: string }>(`/api/admin/account-reports/${reportId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, admin_notes: adminNotes })
    });
    setAccountReports((current) => current.map((report) => report.id === reportId ? result.report : report));
    setNotice(result.message || "Reporte actualizado.");
    await Promise.all([loadNotifications(), loadUnreadNotifications(), loadDashboard()]);
  }

  function addToCart(product: Product) {
    if (user?.role !== "client") {
      setNotice("Solo los clientes pueden agregar servicios al carrito.");
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { product, quantity: 1 }];
    });
    setSelectedAddedProduct(product);
    setAddedDetailOpen(true);
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => item.product.id === productId ? { ...item, quantity: item.quantity + delta } : item)
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  }

  async function checkout() {
    if (!user) {
      setNotice("Inicia sesion o crea una cuenta para confirmar la compra.");
      setView("auth");
      return;
    }
    if (user.role !== "client") {
      setNotice("Este flujo de compra solo esta disponible para clientes.");
      return;
    }
    if (!cart.length) return;
    setBusy(true);
    try {
      const result = await request<{ order: Order; message: string }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) })
      });
      setCart([]);
      setNotice(result.message || "Pedido creado correctamente. Estamos procesando tu solicitud.");
      await refreshClientData();
      setView("client");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Error creando el pedido");
    } finally {
      setBusy(false);
    }
  }

  async function authSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const payload = {
        access_code: String(form.get("access_code") || "")
      };
      const data = await request<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setUser(data.user);
      setView(getDefaultViewByRole(data.user.role));
      setNotice(`Sesion activa como ${data.user.name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo iniciar sesion");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setOrders([]);
    setDashboard(null);
    setClientInvoices([]);
    setCart([]);
    setAddedDetailOpen(false);
    setSelectedAddedProduct(null);
    setView("auth");
  }

  async function deliver(orderId: string, item: OrderItem, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await request(`/api/orders/${orderId}/deliveries`, {
        method: "POST",
        body: JSON.stringify({
          order_item_id: item.id,
          product_id: item.product_id,
          delivered_email: form.get("delivered_email"),
          delivered_password: form.get("delivered_password"),
          profile_name: form.get("profile_name"),
          pin: form.get("pin"),
          notes: form.get("notes")
        })
      });
      event.currentTarget.reset();
      setNotice("Cuenta cargada y asociada al cliente.");
      if (user?.role === "provider") await refreshProviderData();
      if (user?.role === "admin") await refreshAdminData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo cargar la cuenta");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    await request(`/api/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (user?.role === "provider") await refreshProviderData();
    if (user?.role === "admin") await refreshAdminData();
  }

  async function cancelClientOrder(order: Order) {
    if (!window.confirm(`Cancelar el pedido ${orderLabel(order)}?`)) return;
    setBusy(true);
    try {
      const data = await request<{ order: Order; message: string }>(`/api/orders/${order.id}/cancel`, { method: "PATCH" });
      setNotice(data.message || "Pedido cancelado correctamente.");
      await refreshClientData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo cancelar el pedido.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAdminOrder(order: Order) {
    const reason = window.prompt(`Motivo para enviar ${orderLabel(order)} a papelera`, "Eliminado desde panel admin") || "Eliminado desde panel admin";
    await request(`/api/admin/orders/${order.id}`, {
      method: "DELETE",
      body: JSON.stringify({ reason })
    });
    setNotice("Pedido enviado a papelera. Ya no se refleja en cliente/proveedor ni en cuentas.");
    await refreshAdminData();
  }

  async function saveOrderEdit(orderId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: form.get("status"),
        sale_total: Number(form.get("sale_total") || 0),
        provider_total: Number(form.get("provider_total") || 0),
        profit_total: Number(form.get("profit_total") || 0),
        payout_status: form.get("payout_status")
      })
    });
    setNotice("Pedido actualizado.");
    await refreshAdminData();
  }

  async function saveDeliveredAccountEdit(deliveryId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("delivered_password") || "").trim();
    if (password === "***") {
      setNotice("Ingresa la contrasena real de la cuenta. No se puede guardar ***.");
      return;
    }
    await request(`/api/admin/deliveries/${deliveryId}`, {
      method: "PATCH",
      body: JSON.stringify({
        delivered_email: form.get("delivered_email"),
        delivered_password: password || undefined,
        screen_name: form.get("screen_name"),
        profile_name: form.get("profile_name"),
        pin: form.get("pin"),
        notes: form.get("notes")
      })
    });
    setNotice("Cuenta entregada actualizada. El cliente vera la contrasena real al abrir el pedido.");
    await refreshAdminData();
  }

  async function generateServimilInvoice(period?: string) {
    try {
      const data = await request<{ invoice: ClientInvoice; message: string }>("/api/admin/invoices/servimil/generate", {
        method: "POST",
        body: JSON.stringify({ period: period || undefined })
      });
      setClientInvoices((current) => {
        const exists = current.some((invoice) => invoice.id === data.invoice.id);
        return exists
          ? current.map((invoice) => invoice.id === data.invoice.id ? data.invoice : invoice)
          : [data.invoice, ...current];
      });
      setNotice(data.message || "Factura de Servimil lista.");
      await refreshAdminData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo generar la factura.");
    }
  }

  async function saveClientInvoice(invoice: ClientInvoice, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lines = invoice.lines.map((line, index) => ({
      id: line.id,
      description: String(form.get(`line_${line.id}_description`) || ""),
      account_email: String(form.get(`line_${line.id}_account_email`) || ""),
      profile_name: String(form.get(`line_${line.id}_profile_name`) || ""),
      pin: String(form.get(`line_${line.id}_pin`) || ""),
      quantity: Number(form.get(`line_${line.id}_quantity`) || 1),
      unit_price: Number(form.get(`line_${line.id}_unit_price`) || 0),
      total: Number(form.get(`line_${line.id}_total`) || 0),
      ordered_at: String(form.get(`line_${line.id}_ordered_at`) || ""),
      delivered_at: String(form.get(`line_${line.id}_delivered_at`) || ""),
      notes: String(form.get(`line_${line.id}_notes`) || ""),
      position: index
    }));
    const data = await request<{ invoice: ClientInvoice; message: string }>(`/api/admin/invoices/${invoice.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: form.get("title"),
        status: form.get("status"),
        issue_date: form.get("issue_date"),
        due_date: form.get("due_date"),
        notes: form.get("notes"),
        lines
      })
    });
    setClientInvoices((current) => current.map((item) => item.id === data.invoice.id ? data.invoice : item));
    setNotice(data.message || "Factura actualizada.");
    await refreshAdminData();
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>, product?: Product) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const savingKey = product?.id || "new";
    setSavingProductId(savingKey);
    try {
      const form = new FormData(formElement);
      const payload = {
        name: form.get("name"),
        description: form.get("description"),
        category: form.get("category"),
        price: Number(form.get("price")),
        provider_cost: Number(form.get("provider_cost") || 0),
        active: form.get("active") === "on",
        brand_key: form.get("brand_key"),
        duration: form.get("duration"),
        screens: form.get("screens"),
        content_type: form.get("content_type"),
        benefits: String(form.get("benefits") || "").split("\n").map((item) => item.trim()).filter(Boolean)
      };
      const path = product ? `/api/admin/products/${product.id}` : "/api/admin/products";
      const data = await request<{ product: Product }>(path, {
        method: product ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setProducts((current) => product
        ? current.map((item) => item.id === data.product.id ? data.product : item)
        : [data.product, ...current]);
      if (!product) formElement.reset();
      const priceMessage = product && product.price !== data.product.price
        ? ` Precio de venta: ${money.format(product.price)} → ${money.format(data.product.price)}.`
        : "";
      setNotice(`${product ? "Producto actualizado" : "Producto creado"} correctamente.${priceMessage}`);
      await refreshAdminData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      setSavingProductId(null);
    }
  }

  async function saveProviderConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = await request<{ config: ProviderConfig }>("/api/admin/provider-config", {
      method: "PATCH",
      body: JSON.stringify({
        provider_name: form.get("provider_name"),
        provider_whatsapp_number: form.get("provider_whatsapp_number"),
        admin_notification_phone: form.get("admin_notification_phone"),
        admin_notification_email: form.get("admin_notification_email"),
        provider_notifications_active: form.get("provider_notifications_active") === "on",
        provider_notification_method: form.get("provider_notification_method"),
        provider_payment_method: form.get("provider_payment_method"),
        provider_payment_phone: form.get("provider_payment_phone"),
        provider_document: form.get("provider_document"),
        provider_payment_active: form.get("provider_payment_active") === "on"
      })
    });
    setProviderConfig(data.config);
    setNotice("Configuracion privada del proveedor actualizada.");
    await refreshAdminData();
  }

  async function saveAdminNotificationConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = await request<Pick<ProviderConfig, "admin_notification_phone" | "admin_notification_email">>("/api/admin/admin-notification-config", {
      method: "PATCH",
      body: JSON.stringify({
        admin_notification_phone: form.get("admin_notification_phone"),
        admin_notification_email: form.get("admin_notification_email")
      })
    });
    setProviderConfig((current) => ({ ...(current || ({} as ProviderConfig)), ...data }));
    setNotice("Destinos de WhatsApp y correo actualizados.");
    await refreshAdminData();
  }

  async function saveEmailConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const data = await request<{ status: EmailStatus }>("/api/admin/email/config", {
        method: "PATCH",
        body: JSON.stringify({
          host: form.get("smtp_host"),
          port: Number(form.get("smtp_port") || 587),
          secure: form.get("smtp_secure") === "true",
          user: form.get("smtp_user"),
          password: form.get("smtp_password"),
          from: form.get("smtp_from")
        })
      });
      setEmailStatus(data.status);
      setNotice("Configuracion SMTP guardada de forma cifrada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar la configuracion SMTP.");
    }
  }

  async function testAdminEmail() {
    try {
      const data = await request<{ status: EmailStatus; message: string }>("/api/admin/email/test", { method: "POST" });
      setEmailStatus(data.status);
      setNotice(data.message || "Correo de prueba enviado.");
      await loadAdminLogs();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo enviar el correo de prueba.");
      await loadEmailStatus();
    }
  }

  async function retryWhatsAppFailed() {
    const data = await request<{ status: WhatsAppBridgeStatus }>("/api/admin/whatsapp/retry-failed", { method: "POST" });
    setWhatsappStatus(data.status);
    setNotice("Mensajes fallidos reenviados a cola.");
    await refreshAdminData();
  }

  async function connectWhatsApp() {
    try {
      const data = await request<{ status: WhatsAppBridgeStatus; message: string }>("/api/admin/whatsapp/connect", { method: "POST" });
      setWhatsappStatus(data.status);
      setNotice(data.message || "Vinculacion de WhatsApp iniciada.");
      for (let attempt = 0; attempt < 18; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const current = await request<{ status: WhatsAppBridgeStatus }>("/api/admin/whatsapp/status");
        setWhatsappStatus(current.status);
        if (current.status.qrPending) {
          const qrData = await request<{ qr: string | null }>("/api/admin/whatsapp/qr");
          setWhatsappQr(qrData.qr);
          if (qrData.qr) break;
        } else {
          setWhatsappQr(null);
        }
        if (current.status.connection === "connected" || current.status.lastError) break;
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo iniciar la vinculacion.");
    }
  }

  async function disconnectWhatsApp() {
    const data = await request<{ status: WhatsAppBridgeStatus }>("/api/admin/whatsapp/disconnect", { method: "POST" });
    setWhatsappStatus(data.status);
    setWhatsappQr(null);
    setNotice("Sesion de WhatsApp Bridge desconectada.");
    await refreshAdminData();
  }

  async function testAdminWhatsApp() {
    try {
      const data = await request<{ status: WhatsAppBridgeStatus; message: string }>("/api/admin/whatsapp/test", { method: "POST" });
      setWhatsappStatus(data.status);
      setNotice(data.message || "Mensaje de prueba agregado a la cola.");
      await new Promise((resolve) => window.setTimeout(resolve, 5500));
      await refreshAdminData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo enviar la prueba de WhatsApp.");
    }
  }

  async function markReceiptSent(payout: ProviderPayout) {
    const reference = window.prompt("Referencia del pago manual (opcional)") || "";
    const notes = window.prompt("Nota del comprobante enviado (opcional)") || "";
    await request(`/api/admin/payouts/${payout.id}/mark-receipt-sent`, {
      method: "PATCH",
      body: JSON.stringify({ admin_payment_reference: reference, admin_payment_notes: notes })
    });
    setNotice("Comprobante marcado como enviado. El pedido fue liberado al proveedor.");
    await refreshAdminData();
  }

  async function cancelPayout(payout: ProviderPayout) {
    if (!window.confirm(`Cancelar el pedido ${payout.order?.order_number || payout.order_id}?`)) return;
    await request(`/api/admin/payouts/${payout.id}/cancel`, { method: "PATCH" });
    setNotice("Pedido cancelado.");
    await refreshAdminData();
  }

  async function approveDeliveryDraft(draft: DeliveryDraft) {
    const orderId = window.prompt("Numero de orden para aprobar", draft.order?.order_number || draft.order_id || draft.parsed_data.orderHint || "") || "";
    await request(`/api/admin/delivery-drafts/${draft.id}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ order_id: orderId || undefined })
    });
    setNotice("Borrador aprobado y cuenta agregada al pedido.");
    await refreshAdminData();
  }

  async function rejectDeliveryDraft(draft: DeliveryDraft) {
    const reviewNotes = window.prompt("Motivo del rechazo (opcional)") || "";
    await request(`/api/admin/delivery-drafts/${draft.id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ review_notes: reviewNotes })
    });
    setNotice("Borrador rechazado.");
    await refreshAdminData();
  }

  async function previewDeliveryMessage(orderId: string | undefined, rawText: string) {
    const order = pendingDeliveryOrders.find((item) => item.id === orderId);
    const data = await request<{ preview: DeliveryParserPreview; order: Order }>("/api/admin/delivery-parser/preview", {
      method: "POST",
      body: JSON.stringify({ orderNumber: order?.order_number, orderId, rawText })
    });
    await refreshAdminData();
    return { preview: data.preview, order: data.order };
  }

  async function approveParsedDelivery(orderId: string, rawText: string, items: DeliveryParserItem[]) {
    const order = pendingDeliveryOrders.find((item) => item.id === orderId);
    await request("/api/admin/delivery-parser/approve", {
      method: "POST",
      body: JSON.stringify({ orderNumber: order?.order_number, orderId, rawText, items })
    });
    setNotice("Cuentas aprobadas y entregadas al cliente.");
    await refreshAdminData();
  }

  async function saveDeliveryDraft(orderId: string, rawText: string, preview: DeliveryParserPreview) {
    const order = pendingDeliveryOrders.find((item) => item.id === orderId);
    await request("/api/admin/delivery-parser/draft", {
      method: "POST",
      body: JSON.stringify({ orderNumber: order?.order_number, orderId, rawText, preview })
    });
    setNotice("Borrador de entrega guardado.");
    await refreshAdminData();
  }

  async function markNotificationRead(notificationId: string) {
    await request(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
    if (user?.role === "admin") {
      await refreshAdminData();
    } else {
      await refreshClientData();
    }
  }

  function copy(text?: string | null) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setNotice("Dato copiado al portapapeles.");
  }

  return (
    <div className={view === "auth" ? "app-shell auth-mode" : "app-shell platform-mode"}>
      <AmbientBackground />
      {user && <nav className="navbar">
        <button className="brand-logo" onClick={() => setView(user ? getDefaultViewByRole(user.role) : "auth")}>
          <img className="brand-logo-image brand-logo-wordmark" src={centroDigitalWordmark} alt="Centro Digital de Diseño" />
        </button>
        <div className="nav-actions">
          {!user && <>
            <button className={view === "auth" ? "nav-pill active" : "nav-pill"} onClick={() => setView("auth")}>Ingresar</button>
          </>}
          {user?.role === "client" && <>
            <button className={view === "catalog" ? "nav-pill active" : "nav-pill"} onClick={() => setView("catalog")}>Tienda</button>
            <button className={view === "cart" ? "cart-button active" : "cart-button"} onClick={() => setView("cart")}>Carrito <strong>{cartCount}</strong></button>
            <button className={view === "client" ? "nav-pill active" : "nav-pill"} onClick={() => setView("client")}>Mis cuentas</button>
          </>}
          {user?.role === "provider" && <>
            <button className={view === "provider" ? "nav-pill active" : "nav-pill"} onClick={() => setView("provider")}>Pedidos en vivo</button>
          </>}
          {user?.role === "admin" && <>
            <button className={view === "admin" ? "nav-pill active" : "nav-pill"} onClick={() => setView("admin")}>Dashboard</button>
          </>}
          {user && <button className="nav-status" onClick={logout}><span className="pulse-dot" /> Cerrar sesion</button>}
        </div>
      </nav>}

      {notice && <button className="notice" onClick={() => setNotice("")}>{notice}</button>}

      {view === "auth" && <AuthLanding authSubmit={authSubmit} busy={busy} />}
      {view === "catalog" && user?.role === "client" && <Catalog products={products} addToCart={addToCart} />}
      {view === "cart" && user?.role === "client" && <CartPage cart={cart} total={cartTotal} changeQuantity={changeQuantity} removeFromCart={removeFromCart} checkout={checkout} busy={busy} onContinueShopping={() => setView("catalog")} />}
      {view === "client" && user?.role === "client" && <ClientPanel user={user} orders={orders} notifications={notifications} unreadNotifications={unreadNotifications} markNotificationRead={markNotificationRead} cancelOrder={cancelClientOrder} submitAccountReport={submitAccountReport} busy={busy} copy={copy} goToCatalog={() => setView("catalog")} />}
      {view === "provider" && user?.role === "provider" && <ProviderPanel orders={orders} deliveries={providerDeliveries} deliver={deliver} busy={busy} />}
      {view === "admin" && user?.role === "admin" && <AdminPanel dashboard={dashboard} users={users} products={products} orders={orders} trashedOrders={trashedOrders} pendingDeliveryOrders={pendingDeliveryOrders} pendingPayouts={pendingPayouts} invoices={clientInvoices} providerConfig={providerConfig} whatsappStatus={whatsappStatus} whatsappQr={whatsappQr} emailStatus={emailStatus} notifications={notifications} unreadNotifications={unreadNotifications} adminLogs={adminLogs} accountReports={accountReports} savingProductId={savingProductId} saveProduct={saveProduct} saveProviderConfig={saveProviderConfig} saveAdminNotificationConfig={saveAdminNotificationConfig} saveEmailConfig={saveEmailConfig} testAdminEmail={testAdminEmail} connectWhatsApp={connectWhatsApp} retryWhatsAppFailed={retryWhatsAppFailed} disconnectWhatsApp={disconnectWhatsApp} testAdminWhatsApp={testAdminWhatsApp} markReceiptSent={markReceiptSent} cancelPayout={cancelPayout} generateServimilInvoice={generateServimilInvoice} saveClientInvoice={saveClientInvoice} previewDeliveryMessage={previewDeliveryMessage} approveParsedDelivery={approveParsedDelivery} saveDeliveryDraft={saveDeliveryDraft} updateStatus={updateStatus} saveOrderEdit={saveOrderEdit} saveDeliveredAccountEdit={saveDeliveredAccountEdit} updateAccountReport={updateAccountReport} markNotificationRead={markNotificationRead} deleteOrder={deleteAdminOrder} copy={copy} />}

      <AddedProductModal
        product={selectedAddedProduct}
        open={addedDetailOpen}
        quantity={selectedAddedProduct ? cart.find((item) => item.product.id === selectedAddedProduct.id)?.quantity || 0 : 0}
        onQuantityChange={(delta) => selectedAddedProduct && changeQuantity(selectedAddedProduct.id, delta)}
        onContinueShopping={() => {
          setAddedDetailOpen(false);
          setSelectedAddedProduct(null);
          setView("catalog");
        }}
        onGoToCart={() => {
          setAddedDetailOpen(false);
          setSelectedAddedProduct(null);
          setView("cart");
        }}
      />

      {user && <footer className="footer">
        <p className="footer-brand"><img src={centroDigitalLogo} alt="" aria-hidden="true" /><strong>CENTRO DIGITAL DE DISENO</strong> &copy; 2026. PLATAFORMA DE GESTION DE ACTIVOS.</p>
      </footer>}
    </div>
  );
}

function AmbientBackground() {
  return (
    <div className="ambient-background">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    </div>
  );
}

function AuthLanding({ authSubmit, busy }: {
  authSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  return (
    <main className="auth-landing">
      <div className="auth-video-wall" aria-hidden="true">
        <video className="auth-background-video auth-background-video-one" autoPlay muted loop playsInline preload="auto">
          <source src={loginBackgroundOne} type="video/mp4" />
        </video>
        <video className="auth-background-video auth-background-video-two" autoPlay muted loop playsInline preload="auto">
          <source src={loginBackgroundTwo} type="video/mp4" />
        </video>
      </div>
      <section className="auth-copy">
        <div className="auth-brand-lockup">
          <img className="auth-brand-mark" src={centroDigitalLogo} alt="Imagotipo Centro Digital de Diseño" />
          <strong>CENTRO DIGITAL</strong>
        </div>
        <h1>Centro<br />Digital de<br /><span>Diseño</span></h1>
        <p className="auth-subtitle">Administrador de cuentas premium</p>
        <div className="auth-rule" />
        <div className="auth-feature-list">
          <article><b aria-hidden="true">◈</b><p><strong>Acceso seguro</strong><span>Protección a nivel empresarial</span></p></article>
          <article><b aria-hidden="true">ϟ</b><p><strong>Experiencia fluida</strong><span>Rendimiento rápido y confiable</span></p></article>
          <article><b aria-hidden="true">◇</b><p><strong>Gestión premium</strong><span>Control total de tus cuentas y permisos</span></p></article>
        </div>
      </section>
      <section className="auth-access-area">
        <AuthCard authSubmit={authSubmit} busy={busy} />
      </section>
    </main>
  );
}

function Catalog(props: {
  products: Product[];
  addToCart: (product: Product) => void;
}) {
  const categories = [...new Set(props.products.map((product) => product.category))];

  function moveLight(event: React.MouseEvent<HTMLElement>) {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  }

  return (
    <>
      <header className="hero">
        <h1>Infraestructura <span>Digital</span></h1>
        <p>Catalogo de cuentas premium con compra por carrito, notificacion interna al proveedor y entrega privada por panel.</p>
        <div className="auto-badge">Sistema de envio automatico 24/7</div>
      </header>
      <main className="page-shell">
        <section className="catalog-toolbar">
          <div>
            <span className="eyebrow">Servicios activos</span>
            <h2>{props.products.length} productos listos</h2>
          </div>
          <div className="category-strip">{categories.map((category) => <span key={category}>{category}</span>)}</div>
        </section>
        <section className="layout-two">
          <div className="grid-container">
            {props.products.map((product) => (
              <article className={`smart-card ${product.brand_key}`} key={product.id} onMouseMove={moveLight}>
                <div className="card-inner">
                  <div className="card-header">
                    <BrandLogo brandKey={product.brand_key} name={product.name} />
                    <div className="price-block">
                      <span className="price">{money.format(product.price)}</span>
                      <span className="period">Mensual</span>
                    </div>
                  </div>
                  <h3 className="service-title">{product.name}</h3>
                  <p className="service-desc">{product.description}</p>
                  <div className="specs">
                    <div className="spec-row"><span className="spec-label">Entrega</span><span className="spec-val auto-delivery">Panel privado</span></div>
                    <div className="spec-row"><span className="spec-label">Duracion</span><span className="spec-val">{product.duration || "Segun plan"}</span></div>
                    <div className="spec-row"><span className="spec-label">Pantallas</span><span className="spec-val">{product.screens || "Segun configuracion"}</span></div>
                    <div className="spec-row"><span className="spec-label">Categoria</span><span className="spec-val">{product.category}</span></div>
                  </div>
                  <button className="btn-interact" onClick={() => props.addToCart(product)}>Agregar al carrito <span>+</span></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function AuthCard({ authSubmit, busy }: {
  authSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  return (
    <aside className="auth-panel">
      <form className="form-stack" onSubmit={authSubmit}>
        <label className="sr-only" htmlFor="access_code">Código de acceso</label>
        <div className="auth-code-row">
          <span className="auth-lock-icon" aria-hidden="true">♧</span>
          <input id="access_code" className="auth-code-input" name="access_code" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="one-time-code" placeholder="Código de 4 dígitos" aria-describedby="access-code-help" required />
        </div>
        <span id="access-code-help" className="sr-only">Usa el código de cuatro dígitos asignado a tu perfil.</span>
        <button className="btn-solid auth-submit" disabled={busy}>{busy ? "Validando acceso..." : "Ingresar"}</button>
      </form>
    </aside>
  );
}

function AddedProductModal({ product, open, quantity, onQuantityChange, onContinueShopping, onGoToCart }: {
  product: Product | null;
  open: boolean;
  quantity: number;
  onQuantityChange: (delta: number) => void;
  onContinueShopping: () => void;
  onGoToCart: () => void;
}) {
  if (!open || !product) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <article className={`added-modal ${product.brand_key}`}>
        <div className="added-hero">
          <BrandLogo brandKey={product.brand_key} name={product.name} />
          <div className="price-block">
            <span className="price">{money.format(product.price)}</span>
            <span className="period">{product.duration || "Servicio digital"}</span>
          </div>
        </div>
        <div className="panel-title">
          <span className="eyebrow">Servicio agregado</span>
          <h2>{product.name}</h2>
        </div>
        <p className="detail-message">Este servicio fue agregado al carrito. Puedes seguir agregando mas servicios o revisar tu pedido antes de confirmar.</p>
        <p className="service-desc large">{product.description}</p>
        <div className="detail-specs">
          <div><span>Duracion</span><strong>{product.duration || "Segun plan"}</strong></div>
          <div><span>Pantallas / perfiles</span><strong>{product.screens || "Segun configuracion"}</strong></div>
          <div><span>Categoria</span><strong>{product.category}</strong></div>
          <div><span>Contenido</span><strong>{product.content_type || "Entretenimiento digital"}</strong></div>
        </div>
        <div className="benefits-box">
          <strong>Incluye</strong>
          <ul>
            {(product.benefits?.length ? product.benefits : ["Entrega por panel privado.", "Servicio gestionado por proveedor autorizado.", "Acceso segun disponibilidad del plan."]).map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>
        <div className="added-quantity">
          <div>
            <span className="eyebrow">Cantidad en carrito</span>
            <strong>{quantity} cuenta{quantity === 1 ? "" : "s"}</strong>
            <small>Total de este servicio: {money.format(product.price * quantity)}</small>
          </div>
          <div className="qty modal-qty">
            <button onClick={() => onQuantityChange(-1)} disabled={quantity <= 1}>-</button>
            <span>{quantity}</span>
            <button onClick={() => onQuantityChange(1)}>+</button>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onContinueShopping}>Seguir agregando servicios</button>
          <button className="btn-solid" onClick={onGoToCart}>Ir al carrito</button>
        </div>
      </article>
    </div>
  );
}

function CartPage({ cart, total, changeQuantity, removeFromCart, checkout, busy, onContinueShopping }: {
  cart: CartItem[];
  total: number;
  changeQuantity: (productId: string, delta: number) => void;
  removeFromCart: (productId: string) => void;
  checkout: () => void;
  busy: boolean;
  onContinueShopping: () => void;
}) {
  return (
    <main className="page-shell panel-page">
      <SectionTitle eyebrow="Resumen previo" title="Carrito de servicios" />
      <section className="cart-page-grid">
        <div className="glass-panel cart-summary">
          {cart.length === 0 && <p className="empty">Aun no hay productos seleccionados. Vuelve al catalogo para agregar servicios antes de confirmar.</p>}
          {cart.map((item) => (
            <article className={`cart-summary-row ${item.product.brand_key}`} key={item.product.id}>
              <BrandLogo brandKey={item.product.brand_key} name={item.product.name} small />
              <div className="cart-product-info">
                <strong>{item.product.name}</strong>
                <span>{item.product.duration || "Servicio digital"} - {item.product.screens || "Segun configuracion"}</span>
                <p>{item.product.description}</p>
              </div>
              <div className="cart-money">
                <span>Unitario</span>
                <strong>{money.format(item.product.price)}</strong>
              </div>
              <div className="qty">
                <button onClick={() => changeQuantity(item.product.id, -1)}>-</button>
                <span>{item.quantity}</span>
                <button onClick={() => changeQuantity(item.product.id, 1)}>+</button>
              </div>
              <div className="cart-money">
                <span>Subtotal</span>
                <strong>{money.format(item.product.price * item.quantity)}</strong>
              </div>
              <button className="remove-button" onClick={() => removeFromCart(item.product.id)}>Eliminar</button>
            </article>
          ))}
        </div>
        <aside className="glass-panel checkout-panel">
          <SectionTitle eyebrow="Confirmacion" title="Pedido" compact />
          <div className="checkout-lines">
            {cart.map((item) => (
              <div key={item.product.id}>
                <span>{item.quantity} x {item.product.name}</span>
                <strong>{money.format(item.product.price * item.quantity)}</strong>
              </div>
            ))}
            <div className="checkout-total">
              <span>Total general</span>
              <strong>{money.format(total)}</strong>
            </div>
          </div>
          <p className="hint">Al confirmar, el pedido se creara en la base de datos y el proveedor sera notificado internamente.</p>
          <button className="btn-ghost" onClick={onContinueShopping}>Seguir agregando servicios</button>
          <button className="btn-solid" onClick={checkout} disabled={busy || !cart.length}>{busy ? "Creando pedido..." : "Confirmar pedido"}</button>
        </aside>
      </section>
    </main>
  );
}

function normalizeOrders(orders: any[]): Order[] {
  return orders.map((order) => {
    const deliveries = order.deliveries || [];
    return {
      ...order,
      items: (order.items || []).map((item: any) => ({
        ...item,
        delivered_accounts: deliveries.filter((account: any) => account.order_item_id === item.id)
      }))
    };
  });
}

type ClientDeliveryRow = {
  order: Order;
  item: OrderItem;
  account: DeliveredAccount;
  unitValue: number;
  deliveredUnits: number;
  totalValue: number;
};

type DeliveredAccountDirectoryRow = {
  account: DeliveredAccount;
  email: string;
  password: string;
  profile: string;
  pin: string;
};

function orderItemUnitValue(item: OrderItem) {
  return item.unit_price || (item.subtotal && item.quantity ? Math.round(item.subtotal / item.quantity) : 0);
}

function expectedOrderUnits(order: Order) {
  return order.items.reduce((sum, item) => sum + Math.max(item.quantity || 0, 0), 0);
}

function buildClientDeliveryRows(orders: Order[]): ClientDeliveryRow[] {
  return orders.flatMap((order) =>
    order.items.flatMap((item) => {
      const accounts = item.delivered_accounts || [];
      const unitValue = orderItemUnitValue(item);
      const missingUnitsCoveredByDeliveredStatus =
        order.status === "delivered" && accounts.length > 0
          ? Math.max((item.quantity || 1) - accounts.length, 0)
          : 0;

      return accounts.map((account, index) => {
        const deliveredUnits = 1 + (index === 0 ? missingUnitsCoveredByDeliveredStatus : 0);
        return {
          order,
          item,
          account,
          unitValue,
          deliveredUnits,
          totalValue: unitValue * deliveredUnits
        };
      });
    })
  ).sort((a, b) => new Date(b.account.delivered_at).getTime() - new Date(a.account.delivered_at).getTime());
}

function buildDeliveredAccountDirectory(orders: Order[]): DeliveredAccountDirectoryRow[] {
  return orders.flatMap((order) =>
    order.items.flatMap((item) =>
      (item.delivered_accounts || []).map((account) => ({
        account,
        email: account.delivered_email || "-",
        password: readablePassword(account.delivered_password),
        profile: account.profile_name || "-",
        pin: account.pin || "-"
      }))
    )
  ).sort((a, b) => new Date(b.account.delivered_at).getTime() - new Date(a.account.delivered_at).getTime());
}

function deliveredUnitsForOrder(order: Order) {
  return buildClientDeliveryRows([order]).reduce((sum, delivery) => sum + delivery.deliveredUnits, 0);
}

function orderIsFullyDelivered(order: Order) {
  const expectedUnits = expectedOrderUnits(order);
  return expectedUnits > 0 && deliveredUnitsForOrder(order) >= expectedUnits;
}

function ClientPanel({ user, orders, notifications, unreadNotifications, markNotificationRead, cancelOrder, submitAccountReport, busy, copy, goToCatalog }: {
  user: User;
  orders: Order[];
  notifications: Notification[];
  unreadNotifications: number;
  markNotificationRead: (notificationId: string) => void;
  cancelOrder: (order: Order) => void;
  submitAccountReport: (input: { delivered_account_id: string; reason: AccountReportReason; details: string; evidence_data_url: string }) => Promise<void>;
  busy: boolean;
  copy: (text?: string | null) => void;
  goToCatalog: () => void;
}) {
  const [clientSearch, setClientSearch] = useState("");
  const [accountsModalOrder, setAccountsModalOrder] = useState<Order | null>(null);
  const [reportRequest, setReportRequest] = useState<{ deliveries: ClientDeliveryRow[]; initialAccountId?: string } | null>(null);
  const [clientTab, setClientTab] = useState<"orders" | "accounts" | "notifications">("orders");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const deliveries = buildClientDeliveryRows(orders);
  const deliveredTotal = deliveries.reduce((sum, delivery) => sum + delivery.totalValue, 0);
  const deliveredUnitCount = deliveries.reduce((sum, delivery) => sum + delivery.deliveredUnits, 0);
  const pendingOrders = orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled");
  const deliveredOrders = orders.filter((order) => order.status === "delivered");
  const normalizedSearch = clientSearch.trim().toLowerCase();
  const filteredOrders = normalizedSearch
    ? orders.filter((order) =>
        [
          order.id,
          order.order_number,
          order.status,
          order.items.map((item) => item.product_name).join(" "),
          order.items.map((item) => item.quantity).join(" ")
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      )
    : orders;
  const filteredDeliveries = normalizedSearch
    ? deliveries.filter(({ order, item, account }) =>
        [order.id, order.order_number, item.product_name, account.delivered_email, account.profile_name, account.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      )
    : deliveries;
  const filteredNotifications = normalizedSearch
    ? notifications.filter((notification) =>
        [notification.title, notification.message, notification.type, notification.order_id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      )
    : notifications;
  const filteredDeliveryUnits = filteredDeliveries.reduce((sum, delivery) => sum + delivery.deliveredUnits, 0);
  const lastActivity = [
    ...orders.map((order) => order.updated_at || order.created_at),
    ...notifications.map((notification) => notification.created_at),
    ...deliveries.map((delivery) => delivery.account.delivered_at)
  ].filter(Boolean).sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0];
  const servimilClient = isServimilClient(user);
  const clientDisplayName = servimilClient ? "Servimil" : user.name || "Centro Digital";
  const clientAvatar = servimilClient ? <img src={servimilLogo} alt="Servimil" /> : "CD";
  const selectTab = (tab: "orders" | "accounts" | "notifications") => {
    setClientTab(tab);
    setSidebarOpen(false);
  };

  return (
    <main className={sidebarOpen ? "client-dashboard sidebar-expanded" : "client-dashboard sidebar-collapsed"}>
      <aside className={sidebarOpen ? "client-sidebar open" : "client-sidebar"} aria-label="Panel cliente">
        <nav className="client-side-nav">
          <button className={clientTab === "orders" ? "active" : ""} onClick={() => selectTab("orders")}>Dashboard</button>
          <button onClick={() => { goToCatalog(); setSidebarOpen(false); }}>Productos</button>
          <button className={clientTab === "accounts" ? "active" : ""} onClick={() => selectTab("accounts")}>Cuentas <strong>{deliveredUnitCount}</strong></button>
          <button className={clientTab === "notifications" ? "active" : ""} onClick={() => selectTab("notifications")}>Notificaciones <strong>{unreadNotifications}</strong></button>
        </nav>
        <div className={servimilClient ? "client-profile-card branded-client-card" : "client-profile-card"}>
          <div className={servimilClient ? "client-avatar client-logo-avatar" : "client-avatar"}>{clientAvatar}</div>
          <div>
            <strong>{clientDisplayName}</strong>
            <span>Cliente activo</span>
          </div>
        </div>
      </aside>

      <section className="client-workspace">
        <header className="client-topbar">
          <button className="client-menu-button" onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? "Retraer menu de cliente" : "Expandir menu de cliente"} aria-expanded={sidebarOpen}><span /></button>
          <label className="client-search">
            <span>Buscar</span>
            <input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Buscar pedidos, productos o cuentas..." />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="client-top-status">
            <span className="client-online-dot">En linea</span>
            <div className={servimilClient ? "client-avatar compact client-logo-avatar" : "client-avatar compact"}>{clientAvatar}</div>
          </div>
        </header>

        <div className="client-hero-row">
          <div>
            <span className="eyebrow">Panel cliente</span>
            <h1>Hola, {clientDisplayName}.</h1>
            <p>Aqui tienes el resumen de tus pedidos, cuentas entregadas y avisos recientes.</p>
          </div>
          <span className="client-refresh-note">Ultima actividad: {formatDateTime(lastActivity)}</span>
        </div>

        <div className="client-kpi-grid">
          <ClientMetricCard tone="blue" label="Pedidos" value={orders.length} caption="Total historico" />
          <ClientMetricCard tone="orange" label="Pendientes" value={pendingOrders.length} caption="En proceso" />
          <ClientMetricCard tone="green" label="Entregados" value={deliveredOrders.length} caption="Completados" />
          <ClientMetricCard tone="purple" label="Notificaciones" value={unreadNotifications} caption="Sin leer" />
          <ClientMetricCard tone="blue" label="Cuentas disponibles" value={deliveredUnitCount} caption="Activas" />
          <ClientMetricCard tone="green" label="Valor entregado" value={money.format(deliveredTotal)} caption="Cuentas recibidas" />
        </div>

        <section className="client-main-panel">
          <nav className="section-tabs client-panel-tabs" aria-label="Panel cliente">
            <button className={clientTab === "orders" ? "active" : ""} onClick={() => selectTab("orders")}>Pedidos</button>
            <button className={clientTab === "accounts" ? "active" : ""} onClick={() => selectTab("accounts")}>Mis cuentas</button>
            <button className={clientTab === "notifications" ? "active" : ""} onClick={() => selectTab("notifications")}>Notificaciones <strong>{unreadNotifications}</strong></button>
          </nav>

          {clientTab === "orders" && <ClientOrderTable orders={filteredOrders} onOpenAccounts={setAccountsModalOrder} onCancelOrder={cancelOrder} onReportOrder={(order) => setReportRequest({ deliveries: buildClientDeliveryRows([order]) })} />}
          {clientTab === "accounts" && <section className="client-accounts-panel delivered-accounts-panel">
          <SectionTitle eyebrow="Privado" title="Mis cuentas entregadas" compact />
          <div className="delivered-toolbar">
            <div>
              <strong>{filteredDeliveryUnits} de {deliveredUnitCount} cuentas</strong>
              <span>Total entregado: {money.format(deliveredTotal)}</span>
            </div>
            <span className="client-filter-note">Filtrado por el buscador superior</span>
          </div>
          <div className="table-scroll delivered-table">
            <table>
              <thead>
                <tr><th>Orden</th><th>Compra</th><th>Entrega</th><th>Servicio</th><th>Cant.</th><th>Valor</th><th>Correo / usuario</th><th>Contrasena</th><th>Pantalla</th><th>Perfil</th><th>PIN</th><th>Notas</th><th>Accion</th></tr>
              </thead>
              <tbody>
                {filteredDeliveries.map(({ order, item, account, deliveredUnits, totalValue }) => (
                  <tr key={account.id}>
                    <td>{orderLabel(order)}</td>
                    <td>{formatDateTime(order.created_at)}</td>
                    <td>{formatDateTime(account.delivered_at)}</td>
                    <td>{item.product_name}</td>
                    <td>{deliveredUnits}</td>
                    <td>{money.format(totalValue)}</td>
                    <td><button className="table-copy" onClick={() => copy(account.delivered_email)}>{account.delivered_email || "-"}</button></td>
                    <td><span className="table-secret-value">{readablePassword(account.delivered_password)}</span></td>
                    <td>{accountScreen(account.notes) || "-"}</td>
                    <td>{account.profile_name ? <button className="table-copy" onClick={() => copy(account.profile_name || "")}>{account.profile_name}</button> : "-"}</td>
                    <td>{account.pin ? <button className="table-copy" onClick={() => copy(account.pin || "")}>{account.pin}</button> : "-"}</td>
                    <td>{visibleAccountNotes(account.notes) || "-"}</td>
                    <td><button className="report-account-button" onClick={() => setReportRequest({ deliveries: [{ order, item, account, deliveredUnits, totalValue, unitValue: orderItemUnitValue(item) }], initialAccountId: account.id })}>Reportar cuenta</button></td>
                  </tr>
                ))}
                {filteredDeliveries.length === 0 && <tr><td colSpan={13}>Cuando el proveedor cargue las cuentas apareceran aqui.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>}
          {clientTab === "notifications" && <NotificationsPanel notifications={filteredNotifications} markNotificationRead={markNotificationRead} title="Notificaciones" emptyMessage="No tienes notificaciones pendientes." embedded />}
        </section>
      </section>
      <AccountsModal order={accountsModalOrder} onClose={() => setAccountsModalOrder(null)} onReportAccount={(delivery) => { setAccountsModalOrder(null); setReportRequest({ deliveries: [delivery], initialAccountId: delivery.account.id }); }} />
      <AccountReportModal
        request={reportRequest}
        busy={busy}
        onClose={() => setReportRequest(null)}
        onSubmit={async (input) => {
          await submitAccountReport(input);
          setReportRequest(null);
        }}
      />
    </main>
  );
}

function ClientOrderTable({ orders, onOpenAccounts, onCancelOrder, onReportOrder }: { orders: Order[]; onOpenAccounts: (order: Order) => void; onCancelOrder: (order: Order) => void; onReportOrder: (order: Order) => void }) {
  return (
    <section className="client-table-panel table-panel">
      <div className="table-scroll">
        <table>
          <thead><tr><th>Orden</th><th>Productos</th><th>Total</th><th>Estado</th><th>Fecha pedido</th><th>Fecha entrega</th><th>Cuentas</th><th>Accion</th></tr></thead>
          <tbody>
            {orders.map((order) => {
              const accountCount = deliveredUnitsForOrder(order);
              const canCancel = order.status !== "delivered" && order.status !== "cancelled" && accountCount === 0;
              return (
                <tr key={order.id}>
                  <td>{orderLabel(order)}</td>
                  <td>{order.items.map((item) => `${item.quantity}x ${item.product_name}`).join(", ")}</td>
                  <td>{money.format(order.total)}</td>
                  <td><SimpleOrderBadge delivered={orderIsFullyDelivered(order)} /></td>
                  <td>{formatDateTime(order.created_at)}</td>
                  <td>{formatDateTime(order.delivered_at)}</td>
                  <td>
                    {accountCount > 0 ? (
                      <button className="account-icon-button" onClick={() => onOpenAccounts(order)} title="Ver cuentas entregadas">
                        <span className="account-icon" aria-hidden="true" />
                        <strong>{accountCount}</strong>
                      </button>
                    ) : (
                      <span className="muted-cell">Pendiente</span>
                    )}
                  </td>
                  <td>
                    {canCancel ? (
                      <button className="danger-link" onClick={() => onCancelOrder(order)}>Cancelar</button>
                    ) : accountCount > 0 ? (
                      <button className="report-account-button" onClick={() => onReportOrder(order)}>Reportar cuenta</button>
                    ) : (
                      <span className="muted-cell">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AccountsModal({ order, onClose, onReportAccount }: { order: Order | null; onClose: () => void; onReportAccount: (delivery: ClientDeliveryRow) => void }) {
  if (!order) return null;
  const deliveries = buildClientDeliveryRows([order]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <article className="accounts-modal">
        <div className="modal-headline">
          <div>
            <span className="eyebrow">Cuentas entregadas</span>
            <h2>{orderLabel(order)}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>Cerrar</button>
        </div>
        <div className="accounts-modal-list">
          {deliveries.map((delivery) => {
            const { item, account, deliveredUnits, totalValue } = delivery;
            return (
            <article className="account-access-card" key={account.id}>
              <div>
                <strong>{item.product_name}</strong>
                <span>Compra: {formatDateTime(order.created_at)} - Entrega: {formatDateTime(account.delivered_at)}</span>
              </div>
              <div className="account-access-grid">
                <div className="account-detail-field"><span>Cantidad</span><strong>{deliveredUnits}</strong></div>
                <div className="account-detail-field"><span>Valor</span><strong>{money.format(totalValue)}</strong></div>
                <div className="account-detail-field"><span>Usuario</span><strong>{account.delivered_email || "-"}</strong></div>
                <div className="account-detail-field"><span>Contrasena</span><strong>{readablePassword(account.delivered_password)}</strong></div>
                <div className="account-detail-field"><span>Pantalla</span><strong>{accountScreen(account.notes) || "-"}</strong></div>
                <div className="account-detail-field"><span>Perfil</span><strong>{account.profile_name || "-"}</strong></div>
                <div className="account-detail-field"><span>PIN</span><strong>{account.pin || "-"}</strong></div>
              </div>
              {visibleAccountNotes(account.notes) && <p>{visibleAccountNotes(account.notes)}</p>}
              <button className="report-account-button account-card-report" onClick={() => onReportAccount(delivery)}>Reportar esta cuenta</button>
            </article>
          );})}
        </div>
      </article>
    </div>
  );
}

function AccountReportModal({ request, busy, onClose, onSubmit }: {
  request: { deliveries: ClientDeliveryRow[]; initialAccountId?: string } | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { delivered_account_id: string; reason: AccountReportReason; details: string; evidence_data_url: string }) => Promise<void>;
}) {
  const [accountId, setAccountId] = useState("");
  const [reason, setReason] = useState<AccountReportReason>("defective");
  const [details, setDetails] = useState("");
  const [evidence, setEvidence] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!request) return;
    setAccountId(request.initialAccountId || request.deliveries[0]?.account.id || "");
    setReason("defective");
    setDetails("");
    setEvidence("");
    setError("");
  }, [request]);

  if (!request) return null;
  const selected = request.deliveries.find((delivery) => delivery.account.id === accountId) || request.deliveries[0];

  async function selectEvidence(file?: File) {
    if (!file) return;
    setProcessingImage(true);
    setError("");
    try {
      setEvidence(await evidenceImageDataUrl(file));
    } catch (caught) {
      setEvidence("");
      setError(caught instanceof Error ? caught.message : "No fue posible procesar la evidencia.");
    } finally {
      setProcessingImage(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountId || !evidence) {
      setError("Selecciona la cuenta y adjunta una imagen de evidencia.");
      return;
    }
    setError("");
    try {
      await onSubmit({ delivered_account_id: accountId, reason, details, evidence_data_url: evidence });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible enviar el reporte.");
    }
  }

  return (
    <div className="modal-backdrop report-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="account-report-title">
      <form className="account-report-modal" onSubmit={submit}>
        <div className="modal-headline">
          <div>
            <span className="eyebrow">Soporte de cuentas</span>
            <h2 id="account-report-title">Reportar una cuenta</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}>Cerrar</button>
        </div>
        <p className="report-modal-intro">Cuéntanos qué sucedió. La evidencia ayudará al equipo a revisar y reemplazar la cuenta con mayor rapidez.</p>
        <label>
          Cuenta afectada
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
            {request.deliveries.map(({ order, item, account }) => (
              <option key={account.id} value={account.id}>{item.product_name} · {account.delivered_email || account.profile_name || "Cuenta entregada"} · {orderLabel(order)}</option>
            ))}
          </select>
        </label>
        {selected && (
          <div className="report-account-summary">
            <BrandLogo brandKey={undefined} name={selected.item.product_name} small />
            <div><strong>{selected.item.product_name}</strong><span>Entregada {formatDateTime(selected.account.delivered_at)}</span></div>
            <span>{selected.account.delivered_email || selected.account.profile_name || "Sin usuario visible"}</span>
          </div>
        )}
        <label>
          ¿Qué sucedió?
          <select value={reason} onChange={(event) => setReason(event.target.value as AccountReportReason)} required>
            {accountReportReasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Detalles adicionales
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1200} placeholder="Ejemplo: al ingresar aparece un mensaje de contraseña incorrecta..." />
          <small>{details.length}/1200</small>
        </label>
        <label className={evidence ? "report-evidence-field ready" : "report-evidence-field"}>
          <span>{evidence ? "Evidencia lista" : "Adjuntar imagen de evidencia"}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectEvidence(event.target.files?.[0])} required={!evidence} />
          <small>{processingImage ? "Optimizando imagen..." : "PNG, JPG o WEBP. La imagen se optimiza antes de enviarse."}</small>
        </label>
        {evidence && <img className="report-evidence-preview" src={evidence} alt="Vista previa de la evidencia" />}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions report-modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn-solid" disabled={busy || processingImage || !evidence}>{busy ? "Enviando reporte..." : "Enviar reporte"}</button>
        </div>
      </form>
    </div>
  );
}

function NotificationsPanel({ notifications, markNotificationRead, title, emptyMessage, embedded = false }: {
  notifications: Notification[];
  markNotificationRead: (notificationId: string) => void;
  title: string;
  emptyMessage: string;
  embedded?: boolean;
}) {
  const unread = notifications.filter((notification) => !notification.read);
  return (
    <section className={embedded ? "notifications-panel embedded-notifications" : "glass-panel notifications-panel"}>
      <SectionTitle eyebrow="Bandeja" title={title} compact />
      <div className="notification-summary">
        <Metric label="Sin leer" value={unread.length} />
        <Metric label="Total avisos" value={notifications.length} />
      </div>
      <div className="data-list notification-list">
        {notifications.length === 0 && <p className="empty">{emptyMessage}</p>}
        {notifications.map((notification) => (
          <article className={notification.read ? "inline-product notification-item read" : "inline-product notification-item"} key={notification.id}>
            <div>
              <strong>{notification.title}</strong>
              <span>{notification.message}</span>
              <small>{formatDateTime(notification.created_at)}</small>
            </div>
            {!notification.read ? (
              <button onClick={() => markNotificationRead(notification.id)}>Marcar leida</button>
            ) : (
              <span className="muted-cell">Leida</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

type MetricIconName = "orders" | "pending" | "delivered" | "notifications" | "accounts" | "money" | "provider" | "profit" | "whatsapp" | "warning" | "review" | "history";

function metricIconForLabel(label: string): MetricIconName {
  const normalized = label.toLowerCase();
  if (normalized.includes("whatsapp") && normalized.includes("fallid")) return "warning";
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("notificacion") || normalized.includes("aviso")) return "notifications";
  if (normalized.includes("pendiente") || normalized.includes("abierto")) return "pending";
  if (normalized.includes("entregado") || normalized.includes("resuelto")) return "delivered";
  if (normalized.includes("cuenta")) return "accounts";
  if (normalized.includes("proveedor")) return "provider";
  if (normalized.includes("utilidad")) return "profit";
  if (normalized.includes("valor") || normalized.includes("vendido")) return "money";
  if (normalized.includes("revision")) return "review";
  if (normalized.includes("historial")) return "history";
  return "orders";
}

function MetricCardIcon({ name }: { name: MetricIconName }) {
  const paths: Record<MetricIconName, React.ReactNode> = {
    orders: <><path d="M7 3.75h10a2 2 0 0 1 2 2v14.5H5V5.75a2 2 0 0 1 2-2Z" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,
    pending: <><circle cx="12" cy="12" r="8.25" /><path d="M12 7.5V12l3 2" /></>,
    delivered: <><circle cx="12" cy="12" r="8.25" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    notifications: <><path d="M6.5 16.5h11l-1.3-2.1V10a4.2 4.2 0 0 0-8.4 0v4.4L6.5 16.5Z" /><path d="M10 19h4" /></>,
    accounts: <><circle cx="12" cy="8.5" r="3" /><path d="M6.5 19v-1.5A4.5 4.5 0 0 1 11 13h2a4.5 4.5 0 0 1 4.5 4.5V19" /></>,
    money: <><circle cx="12" cy="12" r="8.25" /><path d="M14.8 8.8c-.7-.8-1.7-1.2-2.8-1.2-1.7 0-3 .9-3 2.2 0 3.4 6 1.3 6 4.5 0 1.3-1.3 2.2-3 2.2-1.2 0-2.4-.5-3.1-1.4M12 5.8v12.4" /></>,
    provider: <><path d="M3.5 6.5h10v9h-10zM13.5 9h3.3l2.2 2.7v3.8h-5.5z" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></>,
    profit: <><path d="M4 17.5 9 12l3 2.8L20 6.5" /><path d="M15.5 6.5H20V11" /></>,
    whatsapp: <><path d="M12 4a7.5 7.5 0 0 0-6.4 11.4L4.5 19.5l4.2-1.1A7.5 7.5 0 1 0 12 4Z" /><path d="M9 9.2c.8 2.4 2.4 4 4.8 4.8l1.2-1.2" /></>,
    warning: <><path d="m12 4 8 15H4L12 4Z" /><path d="M12 9v4.5M12 16.5h.01" /></>,
    review: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m14.5 14.5 4 4M10.5 8v5M8 10.5h5" /></>,
    history: <><path d="M5.5 8A7.5 7.5 0 1 1 5 15" /><path d="M5.5 4.5V8h3.5M12 8v4l2.8 1.8" /></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function ClientMetricCard({ tone, label, value, caption, icon }: { tone: "blue" | "orange" | "green" | "purple"; label: string; value: string | number; caption: string; icon?: MetricIconName }) {
  return (
    <article className={`client-metric-card ${tone}`}>
      <div className="client-metric-top">
        <span className="client-metric-icon"><MetricCardIcon name={icon || metricIconForLabel(label)} /></span>
        <div>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      </div>
      <div className="client-metric-bottom">
        <small>{caption}</small>
        <svg viewBox="0 0 86 30" aria-hidden="true" focusable="false">
          <path d="M3 22 L17 18 L29 20 L42 10 L55 15 L68 7 L83 4" />
        </svg>
      </div>
    </article>
  );
}

function ProviderPanel({ orders, deliveries, deliver, busy }: {
  orders: Order[];
  deliveries: ProviderDelivery[];
  deliver: (orderId: string, item: OrderItem, event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  const [providerTab, setProviderTab] = useState<"pending" | "history">("pending");
  const [providerSearch, setProviderSearch] = useState("");
  const [providerSidebarOpen, setProviderSidebarOpen] = useState(false);
  const isPendingProviderOrder = (order: Order) => order.status !== "delivered" && order.status !== "cancelled";
  const activeOrders = orders.filter(isPendingProviderOrder);
  const pendingValue = activeOrders.reduce((sum, order) => sum + (order.provider_total || order.total), 0);
  const normalizedProviderSearch = providerSearch.trim().toLowerCase();
  const ordered = [...orders].sort((a, b) => {
    const weight: Record<OrderStatus, number> = { admin_payment_pending: 0, provider_delivery_pending: 1, wallet_pending: 2, payout_processing: 3, pending_payment: 4, paid: 5, pending: 6, processing: 7, delivered: 8, payout_failed: 9, payment_failed: 10, cancelled: 11 };
    return weight[a.status] - weight[b.status] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const visibleActiveOrders = normalizedProviderSearch
    ? ordered.filter(isPendingProviderOrder).filter((order) =>
        [order.id, order.order_number, order.user?.name, order.items.map((item) => item.product_name).join(" ")]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedProviderSearch))
      )
    : ordered.filter(isPendingProviderOrder);
  const visibleDeliveries = normalizedProviderSearch
    ? deliveries.filter((delivery) =>
        [delivery.order_id, delivery.order_number, delivery.product_name, delivery.client_name, delivery.delivered_email, delivery.profile_name, delivery.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedProviderSearch))
      )
    : deliveries;
  const selectProviderTab = (tab: "pending" | "history") => {
    setProviderTab(tab);
    setProviderSidebarOpen(false);
  };

  return (
    <main className={providerSidebarOpen ? "operator-dashboard provider-operator-dashboard sidebar-expanded" : "operator-dashboard provider-operator-dashboard sidebar-collapsed"}>
      <aside className={providerSidebarOpen ? "operator-sidebar open" : "operator-sidebar"} aria-label="Panel proveedor">
        <nav className="operator-side-nav">
          <button className={providerTab === "pending" ? "active" : ""} onClick={() => selectProviderTab("pending")}>Pendientes <strong>{activeOrders.length}</strong></button>
          <button className={providerTab === "history" ? "active" : ""} onClick={() => selectProviderTab("history")}>Historial <strong>{deliveries.length}</strong></button>
        </nav>
        <div className="client-profile-card">
          <div className="client-avatar">PR</div>
          <div>
            <strong>Proveedor</strong>
            <span>Pedidos en vivo</span>
          </div>
        </div>
      </aside>

      <section className="operator-workspace">
        <header className="client-topbar">
          <button className="client-menu-button" onClick={() => setProviderSidebarOpen((open) => !open)} aria-label={providerSidebarOpen ? "Retraer menu de proveedor" : "Expandir menu de proveedor"} aria-expanded={providerSidebarOpen}><span /></button>
          <label className="client-search">
            <span>Buscar</span>
            <input value={providerSearch} onChange={(event) => setProviderSearch(event.target.value)} placeholder="Buscar pedido, cliente o producto..." />
            <kbd>5s</kbd>
          </label>
          <div className="client-top-status">
            <span className="client-online-dot">Pedidos en vivo</span>
            <div className="client-avatar compact">PR</div>
          </div>
        </header>

        <div className="client-hero-row">
          <div>
            <span className="eyebrow">Panel proveedor</span>
            <h1>Pedidos pendientes y entregas.</h1>
            <p>Gestiona solicitudes liberadas para entrega y revisa el historial real de cuentas cargadas.</p>
          </div>
          <span className="client-refresh-note">Actualizacion automatica cada 5 segundos</span>
        </div>

        <div className="client-kpi-grid provider-kpi-grid">
          <ClientMetricCard tone="orange" label="Pendientes" value={activeOrders.length} caption="Listos para entregar" />
          <ClientMetricCard tone="green" label="Entregados hoy" value={deliveries.filter((delivery) => new Date(delivery.delivered_at).toDateString() === new Date().toDateString()).length} caption="Actividad del dia" />
          <ClientMetricCard tone="blue" label="Total entregados" value={deliveries.length} caption="Historial" />
          <ClientMetricCard tone="purple" label="Valor pendiente" value={money.format(pendingValue)} caption="Costo proveedor" />
        </div>

        <section className="client-main-panel operator-main-panel">
          <nav className="section-tabs client-panel-tabs" aria-label="Panel proveedor">
            <button className={providerTab === "pending" ? "active" : ""} onClick={() => selectProviderTab("pending")}>Pedidos pendientes</button>
            <button className={providerTab === "history" ? "active" : ""} onClick={() => selectProviderTab("history")}>Pedidos entregados <strong>{deliveries.length}</strong></button>
          </nav>
          {providerTab === "pending" && (
            <div className="data-list">
              {visibleActiveOrders.length === 0 && <p className="empty">No hay pedidos pendientes en este momento.</p>}
              {visibleActiveOrders.map((order) => (
                <OrderWorkCard key={order.id} order={order} deliver={deliver} busy={busy} />
              ))}
            </div>
          )}
          {providerTab === "history" && (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Fecha</th><th>Pedido</th><th>Producto</th><th>Cliente</th><th>Estado</th><th>Usuario</th><th>Perfil</th><th>Notas</th></tr></thead>
                <tbody>
                  {visibleDeliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td>{formatDateTime(delivery.delivered_at)}</td>
                      <td>{delivery.order_number || `#${delivery.order_id.slice(0, 8)}`}</td>
                      <td>{delivery.product_name}</td>
                      <td>{delivery.client_name}</td>
                      <td><SimpleOrderBadge delivered /></td>
                      <td>{delivery.delivered_email || "-"}</td>
                      <td>{delivery.profile_name || "-"}</td>
                      <td>{delivery.notes || "-"}</td>
                    </tr>
                  ))}
                  {visibleDeliveries.length === 0 && <tr><td colSpan={8}>Aun no hay entregas registradas.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function currentInvoicePeriod() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function escapeHtml(value?: string | number | null) {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  };
  return String(value ?? "").replace(/[&<>"']/g, (character) => replacements[character]);
}

function absoluteAssetUrl(src: string) {
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

function invoiceFileName(invoice: ClientInvoice, extension: "pdf" | "doc") {
  return `${invoice.invoice_number || "factura"}-${invoice.period || "periodo"}.${extension}`.replace(/[^\w.-]+/g, "-");
}

function invoiceDocumentHtml(invoice: ClientInvoice, servimilUser?: User) {
  const rows = invoice.lines.map((line) => `
    <tr>
      <td>${escapeHtml(orderLabel(line.order))}</td>
      <td>${escapeHtml(line.description)}</td>
      <td>${escapeHtml(line.account_email || "-")}</td>
      <td>${escapeHtml(line.profile_name || "-")}</td>
      <td>${escapeHtml(line.pin || "-")}</td>
      <td>${escapeHtml(formatDateTime(line.ordered_at))}</td>
      <td>${escapeHtml(formatDateTime(line.delivered_at))}</td>
      <td>${escapeHtml(line.quantity)}</td>
      <td>${escapeHtml(money.format(line.unit_price))}</td>
      <td>${escapeHtml(money.format(line.total))}</td>
    </tr>`).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoice_number)}</title>
  <style>
    body { margin: 0; padding: 28px; color: #0f172a; font-family: Arial, Helvetica, sans-serif; background: #f8fafc; }
    .paper { max-width: 980px; margin: 0 auto; padding: 34px; background: #fff; border: 1px solid #dbe4f0; border-radius: 18px; }
    .top { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #e8eef7; padding-bottom: 20px; }
    .brand, .client { display: flex; gap: 12px; align-items: center; }
    .brand img, .client img { width: 52px; height: 52px; object-fit: contain; }
    h1 { margin: 22px 0 6px; font-size: 30px; }
    h2, p { margin: 0; }
    .muted { color: #64748b; font-size: 12px; font-weight: 700; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 22px 0; }
    .meta div { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
    .label { display: block; color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .value { display: block; margin-top: 5px; font-size: 15px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; color: #475569; text-align: left; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 9px 8px; vertical-align: top; }
    .total { display: flex; justify-content: flex-end; gap: 24px; align-items: center; margin-top: 22px; font-size: 20px; font-weight: 900; }
    .notes { margin-top: 20px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <main class="paper">
    <section class="top">
      <div class="brand">
        <img src="${escapeHtml(absoluteAssetUrl(centroDigitalLogo))}" alt="Centro Digital" />
        <div>
          <h2>Centro Digital de Diseno</h2>
          <p class="muted">Plataforma de gestion de activos</p>
        </div>
      </div>
      <div class="client">
        <img src="${escapeHtml(absoluteAssetUrl(servimilLogo))}" alt="Servimil" />
        <div>
          <h2>${escapeHtml(servimilUser?.name || "Servimil")}</h2>
          <p class="muted">Cliente codigo 1111</p>
        </div>
      </div>
    </section>
    <h1>${escapeHtml(invoice.title || "Factura mensual")}</h1>
    <p class="muted">${escapeHtml(invoice.invoice_number)} - Periodo ${escapeHtml(invoice.period)}</p>
    <section class="meta">
      <div><span class="label">Factura</span><span class="value">${escapeHtml(invoice.invoice_number)}</span></div>
      <div><span class="label">Emision</span><span class="value">${escapeHtml(formatDateTime(invoice.issue_date))}</span></div>
      <div><span class="label">Vencimiento</span><span class="value">${escapeHtml(formatDateTime(invoice.due_date))}</span></div>
      <div><span class="label">Estado</span><span class="value">${escapeHtml(invoiceStatusLabel(invoice.status))}</span></div>
      <div><span class="label">Cliente</span><span class="value">${escapeHtml(servimilUser?.name || "Servimil")}</span></div>
      <div><span class="label">Total</span><span class="value">${escapeHtml(money.format(invoice.total_amount))}</span></div>
    </section>
    <table>
      <thead>
        <tr>
          <th>Orden</th>
          <th>Servicio</th>
          <th>Correo</th>
          <th>Perfil</th>
          <th>PIN</th>
          <th>Pedido</th>
          <th>Entrega</th>
          <th>Cant.</th>
          <th>Valor</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="10">No hay cuentas entregadas para este periodo.</td></tr>`}</tbody>
    </table>
    <div class="total"><span>Total a cobrar</span><strong>${escapeHtml(money.format(invoice.total_amount))}</strong></div>
    ${invoice.notes ? `<div class="notes">${escapeHtml(invoice.notes)}</div>` : ""}
  </main>
</body>
</html>`;
}

function downloadBlob(filename: string, mime: string, content: BlobPart) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function foldPdfText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ");
}

function escapePdfText(value: string) {
  return foldPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\s+/g, " ").trim();
}

function wrapPdfText(value: string, maxLength = 108) {
  const words = foldPdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function invoicePdfLines(invoice: ClientInvoice, servimilUser?: User) {
  const lines: string[] = [
    "CENTRO DIGITAL DE DISENO",
    "Factura mensual",
    `Factura: ${invoice.invoice_number}`,
    `Cliente: ${servimilUser?.name || "Servimil"} - Codigo 1111`,
    `Periodo: ${invoice.period}`,
    `Emision: ${formatDateTime(invoice.issue_date)}`,
    `Vencimiento: ${formatDateTime(invoice.due_date)}`,
    `Estado: ${invoiceStatusLabel(invoice.status)}`,
    `Total a cobrar: ${money.format(invoice.total_amount)}`,
    "",
    "DETALLE"
  ];

  invoice.lines.forEach((line, index) => {
    lines.push(`${index + 1}. ${orderLabel(line.order)} - ${line.description}`);
    lines.push(`   Correo: ${line.account_email || "-"} | Perfil: ${line.profile_name || "-"} | PIN: ${line.pin || "-"}`);
    lines.push(`   Pedido: ${formatDateTime(line.ordered_at)} | Entrega: ${formatDateTime(line.delivered_at)} | Cant: ${line.quantity} | Valor: ${money.format(line.unit_price)} | Total: ${money.format(line.total)}`);
    if (line.notes) lines.push(`   Notas: ${line.notes}`);
    lines.push("");
  });

  if (!invoice.lines.length) lines.push("No hay cuentas entregadas para este periodo.");
  if (invoice.notes) lines.push(`Notas generales: ${invoice.notes}`);
  return lines.flatMap((line) => wrapPdfText(line));
}

function createInvoicePdf(invoice: ClientInvoice, servimilUser?: User) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const startY = 800;
  const lineHeight = 13;
  const maxLinesPerPage = 55;
  const lines = invoicePdfLines(invoice, servimilUser);
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    chunks.push(lines.slice(index, index + maxLinesPerPage));
  }

  const objects: string[] = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let nextId = 4;
  const pageIds: number[] = [];
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  chunks.forEach((chunk) => {
    const content = [
      "BT",
      "/F1 10 Tf",
      `${marginX} ${startY} Td`,
      `${lineHeight} TL`,
      ...chunk.map((line) => `(${escapePdfText(line)}) Tj T*`),
      "ET"
    ].join("\n");
    const contentId = nextId++;
    const pageId = nextId++;
    objects[contentId] = `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageIds.push(pageId);
  });

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = new TextEncoder().encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefStart = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f\n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n\n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function downloadInvoiceDoc(invoice: ClientInvoice, servimilUser?: User) {
  downloadBlob(invoiceFileName(invoice, "doc"), "application/msword;charset=utf-8", invoiceDocumentHtml(invoice, servimilUser));
}

function downloadInvoicePdf(invoice: ClientInvoice, servimilUser?: User) {
  downloadBlob(invoiceFileName(invoice, "pdf"), "application/pdf", createInvoicePdf(invoice, servimilUser));
}

function printInvoice(invoice: ClientInvoice, servimilUser?: User) {
  const popup = window.open("", "_blank");
  if (!popup) return;
  popup.opener = null;
  popup.document.write(invoiceDocumentHtml(invoice, servimilUser));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 250);
}

function OrderWorkCard({ order, deliver, busy }: {
  order: Order;
  deliver: (orderId: string, item: OrderItem, event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  const pendingItems = order.items.filter((item) => (item.delivered_accounts?.length || 0) < item.quantity);
  return (
    <article className="work-card">
      <div className="work-head">
        <strong>{orderLabel(order)}</strong>
        <SimpleOrderBadge delivered={false} />
      </div>
      <div className="order-meta">
        <span>Cliente: <strong>{order.user?.name || "Cliente"}</strong></span>
        <span>Fecha: <strong>{formatDateTime(order.created_at)}</strong></span>
        <span>Metodo pago: <strong>{order.providerPayouts?.[0]?.method || "Configurado por admin"}</strong></span>
        <span>Total proveedor: <strong>{money.format(order.provider_total || order.total)}</strong></span>
      </div>
      {pendingItems.map((item) => {
        const deliveredCount = item.delivered_accounts?.length || 0;
        const remaining = Math.max(item.quantity - deliveredCount, 0);
        return (
        <form className="delivery-form" key={item.id} onSubmit={(event) => deliver(order.id, item, event)}>
          <span>{remaining} pendiente(s) de {item.quantity} - {item.product_name} - Valor proveedor: {money.format(item.subtotal || 0)}</span>
          <input name="delivered_email" type="email" placeholder="Correo entregado" required />
          <input name="delivered_password" placeholder="Contrasena" required />
          <div className="mini-grid">
            <input name="profile_name" placeholder="Perfil" />
            <input name="pin" placeholder="PIN" />
          </div>
          <textarea name="notes" placeholder="Observaciones" />
          <button className="btn-solid" disabled={busy}>Cargar cuenta y entregar</button>
        </form>
        );
      })}
    </article>
  );
}

function InvoiceDocumentPreview({ invoice, servimilUser }: { invoice: ClientInvoice; servimilUser?: User }) {
  return (
    <section className="invoice-preview-shell" aria-label="Vista previa de factura">
      <div className="invoice-preview-paper">
        <header className="invoice-preview-header">
          <div className="invoice-preview-brand">
            <img src={centroDigitalLogo} alt="Centro Digital" />
            <div>
              <strong>Centro Digital de Diseno</strong>
              <span>Plataforma de gestion de activos</span>
            </div>
          </div>
          <div className="invoice-preview-client">
            <img src={servimilLogo} alt="Servimil" />
            <div>
              <strong>{servimilUser?.name || "Servimil"}</strong>
              <span>Cliente codigo 1111</span>
            </div>
          </div>
        </header>

        <div className="invoice-preview-title">
          <span className="eyebrow">Vista previa</span>
          <h2>{invoice.title || "Factura mensual"}</h2>
          <p>{invoice.invoice_number} - Periodo {invoice.period}</p>
        </div>

        <div className="invoice-preview-meta">
          <div><span>Factura</span><strong>{invoice.invoice_number}</strong></div>
          <div><span>Emision</span><strong>{formatDateTime(invoice.issue_date)}</strong></div>
          <div><span>Vencimiento</span><strong>{formatDateTime(invoice.due_date)}</strong></div>
          <div><span>Estado</span><strong>{invoiceStatusLabel(invoice.status)}</strong></div>
          <div><span>Cliente</span><strong>{servimilUser?.name || "Servimil"}</strong></div>
          <div><span>Total</span><strong>{money.format(invoice.total_amount)}</strong></div>
        </div>

        <div className="table-scroll invoice-preview-table">
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Servicio</th>
                <th>Correo</th>
                <th>Perfil</th>
                <th>PIN</th>
                <th>Pedido</th>
                <th>Entrega</th>
                <th>Cant.</th>
                <th>Valor</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td>{orderLabel(line.order)}</td>
                  <td>{line.description}</td>
                  <td>{line.account_email || "-"}</td>
                  <td>{line.profile_name || "-"}</td>
                  <td>{line.pin || "-"}</td>
                  <td>{formatDateTime(line.ordered_at)}</td>
                  <td>{formatDateTime(line.delivered_at)}</td>
                  <td>{line.quantity}</td>
                  <td>{money.format(line.unit_price)}</td>
                  <td>{money.format(line.total)}</td>
                </tr>
              ))}
              {invoice.lines.length === 0 && (
                <tr><td colSpan={10}>No hay cuentas entregadas para este periodo.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="invoice-preview-total">
          <span>Total a cobrar</span>
          <strong>{money.format(invoice.total_amount)}</strong>
        </footer>
        {invoice.notes && <p className="invoice-preview-notes">{invoice.notes}</p>}
      </div>
    </section>
  );
}

function AdminBillingPanel({ invoices, servimilUser, generateServimilInvoice, saveClientInvoice }: {
  invoices: ClientInvoice[];
  servimilUser?: User;
  generateServimilInvoice: (period?: string) => void;
  saveClientInvoice: (invoice: ClientInvoice, event: FormEvent<HTMLFormElement>) => void;
}) {
  const [period, setPeriod] = useState(currentInvoicePeriod());
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(invoices[0]?.id || null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) || invoices[0] || null;
  const totalPending = invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled").reduce((sum, invoice) => sum + invoice.total_amount, 0);

  useEffect(() => {
    if (!selectedInvoiceId && invoices[0]) setSelectedInvoiceId(invoices[0].id);
  }, [invoices, selectedInvoiceId]);

  return (
    <section className="glass-panel admin-module-panel billing-panel">
      <div className="billing-hero">
        <div className="servimil-admin-head billing-client-head">
          <img src={servimilLogo} alt="Servimil" />
          <div>
            <span className="eyebrow">Facturacion mensual</span>
            <strong>{servimilUser?.name || "Servimil"}</strong>
            <span>Cliente codigo 1111 - se emite 2 dias antes y vence el dia 30.</span>
          </div>
        </div>
        <div className="billing-generate-box">
          <label>
            Periodo
            <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
          </label>
          <button className="btn-solid" type="button" onClick={() => generateServimilInvoice(period)}>Generar factura ahora</button>
        </div>
      </div>

      <div className="dashboard-grid mini-metrics">
        <Metric label="Facturas" value={invoices.length} />
        <Metric label="Pendiente de cobro" value={money.format(totalPending)} />
        <Metric label="Ultima factura" value={selectedInvoice?.invoice_number || "-"} />
      </div>

      <div className="billing-layout">
        <aside className="invoice-list">
          {invoices.length === 0 && <p className="empty">Aun no hay facturas generadas. Crea la primera para Servimil.</p>}
          {invoices.map((invoice) => (
            <button
              key={invoice.id}
              className={selectedInvoice?.id === invoice.id ? "invoice-list-item active" : "invoice-list-item"}
              type="button"
              onClick={() => setSelectedInvoiceId(invoice.id)}
            >
              <strong>{invoice.invoice_number}</strong>
              <span>{invoice.period} - {invoice.status}</span>
              <em>{money.format(invoice.total_amount)}</em>
            </button>
          ))}
        </aside>

        {selectedInvoice && (
          <form key={selectedInvoice.id} className="invoice-editor" onSubmit={(event) => saveClientInvoice(selectedInvoice, event)}>
            <div className="invoice-editor-head">
              <label>
                Titulo
                <input name="title" defaultValue={selectedInvoice.title} />
              </label>
              <label>
                Estado
                <select name="status" defaultValue={selectedInvoice.status}>
                  <option value="draft">Borrador</option>
                  <option value="sent">Enviada</option>
                  <option value="paid">Pagada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </label>
              <label>
                Emision
                <input name="issue_date" type="datetime-local" defaultValue={dateTimeInputValue(selectedInvoice.issue_date)} />
              </label>
              <label>
                Vencimiento
                <input name="due_date" type="datetime-local" defaultValue={dateTimeInputValue(selectedInvoice.due_date)} />
              </label>
              <label className="invoice-notes-field">
                Notas
                <textarea name="notes" defaultValue={selectedInvoice.notes || ""} />
              </label>
            </div>

            <div className="invoice-total-strip">
              <span>Total factura</span>
              <strong>{money.format(selectedInvoice.total_amount)}</strong>
              <small>Las lineas se pueden editar antes de guardar.</small>
            </div>

            <div className="table-scroll invoice-lines-table">
              <table>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Servicio</th>
                    <th>Correo</th>
                    <th>Perfil</th>
                    <th>PIN</th>
                    <th>Fecha pedido</th>
                    <th>Fecha entrega</th>
                    <th>Cant.</th>
                    <th>Valor</th>
                    <th>Total</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{orderLabel(line.order)}</td>
                      <td><input name={`line_${line.id}_description`} defaultValue={line.description} /></td>
                      <td><input name={`line_${line.id}_account_email`} defaultValue={line.account_email || ""} /></td>
                      <td><input name={`line_${line.id}_profile_name`} defaultValue={line.profile_name || ""} /></td>
                      <td><input name={`line_${line.id}_pin`} defaultValue={line.pin || ""} /></td>
                      <td><input name={`line_${line.id}_ordered_at`} type="datetime-local" defaultValue={dateTimeInputValue(line.ordered_at)} /></td>
                      <td><input name={`line_${line.id}_delivered_at`} type="datetime-local" defaultValue={dateTimeInputValue(line.delivered_at)} /></td>
                      <td><input name={`line_${line.id}_quantity`} type="number" min="1" defaultValue={line.quantity} /></td>
                      <td><input name={`line_${line.id}_unit_price`} type="number" min="0" defaultValue={line.unit_price} /></td>
                      <td><input name={`line_${line.id}_total`} type="number" min="0" defaultValue={line.total} /></td>
                      <td><input name={`line_${line.id}_notes`} defaultValue={line.notes || ""} /></td>
                    </tr>
                  ))}
                  {selectedInvoice.lines.length === 0 && (
                    <tr><td colSpan={11}>No hay cuentas entregadas para este periodo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="status-actions invoice-actions">
              <button className="btn-solid">Guardar factura</button>
              <button type="button" onClick={() => generateServimilInvoice(selectedInvoice.period)}>Actualizar con cuentas nuevas</button>
              <button type="button" onClick={() => setPreviewOpen((open) => !open)}>{previewOpen ? "Ocultar vista previa" : "Vista previa"}</button>
              <button type="button" onClick={() => downloadInvoicePdf(selectedInvoice, servimilUser)}>Descargar PDF</button>
              <button type="button" onClick={() => printInvoice(selectedInvoice, servimilUser)}>Imprimir / guardar PDF</button>
              <button type="button" onClick={() => downloadInvoiceDoc(selectedInvoice, servimilUser)}>Descargar DOC</button>
            </div>
            {previewOpen && <InvoiceDocumentPreview invoice={selectedInvoice} servimilUser={servimilUser} />}
          </form>
        )}
      </div>
    </section>
  );
}

function AdminAccountReports({ reports, updateReport }: { reports: AccountReport[]; updateReport: (reportId: string, status: AccountReportStatus, adminNotes: string) => Promise<void> }) {
  const [filter, setFilter] = useState<"active" | "all" | AccountReportStatus>("active");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const visibleReports = reports.filter((report) => filter === "all" || (filter === "active" ? ["open", "reviewing"].includes(report.status) : report.status === filter));

  async function save(report: AccountReport, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingId(report.id);
    setError("");
    try {
      await updateReport(report.id, form.get("status") as AccountReportStatus, String(form.get("admin_notes") || ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible actualizar el reporte.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="glass-panel admin-module-panel account-reports-panel">
      <div className="report-panel-heading">
        <SectionTitle eyebrow="Soporte" title="Reportes de cuentas" compact />
        <label>
          Estado
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="active">Pendientes de atencion</option>
            <option value="all">Todos</option>
            {accountReportStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="report-admin-summary">
        <ClientMetricCard tone="orange" label="Abiertos" value={reports.filter((report) => report.status === "open").length} caption="Nuevos casos" />
        <ClientMetricCard tone="blue" label="En revision" value={reports.filter((report) => report.status === "reviewing").length} caption="En seguimiento" />
        <ClientMetricCard tone="green" label="Resueltos" value={reports.filter((report) => report.status === "resolved").length} caption="Casos atendidos" />
      </div>
      <div className="account-report-list">
        {error && <p className="form-error" role="alert">{error}</p>}
        {visibleReports.length === 0 && <p className="empty">No hay reportes en este estado.</p>}
        {visibleReports.map((report) => (
          <article className="admin-report-card" key={report.id}>
            <div className="admin-report-evidence">
              <a href={report.evidence_data_url} target="_blank" rel="noreferrer" title="Abrir evidencia completa">
                <img src={report.evidence_data_url} alt={`Evidencia del reporte de ${report.delivered_account?.product_name || "cuenta"}`} />
                <span>Ver evidencia completa</span>
              </a>
            </div>
            <div className="admin-report-detail">
              <div className="admin-report-title">
                <div>
                  <span className="eyebrow">{report.order?.order_number || `#${report.order_id.slice(0, 8)}`}</span>
                  <h3>{report.delivered_account?.product_name || "Cuenta entregada"}</h3>
                </div>
                <span className={`report-status-badge ${report.status}`}>{accountReportStatusLabel(report.status)}</span>
              </div>
              <dl className="report-facts">
                <div><dt>Cliente</dt><dd>{report.user?.name || "-"}<small>{report.user?.email || ""}</small></dd></div>
                <div><dt>Cuenta</dt><dd>{report.delivered_account?.delivered_email || report.delivered_account?.profile_name || "-"}</dd></div>
                <div><dt>Motivo</dt><dd>{accountReportReasonLabel(report.reason)}</dd></div>
                <div><dt>Reportado</dt><dd>{formatDateTime(report.created_at)}</dd></div>
              </dl>
              {report.details && <div className="report-client-message"><strong>Detalle del cliente</strong><p>{report.details}</p></div>}
              <form className="admin-report-form" onSubmit={(event) => save(report, event)}>
                <label>
                  Estado del caso
                  <select name="status" defaultValue={report.status}>
                    {accountReportStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  Respuesta o nota para el cliente
                  <textarea name="admin_notes" defaultValue={report.admin_notes || ""} maxLength={1200} placeholder="Indica la solucion, reemplazo o resultado de la revision..." />
                </label>
                <button className="btn-solid" disabled={savingId === report.id}>{savingId === report.id ? "Guardando..." : "Actualizar y notificar"}</button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminPanel({ dashboard, users, products, orders, trashedOrders, pendingDeliveryOrders, pendingPayouts, invoices, providerConfig, whatsappStatus, whatsappQr, emailStatus, notifications, unreadNotifications, adminLogs, accountReports, savingProductId, saveProduct, saveProviderConfig, saveAdminNotificationConfig, saveEmailConfig, testAdminEmail, connectWhatsApp, retryWhatsAppFailed, disconnectWhatsApp, testAdminWhatsApp, markReceiptSent, cancelPayout, generateServimilInvoice, saveClientInvoice, previewDeliveryMessage, approveParsedDelivery, saveDeliveryDraft, updateStatus, saveOrderEdit, saveDeliveredAccountEdit, updateAccountReport, markNotificationRead, deleteOrder, copy }: {
  dashboard: Dashboard | null;
  users: User[];
  products: Product[];
  orders: Order[];
  trashedOrders: Order[];
  pendingDeliveryOrders: Order[];
  pendingPayouts: ProviderPayout[];
  invoices: ClientInvoice[];
  providerConfig: ProviderConfig | null;
  whatsappStatus: WhatsAppBridgeStatus | null;
  whatsappQr: string | null;
  emailStatus: EmailStatus | null;
  notifications: Notification[];
  unreadNotifications: number;
  adminLogs: SystemLog[];
  accountReports: AccountReport[];
  savingProductId: string | null;
  saveProduct: (event: FormEvent<HTMLFormElement>, product?: Product) => Promise<void>;
  saveProviderConfig: (event: FormEvent<HTMLFormElement>) => void;
  saveAdminNotificationConfig: (event: FormEvent<HTMLFormElement>) => void;
  saveEmailConfig: (event: FormEvent<HTMLFormElement>) => void;
  testAdminEmail: () => void;
  connectWhatsApp: () => void;
  retryWhatsAppFailed: () => void;
  disconnectWhatsApp: () => void;
  testAdminWhatsApp: () => void;
  markReceiptSent: (payout: ProviderPayout) => void;
  cancelPayout: (payout: ProviderPayout) => void;
  generateServimilInvoice: (period?: string) => void;
  saveClientInvoice: (invoice: ClientInvoice, event: FormEvent<HTMLFormElement>) => void;
  previewDeliveryMessage: (orderId: string | undefined, rawText: string) => Promise<{ preview: DeliveryParserPreview; order: Order }>;
  approveParsedDelivery: (orderId: string, rawText: string, items: DeliveryParserItem[]) => Promise<void>;
  saveDeliveryDraft: (orderId: string, rawText: string, preview: DeliveryParserPreview) => Promise<void>;
  updateStatus: (orderId: string, status: OrderStatus) => void;
  saveOrderEdit: (orderId: string, event: FormEvent<HTMLFormElement>) => void;
  saveDeliveredAccountEdit: (deliveryId: string, event: FormEvent<HTMLFormElement>) => void;
  updateAccountReport: (reportId: string, status: AccountReportStatus, adminNotes: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => void;
  deleteOrder: (order: Order) => void;
  copy: (text?: string | null) => void;
}) {
  const pendingOrders = pendingDeliveryOrders;
  const [parserOrderId, setParserOrderId] = useState("");
  const [parserRawText, setParserRawText] = useState("");
  const [parserPreview, setParserPreview] = useState<DeliveryParserPreview | null>(null);
  const selectedParserOrder = pendingOrders.find((order) => order.id === parserOrderId);
  const previewItems = parserPreview?.items || [];
  const readyPreviewItems = previewItems.filter((item) =>
    item.matchedOrderItemId
    && item.matchedProductId
    && (item.delivered_email || item.delivered_user)
    && item.delivered_password
  );

  async function interpretDeliveryMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parserOrderId || !parserRawText.trim()) return;
    const { preview, order } = await previewDeliveryMessage(parserOrderId || undefined, parserRawText);
    setParserOrderId(order.id);
    setParserPreview(preview);
  }

  function updatePreviewItem(index: number, patch: Partial<DeliveryParserItem>) {
    setParserPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
      };
    });
  }

  function pendingQuantityForOrderItem(orderItem: OrderItem) {
    return orderItem.pending_quantity ?? Math.max(orderItem.quantity - (orderItem.delivered_accounts?.length || 0), 0);
  }

  function manualItemForOrder(orderItem?: OrderItem): DeliveryParserItem {
    return {
      serviceName: orderItem?.product_name || "Cuenta manual",
      matchedOrderItemId: orderItem?.id,
      matchedProductId: orderItem?.product_id,
      delivered_email: "",
      delivered_password: "",
      profile_name: "",
      pin: "",
      notes: "",
      confidence: 0,
      needsReview: true,
      incompatible: false
    };
  }

  function addManualPreviewItem() {
    if (!selectedParserOrder) return;
    const firstPendingItem = selectedParserOrder.items.find((item) => pendingQuantityForOrderItem(item) > 0) || selectedParserOrder.items[0];
    setParserPreview((current) => ({
      confidence: current?.confidence || 0,
      warnings: current?.warnings || ["Carga manual iniciada. Asigna el producto y completa los datos de acceso."],
      items: [...(current?.items || []), manualItemForOrder(firstPendingItem)]
    }));
  }

  function assignPreviewItemToOrderItem(index: number, orderItemId: string) {
    const orderItem = selectedParserOrder?.items.find((item) => item.id === orderItemId);
    updatePreviewItem(index, {
      serviceName: orderItem?.product_name || "Cuenta manual",
      matchedOrderItemId: orderItem?.id,
      matchedProductId: orderItem?.product_id,
      needsReview: !orderItem,
      incompatible: false,
      incompatibleReason: undefined
    });
  }

  async function approvePreview() {
    if (!parserPreview || !parserOrderId) return;
    await approveParsedDelivery(parserOrderId, parserRawText || "Carga manual de cuentas", readyPreviewItems);
    setParserPreview(null);
    setParserRawText("");
  }

  async function savePreviewAsDraft() {
    if (!parserPreview || !parserOrderId) return;
    await saveDeliveryDraft(parserOrderId, parserRawText, parserPreview);
    setParserPreview(null);
    setParserRawText("");
  }

  type AdminModule = "dashboard" | "orders" | "accounts" | "reports" | "billing" | "process" | "payouts" | "products" | "servimil" | "provider" | "whatsapp" | "notifications" | "movements" | "trash" | "logs";
  const [adminModule, setAdminModule] = useState<AdminModule>("dashboard");
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [deliveredAccountSearch, setDeliveredAccountSearch] = useState("");
  const adminModules: Array<{ id: AdminModule; label: string; group: string }> = [
    { id: "dashboard", label: "Resumen", group: "Vision general" },
    { id: "orders", label: "Pedidos", group: "Operacion" },
    { id: "process", label: "Procesar cuentas", group: "Operacion" },
    { id: "accounts", label: "Cuentas entregadas", group: "Operacion" },
    { id: "reports", label: `Reportes de cuentas (${accountReports.filter((report) => ["open", "reviewing"].includes(report.status)).length})`, group: "Operacion" },
    { id: "billing", label: "Facturacion", group: "Finanzas" },
    { id: "payouts", label: "Pagos al proveedor", group: "Finanzas" },
    { id: "products", label: "Catalogo", group: "Configuracion" },
    { id: "servimil", label: "Cliente Servimil", group: "Configuracion" },
    { id: "provider", label: "Proveedor", group: "Configuracion" },
    { id: "whatsapp", label: "WhatsApp admin", group: "Canales" },
    { id: "notifications", label: "Notificaciones", group: "Canales" },
    { id: "movements", label: "Movimientos", group: "Auditoria" },
    { id: "logs", label: "Registros tecnicos", group: "Auditoria" },
    { id: "trash", label: "Papelera", group: "Auditoria" }
  ];
  const adminModuleGroups = [...new Set(adminModules.map((module) => module.group))];
  const servimilUser = users.find((user) => user.name.toLowerCase().includes("servimil") || user.email === "cliente@centrodigital.local");
  const servimilOrders = orders.filter((order) => !servimilUser || order.user_id === servimilUser.id || order.user?.name?.toLowerCase().includes("servimil"));
  const servimilDeliveredAccounts = servimilOrders.flatMap((order) => order.items.flatMap((item) => item.delivered_accounts || []));
  const providerPayoutHistory = dashboard?.providerPayouts || [];
  const bridgeConnectedNumber = normalizePhoneForCompare(whatsappStatus?.connectedNumber);
  const adminNotificationNumber = normalizePhoneForCompare(providerConfig?.admin_notification_phone);
  const adminUsesBridgeNumber = Boolean(bridgeConnectedNumber && adminNotificationNumber && bridgeConnectedNumber === adminNotificationNumber);
  const deliveredAccountDirectory = buildDeliveredAccountDirectory(orders);
  const normalizedDeliveredAccountSearch = deliveredAccountSearch.trim().toLowerCase();
  const visibleDeliveredAccountDirectory = normalizedDeliveredAccountSearch
    ? deliveredAccountDirectory.filter((row) =>
        [row.email, row.password, row.profile, row.pin].some((value) => value.toLowerCase().includes(normalizedDeliveredAccountSearch))
      )
    : deliveredAccountDirectory;
  const selectAdminModule = (module: AdminModule) => {
    setAdminModule(module);
    setAdminSidebarOpen(false);
  };

  const processAccountsModule = (
    <section className="glass-panel payments-panel admin-module-panel">
      <SectionTitle eyebrow="Entrega manual" title="Procesar cuentas entregadas" compact />
      <form className="product-form parser-form" onSubmit={interpretDeliveryMessage}>
        <SectionTitle eyebrow="Ordenes Servimil" title="Selecciona una orden pendiente" compact />
        <div className="order-picker-list">
          {pendingOrders.length === 0 && <p className="empty">No hay ordenes pendientes de Servimil.</p>}
          {pendingOrders.map((order) => (
            <button
              className={parserOrderId === order.id ? "order-picker-card active" : "order-picker-card"}
              key={order.id}
              type="button"
              onClick={() => { setParserOrderId(order.id); setParserPreview(null); }}
            >
              <strong>{orderLabel(order)}</strong>
              <span>Cliente: Servimil</span>
              <span>{formatDateTime(order.created_at)} - Estado: Pendiente</span>
              <span>{order.items.map((item) => `${item.quantity}x ${item.product_name}`).join(", ")}</span>
              <em>Seleccionar orden</em>
            </button>
          ))}
        </div>
        {selectedParserOrder && (
          <div className="order-detail-box">
            <strong>{orderLabel(selectedParserOrder)} - Servimil</strong>
            <span>Fecha: {formatDateTime(selectedParserOrder.created_at)} - Estado: Pendiente</span>
            <div className="order-detail-items">
              {selectedParserOrder.items.map((item) => (
                <span key={item.id}>
                  {item.product_name}: {item.quantity} solicitada(s), {item.delivered_accounts?.length || item.delivered_quantity || 0} entregada(s), {item.pending_quantity ?? Math.max(item.quantity - (item.delivered_accounts?.length || 0), 0)} pendiente(s)
                </span>
              ))}
            </div>
          </div>
        )}
        <textarea
          className="large-textarea"
          value={parserRawText}
          onChange={(event) => { setParserRawText(event.target.value); setParserPreview(null); }}
          placeholder="Pega aqui el mensaje completo del proveedor con las cuentas entregadas..."
          disabled={!selectedParserOrder}
          required
        />
        <button className="btn-solid" disabled={!selectedParserOrder || !parserRawText.trim()}>Interpretar mensaje</button>
        <button type="button" className="btn-ghost" disabled={!selectedParserOrder} onClick={addManualPreviewItem}>Agregar cuenta manual</button>
      </form>
      {parserPreview && (
        <div className="preview-panel">
          <div className="hint">Vista previa para {selectedParserOrder ? orderLabel(selectedParserOrder) : "orden detectada"} - Confianza general: {parserPreview.confidence}%</div>
          {parserPreview.warnings.length > 0 && (
            <div className="warning-list">
              {parserPreview.warnings.map((warning) => <span key={warning}>{warning}</span>)}
            </div>
          )}
          <SectionTitle eyebrow="Vista previa editable" title="Cuentas detectadas o carga manual" compact />
          <div className="data-list">
            {previewItems.length === 0 && <p className="empty">No se detectaron cuentas. Usa "Agregar cuenta manual" para completarlas.</p>}
            {previewItems.map((item, index) => {
              const isReady = Boolean(item.matchedOrderItemId && item.matchedProductId && (item.delivered_email || item.delivered_user) && item.delivered_password);
              const selectedOrderItem = selectedParserOrder?.items.find((orderItem) => orderItem.id === item.matchedOrderItemId);
              return (
                <article className={`inline-product parser-account-card ${isReady ? "ready-product" : "needs-review-product"}`} key={`${item.serviceName}-${index}`}>
                  <div className="parser-account-head">
                    <strong>{selectedOrderItem?.product_name || item.serviceName}</strong>
                    <span>{isReady ? "Lista para entregar" : "Completa los datos"} - {item.confidence}%</span>
                    {item.incompatibleReason && <em>{item.incompatibleReason}</em>}
                  </div>
                  <label>
                    Producto del pedido
                    <select value={item.matchedOrderItemId || ""} onChange={(event) => assignPreviewItemToOrderItem(index, event.target.value)}>
                      <option value="">Selecciona producto</option>
                    {selectedParserOrder?.items.map((orderItem) => (
                      <option key={orderItem.id} value={orderItem.id}>{orderItem.quantity}x {orderItem.product_name}</option>
                    ))}
                    </select>
                  </label>
                  <div className="mini-grid">
                    <label>
                      Correo / usuario
                      <input value={item.delivered_email || item.delivered_user || ""} onChange={(event) => updatePreviewItem(index, { delivered_email: event.target.value, delivered_user: "" })} placeholder="correo@servicio.com o usuario" />
                    </label>
                    <label>
                      Contrasena
                      <input value={item.delivered_password || ""} onChange={(event) => updatePreviewItem(index, { delivered_password: event.target.value })} placeholder="Contrasena real" />
                    </label>
                  </div>
                  <div className="mini-grid">
                    <label>
                      Perfil / pantalla
                      <input value={item.profile_name || ""} onChange={(event) => updatePreviewItem(index, { profile_name: event.target.value })} placeholder="Perfil o pantalla" />
                    </label>
                    <label>
                      PIN
                      <input value={item.pin || ""} onChange={(event) => updatePreviewItem(index, { pin: event.target.value })} placeholder="PIN" />
                    </label>
                  </div>
                  <label>
                    URL IPTV o enlace
                    <input value={item.iptv_url || ""} onChange={(event) => updatePreviewItem(index, { iptv_url: event.target.value })} placeholder="URL IPTV o enlace si aplica" />
                  </label>
                  <label>
                    Notas
                    <textarea value={item.notes || ""} onChange={(event) => updatePreviewItem(index, { notes: event.target.value })} placeholder="Notas o instrucciones" />
                  </label>
                </article>
              );
            })}
          </div>
          <div className="status-actions">
            <button onClick={approvePreview} disabled={readyPreviewItems.length === 0}>Aprobar {readyPreviewItems.length} cuenta(s) y entregar al cliente</button>
            <button onClick={addManualPreviewItem} disabled={!selectedParserOrder}>Agregar otra cuenta manual</button>
            <button onClick={savePreviewAsDraft}>Guardar borrador</button>
            <button onClick={() => setParserPreview(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <main className={adminSidebarOpen ? "operator-dashboard admin-operator-dashboard sidebar-expanded" : "operator-dashboard admin-operator-dashboard sidebar-collapsed"}>
      <aside className={adminSidebarOpen ? "operator-sidebar open" : "operator-sidebar"} aria-label="Panel admin">
        <nav className="operator-side-nav admin-tabs" aria-label="Modulos admin">
          {adminModuleGroups.map((group) => (
            <div className="admin-nav-group" key={group}>
              <span>{group}</span>
              {adminModules.filter((module) => module.group === group).map((module) => (
                <button
                  className={`${adminModule === module.id ? "active" : ""} ${module.id === "process" ? "primary-module" : ""}`.trim()}
                  key={module.id}
                  onClick={() => selectAdminModule(module.id)}
                  type="button"
                >
                  {module.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="client-profile-card">
          <div className="client-avatar">AD</div>
          <div>
            <strong>Administrador</strong>
            <span>Control general</span>
          </div>
        </div>
      </aside>

      <section className="operator-workspace">
        <header className="client-topbar admin-topbar">
          <button className="client-menu-button" onClick={() => setAdminSidebarOpen((open) => !open)} aria-label={adminSidebarOpen ? "Retraer menu admin" : "Expandir menu admin"} aria-expanded={adminSidebarOpen}><span /></button>
          <label className="client-search admin-module-jump">
            <span>Modulo</span>
            <select value={adminModule} onChange={(event) => selectAdminModule(event.target.value as AdminModule)}>
              {adminModules.map((module) => <option key={module.id} value={module.id}>{module.label}</option>)}
            </select>
            <kbd>10s</kbd>
          </label>
          <div className="client-top-status">
            <span className="client-online-dot">Actualizando dashboard</span>
            <div className="client-avatar compact">AD</div>
          </div>
        </header>

        <div className="client-hero-row">
          <div>
            <span className="eyebrow">Dashboard admin</span>
            <h1>Movimientos, ventas y actividad.</h1>
            <p>Controla pedidos, productos, pagos manuales, notificaciones y auditoria desde un solo panel.</p>
          </div>
          <span className="client-refresh-note">Actualizacion automatica cada 10 segundos</span>
        </div>
      {adminModule === "dashboard" && (
        <div className="admin-module-stack">
          <div className="client-kpi-grid admin-kpi-grid">
            <ClientMetricCard tone="green" label="Total vendido" value={money.format(dashboard?.totalSold || 0)} caption="Venta cliente" />
            <ClientMetricCard tone="blue" label="Total proveedor" value={money.format(dashboard?.totalProviderPaid || 0)} caption="Costo proveedor" />
            <ClientMetricCard tone="green" label="Utilidad" value={money.format(dashboard?.totalProfit || 0)} caption="Margen acumulado" />
            <ClientMetricCard tone="orange" label="Pendientes" value={dashboard?.pendingOrders || 0} caption="Pago/entrega" />
            <ClientMetricCard tone="purple" label="Entregados" value={dashboard?.deliveredOrders || 0} caption="Pedidos cerrados" />
            <ClientMetricCard tone="blue" label="Cuentas" value={dashboard?.deliveredAccounts || 0} caption="Procesadas" />
            <ClientMetricCard tone="purple" label="Avisos admin" value={unreadNotifications} caption="Sin leer" />
            <ClientMetricCard tone="orange" label="WhatsApp pendientes" value={dashboard?.notificationPending || 0} caption="Cola" />
            <ClientMetricCard tone="orange" label="WhatsApp fallidos" value={dashboard?.notificationFailed || 0} caption="Revisar" />
          </div>
          <section className="client-main-panel operator-main-panel">
            <SectionTitle eyebrow="Actividad" title="Ultimos movimientos" compact />
            <div className="data-list">
              {(dashboard?.movements || []).slice(0, 5).map((movement) => (
                <div key={movement.id}>
                  <strong>{movement.type}</strong>
                  <span>{movement.description}</span>
                  <span>Orden: {orderLabel(movement.order)} - {formatDateTime(movement.created_at)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      <div className="admin-module-content">
        {adminModule === "orders" && <OrderTable orders={orders} updateStatus={updateStatus} saveOrderEdit={saveOrderEdit} saveDeliveredAccountEdit={saveDeliveredAccountEdit} deleteOrder={deleteOrder} title="Pedidos" />}
        {adminModule === "accounts" && (
          <section className="glass-panel admin-module-panel delivered-directory-panel">
            <SectionTitle eyebrow="Cuentas" title="Cuentas entregadas" compact />
            <div className="delivered-directory-toolbar">
              <label className="search-field compact-search">
                <span>Buscar</span>
                <input
                  value={deliveredAccountSearch}
                  onChange={(event) => setDeliveredAccountSearch(event.target.value)}
                  placeholder="Buscar por correo, contrasena, perfil o PIN"
                />
              </label>
              <span>{visibleDeliveredAccountDirectory.length} de {deliveredAccountDirectory.length} cuentas</span>
            </div>
            <div className="table-scroll delivered-directory-table">
              <table>
                <thead>
                  <tr>
                    <th>Correo</th>
                    <th>Contrasena</th>
                    <th>Perfil</th>
                    <th>PIN</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDeliveredAccountDirectory.map((row) => (
                    <tr key={row.account.id}>
                      <td>{row.email}</td>
                      <td><span className="table-secret-value">{row.password}</span></td>
                      <td>{row.profile}</td>
                      <td>{row.pin}</td>
                    </tr>
                  ))}
                  {visibleDeliveredAccountDirectory.length === 0 && (
                    <tr>
                      <td colSpan={4}>No se encontraron cuentas entregadas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {adminModule === "reports" && <AdminAccountReports reports={accountReports} updateReport={updateAccountReport} />}
        {adminModule === "billing" && (
          <AdminBillingPanel
            invoices={invoices}
            servimilUser={servimilUser}
            generateServimilInvoice={generateServimilInvoice}
            saveClientInvoice={saveClientInvoice}
          />
        )}
        {adminModule === "process" && processAccountsModule}
        {adminModule === "payouts" && (
          <section className="glass-panel payments-panel admin-module-panel">
            <SectionTitle eyebrow="Pagos manuales" title="Pagos al proveedor" compact />
            <div className="data-list">
              {pendingPayouts.length === 0 && <p className="empty">No hay pagos pendientes al proveedor.</p>}
              {pendingPayouts.map((payout) => (
                <article className="inline-product" key={payout.id}>
                  <strong>{payout.order?.order_number || `#${payout.order_id.slice(0, 8)}`} - Servimil</strong>
                  <span>{payout.order?.items?.map((item) => `${item.quantity}x ${item.product_name}`).join(", ")}</span>
                  <span>Valor proveedor: {money.format(payout.amount)} - Metodo: {payout.destination_type || payout.method}</span>
                  <span>Numero destino: {payout.destination_phone || "-"}</span>
                  <div className="status-actions">
                    <button onClick={() => copy(payout.destination_phone)}>Copiar numero</button>
                    <button onClick={() => copy(String(payout.amount))}>Copiar valor</button>
                    <button onClick={() => copy(`Orden ${payout.order?.order_number || payout.order_id} - pagar ${money.format(payout.amount)} a ${payout.destination_type || payout.method}: ${payout.destination_phone}`)}>Copiar resumen</button>
                    <button onClick={() => markReceiptSent(payout)}>Marcar pago/comprobante gestionado</button>
                    <button className="danger-link" onClick={() => cancelPayout(payout)}>Cancelar pedido</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {adminModule === "products" && (
          <section className="glass-panel products-admin admin-module-panel">
            <SectionTitle eyebrow="Catalogo" title="Productos" compact />
            <form className="product-form" onSubmit={(event) => saveProduct(event)}>
              <input name="name" placeholder="Nombre" required />
              <input name="description" placeholder="Descripcion" required />
              <input name="category" placeholder="Categoria" required />
              <input name="brand_key" placeholder="Marca visual" required />
              <input name="price" type="number" placeholder="Precio venta" required />
              <input name="provider_cost" type="number" placeholder="Precio proveedor" />
              <input name="duration" placeholder="Duracion" />
              <input name="screens" placeholder="Pantallas / perfiles" />
              <input name="content_type" placeholder="Tipo de contenido" />
              <textarea name="benefits" placeholder="Beneficios, uno por linea" />
              <label><input name="active" type="checkbox" defaultChecked /> Activo</label>
              <button className="btn-solid" disabled={savingProductId === "new"}>
                {savingProductId === "new" ? "Creando..." : "Crear producto"}
              </button>
            </form>
            <div className="data-list">
              {products.map((product) => (
                <form key={`${product.id}-${product.updated_at || "current"}`} className="inline-product" onSubmit={(event) => saveProduct(event, product)}>
                  <strong>{product.name} - Utilidad: {money.format(product.price - (product.provider_cost || 0))}</strong>
                  <input name="name" defaultValue={product.name} />
                  <input name="description" defaultValue={product.description} />
                  <input name="category" defaultValue={product.category} />
                  <input name="brand_key" defaultValue={product.brand_key} />
                  <input name="price" type="number" defaultValue={product.price} />
                  <input name="provider_cost" type="number" defaultValue={product.provider_cost || 0} />
                  <input name="duration" defaultValue={product.duration || ""} />
                  <input name="screens" defaultValue={product.screens || ""} />
                  <input name="content_type" defaultValue={product.content_type || ""} />
                  <textarea name="benefits" defaultValue={(product.benefits || []).join("\n")} />
                  <label><input name="active" type="checkbox" defaultChecked={product.active} /> Activo</label>
                  <button className="btn-solid" disabled={savingProductId === product.id}>
                    {savingProductId === product.id ? "Guardando..." : "Guardar cambios"}
                  </button>
                </form>
              ))}
            </div>
          </section>
        )}
        {adminModule === "servimil" && (
          <div className="admin-module-stack">
            <section className="glass-panel">
              <SectionTitle eyebrow="Cliente principal" title="Servimil" compact />
              <div className="servimil-admin-head">
                <img src={servimilLogo} alt="Servimil" />
                <div>
                  <strong>Servimil</strong>
                  <span>Cliente principal - codigo 1111</span>
                </div>
              </div>
              <div className="dashboard-grid mini-metrics">
                <Metric label="Nombre" value={servimilUser?.name || "Servimil"} />
                <Metric label="Codigo acceso" value="1111" />
                <Metric label="Total vendido" value={money.format(servimilOrders.reduce((sum, order) => sum + (order.sale_total || order.total || 0), 0))} />
                <Metric label="Cuentas entregadas" value={servimilDeliveredAccounts.length} />
              </div>
            </section>
            <OrderTable orders={servimilOrders} title="Historial de pedidos Servimil" saveDeliveredAccountEdit={saveDeliveredAccountEdit} />
            <section className="glass-panel">
              <SectionTitle eyebrow="Liquidacion" title="Historial mensual" compact />
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Mes</th><th>Total vendido</th><th>Pagado proveedor</th><th>Utilidad</th><th>Pedidos</th><th>Estado</th></tr></thead>
                  <tbody>{(dashboard?.monthlyStatements || []).map((statement) => (
                    <tr key={`${statement.month}-${statement.client.id}`}><td>{statement.month}</td><td>{money.format(statement.totalSold)}</td><td>{money.format(statement.totalProviderPaid)}</td><td>{money.format(statement.profit)}</td><td>{statement.orders}</td><td>{statement.status}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        {adminModule === "provider" && (
          <div className="admin-module-stack">
            <section className="glass-panel provider-config-panel">
              <SectionTitle eyebrow="Configuracion privada" title="Proveedor" compact />
              <form className="product-form" onSubmit={saveProviderConfig}>
                <input name="provider_name" placeholder="Nombre del proveedor" defaultValue={providerConfig?.provider_name || ""} required />
                <input name="provider_whatsapp_number" placeholder="Telefono WhatsApp proveedor" defaultValue={providerConfig?.provider_whatsapp_number || ""} />
                <input type="hidden" name="admin_notification_phone" value={providerConfig?.admin_notification_phone || ""} />
                <input type="hidden" name="admin_notification_email" value={providerConfig?.admin_notification_email || ""} />
                <input type="hidden" name="provider_notification_method" value={providerConfig?.provider_notification_method || "bridge"} />
                <input type="hidden" name="provider_notifications_active" value="on" />
                <select name="provider_payment_method" defaultValue={providerConfig?.provider_payment_method || "nequi"}>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">DaviPlata</option>
                  <option value="bancolombia">Bancolombia</option>
                </select>
                <input name="provider_payment_phone" placeholder="Numero destino" defaultValue={providerConfig?.provider_payment_phone || ""} required />
                <input name="provider_document" placeholder="Documento del proveedor" defaultValue={providerConfig?.provider_document || ""} />
                <label><input name="provider_payment_active" type="checkbox" defaultChecked={providerConfig?.provider_payment_active ?? true} /> Proveedor activo</label>
                <button className="btn-solid">Guardar proveedor</button>
              </form>
            </section>
            <section className="glass-panel payments-panel">
              <SectionTitle eyebrow="Historial" title="Pagos al proveedor" compact />
              <div className="dashboard-grid mini-metrics">
                <Metric label="Total pagado" value={money.format(dashboard?.totalProviderPaid || 0)} />
                <Metric label="Fallidos" value={providerConfig?.failed_payouts || 0} />
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Pedido</th><th>Monto</th><th>Estado</th><th>Metodo</th><th>Destino</th><th>Referencia</th><th>Fecha</th></tr></thead>
                  <tbody>{providerPayoutHistory.map((payout) => (
                    <tr key={payout.id}><td>{payout.order?.order_number || `#${payout.order_id.slice(0, 8)}`}</td><td>{money.format(payout.amount)}</td><td>{payout.status}</td><td>{payout.method}</td><td>{payout.destination_type || "-"}</td><td>{payout.reference || payout.transaction_id || "-"}</td><td>{formatDateTime(payout.confirmed_at || payout.created_at)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        {adminModule === "whatsapp" && (
          <section className="glass-panel provider-config-panel admin-module-panel">
            <SectionTitle eyebrow="Canales automaticos" title="WhatsApp y correo del admin" compact />
            <form className="product-form compact-form" onSubmit={saveAdminNotificationConfig}>
              <input name="admin_notification_phone" placeholder="Numero WhatsApp del admin" defaultValue={providerConfig?.admin_notification_phone || ""} />
              <input name="admin_notification_email" placeholder="Correo respaldo del admin" defaultValue={providerConfig?.admin_notification_email || ""} />
              <button className="btn-solid">Guardar destinos de avisos</button>
            </form>

            <div className="notification-channel">
              <h3>WhatsApp Bridge Baileys</h3>
              <div className="dashboard-grid mini-metrics">
                <Metric label="Bridge" value={whatsappStatus?.enabled ? "Activo" : "Inactivo"} />
                <Metric label="Sesion" value={whatsappStatus?.connection || "-"} />
                <Metric label="Numero vinculado" value={whatsappStatus?.connectedNumber || "-"} />
                <Metric label="Ultima conexion" value={formatDateTime(whatsappStatus?.lastConnectedAt)} />
                <Metric label="Numero avisos" value={providerConfig?.admin_notification_phone || "-"} />
                <Metric label="Pendientes" value={whatsappStatus?.pending || 0} />
                <Metric label="Enviados" value={whatsappStatus?.sent || 0} />
                <Metric label="Fallidos" value={whatsappStatus?.failed || 0} />
                <Metric label="Respaldo correo" value={whatsappStatus?.emailFallback || 0} />
              </div>
              {adminUsesBridgeNumber && (
                <div className="warning-list">
                  <span>El numero vinculado y el numero de avisos son el mismo; WhatsApp normalmente no muestra notificacion push en chats contigo mismo.</span>
                  <span>Usa otro numero como destino o conserva el correo de respaldo activo.</span>
                </div>
              )}
              {whatsappQr ? (
                <div className="qr-panel">
                  <img src={whatsappQr} alt="QR de WhatsApp Bridge" />
                  <p className="hint">Escanea el QR desde WhatsApp, Dispositivos vinculados. La sesion se guarda cifrada en la base de datos.</p>
                </div>
              ) : (
                <p className="hint">{whatsappStatus?.qrPending ? "QR Baileys listo para escanear." : "Inicia la vinculacion para generar un QR o restaurar la sesion cifrada."}</p>
              )}
              {whatsappStatus?.lastError && <p className="error-text">{whatsappStatus.lastError}</p>}
              <div className="status-actions">
                {whatsappStatus?.connection !== "connected" && <button className="btn-solid" onClick={connectWhatsApp}>Iniciar vinculacion</button>}
                <button onClick={retryWhatsAppFailed}>Reintentar fallidos</button>
                <button onClick={disconnectWhatsApp}>Desconectar sesion</button>
                <button onClick={testAdminWhatsApp} disabled={whatsappStatus?.connection !== "connected"}>Enviar prueba WhatsApp</button>
              </div>
            </div>

            <div className="notification-channel">
              <h3>Correo de respaldo</h3>
              <form className="product-form smtp-form" onSubmit={saveEmailConfig}>
                <input name="smtp_host" placeholder="Servidor SMTP" defaultValue={emailStatus?.host || "smtp.gmail.com"} required />
                <input name="smtp_port" type="number" min="1" max="65535" placeholder="Puerto" defaultValue={emailStatus?.port || 465} required />
                <select name="smtp_secure" defaultValue={String(emailStatus?.configured ? emailStatus.secure : true)}>
                  <option value="true">Conexion segura SSL (465)</option>
                  <option value="false">STARTTLS (587)</option>
                </select>
                <input name="smtp_user" type="email" placeholder="Usuario SMTP" defaultValue={emailStatus?.user || providerConfig?.admin_notification_email || ""} />
                <input name="smtp_password" type="password" autoComplete="new-password" placeholder={emailStatus?.passwordConfigured ? "Contrasena guardada; deja vacio para conservar" : "Contrasena de aplicacion"} />
                <input name="smtp_from" placeholder="Remitente" defaultValue={emailStatus?.from || providerConfig?.admin_notification_email || ""} required />
                <button className="btn-solid">Guardar configuracion SMTP</button>
              </form>
              <div className="dashboard-grid mini-metrics email-metrics">
                <Metric label="Configuracion" value={emailStatus?.configured ? "Lista" : "Pendiente"} />
                <Metric label="Credencial" value={emailStatus?.passwordConfigured ? "Guardada" : "Falta"} />
                <Metric label="Destino" value={emailStatus?.recipient || "-"} />
                <Metric label="Ultima prueba" value={emailStatus?.lastTestStatus || "Sin probar"} />
              </div>
              {emailStatus?.lastTestAt && <p className="hint">Ultima comprobacion: {formatDateTime(emailStatus.lastTestAt)}</p>}
              {!emailStatus?.passwordConfigured && <p className="warning-text">Para Gmail debes guardar una contrasena de aplicacion de Google. La contrasena normal del correo no funciona.</p>}
              {emailStatus?.lastError && <p className="error-text">{emailStatus.lastError}</p>}
              <div className="status-actions">
                <button className="btn-solid" onClick={testAdminEmail} disabled={!emailStatus?.configured}>Enviar correo de prueba</button>
              </div>
            </div>
          </section>
        )}
        {adminModule === "movements" && (
          <section className="glass-panel admin-module-panel">
            <SectionTitle eyebrow="Auditoria" title="Movimientos" compact />
            <div className="data-list">
              {(dashboard?.movements || []).map((movement) => (
                <div key={movement.id}>
                  <strong>{movement.type}</strong>
                  <span>{movement.description}</span>
                  <span>Usuario: {movement.user?.email || "-"} - Orden: {orderLabel(movement.order)} - {formatDateTime(movement.created_at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {adminModule === "notifications" && (
          <NotificationsPanel notifications={notifications} markNotificationRead={markNotificationRead} title="Notificaciones admin" emptyMessage="No hay notificaciones administrativas." />
        )}
        {adminModule === "trash" && (
          <OrderTable orders={trashedOrders} title="Papelera de pedidos" trashMode />
        )}
        {adminModule === "logs" && (
          <section className="glass-panel admin-module-panel">
            <SectionTitle eyebrow="Sistema" title="Logs" compact />
            <div className="table-scroll">
              <table>
                <thead><tr><th>Fecha</th><th>Fuente</th><th>Tipo</th><th>Estado</th><th>Orden</th><th>Detalle</th><th>Intentos</th></tr></thead>
                <tbody>{adminLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.created_at)}</td>
                    <td>{log.source}</td>
                    <td>{log.type}</td>
                    <td>{log.status || "-"}</td>
                    <td>{log.order_label || "-"}</td>
                    <td>{log.description}{log.last_error ? ` - Error: ${log.last_error}` : ""}</td>
                    <td>{log.attempts ?? "-"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      </section>
    </main>
  );
}

function OrderTable({ orders, updateStatus, saveOrderEdit, saveDeliveredAccountEdit, deleteOrder, title = "Historial", trashMode = false }: {
  orders: Order[];
  updateStatus?: (orderId: string, status: OrderStatus) => void;
  saveOrderEdit?: (orderId: string, event: FormEvent<HTMLFormElement>) => void;
  saveDeliveredAccountEdit?: (deliveryId: string, event: FormEvent<HTMLFormElement>) => void;
  deleteOrder?: (order: Order) => void;
  title?: string;
  trashMode?: boolean;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) || null : null;

  return (
    <>
      <section className="glass-panel table-panel admin-orders-panel">
        <SectionTitle eyebrow="Pedidos" title={title} compact />
        <div className="table-scroll">
          <table className="admin-orders-table">
            <thead><tr><th>Orden</th><th>Cliente</th><th>Productos</th><th>Total venta</th><th>Total proveedor</th><th>Utilidad</th><th>Estado</th><th>Fecha pedido</th><th>Fecha entrega</th><th>{trashMode ? "Papelera" : "Detalle"}</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{orderLabel(order)}</strong></td>
                  <td>{order.user?.name || "Servimil"}</td>
                  <td>
                    <div className="order-products-cell">
                      {order.items.map((item) => <span key={item.id}>{item.quantity}x {item.product_name}</span>)}
                    </div>
                  </td>
                  <td>{money.format(order.sale_total || order.total)}</td>
                  <td>{money.format(order.provider_total || 0)}</td>
                  <td>{money.format(order.profit_total || 0)}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>{formatDateTime(order.created_at)}</td>
                  <td>{formatDateTime(order.delivered_at)}</td>
                  <td>
                    <button className="detail-trigger" onClick={() => setSelectedOrderId(order.id)} type="button">
                      {trashMode ? "Ver papelera" : "Ver detalle"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selectedOrder && (
        <AdminOrderDetailModal
          order={selectedOrder}
          updateStatus={updateStatus}
          saveOrderEdit={saveOrderEdit}
          saveDeliveredAccountEdit={saveDeliveredAccountEdit}
          deleteOrder={deleteOrder}
          trashMode={trashMode}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </>
  );
}

function AdminOrderDetailModal({ order, updateStatus, saveOrderEdit, saveDeliveredAccountEdit, deleteOrder, trashMode, onClose }: {
  order: Order;
  updateStatus?: (orderId: string, status: OrderStatus) => void;
  saveOrderEdit?: (orderId: string, event: FormEvent<HTMLFormElement>) => void;
  saveDeliveredAccountEdit?: (deliveryId: string, event: FormEvent<HTMLFormElement>) => void;
  deleteOrder?: (order: Order) => void;
  trashMode?: boolean;
  onClose: () => void;
}) {
  const deliveredAccounts = order.items.flatMap((item) => (item.delivered_accounts || []).map((account, index) => ({ item, account, index })));

  return (
    <div className="modal-backdrop detail-modal-backdrop" onClick={onClose}>
      <section className="detail-modal admin-order-modal" onClick={(event) => event.stopPropagation()}>
        <header className="admin-order-modal-head">
          <div>
            <span className="eyebrow">Detalle del pedido</span>
            <h2>{orderLabel(order)}</h2>
            <p>{order.user?.name || "Servimil"} - {formatDateTime(order.created_at)}</p>
          </div>
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </header>

        <div className="admin-order-summary-grid">
          <Metric label="Venta cliente" value={money.format(order.sale_total || order.total)} />
          <Metric label="Total proveedor" value={money.format(order.provider_total || 0)} />
          <Metric label="Utilidad" value={money.format(order.profit_total || 0)} />
          <article className="metric"><span>Estado</span><StatusBadge status={order.status} /></article>
        </div>

        <div className="admin-order-modal-grid">
          <section className="admin-order-block">
            <SectionTitle eyebrow="Productos" title="Solicitud" compact />
            <div className="order-products-list">
              {order.items.map((item) => (
                <div key={item.id}>
                  <strong>{item.quantity}x {item.product_name}</strong>
                  <span>{item.delivered_accounts?.length || 0} entregada(s) de {item.quantity}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-order-block">
            <SectionTitle eyebrow="Actividad" title="Tiempos" compact />
            <div className="timeline-cell">
              <span>Pedido creado: {formatDateTime(order.created_at)}</span>
              {order.deleted_at && <span>En papelera: {formatDateTime(order.deleted_at)} - {order.deleted_reason || "Sin motivo"}</span>}
              <span>Admin notificado: {formatDateTime(order.admin_notified_at)} ({order.admin_notification_channel || "pendiente"})</span>
              <span>Pago gestionado: {formatDateTime(order.provider_payment_marked_at)}</span>
              <span>Cuenta procesada: {formatDateTime(order.delivery_processed_at)}</span>
              <span>Cliente notificado: {formatDateTime(order.client_notified_at)}</span>
              <span>Entregado: {formatDateTime(order.delivered_at)}</span>
              <span>Proveedor: {order.provider?.name || "-"}</span>
            </div>
          </section>
        </div>

        {(updateStatus || saveOrderEdit) && !trashMode && (
          <section className="admin-order-block">
            <SectionTitle eyebrow="Pedido" title="Editar estado y valores" compact />
            {updateStatus && !saveOrderEdit && (
              <select value={order.status} onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)}>
                <option value="admin_payment_pending">Pago admin pendiente</option>
                <option value="provider_delivery_pending">Pendiente proveedor</option>
                <option value="processing">En proceso</option>
                <option value="delivered">Entregado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            )}
            {saveOrderEdit && (
              <form className="order-edit-form admin-order-edit-form" onSubmit={(event) => saveOrderEdit(order.id, event)}>
                <label><span>Estado</span><select name="status" defaultValue={order.status}>
                  <option value="admin_payment_pending">Pago admin pendiente</option>
                  <option value="provider_delivery_pending">Pendiente proveedor</option>
                  <option value="processing">En proceso</option>
                  <option value="delivered">Entregado</option>
                  <option value="cancelled">Cancelado</option>
                </select></label>
                <label><span>Total venta</span><input name="sale_total" type="number" defaultValue={order.sale_total || order.total || 0} placeholder="Total venta" /></label>
                <label><span>Total proveedor</span><input name="provider_total" type="number" defaultValue={order.provider_total || 0} placeholder="Total proveedor" /></label>
                <label><span>Utilidad</span><input name="profit_total" type="number" defaultValue={order.profit_total || 0} placeholder="Utilidad" /></label>
                <label><span>Pago proveedor</span><select name="payout_status" defaultValue={order.payout_status || "pending_admin_payment"}>
                  <option value="pending_admin_payment">Pago admin pendiente</option>
                  <option value="receipt_sent_to_provider">Comprobante gestionado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="failed">Fallido</option>
                </select></label>
                <button className="btn-solid">Guardar cambios</button>
              </form>
            )}
          </section>
        )}

        {saveDeliveredAccountEdit && deliveredAccounts.length > 0 && !trashMode && (
          <section className="admin-order-block">
            <SectionTitle eyebrow="Cuentas" title="Editar cuentas entregadas" compact />
            <div className="delivered-admin-editor">
              {deliveredAccounts.map(({ item, account, index }) => (
                <form className="delivery-edit-form" key={account.id} onSubmit={(event) => saveDeliveredAccountEdit(account.id, event)}>
                  <span>{item.product_name} #{index + 1}</span>
                  <input name="delivered_email" defaultValue={account.delivered_email || ""} placeholder="Correo / usuario" />
                  <input
                    name="delivered_password"
                    type="text"
                    defaultValue={account.delivered_password === "***" ? "" : account.delivered_password || ""}
                    placeholder={account.delivered_password === "***" ? "Reingresar contrasena real" : "Contrasena"}
                  />
                  <input name="screen_name" defaultValue={accountScreen(account.notes)} placeholder="Pantalla" />
                  <input name="profile_name" defaultValue={account.profile_name || ""} placeholder="Perfil" />
                  <input name="pin" defaultValue={account.pin || ""} placeholder="PIN" />
                  <input name="notes" defaultValue={visibleAccountNotes(account.notes)} placeholder="Notas" />
                  <button className="btn-solid">Guardar cuenta</button>
                </form>
              ))}
            </div>
          </section>
        )}

        {deleteOrder && !order.deleted_at && !trashMode && (
          <button className="danger-link admin-order-delete" onClick={() => deleteOrder(order)} type="button">Eliminar a papelera</button>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ eyebrow, title, compact = false }: { eyebrow: string; title: string; compact?: boolean }) {
  return <div className={compact ? "panel-title compact" : "panel-title"}><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong></article>;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status-badge ${status}`}>{statusLabels[status]}</span>;
}

function SimpleOrderBadge({ delivered }: { delivered: boolean }) {
  return <span className={`status-badge ${delivered ? "delivered" : "pending"}`}>{delivered ? "Entregado" : "Pendiente"}</span>;
}

function StatusRole({ role }: { role: Role }) {
  return <span className="role-badge">{role}</span>;
}

export default App;
