import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  // Optional variant label (e.g. "B22 / Warm White"). Two cart lines for the
  // same product but different variants are kept separate via lineKey().
  variant?: string | undefined;
  name: { en: string; ne: string };
  price: number;
  unit: string;
  image?: string | undefined;
  quantity: number;
  stock: number;
}

// Unique key for a cart line: product + variant. Different variants of the
// same product are distinct lines; the real productId is preserved for checkout.
export function cartLineKey(item: { productId: string; variant?: string | undefined }): string {
  return item.variant ? `${item.productId}::${item.variant}` : item.productId;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  removeItem: (lineKey: string) => void;
  clearCart: () => void;
  totalItems: () => number;
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) => {
        set((state) => {
          const key = cartLineKey(item);
          const existing = state.items.find((i) => cartLineKey(i) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                cartLineKey(i) === key
                  ? { ...i, quantity: Math.min(i.quantity + quantity, i.stock) }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: Math.min(quantity, item.stock) }] };
        });
      },

      updateQuantity: (lineKey, quantity) => {
        set((state) => ({
          items: state.items.map((i) =>
            cartLineKey(i) === lineKey
              ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) }
              : i,
          ),
        }));
      },

      removeItem: (lineKey) => {
        set((state) => ({ items: state.items.filter((i) => cartLineKey(i) !== lineKey) }));
      },

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: 'mkelectric_cart',
    },
  ),
);
