/**
 * Záznam aktivity online účtu, ktorý vidí správca aplikácie: registrácia, prihlásenie,
 * otvorenie aplikácie (raz za deň v jednej relácii prehliadača), dokončená lekcia a cvičenie.
 * Zapisuje sa len pri online účte; keď server nie je dostupný, udalosť sa jednoducho vynechá.
 */
import { cloudLogActivity, loadCloudSession, type ActivityKind, type CloudSession } from './cloud';
import { dayKey, onLearningEvent } from './progress';

const VISIT_KEY = 'elektrolab:visit';
/** Najviac toľko tém cvičenia sa zapíše (záznam má obmedzenú veľkosť). */
const MAX_TOPICS = 20;

function markVisit(userId: string): boolean {
  const mark = `${userId}:${dayKey()}`;
  try {
    if (sessionStorage.getItem(VISIT_KEY) === mark) return false;
    sessionStorage.setItem(VISIT_KEY, mark);
  } catch {
    // Bez úložiska sa návšteva zapíše pri každom otvorení – nevadí to.
  }
  return true;
}

/** Zapíše udalosť pod prihlásený online účet; chyby sa ticho ignorujú. */
export function logActivity(kind: ActivityKind, detail: Record<string, unknown> = {}, session?: CloudSession): void {
  const s = session ?? loadCloudSession();
  if (!s) return;
  if (kind === 'login' || kind === 'register') markVisit(s.user.id);
  void cloudLogActivity(kind, detail, { session: s }).catch(() => {});
}

let started = false;

/** Pri štarte aplikácie: zapíše návštevu prihláseného účtu a začne zapisovať lekcie a cvičenia. */
export function initActivity(): void {
  if (started) return;
  started = true;
  onLearningEvent((e) => {
    if (e.kind === 'lesson') logActivity('lesson', { lesson: e.lesson });
    else logActivity('quiz', { total: e.total, correct: e.correct, topics: e.topics.slice(0, MAX_TOPICS) });
  });
  const s = loadCloudSession();
  if (s && markVisit(s.user.id)) logActivity('visit', {}, s);
}
