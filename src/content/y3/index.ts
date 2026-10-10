import type { LessonModule } from '../module';
import { MODULES as AC } from './ac';
import { MODULES as DIGITAL } from './digital';
import { MODULES as ELECTRONICS } from './electronics';
import { MODULES as MACHINES } from './machines';
import { MODULES as POWER } from './power';

/** Lekcie 3. ročníka – doplnené k základom: pokročilé striedavé obvody, stroje, elektronika a ďalšie. */
export const Y3_MODULES: readonly LessonModule[] = [...AC, ...MACHINES, ...ELECTRONICS, ...DIGITAL, ...POWER];
