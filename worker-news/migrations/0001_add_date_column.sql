-- 为 daily_reviews 表添加 date 列
-- 如果表不存在，先创建
CREATE TABLE IF NOT EXISTS daily_reviews (
  id TEXT PRIMARY KEY,
  markdown TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 添加 date 列（如果不存在）
-- SQLite 不支持 IF NOT EXISTS，所以需要先检查
-- 这里使用 ALTER TABLE 添加列
ALTER TABLE daily_reviews ADD COLUMN date TEXT;

-- 为已有数据填充 date 值（从 id 提取）
-- id 格式: YYYYMMDD01 或 YYYYMMDD02
UPDATE daily_reviews 
SET date = substr(id, 1, 4) || '-' || substr(id, 5, 2) || '-' || substr(id, 7, 2)
WHERE date IS NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_reviews_date ON daily_reviews(date);
