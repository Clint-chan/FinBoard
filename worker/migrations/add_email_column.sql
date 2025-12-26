-- 添加 email 字段到 users 表
-- 运行命令: npx wrangler d1 execute fintell-db --remote --file=./migrations/add_email_column.sql

-- 添加 email 列（允许为空，因为老用户可能没有邮箱）
ALTER TABLE users ADD COLUMN email TEXT;

-- 将现有用户的 username 复制到 email（如果 username 是邮箱格式）
UPDATE users SET email = username WHERE username LIKE '%@%';

-- 创建邮箱索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
