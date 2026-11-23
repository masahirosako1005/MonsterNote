// catalog-on-status の関数の入口（review.status-changed → 一覧の状態）
import { catalogOnStatusHandler } from './consumers';

export const handler = catalogOnStatusHandler();
