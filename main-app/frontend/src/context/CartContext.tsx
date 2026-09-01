import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

export interface Product {
  product_id: number;
  product_name: string;
  price: number;
  stock_quantity: number;
  barcode: string;
  category_id?: number;
  category_name?: string;
}

export interface CartItem extends Product {
  quantity: number;
  variant_id?: number;
  variant_name?: string;
  available_stock?: number;
}

export interface AppliedBundle {
  bundle_id: number;
  bundle_name: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  savings: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, variant?: { variant_id: number; variant_name: string; price: number; available_stock: number }) => void;
  removeFromCart: (productId: number, variantId?: number) => void;
  updateQuantity: (productId: number, quantity: number, variantId?: number) => void;
  clearCart: () => void;
  subtotal: number;
  taxRate: number;
  setTaxRate: (rate: number) => void;
  additionalRate: number;
  setAdditionalRate: (rate: number) => void;
  taxAmount: number;
  additionalAmount: number;
  appliedBundles: AppliedBundle[];
  setAppliedBundles: (bundles: AppliedBundle[]) => void;
  bundleDiscount: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [taxRate, setTaxRate] = useState(16); // Default 16%
  const [additionalRate, setAdditionalRate] = useState(5); // Default 5%
  const [appliedBundles, setAppliedBundles] = useState<AppliedBundle[]>([]);

  const addToCart = useCallback((product: Product, variant?: { variant_id: number; variant_name: string; price: number; available_stock: number }) => {
    setCart(prev => {
      // Create unique cart key: product_id + variant_id (if exists)
      const cartKey = variant ? `${product.product_id}-${variant.variant_id}` : `${product.product_id}`;

      const existing = prev.find(item => {
        const itemKey = item.variant_id ? `${item.product_id}-${item.variant_id}` : `${item.product_id}`;
        return itemKey === cartKey;
      });

      const maxStock = variant ? variant.available_stock : product.stock_quantity;
      const itemPrice = variant ? variant.price : product.price;

      if (existing) {
        if (existing.quantity >= maxStock) {
          toast.error(`Cannot add more. Only ${maxStock} in stock.`);
          return prev;
        }
        return prev.map(item => {
          const itemKey = item.variant_id ? `${item.product_id}-${item.variant_id}` : `${item.product_id}`;
          return itemKey === cartKey
            ? { ...item, quantity: item.quantity + 1 }
            : item;
        });
      }

      if (maxStock <= 0) {
        toast.error('Product is out of stock!');
        return prev;
      }

      // Add new item to cart
      const newItem: CartItem = {
        ...product,
        price: itemPrice,
        quantity: 1,
        ...(variant && {
          variant_id: variant.variant_id,
          variant_name: variant.variant_name,
          available_stock: variant.available_stock,
        }),
      };

      return [...prev, newItem];
    });
  }, []);

  const removeFromCart = useCallback((productId: number, variantId?: number) => {
    setCart(prev => prev.filter(item => {
      if (variantId) {
        // Remove specific variant
        return !(item.product_id === productId && item.variant_id === variantId);
      }
      // Remove product (only if no variant_id on the item)
      return !(item.product_id === productId && !item.variant_id);
    }));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number, variantId?: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        const isMatch = variantId
          ? item.product_id === productId && item.variant_id === variantId
          : item.product_id === productId && !item.variant_id;
        return isMatch ? { ...item, quantity } : item;
      })
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const taxAmount = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate]);
  const additionalAmount = useMemo(() => subtotal * (additionalRate / 100), [subtotal, additionalRate]);
  const bundleDiscount = useMemo(() => appliedBundles.reduce((sum, bundle) => sum + bundle.discount_amount, 0), [appliedBundles]);
  const total = useMemo(() => subtotal + taxAmount + additionalAmount - bundleDiscount, [subtotal, taxAmount, additionalAmount, bundleDiscount]);

  const value = useMemo(() => ({
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    taxRate,
    setTaxRate,
    additionalRate,
    setAdditionalRate,
    taxAmount,
    additionalAmount,
    appliedBundles,
    setAppliedBundles,
    bundleDiscount,
    total
  }), [cart, addToCart, removeFromCart, updateQuantity, clearCart, subtotal, taxRate, additionalRate, taxAmount, additionalAmount, appliedBundles, bundleDiscount, total]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
