// duplicate-detection-on-status の関数の入口（review.status-changed → 索引の出し入れ。BR8.7・BR8.11）
import { duplicateDetectionOnStatusHandler } from './consumers';

export const handler = duplicateDetectionOnStatusHandler();
