export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;  // ISO 8601
  endDate: string;    // ISO 8601
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
}
