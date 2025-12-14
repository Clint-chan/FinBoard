-- Fintell D1 Database Schema
-- 用于用户管理和 AI 使用统计

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  ai_quota INTEGER DEFAULT 3,
  register_ip TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
