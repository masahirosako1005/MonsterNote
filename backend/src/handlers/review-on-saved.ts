// review-on-saved の関数の入口（report.saved → 確認中の記録）
import { reviewOnSavedHandler } from './consumers';

export const handler = reviewOnSavedHandler();
