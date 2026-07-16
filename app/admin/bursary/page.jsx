import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  CreditCard, 
  DollarSign, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Layers, 
  Receipt,
  Download,
  X
} from 'lucide-react';

// INITIAL MOCK DATA
const INITIAL_STUDENTS = [
  { id: '1', name: 'Amina Bello', class: 'SSS 3', billed: 150000, paid: 150000, status: 'Fully Paid' },
  { id: '2', name: 'Chinedu Okafor', class: 'SSS 3', billed: 150000, paid: 90000, status: 'Partially Paid' },
  { id: '3', name: 'Emeka Nwosu', class: 'SSS 2', billed: 140000, paid: 0, status: 'Overdue' },
  { id: '4', name: 'Fatima Abubakar', class: 'SSS 1', billed: 140000, paid: 140000, status: 'Fully Paid' },
  { id: '5', name: 'Tunde Bakare', class: 'JSS 3', billed: 120000, paid: 80000, status: 'Partially Paid' },
  { id: '6', name: 'Sarah John', class: 'JSS 3', billed: 120000, paid: 120000, status: 'Fully Paid' },
  { id: '7', name: 'David Chiang', class: 'JSS 2', billed: 110000, paid: 40000, status: 'Partially Paid' },
  { id: '8', name: 'Grace Joshua', class: 'JSS 1', billed: 110000, paid: 0, status: 'Overdue' },
  { id: '9', name: 'Yusuf Ibrahim', class: 'JSS 1', billed: 110000, paid: 110000, status: 'Fully Paid' },
  { id: '10', name: 'Blessing Ekong', class: 'SSS 2', billed: 140000, paid: 50000, status: 'Partially Paid' },
];

const FEE_TEMPLATES = [
  { id: 't1', name: 'Tuition Fee (Senior Sec)', amount: 100000, category: 'Academic', description: 'Termly tuition fee for SSS 1-3' },
  { id: 't2', name: 'Tuition Fee (Junior Sec)', amount: 80000, category: 'Academic', description: 'Termly tuition fee for JSS 1-3' },
  { id: 't3', name: 'Termly Examination Fee', amount: 20000, category: 'Assessment', description: 'Covers printing of exam sheets and materials' },
  { id: 't4', name: 'School Uniform Pack', amount: 20000, category: 'Utility', description: 'Includes 2 sets of day wear and 1 sportswear' },
  { id: 't5', name: 'ICT & Lab Levy', amount: 10000, category: 'Infrastructure', description: 'Internet and computer lab maintenance fee' },
];

