import React from 'react';
import { Product } from '../context/CartContext';
import { Plus, Eye } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void; // undefined = view-only mode
}

const ProductCard: React.FC<ProductCardProps> = React.memo(({ product, onAddToCart }) => {
  const viewOnly = !onAddToCart;

  return (
    <div
      className={`bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full transition-all ${
        viewOnly
          ? 'opacity-80 cursor-default'
          : 'hover:shadow-md hover:border-emerald-200 cursor-pointer'
      }`}
      onClick={() => !viewOnly && onAddToCart!(product)}
    >
      <div>
        {/* Icon area */}
        <div className="relative h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg mb-2.5 flex items-center justify-center border border-emerald-100">
          <span className="text-2xl font-black text-emerald-600">{product.product_name.charAt(0)}</span>
          {/* @ts-ignore - has_variants exists on product after backend query */}
          {product.has_variants && (
            <span className="absolute top-1 left-1 bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              Var
            </span>
          )}
          {product.stock_quantity === 0 && (
            <div className="absolute inset-0 bg-white/70 rounded-lg flex items-center justify-center">
              <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-200">Out of Stock</span>
            </div>
          )}
          {product.stock_quantity > 0 && product.stock_quantity <= 10 && (
            <span className="absolute top-1 right-1 bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              Low
            </span>
          )}
          {viewOnly && (
            <div className="absolute bottom-1 right-1 bg-gray-100 text-gray-500 rounded-full p-0.5">
              <Eye size={10} />
            </div>
          )}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-gray-800 text-xs leading-tight line-clamp-2 mb-1">{product.product_name}</h3>
        <p className={`text-[11px] ${product.stock_quantity === 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
          Stk: {product.stock_quantity}
        </p>
      </div>

      {/* Price + Add button */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-black text-emerald-600">Rs. {product.price.toFixed(0)}</span>
        {viewOnly ? (
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">View</span>
        ) : (
          <button
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shadow-sm ${
              product.stock_quantity === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (product.stock_quantity > 0) onAddToCart!(product);
            }}
            disabled={product.stock_quantity === 0}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
