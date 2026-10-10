import type { LessonModule } from '../../module';
import ciselneSustavy from './ciselne-sustavy';
import kombinacneObvody from './kombinacne-obvody';
import klopneObvody from './klopne-obvody';
import logickeCleny from './logicke-cleny';

/** Číslicová technika: číselné sústavy, logické členy, kombinačné a sekvenčné obvody. Poradie v poli je poradie lekcií v kapitole. */
export const MODULES: readonly LessonModule[] = [
  ciselneSustavy,
  logickeCleny,
  kombinacneObvody,
  klopneObvody,
];
