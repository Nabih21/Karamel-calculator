-- Keep legacy per-recipe overhead unchanged as migration history.
CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS standardOverhead (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name))>0),
 amount REAL NOT NULL CHECK(amount>=0)
);
-- Duplicate names with different amounts deliberately fail instead of guessing.
INSERT INTO standardOverhead (id,name,amount)
SELECT MIN(id),trim(name),amount FROM overhead
WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE name='standard-overhead-v1')
GROUP BY trim(name) COLLATE NOCASE,amount;
INSERT OR IGNORE INTO app_migrations(name) VALUES('standard-overhead-v1');
