import { BookOpen, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Locale } from '../../app/types';
import type { LessonManifestEntry } from '../../course/types';
import { lessonUi } from './copy';
import { useDrawerFocus } from './useDrawerFocus';

export interface CourseDrawerProps {
  readonly open: boolean;
  readonly locale: Locale;
  readonly courseTitle: string;
  readonly currentLessonId: string;
  readonly lessons: readonly LessonManifestEntry[];
  readonly onClose: () => void;
}

export function CourseDrawer({
  open,
  locale,
  courseTitle,
  currentLessonId,
  lessons,
  onClose,
}: CourseDrawerProps) {
  const t = lessonUi(locale);
  const verified = lessons.filter((lesson) => lesson.status === 'available');
  const drawerRef = useDrawerFocus(open, onClose);

  return (
    <div className="drawer-layer course-drawer-layer" hidden={!open}>
      <button
        className="drawer-backdrop"
        type="button"
        tabIndex={-1}
        aria-label={t.closeCourse}
        onClick={onClose}
      />
      <aside
        id="course-drawer"
        ref={drawerRef}
        className="lesson-drawer course-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-drawer-title"
      >
        <div className="drawer-header">
          <div>
            <span>{t.courseContents}</span>
            <h2 id="course-drawer-title">{courseTitle}</h2>
          </div>
          <button type="button" aria-label={t.closeCourse} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <ol className="course-drawer-list">
          {verified.map((lesson, index) => (
            <li key={lesson.id}>
              <Link
                to={`/learn/${lesson.id}/0`}
                aria-current={lesson.id === currentLessonId ? 'page' : undefined}
                onClick={onClose}
              >
                <span>{index + 1}</span>
                <span>
                  <strong>{lesson.title[locale]}</strong>
                  <small>
                    {lesson.estimatedMinutes} min · {t.verified}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="drawer-verified-count">
          <BookOpen size={15} aria-hidden="true" /> {verified.length} {t.verifiedLessons}
        </p>
      </aside>
    </div>
  );
}
