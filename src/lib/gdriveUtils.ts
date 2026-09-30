/**
 * Google Drive URL utilities for validation, parsing, and embed generation
 */

export type GDriveFileType = 'document' | 'spreadsheet' | 'presentation' | 'file';

export interface GDriveValidationResult {
  valid: boolean;
  fileId?: string;
  error?: string;
}

export interface GDriveFileInfo {
  fileId: string;
  fileType: GDriveFileType;
  embedUrl: string;
}

/**
 * Validates a Google Drive URL and extracts the file ID
 */
export function validateGDriveUrl(url: string): GDriveValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL tidak boleh kosong' };
  }

  const trimmedUrl = url.trim();

  // Check if it's a Google domain
  if (!trimmedUrl.includes('google.com') && !trimmedUrl.includes('drive.google')) {
    return { valid: false, error: 'Bukan URL Google Drive yang valid' };
  }

  // Try to extract file ID
  const fileId = extractFileId(trimmedUrl);
  
  if (!fileId) {
    return { valid: false, error: 'Tidak dapat menemukan File ID dalam URL' };
  }

  return { valid: true, fileId };
}

/**
 * Extracts file ID from various Google Drive URL formats
 */
export function extractFileId(url: string): string | null {
  const patterns = [
    // Standard file view: /file/d/{ID}/view
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    // Document: /document/d/{ID}
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    // Spreadsheet: /spreadsheets/d/{ID}
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    // Presentation: /presentation/d/{ID}
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    // Open URL: ?id={ID}
    /[?&]id=([a-zA-Z0-9_-]+)/,
    // Folders: /folders/{ID}
    /\/folders\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Detects the file type based on URL pattern
 */
export function detectGDriveFileType(url: string): GDriveFileType {
  if (url.includes('docs.google.com/document')) {
    return 'document';
  }
  if (url.includes('docs.google.com/spreadsheets')) {
    return 'spreadsheet';
  }
  if (url.includes('docs.google.com/presentation')) {
    return 'presentation';
  }
  return 'file';
}

/**
 * Generates the embed URL for iframe preview
 */
export function getGDriveEmbedUrl(fileId: string, fileType: GDriveFileType): string {
  switch (fileType) {
    case 'document':
      return `https://docs.google.com/document/d/${fileId}/preview`;
    case 'spreadsheet':
      return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    case 'presentation':
      return `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`;
    case 'file':
    default:
      return `https://drive.google.com/file/d/${fileId}/preview`;
  }
}

/**
 * Generates thumbnail URL for Google Drive file
 * Works for documents, spreadsheets, presentations, and other files
 */
export function getGDriveThumbnailUrl(fileId: string, size: number = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/**
 * Extracts complete file info from a Google Drive URL
 */
export function extractFileInfo(url: string): GDriveFileInfo & { thumbnailUrl: string } | null {
  const validation = validateGDriveUrl(url);
  
  if (!validation.valid || !validation.fileId) {
    return null;
  }

  const fileType = detectGDriveFileType(url);
  const embedUrl = getGDriveEmbedUrl(validation.fileId, fileType);
  const thumbnailUrl = getGDriveThumbnailUrl(validation.fileId);

  return {
    fileId: validation.fileId,
    fileType,
    embedUrl,
    thumbnailUrl,
  };
}

/**
 * Returns label for file type in Indonesian
 */
export function getFileTypeLabel(fileType: GDriveFileType): string {
  switch (fileType) {
    case 'document':
      return 'Google Docs';
    case 'spreadsheet':
      return 'Google Sheets';
    case 'presentation':
      return 'Google Slides';
    case 'file':
    default:
      return 'File';
  }
}

/**
 * Returns color class for file type badge
 */
export function getFileTypeColor(fileType: GDriveFileType): string {
  switch (fileType) {
    case 'document':
      return 'bg-blue-100 text-blue-700';
    case 'spreadsheet':
      return 'bg-green-100 text-green-700';
    case 'presentation':
      return 'bg-orange-100 text-orange-700';
    case 'file':
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Returns icon component for file type
 */
import { FileText, Table2, Presentation, File, LucideIcon } from 'lucide-react';

export function getFileTypeIcon(fileType: GDriveFileType): LucideIcon {
  switch (fileType) {
    case 'document':
      return FileText;
    case 'spreadsheet':
      return Table2;
    case 'presentation':
      return Presentation;
    case 'file':
    default:
      return File;
  }
}
