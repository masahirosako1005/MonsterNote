// duplicate-detection-on-saved の関数の入口（report.saved → 保存後の重複の再判定。BR8.4・BR8.6・BR8.11）
import { duplicateDetectionOnSavedHandler } from './consumers';

export const handler = duplicateDetectionOnSavedHandler();
