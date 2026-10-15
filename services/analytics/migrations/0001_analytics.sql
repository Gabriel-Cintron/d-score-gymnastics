PRAGMA foreign_keys = ON;
CREATE TABLE registry (id TEXT PRIMARY KEY, purpose TEXT NOT NULL, deletion_hash TEXT NOT NULL, first_day TEXT NOT NULL, counted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE totals (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
CREATE TABLE events (
 id TEXT PRIMARY KEY, installation TEXT NOT NULL REFERENCES registry(id) ON DELETE CASCADE,
 type TEXT NOT NULL, at INTEGER NOT NULL, day TEXT NOT NULL, version TEXT NOT NULL, mode TEXT NOT NULL,
 received_day TEXT NOT NULL, session TEXT, referrer TEXT, campaign TEXT, search_id TEXT, context TEXT, query TEXT,
 result_count INTEGER, filters TEXT, zero_reason TEXT, target TEXT, previous TEXT
);
CREATE INDEX events_age ON events(at);
CREATE TABLE usage_days (installation TEXT NOT NULL REFERENCES registry(id) ON DELETE CASCADE, day TEXT NOT NULL, version TEXT NOT NULL, mode TEXT NOT NULL, PRIMARY KEY(installation,day,version,mode));
CREATE INDEX usage_days_day ON usage_days(day);
CREATE TABLE sessions (installation TEXT NOT NULL REFERENCES registry(id) ON DELETE CASCADE, session TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(installation,session));
CREATE TABLE daily (day TEXT NOT NULL, version TEXT NOT NULL, mode TEXT NOT NULL, sessions INTEGER NOT NULL DEFAULT 0, searches INTEGER NOT NULL DEFAULT 0, selected INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,version,mode));
CREATE TABLE acquisition (day TEXT NOT NULL, referrer TEXT NOT NULL, campaign TEXT NOT NULL, sessions INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,referrer,campaign));
CREATE TABLE search_episodes (search_id TEXT NOT NULL, installation TEXT NOT NULL REFERENCES registry(id) ON DELETE CASCADE, at INTEGER NOT NULL, day TEXT NOT NULL, version TEXT NOT NULL, mode TEXT NOT NULL, context TEXT NOT NULL, query TEXT, zero_reason TEXT NOT NULL, PRIMARY KEY(installation,search_id));
CREATE INDEX search_episodes_age ON search_episodes(at);
CREATE TABLE selections (installation TEXT NOT NULL REFERENCES registry(id) ON DELETE CASCADE, search_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(installation,search_id));
CREATE TABLE term_daily (day TEXT NOT NULL, installation TEXT NOT NULL REFERENCES registry(id) ON DELETE CASCADE, term TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', searches INTEGER NOT NULL DEFAULT 0, zeros INTEGER NOT NULL DEFAULT 0, no_match INTEGER NOT NULL DEFAULT 0, selected INTEGER NOT NULL DEFAULT 0, reformulations INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,installation,term,target));
CREATE TABLE filter_daily (day TEXT NOT NULL, kind TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,kind));
CREATE TABLE summaries (day TEXT NOT NULL, scope TEXT NOT NULL, dau INTEGER NOT NULL, wau INTEGER NOT NULL, mau INTEGER NOT NULL, monthly INTEGER NOT NULL, new_users INTEGER NOT NULL, PRIMARY KEY(day,scope));
CREATE TABLE reviews (term TEXT NOT NULL, target TEXT NOT NULL, status TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(term,target));
CREATE TABLE gaps (day TEXT PRIMARY KEY, reason TEXT NOT NULL);
CREATE TRIGGER session_total AFTER INSERT ON sessions BEGIN
 INSERT INTO totals(key,value) VALUES('sessions',1) ON CONFLICT(key) DO UPDATE SET value=value+1;
END;
CREATE TRIGGER usage_event AFTER INSERT ON events WHEN NEW.type='usage' BEGIN
 INSERT INTO totals(key,value) SELECT 'users',1 WHERE (SELECT counted FROM registry WHERE id=NEW.installation)=0 ON CONFLICT(key) DO UPDATE SET value=value+1;
 INSERT INTO totals(key,value) VALUES('start',NEW.at) ON CONFLICT(key) DO UPDATE SET value=MIN(value,excluded.value);
 UPDATE registry SET counted=1 WHERE id=NEW.installation;
 INSERT OR IGNORE INTO usage_days VALUES(NEW.installation,NEW.day,NEW.version,NEW.mode);
 INSERT INTO daily(day,version,mode,sessions) SELECT NEW.day,NEW.version,NEW.mode,1 WHERE NOT EXISTS(SELECT 1 FROM sessions WHERE installation=NEW.installation AND session=NEW.session) ON CONFLICT(day,version,mode) DO UPDATE SET sessions=sessions+1;
 INSERT INTO acquisition(day,referrer,campaign,sessions) SELECT NEW.day,NEW.referrer,NEW.campaign,1 WHERE NOT EXISTS(SELECT 1 FROM sessions WHERE installation=NEW.installation AND session=NEW.session) ON CONFLICT(day,referrer,campaign) DO UPDATE SET sessions=sessions+1;
 INSERT OR IGNORE INTO sessions VALUES(NEW.installation,NEW.session,NEW.day);
