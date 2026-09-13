export type Role =
  | "PLATFORM_ADMIN"
  | "MANAGER"
  | "GM"
  | "WAREHOUSE_OWNER"
  | "WAREHOUSE_MODERATOR"
  | "ACCOUNTS_TEAM"
  | "WAREHOUSE_STAFF"
  | "PRODUCT_RECEIVER"
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
}

export interface Client {
  id: string;
  tenantId: string;
  userId?: string | null;
  companyGroupId?: string | null;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email?: string | null;
  gstNumber?: string | null;
  billingAddress: string;
  shippingAddress: string;
  employeeRole?: ClientEmployeeRole | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt?: string;
  user?: User | null;
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
  client?: Client | null;
  createdBy?: User | null;
  assignedStaff?: User | null;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  verification?: VerificationResponse | null;
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
