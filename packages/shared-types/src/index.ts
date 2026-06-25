// User & Auth
export type UserRole =
  | 'reader'
  | 'author'
  | 'publisher'
  | 'publisher_staff'
  | 'admin_content'
  | 'admin_finance'
  | 'super_admin';

export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
  roles: UserRole[];
  status: UserStatus;
  createdAt: string;
}

// Catalog
export type BookFormat = 'epub' | 'pdf' | 'both';
export type BookStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived';

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  isbn: string | null;
  authorName: string;
  coverImageUrl: string | null;
  format: BookFormat;
  previewPageCount: number;
  status: BookStatus;
  publisherId: string;
  publisherName: string;
  featured: boolean;
  publishedAt: string | null;
}

export interface BookPrice {
  purchasePrice: number;
  rentals: RentalPriceOption[];
  /** @deprecated Use rentals — kept for backward compatibility */
  rental15Price: number;
  /** @deprecated Use rentals — kept for backward compatibility */
  rental30Price: number;
  currency: string;
}

export interface RentalPriceOption {
  days: number;
  price: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface Language {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
}

export interface BookListItem extends Book {
  prices: BookPrice | null;
  categories: Pick<Category, 'id' | 'name' | 'slug'>[];
  languages: Pick<Language, 'id' | 'code' | 'name'>[];
}

export interface BookDetail extends Book {
  description: string | null;
  prices: BookPrice | null;
  categories: Pick<Category, 'id' | 'name' | 'slug'>[];
  languages: Pick<Language, 'id' | 'code' | 'name' | 'nativeName' | 'rtl'>[];
}

// Commerce
export type OrderItemType = 'purchase' | 'rental' | 'rental_15' | 'rental_30';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type EntitlementType = 'purchase' | 'rental';
export type EntitlementStatus = 'active' | 'expired' | 'revoked';

export interface OrderItem {
  bookId: string;
  type: OrderItemType;
  unitPrice: number;
  commissionRate: number;
  platformCommission: number;
  publisherAmount: number;
}

export interface Entitlement {
  id: string;
  bookId: string;
  type: EntitlementType;
  status: EntitlementStatus;
  startsAt: string;
  expiresAt: string | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  items: Array<{
    bookId: string;
    bookSlug: string;
    bookTitle: string;
    bookCoverImageUrl: string | null;
    type: OrderItemType;
    listUnitPrice: number;
    unitPrice: number;
    memberDiscountAmount: number;
  }>;
  payment: {
    status: PaymentStatus;
    razorpayOrderId: string | null;
  } | null;
  createdAt: string;
}

export type PaymentStatus = 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';

export interface CheckoutSession {
  order: OrderSummary;
  razorpayKeyId: string | null;
  mockCheckout: boolean;
}

export interface OrderListResponse {
  data: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LibraryItem {
  entitlement: Entitlement;
  book: {
    id: string;
    title: string;
    slug: string;
    authorName: string;
    coverImageUrl: string | null;
    status: BookStatus;
  };
  /** True when the publisher edited a live book and admin re-approval is pending. */
  underReview: boolean;
  /** Price locked at purchase/rental time — not affected by later publisher price changes. */
  pricePaid: {
    amount: number;
    listAmount: number;
    currency: string;
  };
  progressPercent: number | null;
  lastReadAt: string | null;
}

export interface WishlistItem {
  bookId: string;
  addedAt: string;
  book: {
    id: string;
    title: string;
    slug: string;
    authorName: string;
    coverImageUrl: string | null;
    prices: BookPrice | null;
  };
}

export interface ReadingHistoryItem {
  bookId: string;
  format: BookFileFormat;
  progressPercent: number;
  lastReadAt: string;
  book: {
    id: string;
    title: string;
    slug: string;
    authorName: string;
    coverImageUrl: string | null;
  };
}

export interface ReadingHistoryResponse {
  data: ReadingHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Platform config
export interface PlatformCommerceSettings {
  purchaseCommissionRate: number;
  rentalCommissionRate: number;
  subscriberPurchaseDiscountRate: number;
  currency: string;
  minBookPrice: number;
  maxBookPrice: number;
  minRentalPrice: number;
  maxRentalPrice: number;
  rentalPeriodDays: [number, number];
}

export interface PublicCommerceConfig {
  rentalPeriodDays: [number, number];
  currency: string;
}

export interface PlatformCommissionConfig {
  defaultCommissionRate: number;
  minBookPrice: number;
  maxBookPrice: number;
  currency: string;
}

export interface BookPricingQuote {
  bookId: string;
  bookSlug: string;
  type: OrderItemType;
  rentalDays: number | null;
  currency: string;
  listPrice: number;
  chargedPrice: number;
  memberDiscountPercent: number;
  memberDiscountAmount: number;
  adFree: boolean;
  commissionRate: number;
}

export type SettlementStatus = 'pending' | 'processing' | 'paid';

export interface PublisherEarnings {
  unsettledSales: number;
  unsettledEarnings: number;
  unsettledOrderCount: number;
  pendingPayout: number;
  totalPaid: number;
  currency: string;
}

export interface Settlement {
  id: string;
  publisherId: string;
  publisherName: string | null;
  publisherSlug: string | null;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  platformCommission: number;
  netAmount: number;
  status: SettlementStatus;
  paidAt: string | null;
  createdAt: string;
}
export type SubscriptionInterval = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: SubscriptionInterval;
  active: boolean;
}

export interface UserSubscription {
  id: string;
  planId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  adFree: boolean;
  createdAt: string;
}

export interface SubscriptionStatusResponse {
  adFree: boolean;
  subscription: UserSubscription | null;
}

export interface SubscriptionCheckoutSession {
  plan: SubscriptionPlan;
  razorpayKeyId: string | null;
  razorpayOrderId: string | null;
  mockCheckout: boolean;
  subscription: UserSubscription | null;
}

export interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthLoginResponse {
  user: User;
  tokens: AuthTokensResponse;
}

// API
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Publisher & uploads
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type BookFileFormat = 'epub' | 'pdf';
export type PublisherType = 'publisher' | 'author';
export type PublisherStatus = 'pending' | 'approved' | 'suspended';

export interface PublisherProfile {
  id: string;
  name: string;
  slug: string;
  type: PublisherType;
  status: PublisherStatus;
  description: string | null;
  addressLine: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  createdAt: string;
}

export interface BookFileRecord {
  id: string;
  format: BookFileFormat;
  processingStatus: ProcessingStatus;
  fileSizeBytes: number | null;
  createdAt: string;
}

export interface PublisherBook extends Book {
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  prices: BookPrice | null;
  files: BookFileRecord[];
  categories: Pick<Category, 'id' | 'name' | 'slug'>[];
  languages: Pick<Language, 'id' | 'code' | 'name'>[];
}

export interface AdminBookPublisher {
  id: string;
  name: string;
  slug: string;
  type: PublisherType;
  status: PublisherStatus;
}

export interface AdminBookPublisherUser {
  id: string;
  email: string | null;
  displayName: string;
}

export interface AdminBook {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  isbn: string | null;
  authorName: string;
  coverImageUrl: string | null;
  format: BookFormat;
  previewPageCount: number;
  previewChapterCount: number;
  status: BookStatus;
  rejectionReason: string | null;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  prices: BookPrice | null;
  files: BookFileRecord[];
  categories: Pick<Category, 'id' | 'name' | 'slug'>[];
  languages: Pick<Language, 'id' | 'code' | 'name'>[];
  publisher: AdminBookPublisher;
  publisherUser: AdminBookPublisherUser;
}

// Reading
export type ReadingMode = 'none' | 'preview' | 'full';

export interface ReadingAccess {
  bookId: string;
  slug: string;
  title: string;
  bookFormat: BookFormat;
  mode: ReadingMode;
  formats: BookFileFormat[];
  previewPageCount: number;
  previewChapterCount: number;
  hasEntitlement: boolean;
  underReview?: boolean;
  grandfatheredAccess?: boolean;
}

export interface ReadingProgressRecord {
  id: string;
  bookId: string;
  format: BookFileFormat;
  position: Record<string, unknown>;
  progressPercent: number;
  lastReadAt: string;
}
