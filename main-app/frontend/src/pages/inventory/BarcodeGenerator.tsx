import { useState, useEffect, useRef, useCallback } from 'react';
import JsBarcode from 'jsbarcode';
import api from '../../utils/api';
import { Plus, Check, X, Minus, Printer, Trash2, RefreshCw } from 'lucide-react';

interface Product {
  product_id: number;
  product_name: string;
  barcode: string | null;
  sku: string | null;
  selling_price: number;
  product_type: string;
}

interface QueueItem {
  product_id: number;
  product_name: string;
  barcode: string;
  selling_price: number;
  sku: string | null;
  copies: number;
}

interface BarcodeImageProps {
  barcode: string;
  labelSize: 'small' | 'medium' | 'large';
  showPrice: boolean;
  showName: boolean;
  showSku: boolean;
  selling_price: number;
  product_name: string;
  sku: string | null;
}

function BarcodeImage({ barcode, labelSize, showPrice, showName, showSku, selling_price, product_name, sku }: BarcodeImageProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const heightBySize = labelSize === 'small' ? 70 : labelSize === 'medium' ? 90 : 120;

  useEffect(() => {
    if (svgRef.current && barcode) {
      try {
        JsBarcode(svgRef.current, barcode, {
          format: 'CODE128',
          width: 1.5,
          height: heightBySize,
          displayValue: true,
          fontSize: 8,
          margin: 2,
        });
      } catch {
        // invalid barcode
      }
    }
  }, [barcode, labelSize, heightBySize]);

  return (
    <div className="border border-gray-200 rounded flex flex-col items-center p-1" style={{ padding: '4px' }}>
      {showName && (
        <span className="text-xs text-center font-medium text-gray-800 leading-tight mb-0.5" style={{ maxWidth: 120, wordBreak: 'break-word' }}>
          {product_name}
        </span>
      )}
      <svg ref={svgRef} />
      {showPrice && (
        <span className="text-xs text-gray-700 font-semibold mt-0.5">
          PKR {Number(selling_price).toFixed(2)}
        </span>
      )}
      {showSku && sku && (
        <span className="text-xs text-gray-500 mt-0.5">SKU: {sku}</span>
      )}
    </div>
  );
}

