import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { SettingsProvider } from './context/SettingsContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import ErrorBoundary from './components/ErrorBoundary';

// Eagerly loaded — always needed on startup
const Layout           = lazy(() => import('./components/Layout'));
const PWAInstallPrompt = lazy(() => import('./components/PWAInstallPrompt'));
const PermissionGuard  = lazy(() => import('./components/PermissionGuard'));

// ── Lazy page imports ─────────────────────────────────────────
const Login          = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const NotFound       = lazy(() => import('./pages/NotFound'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const HelpSupport    = lazy(() => import('./pages/HelpSupport'));
const SalesAnalytics = lazy(() => import('./pages/SalesAnalytics'));

// Sales
const POS          = lazy(() => import('./pages/sales/POS'));
const Orders       = lazy(() => import('./pages/sales/Orders'));
const CashRegister = lazy(() => import('./pages/sales/CashRegister'));
const Returns      = lazy(() => import('./pages/sales/Returns'));
const Quotations   = lazy(() => import('./pages/sales/Quotations'));
const CreditSales  = lazy(() => import('./pages/sales/CreditSales'));
const PriceRules   = lazy(() => import('./pages/sales/PriceRules'));
const SalesTargets = lazy(() => import('./pages/sales/SalesTargets'));
const Deliveries   = lazy(() => import('./pages/sales/Deliveries'));
const WalkInOrders = lazy(() => import('./pages/sales/WalkInOrders'));
const DoneOrders   = lazy(() => import('./pages/sales/DoneOrders'));
const SalesReports = lazy(() => import('./pages/sales/SalesReports'));

// Inventory
const Inventory           = lazy(() => import('./pages/inventory/Inventory'));
const FinishedGoods       = lazy(() => import('./pages/inventory/FinishedGoods'));
const RawMaterials        = lazy(() => import('./pages/inventory/RawMaterials'));
const Categories          = lazy(() => import('./pages/inventory/Categories'));
const PurchaseOrders      = lazy(() => import('./pages/inventory/PurchaseOrders'));
const StockAdjustments    = lazy(() => import('./pages/inventory/StockAdjustments'));
const StockAlerts         = lazy(() => import('./pages/inventory/StockAlerts'));
const InventoryReports    = lazy(() => import('./pages/inventory/InventoryReports'));
const Bundles             = lazy(() => import('./pages/inventory/Bundles'));
const ProductVariants     = lazy(() => import('./pages/inventory/ProductVariants'));
const StockCount          = lazy(() => import('./pages/inventory/StockCount'));
const Products            = lazy(() => import('./pages/inventory/Products'));
const PurchaseVoucher     = lazy(() => import('./pages/inventory/PurchaseVoucher'));
const PurchaseReturn      = lazy(() => import('./pages/inventory/PurchaseReturn'));
const StockIssue          = lazy(() => import('./pages/inventory/StockIssue'));
const StockReturnIssuance = lazy(() => import('./pages/inventory/StockReturnIssuance'));
const RawSale             = lazy(() => import('./pages/inventory/RawSale'));
const Sections            = lazy(() => import('./pages/inventory/Sections'));
const ItemsLedger         = lazy(() => import('./pages/inventory/ItemsLedger'));
const ItemWisePurchase    = lazy(() => import('./pages/inventory/ItemWisePurchase'));
const SupplierWisePurchase= lazy(() => import('./pages/inventory/SupplierWisePurchase'));
const IssuanceReports     = lazy(() => import('./pages/inventory/IssuanceReports'));
const StockReconciliation = lazy(() => import('./pages/inventory/StockReconciliation'));
const OpeningStock        = lazy(() => import('./pages/inventory/OpeningStock'));
const SlowMovingStock     = lazy(() => import('./pages/inventory/SlowMovingStock'));
const FastMovingItems     = lazy(() => import('./pages/inventory/FastMovingItems'));
const PurchaseVsIssuance  = lazy(() => import('./pages/inventory/PurchaseVsIssuance'));
const OpeningClosingStock = lazy(() => import('./pages/inventory/OpeningClosingStock'));
const ReorderAlert        = lazy(() => import('./pages/inventory/ReorderAlert'));
const CategoryWisePurchase= lazy(() => import('./pages/inventory/CategoryWisePurchase'));
const RateHistory         = lazy(() => import('./pages/inventory/RateHistory'));
const Recipes             = lazy(() => import('./pages/inventory/Recipes'));
const ProductionOrders    = lazy(() => import('./pages/inventory/ProductionOrders'));
const StockTransfers      = lazy(() => import('./pages/inventory/StockTransfers'));

// Customers (Sales)
const Customers = lazy(() => import('./pages/sales/Customers'));

// Restaurant
const TableManagement = lazy(() => import('./pages/restaurant/TableManagement'));

// Barcode
const BarcodeGenerator = lazy(() => import('./pages/inventory/BarcodeGenerator'));

// Inventory extras (B-009: were missing from imports)
const Suppliers               = lazy(() => import('./pages/inventory/Suppliers'));
const FinishedGoodsCategories = lazy(() => import('./pages/inventory/FinishedGoodsCategories'));
const RawMaterialCategories   = lazy(() => import('./pages/inventory/RawMaterialCategories'));
const RawMaterialItems        = lazy(() => import('./pages/inventory/RawMaterialItems'));
const SemiFinishedCategories  = lazy(() => import('./pages/inventory/SemiFinishedCategories'));

// System
const Users         = lazy(() => import('./pages/system/Users'));
const Tenants       = lazy(() => import('./pages/system/Tenants'));
const AccessControl = lazy(() => import('./pages/system/AccessControl'));
const AuditLog      = lazy(() => import('./pages/system/AuditLog'));
const Backup        = lazy(() => import('./pages/system/Backup'));
const SettingsPage  = lazy(() => import('./pages/system/Settings'));
const EmailSettings = lazy(() => import('./pages/system/EmailSettings'));

// ── Logo Loader ───────────────────────────────────────────────
const LogoLoader = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div className={`flex flex-col items-center justify-center gap-4 ${fullScreen ? 'min-h-screen bg-gray-50' : 'min-h-[60vh]'}`}>
    <div className="relative">
      <img
        src="/logo.png"
        alt="Abyte Dinex"
        className="w-16 h-16 object-contain animate-pulse"
      />
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

const PageLoader = () => <LogoLoader />;

// ── Protected Route ───────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <LogoLoader fullScreen />;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// ── Guard shorthand ───────────────────────────────────────────
const G = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>
    <PermissionGuard moduleKey={k}>{children}</PermissionGuard>
  </Suspense>
);

// ── Admin-only guard ──────────────────────────────────────────
const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <ConfirmProvider>
          <CartProvider>
            <Router>
              <ErrorBoundary>
                <Routes>
                  <Route path="/login"            element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
                  <Route path="/forgot-password"  element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
                  <Route path="/reset-password"   element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />

                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<PageLoader />}>
                          <Layout>
                            <ErrorBoundary>
                              <Suspense fallback={<PageLoader />}>
                                <Routes>
                                  {/* Unguarded */}
                                  <Route path="/"                   element={<Dashboard />} />
                                  <Route path="/pos"                element={<G k="sales.pos"><POS /></G>} />
                                  <Route path="/walk-in-orders"     element={<G k="sales.pos"><WalkInOrders /></G>} />
                                  <Route path="/cash-register"      element={<G k="sales.register"><CashRegister /></G>} />

                                  {/* Sales */}
                                  <Route path="/orders"         element={<G k="sales.orders"><Orders /></G>} />
                                  <Route path="/customers"      element={<G k="sales.customers"><Customers /></G>} />
                                  <Route path="/returns"        element={<G k="sales.returns"><Returns /></G>} />
                                  <Route path="/quotations"     element={<G k="sales.quotations"><Quotations /></G>} />
                                  <Route path="/credit-sales"   element={<G k="sales.credit"><CreditSales /></G>} />
                                  <Route path="/price-rules"    element={<G k="sales.pricerules"><PriceRules /></G>} />
                                  <Route path="/sales-targets"  element={<G k="sales.targets"><SalesTargets /></G>} />
                                  <Route path="/deliveries"     element={<G k="sales.deliveries"><Deliveries /></G>} />
                                  <Route path="/done-orders"    element={<G k="sales.orders"><DoneOrders /></G>} />
                                  <Route path="/sales-reports"  element={<G k="sales.reports"><SalesReports /></G>} />
                                  <Route path="/sales-analytics"element={<G k="sales.reports"><SalesAnalytics /></G>} />

                                  {/* Restaurant */}
                                  <Route path="/restaurant/tables" element={<G k="restaurant.tables"><TableManagement /></G>} />

                                  {/* Inventory */}
                                  <Route path="/inventory"             element={<G k="inventory.products"><Inventory /></G>} />
                                  <Route path="/finished-goods"        element={<G k="inventory.products"><FinishedGoods /></G>} />
                                  <Route path="/raw-materials"         element={<G k="inventory.products"><RawMaterials /></G>} />
                                  <Route path="/categories"            element={<G k="inventory.categories"><Categories /></G>} />
                                  <Route path="/suppliers"             element={<G k="inventory.purchases"><Suppliers /></G>} />
                                  <Route path="/finished-goods-categories" element={<G k="inventory.categories"><FinishedGoodsCategories /></G>} />
                                  <Route path="/raw-material-categories"   element={<G k="inventory.categories"><RawMaterialCategories /></G>} />
                                  <Route path="/raw-material-items"        element={<G k="inventory.products"><RawMaterialItems /></G>} />
                                  <Route path="/semi-finished-categories"  element={<G k="inventory.categories"><SemiFinishedCategories /></G>} />
                                  <Route path="/purchase-orders"       element={<G k="inventory.purchases"><PurchaseOrders /></G>} />
                                  <Route path="/stock-adjustments"     element={<G k="inventory.adjustments"><StockAdjustments /></G>} />
                                  <Route path="/stock-alerts"          element={<G k="inventory.alerts"><StockAlerts /></G>} />
                                  <Route path="/inventory-reports"     element={<G k="inventory.reports"><InventoryReports /></G>} />
                                  <Route path="/bundles"               element={<G k="inventory.bundles"><Bundles /></G>} />
                                  <Route path="/product-variants"      element={<G k="inventory.variants"><ProductVariants /></G>} />
                                  <Route path="/stock-count"           element={<G k="inventory.stockcount"><StockCount /></G>} />
                                  <Route path="/barcode-generator"     element={<G k="inventory.products"><BarcodeGenerator /></G>} />
                                  <Route path="/products"              element={<G k="inventory.products"><Products /></G>} />
                                  <Route path="/purchase-voucher"      element={<G k="inventory.purchases"><PurchaseVoucher /></G>} />
                                  <Route path="/purchase-return"       element={<G k="inventory.purchases"><PurchaseReturn /></G>} />
                                  <Route path="/stock-issue"           element={<G k="inventory.adjustments"><StockIssue /></G>} />
                                  <Route path="/stock-return-issuance" element={<G k="inventory.adjustments"><StockReturnIssuance /></G>} />
                                  <Route path="/raw-sale"              element={<G k="inventory.adjustments"><RawSale /></G>} />
                                  <Route path="/sections"              element={<G k="inventory.adjustments"><Sections /></G>} />
                                  <Route path="/items-ledger"          element={<G k="inventory.reports"><ItemsLedger /></G>} />
                                  <Route path="/item-wise-purchase"    element={<G k="inventory.reports"><ItemWisePurchase /></G>} />
                                  <Route path="/supplier-wise-purchase"element={<G k="inventory.reports"><SupplierWisePurchase /></G>} />
                                  <Route path="/issuance-reports"      element={<G k="inventory.reports"><IssuanceReports /></G>} />
                                  <Route path="/stock-reconciliation"  element={<G k="inventory.reports"><StockReconciliation /></G>} />
                                  <Route path="/slow-moving-stock"     element={<G k="inventory.reports"><SlowMovingStock /></G>} />
                                  <Route path="/fast-moving-items"     element={<G k="inventory.reports"><FastMovingItems /></G>} />
                                  <Route path="/purchase-vs-issuance"  element={<G k="inventory.reports"><PurchaseVsIssuance /></G>} />
                                  <Route path="/opening-closing-stock" element={<G k="inventory.reports"><OpeningClosingStock /></G>} />
                                  <Route path="/reorder-alert"         element={<G k="inventory.reports"><ReorderAlert /></G>} />
                                  <Route path="/category-wise-purchase"element={<G k="inventory.reports"><CategoryWisePurchase /></G>} />
                                  <Route path="/rate-history"          element={<G k="inventory.reports"><RateHistory /></G>} />
                                  <Route path="/opening-stock"         element={<G k="inventory.products"><OpeningStock /></G>} />
                                  <Route path="/recipes"               element={<G k="inventory.products"><Recipes /></G>} />
                                  <Route path="/production-orders"     element={<G k="inventory.products"><ProductionOrders /></G>} />
                                  <Route path="/stock-transfers"       element={<G k="inventory.adjustments"><StockTransfers /></G>} />

                                  {/* System */}
                                  <Route path="/users"          element={<Suspense fallback={<PageLoader />}><AdminGuard><Users /></AdminGuard></Suspense>} />
                                  <Route path="/access-control" element={<Suspense fallback={<PageLoader />}><AdminGuard><AccessControl /></AdminGuard></Suspense>} />
                                  <Route path="/audit-log"      element={<G k="system.audit"><AuditLog /></G>} />
                                  <Route path="/backup"         element={<G k="system.backup"><Backup /></G>} />
                                  <Route path="/settings"       element={<G k="system.settings"><SettingsPage /></G>} />
                                  <Route path="/email-settings" element={<G k="system.settings"><EmailSettings /></G>} />
                                  <Route path="/tenants"        element={<Suspense fallback={<PageLoader />}><AdminGuard><Tenants /></AdminGuard></Suspense>} />
                                  <Route path="/help"           element={<HelpSupport />} />
                                </Routes>
                              </Suspense>
                            </ErrorBoundary>
                          </Layout>
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
            </Router>
            <Suspense fallback={null}>
              <PWAInstallPrompt />
            </Suspense>
          </CartProvider>
          </ConfirmProvider>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
