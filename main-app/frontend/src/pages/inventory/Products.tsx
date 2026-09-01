import { useState } from 'react';
import Inventory from './Inventory';

type ProductTab = 'all' | 'finished_good' | 'raw_material' | 'semi_finished';

const TABS: { key: ProductTab; label: string }[] = [
  { key: 'all',           label: 'All Products' },
  { key: 'finished_good', label: 'Finished Goods' },
  { key: 'raw_material',  label: 'Raw Materials' },
  { key: 'semi_finished', label: 'Semi-Finished' },
];

const Products = () => {
  const [tab, setTab] = useState<ProductTab>('all');

  return (
    <div>
      {/* Tab Bar */}
      <div className="border-b border-gray-200 bg-white px-6 pt-4">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Component — filtered by tab */}
      <Inventory productType={tab === 'all' ? undefined : tab} />
    </div>
  );
};

export default Products;
