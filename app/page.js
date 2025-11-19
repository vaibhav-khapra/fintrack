"use client"
import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from 'react';
import { Plus, ArrowRightCircle, Trash2, X, AlertTriangle, ArrowLeft, TrendingUp, TrendingDown, Download, ChevronLeft, ChevronRight, Printer, Edit, CornerDownLeft, CornerUpRight, Briefcase } from 'lucide-react';
import { useForm } from 'react-hook-form';

// --- IMPORTS ---
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';
// -------------------------
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import { FileOpener } from '@capacitor-community/file-opener';
import { LocalNotifications } from '@capacitor/local-notifications';



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

const LedgerReportPrintLayout = forwardRef(({ ledger }, ref) => {
  const sortedTransactions = useMemo(() => {
    return [...ledger.transactions || []].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [ledger.transactions]);

  const initialOpeningAmount = ledger.openingAmount - sortedTransactions.reduce((sum, tx) => sum + tx.amount * getTransactionAmountSign(tx.type), 0);
  let runningBalance = initialOpeningAmount;

  return (
    <div style={{ padding: '32px', backgroundColor: '#ffffff', width: '100%' }} ref={ref} id="pdf-content-hidden">

      <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px', color: '#3730a3' }}>{ledger.name} </h1>
      <p style={{ fontSize: '14px', color: '#4b5563' }}>Contact: {ledger.contactNo}</p>
      <p style={{ fontSize: '14px', marginBottom: '16px', color: '#4b5563' }}>Report Date: {formatDateString(new Date().toISOString().substring(0, 10))}</p>

      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px', color: '#4338ca' }}>
        Opening Balance: {formatCurrency(initialOpeningAmount)}
      </h2>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#eef2ff' }}>
            <th style={{ width: '15%', border: '1px solid #ddd', padding: '10px', textAlign: 'left', fontSize: '10pt', color: '#1e3a8a' }}>Date</th>
            <th style={{ width: '10%', border: '1px solid #ddd', padding: '10px', textAlign: 'left', fontSize: '10pt', color: '#1e3a8a' }}>Type</th>
            <th style={{ width: '20%', border: '1px solid #ddd', padding: '10px', textAlign: 'left', fontSize: '10pt', color: '#1e3a8a' }}>Amount (Rs.)</th>
            <th style={{ width: '45%', border: '1px solid #ddd', padding: '10px', textAlign: 'left', fontSize: '10pt', color: '#1e3a8a' }}>Description</th>
            <th style={{ width: '10%', border: '1px solid #ddd', padding: '10px', textAlign: 'left', fontSize: '10pt', color: '#1e3a8a' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening Balance Row */}
          <tr>
            <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt' }}>{formatDateString(ledger.createdAt)}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt' }}>Initial</td>
            <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt' }}>{formatCurrency(Math.abs(initialOpeningAmount))}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt' }}>Opening Balance</td>
            <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt', color: runningBalance >= 0 ? '#059669' : '#dc2626' }}>
              {formatCurrency(runningBalance)}
            </td>
          </tr>

          {/* Transaction Rows */}
          {sortedTransactions.map((tx, index) => {
            const transactionValue = tx.amount * getTransactionAmountSign(tx.type);
            runningBalance += transactionValue;

            return (
              <tr key={tx.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt' }}>{formatDateString(tx.date)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt' }}>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt' }}>{formatCurrency(tx.amount)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt' }}>{tx.description || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '10pt', color: runningBalance >= 0 ? '#059669' : '#dc2626' }}>
                  {formatCurrency(runningBalance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', color: '#4338ca' }}>
        Final Balance: {formatCurrency(ledger.openingAmount)}
      </h2>

    </div>
  );
});
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
        <p className="mt-1 text-xs text-gray-500">The person or business this ledger tracks.</p>
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
          aria-label="Close modal"
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
          This action cannot be undone and will remove all associated transactions.
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
          This action will recalculate the ledger's balance.
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
          aria-label={`Delete ledger ${ledger.name}`}
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
                  aria-label="Edit transaction"
                >
                  <Edit className='w-4 h-4' />
                </button>
                <button
                  onClick={() => onDeleteClick(tx)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
                  aria-label="Delete transaction"
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

      {/* Pagination Controls */}
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
              aria-label="Previous page"
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
              aria-label="Next page"
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const pdfContentRef = useRef(null);

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

  // **CAPACITOR BACK BUTTON FIX (LedgerDetailView)**
  // Store modal state in a ref to avoid re-creating listener on every modal state change
  const modalStateRef = useRef({ isTransModalOpen, isEditModalOpen, isDeleteTransModalOpen });
  
  useEffect(() => {
    modalStateRef.current = { isTransModalOpen, isEditModalOpen, isDeleteTransModalOpen };
  }, [isTransModalOpen, isEditModalOpen, isDeleteTransModalOpen]);

  useEffect(() => {
    if (typeof window.Capacitor !== 'undefined') {
      const detailBackButtonListener = App.addListener('backButton', ({ canGoBack }) => {
        // Check current state from ref to avoid stale closures
        if (modalStateRef.current.isTransModalOpen) {
          setIsTransModalOpen(false);
        } else if (modalStateRef.current.isEditModalOpen) {
          setIsEditModalOpen(false);
        } else if (modalStateRef.current.isDeleteTransModalOpen) {
          setIsDeleteTransModalOpen(false);
        } else {
          onBack();
        }
      });

      return () => {
        detailBackButtonListener.remove();
      };
    }
  }, [onBack]); // Only depend on onBack, not modal states

  // **PDF Download with Capacitor Filesystem and Share**
  const handleDownloadPDF = async () => {
    if (!ledger.transactions || ledger.transactions.length === 0) return;

    setIsGeneratingPdf(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    if (!pdfContentRef.current) {
      console.error("PDF Content Ref is not available.");
      setIsGeneratingPdf(false);
      return;
    }

    try {
      const canvas = await html2canvas(pdfContentRef.current, {
        scale: 2,
        useCORS: true,
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);

      const pdfWidth = pdf.internal.pageSize.getWidth();
      let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - pdf.internal.pageSize.getHeight();
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      const fileName = `${ledger.name}_Ledger_Report_${new Date().toISOString().substring(0, 10)}.pdf`;
      const platform = Capacitor.getPlatform();

      // ...existing code inside LedgerDetailView.handleDownloadPDF ...
      if (platform === 'web') {
        // --- Web Platform ---
        pdf.save(fileName);
        await Toast.show({
          text: '✅ Download Successful. Check your Downloads folder.',
          duration: 'long',
        });

              // Web Notification (if permitted)
                 try {
                     if ('Notification' in window && Notification.permission === 'granted') {
              +            new Notification('Download complete', { body: `${fileName} saved.` });
                       }
                  } catch (webNotifyErr) {
                        console.warn('Web notification failed', webNotifyErr);
                      }
      } else {
        // --- Android / iOS ---
        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        try {
          // Use ExternalCache for better Android compatibility
          const result = await Filesystem.writeFile({
            path: fileName,
            data: pdfBase64,
            directory: Directory.Documents,
            encoding: Encoding.Base64,
            recursive: true,
          });

          console.log('PDF saved at:', result.uri);

          await Toast.show({
            text: '✅ Download Successful. File saved.',
            duration: 'long',
          });

          // Try to open the file
          try {
            await FileOpener.open({
              filePath: result.uri,
              contentType: 'application/pdf',
            });
          } catch (openError) {
            console.warn('Error opening file:', openError);
            await Toast.show({
              text: '✅ File saved. Open with File Manager.',
              duration: 'long',
            });
          }

          // Notification after file is saved
          try {
            await LocalNotifications.schedule({
              notifications: [{
                id: Number(String(Date.now()).slice(-5)),
                title: 'Download complete',
                body: `${fileName} saved`,
                channelId: 'downloads',
                smallIcon: 'ic_notification',
                actionTypeId: 'downloads',
              }]
            });

            // Listen for notification click
            LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
              if (notification.notification.channelId === 'downloads') {
                FileOpener.open({
                  filePath: result.uri,
                  contentType: 'application/pdf',
                }).catch(err => console.warn('Error opening file from notification:', err));
              }
            });
          } catch (notifyErr) {
            console.warn('Local notification failed', notifyErr);
          }

        } catch (error) {
          console.error("Android/iOS save error:", error);
          await Toast.show({
            text: `❌ Failed to save PDF: ${error.message}`,
            duration: 'long',
          });
        }
      }
    } catch (error) {
      console.error("Error generating or saving PDF:", error);
      await Toast.show({
        text: `❌ Failed to save PDF: ${error.message || error}`,
        duration: 'long',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  useEffect(() => {
    const initNotifications = async () => {
      if (typeof window.Capacitor !== 'undefined' && Capacitor.getPlatform() !== 'web') {
        try {
          // Request permissions FIRST
          const permResult = await LocalNotifications.requestPermissions();
          console.log('Notification permission result:', permResult);

          // Create channel AFTER permissions granted
          if (permResult.display === 'granted') {
            await LocalNotifications.createChannel({
              id: 'downloads',
              name: 'Downloads',
              description: 'Notifications for file downloads',
              importance: 4,
              sound: 'default',
              vibration: true,
              smallIcon: 'ic_notification',
            });

            // Create action type for notification clicks
            await LocalNotifications.registerActionTypes({
              types: [{
                id: 'downloads',
                actions: [{
                  id: 'open',
                  title: 'Open',
                }]
              }]
            });

            console.log('Notification channel created');
          }
        } catch (err) {
          console.error('Notification setup error:', err);
        }
      }
    };
    
    initNotifications();
  }, []);

  const originalOpeningAmount = useMemo(() => {
    return currentBalance - (ledger.transactions || []).reduce((sum, tx) => sum + tx.amount * getTransactionAmountSign(tx.type), 0);
  }, [currentBalance, ledger.transactions]);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-xl shadow-2xl space-y-6">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 font-semibold transition-colors duration-200 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Ledgers</span>
      </button>

      <div className="border-b border-gray-200 pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-extrabold text-indigo-900">{ledger.name}</h1>
          <p className="text-lg text-gray-500">Ledger Details</p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleDownloadPDF}
            className='flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md disabled:opacity-50'
            aria-label="Download as PDF"
            disabled={!ledger.transactions || ledger.transactions.length === 0 || isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Printer className='w-5 h-5' />
            )}
            <span>{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
          </button>
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
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
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
            aria-label="Add new transaction"
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
        <TransactionForm
          onClose={() => setIsTransModalOpen(false)}
          onAddTransaction={handleAddTransaction}
        />
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

      {isGeneratingPdf && (
        <div style={{ position: 'fixed', top: '0', left: '-5000px', zIndex: '9999', width: '210mm', height: '297mm', overflow: 'hidden' }}>
          <LedgerReportPrintLayout ledger={ledger} ref={pdfContentRef} />
        </div>
      )}
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
        console.error("Error initializing ledgers from localStorage:", error);
        setIsLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      try {
        localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(ledgers));
      } catch (error) {
        console.error("Error saving ledgers to localStorage:", error);
      }
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
    const newBalance = balanceAfterReversal + newValue;

    return newBalance;
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

          const updatedLedger = {
            ...ledger,
            openingAmount: newBalance,
            transactions: updatedTransactions
          };

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

          const updatedLedger = {
            ...ledger,
            openingAmount: newBalance,
            transactions: updatedTransactions
          };

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

          const updatedLedger = {
            ...ledger,
            openingAmount: newBalance,
            transactions: updatedTransactions
          };

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

  // **CRITICAL FIX: Use Ref to Avoid Re-creating Listener on Every State Change**
  // Store state in a ref to avoid stale closures
  const mainStateRef = useRef({ isModalOpen, isDeleteModalOpen, viewState });
  
  useEffect(() => {
    mainStateRef.current = { isModalOpen, isDeleteModalOpen, viewState };
  }, [isModalOpen, isDeleteModalOpen, viewState]);

  useEffect(() => {
    if (typeof window.Capacitor !== 'undefined') {
      const listener = App.addListener('backButton', ({ canGoBack }) => {
        // Check current state from ref to avoid stale closures
        if (mainStateRef.current.isModalOpen) {
          setIsModalOpen(false);
        } else if (mainStateRef.current.isDeleteModalOpen) {
          cancelDeleteLedger();
        } else if (mainStateRef.current.viewState.page === 'detail') {
          // This calls the navigation function
          handleBackToList();
        } else {
          App.exitApp();
        }
      });

      return () => {
        listener.remove();
      };
    }
  }, [handleBackToList, cancelDeleteLedger]); // Only depend on callbacks, not state


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
              aria-label="Add new ledger"
            >
              <Plus className='w-6 h-6 sm:w-7 sm:h-7' />
            </button>
          )}
        </div>
      </nav>


      {renderContent()}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <LedgerForm
          onClose={() => setIsModalOpen(false)}
          onAddLedger={handleAddLedger}
        />
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