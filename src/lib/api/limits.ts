/**
 * API limits. Vercel Functions accept request bodies up to 4.5 MB, so the
 * request limit stays safely below that; images are limited individually as
 * well because base64 inflates them by a third.
 */
export const API_LIMITS = {
  /** Maximum JSON request body, in bytes. */
  maxRequestBytes: 4 * 1024 * 1024,
  /** Maximum decoded size of a single image, in bytes. */
  maxImageBytes: 2 * 1024 * 1024,
  /** Maximum pixels of a single image (protects against decompression bombs). */
  maxImagePixels: 25_000_000,
  /** Maximum certificates in one batch request. */
  maxBatchCertificates: 50,
  /** Maximum length of the certificate wording. */
  maxBodyChars: 5000,
  /** Maximum length of the additional event description. */
  maxDescriptionChars: 2000,
  /** Maximum length of other text fields. */
  maxFieldChars: 300,
  /** DPI range for the PNG endpoint. */
  minPngDpi: 72,
  maxPngDpi: 300,
} as const
