/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Trash2, 
  Calendar, 
  Search,
  Filter,
  Tag, 
  ArrowUpRight, 
  ArrowDownLeft,
  PieChart as PieChartIcon,
  LayoutDashboard,
  Menu,
  X,
  Settings,
  Users,
  CreditCard,
  Layers,
  Clock,
  HandCoins,
  Bell,
  Sparkles,
  Loader2,
  Database,
  Download,
  FileUp,
  FileText,
  FileCode,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type TransactionType = 'income' | 'expense' | 'opening balance' | 'to give' | 'to get' | 'gave' | 'got';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  subcategory: string;
  party: string;
  account: string;
  mode: string;
  date: string;
  description: string;
  notes: string;
}

interface Loan {
  id: string;
  name: string;
  totalAmount: number;
  emiAmount: number;
  totalEmis: number;
  paidEmis: number;
  startDate: string;
  nextDueDate: string;
  isAutoPay: boolean;
  party: string;
  account: string;
  category: string;
}

type SubscriptionFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'manual';

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: SubscriptionFrequency;
  startDate: string;
  nextDueDate: string;
  account: string;
  mode: string;
  category: string;
  party: string;
  description: string;
  isAutoPay: boolean;
  specificDay?: number; // for monthly, e.g., 5th of every month
}

const DEFAULT_CATEGORIES: Record<TransactionType, Record<string, string[]>> = {
  income: {
    'Salary': ['Base Pay', 'Bonus', 'Overtime'],
    'Freelance': ['Project', 'Consulting'],
    'Gift': ['Birthday', 'Festival', 'Other'],
    'Investment': ['Dividends', 'Interest', 'Capital Gains'],
    'Other': ['Misc']
  },
  expense: {
    'Food': ['Groceries', 'Dining Out', 'Snacks'],
    'Transport': ['Fuel', 'Public Transport', 'Maintenance'],
    'Rent': ['Monthly Rent', 'Security Deposit'],
    'Utilities': ['Electricity', 'Water', 'Internet', 'Mobile'],
    'Entertainment': ['Movies', 'Games', 'Streaming'],
    'Shopping': ['Clothes', 'Electronics', 'Home'],
    'Health': ['Medicine', 'Doctor', 'Gym'],
    'Other': ['Misc']
  },
  'opening balance': {
    'Initial': ['Cash', 'Bank', 'Wallet'],
    'Adjustment': ['Correction']
  },
  'to give': {
    'Loan': ['Personal', 'Business'],
    'Debt': ['Credit Card', 'Friend'],
    'Other': ['Misc']
  },
  'to get': {
    'Loan': ['Personal', 'Business'],
    'Credit': ['Customer', 'Friend'],
    'Other': ['Misc']
  },
  'gave': {
    'Repayment': ['Loan', 'Debt'],
    'Lending': ['Personal', 'Business'],
    'Other': ['Misc']
  },
  'got': {
    'Recovery': ['Loan', 'Credit'],
    'Borrowing': ['Personal', 'Business'],
    'Other': ['Misc']
  }
};

const DEFAULT_ACCOUNTS = ['Cash', 'Savings Account', 'Credit Card', 'Digital Wallet'];
const DEFAULT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];
const DEFAULT_PARTIES = ['Self', 'Family', 'Friends', 'Vendor'];

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const TRANSACTION_CONFIG: Record<TransactionType, { color: string, icon: any, label: string, sign: string }> = {
  income: { color: 'text-emerald-600', icon: ArrowUpRight, label: 'Income', sign: '+' },
  expense: { color: 'text-rose-600', icon: ArrowDownLeft, label: 'Expense', sign: '-' },
  'opening balance': { color: 'text-blue-600', icon: Wallet, label: 'Opening Balance', sign: '+' },
  'to give': { color: 'text-amber-600', icon: Clock, label: 'To Give', sign: '' },
  'to get': { color: 'text-blue-600', icon: Clock, label: 'To Get', sign: '' },
  gave: { color: 'text-rose-600', icon: ArrowDownLeft, label: 'Gave', sign: '-' },
  got: { color: 'text-emerald-600', icon: ArrowUpRight, label: 'Got', sign: '+' }
};

const TRANSACTION_BG: Record<TransactionType, string> = {
  income: 'bg-emerald-50',
  expense: 'bg-rose-50',
  'opening balance': 'bg-blue-50',
  'to give': 'bg-amber-50',
  'to get': 'bg-blue-50',
  gave: 'bg-rose-50',
  got: 'bg-emerald-50'
};

