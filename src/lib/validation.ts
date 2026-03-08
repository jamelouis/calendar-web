import { z } from 'zod';

export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isAllDay: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date must be after start date"
});

export type ValidatedEvent = z.infer<typeof CalendarEventSchema>;
