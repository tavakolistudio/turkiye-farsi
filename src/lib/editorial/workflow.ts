import type { ArticleStatus } from "@prisma/client";
import type { PermissionKey } from "@/server/rbac/permissions";
import { PERMISSIONS } from "@/server/rbac/permissions";

export const WORKFLOW_ACTIONS = [
  "submit_review",
  "request_correction",
  "approve",
  "reject",
  "schedule",
  "cancel_schedule",
  "publish",
  "unpublish",
  "archive",
] as const;

export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export interface WorkflowTransition {
  action: WorkflowAction;
  from: readonly ArticleStatus[];
  to: ArticleStatus;
  permission: PermissionKey;
  revision: boolean;
  noteRequired?: boolean;
}

export const WORKFLOW_TRANSITIONS: Record<WorkflowAction, WorkflowTransition> = {
  submit_review: {
    action: "submit_review",
    from: ["DRAFT", "NEEDS_CORRECTION"],
    to: "IN_REVIEW",
    permission: PERMISSIONS.ARTICLE_SUBMIT_REVIEW,
    revision: true,
  },
  request_correction: {
    action: "request_correction",
    from: ["IN_REVIEW"],
    to: "NEEDS_CORRECTION",
    permission: PERMISSIONS.ARTICLE_REQUEST_CORRECTION,
    revision: false,
    noteRequired: true,
  },
  approve: {
    action: "approve",
    from: ["IN_REVIEW"],
    to: "APPROVED",
    permission: PERMISSIONS.ARTICLE_APPROVE,
    revision: true,
  },
  reject: {
    action: "reject",
    from: ["IN_REVIEW"],
    to: "REJECTED",
    permission: PERMISSIONS.ARTICLE_REJECT,
    revision: false,
    noteRequired: true,
  },
  schedule: {
    action: "schedule",
    from: ["APPROVED"],
    to: "SCHEDULED",
    permission: PERMISSIONS.ARTICLE_SCHEDULE,
    revision: true,
  },
  cancel_schedule: {
    action: "cancel_schedule",
    from: ["SCHEDULED"],
    to: "APPROVED",
    permission: PERMISSIONS.ARTICLE_SCHEDULE,
    revision: false,
  },
  publish: {
    action: "publish",
    from: ["APPROVED", "SCHEDULED", "UNPUBLISHED"],
    to: "PUBLISHED",
    permission: PERMISSIONS.ARTICLE_PUBLISH,
    revision: true,
  },
  unpublish: {
    action: "unpublish",
    from: ["PUBLISHED"],
    to: "UNPUBLISHED",
    permission: PERMISSIONS.ARTICLE_UNPUBLISH,
    revision: true,
    noteRequired: true,
  },
  archive: {
    action: "archive",
    from: ["DRAFT", "NEEDS_CORRECTION", "APPROVED", "REJECTED", "UNPUBLISHED", "PUBLISHED"],
    to: "ARCHIVED",
    permission: PERMISSIONS.ARTICLE_ARCHIVE,
    revision: true,
  },
};

export function transitionFor(status: ArticleStatus, action: WorkflowAction) {
  const transition = WORKFLOW_TRANSITIONS[action];
  return transition.from.includes(status) ? transition : null;
}

export function availableWorkflowActions(status: ArticleStatus): WorkflowAction[] {
  return WORKFLOW_ACTIONS.filter((action) => WORKFLOW_TRANSITIONS[action].from.includes(status));
}
