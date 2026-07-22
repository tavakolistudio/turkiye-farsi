import "server-only";
import { prisma } from "@/lib/db";

/**
 * Daily AI budget guard. Sums the estimated AI cost of today's batches and
 * refuses further AI calls once the configured cap is reached. Enforcement is
 * best-effort but real: the pipeline checks remaining budget before every AI
 * call and degrades to the rule-based path when exhausted.
 */

function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getTodaySpendUsd(now = new Date()): Promise<number> {
  const agg = await prisma.newsFetchBatch.aggregate({
    _sum: { estimatedCost: true },
    where: { startedAt: { gte: startOfToday(now) } },
  });
  return agg._sum.estimatedCost ?? 0;
}

/** Track spend within a single run and against the daily cap. */
export class BudgetGuard {
  private spent: number;
  constructor(
    private readonly dailyBudget: number,
    priorSpendToday: number,
  ) {
    this.spent = priorSpendToday;
  }

  static async create(dailyBudget: number): Promise<BudgetGuard> {
    return new BudgetGuard(dailyBudget, await getTodaySpendUsd());
  }

  /** True if there is budget left for another call. */
  canSpend(): boolean {
    return this.dailyBudget <= 0 ? false : this.spent < this.dailyBudget;
  }

  record(costUsd: number): void {
    this.spent += Math.max(0, costUsd);
  }

  get remaining(): number {
    return Math.max(0, this.dailyBudget - this.spent);
  }

  /** True once spend has crossed 90% of the cap (for the budget-warning notice). */
  nearLimit(): boolean {
    return this.dailyBudget > 0 && this.spent >= this.dailyBudget * 0.9;
  }
}
