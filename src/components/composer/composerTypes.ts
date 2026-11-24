import { Lead } from '../../types/outreach';
import { PersonalizedEmailResult } from '../../utils/personalization';

export type ComposerStep = 1 | 2 | 3;

export const STEPS: { step: ComposerStep; label: string }[] = [
  { step: 1, label: 'Audience' },
  { step: 2, label: 'Message' },
  { step: 3, label: 'Review & send' },
];

/** `null` = nothing chosen yet; 'scratch' = blank email. */
export type TemplateChoice = string | 'scratch' | null;

export interface RecipientPersonalization {
  lead: Lead;
  result: PersonalizedEmailResult;
  validEmail: boolean;
}
