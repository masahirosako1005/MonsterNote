// 画面の試験で使う API のモックのサーバー（各試験が handlers を足す）
import { setupServer } from 'msw/node';

export const API = 'http://api.test';

export const server = setupServer();
