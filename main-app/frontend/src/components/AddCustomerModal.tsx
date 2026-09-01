import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, User, Phone, MapPin, Mail, Building2, CreditCard, UserPlus, Edit3 } from 'lucide-react';
import api from '../utils/api';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer?: any) => void;
  customerToEdit?: {
    customer_id: number;
    customer_name: string;
    phone_number: string;
    email?: string;
    address?: string;
    company?: string;
    tax_id?: string;
  } | null;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, onSuccess, customerToEdit }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [company, setCompany] = useState('');
  const [taxId, setTaxId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    email: false
  });

  useEffect(() => {
    if (isOpen) {
      setError('');
      setTouched({ name: false, phone: false, email: false });
      if (customerToEdit) {
        setName(customerToEdit.customer_name);
        setPhone(customerToEdit.phone_number || '');
        setEmail(customerToEdit.email || '');
        setAddress(customerToEdit.address || '');
        setCompany(customerToEdit.company || '');
        setTaxId(customerToEdit.tax_id || '');
      } else {
        setName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setCompany('');
        setTaxId('');
      }
    }
  }, [isOpen, customerToEdit]);

  // Validation
  const validateEmail = (email: string) => {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^[\d\s+\-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  };

  const isFormValid = () => {
    return name.trim().length > 0 && 
           (!email || validateEmail(email)) && 
           (!phone || validatePhone(phone));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      setError('Please fix validation errors before submitting');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (customerToEdit) {
        const res = await api.put(`/customers/${customerToEdit.customer_id}`, {
          customer_name: name,
          phone_number: phone || undefined,
          email: email || undefined,
          address: address || undefined,
          company: company || undefined,
          tax_id: taxId || undefined
        });
        onSuccess(res.data.customer || res.data);
      } else {
        const res = await api.post('/customers', {
          customer_name: name,
          phone_number: phone || undefined,
          email: email || undefined,
          address: address || undefined,
          company: company || undefined,
          tax_id: taxId || undefined
        });
        onSuccess(res.data.customer || res.data);
      }
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save customer';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200">
        {/* Header */}
        <div className="p-6 border-b-2 border-gray-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shadow-lg ${
                customerToEdit 
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' 
                  : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
              }`}>
                {customerToEdit ? <Edit3 size={24} className="text-white" /> : <UserPlus size={24} className="text-white" />}
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  {customerToEdit ? 'Edit Customer' : 'Add New Customer'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {customerToEdit ? 'Update customer information' : 'Fill in the details below'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all duration-200"
            >
              <X size={28} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {error && (
            <div className="mb-5 p-4 bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-2 border-red-200 rounded-xl text-sm font-medium flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2 duration-300">
              <span className="text-red-600 text-lg">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Customer Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <User size={16} className="text-emerald-600" />
                Customer Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched({ ...touched, name: true })}
                  className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm ${
                    touched.name && !name.trim() ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                  placeholder="Enter customer name"
                />
              </div>
              {touched.name && !name.trim() && (
                <p className="text-red-500 text-xs mt-1.5 ml-1 flex items-center gap-1">
                  <span>⚠️</span> Customer name is required
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Phone size={16} className="text-emerald-600" />
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setTouched({ ...touched, phone: true })}
                  className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm ${
                    touched.phone && phone && !validatePhone(phone) ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                  placeholder="+1 (234) 567-8900"
                />
              </div>
              {touched.phone && phone && !validatePhone(phone) && (
                <p className="text-red-500 text-xs mt-1.5 ml-1 flex items-center gap-1">
                  <span>⚠️</span> Enter a valid phone number
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Mail size={16} className="text-emerald-600" />
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched({ ...touched, email: true })}
                  className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm ${
                    touched.email && email && !validateEmail(email) ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                  placeholder="customer@email.com"
                />
              </div>
              {touched.email && email && !validateEmail(email) && (
                <p className="text-red-500 text-xs mt-1.5 ml-1 flex items-center gap-1">
                  <span>⚠️</span> Enter a valid email address
                </p>
              )}
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Building2 size={16} className="text-emerald-600" />
                Company Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm bg-white"
                  placeholder="ABC Corporation"
                />
              </div>
            </div>

            {/* Tax ID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <CreditCard size={16} className="text-orange-600" />
                Tax ID / Business ID
              </label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all shadow-sm bg-white"
                  placeholder="XX-XXXXXXX"
                />
              </div>
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={16} className="text-red-600" />
                Complete Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 text-gray-400" size={20} />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none h-24 transition-all shadow-sm bg-white"
                  placeholder="Street address, City, State, ZIP code"
                />
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-5 p-4 bg-gradient-to-r from-emerald-50 to-emerald-50 border-2 border-emerald-200 rounded-xl">
            <p className="text-sm text-emerald-800 flex items-start gap-2">
              <span className="text-lg">💡</span>
              <span>
                <strong>Note:</strong> Only the customer name is required. All other fields are optional and can be filled later.
              </span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-5 border-t-2 border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 border-2 border-gray-200 hover:border-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid()}
              className={`flex-1 px-6 py-3 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
                customerToEdit
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white disabled:from-gray-400 disabled:to-gray-500'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white disabled:from-gray-400 disabled:to-gray-500'
              } disabled:cursor-not-allowed disabled:shadow-none`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>{customerToEdit ? 'Update Customer' : 'Save Customer'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;