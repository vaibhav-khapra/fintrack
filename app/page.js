"use client"
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2, X, AlertTriangle, ArrowLeft, Printer, Edit, CornerDownLeft, CornerUpRight, Briefcase, ChevronLeft, ChevronRight, Calendar, ChevronDown, Clock, CalendarDays, FileText, SlidersHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';

// --- IMPORTS ---
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import { FileOpener } from '@capacitor-community/file-opener';

const LEDGER_STORAGE_KEY = 'fintrack_ledgers';
const TRANSACTIONS_PER_PAGE = 5;

// --- Utility Functions ---

const formatCurrency = (amount) => {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getTransactionAmountSign = (type) => {
  return type === 'credit' ? 1 : -1;
}

const formatDateString = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// --- Component Definitions ---

const DateRangeModal = ({ isOpen, onClose, onConfirm, ledgerCreatedAt }) => {
  const today = new Date().toISOString().split('T')[0];
  const minDate = ledgerCreatedAt
    ? new Date(ledgerCreatedAt).toISOString().split('T')[0]
    : '2000-01-01';

  const getSmartStartDate = () => {
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    return minDate > firstDayOfMonth ? minDate : firstDayOfMonth;
  };

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      startDate: getSmartStartDate(),
      endDate: today
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset({ startDate: getSmartStartDate(), endDate: today });
    }
  }, [isOpen, ledgerCreatedAt, reset]);

  const onSubmit = (data) => {
    onConfirm(data.startDate, data.endDate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/5 backdrop-blur-2xl p-4" onClick={onClose}>
      <div className="relative w-full max-w-md mx-auto bg-white rounded-xl shadow-3xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center space-x-3 text-indigo-800 border-b pb-3">
          <Calendar className="w-6 h-6" />
          <h2 className="text-xl font-bold">Select Custom Range</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                min={minDate}
                max={today}
                {...register("startDate", {
                  required: "Required",
                  min: { value: minDate, message: "Cannot be before created date" },
                  max: { value: today, message: "Cannot be in future" }
                })}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                min={minDate}
                max={today}
                {...register("endDate", {
                  required: "Required",
                  min: { value: minDate, message: "Cannot be before created date" },
                  max: { value: today, message: "Cannot be in future" }
                })}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button type="submit" className="w-full py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-md flex justify-center items-center gap-2">
              <Printer className="w-4 h-4" /> Download Report
            </button>
            <button type="button" onClick={onClose} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 mt-2">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ... [TransactionForm, TransactionEditForm, LedgerForm, Modal, DeleteConfirmationModal, TransactionDeleteConfirmationModal, LedgerCard, TransactionHistoryList components remain exactly the same as previous version] ...

// Note: For brevity, I am assuming the components above are unchanged. 
// BELOW IS THE UPDATED LEDGER DETAIL VIEW WITH THE DROPDOWN LOGIC.

const TransactionForm = ({ onClose, onAddTransaction }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      type: 'credit',
      date: new Date().toISOString().substring(0, 10),
    }
  });

  const addTransaction = (data) => {
    onAddTransaction(data);
    reset({
      type: 'credit',
      date: new Date().toISOString().substring(0, 10),
      amount: '',
      description: '',
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(addTransaction)} className="p-6 bg-white rounded-xl space-y-4">
      <h2 className="text-2xl font-bold text-indigo-800 border-b pb-3 mb-3">Add New Transaction</h2>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
        <select
          id="type"
          {...register("type", { required: "Type is required" })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out bg-white"
        >
          <option value="credit">Credit (Money Received)</option>
          <option value="debit">Debit (Money Paid)</option>
        </select>
        {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>}
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          {...register("amount", {
            required: "Amount is required",
            valueAsNumber: true,
            min: { value: 0.01, message: "Amount must be greater than 0" }
          })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out"
          placeholder="e.g., 1500.00"
        />
        {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input
          id="date"
          type="date"
          max={new Date().toISOString().substring(0, 10)}
          {...register("date", { required: "Date is required" })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out"
        />
        {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
        <textarea
          id="description"
          {...register("description")}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out"
          placeholder="e.g., Payment for goods"
          rows="2"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-200"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors duration-200 disabled:opacity-50 shadow-md"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Transaction'}
        </button>
      </div>
    </form>
  );
};

const TransactionEditForm = ({ onClose, onEditTransaction, transaction }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      type: transaction.type,
      date: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
    }
  });

  const editTransaction = (data) => {
    onEditTransaction(transaction.id, data);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(editTransaction)} className="p-6 bg-white rounded-xl space-y-4">
      <h2 className="text-2xl font-bold text-indigo-800 border-b pb-3 mb-3">Edit Transaction</h2>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
        <select
          id="type"
          {...register("type", { required: "Type is required" })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out bg-white"
        >
          <option value="credit">Credit (Money Received)</option>
          <option value="debit">Debit (Money Paid)</option>
        </select>
        {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>}
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          {...register("amount", {
            required: "Amount is required",
            valueAsNumber: true,
            min: { value: 0.01, message: "Amount must be greater than 0" }
          })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out"
          placeholder="e.g., 1500.00"
        />
        {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input
          id="date"
          type="date"
          max={new Date().toISOString().substring(0, 10)}
          {...register("date", { required: "Date is required" })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out"
        />
        {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
        <textarea
          id="description"
          {...register("description")}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out"
          placeholder="e.g., Payment for goods"
          rows="2"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-200"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors duration-200 disabled:opacity-50 shadow-md"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Updating...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

const LedgerForm = ({ onClose, onAddLedger }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const addLedger = (data) => {
    onAddLedger(data);
    reset();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(addLedger)} className="p-6 bg-white rounded-xl space-y-4">
      <h2 className="text-2xl font-bold text-indigo-800 border-b pb-3 mb-3">Add New Ledger</h2>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Ledger Name</label>
        <input
          id="name"
          type="text"
          {...register("name", { required: "Name is required" })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out"
          placeholder="e.g., John Doe"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="contactNo" className="block text-sm font-medium text-gray-700 mb-1">Contact No.</label>
        <input
          id="contactNo"
          type="tel"
          {...register("contactNo", {
            required: "Contact No. is required",
            pattern: {
              value: /^\d{10}$/,
              message: "Must be a 10-digit number"
            }
          })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out"
          placeholder="e.g., 9876543210"
        />
        {errors.contactNo && <p className="mt-1 text-xs text-red-600">{errors.contactNo.message}</p>}
      </div>

      <div>
        <label htmlFor="openingAmount" className="block text-sm font-medium text-gray-700 mb-1">
          Opening Balance (Rs.)
        </label>
        <input
          id="openingAmount"
          type="text"
          {...register("openingAmount", {
            required: "Amount is required",
            validate: (value) => {
              const num = parseFloat(value);
              if (isNaN(num)) return "Amount must be a valid number";
              return true;
            },
          })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 ease-in-out"
          placeholder="e.g., 5000.00 (Credit) or -500.00 (Debit)"
        />
        {errors.openingAmount && (
          <p className="mt-1 text-xs text-red-600">{errors.openingAmount.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Use a **negative sign (-) ** if you owe them (Debit).
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-200"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50 shadow-md"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Adding...' : 'Add Ledger'}
        </button>
      </div>
    </form>
  );
};

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/5 backdrop-blur-2xl p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-auto bg-white rounded-xl shadow-3xl transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 text-gray-500 hover:text-indigo-900 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors duration-200 z-10"
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ ledger, onConfirm, onCancel, isOpen }) => {
  if (!isOpen || !ledger) return null;

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="p-6 bg-white rounded-xl space-y-4">
        <div className="flex items-center space-x-3 text-red-600">
          <AlertTriangle className="w-8 h-8 flex-shrink-0" />
          <h2 className="text-2xl font-bold text-gray-800">Confirm Deletion</h2>
        </div>
        <p className="text-gray-600">
          Are you sure you want to delete the ledger for <strong className="font-semibold text-indigo-800">{ledger.name}</strong>?
          This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-md"
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </Modal>
  );
};

const TransactionDeleteConfirmationModal = ({ transaction, onConfirm, onCancel, isOpen }) => {
  if (!isOpen || !transaction) return null;

  const isCredit = transaction.type === 'credit';
  const colorClass = isCredit ? 'text-green-600' : 'text-red-600';

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="p-6 bg-white rounded-xl space-y-4">
        <div className="flex items-center space-x-3 text-red-600">
          <AlertTriangle className="w-8 h-8 flex-shrink-0" />
          <h2 className="text-2xl font-bold text-gray-800">Confirm Transaction Deletion</h2>
        </div>
        <p className="text-gray-600">
          Are you sure you want to delete this <strong className={`font-semibold capitalize ${colorClass}`}>{transaction.type}</strong> transaction of <strong className="font-semibold text-gray-800">{formatCurrency(transaction.amount)}</strong> dated {formatDateString(transaction.date)}?
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-md"
          >
            Delete Transaction
          </button>
        </div>
      </div>
    </Modal>
  );
};

const LedgerCard = ({ ledger, onDelete, onViewDetails }) => {
  const isCredit = ledger.openingAmount >= 0;
  const bgColor = isCredit ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500';
  const textColor = isCredit ? 'text-green-700' : 'text-red-700';

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(ledger.id);
  };

  return (
    <div
      onClick={() => onViewDetails(ledger)}
      className={`w-full h-auto rounded-xl p-6 shadow-lg border-l-4 relative transition-all duration-300 hover:shadow-xl ${bgColor} cursor-pointer active:scale-95 hover:scale-[1.02]`}
    >
      <h1 className="text-xl md:text-2xl font-extrabold text-indigo-900 flex items-center gap-2">
        <Briefcase className='w-5 h-5 text-indigo-500' />
        {ledger.name}
      </h1>
      <p className="text-sm font-medium text-gray-500 mb-2">{ledger.contactNo}</p>

      <div className="mt-4">
        <p className="text-base font-semibold text-gray-600">Current Balance:</p>
        <h2 className={`text-lg md:text-3xl font-black ${textColor}`}>
          {formatCurrency(ledger.openingAmount)}
        </h2>
      </div>

      <div className='absolute bottom-4 right-4 flex gap-3'>
        <Trash2
          onClick={handleDelete}
          className={`w-6 h-6 md:w-6 md:h-6 cursor-pointer text-gray-400 hover:text-red-600 transition-colors duration-200`}
        />
      </div>
    </div>
  );
};

const TransactionHistoryList = ({ transactions, onEditClick, onDeleteClick }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const sortedTransactions = useMemo(() => {
    if (!transactions) return [];
    return [...transactions].sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions]);

  const totalTransactions = sortedTransactions.length;
  const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage === 0 && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
  const endIndex = startIndex + TRANSACTIONS_PER_PAGE;
  const currentTransactions = sortedTransactions.slice(startIndex, endIndex);

  if (totalTransactions === 0) {
    return (
      <div className="p-6 mt-4 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 text-center font-medium">
        No transactions recorded for this ledger. Use the '+' button to add the first one!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {currentTransactions.map((tx, index) => {
          const isCredit = tx.type === 'credit';
          const icon = isCredit ? <CornerUpRight className='w-5 h-5 text-green-600' /> : <CornerDownLeft className='w-5 h-5 text-red-600' />;
          const amountClass = isCredit ? 'text-green-700 font-bold' : 'text-red-700 font-bold';
          const description = tx.description || 'No description';

          return (
            <div
              key={tx.id || index}
              className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center space-x-3">
                {icon}
                <div>
                  <p className="text-sm font-semibold text-gray-800 capitalize">{tx.type} Entry</p>
                  <p className="text-xs text-gray-500 truncate max-w-xs">{description}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onEditClick(tx)}
                  className="p-1 text-gray-400 hover:text-cyan-600 transition-colors duration-200"
                >
                  <Edit className='w-4 h-4' />
                </button>
                <button
                  onClick={() => onDeleteClick(tx)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
                >
                  <Trash2 className='w-4 h-4' />
                </button>

                <div className="text-right flex flex-col items-end min-w-[100px]">
                  <p className={`text-lg ${amountClass}`}>
                    {formatCurrency(tx.amount)}
                  </p>
                  <p className="text-xs text-gray-500">{formatDateString(tx.date)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-4">
          <p className="text-sm text-gray-600">
            Showing {Math.min(startIndex + 1, totalTransactions)} - {Math.min(endIndex, totalTransactions)} of {totalTransactions}
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="self-center text-sm font-semibold text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const LedgerDetailView = ({ ledger, onBack, onAddTransaction, onEditTransaction, onRemoveTransaction }) => {
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState(null);
  const [isDeleteTransModalOpen, setIsDeleteTransModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  // PDF & Download States
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);

  const currentBalance = ledger.openingAmount;
  const isCredit = currentBalance >= 0;
  const textColor = isCredit ? 'text-green-600' : 'text-red-600';

  const handleAddTransaction = (data) => {
    onAddTransaction(ledger.id, data);
    setIsTransModalOpen(false);
  }

  const handleEditClick = useCallback((transaction) => {
    setTransactionToEdit(transaction);
    setIsEditModalOpen(true);
  }, []);

  const handleUpdateTransaction = useCallback((transactionId, data) => {
    onEditTransaction(ledger.id, transactionId, data);
    setIsEditModalOpen(false);
    setTransactionToEdit(null);
  }, [ledger.id, onEditTransaction]);

  const handleDeleteClick = useCallback((transaction) => {
    setTransactionToDelete(transaction);
    setIsDeleteTransModalOpen(true);
  }, []);

  const handleConfirmDeleteTransaction = useCallback(() => {
    if (transactionToDelete) {
      onRemoveTransaction(ledger.id, transactionToDelete.id);
    }
    setIsDeleteTransModalOpen(false);
    setTransactionToDelete(null);
  }, [ledger.id, onRemoveTransaction, transactionToDelete]);

  // **Back Button Handling**
  const modalStateRef = useRef({
    isTransModalOpen, isEditModalOpen, isDeleteTransModalOpen, isDateRangeModalOpen, isDownloadDropdownOpen
  });

  useEffect(() => {
    modalStateRef.current = {
      isTransModalOpen, isEditModalOpen, isDeleteTransModalOpen, isDateRangeModalOpen, isDownloadDropdownOpen
    };
  }, [isTransModalOpen, isEditModalOpen, isDeleteTransModalOpen, isDateRangeModalOpen, isDownloadDropdownOpen]);

  useEffect(() => {
    if (typeof window.Capacitor !== 'undefined') {
      const detailBackButtonListener = App.addListener('backButton', () => {
        if (modalStateRef.current.isTransModalOpen) setIsTransModalOpen(false);
        else if (modalStateRef.current.isEditModalOpen) setIsEditModalOpen(false);
        else if (modalStateRef.current.isDeleteTransModalOpen) setIsDeleteTransModalOpen(false);
        else if (modalStateRef.current.isDateRangeModalOpen) setIsDateRangeModalOpen(false);
        else if (modalStateRef.current.isDownloadDropdownOpen) setIsDownloadDropdownOpen(false);
        else onBack();
      });
      return () => { detailBackButtonListener.remove(); };
    }
  }, [onBack]);

  // **Quick Action Logic**
  const handleQuickDownload = (option) => {
    setIsDownloadDropdownOpen(false);
    const today = new Date().toISOString().split('T')[0];

    if (option === 'month') {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      handleDownloadPDF(startOfMonth, today);
    } else if (option === '30days') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      handleDownloadPDF(thirtyDaysAgo, today);
    } else if (option === 'all') {
      handleDownloadPDF(null, null);
    } else if (option === 'custom') {
      setIsDateRangeModalOpen(true);
    }
  };

  // **PDF Generation**
  const handleDownloadPDF = async (startDate, endDate) => {
    if (!ledger.transactions || ledger.transactions.length === 0) {
      Toast.show({ text: 'No transactions to export', duration: 'short' });
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const logoUrl = 'favicon-96x96.png';

      // Load Logo
      try {
        const img = await fetch(logoUrl).then(res => res.blob()).then(blob => new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        }));
        doc.addImage(img, 'PNG', pageWidth - 29, 10, 15, 15);
      } catch (e) { console.warn("Logo failed to load:", e); }

      // 1. Calculate TRUE Original Balance
      const allTransactions = [...ledger.transactions];
      const sumOfAllTransactions = allTransactions.reduce((sum, tx) => {
        const sign = tx.type === 'credit' ? 1 : -1;
        return sum + (tx.amount * sign);
      }, 0);
      const originalLedgerOpeningBalance = ledger.openingAmount - sumOfAllTransactions;

      // 2. Filter Transactions
      let filteredTransactions = allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      const toDate = new Date().toLocaleDateString('en-IN');
      const fromDate = new Date(ledger.createdAt).toLocaleDateString('en-IN');

      let reportTitleDate = `${fromDate} to ${toDate}`;




      if (startDate && endDate) {
        const sDate = new Date(startDate);
        const eDate = new Date(endDate);
        reportTitleDate = `${sDate.toLocaleDateString('en-IN')} to ${eDate.toLocaleDateString('en-IN')}`;
        filteredTransactions = filteredTransactions.filter(tx => {
          const txDate = new Date(tx.date);
          return txDate >= sDate && txDate <= eDate;
        });
      }

      // 3. Calculate "Opening Balance Brought Forward"
      let openingBalanceBF = originalLedgerOpeningBalance;
      if (startDate) {
        const sDate = new Date(startDate);
        const priorTransactions = allTransactions.filter(tx => new Date(tx.date) < sDate);
        const sumPrior = priorTransactions.reduce((sum, tx) => {
          const sign = tx.type === 'credit' ? 1 : -1;
          return sum + (tx.amount * sign);
        }, 0);
        openingBalanceBF += sumPrior;
      }

      // Generate PDF
      doc.setFontSize(18);
      doc.setTextColor(55, 48, 163);
      doc.text(ledger.name, 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Contact: ${ledger.contactNo}`, 14, 30);
      doc.text(`Report Period: ${reportTitleDate}`, 14, 36);

      let runningBalance = openingBalanceBF;
      const tableRows = [];

      tableRows.push([
        startDate ? formatDateString(startDate) : formatDateString(ledger.createdAt),
        'Initial',
        'Initial Balance',
        `Rs. ${runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `Rs. ${runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      ]);

      filteredTransactions.forEach(tx => {
        const sign = tx.type === 'credit' ? 1 : -1;
        runningBalance += (tx.amount * sign);
        tableRows.push([
          formatDateString(tx.date),
          tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
          tx.description || '-',
          `Rs. ${tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          `Rs. ${runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        ]);
      });

      autoTable(doc, {
        startY: 45,
        head: [['Date', 'Type', 'Description', 'Amount', 'Balance']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [67, 56, 202] },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 20 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 35, halign: 'center' },
          4: { cellWidth: 35, halign: 'center', fontStyle: 'bold' }
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 4) {
            const raw = data.cell.raw || "";
            if (raw.includes('-') || (parseFloat(raw.replace(/[^0-9.-]+/g, "")) < 0)) {
              data.cell.styles.textColor = [220, 38, 38];
            } else {
              data.cell.styles.textColor = [5, 150, 105];
            }
          }
        }
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(`Closing Balance: Rs. ${runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 14, finalY);

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.setFont("helvetica", "normal");
        doc.text(`Page ${i} of ${pageCount} - FinTrack Report`, pageWidth / 2, 290, { align: 'center' });
      }

      const fileName = `${ledger.name.replace(/\s+/g, '_')}_Report.pdf`;
      const platform = Capacitor.getPlatform();

      if (platform === 'web') {
        doc.save(fileName);
        await Toast.show({ text: '✅ Downloaded', duration: 'short' });
      } else {
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache,
          encoding: Encoding.Base64,
          recursive: true,
        });

        try {
          await FileOpener.open({
            filePath: savedFile.uri,
            contentType: 'application/pdf',
            openWithDefault: true,
          });
        } catch (openError) {
          console.warn('FileOpener failed, falling back to Share', openError);
          await Share.share({
            title: 'Ledger Report',
            text: `Report for ${ledger.name}`,
            url: savedFile.uri,
            dialogTitle: 'Open PDF'
          });
        }
      }

    } catch (error) {
      console.error("PDF Generation Error:", error);
      await Toast.show({ text: `❌ Error: ${error.message}`, duration: 'long' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const originalOpeningAmount = useMemo(() => {
    return currentBalance - (ledger.transactions || []).reduce((sum, tx) => sum + tx.amount * getTransactionAmountSign(tx.type), 0);
  }, [currentBalance, ledger.transactions]);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-xl shadow-2xl space-y-6 min-h-screen">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 font-semibold transition-colors duration-200 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Ledgers</span>
      </button>

      <div className="border-b border-gray-200 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-indigo-900">{ledger.name}</h1>
          <p className="text-lg text-gray-500">Ledger Details</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
            className='flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md disabled:opacity-50'
            disabled={!ledger.transactions || ledger.transactions.length === 0 || isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Printer className='w-5 h-5' />
            )}
            <span>Download Report</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDownloadDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* DOWNLOAD DROPDOWN MENU */}
          {isDownloadDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-1">
                <button onClick={() => handleQuickDownload('month')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors text-left">
                  <CalendarDays className="w-4 h-4 text-indigo-500" />
                  <span>This Month</span>
                </button>
                <button onClick={() => handleQuickDownload('30days')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors text-left">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span>Last 30 Days</span>
                </button>
                <button onClick={() => handleQuickDownload('all')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors text-left">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span>Complete History</span>
                </button>
                <div className="my-1 border-t border-gray-100"></div>
                <button onClick={() => handleQuickDownload('custom')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors text-left">
                  <SlidersHorizontal className="w-4 h-4 text-gray-400" />
                  <span>Custom Range...</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 p-4 bg-gray-50 rounded-xl shadow-inner">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Current Balance</h3>
          <p className={`text-3xl font-black ${textColor}`}>
            {formatCurrency(currentBalance)}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Original Opening Balance</h3>
          <p className="text-xl font-mono text-gray-800">
            {formatCurrency(originalOpeningAmount)}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Contact Information</h3>
          <p className="text-xl font-mono text-gray-800">{ledger.contactNo}</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Date Created</h3>
          <p className="text-lg font-medium text-gray-700">
            {new Date(ledger.createdAt).toLocaleDateString('en-IN', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
      </div>

      <div className="pt-8 border-t">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-indigo-800 ">Transaction History</h2>
          <button
            onClick={() => setIsTransModalOpen(true)}
            className='p-3 rounded-full bg-cyan-500 text-white shadow-lg hover:bg-cyan-600 transition-colors duration-200 transform hover:scale-105'
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <TransactionHistoryList
          transactions={ledger.transactions}
          onEditClick={handleEditClick}
          onDeleteClick={handleDeleteClick}
        />
      </div>

      <Modal isOpen={isTransModalOpen} onClose={() => setIsTransModalOpen(false)}>
        <TransactionForm onClose={() => setIsTransModalOpen(false)} onAddTransaction={handleAddTransaction} />
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
        {transactionToEdit && (
          <TransactionEditForm
            onClose={() => setIsEditModalOpen(false)}
            onEditTransaction={handleUpdateTransaction}
            transaction={transactionToEdit}
          />
        )}
      </Modal>

      <TransactionDeleteConfirmationModal
        isOpen={isDeleteTransModalOpen}
        onCancel={() => setIsDeleteTransModalOpen(false)}
        onConfirm={handleConfirmDeleteTransaction}
        transaction={transactionToDelete}
      />

      <DateRangeModal
        isOpen={isDateRangeModalOpen}
        onClose={() => setIsDateRangeModalOpen(false)}
        onConfirm={handleDownloadPDF}
        ledgerCreatedAt={ledger.createdAt}
      />
    </div>
  );
};

export default function FintrackApp() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ledgerToDelete, setLedgerToDelete] = useState(null);

  const [viewState, setViewState] = useState({
    page: 'list',
    selectedLedger: null,
  });

  const normalizeLedgerData = (data) => {
    return data.map(ledger => ({
      ...ledger,
      transactions: ledger.transactions || [],
      openingAmount: parseFloat(ledger.openingAmount || 0),
    }));
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LEDGER_STORAGE_KEY);
        let initialData = stored ? JSON.parse(stored) : [];
        if (Array.isArray(initialData)) {
          initialData = normalizeLedgerData(initialData);
          initialData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }
        setLedgers(initialData);
        setIsLoaded(true);
      } catch (error) {
        console.error("Error initializing ledgers:", error);
        setIsLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      try {
        localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(ledgers));
      } catch (error) { console.error("Error saving ledgers:", error); }
    }
  }, [ledgers, isLoaded]);

  const handleAddLedger = useCallback((data) => {
    const newLedger = {
      id: crypto.randomUUID(),
      name: data.name,
      contactNo: data.contactNo,
      openingAmount: parseFloat(data.openingAmount),
      transactions: [],
      createdAt: Date.now()
    };
    setLedgers(prev => [newLedger, ...prev]);
  }, []);

  const calculateNewBalance = useCallback((ledger, transactionId, newData) => {
    const oldTransaction = ledger.transactions.find(tx => tx.id === transactionId);
    if (!oldTransaction) return ledger.openingAmount;

    const oldValue = oldTransaction.amount * getTransactionAmountSign(oldTransaction.type);
    const balanceAfterReversal = ledger.openingAmount - oldValue;
    const newValue = parseFloat(newData.amount) * getTransactionAmountSign(newData.type);
    return balanceAfterReversal + newValue;
  }, []);

  const handleAddTransaction = useCallback((ledgerId, data) => {
    const { type, amount, date, description } = data;
    const amountSign = getTransactionAmountSign(type);
    const transactionValue = parseFloat(amount) * amountSign;

    const newTransaction = {
      id: crypto.randomUUID(),
      type: type,
      amount: parseFloat(amount),
      date: date,
      description: description,
      timestamp: Date.now(),
    };

    setLedgers(prevLedgers =>
      prevLedgers.map(ledger => {
        if (ledger.id === ledgerId) {
          const updatedTransactions = [...ledger.transactions, newTransaction];
          const newBalance = ledger.openingAmount + transactionValue;
          const updatedLedger = { ...ledger, openingAmount: newBalance, transactions: updatedTransactions };
          if (viewState.selectedLedger?.id === ledgerId) {
            setViewState(prev => ({ ...prev, selectedLedger: updatedLedger }));
          }
          return updatedLedger;
        }
        return ledger;
      })
    );
  }, [viewState.selectedLedger]);

  const handleEditTransaction = useCallback((ledgerId, transactionId, newData) => {
    setLedgers(prevLedgers =>
      prevLedgers.map(ledger => {
        if (ledger.id === ledgerId) {
          const newBalance = calculateNewBalance(ledger, transactionId, newData);
          const updatedTransactions = ledger.transactions.map(tx => {
            if (tx.id === transactionId) {
              return {
                ...tx,
                type: newData.type,
                amount: parseFloat(newData.amount),
                date: newData.date,
                description: newData.description,
              };
            }
            return tx;
          });
          const updatedLedger = { ...ledger, openingAmount: newBalance, transactions: updatedTransactions };
          if (viewState.selectedLedger?.id === ledgerId) {
            setViewState(prev => ({ ...prev, selectedLedger: updatedLedger }));
          }
          return updatedLedger;
        }
        return ledger;
      })
    );
  }, [calculateNewBalance, viewState.selectedLedger]);

  const handleRemoveTransaction = useCallback((ledgerId, transactionId) => {
    setLedgers(prevLedgers =>
      prevLedgers.map(ledger => {
        if (ledger.id === ledgerId) {
          const transactionToRemove = ledger.transactions.find(tx => tx.id === transactionId);
          if (!transactionToRemove) return ledger;
          const transactionValue = transactionToRemove.amount * getTransactionAmountSign(transactionToRemove.type);
          const newBalance = ledger.openingAmount - transactionValue;
          const updatedTransactions = ledger.transactions.filter(tx => tx.id !== transactionId);
          const updatedLedger = { ...ledger, openingAmount: newBalance, transactions: updatedTransactions };
          if (viewState.selectedLedger?.id === ledgerId) {
            setViewState(prev => ({ ...prev, selectedLedger: updatedLedger }));
          }
          return updatedLedger;
        }
        return ledger;
      })
    );
  }, [viewState.selectedLedger]);

  const initiateDeleteLedger = useCallback((id) => {
    const ledger = ledgers.find(l => l.id === id);
    if (ledger) {
      setLedgerToDelete(ledger);
      setIsDeleteModalOpen(true);
    }
  }, [ledgers]);

  const confirmDeleteLedger = useCallback(() => {
    if (ledgerToDelete) {
      setLedgers(prev => prev.filter(ledger => ledger.id !== ledgerToDelete.id));
    }
    setLedgerToDelete(null);
    setIsDeleteModalOpen(false);
    if (viewState.page === 'detail' && viewState.selectedLedger?.id === ledgerToDelete?.id) {
      setViewState({ page: 'list', selectedLedger: null });
    }
  }, [ledgerToDelete, viewState.page, viewState.selectedLedger]);

  const cancelDeleteLedger = useCallback(() => {
    setLedgerToDelete(null);
    setIsDeleteModalOpen(false);
  }, []);

  const handleViewDetails = useCallback((ledger) => {
    const currentLedger = ledgers.find(l => l.id === ledger.id);
    if (currentLedger) {
      setViewState({ page: 'detail', selectedLedger: currentLedger });
    }
  }, [ledgers]);

  const handleBackToList = useCallback(() => {
    setViewState({ page: 'list', selectedLedger: null });
  }, []);

  const mainStateRef = useRef({ isModalOpen, isDeleteModalOpen, viewState });

  useEffect(() => {
    mainStateRef.current = { isModalOpen, isDeleteModalOpen, viewState };
  }, [isModalOpen, isDeleteModalOpen, viewState]);

  useEffect(() => {
    if (typeof window.Capacitor !== 'undefined') {
      const listener = App.addListener('backButton', () => {
        if (mainStateRef.current.isModalOpen) {
          setIsModalOpen(false);
        } else if (mainStateRef.current.isDeleteModalOpen) {
          cancelDeleteLedger();
        } else if (mainStateRef.current.viewState.page === 'detail') {
          handleBackToList();
        } else {
          App.exitApp();
        }
      });
      return () => { listener.remove(); };
    }
  }, [handleBackToList, cancelDeleteLedger]);

  const renderContent = () => {
    if (viewState.page === 'detail' && viewState.selectedLedger) {
      const updatedLedger = ledgers.find(l => l.id === viewState.selectedLedger.id);
      if (!updatedLedger) {
        setViewState({ page: 'list', selectedLedger: null });
        return null;
      }

      return (
        <main className='pt-24 p-4 min-h-screen bg-gray-100'>
          <LedgerDetailView
            ledger={updatedLedger}
            onBack={handleBackToList}
            onAddTransaction={handleAddTransaction}
            onEditTransaction={handleEditTransaction}
            onRemoveTransaction={handleRemoveTransaction}
          />
        </main>
      );
    }

    if (!isLoaded) {
      return (
        <main className='pt-24 p-4 min-h-screen bg-gray-100'>
          <div className="text-center p-16 bg-white rounded-xl shadow-md text-indigo-700 text-lg font-medium">
            Loading your ledgers...
          </div>
        </main>
      );
    }

    return (
      <main className='pt-24 p-4 min-h-screen bg-gray-100'>
        <h2 className='text-2xl font-extrabold text-indigo-900 mb-6 border-b pb-2'>Your Ledgers ({ledgers.length})</h2>
        {ledgers.length === 0 && (
          <div className="text-center p-16 bg-white rounded-xl shadow-lg">
            <p className="text-gray-600 text-lg">No ledgers found. Click the <span className="font-bold text-cyan-600">Plus (+)</span> icon to add your first client ledger!</p>
          </div>
        )}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {ledgers.map(ledger => (
            <LedgerCard
              key={ledger.id}
              ledger={ledger}
              onDelete={initiateDeleteLedger}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      </main>
    );
  };

  return (
    <>
      <nav className="fixed top-0 left-0 w-full bg-indigo-700 h-20 z-20 shadow-xl">
        <div className='flex h-full justify-between items-center px-4 border-b border-indigo-800'>
          <h1 className='text-2xl sm:text-3xl font-extrabold text-white'>
            Fin<span className='text-cyan-400 italic'>Track</span>
          </h1>

          {viewState.page === 'list' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-3 rounded-full bg-cyan-500 text-white shadow-lg hover:bg-cyan-600 transition-colors"
            >
              <Plus className='w-6 h-6 sm:w-7 sm:h-7' />
            </button>
          )}
        </div>
      </nav>

      {renderContent()}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <LedgerForm onClose={() => setIsModalOpen(false)} onAddLedger={handleAddLedger} />
      </Modal>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        ledger={ledgerToDelete}
        onConfirm={confirmDeleteLedger}
        onCancel={cancelDeleteLedger}
      />
    </>
  );
}