// --- Components ---

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('petty_cash_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [party, setParty] = useState('');
  const [account, setAccount] = useState('');
  const [mode, setMode] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'insights' | 'entry' | 'settings' | 'loans' | 'backup'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);

  // --- Filtering State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');

  // --- AI State ---
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');

  // --- Bulk Edit State ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<{
    category?: string;
    subcategory?: string;
    date?: string;
    account?: string;
    mode?: string;
    party?: string;
  }>({});

  // --- Manageable Data State ---
  const [categories, setCategories] = useState<Record<TransactionType, Record<string, string[]>>>(() => {
    const saved = localStorage.getItem('petty_cash_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  const [accounts, setAccounts] = useState<string[]>(() => {
    const saved = localStorage.getItem('petty_cash_accounts');
    return saved ? JSON.parse(saved) : DEFAULT_ACCOUNTS;
  });
  const [modes, setModes] = useState<string[]>(() => {
    const saved = localStorage.getItem('petty_cash_modes');
    return saved ? JSON.parse(saved) : DEFAULT_MODES;
  });
  const [parties, setParties] = useState<string[]>(() => {
    const saved = localStorage.getItem('petty_cash_parties');
    return saved ? JSON.parse(saved) : DEFAULT_PARTIES;
  });

  // --- Loan State ---
  const [loans, setLoans] = useState<Loan[]>(() => {
    const saved = localStorage.getItem('petty_cash_loans');
    return saved ? JSON.parse(saved) : [];
  });

  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    const saved = localStorage.getItem('petty_cash_subscriptions');
    return saved ? JSON.parse(saved) : [];
  });

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'entry', label: 'Add Entry', icon: Plus },
    { id: 'loans', label: 'Loans/EMI', icon: HandCoins },
    { id: 'history', label: 'History', icon: Calendar },
    { id: 'insights', label: 'Insights', icon: PieChartIcon },
    { id: 'settings', label: 'Manage Data', icon: Settings },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
  ];

  useEffect(() => {
    localStorage.setItem('petty_cash_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('petty_cash_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('petty_cash_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('petty_cash_modes', JSON.stringify(modes));
  }, [modes]);

  useEffect(() => {
    localStorage.setItem('petty_cash_parties', JSON.stringify(parties));
  }, [parties]);

  useEffect(() => {
    localStorage.setItem('petty_cash_loans', JSON.stringify(loans));
  }, [loans]);

  useEffect(() => {
    localStorage.setItem('petty_cash_subscriptions', JSON.stringify(subscriptions));
  }, [subscriptions]);

  const stats = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income' || t.type === 'got')
      .reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions
      .filter(t => t.type === 'expense' || t.type === 'gave')
      .reduce((acc, t) => acc + t.amount, 0);
    const openingBalance = transactions
      .filter(t => t.type === 'opening balance')
      .reduce((acc, t) => acc + t.amount, 0);
    const toGive = transactions
      .filter(t => t.type === 'to give')
      .reduce((acc, t) => acc + t.amount, 0);
    const toGet = transactions
      .filter(t => t.type === 'to get')
      .reduce((acc, t) => acc + t.amount, 0);

    return {
      income,
      expenses,
      openingBalance,
      toGive,
      toGet,
      balance: openingBalance + income - expenses
    };
  }, [transactions]);

  const partyBalances = useMemo(() => {
    const balances: Record<string, { toGive: number, toGet: number }> = {};
    
    // Initialize with all existing parties
    parties.forEach(p => {
      balances[p] = { toGive: 0, toGet: 0 };
    });

    transactions.forEach(t => {
      if (!t.party) return;
      if (!balances[t.party]) {
        balances[t.party] = { toGive: 0, toGet: 0 };
      }

      if (t.type === 'to give') balances[t.party].toGive += t.amount;
      if (t.type === 'gave') balances[t.party].toGive -= t.amount;
      if (t.type === 'to get') balances[t.party].toGet += t.amount;
      if (t.type === 'got') balances[t.party].toGet -= t.amount;
    });

    return Object.entries(balances)
      .map(([name, balance]) => ({ name, ...balance }))
      .filter(p => p.toGive !== 0 || p.toGet !== 0);
  }, [transactions, parties]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = 
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.party || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subcategory.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !filterCategory || t.category === filterCategory;
      
      const transactionDate = parseISO(t.date);
      const matchesStartDate = !startDate || transactionDate >= parseISO(startDate);
      const matchesEndDate = !endDate || transactionDate <= parseISO(endDate);
      const matchesType = filterType === 'all' || t.type === filterType;
      
      return matchesSearch && matchesCategory && matchesStartDate && matchesEndDate && matchesType;
    });
  }, [transactions, searchQuery, filterCategory, startDate, endDate, filterType]);

  const chartData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return format(d, 'MMM');
    }).reverse();

    return last6Months.map(month => {
      const monthTransactions = transactions.filter(t => format(parseISO(t.date), 'MMM') === month);
      return {
        name: month,
        income: monthTransactions.filter(t => t.type === 'income' || t.type === 'got' || t.type === 'opening balance').reduce((acc, t) => acc + t.amount, 0),
        expense: monthTransactions.filter(t => t.type === 'expense' || t.type === 'gave').reduce((acc, t) => acc + t.amount, 0),
      };
    });
  }, [transactions]);

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense' || t.type === 'gave')
      .forEach(t => {
        data[t.category] = (data[t.category] || 0) + t.amount;
      });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      type,
      amount: parseFloat(amount),
      category,
      subcategory,
      party,
      account,
      mode,
      date,
      description,
      notes
    };

    setTransactions([newTransaction, ...transactions]);
    setAmount('');
    setDescription('');
    setCategory('');
    setSubcategory('');
    setParty('');
    setAccount('');
    setMode('');
    setNotes('');
    setShowEntryForm(false);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelection = () => {
    const allVisibleSelected = filteredTransactions.every(t => selectedIds.has(t.id));
    if (allVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredTransactions.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredTransactions.forEach(t => next.add(t.id));
        return next;
      });
    }
  };

  const handleBulkEdit = () => {
    if (selectedIds.size === 0) return;
    
    setTransactions(prev => prev.map(t => {
      if (selectedIds.has(t.id)) {
        return {
          ...t,
          ...(bulkEditData.category ? { category: bulkEditData.category } : {}),
          ...(bulkEditData.subcategory ? { subcategory: bulkEditData.subcategory } : {}),
          ...(bulkEditData.date ? { date: bulkEditData.date } : {}),
          ...(bulkEditData.account ? { account: bulkEditData.account } : {}),
          ...(bulkEditData.mode ? { mode: bulkEditData.mode } : {}),
          ...(bulkEditData.party ? { party: bulkEditData.party } : {}),
        };
      }
      return t;
    }));
    
    setSelectedIds(new Set());
    setShowBulkEditModal(false);
    setBulkEditData({});
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} transactions?`)) {
      setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    }
  };

  const payEMI = (loan: Loan) => {
    if (loan.paidEmis >= loan.totalEmis) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      type: 'expense',
      amount: loan.emiAmount,
      category: loan.category || 'Loan/EMI',
      subcategory: 'EMI Payment',
      party: loan.party,
      account: loan.account,
      mode: 'Auto Pay',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: `EMI Payment for ${loan.name} (${loan.paidEmis + 1}/${loan.totalEmis})`,
      notes: `Loan ID: ${loan.id}`
    };

    setTransactions([newTransaction, ...transactions]);
    
    // Update loan status
    const nextDate = new Date(loan.nextDueDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    
    setLoans(loans.map(l => l.id === loan.id ? {
      ...l,
      paidEmis: l.paidEmis + 1,
      nextDueDate: format(nextDate, 'yyyy-MM-dd')
    } : l));
  };

  const addLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const newLoan: Loan = {
      id: crypto.randomUUID(),
      name: formData.get('name') as string,
      totalAmount: parseFloat(formData.get('totalAmount') as string),
      emiAmount: parseFloat(formData.get('emiAmount') as string),
      totalEmis: parseInt(formData.get('totalEmis') as string),
      paidEmis: parseInt(formData.get('paidEmis') as string) || 0,
      startDate: formData.get('startDate') as string,
      nextDueDate: formData.get('nextDueDate') as string,
      isAutoPay: formData.get('isAutoPay') === 'on',
      party: formData.get('party') as string,
      account: formData.get('account') as string,
      category: formData.get('category') as string,
    };

    setLoans([...loans, newLoan]);
    (e.target as HTMLFormElement).reset();
    setShowLoanForm(false);
  };

  const deleteLoan = (id: string) => {
    setLoans(loans.filter(l => l.id !== id));
  };

  const addSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const newSubscription: Subscription = {
      id: crypto.randomUUID(),
      name: formData.get('name') as string,
      amount: parseFloat(formData.get('amount') as string),
      frequency: formData.get('frequency') as SubscriptionFrequency,
      startDate: formData.get('startDate') as string,
      nextDueDate: formData.get('nextDueDate') as string,
      account: formData.get('account') as string,
      mode: formData.get('mode') as string,
      category: formData.get('category') as string,
      party: formData.get('party') as string,
      description: formData.get('description') as string,
      isAutoPay: formData.get('isAutoPay') === 'on',
      specificDay: formData.get('specificDay') ? parseInt(formData.get('specificDay') as string) : undefined,
    };

    setSubscriptions([...subscriptions, newSubscription]);
    (e.target as HTMLFormElement).reset();
    setShowSubscriptionForm(false);
  };

  const deleteSubscription = (id: string) => {
    setSubscriptions(subscriptions.filter(s => s.id !== id));
  };

  const paySubscription = (sub: Subscription) => {
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      type: 'expense',
      amount: sub.amount,
      category: sub.category || 'Subscription',
      subcategory: 'Recurring Payment',
      party: sub.party,
      account: sub.account,
      mode: sub.mode || 'Auto Pay',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: `Subscription Payment: ${sub.name}`,
      notes: `Subscription ID: ${sub.id}`
    };

    setTransactions([newTransaction, ...transactions]);
    
    // Update next due date based on frequency
    const nextDate = new Date(sub.nextDueDate);
    if (sub.frequency === 'daily') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (sub.frequency === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (sub.frequency === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
      if (sub.specificDay) {
        // Ensure the day exists in the next month
        const lastDayOfNextMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(sub.specificDay, lastDayOfNextMonth));
      }
    } else if (sub.frequency === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else if (sub.frequency === 'manual') {
      // For manual, we just keep the same date or set it to today?
      // Let's just keep it as is or move it forward by a month as a default
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    
    setSubscriptions(subscriptions.map(s => s.id === sub.id ? {
      ...s,
      nextDueDate: format(nextDate, 'yyyy-MM-dd')
    } : s));
  };

  const handleAISearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsAIProcessing(true);
    setAiExplanation('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this user request for a petty cash tracker: "${aiPrompt}". 
        Current date is ${format(new Date(), 'yyyy-MM-dd')}.
        Available categories: ${JSON.stringify(categories)}.
        
        Return a JSON object with:
        1. "filter": { "type": "income"|"expense"|"all", "category": string, "searchQuery": string, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }
        2. "explanation": A short sentence explaining what you filtered.
        
        If the user asks for something like "show my food expenses this month", set type to "expense", category to "Food", and date range accordingly.
        If they ask for "income from last week", set type to "income" and date range.
        
        Only return the JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              filter: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  category: { type: Type.STRING },
                  searchQuery: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING }
                }
              },
              explanation: { type: Type.STRING }
            },
            required: ["explanation"]
          }
        }
      });

      const result = JSON.parse(response.text);
      
      if (result.filter) {
        if (result.filter.type) setFilterType(result.filter.type as any);
        if (result.filter.searchQuery !== undefined) setSearchQuery(result.filter.searchQuery);
        if (result.filter.category !== undefined) setFilterCategory(result.filter.category);
        if (result.filter.startDate !== undefined) setStartDate(result.filter.startDate);
        if (result.filter.endDate !== undefined) setEndDate(result.filter.endDate);
        
        // Switch to history tab to show results
        setActiveTab('history');
      }
      
      setAiExplanation(result.explanation);
    } catch (error) {
      console.error("AI Search Error:", error);
      setAiExplanation("Sorry, I couldn't process that request.");
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleBackup = () => {
    const data = {
      transactions,
      categories,
      accounts,
      modes,
      parties,
      loans
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ATTUZ petty account _(backuped dat).json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.transactions) setTransactions(data.transactions);
        if (data.categories) setCategories(data.categories);
        if (data.accounts) setAccounts(data.accounts);
        if (data.modes) setModes(data.modes);
        if (data.parties) setParties(data.parties);
        if (data.loans) setLoans(data.loans);
        alert('Data restored successfully!');
      } catch (err) {
        alert('Failed to restore data. Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToXML = (data: any[], rootName: string, itemName: string, filename: string) => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n`;
    data.forEach(item => {
      xml += `  <${itemName}>\n`;
      Object.entries(item).forEach(([key, value]) => {
        xml += `    <${key}>${value}</${key}>\n`;
      });
      xml += `  </${itemName}>\n`;
    });
    xml += `</${rootName}>`;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportTransactionsPDF = (data: Transaction[] = transactions) => {
    const doc = new jsPDF();
    doc.text("Transaction History", 14, 15);
    const tableData = data.map(t => [
      format(parseISO(t.date), 'MMM d, yyyy'),
      t.type,
      t.category,
      t.subcategory,
      t.party || '-',
      t.account,
      t.mode,
      `$${t.amount.toFixed(2)}`
    ]);
    autoTable(doc, {
      head: [['Date', 'Type', 'Category', 'Subcategory', 'Party', 'Account', 'Mode', 'Amount']],
      body: tableData,
      startY: 20,
    });
    doc.save("transactions.pdf");
  };

  const exportLoansPDF = (data: Loan[] = loans) => {
    const doc = new jsPDF();
    doc.text("Loans & EMIs", 14, 15);
    const tableData = data.map(l => [
      l.name,
      l.party,
      `$${l.totalAmount.toFixed(2)}`,
      `$${l.emiAmount.toFixed(2)}`,
      `${l.paidEmis}/${l.totalEmis}`,
      l.nextDueDate
    ]);
    autoTable(doc, {
      head: [['Name', 'Party', 'Total', 'EMI', 'Paid/Total', 'Next Due']],
      body: tableData,
      startY: 20,
    });
    doc.save("loans.pdf");
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 bg-white border-r border-zinc-200 transition-all duration-300 ease-in-out md:relative",
        isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64 md:translate-x-0 md:w-20",
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 shrink-0">
              <Wallet size={20} />
            </div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1">
                <h1 className="text-xl font-bold tracking-tight text-zinc-900">PettyCash</h1>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Tracker</p>
              </motion.div>
            )}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 text-zinc-400 hover:bg-zinc-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            {navItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                  activeTab === tab.id 
                    ? "bg-emerald-50 text-emerald-600" 
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <tab.icon size={20} className={cn(
                  "shrink-0",
                  activeTab === tab.id ? "text-emerald-600" : "text-zinc-400 group-hover:text-zinc-600"
                )} />
                {isSidebarOpen && <span>{tab.label}</span>}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-100">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-zinc-100 text-zinc-400"
            >
              {isSidebarOpen ? <ArrowDownLeft className="rotate-45" size={20} /> : <ArrowUpRight className="rotate-45" size={20} />}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header (Mobile Only) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-zinc-500 hover:bg-zinc-100 rounded-lg"
              >
                <Menu size={20} />
              </button>
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                <Wallet size={16} />
              </div>
              <h1 className="text-lg font-bold text-zinc-900">PettyCash</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {/* AI Search Bar */}
            <div className="mb-8">
              <form onSubmit={handleAISearch} className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Sparkles className={cn("text-zinc-400 transition-colors", isAIProcessing && "text-emerald-500 animate-pulse")} size={20} />
                </div>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ask Gemini: 'Show my food expenses this month' or 'How much did I spend last week?'"
                  className="w-full pl-12 pr-24 py-4 bg-white border border-zinc-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 placeholder:text-zinc-400"
                  disabled={isAIProcessing}
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                  <button
                    type="submit"
                    disabled={isAIProcessing || !aiPrompt.trim()}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isAIProcessing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    <span>{isAIProcessing ? 'Thinking...' : 'Search'}</span>
                  </button>
                </div>
              </form>
              <AnimatePresence>
                {aiExplanation && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2"
                  >
                    <Sparkles size={14} className="text-emerald-600" />
                    <p className="text-xs font-medium text-emerald-700">{aiExplanation}</p>
                    <button 
                      onClick={() => setAiExplanation('')}
                      className="ml-auto text-emerald-400 hover:text-emerald-600"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 rounded-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-zinc-500">Total Balance</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Wallet size={18} />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-zinc-900">
                  ${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-6 rounded-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-zinc-500">Total Income</span>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <TrendingUp size={18} />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-blue-600">
                  +${stats.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-6 rounded-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-zinc-500">Total Expenses</span>
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                    <TrendingDown size={18} />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-rose-600">
                  -${stats.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
              </motion.div>
            </div>

            {/* Lending & Borrowing Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-6 rounded-2xl border-l-4 border-l-blue-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-500">To Get (Receivables)</span>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <ArrowUpRight size={18} />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-blue-600">
                  ${stats.toGet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Money others owe you</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-6 rounded-2xl border-l-4 border-l-rose-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-500">To Give (Payables)</span>
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                    <ArrowDownLeft size={18} />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-rose-600">
                  ${stats.toGive.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Money you owe others</p>
              </motion.div>
            </div>

            {/* Upcoming EMIs (Dashboard) */}
            {loans.filter(l => l.paidEmis < l.totalEmis).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock size={18} className="text-rose-500" /> Upcoming EMIs
                  </h3>
                  <button 
                    onClick={() => setActiveTab('loans')}
                    className="text-sm text-emerald-600 font-medium hover:underline"
                  >
                    Manage all
                  </button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {loans
                    .filter(l => l.paidEmis < l.totalEmis)
                    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
                    .slice(0, 3)
                    .map(loan => {
                      const isDueSoon = new Date(loan.nextDueDate).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000;
                      return (
                        <motion.div 
                          key={loan.id}
                          whileHover={{ y: -4 }}
                          className="glass-card p-4 rounded-2xl min-w-[240px] flex-shrink-0 space-y-3 border-l-4 border-l-rose-500"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-sm text-zinc-900">{loan.name}</h4>
                              <p className="text-[10px] text-zinc-500">{loan.party}</p>
                            </div>
                            <span className="text-sm font-bold text-zinc-900">${loan.emiAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Calendar size={12} className={isDueSoon ? "text-rose-500" : "text-zinc-400"} />
                              <span className={cn("text-[10px] font-medium", isDueSoon ? "text-rose-600" : "text-zinc-500")}>
                                Due {format(parseISO(loan.nextDueDate), 'MMM d')}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {loan.paidEmis}/{loan.totalEmis} Paid
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users size={18} className="text-emerald-600" /> Party Accounts
                </h3>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="text-sm text-emerald-600 font-medium hover:underline"
                >
                  Manage Parties
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {partyBalances.map((party) => (
                    <motion.div
                      key={party.name}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass-card p-5 rounded-2xl space-y-4 border-t-4 border-t-zinc-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-600 font-bold">
                          {party.name.charAt(0).toUpperCase()}
                        </div>
                        <h4 className="font-bold text-zinc-900">{party.name}</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                          <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">To Give</p>
                          <p className="text-sm font-bold text-rose-600">${party.toGive.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">To Get</p>
                          <p className="text-sm font-bold text-blue-600">${party.toGet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {partyBalances.length === 0 && (
                <div className="text-center py-12 bg-zinc-100/50 rounded-2xl border-2 border-dashed border-zinc-200">
                  <p className="text-zinc-500">No active party balances.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'entry' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Transactions</h3>
                  <p className="text-zinc-500">Manage your income and expenses</p>
                </div>
              </div>
              <button
                onClick={() => setShowEntryForm(!showEntryForm)}
                className={cn(
                  "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg",
                  showEntryForm 
                    ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200" 
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
                )}
              >
                {showEntryForm ? <X size={20} /> : <Plus size={20} />}
                {showEntryForm ? "Cancel" : "Add New Transaction"}
              </button>
            </div>

            <AnimatePresence>
              {showEntryForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  className="overflow-hidden"
                >
                  <div className="glass-card p-8 rounded-3xl shadow-xl shadow-zinc-200/50 mb-8">
                    <form onSubmit={addTransaction} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Transaction Type</label>
                          <select
                            required
                            value={type}
                            onChange={(e) => { setType(e.target.value as any); setCategory(''); setSubcategory(''); }}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none capitalize"
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                            <option value="opening balance">Opening Balance</option>
                            <option value="to give">To Give</option>
                            <option value="to get">To Get</option>
                            <option value="gave">Gave</option>
                            <option value="got">Got</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Date</label>
                          <input
                            type="date"
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Amount</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">$</span>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-lg font-semibold"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Party / Payee</label>
                          <select
                            required
                            value={party}
                            onChange={(e) => setParty(e.target.value)}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                          >
                            <option value="">Select Party</option>
                            {parties.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Description</label>
                        <input
                          type="text"
                          required
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="What was this for?"
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Category</label>
                          <select
                            required
                            value={category}
                            onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                          >
                            <option value="">Select Category</option>
                            {Object.keys(categories[type]).map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Subcategory</label>
                          <select
                            value={subcategory}
                            onChange={(e) => setSubcategory(e.target.value)}
                            disabled={!category}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none disabled:opacity-50"
                          >
                            <option value="">Select Subcategory</option>
                            {category && categories[type][category]?.map((sub: string) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Account</label>
                          <select
                            required
                            value={account}
                            onChange={(e) => setAccount(e.target.value)}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                          >
                            <option value="">Select Account</option>
                            {accounts.map(acc => (
                              <option key={acc} value={acc}>{acc}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Payment Mode</label>
                          <select
                            required
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                          >
                            <option value="">Select Mode</option>
                            {modes.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Notes</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Additional details..."
                          rows={3}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-3"
                      >
                        <Plus size={24} /> Save Transaction
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Recent Activity</h3>
                <button 
                  onClick={() => setActiveTab('history')}
                  className="text-sm text-emerald-600 font-medium hover:underline"
                >
                  View all history
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {transactions.slice(0, 10).map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass-card p-4 rounded-2xl flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          TRANSACTION_BG[t.type],
                          TRANSACTION_CONFIG[t.type].color
                        )}>
                          {React.createElement(TRANSACTION_CONFIG[t.type].icon, { size: 20 })}
                        </div>
                        <div>
                          <h4 className="font-semibold text-zinc-900">{t.category} <span className="text-zinc-400 font-normal text-xs">/ {t.subcategory}</span></h4>
                          <p className="text-xs text-zinc-500 truncate max-w-[150px]">{t.party ? `${t.party} • ` : ''}{t.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "font-bold text-lg",
                          TRANSACTION_CONFIG[t.type].color
                        )}>
                          {TRANSACTION_CONFIG[t.type].sign}${t.amount.toFixed(2)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {transactions.length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-zinc-200">
                  <p className="text-zinc-500">No transactions recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-bold">Transaction History</h3>
                {selectedIds.size > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full"
                  >
                    <span className="text-sm font-bold text-emerald-700">{selectedIds.size} selected</span>
                    <div className="w-px h-4 bg-emerald-200 mx-1" />
                    <button 
                      onClick={() => setShowBulkEditModal(true)}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <Settings size={14} /> Bulk Edit
                    </button>
                    <button 
                      onClick={handleBulkDelete}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                    <button 
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs font-bold text-zinc-400 hover:text-zinc-600"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-white border border-zinc-200 rounded-xl p-1">
                  <button 
                    onClick={() => exportTransactionsPDF(filteredTransactions)}
                    className="p-2 hover:bg-zinc-50 text-rose-600 transition-colors"
                    title="Export PDF"
                  >
                    <FileText size={18} />
                  </button>
                  <button 
                    onClick={() => exportToCSV(filteredTransactions, 'transactions')}
                    className="p-2 hover:bg-zinc-50 text-emerald-600 transition-colors"
                    title="Export CSV"
                  >
                    <FileCode size={18} />
                  </button>
                  <button 
                    onClick={() => exportToXML(filteredTransactions, 'Transactions', 'Transaction', 'transactions')}
                    className="p-2 hover:bg-zinc-50 text-blue-600 transition-colors"
                    title="Export XML"
                  >
                    <Download size={18} />
                  </button>
                </div>

                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <select 
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as any)}
                      className="pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none capitalize"
                    >
                      <option value="all">All Types</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                      <option value="opening balance">Opening Balance</option>
                      <option value="to give">To Give</option>
                      <option value="to get">To Get</option>
                      <option value="gave">Gave</option>
                      <option value="got">Got</option>
                    </select>
                  </div>

                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <select 
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                    >
                      <option value="">All Categories</option>
                      {[...new Set([...Object.keys(categories.income), ...Object.keys(categories.expense)])].sort().map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-1">
                    <Calendar size={16} className="text-zinc-400" />
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-xs outline-none bg-transparent"
                    />
                    <span className="text-zinc-300">-</span>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-xs outline-none bg-transparent"
                    />
                    {(startDate || endDate || filterCategory || searchQuery || filterType !== 'all') && (
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setFilterCategory('');
                          setStartDate('');
                          setEndDate('');
                          setFilterType('all');
                        }}
                        className="ml-2 p-1 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-6 py-4 w-10">
                        <input 
                          type="checkbox" 
                          className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                          checked={filteredTransactions.length > 0 && filteredTransactions.every(t => selectedIds.has(t.id))}
                          onChange={toggleAllSelection}
                        />
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Details</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Party</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Account/Mode</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Amount</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className={cn("hover:bg-zinc-50/50 transition-colors", selectedIds.has(t.id) && "bg-emerald-50/30")}>
                        <td className="px-6 py-4">
                          <input 
                            type="checkbox" 
                            className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleSelection(t.id)}
                          />
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600 whitespace-nowrap">{format(parseISO(t.date), 'MMM d, yyyy')}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-900">{t.category}</span>
                            <span className="text-xs text-zinc-400">{t.subcategory}</span>
                            <span className="text-xs text-zinc-500 mt-1 italic">{t.description}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">{t.party || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-zinc-700">{t.account}</span>
                            <span className="text-[10px] text-zinc-400 uppercase">{t.mode}</span>
                          </div>
                        </td>
                        <td className={cn(
                          "px-6 py-4 text-sm font-bold text-right",
                          TRANSACTION_CONFIG[t.type].color
                        )}>
                          {TRANSACTION_CONFIG[t.type].sign}${t.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => deleteTransaction(t.id)}
                            className="text-zinc-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredTransactions.length === 0 && (
                <div className="text-center py-20">
                  <p className="text-zinc-500">No transactions found matching your filters.</p>
                  {(startDate || endDate || filterCategory || searchQuery || filterType !== 'all') && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setFilterCategory('');
                        setStartDate('');
                        setEndDate('');
                        setFilterType('all');
                      }}
                      className="mt-4 text-sm text-emerald-600 font-medium hover:underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-8">
            <h3 className="text-2xl font-bold">Financial Insights</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Trend Chart */}
              <div className="glass-card p-6 rounded-2xl">
                <h4 className="text-lg font-semibold mb-6">Income vs Expenses (Last 6 Months)</h4>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                      <Tooltip 
                        cursor={{ fill: '#f4f4f5' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="glass-card p-6 rounded-2xl">
                <h4 className="text-lg font-semibold mb-6">Expense by Category</h4>
                <div className="h-[300px] w-full flex items-center justify-center">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-zinc-500">Add expenses to see breakdown</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {categoryData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs text-zinc-600 font-medium">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8 pb-20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
                <Settings size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Manage Data</h3>
                <p className="text-zinc-500">Customize your dropdown options</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Categories Management */}
              <div className="glass-card p-6 rounded-3xl space-y-6">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Layers size={20} />
                  <h4 className="font-bold uppercase tracking-wider text-sm">Categories & Subcategories</h4>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <select 
                      id="manage-type"
                      className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                    <input 
                      id="new-category"
                      type="text" 
                      placeholder="New Category"
                      className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
                    />
                    <button 
                      onClick={() => {
                        const type = (document.getElementById('manage-type') as HTMLSelectElement).value as TransactionType;
                        const name = (document.getElementById('new-category') as HTMLInputElement).value;
                        if (name) {
                          setCategories({
                            ...categories,
                            [type]: { ...categories[type], [name]: [] }
                          });
                          (document.getElementById('new-category') as HTMLInputElement).value = '';
                        }
                      }}
                      className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {(['expense', 'income'] as const).map((t: TransactionType) => (
                      <div key={t} className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t}</p>
                        {Object.entries(categories[t]).map(([cat, subs]: [string, string[]]) => (
                          <div key={cat} className="bg-zinc-50 p-3 rounded-2xl border border-zinc-100 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-zinc-900">{cat}</span>
                              <button 
                                onClick={() => {
                                  const newCats = { ...categories[t] };
                                  delete newCats[cat];
                                  setCategories({ ...categories, [t]: newCats });
                                }}
                                className="text-zinc-400 hover:text-rose-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {subs.map((sub: string) => (
                                <span key={sub} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-zinc-200 rounded-lg text-[10px] text-zinc-600">
                                  {sub}
                                  <button 
                                    onClick={() => {
                                      const newSubs = subs.filter((s: string) => s !== sub);
                                      setCategories({
                                        ...categories,
                                        [t]: { ...categories[t], [cat]: newSubs }
                                      });
                                    }}
                                    className="hover:text-rose-600"
                                  >
                                    <X size={10} />
                                  </button>
                                </span>
                              ))}
                              <div className="flex gap-1 flex-1 min-w-[100px]">
                                <input 
                                  id={`new-sub-${t}-${cat}`}
                                  type="text" 
                                  placeholder="Add sub..."
                                  className="flex-1 px-2 py-1 bg-white border border-zinc-200 rounded-lg text-[10px] outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const input = e.currentTarget;
                                      if (input.value) {
                                        setCategories({
                                          ...categories,
                                          [t]: { ...categories[t], [cat]: [...subs, input.value] }
                                        });
                                        input.value = '';
                                      }
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Other Lists Management */}
              <div className="space-y-8">
                {/* Accounts */}
                <div className="glass-card p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-2 text-blue-600">
                    <CreditCard size={20} />
                    <h4 className="font-bold uppercase tracking-wider text-sm">Accounts</h4>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      id="new-account"
                      type="text" 
                      placeholder="New Account"
                      className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
                    />
                    <button 
                      onClick={() => {
                        const name = (document.getElementById('new-account') as HTMLInputElement).value;
                        if (name) {
                          setAccounts([...accounts, name]);
                          (document.getElementById('new-account') as HTMLInputElement).value = '';
                        }
                      }}
                      className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {accounts.map(acc => (
                      <span key={acc} className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-700">
                        {acc}
                        <button onClick={() => setAccounts(accounts.filter(a => a !== acc))} className="text-zinc-400 hover:text-rose-600">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Payment Modes */}
                <div className="glass-card p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Wallet size={20} />
                    <h4 className="font-bold uppercase tracking-wider text-sm">Payment Modes</h4>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      id="new-mode"
                      type="text" 
                      placeholder="New Mode"
                      className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
                    />
                    <button 
                      onClick={() => {
                        const name = (document.getElementById('new-mode') as HTMLInputElement).value;
                        if (name) {
                          setModes([...modes, name]);
                          (document.getElementById('new-mode') as HTMLInputElement).value = '';
                        }
                      }}
                      className="p-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {modes.map(m => (
                      <span key={m} className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-700">
                        {m}
                        <button onClick={() => setModes(modes.filter(x => x !== m))} className="text-zinc-400 hover:text-rose-600">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Parties */}
                <div className="glass-card p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Users size={20} />
                    <h4 className="font-bold uppercase tracking-wider text-sm">Parties / Payees</h4>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      id="new-party"
                      type="text" 
                      placeholder="New Party"
                      className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
                    />
                    <button 
                      onClick={() => {
                        const name = (document.getElementById('new-party') as HTMLInputElement).value;
                        if (name) {
                          setParties([...parties, name]);
                          (document.getElementById('new-party') as HTMLInputElement).value = '';
                        }
                      }}
                      className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parties.map(p => (
                      <span key={p} className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-700">
                        {p}
                        <button onClick={() => setParties(parties.filter(x => x !== p))} className="text-zinc-400 hover:text-rose-600">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'loans' && (
          <div className="space-y-8 pb-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
                  <HandCoins size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Loans & EMIs</h3>
                  <p className="text-zinc-500">Track your active loans and auto-pay reminders</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white border border-zinc-200 rounded-xl p-1">
                  <button 
                    onClick={() => exportLoansPDF(loans)}
                    className="p-2 hover:bg-zinc-50 text-rose-600 transition-colors"
                    title="Export PDF"
                  >
                    <FileText size={18} />
                  </button>
                  <button 
                    onClick={() => exportToCSV(loans, 'loans')}
                    className="p-2 hover:bg-zinc-50 text-emerald-600 transition-colors"
                    title="Export CSV"
                  >
                    <FileCode size={18} />
                  </button>
                  <button 
                    onClick={() => exportToXML(loans, 'Loans', 'Loan', 'loans')}
                    className="p-2 hover:bg-zinc-50 text-blue-600 transition-colors"
                    title="Export XML"
                  >
                    <Download size={18} />
                  </button>
                </div>
                <button
                  onClick={() => setShowLoanForm(!showLoanForm)}
                  className={cn(
                    "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg",
                    showLoanForm 
                      ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200" 
                      : "bg-rose-600 text-white hover:bg-rose-700 shadow-rose-100"
                  )}
                >
                  {showLoanForm ? <X size={20} /> : <Plus size={20} />}
                  {showLoanForm ? "Cancel" : "Add New Loan"}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showLoanForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  className="overflow-hidden"
                >
                  <div className="glass-card p-8 rounded-3xl shadow-xl shadow-zinc-200/50 mb-8">
                    <h4 className="font-bold text-zinc-900 flex items-center gap-2 mb-6">
                      <Plus size={20} className="text-emerald-600" /> New Loan Details
                    </h4>
                    <form onSubmit={addLoan} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Loan Name</label>
                          <input name="name" required placeholder="e.g. Home Loan" className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Party / Lender</label>
                          <select name="party" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none">
                            <option value="">Select Party</option>
                            {parties.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Total Amount</label>
                          <input name="totalAmount" type="number" required placeholder="0.00" className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">EMI Amount</label>
                          <input name="emiAmount" type="number" required placeholder="0.00" className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Total EMIs</label>
                          <input name="totalEmis" type="number" required placeholder="e.g. 24" className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Start Date</label>
                          <input name="startDate" type="date" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Next Due Date</label>
                          <input name="nextDueDate" type="date" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Account</label>
                          <select name="account" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none">
                            <option value="">Select Account</option>
                            {accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Category</label>
                          <select name="category" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none">
                            <option value="">Select Category</option>
                            {Object.keys(categories.expense).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                        <input name="isAutoPay" type="checkbox" id="isAutoPay" className="w-5 h-5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
                        <label htmlFor="isAutoPay" className="text-sm font-medium text-zinc-700">Enable Auto-Pay Reminders</label>
                      </div>

                      <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200">
                        Create Loan
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loans List */}
            <div className="space-y-6">
                {loans.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-zinc-200">
                    <HandCoins size={48} className="mx-auto text-zinc-300 mb-4" />
                    <p className="text-zinc-500">No active loans or EMIs tracked yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {loans.map(loan => {
                      const remainingEmis = loan.totalEmis - loan.paidEmis;
                      const progress = (loan.paidEmis / loan.totalEmis) * 100;
                      const isDueSoon = new Date(loan.nextDueDate).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000;

                      return (
                        <motion.div 
                          key={loan.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="glass-card p-6 rounded-3xl space-y-4 relative overflow-hidden group"
                        >
                          {loan.isAutoPay && (
                            <div className="absolute top-4 right-4">
                              <Bell size={16} className={cn("animate-bounce", isDueSoon ? "text-rose-500" : "text-emerald-500")} />
                            </div>
                          )}
                          
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="font-bold text-lg text-zinc-900">{loan.name}</h5>
                              <p className="text-xs text-zinc-500">{loan.party} • {loan.account}</p>
                            </div>
                            <button onClick={() => deleteLoan(loan.id)} className="p-2 text-zinc-300 hover:text-rose-600 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-4 py-2">
                            <div className="bg-zinc-50 p-3 rounded-2xl">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase">EMI Amount</p>
                              <p className="text-lg font-bold text-zinc-900">${loan.emiAmount.toFixed(2)}</p>
                            </div>
                            <div className="bg-zinc-50 p-3 rounded-2xl">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase">Next Due</p>
                              <p className={cn("text-sm font-bold", isDueSoon ? "text-rose-600" : "text-zinc-900")}>
                                {format(parseISO(loan.nextDueDate), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                              <span className="text-zinc-400">Progress</span>
                              <span className="text-emerald-600">{loan.paidEmis} / {loan.totalEmis} Paid</span>
                            </div>
                            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-emerald-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-zinc-400 uppercase">Paid</p>
                              <p className="text-xs font-bold text-zinc-700">{loan.paidEmis}</p>
                            </div>
                            <div className="space-y-1 border-x border-zinc-100">
                              <p className="text-[9px] font-bold text-zinc-400 uppercase">Left</p>
                              <p className="text-xs font-bold text-zinc-700">{remainingEmis}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-zinc-400 uppercase">Remaining</p>
                              <p className="text-xs font-bold text-zinc-700">${(remainingEmis * loan.emiAmount).toLocaleString()}</p>
                            </div>
                          </div>

                          <button 
                            disabled={remainingEmis <= 0}
                            onClick={() => payEMI(loan)}
                            className={cn(
                              "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                              remainingEmis <= 0 
                                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" 
                                : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            )}
                          >
                            {remainingEmis <= 0 ? "Loan Completed" : "Pay Current EMI"}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
            </div>

            {/* Renewals & Subscriptions Section */}
            <div className="pt-8 border-t border-zinc-200">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <RefreshCw size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Renewals & Subscriptions</h3>
                    <p className="text-zinc-500">Manage recurring payments, autopays, and subscriptions</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSubscriptionForm(!showSubscriptionForm)}
                  className={cn(
                    "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg",
                    showSubscriptionForm 
                      ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200" 
                      : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  {showSubscriptionForm ? <X size={20} /> : <Plus size={20} />}
                  {showSubscriptionForm ? "Cancel" : "Add Subscription"}
                </button>
              </div>

              <AnimatePresence>
                {showSubscriptionForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    className="overflow-hidden"
                  >
                    <div className="glass-card p-8 rounded-3xl shadow-xl shadow-zinc-200/50 mb-8">
                      <h4 className="font-bold text-zinc-900 flex items-center gap-2 mb-6">
                        <Plus size={20} className="text-indigo-600" /> New Subscription Details
                      </h4>
                      <form onSubmit={addSubscription} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Name</label>
                            <input name="name" required placeholder="e.g. Netflix, Gym, Rent" className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Amount</label>
                            <input name="amount" type="number" step="0.01" required placeholder="0.00" className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Frequency</label>
                            <select name="frequency" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none">
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="yearly">Yearly</option>
                              <option value="manual">Manual (No strict date)</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Specific Day (Optional)</label>
                            <input name="specificDay" type="number" min="1" max="31" placeholder="e.g. 5 for 5th of month" className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Next Due Date</label>
                            <input name="nextDueDate" type="date" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Account</label>
                            <select name="account" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none">
                              {accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Payment Mode</label>
                            <select name="mode" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none">
                              {modes.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Category</label>
                            <select name="category" required className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none">
                              {Object.keys(categories.expense).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                          <input name="isAutoPay" type="checkbox" id="isSubAutoPay" className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
                          <label htmlFor="isSubAutoPay" className="text-sm font-medium text-zinc-700">Enable Auto-Pay Reminders</label>
                        </div>

                        <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200">
                          Add Subscription
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subscriptions.length === 0 ? (
                  <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-zinc-200">
                    <RefreshCw size={48} className="mx-auto text-zinc-300 mb-4" />
                    <p className="text-zinc-500">No active subscriptions or renewals tracked yet.</p>
                  </div>
                ) : (
                  subscriptions.map(sub => {
                    const isDueSoon = new Date(sub.nextDueDate).getTime() - new Date().getTime() < 3 * 24 * 60 * 60 * 1000;
                    return (
                      <motion.div 
                        key={sub.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card p-6 rounded-3xl space-y-4 relative overflow-hidden group border-l-4 border-indigo-500"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="font-bold text-lg text-zinc-900">{sub.name}</h5>
                            <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">{sub.frequency} • {sub.account}</p>
                          </div>
                          <button onClick={() => deleteSubscription(sub.id)} className="p-2 text-zinc-300 hover:text-rose-600 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-zinc-50 p-3 rounded-2xl">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Amount</p>
                            <p className="text-lg font-bold text-zinc-900">${sub.amount.toFixed(2)}</p>
                          </div>
                          <div className="bg-zinc-50 p-3 rounded-2xl">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Next Due</p>
                            <p className={cn("text-sm font-bold", isDueSoon ? "text-rose-600" : "text-zinc-900")}>
                              {format(parseISO(sub.nextDueDate), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>

                        <button 
                          onClick={() => paySubscription(sub)}
                          className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={16} /> Mark as Paid
                        </button>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'backup' && (
          <div className="space-y-8">
            <h3 className="text-2xl font-bold">Backup & Restore</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Backup Section */}
              <div className="glass-card p-8 rounded-3xl space-y-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <Database size={32} />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-zinc-900">Backup Data</h4>
                  <p className="text-sm text-zinc-500 mt-1">Download a complete backup of your transactions, loans, and settings.</p>
                </div>
                <button 
                  onClick={handleBackup}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  <Download size={20} /> Create Backup File
                </button>
              </div>

              {/* Restore Section */}
              <div className="glass-card p-8 rounded-3xl space-y-6">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <FileUp size={32} />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-zinc-900">Restore Data</h4>
                  <p className="text-sm text-zinc-500 mt-1">Restore your data from a previously created backup file.</p>
                </div>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".json"
                    onChange={handleRestore}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold flex items-center justify-center gap-3 border-2 border-dashed border-zinc-300">
                    <FileUp size={20} /> Upload Backup File
                  </div>
                </div>
              </div>
            </div>

            {/* Export Section */}
            <div className="glass-card p-8 rounded-3xl space-y-8">
              <h4 className="text-xl font-bold text-zinc-900">Export Reports</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Transactions Export */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600">
                      <FileText size={20} />
                    </div>
                    <h5 className="font-bold text-zinc-800">Transactions Data</h5>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => exportTransactionsPDF()} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-zinc-100 transition-all">
                      <FileText size={24} className="text-rose-500" />
                      <span className="text-[10px] font-bold uppercase">PDF</span>
                    </button>
                    <button onClick={() => exportToCSV(transactions, 'transactions')} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-zinc-100 transition-all">
                      <FileCode size={24} className="text-emerald-500" />
                      <span className="text-[10px] font-bold uppercase">CSV</span>
                    </button>
                    <button onClick={() => exportToXML(transactions, 'Transactions', 'Transaction', 'transactions')} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-zinc-100 transition-all">
                      <FileCode size={24} className="text-blue-500" />
                      <span className="text-[10px] font-bold uppercase">XML</span>
                    </button>
                  </div>
                </div>

                {/* Loans Export */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600">
                      <HandCoins size={20} />
                    </div>
                    <h5 className="font-bold text-zinc-800">Loans & EMI Data</h5>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => exportLoansPDF()} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-zinc-100 transition-all">
                      <FileText size={24} className="text-rose-500" />
                      <span className="text-[10px] font-bold uppercase">PDF</span>
                    </button>
                    <button onClick={() => exportToCSV(loans, 'loans')} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-zinc-100 transition-all">
                      <FileCode size={24} className="text-emerald-500" />
                      <span className="text-[10px] font-bold uppercase">CSV</span>
                    </button>
                    <button onClick={() => exportToXML(loans, 'Loans', 'Loan', 'loans')} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-zinc-100 transition-all">
                      <FileCode size={24} className="text-blue-500" />
                      <span className="text-[10px] font-bold uppercase">XML</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>

        {/* Bottom Nav Bar (Mobile) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-4 py-2 flex items-center justify-around z-40">
          {navItems.filter(tab => tab.id !== 'settings' && tab.id !== 'backup').map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                activeTab === tab.id ? "text-emerald-600" : "text-zinc-400"
              )}
            >
              <tab.icon size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Bulk Edit Modal */}
        <AnimatePresence>
          {showBulkEditModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
              >
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">Bulk Edit Transactions</h3>
                    <p className="text-sm text-zinc-500">Updating {selectedIds.size} selected items</p>
                  </div>
                  <button 
                    onClick={() => setShowBulkEditModal(false)}
                    className="p-2 hover:bg-zinc-200 rounded-full text-zinc-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Date</label>
                      <input 
                        type="date"
                        value={bulkEditData.date || ''}
                        onChange={(e) => setBulkEditData({ ...bulkEditData, date: e.target.value })}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Party</label>
                      <select 
                        value={bulkEditData.party || ''}
                        onChange={(e) => setBulkEditData({ ...bulkEditData, party: e.target.value })}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                      >
                        <option value="">No Change</option>
                        {parties.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Account</label>
                      <select 
                        value={bulkEditData.account || ''}
                        onChange={(e) => setBulkEditData({ ...bulkEditData, account: e.target.value })}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                      >
                        <option value="">No Change</option>
                        {accounts.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Payment Mode</label>
                      <select 
                        value={bulkEditData.mode || ''}
                        onChange={(e) => setBulkEditData({ ...bulkEditData, mode: e.target.value })}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                      >
                        <option value="">No Change</option>
                        {modes.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Categorization</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-600">Category</label>
                        <select 
                          value={bulkEditData.category || ''}
                          onChange={(e) => setBulkEditData({ ...bulkEditData, category: e.target.value, subcategory: '' })}
                          className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                        >
                          <option value="">No Change</option>
                          {[...new Set([...Object.keys(categories.income), ...Object.keys(categories.expense)])].sort().map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-600">Subcategory</label>
                        <select 
                          value={bulkEditData.subcategory || ''}
                          onChange={(e) => setBulkEditData({ ...bulkEditData, subcategory: e.target.value })}
                          disabled={!bulkEditData.category}
                          className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none disabled:opacity-50"
                        >
                          <option value="">No Change</option>
                          {bulkEditData.category && (categories.income[bulkEditData.category] || categories.expense[bulkEditData.category])?.map((sub: string) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setShowBulkEditModal(false)}
                    className="px-6 py-2.5 text-sm font-bold text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBulkEdit}
                    className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    Apply Changes
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
