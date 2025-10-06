import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Send, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Replace these with your Supabase credentials
const SUPABASE_URL = 'https://mciekyrhguvelaxysbst.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jaWVreXJoZ3V2ZWxheHlzYnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NzM1MDAsImV4cCI6MjA3NTM0OTUwMH0.jQrbgwYqV6sEB_4NmdhgL2jtH9P4ryYTeZV7t0dlglQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function CaregiverTracker() {
  const [entries, setEntries] = useState([]);
  const [recipientEmail, setRecipientEmail] = useState('lievendg@gmail.com');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentEntry, setCurrentEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '',
    comments: '',
    expenses: ''
  });

  const getCurrentMonth = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { firstDay, lastDay };
  };

  // Load entries for current month
  useEffect(() => {
    loadEntries();
    loadSettings();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const { firstDay, lastDay } = getCurrentMonthRange();
      
      const { data, error } = await supabase
        .from('caregiver_entries')
        .select('*')
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error loading entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('caregiver_settings')
        .select('recipient_email')
        .limit(1)
        .single();

      if (data) {
        setRecipientEmail(data.recipient_email || '');
      }
    } catch (err) {
      console.log('No settings found, starting fresh');
    }
  };

  const saveSettings = async (email) => {
    try {
      const { error } = await supabase
        .from('caregiver_settings')
        .upsert({ id: 1, recipient_email: email });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  const addEntry = async () => {
    if (!currentEntry.hours) return;

    try {
      const { data, error } = await supabase
        .from('caregiver_entries')
        .insert([{
          date: currentEntry.date,
          hours: parseFloat(currentEntry.hours),
          comments: currentEntry.comments || '',
          expenses: parseFloat(currentEntry.expenses) || 0
        }])
        .select();

      if (error) throw error;

      setEntries([data[0], ...entries]);
      setCurrentEntry({
        date: new Date().toISOString().split('T')[0],
        hours: '',
        comments: '',
        expenses: ''
      });
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error adding entry:', err);
    }
  };

  const deleteEntry = async (id) => {
    try {
      const { error } = await supabase
        .from('caregiver_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEntries(entries.filter(e => e.id !== id));
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error deleting entry:', err);
    }
  };

  const calculatePay = (hours) => {
    return (hours * 30).toFixed(2);
  };

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const totalPay = totalHours * 30;
  const totalExpenses = entries.reduce((sum, e) => sum + e.expenses, 0);

  const sendReport = () => {
    if (!recipientEmail) {
      alert('Please enter the recipient email address in the settings above.');
      return;
    }

    const month = getCurrentMonth();
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let emailBody = `Caregiver Hours Report - ${month}\n\n`;
    emailBody += `DAILY ENTRIES:\n`;
    emailBody += `${'='.repeat(60)}\n\n`;
    
    sortedEntries.forEach(entry => {
      const date = new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
      emailBody += `Date: ${date}\n`;
      emailBody += `Hours: ${entry.hours}\n`;
      emailBody += `Pay: $${calculatePay(entry.hours)}\n`;
      if (entry.expenses > 0) {
        emailBody += `Expenses: $${entry.expenses.toFixed(2)}\n`;
      }
      if (entry.comments) {
        emailBody += `Notes: ${entry.comments}\n`;
      }
      emailBody += `\n`;
    });
    
    emailBody += `${'='.repeat(60)}\n`;
    emailBody += `MONTHLY SUMMARY:\n`;
    emailBody += `${'='.repeat(60)}\n\n`;
    emailBody += `Total Hours: ${totalHours.toFixed(1)}\n`;
    emailBody += `Total Pay: $${totalPay.toFixed(2)}\n`;
    emailBody += `Total Expenses: $${totalExpenses.toFixed(2)}\n`;
    emailBody += `\nHourly Rate: $30.00\n`;
    
    const subject = `Caregiver Hours Report - ${month}`;
    const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    window.location.href = mailtoLink;
  };

  const startNewMonth = async () => {
    if (entries.length > 0 && window.confirm('Send report before starting new month?')) {
      sendReport();
    }
    
    // Archive old entries by just reloading current month
    await loadEntries();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Caregiver Hours Tracker</h1>
              <p className="text-gray-600 mt-1">{getCurrentMonth()}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Send to:</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => {
                    setRecipientEmail(e.target.value);
                    saveSettings(e.target.value);
                  }}
                  className="w-48 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={sendReport}
                disabled={entries.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} />
                Send Report
              </button>
              <button
                onClick={startNewMonth}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                New Month
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Entry Form */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Add Daily Entry</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={currentEntry.date}
                  onChange={(e) => setCurrentEntry({...currentEntry, date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hours Worked</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={currentEntry.hours}
                  onChange={(e) => setCurrentEntry({...currentEntry, hours: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="8"
                />
                {currentEntry.hours && (
                  <p className="text-sm text-indigo-600 mt-1">
                    Pay: ${calculatePay(parseFloat(currentEntry.hours))}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Expenses ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentEntry.expenses}
                  onChange={(e) => setCurrentEntry({...currentEntry, expenses: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                <textarea
                  value={currentEntry.comments}
                  onChange={(e) => setCurrentEntry({...currentEntry, comments: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                  placeholder="Notes about the day"
                  rows="3"
                />
              </div>
            </div>
            <button
              onClick={addEntry}
              disabled={!currentEntry.hours}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={18} />
              Add Entry
            </button>
          </div>

          {/* Entries List */}
          {entries.length > 0 ? (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Daily Entries</h2>
              <div className="space-y-2">
                {entries.map(entry => (
                  <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="font-semibold text-gray-800">
                          {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <span className="text-indigo-600 font-medium">{entry.hours}h</span>
                        <span className="text-green-600 font-medium">${calculatePay(entry.hours)}</span>
                        {entry.expenses > 0 && (
                          <span className="text-orange-600 font-medium">Expenses: ${entry.expenses.toFixed(2)}</span>
                        )}
                      </div>
                      {entry.comments && (
                        <p className="text-gray-600 text-sm whitespace-pre-wrap">{entry.comments}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6 text-center py-8 text-gray-500">
              No entries for this month yet. Add your first entry above!
            </div>
          )}

          {/* Summary */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Monthly Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <p className="text-sm opacity-90 mb-1">Total Hours</p>
                <p className="text-3xl font-bold">{totalHours.toFixed(1)}</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <p className="text-sm opacity-90 mb-1">Total Pay</p>
                <p className="text-3xl font-bold">${totalPay.toFixed(2)}</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <p className="text-sm opacity-90 mb-1">Total Expenses</p>
                <p className="text-3xl font-bold">${totalExpenses.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
