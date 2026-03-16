// User Types
export type UserRole =
  | 'CUSTOMER'
  | 'FABRIC_SELLER'
  | 'FASHION_DESIGNER'
  | 'RESELLER_INFLUENCER'
  | 'QA_TEAM'
  | 'ADMINISTRATOR';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  requirePasswordChange?: boolean;
  createdAt: string;
  bio?: string;
  permissions?: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Product Types
export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface MaterialType {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export interface FabricImage {
  id: string;
  url: string;
  alt?: string;
  sortOrder: number;
}

export interface Fabric {
  id: string;
  name: string;
  description: string;
  materialType: MaterialType;
  sellerPrice: number;
  finalPrice: number;
  minYards: number;
  stockYards: number;
  images: FabricImage[];
  seller: {
    businessName: string;
    country: string;
    city: string;
  };
  isAvailable: boolean;
}

export interface DesignMeasurementVariable {
  id: string;
  name: string;
  unit: string;
  isRequired: boolean;
  instructions?: string;
}

export interface DesignImage {
  id: string;
  url: string;
  alt?: string;
  sortOrder: number;
}

export interface SuitableFabric {
  fabricId: string;
  yardsNeeded: number;
  fabric: Fabric;
}

export interface Design {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  basePrice: number;
  finalPrice: number;
  images: DesignImage[];
  suitableFabrics: SuitableFabric[];
  measurementVariables: DesignMeasurementVariable[];
  designer: {
    businessName: string;
    country: string;
    city: string;
    rating: number;
  };
  isAvailable: boolean;
}

export interface ReadyToWearSize {
  id: string;
  size: string;
  price: number;
  stock: number;
}

export interface ReadyToWear {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  basePrice: number;
  images: DesignImage[];
  sizeVariations: ReadyToWearSize[];
  designer: {
    businessName: string;
    country: string;
    city: string;
    rating: number;
  };
  isAvailable: boolean;
}

// Order Types
export type OrderType = 'CUSTOM_DESIGN' | 'READY_TO_WEAR' | 'FABRIC_ONLY';
export type OrderStatus = 
  | 'PENDING_PAYMENT'
  | 'PAYMENT_CONFIRMED'
  | 'FABRIC_PENDING'
  | 'FABRIC_CONFIRMED'
  | 'FABRIC_SHIPPED'
  | 'FABRIC_RECEIVED'
  | 'IN_PRODUCTION'
  | 'PRODUCTION_COMPLETE'
  | 'QA_PENDING'
  | 'QA_INSPECTING'
  | 'QA_APPROVED'
  | 'QA_REJECTED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'CANCELLED';

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  postalCode?: string;
  isDefault: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  trackingNumber?: string;
  createdAt: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  designOrder?: {
    design: Design;
    price: number;
    status: string;
  };
  fabricOrder?: {
    fabric: Fabric;
    yards: number;
    totalPrice: number;
    status: string;
  };
  readyToWearItems?: {
    readyToWear: ReadyToWear;
    size: string;
    price: number;
    quantity: number;
  }[];
}

// Cart Types
export interface CartItem {
  id: string;
  type: 'DESIGN' | 'FABRIC' | 'READY_TO_WEAR';
  designId?: string;
  fabricId?: string;
  readyToWearId?: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  size?: string;
  yards?: number;
  measurements?: Record<string, number>;
}

// Virtual Try-On Types
export interface BodyMeasurements {
  height?: number;
  weight?: number;
  bust?: number;
  waist?: number;
  hip?: number;
  shoulderWidth?: number;
  armLength?: number;
  inseam?: number;
  [key: string]: number | undefined;
}

export interface AvatarData {
  measurements: BodyMeasurements;
  generatedAt: string;
  previewUrl?: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingApprovals: number;
}

export interface SellerStats {
  totalFabrics: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
}

export interface DesignerStats {
  totalDesigns: number;
  totalReadyToWear: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
}
