import type { AIEditorialProvider } from "./provider";
import { AiDisabledError } from "./provider";

/**
 * The default provider when no API key is configured or AI is switched off.
 * Every method throws AiDisabledError; the pipeline catches it and falls back to
 * the rule-based path, so collection/scoring keep working without AI.
 */
export class DisabledAIProvider implements AIEditorialProvider {
  readonly name = "disabled";
  readonly model = "none";
  readonly enabled = false;

  private reject(): never {
    throw new AiDisabledError();
  }

  classifyNews() {
    return this.reject();
  }
  scoreImportance() {
    return this.reject();
  }
  evaluateTrust() {
    return this.reject();
  }
  generatePersianDraft() {
    return this.reject();
  }
  generateSeoFields() {
    return this.reject();
  }
  generateEditorialFields() {
    return this.reject();
  }
  generateSocialSuggestions() {
    return this.reject();
  }
}
