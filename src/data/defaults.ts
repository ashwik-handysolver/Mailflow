import { TeamSettings } from '../types/outreach';

/**
 * Starting settings for a new workspace. Profile and sender fields are blank;
 * a signed-in account fills them from its own name and email.
 */
export const DEFAULT_SETTINGS: TeamSettings = {
  userName: '',
  userRole: '',
  teamName: '',
  senderDisplayName: '',
  senderEmail: '',
  defaultSignatureHtml: '',
  includeSignatureByDefault: true,
  trackOpens: true,
  trackClicks: true,
  confirmBeforeBulkSend: true,
};

/** The old demo persona's address; a cached profile still using it is replaced like a blank one. */
export const LEGACY_DEMO_SENDER = 'elena.vance@mailflow-demo.io';

/**
 * IDs the app used to seed as demo content. Browsers that cached the old demo
 * workspace have these removed on load so they never reach an account.
 */
const DEMO_ID = /^(lead_([1-9]|1[0-8])|tpl_[1-6]|camp_[1-6]|act_log_([1-9]|1[0-2]))$/;
export const isDemoId = (id: string) => DEMO_ID.test(id);
