import { z } from "zod";
import { WORKFLOW_ACTIONS } from "@/lib/editorial/workflow";

export const autosaveSchema = z.object({
  version: z.number().int().nonnegative(),
  title: z.string().trim().min(3).max(300).optional(),
  subtitle: z.string().trim().max(300).nullable().optional(),
  summary: z.string().trim().max(500).nullable().optional(),
  bodyJson: z.unknown().optional(),
  whyItMatters: z.string().trim().max(2_000).nullable().optional(),
  whoIsAffected: z.string().trim().max(2_000).nullable().optional(),
  whatToDo: z.string().trim().max(2_000).nullable().optional(),
});

export const workflowSchema = z.object({
  action: z.enum(WORKFLOW_ACTIONS),
  version: z.number().int().nonnegative().optional(),
  note: z.string().trim().max(4_000).optional(),
  assignedEditorId: z.string().cuid().nullable().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

export const correctionCreateSchema = z.object({
  title: z.string().trim().min(3).max(300),
  description: z.string().trim().min(3).max(5_000),
  correctionType: z.enum(["MINOR", "MAJOR", "FACTUAL", "LEGAL", "SOURCE_UPDATE"]).default("MINOR"),
  order: z.number().int().min(0).max(10_000).default(0),
});

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  parentId: z.string().cuid().optional(),
});

export const previewCreateSchema = z.object({
  expiresInMinutes: z.number().int().min(5).max(24 * 60).default(60),
});
