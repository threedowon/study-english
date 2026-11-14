CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE sessions(digest TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE TABLE study(user_id TEXT PRIMARY KEY REFERENCES users(id),data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE invites(id TEXT PRIMARY KEY,digest TEXT UNIQUE NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL,accepted_by TEXT REFERENCES users(id),revoked INTEGER NOT NULL DEFAULT 0);
CREATE INDEX invites_owner ON invites(owner_id,expires);
CREATE TABLE connections(a TEXT NOT NULL REFERENCES users(id),b TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(a,b));
CREATE INDEX connections_b ON connections(b);
CREATE TABLE limits(key TEXT PRIMARY KEY,bucket INTEGER NOT NULL,count INTEGER NOT NULL);
CREATE TRIGGER connect_on_accept AFTER UPDATE OF accepted_by ON invites
WHEN OLD.accepted_by IS NULL AND NEW.accepted_by IS NOT NULL
BEGIN
 INSERT OR IGNORE INTO connections(a,b) VALUES(min(NEW.owner_id,NEW.accepted_by),max(NEW.owner_id,NEW.accepted_by));
END;
