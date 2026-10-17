import React, { useState, useEffect, useRef } from 'react';
import { DailyUpdate, DeadlineStatus } from '@shared/types';
import {
  CheckCircle,
  Plus,
  Trash2,
  Save,
  Send,
  AlertCircle,
  Lock,
  ListTodo,
  Zap,
  ShieldAlert,
  Compass,
  Check,
} from 'lucide-react';

interface UpdateFormProps {
  initialUpdate: DailyUpdate | null;
  deadlineStatus: DeadlineStatus | null;
  onSave: (payload: {
    todaysTasks: string[];
    suddenTasks: string[];
    blockers: string[];
    plansGoingForward: string[];
    submit: boolean;
  }) => Promise<void>;
  loading: boolean;
  insertedItemTrigger?: { section: 'todaysTasks' | 'plansGoingForward'; text: string } | null;
}

export const UpdateForm: React.FC<UpdateFormProps> = ({
  initialUpdate,
  deadlineStatus,
  onSave,
  loading,
  insertedItemTrigger,
}) => {
  const isLocked = deadlineStatus?.isLocked || initialUpdate?.status === 'locked';

  const [todaysTasks, setTodaysTasks] = useState<string[]>(['']);
  const [suddenTasks, setSuddenTasks] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [plansGoingForward, setPlansGoingForward] = useState<string[]>(['']);

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync with initial update when loaded
  useEffect(() => {
    if (initialUpdate) {
      setTodaysTasks(initialUpdate.todaysTasks.length > 0 ? initialUpdate.todaysTasks : ['']);
      setSuddenTasks(initialUpdate.suddenTasks);
      setBlockers(initialUpdate.blockers);
      setPlansGoingForward(initialUpdate.plansGoingForward.length > 0 ? initialUpdate.plansGoingForward : ['']);
    }
  }, [initialUpdate]);

  // Insert item from Assigned Issues click
  useEffect(() => {
    if (!insertedItemTrigger || isLocked) return;

    const { section, text } = insertedItemTrigger;
    if (section === 'todaysTasks') {
      setTodaysTasks(prev => {
        const filtered = prev.filter(t => t.trim().length > 0);
        return [...filtered, text];
      });
      setStatusMessage({ text: `Added issue to Today's Tasks!`, type: 'success' });
    } else if (section === 'plansGoingForward') {
      setPlansGoingForward(prev => {
        const filtered = prev.filter(t => t.trim().length > 0);
        return [...filtered, text];
      });
      setStatusMessage({ text: `Added issue to Plans Going Forward!`, type: 'success' });
    }
  }, [insertedItemTrigger, isLocked]);

  // Bullet manipulation helpers
  const handleItemChange = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    const updated = [...list];
    updated[index] = value;
    setList(updated);
  };

  const handleAddItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList([...list, '']);
  };

  const handleRemoveItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    index: number
  ) => {
    const updated = list.filter((_, i) => i !== index);
    setList(updated.length > 0 ? updated : ['']);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    index: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const updated = [...list];
      updated.splice(index + 1, 0, '');
      setList(updated);
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>(`input[data-section]`);
        // focus next
      }, 50);
    }
  };

  const handleSubmit = async (submit: boolean) => {
    setStatusMessage(null);

    const cleanTodays = todaysTasks.map(t => t.trim()).filter(Boolean);
    const cleanSudden = suddenTasks.map(t => t.trim()).filter(Boolean);
    const cleanBlockers = blockers.map(t => t.trim()).filter(Boolean);
    const cleanPlans = plansGoingForward.map(t => t.trim()).filter(Boolean);

    if (submit && cleanTodays.length === 0) {
      setStatusMessage({ text: "Please enter at least one task under 'Today\'s Tasks'.", type: 'error' });
      return;
    }

    try {
      await onSave({
        todaysTasks: cleanTodays,
        suddenTasks: cleanSudden,
        blockers: cleanBlockers,
        plansGoingForward: cleanPlans,
        submit,
      });

      setStatusMessage({
        text: submit
          ? 'Daily update submitted successfully! It will be included in the scheduled 11:30 PM report.'
          : 'Draft saved. You can continue editing until 11:30 PM.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to save update.', type: 'error' });
    }
  };

  const renderSection = (
    title: string,
    description: string,
    icon: React.ReactNode,
    items: string[],
    setItems: React.Dispatch<React.SetStateAction<string[]>>,
    badgeColor: string,
    sectionKey: string,
    placeholder: string
  ) => {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${badgeColor}`}>
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
          </div>
          {!isLocked && (
            <button
              type="button"
              onClick={() => handleAddItem(items, setItems)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-adn-600 hover:text-adn-800 bg-adn-50 hover:bg-adn-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Point</span>
            </button>
          )}
        </div>

        <div className="space-y-2 mt-3">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2 group">
              <span className="text-slate-400 select-none text-xs font-mono">•</span>
              <input
                type="text"
                disabled={isLocked}
                data-section={sectionKey}
                value={item}
                placeholder={placeholder}
                onChange={e => handleItemChange(items, setItems, index, e.target.value)}
                onKeyDown={e => handleKeyDown(e, items, setItems, index)}
                className={`flex-1 text-sm rounded-lg border px-3 py-2 transition-all outline-none ${
                  isLocked
                    ? 'bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-800 focus:border-adn-500 focus:ring-2 focus:ring-adn-100'
                }`}
              />
              {!isLocked && (
                <button
                  type="button"
                  title="Remove item"
                  onClick={() => handleRemoveItem(items, setItems, index)}
                  className="opacity-40 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-xs text-slate-400 italic py-2">
              No items added. Click &quot;Add Point&quot; to add one.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Status Notice / Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* Lock banner if locked */}
      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="text-xs sm:text-sm">
            <strong className="font-bold">This update is locked.</strong> The 11:30 PM cutoff has passed. Changes can no longer be made to this report.
          </div>
        </div>
      )}

      {/* 4 Required Sections */}
      <div className="grid grid-cols-1 gap-5">
        {/* 1. Today's Tasks */}
        {renderSection(
          "Today's Tasks",
          "Planned core tasks and scheduled deliverables worked on today (Required)",
          <ListTodo className="w-4 h-4 text-blue-700" />,
          todaysTasks,
          setTodaysTasks,
          'bg-blue-100 text-blue-800',
          'todaysTasks',
          'e.g. Completed synthesis flow and timing constraint verification for CPU core'
        )}

        {/* 2. Sudden Tasks */}
        {renderSection(
          'Sudden Tasks',
          'Unscheduled urgent requests, critical bug fixes, or unexpected meetings',
          <Zap className="w-4 h-4 text-purple-700" />,
          suddenTasks,
          setSuddenTasks,
          'bg-purple-100 text-purple-800',
          'suddenTasks',
          'e.g. Investigated sudden thermal throttling report from lab bench #3'
        )}

        {/* 3. Blockers */}
        {renderSection(
          'Blockers',
          'Impediments, missing dependencies, external waiting, or equipment issues',
          <ShieldAlert className="w-4 h-4 text-rose-700" />,
          blockers,
          setBlockers,
          'bg-rose-100 text-rose-800',
          'blockers',
          'e.g. Waiting on updated IO pad timing library from foundry partner'
        )}

        {/* 4. Plans Going Forward */}
        {renderSection(
          'Plans Going Forward',
          'Key priorities and actionable items planned for the next working day',
          <Compass className="w-4 h-4 text-emerald-700" />,
          plansGoingForward,
          setPlansGoingForward,
          'bg-emerald-100 text-emerald-800',
          'plansGoingForward',
          'e.g. Run overnight DRC / LVS checks and review slack violations'
        )}
      </div>

      {/* Action Footer */}
      {!isLocked && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500">
            {initialUpdate?.status === 'submitted' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                <Check className="w-4 h-4" /> Already submitted. You can still modify and re-save until 11:30 PM.
              </span>
            ) : (
              <span>Editable until 11:30 PM. At 11:30 PM, this update is automatically locked.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-98 transition-all"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-adn-600 to-adn-700 text-white text-xs font-bold shadow-md shadow-adn-600/20 hover:from-adn-700 hover:to-adn-800 active:scale-98 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Daily Update</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
