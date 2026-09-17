'use strict';
/* 落位 LoWei —— 初始数据（随首屏内联，无加载态） */
/* global ROOM */

const GRID = 10;
const ROOM = { w: 960, h: 600 };

// 物品类型（顺序即键盘 1-8）
const TYPES = [
  { key: 'desk',  name: '办公桌', emoji: '🖥️', w: 150, h: 70, color: '#2563eb', prefer: 'window'  },
  { key: 'chair', name: '椅子',   emoji: '💺', w: 46,  h: 46, color: '#7c3aed', prefer: null      },
  { key: 'shelf', name: '书架',   emoji: '📚', w: 110, h: 34, color: '#d97706', prefer: 'storage' },
  { key: 'plant', name: '绿植',   emoji: '🌿', w: 44,  h: 44, color: '#059669', prefer: 'window'  },
  { key: 'sofa',  name: '沙发',   emoji: '🛋️', w: 130, h: 58, color: '#db2777', prefer: 'lounge'  },
  { key: 'table', name: '茶几',   emoji: '☕', w: 56,  h: 56, color: '#0d9488', prefer: 'lounge'  },
  { key: 'board', name: '白板',   emoji: '📋', w: 100, h: 20, color: '#475569', prefer: null      },
  { key: 'box',   name: '纸箱',   emoji: '📦', w: 46,  h: 46, color: '#dc2626', prefer: 'storage' },
];
const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.key, t]));

// 房间分区：落位到区域 = 意图（keep-clear 通道禁止占用）
const ZONES = [
  { id: 'window',  name: '窗边采光带', hint: '宜放书桌 · 绿植',    tone: '#0369a1', x: 24,  y: 24,  w: 912, h: 110, kind: 'prefer' },
  { id: 'aisle',   name: '动线通道',   hint: '保持通畅 · 勿放物品', tone: '#b91c1c', x: 24,  y: 250, w: 912, h: 80,  kind: 'clear'  },
  { id: 'storage', name: '储物区',     hint: '宜放书架 · 纸箱',    tone: '#92400e', x: 24,  y: 436, w: 230, h: 140, kind: 'prefer' },
  { id: 'lounge',  name: '休闲区',     hint: '宜放沙发 · 茶几',    tone: '#5b21b6', x: 600, y: 396, w: 336, h: 180, kind: 'prefer' },
];

// 初始排布：全部落在建议区域内，无冲突（首屏即"落位即意图"的正确示范）
const INITIAL_OBJECTS = [
  { id: 'o1',  type: 'desk',  x: 200, y: 44,  rot: 0, label: '办公桌·主位' },
  { id: 'o2',  type: 'chair', x: 356, y: 56,  rot: 0, label: '工作椅' },
  { id: 'o3',  type: 'plant', x: 40,  y: 52,  rot: 0, label: '龟背竹' },
  { id: 'o4',  type: 'board', x: 480, y: 62,  rot: 0, label: '白板' },
  { id: 'o5',  type: 'shelf', x: 48,  y: 468, rot: 0, label: '书架 A' },
  { id: 'o6',  type: 'box',   x: 170, y: 500, rot: 0, label: '纸箱·待拆' },
  { id: 'o7',  type: 'sofa',  x: 650, y: 470, rot: 0, label: '双人沙发' },
  { id: 'o8',  type: 'table', x: 688, y: 410, rot: 0, label: '茶几' },
  { id: 'o9',  type: 'plant', x: 890, y: 520, rot: 0, label: '琴叶榕' },
  { id: 'o10', type: 'box',   x: 48,  y: 516, rot: 0, label: '纸箱·耗材' },
];
