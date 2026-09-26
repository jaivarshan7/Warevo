export type Role =
  | "PLATFORM_ADMIN"
  | "WAREHOUSE_OWNER"
  | "WAREHOUSE_MODERATOR"
  | "ACCOUNTS_TEAM"
  | "WAREHOUSE_STAFF"
  | "ACCOUNTANT"
  | "CLIENT"
  | "CLIENT_ACCOUNTANT";

export const ALLOWED_EMPLOYEE_ROLES: Role[] = [
  "WAREHOUSE_STAFF",
  "ACCOUNTS_TEAM",
  "ACCOUNTANT",
  "WAREHOUSE_MODERATOR",
];

export type EmployeeRole = (typeof ALLOWED_EMPLOYEE_ROLES)[number];

export type ClientEmployeeRole =
  | "RECEIVER"
  | "STORE"
  | "ACCOUNT"
  | "MANAGER"
  | "GM"
  | "MD";

export type PermissionKey =
  | "ORDERS_VIEW"
  | "ORDERS_PROCESS"
  | "ORDERS_DISPATCH"
  | "DELIVERY_VERIFY"
  | "INVENTORY_VERIFY"
  | "INVOICES_VIEW"
  | "INVOICES_MANAGE"
  | "ACCOUNTS_VIEW"
  | "PAYMENTS_VIEW"
  | "PAYMENTS_RECORD"
  | "PAYMENT_PROOF_UPLOAD"
  | "REPORTS_VIEW";

export type PermissionCategory =
  | "Orders"
  | "Delivery"
  | "Inventory"
  | "Invoices"
  | "Accounts"
  | "Payments"
  | "Reports";

export interface PermissionItem {
  id: string;
  key: PermissionKey;
  name: string;
  description?: string | null;
  category: PermissionCategory;
}

export interface AdminRoleItem {
  id: string;
  tenantId?: string | null;
  name: string;
  description?: string | null;
  systemRole: boolean;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  permissions: PermissionItem[];
}

export type TenantStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type ClientStatus = "ACTIVE" | "INACTIVE";
export type ProductStatus = "ACTIVE" | "INACTIVE";

export type OrderStatus =
  | "DRAFT"
  | "ISSUED"
  | "PROCESSING"
  | "READY_FOR_DISPATCH"
  | "DISPATCHED"
  | "RECEIVED"
  | "VERIFICATION_PENDING"
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "REJECTED"
  | "INVOICE_PENDING"
  | "INVOICED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "COMPLETED"
  | "CANCELLED";

export type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "REJECTED";

export type InvoiceStatus = "DRAFT" | "FINAL" | "SENT" | "CANCELLED";

export type PaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type InventoryMovementType =
  | "PURCHASE"
  | "RECEIPT"
  | "ORDER_RESERVATION"
  | "ORDER_ISSUE"
  | "SALE"
  | "RETURN"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export type NotificationType =
  | "NEW_ORDER"
  | "ORDER_ISSUED"
  | "PROCESSING_STARTED"
  | "READY_FOR_DISPATCH"
  | "ORDER_DISPATCHED"
  | "CLIENT_RECEIVED_ORDER"
  | "CLIENT_STARTED_VERIFICATION"
  | "CLIENT_COMPLETED_VERIFICATION"
  | "CLIENT_REJECTED_ORDER"
  | "DAMAGE_REPORTED"
  | "MISSING_ITEMS_REPORTED"
  | "VERIFICATION_COMPLETED"
  | "INVOICE_GENERATED"
  | "INVOICE_SENT"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "ORDER_COMPLETED";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  gstNumber?: string | null;
  logoUrl?: string | null;
  status: TenantStatus;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  tenantId?: string | null;
  supabaseUserId?: string | null;
  role: Role;
  name: string;
  email?: string | null;
  mobile?: string | null;
  avatarUrl?: string | null;
  status: UserStatus;
  createdAt: string;
  tenant?: Tenant | null;
  client?: Client | null;
  clientId?: string | null;
  clientEmployee?: ClientEmployee | null;
  permissions?: string[];
}

export interface ClientEmployee {
  id: string;
  tenantId: string;
  clientId: string;
  userId?: string | null;
  employeeRole: ClientEmployeeRole;
  contactPerson: string;
  mobile: string;
  email?: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
  roleId?: string | null;
  role?: AdminRoleItem | null;
  roleDefinition?: any;
  client?: Client | null;
  user?: User | null;
}

export interface Client {
  id: string;
  tenantId: string;
  companyGroupId?: string | null;
  companyName: string;
  gstNumber?: string | null;
  billingAddress: string;
  shippingAddress: string;
  status: ClientStatus;
  createdAt: string;
  updatedAt?: string;
  employees?: ClientEmployee[];
  // Optional backward-compat during transition
  contactPerson?: string;
  mobile?: string;
  email?: string | null;
  employeeRole?: ClientEmployeeRole | null;
  userId?: string | null;
  user?: User | null;
}

