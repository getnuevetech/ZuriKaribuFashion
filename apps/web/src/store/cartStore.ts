import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomDesignCartItem {
  kind: 'CUSTOM_DESIGN';
  designId: string;
  designName: string;
  designImage: string;
  fabricId: string;
  fabricName: string;
  fabricImage: string;
  fabricMeters: number;
  fabricPrice: number;
  designerId: string;
  designerName: string;
  measurements: Record<string, number>;
  basePrice: number;
  totalPrice: number;
  tryOnImage?: string | null;
}

export interface ReadyToWearCartItem {
  kind: 'READY_TO_WEAR';
  readyToWearId: string;
  productName: string;
  productImage: string;
  selectedSize: string;
  selectedColor?: string;
  quantity: number;
  unitPrice: number;
  designerName: string;
  categoryName?: string;
  tryOnMeasurements?: Record<string, number>;
}

export type CartItem = CustomDesignCartItem | ReadyToWearCartItem;

type LegacyCustomItem = Omit<CustomDesignCartItem, 'kind'>;

function normalizeCartItem(item: CartItem | LegacyCustomItem | any): CartItem {
  if (item?.kind === 'READY_TO_WEAR') {
    return {
      kind: 'READY_TO_WEAR',
      readyToWearId: String(item.readyToWearId || ''),
      productName: String(item.productName || ''),
      productImage: String(item.productImage || ''),
      selectedSize: String(item.selectedSize || ''),
      selectedColor: item.selectedColor ? String(item.selectedColor) : undefined,
      quantity: Math.max(1, Number(item.quantity || 1)),
      unitPrice: Number(item.unitPrice || 0),
      designerName: String(item.designerName || 'Designer'),
      categoryName: item.categoryName ? String(item.categoryName) : undefined,
      tryOnMeasurements: item.tryOnMeasurements || {},
    };
  }
  return {
    kind: 'CUSTOM_DESIGN',
    designId: String(item.designId || ''),
    designName: String(item.designName || ''),
    designImage: String(item.designImage || ''),
    fabricId: String(item.fabricId || ''),
    fabricName: String(item.fabricName || ''),
    fabricImage: String(item.fabricImage || ''),
    fabricMeters: Math.max(1, Number(item.fabricMeters || 1)),
    fabricPrice: Number(item.fabricPrice || 0),
    designerId: String(item.designerId || ''),
    designerName: String(item.designerName || 'Designer'),
    measurements: item.measurements || {},
    basePrice: Number(item.basePrice || 0),
    totalPrice: Number(item.totalPrice || 0),
    tryOnImage: item.tryOnImage ?? null,
  };
}

function getItemTotal(item: CartItem): number {
  if (item.kind === 'READY_TO_WEAR') {
    return Number(item.unitPrice || 0) * Math.max(1, Number(item.quantity || 1));
  }
  const meters = Math.max(1, Number(item.fabricMeters || 1));
  const computed = Number(item.basePrice || 0) + Number(item.fabricPrice || 0) * meters;
  return Number.isFinite(computed) && computed > 0 ? computed : Number(item.totalPrice || 0);
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem | LegacyCustomItem) => void;
  addReadyToWearItem: (item: Omit<ReadyToWearCartItem, 'kind'>) => void;
  removeItem: (index: number) => void;
  updateItem: (index: number, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  totalPrice: number;
  itemCount: number;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item) => {
        const normalized = normalizeCartItem(item);
        set((state) => ({
          items: [...state.items, normalized],
        }));
      },

      addReadyToWearItem: (item) => {
        const normalized = normalizeCartItem({ ...item, kind: 'READY_TO_WEAR' as const });
        set((state) => {
          const existingIndex = state.items.findIndex(
            (cartItem) =>
              cartItem.kind === 'READY_TO_WEAR' &&
              cartItem.readyToWearId === normalized.readyToWearId &&
              cartItem.selectedSize === normalized.selectedSize &&
              (cartItem.selectedColor || '') === (normalized.selectedColor || '')
          );
          if (existingIndex === -1) {
            return { items: [...state.items, normalized] };
          }
          const existing = state.items[existingIndex] as ReadyToWearCartItem;
          const merged: ReadyToWearCartItem = {
            ...existing,
            quantity: existing.quantity + normalized.quantity,
            unitPrice: normalized.unitPrice || existing.unitPrice,
            tryOnMeasurements: normalized.tryOnMeasurements || existing.tryOnMeasurements,
          };
          return {
            items: state.items.map((cartItem, index) => (index === existingIndex ? merged : cartItem)),
          };
        });
      },
      
      removeItem: (index) => {
        set((state) => ({
          items: state.items.filter((_, i) => i !== index),
        }));
      },
      
      updateItem: (index, updates) => {
        set((state) => ({
          items: state.items.map((item, i) => {
            if (i === index) {
              if (item.kind === 'READY_TO_WEAR') {
                const merged = {
                  ...item,
                  ...updates,
                  quantity: Math.max(1, Number((updates as Partial<ReadyToWearCartItem>).quantity ?? item.quantity)),
                } as ReadyToWearCartItem;
                return merged;
              }
              const merged = { ...item, ...updates } as CustomDesignCartItem;
              if (typeof merged.fabricMeters === 'number') {
                merged.fabricMeters = Math.max(1, Number(merged.fabricMeters));
              }
              merged.totalPrice = getItemTotal(merged);
              return merged;
            }
            return item;
          }),
        }));
      },
      
      clearCart: () => {
        set({ items: [] });
      },
      
      get totalPrice() {
        return get().items.reduce((sum, item) => sum + getItemTotal(item), 0);
      },
      
      get itemCount() {
        return get().items.reduce((count, item) => {
          if (item.kind === 'READY_TO_WEAR') {
            return count + Math.max(1, Number(item.quantity || 1));
          }
          return count + 1;
        }, 0);
      },
      
      getItemCount: () =>
        get().items.reduce((count, item) => {
          if (item.kind === 'READY_TO_WEAR') {
            return count + Math.max(1, Number(item.quantity || 1));
          }
          return count + 1;
        }, 0),
    }),
    {
      name: 'cart-storage',
      version: 2,
      migrate: (persistedState: any) => {
        if (!persistedState || !Array.isArray(persistedState.items)) {
          return persistedState;
        }
        return {
          ...persistedState,
          items: persistedState.items.map((item: any) => normalizeCartItem(item)),
        };
      },
    }
  )
);
