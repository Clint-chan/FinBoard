-- Fintell D1 Database Schema
-- 用于用户管理和 AI 使用统计

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,                -- 用户邮箱（用于登录和找回密码）
  password_hash TEXT NOT NULL,
  ai_quota INTEGER DEFAULT 3,
  register_ip TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 邮箱索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- AI 使用记录表
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode TEXT NOT NULL, -- intraday, trend, fundamental
  stock_code TEXT,
  stock_name TEXT,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, used_at);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 视图：今日使用统计
CREATE VIEW IF NOT EXISTS v_today_usage AS
SELECT 
  u.id as user_id,
  u.username,
  u.ai_quota,
  COUNT(a.id) as used_today
FROM users u
LEFT JOIN ai_usage a ON u.id = a.user_id 
  AND date(a.used_at) = date('now')
GROUP BY u.id;

-- ============ Daily News 模块 ============

-- 每日新闻表
CREATE TABLE IF NOT EXISTS daily_news (
  id TEXT PRIMARY KEY,              -- 基于标题和时间的哈希 ID
  title TEXT NOT NULL,              -- 新闻标题
  summary TEXT,                     -- 内容摘要
  source TEXT,                      -- 来源（如 Reuters, Washington Post）
  source_url TEXT,                  -- 原文链接
  published_at DATETIME,            -- 发布时间（UTC）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- 入库时间
);

-- 新闻时间索引（按发布时间倒序查询）
CREATE INDEX IF NOT EXISTS idx_news_published ON daily_news(published_at DESC);

-- 新闻日期索引（按日期筛选）
CREATE INDEX IF NOT EXISTS idx_news_date ON daily_news(date(published_at));
