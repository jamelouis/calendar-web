import { useState, useEffect } from 'react';
import type { CalendarEvent } from '../types';
import { Button } from './Button';
import { X } from 'lucide-react';

interface EventFormProps {
  event?: CalendarEvent | null;
  selectedDate: Date;
  onSave: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function EventForm({ event, selectedDate, onSave, onCancel, onDelete }: EventFormProps) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay || false);

  // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Format date for date input (YYYY-MM-DD)
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getInitialStartDate = () => {
    if (event?.startDate) {
      const date = new Date(event.startDate);
      return isAllDay ? formatDate(date) : formatDateTimeLocal(date);
    }
    return formatDateTimeLocal(selectedDate);
  };

  const getInitialEndDate = () => {
    if (event?.endDate) {
      const date = new Date(event.endDate);
      return isAllDay ? formatDate(date) : formatDateTimeLocal(date);
    }
    // Default end date is 1 hour after start
    const endDate = new Date(selectedDate);
    endDate.setHours(endDate.getHours() + 1);
    return formatDateTimeLocal(endDate);
  };

  const [startDate, setStartDate] = useState(getInitialStartDate());
  const [endDate, setEndDate] = useState(getInitialEndDate());

  // Update inputs when isAllDay changes
  useEffect(() => {
    if (isAllDay) {
      setStartDate(startDate.split('T')[0]);
      setEndDate(endDate.split('T')[0]);
    } else {
      // Convert date to datetime
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime())) setStartDate(formatDateTimeLocal(start));
      if (!isNaN(end.getTime())) setEndDate(formatDateTimeLocal(end));
    }
  }, [isAllDay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalStartDate: string;
    let finalEndDate: string;

    if (isAllDay) {
      // All-day events: start at midnight, end at 23:59:59
      finalStartDate = `${startDate}T00:00:00`;
      finalEndDate = `${endDate}T23:59:59`;
    } else {
      finalStartDate = startDate;
      finalEndDate = endDate;
    }

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      isAllDay,
      startDate: finalStartDate,
      endDate: finalEndDate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-4">
          {event ? 'Edit Event' : 'New Event'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Event title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add details..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="allDay" className="text-sm">All day</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start</label>
              <input
                type={isAllDay ? 'date' : 'datetime-local'}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End</label>
              <input
                type={isAllDay ? 'date' : 'datetime-local'}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            {onDelete && (
              <Button type="button" variant="danger" onClick={onDelete} className="mr-auto">
                Delete
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {event ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
