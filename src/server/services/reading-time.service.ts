import { bodyJsonText } from "@/lib/editorial/content";
import { countWords } from "@/lib/reading-time";

const PERSIAN_WORDS_PER_MINUTE = 200;

export const readingTimeService = {
  calculate(bodyJson: unknown) {
    const words = countWords(bodyJsonText(bodyJson));
    return { words, minutes: Math.max(1, Math.ceil(words / PERSIAN_WORDS_PER_MINUTE)) };
  },
};
