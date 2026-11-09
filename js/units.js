// Lesson index data: one entry per unit of the book. To add a unit, write content-u7.js (same shape as UNIT6)
// and put it here in place of its placeholder; the home index, the parent jump and the session pick it up.
import { UNIT6 } from './content-u6.js';

export const UNITS = [
  UNIT6,
  { id: 7, title: 'الجمع والطرح ضمن ٢٠', pages: [35, 66], lessons: [] },
  { id: 8, title: 'الأعداد ضمن ١٠٠', pages: [67, 92], lessons: [] },
  { id: 9, title: 'الجمع والطرح ضمن ١٠٠', pages: [93, 116], lessons: [] },
  { id: 10, title: 'القياس', pages: [117, 144], lessons: [] },
];
export const INDEX_STATUS = { new: 'لم يبدأ', learning: 'يتدرب', confirm: 'يتدرب', mastered: 'أتقنه' };
