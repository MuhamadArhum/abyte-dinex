import { useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronUp, MessageCircle, Mail, BookOpen, Zap, ShoppingCart, Package, Users, DollarSign, Settings, ArrowRight, Keyboard, Video, FileText, LifeBuoy, Plus, X, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../utils/api';

const faqs: { category: string; icon: any; color: string; items: { q: string; a: string }[] }[] = [
  {
    category: 'Sales & POS',
    icon: ShoppingCart,
    color: 'emerald',
    items: [
      { q: 'How do I process a sale at the POS?', a: 'Go to Sales → POS. Search or scan a product, set quantity, select payment method (Cash / Card / Credit), then click "Complete Sale". A receipt is generated automatically.' },
      { q: 'How do I apply a discount on an order?', a: 'In the POS cart, click the discount icon next to any item for item-level discount, or use the "Order Discount" field at the bottom for a cart-wide percentage or fixed discount.' },
      { q: 'How do I process a return?', a: 'Go to Sales → Returns. Find the original sale by invoice number, select the items being returned, choose the reason, and confirm. The stock is automatically restocked.' },
      { q: 'How do I create a quotation?', a: 'Go to Sales → Quotations → New Quotation. Add items, quantities, and any notes. You can print or email the quotation to the customer directly from the modal.' },
      { q: 'What is Credit Sales?', a: 'Credit Sales lets you sell to customers on credit — the balance is tracked per customer. Go to Sales → Credit Sales to record payments or view outstanding balances.' },
    ],
  },
  {
    category: 'Inventory',
    icon: Package,
    color: 'purple',
    items: [
      { q: 'How do I add a new product?', a: 'Go to Inventory → Products → Add Product. Fill in the name, SKU, category, unit, cost price, selling price, and opening stock. Save to add it to inventory.' },
      { q: 'How do I receive stock from a purchase order?', a: 'Go to Inventory → Purchase Orders, find the PO, and click "Receive Stock". Enter quantities received — the system updates stock and posts accounting entries automatically.' },
      { q: 'How does Opening Stock work?', a: 'Opening Stock lets you set initial stock quantities when you first set up the system. Go to Inventory → Opening Stock, select the date, and enter quantities per product.' },
      { q: 'What is Stock Issuance?', a: 'Stock Issuance is for internal consumption — issuing raw materials to production or departments. Go to Inventory → Stock Issue, select items, quantities, and destination section.' },
      { q: 'How do I view stock movement for a product?', a: 'Go to Inventory → Items Ledger. Search for the product and set a date range. All stock-in and stock-out movements with their sources are listed.' },
    ],
  },
  {
    category: 'Human Resources',
    icon: Users,
    color: 'blue',
    items: [
      { q: 'How do I mark daily attendance?', a: 'Go to HR → Daily Attendance. Select the date, then use the quick-mark buttons (P / A / L / H) next to each employee. You can also bulk-mark all as Present with one click.' },
      { q: 'How is payroll calculated?', a: 'Payroll uses: Working Days = Calendar Days − Holidays. Daily Rate = Basic Salary ÷ Working Days. Absent Deduction = Absent Days × Daily Rate. Loan deductions are also applied automatically.' },
      { q: 'How do I issue a loan to an employee?', a: 'Go to HR → Loans → Issue Loan. Select the employee, enter loan amount, monthly deduction, and optionally link Level-4 accounts for automatic double-entry accounting.' },
      { q: 'How do I run payroll processing?', a: 'Go to HR → Payroll Processing. Select the date range and preview the payroll. You can add per-employee bonuses, then click Process to generate salary vouchers and post accounting entries.' },
      { q: 'How do I print a salary slip?', a: 'Go to HR → Salary Voucher. Select the employee and month/year, then click the Print button. A formatted payslip with all deductions and a signature section is generated.' },
    ],
  },
  {
    category: 'Accounts',
    icon: DollarSign,
    color: 'rose',
    items: [
      { q: 'What is the Chart of Accounts?', a: 'The Chart of Accounts is the master list of all financial accounts organized in a 4-level hierarchy: Level 1 (Category) → Level 2 (Group) → Level 3 (Sub-Group) → Level 4 (Ledger). Only Level 4 accounts can be used in transactions.' },
      { q: 'How do I post a journal entry?', a: 'Go to Accounts → Journal Voucher → New Entry. Add debit and credit lines (must balance to zero). Enter a description and date, then click Post. The account balances update instantly.' },
      { q: 'What is the difference between CPV and CRV?', a: 'CPV (Cash Payment Voucher) is for recording cash outflows (expenses, payments). CRV (Cash Receipt Voucher) is for recording cash inflows (collections, receipts). Both auto-post to the General Ledger.' },
      { q: 'How do I view a Profit & Loss report?', a: 'Go to Accounts → Profit & Loss. Select the date range. The report shows Revenue, Cost of Goods Sold, Gross Profit, Operating Expenses, and Net Profit/Loss.' },
      { q: 'How does the Trial Balance work?', a: 'The Trial Balance lists all accounts with their debit and credit totals. If the system is balanced, total debits equal total credits. Use the 6-Column version for Opening, Movement, and Closing balances.' },
    ],
  },
  {
    category: 'System & Settings',
    icon: Settings,
    color: 'gray',
    items: [
      { q: 'How do I change the currency symbol?', a: 'Go to System → Settings. In the General section, update the Currency Symbol field and save. It will reflect across all modules immediately.' },
      { q: 'How do I create a new user / staff role?', a: 'Go to System → Settings → User Management (if available for your plan). Roles and permissions control which modules each user can access.' },
      { q: 'How do I back up the data?', a: 'Go to System → Backup. Click "Create Backup" to export your database. Backups can be downloaded as SQL files for safekeeping.' },
      { q: 'How do I set up email notifications?', a: 'Go to System → Email Notifications. Enter your SMTP host, port, credentials, and sender email. Enable specific notification types (Low Stock, New Order, etc.) and test the connection.' },
      { q: 'What does the Audit Log show?', a: 'The Audit Log records every significant action — who created, edited, or deleted records, with timestamps and IP addresses. Access it at System → Audit Log.' },
    ],
  },
];

const shortcuts = [
  { keys: ['Ctrl', 'P'], action: 'Open POS' },
  { keys: ['Ctrl', 'N'], action: 'New transaction' },
  { keys: ['Escape'], action: 'Close modal' },
  { keys: ['Ctrl', 'S'], action: 'Save / Submit form' },
  { keys: ['Ctrl', 'B'], action: 'Create backup' },
  { keys: ['Ctrl', '/'], action: 'Open this help page' },
];

interface Ticket {
  ticket_id: number;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const STATUS_STYLES = {
  open:        { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Open' },
  in_progress: { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'In Progress' },
  resolved:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Resolved' },
  closed:      { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400',   label: 'Closed' },
};

const PRIORITY_STYLES = {
  low:    { bg: 'bg-slate-100',  text: 'text-slate-600',   label: 'Low' },
  medium: { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Medium' },
  high:   { bg: 'bg-orange-50',  text: 'text-orange-700',  label: 'High' },
  urgent: { bg: 'bg-red-50',     text: 'text-red-700',     label: 'Urgent' },
};

function TicketsSection() {
  const [tickets, setTickets]       = useState<Ticket[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded]     = useState<number | null>(null);
  const [form, setForm]             = useState({ subject: '', message: '', priority: 'medium' as Ticket['priority'] });
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const fetchTickets = () => {
    setLoading(true);
    api.get('/support-tickets')
      .then(r => setTickets(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.subject.trim() || !form.message.trim()) {
      setError('Subject and message are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/support-tickets', form);
      setSuccess('Ticket submitted! Our team will respond shortly.');
      setForm({ subject: '', message: '', priority: 'medium' });
      setShowForm(false);
      fetchTickets();
      setTimeout(() => setSuccess(''), 4000);
    } catch {
      setError('Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
            <LifeBuoy size={16} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">My Support Tickets</h3>
            <p className="text-xs text-gray-400">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''} submitted</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(''); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition"
        >
          {showForm ? <><X size={13} /> Cancel</> : <><Plus size={13} /> New Ticket</>}
        </button>
      </div>

      {/* Success banner */}
      {success && (
        <div className="mx-5 mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
          <CheckCircle size={15} className="flex-shrink-0" />
          {success}
        </div>
      )}

      {/* New Ticket Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 border-b border-gray-100 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject</label>
            <input
              type="text"
              placeholder="Brief description of your issue"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message</label>
            <textarea
              rows={4}
              placeholder="Describe your issue in detail — include steps to reproduce if applicable"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition resize-none"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as Ticket['priority'] }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex-1 flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : 'Submit Ticket'}
              </button>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}
        </form>
      )}

      {/* Ticket List */}
      <div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <LifeBuoy size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">No tickets yet</p>
            <p className="text-xs mt-1">Click "New Ticket" to contact support</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tickets.map(t => {
              const st = STATUS_STYLES[t.status];
              const pr = PRIORITY_STYLES[t.priority];
              const isOpen = expanded === t.ticket_id;
              return (
                <div key={t.ticket_id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : t.ticket_id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-800 truncate">{t.subject}</span>
                        <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${pr.bg} ${pr.text}`}>
                          {pr.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={11} />
                        {new Date(t.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="text-gray-300">·</span>
                        #{t.ticket_id}
                      </div>
                    </div>
                    {isOpen
                      ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" />
                      : <ChevronDown size={15} className="text-gray-300 flex-shrink-0" />
                    }
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 space-y-3">
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Message</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{t.message}</p>
                      </div>
                      {t.admin_notes && (
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Support Response</p>
                          <p className="text-sm text-emerald-800 leading-relaxed whitespace-pre-wrap">{t.admin_notes}</p>
                        </div>
                      )}
                      {t.resolved_at && (
                        <div className="flex items-center gap-2 text-xs text-emerald-600">
                          <CheckCircle size={13} />
                          Resolved on {new Date(t.resolved_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HelpSupport() {
  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState<string | null>(null);

  const filtered = faqs.map(cat => ({
    ...cat,
    items: cat.items.filter(
      i => !search || i.q.toLowerCase().includes(search.toLowerCase()) || i.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  const colorMap: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  icon: 'bg-purple-100 text-purple-600' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: 'bg-blue-100 text-blue-600' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    icon: 'bg-rose-100 text-rose-600' },
    gray:    { bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200',    icon: 'bg-gray-100 text-gray-600' },
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-3xl px-10 py-12 mb-10 shadow-2xl">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }} />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-teal-500/8 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center">
              <Zap size={16} className="text-emerald-400" />
            </div>
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Help Center</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">How can we help you?</h1>
          <p className="text-slate-400 text-sm mb-7">Search our documentation or browse topics below</p>
          <div className="relative max-w-xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search FAQs — e.g. 'how to process a return'"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-5 py-3.5 bg-white/10 border border-white/15 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-white/15 transition text-sm"
            />
          </div>
        </div>
      </div>

      {/* Support Tickets */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Support Tickets</h2>
        <TicketsSection />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {[
          { icon: BookOpen, label: 'Documentation', desc: 'Full user manual & guides', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { icon: Video, label: 'Video Tutorials', desc: 'Step-by-step walkthroughs', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { icon: FileText, label: 'Release Notes', desc: 'What\'s new in each update', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
        ].map(card => (
          <div key={card.label} className={`flex items-center gap-4 p-4 ${card.bg} border rounded-2xl cursor-pointer hover:shadow-md transition-all group`}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <card.icon size={20} className={card.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm">{card.label}</p>
              <p className="text-xs text-gray-500 truncate">{card.desc}</p>
            </div>
            <ArrowRight size={15} className="text-gray-300 group-hover:text-gray-500 transition flex-shrink-0" />
          </div>
        ))}
      </div>

      {/* FAQs */}
      <div className="space-y-6 mb-10">
        <h2 className="text-lg font-bold text-gray-900">Frequently Asked Questions</h2>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No results found for "{search}"</p>
            <p className="text-sm mt-1">Try different keywords or browse the categories below</p>
          </div>
        )}
        {filtered.map(cat => {
          const Icon = cat.icon;
          const c = colorMap[cat.color];
          return (
            <div key={cat.category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className={`flex items-center gap-3 px-5 py-4 ${c.bg} border-b ${c.border}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.icon}`}>
                  <Icon size={16} />
                </div>
                <h3 className={`font-bold text-sm ${c.text}`}>{cat.category}</h3>
                <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${c.icon}`}>{cat.items.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {cat.items.map((item, i) => {
                  const key = `${cat.category}-${i}`;
                  const open = openItem === key;
                  return (
                    <div key={i}>
                      <button
                        onClick={() => setOpenItem(open ? null : key)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/80 transition-colors group"
                      >
                        <span className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 pr-4">{item.q}</span>
                        {open
                          ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                          : <ChevronDown size={16} className="text-gray-300 flex-shrink-0 group-hover:text-gray-400" />
                        }
                      </button>
                      {open && (
                        <div className="px-5 pb-5 -mt-1">
                          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">{item.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
            <Keyboard size={16} className="text-gray-600" />
          </div>
          <h3 className="font-bold text-gray-900">Keyboard Shortcuts</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {shortcuts.map(s => (
            <div key={s.action} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1">
                {s.keys.map(k => (
                  <kbd key={k} className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 shadow-sm">{k}</kbd>
                ))}
              </div>
              <span className="text-xs text-gray-600">{s.action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
            <MessageCircle size={20} className="text-white" />
          </div>
          <h3 className="font-bold text-base mb-1">Live Chat</h3>
          <p className="text-emerald-100 text-sm mb-4">Get instant help from our support team during business hours.</p>
          <button className="flex items-center gap-2 bg-white text-emerald-700 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-50 transition">
            Start Chat <ArrowRight size={14} />
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <Mail size={20} className="text-gray-600" />
          </div>
          <h3 className="font-bold text-base text-gray-900 mb-1">Email Support</h3>
          <p className="text-gray-500 text-sm mb-4">Send us a detailed message and we'll respond within 24 hours.</p>
          <a
            href="mailto:support@abyte.app"
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-800 transition"
          >
            support@abyte.app <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
