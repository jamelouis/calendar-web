import { useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { useEventStore } from './store/eventStore';
import { downloadICS } from './lib/ics';

function App() {
  const {
    events,
    selectedDate,
    isLoading,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    setSelectedDate,
  } = useEventStore();

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleExport = () => {
    downloadICS(events);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <Calendar
        events={events}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onCreateEvent={createEvent}
        onUpdateEvent={updateEvent}
        onDeleteEvent={deleteEvent}
        onExportICS={handleExport}
        isLoading={isLoading}
      />
    </div>
  );
}

export default App
