import type { Exercise } from '../db/types'

/** Media resolution layer — the ONLY place exercise media URLs are chosen.
 *
 *  Free-tier ExerciseDB media is watermarked and referenced as-is from the
 *  CDN. Upgrading to a paid plan later (or self-hosting media) is a
 *  one-line change: point MEDIA_BASE_OVERRIDE at the new base and every
 *  screen picks it up. */
const MEDIA_BASE_OVERRIDE: string | null = null

function resolve(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (!MEDIA_BASE_OVERRIDE) return url
  return url.replace(/^https?:\/\/[^/]+/, MEDIA_BASE_OVERRIDE)
}

/** Best still image for list thumbnails / detail headers. */
export function exerciseImage(
  ex: Pick<Exercise, 'imageUrl' | 'imageUrls'>,
  preferred: '360p' | '480p' | '720p' | '1080p' = '480p',
): string | undefined {
  return resolve(ex.imageUrls?.[preferred] ?? ex.imageUrl ?? ex.imageUrls?.['360p'])
}

/** Demo video, when the plan provides one. */
export function exerciseVideo(ex: Pick<Exercise, 'videoUrl'>): string | undefined {
  return resolve(ex.videoUrl)
}
