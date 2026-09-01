import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, Printer, RefreshCw, Loader2 } from 'lucide-react';
import api from '../utils/api';
import JsBarcode from 'jsbarcode';
import { useToast } from './Toast';

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    product_id: number;
    product_name: string;
    price: string;
    barcode?: string;
  } | null;
  onBarcodeGenerated?: () => void;
}

const BarcodeModal: React.FC<BarcodeModalProps> = ({ isOpen, onClose, product, onBarcodeGenerated }) => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [barcode, setBarcode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [printQty, setPrintQty] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (isOpen && product) {
      setBarcode(product.barcode || '');
      setPrintQty(1);
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (barcode && svgRef.current) {
      try {
        JsBarcode(svgRef.current, barcode, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 5,
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }
  }, [barcode]);

  if (!isOpen || !product) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/products/${product.product_id}/generate-barcode`);
      setBarcode(res.data.barcode);
      onBarcodeGenerated?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate barcode');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!barcode) return;

    const labels = Array(printQty).fill(null).map(() => `
      <div class="label">
        <div class="product-name">{currency}{product.product_name}</div>
        <div class="product-price">$${parseFloat(product.price).toFixed(0)}</div>
        <svg id="barcode-print-${Math.random()}"></svg>
      </div>
    `).join('');

    const printWindow = window.open('', '', 'width=400,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            @page { size: 50mm 30mm; margin: 0; }
            body { margin: 0; padding: 0; }
            .label {
              width: 50mm; height: 30mm; padding: 2mm;
              display: flex; flex-direction: column;
              align-items: center; justify-content: center;
              page-break-after: always;
              font-family: Arial, sans-serif;
            }
            .product-name {
              font-size: 10px; font-weight: bold;
              text-align: center; margin-bottom: 1mm;
              max-width: 46mm; overflow: hidden;
              white-space: nowrap; text-overflow: ellipsis;
            }
            .product-price {
              font-size: 12px; font-weight: bold; margin-bottom: 1mm;
            }
            svg { max-width: 44mm; height: auto; }
            @media print {
              .label { page-break-after: always; }
              .label:last-child { page-break-after: avoid; }
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
          ${labels}
          <script>
            document.querySelectorAll('svg[id^="barcode-print"]').forEach(function(svg) {
              JsBarcode(svg, "${barcode}", { format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 10, margin: 2 });
            });
            setTimeout(function() { window.print(); }, 300);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-base font-semibold text-gray-800">Barcode Label</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Product Info */}
          <div className="text-center">
            <p className="font-bold text-gray-800">{product.product_name}</p>
            <p className="text-emerald-600 font-bold text-lg">{currency}{parseFloat(product.price).toFixed(0)}</p>
          </div>

          {/* Barcode Preview */}
          {barcode ? (
            <div className="flex flex-col items-center bg-gray-50 rounded-xl p-4 border border-gray-200">
              <svg ref={svgRef}></svg>
            </div>
          ) : (
            <div className="text-center bg-gray-50 rounded-xl p-6 border border-dashed border-gray-300">
              <p className="text-gray-500 mb-3">No barcode assigned</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
              >
                {generating ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                Generate Barcode
              </button>
            </div>
          )}

          {/* Print Controls */}
          {barcode && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Label Quantity:</label>
                <input
                  type="number"
                  value={printQty}
                  onChange={(e) => setPrintQty(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  max={100}
                  className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-center font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <button
                onClick={handlePrint}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={20} />
                Print {printQty} Label{printQty > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeModal;