export default function BursaryDashboard() {
  const [activeTab, setActiveTab] = useState('billing'); // 'billing' | 'templates'
  const [students, setStudents] = useState(INITIAL_STUDENTS);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');

  // Classes list for filtering
  const classesList = ['All', 'JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'];

  // Global Financial Analytics derived from live state
  const metrics = useMemo(() => {
    const totalBilled = students.reduce((sum, s) => sum + s.billed, 0);
    const totalCollected = students.reduce((sum, s) => sum + s.paid, 0);
    const outstanding = totalBilled - totalCollected;
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
    return { totalBilled, totalCollected, outstanding, collectionRate };
  }, [students]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = selectedClass === 'All' || student.class === selectedClass;
      const matchesStatus = selectedStatus === 'All' || student.status === selectedStatus;
      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [students, searchTerm, selectedClass, selectedStatus]);

  // Handle Payment Form Submission
  const handleRecordPayment = (e) => {
    e.preventDefault();
    if (!selectedStudentForPayment || !paymentAmount || parseFloat(paymentAmount) <= 0) return;

    const amountToApply = parseFloat(paymentAmount);
    
    setStudents(prevStudents => 
      prevStudents.map(student => {
        if (student.id === selectedStudentForPayment.id) {
          const newPaid = student.paid + amountToApply;
          const remaining = student.billed - newPaid;
          let newStatus = 'Partially Paid';
          if (remaining <= 0) newStatus = 'Fully Paid';
          if (newPaid === 0) newStatus = 'Overdue';
          
          return {
            ...student,
            paid: Math.min(newPaid, student.billed), // Don't overpay beyond billed amount in this basic UI
            status: newStatus
          };
        }
        return student;
      })
    );

    // Reset and Close
    setPaymentModalOpen(false);
    setSelectedStudentForPayment(null);
    setPaymentAmount('');
  };

  const openPaymentModal = (student) => {
    setSelectedStudentForPayment(student);
    const maxPayable = student.billed - student.paid;
    setPaymentAmount(maxPayable.toString());
    setPaymentModalOpen(true);
  };

  // Helper to format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      
      {/* Header Panel */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bursary Management</h1>
          <p className="text-sm text-slate-500">Track collections, billings, templates, and student balances.</p>
        </div>
        
        {/* Tab Toggle Switch (Shadcn style) */}
        <div className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-200 p-1 text-slate-500">
          <button 
            onClick={() => setActiveTab('billing')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none ${activeTab === 'billing' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <Receipt className="mr-2 h-4 w-4" /> Student Billing
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none ${activeTab === 'templates' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <Layers className="mr-2 h-4 w-4" /> Fee Templates
          </button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Total Billed */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-slate-500">Total Receivables</span>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold">{formatCurrency(metrics.totalBilled)}</div>
          <p className="text-xs text-slate-400 mt-1">Sum of all billed templates</p>
        </div>

        {/* Total Collected */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-slate-500">Total Revenue Collected</span>
            <div className="rounded-full bg-emerald-50 p-1 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(metrics.totalCollected)}</div>
          <p className="text-xs text-slate-400 mt-1">Confirmed payments received</p>
        </div>

        {/* Outstanding Debt */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-slate-500">Outstanding Arrears</span>
            <div className="rounded-full bg-rose-50 p-1 text-rose-600">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600">{formatCurrency(metrics.outstanding)}</div>
          <p className="text-xs text-slate-400 mt-1">Uncollected school funds</p>
        </div>

        {/* Collection Efficiency */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-slate-500">Collection Efficiency</span>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{metrics.collectionRate}%</div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${metrics.collectionRate}%` }}></div>
          </div>
        </div>
      </div>

      {/* Main Interactive Workspaces */}
      {activeTab === 'billing' ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          
          {/* Controls Bar */}
          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Search student ledger..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Class Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Class:</span>
                <select 
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 outline-none hover:border-slate-300"
                >
                  {classesList.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status:</span>
                <select 
                  value={selectedStatus} 
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 outline-none hover:border-slate-300"
                >
                  <option value="All">All Statuses</option>
                  <option value="Fully Paid">Fully Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              {/* Reset Filters button */}
              {(searchTerm || selectedClass !== 'All' || selectedStatus !== 'All') && (
                <button 
                  onClick={() => { setSearchTerm(''); setSelectedClass('All'); setSelectedStatus('All'); }}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Student Billing Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Class Group</th>
                  <th className="px-6 py-4 text-right">Total Billed</th>
                  <th className="px-6 py-4 text-right">Amount Paid</th>
                  <th className="px-6 py-4 text-right">Balance Due</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
                    const balance = student.billed - student.paid;
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Student Name */}
                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">
                          {student.name}
                        </td>
                        
                        {/* Student Class */}
                        <td className="whitespace-nowrap px-6 py-4 text-slate-500 font-medium">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                            {student.class}
                          </span>
                        </td>
                        
                        {/* Total Billed */}
                        <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-slate-700">
                          {formatCurrency(student.billed)}
                        </td>
                        
                        {/* Amount Paid */}
                        <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-emerald-600">
                          {formatCurrency(student.paid)}
                        </td>
                        
                        {/* Balance Due */}
                        <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-900">
                          {balance === 0 ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <span className={balance > 50000 ? 'text-rose-600' : 'text-slate-700'}>
                              {formatCurrency(balance)}
                            </span>
                          )}
                        </td>
                        
                        {/* Status Badge */}
                        <td className="whitespace-nowrap px-6 py-4 text-center">
                          {student.status === 'Fully Paid' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Fully Paid
                            </span>
                          )}
                          {student.status === 'Partially Paid' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                              <Clock className="h-3.5 w-3.5" /> Partially Paid
                            </span>
                          )}
                          {student.status === 'Overdue' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
                              <AlertCircle className="h-3.5 w-3.5" /> Overdue
                            </span>
                          )}
                        </td>

                        {/* Actions button */}
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <button 
                            disabled={balance === 0}
                            onClick={() => openPaymentModal(student)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                              balance === 0 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                          >
                            <CreditCard className="h-3 w-3" /> Record Payment
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      No matching student ledger logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Total Ledger Footer Summary */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 text-sm font-medium text-slate-500">
            <span>Showing {filteredStudents.length} of {students.length} Student ledgers</span>
            <span>Uncollected Class Balance: <b className="text-slate-950 font-bold">{formatCurrency(metrics.outstanding)}</b></span>
          </div>
        </div>
      ) : (
        // FEE TEMPLATES WORKSPACE
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Standard School Templates</h2>
              <p className="text-sm text-slate-500">Preconfigured line-item fees applied recursively to classes.</p>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-all">
              <Plus className="h-4 w-4" /> Create New Template
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEE_TEMPLATES.map((fee) => (
              <div key={fee.id} className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition-all">
                <div className="mb-4 flex items-start justify-between">
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    {fee.category}
                  </span>
                  <span className="text-xl font-bold text-slate-900">{formatCurrency(fee.amount)}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{fee.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">{fee.description}</p>
                <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-xs font-semibold text-slate-400">
                  <span>Standard Recurring Charge</span>
                  <button className="text-indigo-600 hover:text-indigo-800">Edit Settings</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECORD PAYMENT FLOATING MODAL */}
      {paymentModalOpen && selectedStudentForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-600" /> Confirm payment receipt
              </h3>
              <button 
                onClick={() => setPaymentModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form body */}
            <form onSubmit={handleRecordPayment} className="p-6">
              <div className="space-y-4">
                
                {/* Student Info Recap */}
                <div className="rounded-lg bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between font-semibold text-slate-900 mb-1">
                    <span>{selectedStudentForPayment.name}</span>
                    <span>{selectedStudentForPayment.class}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Total Billed: {formatCurrency(selectedStudentForPayment.billed)}</span>
                    <span>Unpaid: {formatCurrency(selectedStudentForPayment.billed - selectedStudentForPayment.paid)}</span>
                  </div>
                </div>

                {/* Amount input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Payment Amount (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      ₦
                    </span>
                    <input 
                      type="number"
                      required
                      max={selectedStudentForPayment.billed - selectedStudentForPayment.paid}
                      placeholder="Enter amount to pay"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-8 pr-4 text-sm font-semibold outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                </div>

                {/* Payment channel selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Transaction Method
                  </label>
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                  >
                    <option value="Bank Transfer">Direct Bank Transfer</option>
                    <option value="Cash">Cash Officer Payment</option>
                    <option value="POS">POS Terminal Transaction</option>
                  </select>
                </div>

              </div>

              {/* Action Actions */}
              <div className="mt-6 flex gap-3 border-t border-slate-100 pt-4">
                <button 
                  type="button" 
                  onClick={() => setPaymentModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md"
                >
                  Record Payment
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}