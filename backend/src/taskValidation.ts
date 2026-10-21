import { z } from 'zod';

const date = z
  .union([z.iso.date(), z.iso.datetime({ offset: true, local: true })])
  .nullable();
const fields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  status: z.string().trim().min(1).max(100),
  priority: z.enum(['low', 'medium', 'high']),
  startedAt: date.optional(),
  dueDate: date.optional(),
  expectedFinishAt: date.optional(),
  comment: z.string().max(1000).nullable().optional(),
});
export const taskSchema = fields
  .extend({
    description: fields.shape.description.default(''),
    status: fields.shape.status.default('todo'),
    priority: fields.shape.priority.default('medium'),
  })
  .strict();
// Defaults belong only to creation, never to a partial update.
export const updateTaskSchema = fields
  .partial()
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required'
  );
export function databaseFields(body: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ])
  );
}
