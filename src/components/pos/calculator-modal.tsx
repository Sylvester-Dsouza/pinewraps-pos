'use client';

import { useState } from 'react';
import { X, Delete } from 'lucide-react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState(true);

  const handleNumber = (num: string) => {
    if (newNumber) {
      setDisplay(num);
      setNewNumber(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleDecimal = () => {
    if (newNumber) {
      setDisplay('0.');
      setNewNumber(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleOperation = (op: string) => {
    const current = parseFloat(display);
    
    if (previousValue === null) {
      setPreviousValue(display);
    } else if (operation) {
      const prev = parseFloat(previousValue);
      let result: number;
      
      switch (operation) {
        case '+':
          result = prev + current;
          break;
        case '-':
          result = prev - current;
          break;
        case '×':
          result = prev * current;
          break;
        case '÷':
          result = prev / current;
          break;
        default:
          return;
      }
      
      setPreviousValue(result.toString());
      setDisplay(result.toString());
    }
    
    setOperation(op);
    setNewNumber(true);
  };

  const handleEqual = () => {
    if (!operation || !previousValue) return;
    
    const current = parseFloat(display);
    const prev = parseFloat(previousValue);
    let result: number;
    
    switch (operation) {
      case '+':
        result = prev + current;
        break;
      case '-':
        result = prev - current;
        break;
      case '×':
        result = prev * current;
        break;
      case '÷':
        result = prev / current;
        break;
      default:
        return;
    }
    
    setDisplay(result.toString());
    setPreviousValue(null);
    setOperation(null);
    setNewNumber(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setNewNumber(true);
  };

  const handleDelete = () => {
    if (display.length === 1) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Calculator</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Display */}
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <div className="text-right text-2xl font-mono">{display}</div>
            {operation && (
              <div className="text-right text-sm text-gray-500 mt-1">
                {previousValue} {operation}
              </div>
            )}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-4 gap-2">
            {/* First row */}
            <button
              onClick={handleClear}
              className="p-4 text-lg font-medium bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
            >
              C
            </button>
            <button
              onClick={handleDelete}
              className="p-4 text-lg font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              <Delete className="h-6 w-6 mx-auto" />
            </button>
            <button
              onClick={() => handleOperation('÷')}
              className="p-4 text-lg font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              ÷
            </button>
            <button
              onClick={() => handleOperation('×')}
              className="p-4 text-lg font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              ×
            </button>

            {/* Number pad */}
            {[7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumber(num.toString())}
                className="p-4 text-lg font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleOperation('-')}
              className="p-4 text-lg font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              -
            </button>

            {[4, 5, 6].map((num) => (
              <button
                key={num}
                onClick={() => handleNumber(num.toString())}
                className="p-4 text-lg font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleOperation('+')}
              className="p-4 text-lg font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              +
            </button>

            {[1, 2, 3].map((num) => (
              <button
                key={num}
                onClick={() => handleNumber(num.toString())}
                className="p-4 text-lg font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleEqual}
              className="p-4 text-lg font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 row-span-2"
            >
              =
            </button>

            {/* Last row */}
            <button
              onClick={() => handleNumber('0')}
              className="p-4 text-lg font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 col-span-2"
            >
              0
            </button>
            <button
              onClick={handleDecimal}
              className="p-4 text-lg font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              .
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
