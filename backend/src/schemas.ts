import { z } from 'zod';

export const prioritySchema = z.enum(['low', 'medium', 'high']);

export const taskStatusSchema = z.enum(['todo', 'in progress', 'done']);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  status: taskStatusSchema.optional().default('todo'),
  priority: prioritySchema.optional().default('medium'),
  startedAt: z.string().max(50).nullable().optional(),
  dueDate: z.string().max(50).nullable().optional(),
  expectedFinishAt: z.string().max(50).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    status: taskStatusSchema.optional(),
    priority: prioritySchema.optional(),
    startedAt: z.string().datetime().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    expectedFinishAt: z.string().datetime().nullable().optional(),
    comment: z.string().max(1000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const aiSuggestSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
});