END;
CREATE TRIGGER search_event AFTER INSERT ON events WHEN NEW.type='search' AND NOT EXISTS(SELECT 1 FROM search_episodes WHERE installation=NEW.installation AND search_id=NEW.search_id) BEGIN
 INSERT OR IGNORE INTO search_episodes VALUES(NEW.search_id,NEW.installation,NEW.at,NEW.day,NEW.version,NEW.mode,NEW.context,NEW.query,NEW.zero_reason);
 INSERT INTO daily(day,version,mode,searches) VALUES(NEW.day,NEW.version,NEW.mode,1) ON CONFLICT(day,version,mode) DO UPDATE SET searches=searches+1;
 INSERT INTO totals(key,value) VALUES('searches',1) ON CONFLICT(key) DO UPDATE SET value=value+1;
 INSERT INTO term_daily(day,installation,term,searches,zeros,no_match) SELECT NEW.day,NEW.installation,NEW.query,1,NEW.result_count=0,NEW.zero_reason='no_match' WHERE NEW.query IS NOT NULL ON CONFLICT(day,installation,term,target) DO UPDATE SET searches=searches+1,zeros=zeros+excluded.zeros,no_match=no_match+excluded.no_match;
 INSERT INTO filter_daily SELECT NEW.day,value,1 FROM json_each(NEW.filters) WHERE true ON CONFLICT(day,kind) DO UPDATE SET count=count+1;
END;
CREATE TRIGGER selection_event AFTER INSERT ON events WHEN NEW.type='selected' BEGIN
 INSERT INTO daily(day,version,mode,selected) SELECT day,version,mode,1 FROM search_episodes WHERE installation=NEW.installation AND search_id=NEW.search_id AND NOT EXISTS(SELECT 1 FROM selections WHERE installation=NEW.installation AND search_id=NEW.search_id) ON CONFLICT(day,version,mode) DO UPDATE SET selected=selected+1;
 INSERT INTO term_daily(day,installation,term,target,selected) SELECT day,installation,query,COALESCE(NEW.target,''),1 FROM search_episodes WHERE installation=NEW.installation AND search_id=NEW.search_id AND query IS NOT NULL AND NOT EXISTS(SELECT 1 FROM selections WHERE installation=NEW.installation AND search_id=NEW.search_id) ON CONFLICT(day,installation,term,target) DO UPDATE SET selected=selected+1;
 INSERT INTO term_daily(day,installation,term,target,reformulations) SELECT p.day,p.installation,p.query,NEW.target,1 FROM search_episodes p JOIN search_episodes s ON s.installation=p.installation AND s.search_id=NEW.search_id WHERE p.installation=NEW.installation AND p.search_id=NEW.previous AND p.query IS NOT NULL AND p.query<>s.query AND p.zero_reason='no_match' AND p.context=s.context AND NEW.context=s.context AND s.at>=p.at AND s.at-p.at<=60000 AND NEW.at>=s.at AND NEW.at-p.at<=60000 AND NEW.target IS NOT NULL AND NOT EXISTS(SELECT 1 FROM selections WHERE installation=NEW.installation AND search_id=NEW.search_id) ON CONFLICT(day,installation,term,target) DO UPDATE SET reformulations=reformulations+1;
 INSERT OR IGNORE INTO selections SELECT NEW.installation,NEW.search_id,NEW.day WHERE EXISTS(SELECT 1 FROM search_episodes WHERE installation=NEW.installation AND search_id=NEW.search_id);
END;

CREATE TABLE budget(day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE limits(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
INSERT INTO limits VALUES('daily',2000);
-- Keep trigger guards in WHERE form for Cloudflare's remote migration parser.
CREATE TRIGGER event_budget BEFORE INSERT ON events WHEN NOT EXISTS(SELECT 1 FROM events WHERE id=NEW.id) BEGIN
 SELECT RAISE(ABORT,'ingestion budget') WHERE COALESCE((SELECT count FROM budget WHERE day=NEW.received_day),0)>=(SELECT value FROM limits WHERE key='daily');
END;
CREATE TRIGGER event_count AFTER INSERT ON events BEGIN
 INSERT INTO budget VALUES(NEW.received_day,1) ON CONFLICT(day) DO UPDATE SET count=count+1;
END;

CREATE TABLE records(scope TEXT NOT NULL, metric TEXT NOT NULL, value INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY(scope,metric));
CREATE TRIGGER event_identity BEFORE INSERT ON events WHEN NOT EXISTS(SELECT 1 FROM events WHERE id=NEW.id) BEGIN
 SELECT RAISE(ABORT,'invalid identity') WHERE NOT EXISTS(SELECT 1 FROM registry WHERE id=NEW.installation AND ((purpose='usage' AND NEW.type='usage') OR (purpose='search' AND NEW.type<>'usage')));
END;

CREATE TRIGGER registry_credential BEFORE INSERT ON registry WHEN EXISTS(SELECT 1 FROM registry WHERE id=NEW.id AND (deletion_hash<>NEW.deletion_hash OR purpose<>NEW.purpose)) BEGIN
 SELECT RAISE(ABORT,'invalid identity');
END;

CREATE TABLE erasures(id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TRIGGER registry_erased BEFORE INSERT ON registry WHEN EXISTS(SELECT 1 FROM erasures WHERE id=NEW.id) BEGIN
 SELECT RAISE(ABORT,'erased identity');
END;
