import { z } from 'zod';
import { taskSchema } from './taskValidation.js';
export const boardColumnSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(100),
  })
  .strict();
export const boardTaskSchema = taskSchema.extend({
  id: z.string().uuid(),
  workspaceId: z.string().uuid().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
  archivedBy: z.string().uuid().nullable().optional(),
});
export const boardSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    columns: z.array(boardColumnSchema).min(1).max(1000),
    tasks: z.array(boardTaskSchema).max(10000),
  })
  .strict()
  .superRefine((b, ctx) => {
    const ids = new Set(b.columns.map((c) => c.id));
    if (
      ids.size !== b.columns.length ||
      new Set(b.tasks.map((t) => t.id)).size !== b.tasks.length ||
      b.tasks.some((t) => !ids.has(t.status))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid or duplicate board identities',
      });
  });
export const importSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    deviceId: z.string().uuid(),
    columns: z.array(boardColumnSchema).min(1).max(7),
    tasks: z.array(boardTaskSchema).max(10000),
    mapping: z.record(z.string(), z.string().min(1).max(100)),
  })
  .strict();
