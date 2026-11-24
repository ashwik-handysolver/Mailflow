import { AttachmentMeta } from '../types/outreach';

/** Limits in line with common email providers (e.g. Gmail, SES, SendGrid). */
export const ATTACHMENT_LIMITS = {
  maxFiles: 10,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
} as const;

/** Extensions that mail providers and spam filters reject outright. */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'js', 'jse', 'vbs', 'vbe', 'ps1', 'jar', 'apk', 'app', 'dmg', 'sh', 'cpl', 'reg', 'hta', 'lnk',
]);

export interface PendingAttachment {
  id: string;
  file: File;
}

export function toMeta(file: Pick<File, 'name' | 'size' | 'type'>): AttachmentMeta {
  return { name: file.name, size: file.size, type: file.type };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function totalBytes(files: { size: number }[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export interface AttachmentCheck<T> {
  accepted: T[];
  /** One readable message per rejected file. */
  errors: string[];
}

/**
 * Decides which incoming files can be added to the ones already attached,
 * enforcing count, per-file size, total size, blocked types and duplicates.
 */
export function checkAttachments<T extends { name: string; size: number }>(existing: { name: string; size: number }[], incoming: T[]): AttachmentCheck<T> {
  const accepted: T[] = [];
  const errors: string[] = [];
  let count = existing.length;
  let total = totalBytes(existing);
  const seen = new Set(existing.map((f) => `${f.name}:${f.size}`));

  for (const file of incoming) {
    const key = `${file.name}:${file.size}`;
    if (seen.has(key)) {
      errors.push(`${file.name} is already attached.`);
    } else if (BLOCKED_EXTENSIONS.has(extensionOf(file.name))) {
      errors.push(`${file.name} can't be sent — .${extensionOf(file.name)} files are blocked by email providers.`);
    } else if (file.size === 0) {
      errors.push(`${file.name} is empty.`);
    } else if (file.size > ATTACHMENT_LIMITS.maxFileBytes) {
      errors.push(`${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(ATTACHMENT_LIMITS.maxFileBytes)} per file.`);
    } else if (count >= ATTACHMENT_LIMITS.maxFiles) {
      errors.push(`${file.name} wasn't added — you can attach up to ${ATTACHMENT_LIMITS.maxFiles} files.`);
    } else if (total + file.size > ATTACHMENT_LIMITS.maxTotalBytes) {
      errors.push(`${file.name} wasn't added — attachments can total ${formatBytes(ATTACHMENT_LIMITS.maxTotalBytes)} at most.`);
    } else {
      accepted.push(file);
      seen.add(key);
      count += 1;
      total += file.size;
    }
  }
  return { accepted, errors };
}
