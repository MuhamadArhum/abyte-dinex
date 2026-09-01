import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, AlertCircle } from 'lucide-react';
import api from '../utils/api';

interface Combination {
  type_name: string;
  value_name: string;
}

interface Variant {
  variant_id: number;
  variant_name: string;
  sku: string;
  price_adjustment: number;
  stock_quantity: number;
  available_stock: number;
  barcode?: string;
  is_active: boolean;
  combinations: Combination[];
}

interface ProductVariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    product_id: number;
    product_name: string;
    price: number;
    barcode?: string;
  };
  onSelectVariant: (variant: Variant & { base_price: number }) => void;
}

const ProductVariantModal: React.FC<ProductVariantModalProps> = ({
  isOpen,
  onClose,
  product,
  onSelectVariant,
}) => {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      fetchVariants();
    }
  }, [isOpen, product]);

  const fetchVariants = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/variants/product/${product.product_id}`);
      setVariants(response.data);
    } catch (err: any) {
      console.error('Failed to fetch variants:', err);
      setError(err.response?.data?.message || 'Failed to load variants');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVariant = (variant: Variant) => {
    if (variant.available_stock <= 0) {
      return; // Don't allow selection of out-of-stock variants
    }
    onSelectVariant({
      ...variant,
      base_price: product.price,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Select Variant - {product.product_name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Base Price: ${product.price.toFixed(0)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && variants.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No variants available</p>
            </div>
          )}

          {!loading && !error && variants.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {variants.map((variant) => {
                const finalPrice = product.price + variant.price_adjustment;
                const isOutOfStock = variant.available_stock <= 0;

                return (
                  <button
                    key={variant.variant_id}
                    onClick={() => handleSelectVariant(variant)}
                    disabled={isOutOfStock}
                    className={`
                      relative border-2 rounded-lg p-4 text-left transition-all
                      ${
                        isOutOfStock
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                          : 'border-gray-300 hover:border-emerald-500 hover:shadow-lg cursor-pointer'
                      }
                    `}
                  >
                    {/* Variant Name */}
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {variant.variant_name}
                    </h3>

                    {/* Combinations (Size, Color, etc.) */}
                    {variant.combinations && variant.combinations.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {variant.combinations.map((combo, idx) => (
                          <span
                            key={idx}
                            className="inline-block bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded"
                          >
                            {combo.type_name}: {combo.value_name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span className="text-lg font-bold text-green-600">
                        ${finalPrice.toFixed(0)}
                      </span>
                      {variant.price_adjustment !== 0 && (
                        <span
                          className={`text-xs ${
                            variant.price_adjustment > 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          ({variant.price_adjustment > 0 ? '+' : ''}
                          {variant.price_adjustment.toFixed(0)})
                        </span>
                      )}
                    </div>

                    {/* Stock */}
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-500" />
                      <span
                        className={`text-sm font-medium ${
                          isOutOfStock
                            ? 'text-red-600'
                            : variant.available_stock < 10
                            ? 'text-orange-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {isOutOfStock
                          ? 'Out of Stock'
                          : `${variant.available_stock} in stock`}
                      </span>
                    </div>

                    {/* SKU */}
                    <p className="text-xs text-gray-400 mt-2">SKU: {variant.sku}</p>

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
                        <span className="text-red-600 font-bold text-lg">
                          OUT OF STOCK
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductVariantModal;
