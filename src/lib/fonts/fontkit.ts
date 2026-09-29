import fontkitImpl from '@pdf-lib/fontkit'
import type * as Fontkit from '@pdf-lib/fontkit'

/** Typed handle to fontkit (used for measuring and by pdf-lib for embedding). */
export const fontkit = fontkitImpl as typeof Fontkit
export type FontkitFont = Fontkit.Font
