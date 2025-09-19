CREATE DATABASE sih_qr_db;
USE sih_qr_db;

CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(100) UNIQUE,
    component VARCHAR(50),
    vendor VARCHAR(50),
    lot VARCHAR(50),
    mfg_date DATE,
    warranty_years INT,
    qr_path VARCHAR(255),
    created_at DATETIME
);

DROP TABLE IF EXISTS items;

CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(128) UNIQUE,
    component VARCHAR(64),
    vendor VARCHAR(64),
    lot VARCHAR(64),
    mfg_date DATE,
    warranty_years INT,
    qr_path VARCHAR(255),
    qr_image LONGBLOB,      -- QR image bytes stored directly
    created_at DATETIME,
    INDEX(uid(64)),
    INDEX(lot)
);
CREATE TABLE IF NOT EXISTS statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(128),
    status VARCHAR(64),
    location VARCHAR(128),
    note TEXT,
    updated_at DATETIME,
    FOREIGN KEY (uid) REFERENCES items(uid) ON DELETE CASCADE
);
DELETE FROM items;

select * from items;
select * from statuses;
SELECT COUNT(*) FROM items;
SELECT uid, status FROM statuses ORDER BY updated_at DESC LIMIT 10;
