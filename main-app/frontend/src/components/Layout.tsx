import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Settings,
  LogOut,
  Menu,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  User,
  Wallet,
  RotateCcw,
  ScrollText,
  Database,

  TrendingUp,
  HelpCircle,
  FileText,
  BookOpen,
  PieChart,
  Percent,
  Target,
  Tag,
  Truck,
  ShoppingBag,
  Boxes,
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Warehouse,
  FileStack,
  RefreshCw,
  ClipboardList,
  PackageOpen,
  Table2,
  FlaskConical,
  Factory,
  Shield,
  CheckCircle,
  Clock,
  LayoutList,
  AlertTriangle,
  History,
  Barcode,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import AIWidget from './AIWidget';
import ProfileModal from './ProfileModal';
import { usePrintQueue } from '../hooks/usePrintQueue';

interface MenuItem {
  icon: any;
  label: string;
  path?: string;
  moduleKey?: string;
  adminOnly?: boolean;
  color?: string;
  isSection?: boolean;
  children?: MenuItem[];
}

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission, hasModule, isAdmin } = useAuth();
  usePrintQueue();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    sales: false,
    inventory: false,
    system: false
  });
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'STOCK ITEMS': true,
    'PURCHASE': true,
    'ISSUANCE': true,
    'MANUFACTURING': true,
    'REPORTS': true,
  });
  const toggleSection = (key: string) =>
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const [notifications] = useState([
    { id: 1, title: 'Low Stock Alert', message: 'Product ABC is running low', time: '5m ago', read: false },
    { id: 2, title: 'New Order', message: 'Order #1234 received', time: '10m ago', read: false },
    { id: 3, title: 'Payment Successful', message: 'Payment of $150 received', time: '1h ago', read: true },
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const menuStructure: MenuItem[] = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      path: '/',
      moduleKey: 'dashboard',
      color: 'blue'
    },
    {
      icon: ShoppingCart,
      label: 'Sales',
      moduleKey: 'sales',
      color: 'emerald',
      children: [
        { icon: ShoppingCart, label: 'POS', path: '/pos', moduleKey: 'sales.pos' },
        { icon: ShoppingBag, label: 'Walk-In Orders', path: '/walk-in-orders', moduleKey: 'sales.pos' },
        { icon: ScrollText, label: 'Completed Orders', path: '/orders', moduleKey: 'sales.orders' },
        { icon: Truck, label: 'Delivery', path: '/deliveries', moduleKey: 'sales.deliveries' },
        { icon: CheckCircle, label: 'Done Orders', path: '/done-orders', moduleKey: 'sales.orders' },
        { icon: Wallet, label: 'Cash Register', path: '/cash-register', moduleKey: 'sales.register' },
        { icon: RotateCcw, label: 'Returns', path: '/returns', moduleKey: 'sales.returns' },
        { icon: FileText, label: 'Quotations', path: '/quotations', moduleKey: 'sales.quotations' },
        { icon: BookOpen, label: 'Credit Sales', path: '/credit-sales', moduleKey: 'sales.credit' },
        { icon: Percent, label: 'Price Rules', path: '/price-rules', moduleKey: 'sales.pricerules' },
        { icon: Target, label: 'Sales Targets', path: '/sales-targets', moduleKey: 'sales.targets' },
        { icon: PieChart, label: 'Sales Reports', path: '/sales-reports', moduleKey: 'sales.reports' },
        { icon: TrendingUp, label: 'Sales Analytics', path: '/sales-analytics', moduleKey: 'sales.reports' },
        { icon: Table2, label: 'Tables', path: '/restaurant/tables', moduleKey: 'restaurant.tables' },
        { icon: Users, label: 'Customers', path: '/customers', moduleKey: 'sales.customers' },
      ]
    },
    {
      icon: Package,
      label: 'Inventory',
      moduleKey: 'inventory',
      color: 'purple',
      children: [
        // ── STOCK ITEMS ──
        { icon: Package,        label: 'STOCK ITEMS',       isSection: true } as any,
        { icon: Boxes,          label: 'Products',          path: '/products',           moduleKey: 'inventory.products' },
        { icon: Tag,            label: 'Categories',        path: '/categories',         moduleKey: 'inventory.categories' },
        { icon: Tag,            label: 'Deals & Bundles',   path: '/bundles',            moduleKey: 'inventory.bundles' },
        { icon: PackageOpen,    label: 'Opening Stock',     path: '/opening-stock',      moduleKey: 'inventory.products' },
        // ── PURCHASE ──
        { icon: Package,        label: 'PURCHASE',          isSection: true } as any,
        { icon: ClipboardList,  label: 'Purchase Orders',   path: '/purchase-orders',    moduleKey: 'inventory.purchases' },
        { icon: ArrowDownToLine,label: 'Purchase Voucher',  path: '/purchase-voucher',   moduleKey: 'inventory.purchases' },
        { icon: ArrowUpFromLine,label: 'Purchase Return',   path: '/purchase-return',    moduleKey: 'inventory.purchases' },
        // ── ISSUANCE ──
        { icon: Package,        label: 'ISSUANCE',          isSection: true } as any,
        { icon: ArrowUpFromLine,label: 'Stock Issue',       path: '/stock-issue',        moduleKey: 'inventory.adjustments' },
        { icon: ArrowDownToLine,label: 'Stock Return',      path: '/stock-return-issuance', moduleKey: 'inventory.adjustments' },
        { icon: ShoppingBag,    label: 'Raw Sale',          path: '/raw-sale',           moduleKey: 'inventory.adjustments' },
        { icon: Warehouse,      label: 'Sections',          path: '/sections',           moduleKey: 'inventory.adjustments' },
        // ── MANUFACTURING ──
        { icon: Factory,        label: 'MANUFACTURING',     isSection: true } as any,
        { icon: FlaskConical,   label: 'Recipes',           path: '/recipes',            moduleKey: 'inventory.products' },
        { icon: Factory,        label: 'Production Orders', path: '/production-orders',  moduleKey: 'inventory.products' },
        { icon: Barcode,        label: 'Barcode Generator', path: '/barcode-generator',  moduleKey: 'inventory.products' },
        // ── REPORTS ──
        { icon: Package,        label: 'REPORTS',           isSection: true } as any,
        { icon: BookOpen,       label: 'Items Ledger',        path: '/items-ledger',           moduleKey: 'inventory.reports' },
        { icon: FileStack,      label: 'Item Wise Purchase',  path: '/item-wise-purchase',     moduleKey: 'inventory.reports' },
        { icon: Users,          label: 'Supplier Wise',       path: '/supplier-wise-purchase', moduleKey: 'inventory.reports' },
        { icon: ArrowLeftRight, label: 'Issuance Reports',    path: '/issuance-reports',       moduleKey: 'inventory.reports' },
        { icon: RefreshCw,      label: 'Stock Reconciliation',path: '/stock-reconciliation',   moduleKey: 'inventory.reports' },
        { icon: Clock,          label: 'Slow Moving Stock',   path: '/slow-moving-stock',      moduleKey: 'inventory.reports' },
        { icon: TrendingUp,     label: 'Fast Moving Items',   path: '/fast-moving-items',      moduleKey: 'inventory.reports' },
        { icon: ArrowLeftRight, label: 'Purchase vs Issuance',path: '/purchase-vs-issuance',   moduleKey: 'inventory.reports' },
        { icon: LayoutList,     label: 'Opening/Closing Stock',path: '/opening-closing-stock', moduleKey: 'inventory.reports' },
        { icon: AlertTriangle,  label: 'Reorder Alert',       path: '/reorder-alert',          moduleKey: 'inventory.reports' },
        { icon: Tag,            label: 'Category Wise Purchase',path: '/category-wise-purchase',moduleKey: 'inventory.reports' },
        { icon: History,        label: 'Rate History',         path: '/rate-history',           moduleKey: 'inventory.reports' },
      ]
    },
    {
      icon: Settings,
      label: 'System',
      moduleKey: 'system',
      color: 'gray',
      children: [
        { icon: Users, label: 'Users', path: '/users', adminOnly: true },
        { icon: Shield, label: 'Access Control', path: '/access-control', adminOnly: true },
        { icon: ScrollText, label: 'Audit Log', path: '/audit-log', moduleKey: 'system.audit' },
        { icon: Database, label: 'Backup', path: '/backup', moduleKey: 'system.backup' },
        { icon: Bell, label: 'Email Notifications', path: '/email-settings', moduleKey: 'system.settings' },
        { icon: Settings, label: 'Settings', path: '/settings', moduleKey: 'system.settings' },
      ]
    }
  ];

  const filterMenuByPermission = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter(item => {
        if (item.adminOnly) return isAdmin;
        if (!item.moduleKey) return true;
        // Tenant module subscription check (applies to everyone including Admin)
        if (!hasModule(item.moduleKey)) return false;
        // Role permission check
        return hasPermission(item.moduleKey);
      })
      .map(item => ({
        ...item,
        children: item.children ? filterMenuByPermission(item.children) : undefined,
      }))
      .filter(item => !item.children || item.children.length > 0);
  };

  const filteredMenu = filterMenuByPermission(menuStructure);

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderMenuItem = (item: MenuItem, index: number) => {
    const Icon = item.icon;
    const menuKey = item.label.toLowerCase();
    const isExpanded = expandedMenus[menuKey];
    const isActive = item.path && location.pathname === item.path;
    const hasChildren = item.children && item.children.length > 0;
    const isParentActive = hasChildren && item.children!.some(child => !child.isSection && child.path === location.pathname);

    if (hasChildren && !isCollapsed) {
      return (
        <div key={index} className="space-y-1">
          {/* Parent Menu Item */}
          <button
            onClick={() => toggleMenu(menuKey)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${isParentActive
                ? 'bg-emerald-500/12 text-emerald-400 font-semibold border border-emerald-500/20'
                : isExpanded
                  ? 'bg-white/5 text-white border border-white/8'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
          >
            {isParentActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-emerald-400 rounded-r-full" />}
            <div className="flex items-center gap-3">
              <Icon
                size={18}
                className={`flex-shrink-0 ${isParentActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-400'
                  }`}
              />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            {isExpanded ? (
              <ChevronUp size={13} className={isParentActive || isExpanded ? 'text-emerald-500/60' : 'text-slate-600'} />
            ) : (
              <ChevronDown size={13} className="text-slate-600" />
            )}
          </button>

          {/* Children Menu Items */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="ml-4 space-y-0.5 border-l border-slate-700/60 pl-2"
              >
                {(() => {
                  let currentSection = '';
                  return item.children!.map((child, childIndex) => {
                    if (child.isSection) {
                      currentSection = child.label;
                      const secCollapsed = !!collapsedSections[currentSection];
                      return (
                        <button
                          key={childIndex}
                          onClick={() => toggleSection(child.label)}
                          className="w-full flex items-center justify-between pt-3 pb-1 px-2 group"
                        >
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 group-hover:text-slate-400 transition-colors">{child.label}</span>
                          <ChevronDown
                            size={10}
                            className={`text-slate-600 group-hover:text-slate-400 transition-transform duration-200 ${secCollapsed ? '' : 'rotate-180'}`}
                          />
                        </button>
                      );
                    }
                    if (collapsedSections[currentSection]) return null;
                    const ChildIcon = child.icon;
                    const isChildActive = child.path && location.pathname === child.path;
                    return (
                      <Link
                        key={childIndex}
                        to={child.path!}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${isChildActive
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium shadow-md shadow-emerald-900/40'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                          }`}
                      >
                        <ChildIcon
                          size={16}
                          className={`flex-shrink-0 ${isChildActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400'
                            }`}
                        />
                        <span className="text-sm">{child.label}</span>
                      </Link>
                    );
                  });
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // Single menu item (no children) or collapsed view
    if (item.path) {
      return (
        <Link
          key={index}
          to={item.path}
          className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-lg shadow-emerald-900/40'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
            } ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? item.label : ''}
        >
          {isActive && !isCollapsed && (
            <motion.div
              layoutId="activeTab"
              className="absolute left-0 top-0 bottom-0 w-1 bg-white/60 rounded-r-full"
              transition={{ type: "spring", duration: 0.5 }}
            />
          )}

          <Icon
            size={20}
            className={`flex-shrink-0 transition-transform duration-200 ${isActive
                ? 'text-white scale-110'
                : 'text-slate-500 group-hover:text-emerald-400 group-hover:scale-110'
              }`}
          />
          {!isCollapsed && (
            <span className="whitespace-nowrap overflow-hidden text-sm">
              {item.label}
            </span>
          )}

          {!isActive && (
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10 rounded-xl" />
          )}
        </Link>
      );
    }

    return null;
  };

  return (
    <div className="flex h-screen font-sans overflow-hidden animated-bg">
      {/* Sidebar */}
      <aside
        style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0f172a 40%, #111827 100%)' }}
        className={`${isCollapsed ? 'w-20' : 'w-72'} flex flex-col shadow-2xl z-20 transition-all duration-300 ease-in-out relative hidden md:flex border-r border-white/[0.06]`}
      >
        {/* Ambient glow top */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-emerald-500/5 blur-3xl pointer-events-none" />
        {/* Dot grid pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />

        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06] relative z-10">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 overflow-hidden whitespace-nowrap"
            >
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-900/50 flex-shrink-0 bg-white">
                <img src="/logo.png" alt="Abyte Dinex" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-white font-bold text-base leading-tight">Abyte <span className="text-emerald-400">Dinex</span></p>
                <p className="text-[10px] text-slate-500 font-medium">Business Solution</p>
              </div>
            </motion.div>
          )}
          {isCollapsed && (
            <div className="w-full flex justify-center">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-900/50 bg-white">
                <img src="/logo.png" alt="Abyte Dinex" className="w-full h-full object-contain" />
              </div>
            </div>
          )}

          {/* Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-white/8 text-slate-400 hover:text-white hover:bg-white/15 transition-all duration-200 absolute -right-3.5 top-20 border border-white/10 shadow-lg z-30"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* User Info Card - Only show when not collapsed */}
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-3 mt-3 p-3.5 bg-white/[0.06] border border-white/[0.08] rounded-xl relative z-10 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-emerald-900/50 ring-2 ring-white/10">
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-emerald-400 font-medium capitalize">{user?.role_name || user?.role || 'Staff'}</p>
              </div>
              <div className="flex-shrink-0">
                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wide bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">Online</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent relative z-10">
          {filteredMenu.map((item, index) => renderMenuItem(item, index))}
        </nav>

        {/* Bottom Section */}
        {!isCollapsed && (
          <div className="p-3 border-t border-white/[0.06] relative z-10">
            <div className="space-y-1">
              <Link to="/help" className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-500 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-all">
                <HelpCircle size={15} />
                <span>Help & Support</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-all font-medium"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-700 text-center mt-3">Abyte Dinex v1.0 &copy; 2025</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-14 md:h-16 bg-white/90 backdrop-blur-xl border-b border-gray-200/70 flex items-center justify-between px-3 md:px-6 shadow-sm z-40 relative">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex-shrink-0"
            >
              <Menu size={20} />
            </button>

            {/* Mobile logo */}
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-white shadow">
                <img src="/logo.png" alt="Abyte Dinex" className="w-full h-full object-contain" />
              </div>
              <span className="text-sm font-bold text-gray-800 truncate max-w-[120px]">
                {filteredMenu.flatMap(m => [m, ...(m.children || [])]).find(m => m.path === location.pathname)?.label || 'Abyte Dinex'}
              </span>
            </div>

            {/* Desktop page title */}
            <div className="hidden md:flex flex-col">
              <h1 className="text-base font-bold text-gray-900 leading-tight">
                {filteredMenu.flatMap(m => [m, ...(m.children || [])]).find(m => m.path === location.pathname)?.label || 'Dashboard'}
              </h1>
              <p className="text-xs text-gray-400">Abyte Dinex &mdash; Complete Business Management</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setIsNotificationOpen(!isNotificationOpen); setIsProfileOpen(false); }}
                className="relative p-2 md:p-2.5 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              >
                <Bell size={18} className="md:hidden" />
                <Bell size={22} className="hidden md:block" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 md:top-1 md:right-1 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-[9px] md:text-xs rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotificationOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 md:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50 max-h-64 md:max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!n.read ? 'bg-emerald-50/40' : ''}`}
                      >
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${!n.read ? 'text-gray-800' : 'text-gray-600'}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 truncate">{n.message}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{n.time}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <button className="w-full text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                      Mark all as read
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotificationOpen(false); }}
                className="flex items-center gap-2 md:gap-3 px-1.5 md:px-3 py-1.5 md:py-2 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-200"
              >
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-md text-sm flex-shrink-0">
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name || 'User'}</p>
                  <p className="text-xs text-emerald-600 font-medium capitalize">{user?.role_name || user?.role}</p>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 hidden sm:block ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  {/* User Info Header */}
                  <div className="px-4 py-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-white">
                        {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{user?.name || 'User'}</p>
                        <p className="text-xs text-emerald-600 font-medium capitalize">{user?.role_name || user?.role || 'Staff'}</p>
                        <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={() => { setIsProfileOpen(false); setIsProfileModalOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      <User size={16} className="text-gray-400" />
                      My Profile
                    </button>
                    <Link
                      to="/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      <Settings size={16} className="text-gray-400" />
                      Settings
                    </Link>
                    <Link
                      to="/audit-log"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      <ScrollText size={16} className="text-gray-400" />
                      Activity Log
                    </Link>
                  </div>

                  <div className="py-2 border-t border-gray-100">
                    <button
                      onClick={() => { setIsProfileOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto flex flex-col relative">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex-1 flex flex-col relative z-10"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 z-30 md:hidden"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)' }}
              className="fixed left-0 top-0 bottom-0 w-72 shadow-2xl z-40 flex flex-col md:hidden border-r border-white/5"
            >
              {/* Logo */}
              <div className="h-16 flex items-center gap-3 px-4 border-b border-white/8">
                <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-lg flex-shrink-0 bg-white">
                  <img src="/logo.png" alt="Abyte Dinex" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="text-white font-bold text-base leading-tight">Abyte <span className="text-emerald-400">Dinex</span></p>
                  <p className="text-[10px] text-slate-500 font-medium">Business Solution</p>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="ml-auto p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ChevronLeft size={18} className="text-slate-400" />
                </button>
              </div>

              {/* User card */}
              <div className="mx-3 mt-3 p-3 bg-white/5 border border-white/8 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white/10">
                    {user?.name?.charAt(0) || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-emerald-400 font-medium capitalize">{user?.role_name || 'Staff'}</p>
                  </div>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                {filteredMenu.map((item, index) => renderMenuItem(item, index))}
              </nav>

              {/* Bottom */}
              <div className="p-3 border-t border-white/8">
                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-all font-medium"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* AI Widget */}
      <AIWidget />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default Layout;
