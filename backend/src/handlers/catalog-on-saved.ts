// catalog-on-saved の関数の入口（report.saved → 一覧の行）
import { catalogOnSavedHandler } from './consumers';

export const handler = catalogOnSavedHandler();