export interface CompanyGroup {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  clients?: Client[];
}

export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address: string;
  status: TenantStatus;
  createdAt: string;
  locations?: WarehouseLocation[];
}

export interface WarehouseLocation {
  id: string;
  tenantId: string;
  warehouseId: string;
  zone: string;
  rack?: string | null;
  shelf?: string | null;
  bin?: string | null;
  active: boolean;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

export interface Product {
  id: string;
  tenantId: string;
  categoryId?: string | null;
  sku: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  gstRate: number;
  barcode?: string | null;
  minimumStock: number;
  reorderLevel: number;
  status: ProductStatus;
  imageUrl?: string | null;
  createdAt: string;
  category?: Category | null;
  inventory?: Inventory[];
}

export interface Inventory {
  id: string;
  tenantId: string;
  warehouseId: string;
  locationId?: string | null;
  productId: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  updatedAt: string;
  warehouse?: Warehouse | null;
  location?: WarehouseLocation | null;
  product?: Product | null;
}

export interface InventoryMovement {
  id: string;
  tenantId: string;
  inventoryId: string;
  productId: string;
  orderId?: string | null;
  type: InventoryMovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  product?: Product | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
  product?: Product | null;
}

export interface OrderStatusHistory {
  id: string;
  tenantId: string;
  orderId: string;
  previousStatus?: OrderStatus | null;
  newStatus: OrderStatus;
  changedById?: string | null;
  notes?: string | null;
  createdAt: string;
  changedBy?: User | null;
}

export interface VerificationResponse {
  id: string;
  tenantId: string;
  orderId: string;
  clientId: string;
  userId?: string | null;
  status: VerificationStatus;
  responses: Array<{ text: string; checked: boolean }>;
  comments?: string | null;
  attachments?: unknown;
  createdAt: string;
}

export interface Order {
  id: string;
  tenantId: string;
  clientId: string;
  orderNumber: string;
  orderDate: string;
  expectedDelivery?: string | null;
  status: OrderStatus;
  verificationStatus: VerificationStatus;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  totalAmount: number;
  notes?: string | null;
  createdById: string;
  assignedStaffId?: string | null;
  createdAt: string;
  updatedAt: string;
  deliveryVerifiedAt?: string | null;
  deliveryVerifiedById?: string | null;
  storeVerifiedAt?: string | null;
  storeVerifiedById?: string | null;
  deliveryVerifiedBy?: User | null;
  storeVerifiedBy?: User | null;
  client?: Client | null;
  createdBy?: User | null;
  assignedStaff?: User | null;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  verification?: VerificationResponse | null;
  invoices?: Invoice[] | null;
}

export interface OrderTimelineEvent {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  actorEmployeeRole?: string | null;
  notes?: string | null;
  source?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  quantity: number;
  rate: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  product?: Product | null;
}

export interface Payment {
  id: string;
  tenantId: string;
  invoiceId: string;
  amount: number;
  status: PaymentStatus;
  method: string;
  reference?: string | null;
  proofUrl?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  orderId: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  discountTotal: number;
  total: number;
  pdfUrl?: string | null;
  finalizedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: Order | null;
  client?: Client | null;
  tenant?: Tenant | null;
  items?: InvoiceItem[];
  payments?: Payment[];
}

// Notification event configuration
export interface NotificationEventConfig {
  inApp: boolean;
  clientEmail: boolean;
}

// Notification settings for a tenant
export interface NotificationSettings {
  id: string;
  tenantId: string;
  enabled: boolean;
  eventConfig: {
    [key in NotificationType]?: NotificationEventConfig;
  };
  createdAt: string;
  updatedAt?: string;
  tenant?: Tenant | null;
}

export interface TenantSettings {
  id: string;
  tenantId: string;
  invoicePrefix?: string | null;
  nextInvoiceNumber?: number | null;
  notificationSettings?: NotificationSettings | null;
  createdAt: string;
  updatedAt?: string;
  tenant?: Tenant | null;
}

export interface Notification {
  id: string;
  tenantId: string;
  userId?: string | null;
  orderId?: string | null;
  warehouseId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  priority: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  tenantId?: string | null;
  userId?: string | null;
  userRole: Role;
  action: string;
  entity: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: User | null;
}

export type EmailLogStatus = "PENDING" | "SENT" | "SKIPPED" | "FAILED";

export interface EmailLog {
  id: string;
  tenantId: string;
  notificationId?: string | null;
  orderId?: string | null;
  recipientEmail: string;
  recipientUserId?: string | null;
  eventType: NotificationType;
  subject: string;
  status: EmailLogStatus;
  resendId?: string | null;
  idempotencyKey?: string | null;
  reason?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
