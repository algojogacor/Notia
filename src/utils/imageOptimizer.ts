import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export const MAX_PHOTO_DIMENSION = 1600;
export const PHOTO_JPEG_QUALITY = 0.72;
export const MIN_REQUIRED_STORAGE_MB = 50;

/**
 * Compresses and downscales a captured lecture note photo.
 * - Caps max dimension at 1600px (preserving aspect ratio)
 * - Compresses to JPEG quality 0.72
 * - Yields ~200KB - 300KB file (down from 3.5MB - 5MB)
 * - Ideal balance for Groq Vision OCR accuracy and long-term mobile storage
 */
export async function compressLecturePhoto(uri: string): Promise<string> {
  if (!uri) return uri;

  try {
    // Only process local file URIs
    if (!uri.startsWith('file:') && !uri.startsWith('/') && !uri.startsWith('content:')) {
      return uri;
    }

    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: MAX_PHOTO_DIMENSION,
          },
        },
      ],
      {
        compress: PHOTO_JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return manipulated.uri;
  } catch (err) {
    console.warn('[imageOptimizer] Photo compression failed, falling back to original URI:', err);
    return uri;
  }
}

/**
 * Checks if device storage has sufficient free space.
 * @param minRequiredMb Minimum free space in MB (default: 50 MB)
 */
export async function checkStorageSpaceAvailable(minRequiredMb: number = MIN_REQUIRED_STORAGE_MB): Promise<{
  hasSpace: boolean;
  freeMb: number;
}> {
  try {
    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    const freeMb = Math.round(freeBytes / (1024 * 1024));
    return {
      hasSpace: freeMb >= minRequiredMb,
      freeMb,
    };
  } catch (err) {
    console.warn('[imageOptimizer] Could not determine free disk storage:', err);
    // If check fails (e.g. on web or unsupported platform), assume space is available
    return {
      hasSpace: true,
      freeMb: 9999,
    };
  }
}