export default function BarcodeGenerator() {
  const [products, setProducts] = useState<Product[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | 'finished_good' | 'raw_material' | 'semi_finished'>('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);
  const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showSku, setShowSku] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProducts = useCallback((searchVal: string, typeVal: string) => {
    setLoading(true);
    const params: Record<string, string> = { limit: '200' };
    if (searchVal) params.search = searchVal;
    if (typeVal) params.type = typeVal;
    api
      .get('/api/products', { params })
      .then((res) => {
        const data = res.data?.products ?? res.data?.data ?? res.data ?? [];
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchProducts(search, typeFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, typeFilter, fetchProducts]);

  const isInQueue = (product_id: number) => queue.some((q) => q.product_id === product_id);

  const addToQueue = (product: Product) => {
    if (!product.barcode || isInQueue(product.product_id)) return;
    setQueue((prev) => [
      ...prev,
      {
        product_id: product.product_id,
        product_name: product.product_name,
        barcode: product.barcode!,
        selling_price: product.selling_price,
        sku: product.sku,
        copies: 1,
      },
    ]);
  };

  const generateBarcode = async (product: Product) => {
    setGenerating(product.product_id);
    try {
      await api.post(`/api/products/${product.product_id}/generate-barcode`);
      await fetchProducts(search, typeFilter);
    } catch {
      // handle silently
    } finally {
      setGenerating(null);
    }
  };

  const updateCopies = (product_id: number, delta: number) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.product_id === product_id
          ? { ...q, copies: Math.min(100, Math.max(1, q.copies + delta)) }
          : q
      )
    );
  };

  const removeFromQueue = (product_id: number) => {
    setQueue((prev) => prev.filter((q) => q.product_id !== product_id));
  };

  const totalLabels = queue.reduce((sum, q) => sum + q.copies, 0);

  const handlePrint = () => {
    const heightBySize = labelSize === 'small' ? 40 : labelSize === 'medium' ? 60 : 80;
    const widthBySize = labelSize === 'small' ? 140 : labelSize === 'medium' ? 180 : 240;

    const labelsHtml: string[] = [];

    for (const item of queue) {
      for (let i = 0; i < item.copies; i++) {
        const canvas = document.createElement('canvas');
        try {
          JsBarcode(canvas, item.barcode, {
            format: 'CODE128',
            width: 2,
            height: heightBySize,
            displayValue: true,
            fontSize: 9,
            margin: 4,
          });
        } catch {
          continue;
        }
        const imgSrc = canvas.toDataURL('image/png');

        labelsHtml.push(`
          <div class="label" style="width:${widthBySize}px;">
            ${showName ? `<div class="label-name">${item.product_name}</div>` : ''}
            <img src="${imgSrc}" style="max-width:100%;" />
            ${showPrice ? `<div class="label-price">PKR ${Number(item.selling_price).toFixed(2)}</div>` : ''}
            ${showSku && item.sku ? `<div class="label-sku">SKU: ${item.sku}</div>` : ''}
          </div>
        `);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Barcode Labels</title>
  <style>
    @page { margin: 5mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    .labels-container { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; }
    .label { display: flex; flex-direction: column; align-items: center; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px; }
    .label-name { font-size: 9px; font-weight: 600; text-align: center; margin-bottom: 2px; word-break: break-word; max-width: 100%; }
    .label-price { font-size: 9px; font-weight: 700; margin-top: 2px; }
    .label-sku { font-size: 8px; color: #6b7280; margin-top: 1px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="labels-container">
    ${labelsHtml.join('')}
  </div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  const previewItems: Array<QueueItem & { key: string }> = [];
  for (const item of queue) {
    for (let i = 0; i < item.copies; i++) {
      previewItems.push({ ...item, key: `${item.product_id}-${i}` });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Barcode Label Generator</h1>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Left Panel */}
          <div className="w-full sm:w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col" style={{ maxHeight: '75vh' }}>
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-700 mb-3">Product Selector</h2>
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Types</option>
                <option value="finished_good">Finished Good</option>
                <option value="raw_material">Raw Material</option>
                <option value="semi_finished">Semi Finished</option>
              </select>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading...</div>
              ) : products.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No products found</div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {products.map((product) => {
                    const inQueue = isInQueue(product.product_id);
                    const isGen = generating === product.product_id;
                    return (
                      <li key={product.product_id} className="flex items-center px-4 py-2.5 hover:bg-gray-50 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{product.product_name}</p>
                          <div className="flex gap-2 mt-0.5">
                            {product.barcode ? (
                              <span className="text-xs text-gray-500 font-mono">{product.barcode}</span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No barcode</span>
                            )}
                            {product.sku && (
                              <span className="text-xs text-gray-400">· {product.sku}</span>
                            )}
                          </div>
                        </div>
                        {product.barcode ? (
                          <button
                            onClick={() => addToQueue(product)}
                            disabled={inQueue}
                            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                              inQueue
                                ? 'bg-emerald-50 text-emerald-600 cursor-default'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            }`}
                          >
                            {inQueue ? <Check size={12} /> : <Plus size={12} />}
                            {inQueue ? 'Added' : 'Add'}
                          </button>
                        ) : (
                          <button
                            onClick={() => generateBarcode(product)}
                            disabled={isGen}
                            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60"
                          >
                            <RefreshCw size={12} className={isGen ? 'animate-spin' : ''} />
                            Generate
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-full sm:w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col" style={{ maxHeight: '75vh' }}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-700">Label Queue</h2>
                <p className="text-xs text-gray-400 mt-0.5">Total labels: <span className="font-semibold text-gray-600">{totalLabels}</span></p>
              </div>
              {queue.length > 0 && (
                <button
                  onClick={() => setQueue([])}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={12} />
                  Clear All
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {queue.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No products in queue</div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {queue.map((item) => (
                    <li key={item.product_id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.product_name}</p>
                        <p className="text-xs font-mono text-gray-500">{item.barcode}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCopies(item.product_id, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-gray-700">{item.copies}</span>
                        <button
                          onClick={() => updateCopies(item.product_id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromQueue(item.product_id)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 space-y-3">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5">Label Size</p>
                <div className="flex gap-1">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setLabelSize(size)}
                      className={`flex-1 py-1 text-xs font-medium rounded-lg capitalize transition-colors ${
                        labelSize === size
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                {[
                  { label: 'Show Name', value: showName, set: setShowName },
                  { label: 'Show Price', value: showPrice, set: setShowPrice },
                  { label: 'Show SKU', value: showSku, set: setShowSku },
                ].map(({ label, value, set }) => (
                  <label key={label} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => set(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-600"
                    />
                    <span className="text-xs text-gray-600">{label}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={handlePrint}
                disabled={queue.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium text-sm py-2 rounded-lg transition-colors"
              >
                <Printer size={15} />
                Print Labels
              </button>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        {previewItems.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-base font-semibold text-gray-700 mb-4">
              Preview <span className="text-xs font-normal text-gray-400 ml-1">({previewItems.length} label{previewItems.length !== 1 ? 's' : ''})</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {previewItems.map((item) => (
                <BarcodeImage
                  key={item.key}
                  barcode={item.barcode}
                  labelSize={labelSize}
                  showPrice={showPrice}
                  showName={showName}
                  showSku={showSku}
                  selling_price={item.selling_price}
                  product_name={item.product_name}
                  sku={item.sku}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
