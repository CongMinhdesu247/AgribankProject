-- Add the requested helpdesk categories without duplicating existing names.
-- Run against agribank_helpdesk after the categories table has been created.
INSERT INTO categories (name)
SELECT requested.name
FROM (
    SELECT 'Phần cứng / Máy in / PC' AS name
    UNION ALL SELECT 'Mạng & Kết nối nội bộ'
    UNION ALL SELECT 'Thẻ & ATM / POS'
    UNION ALL SELECT 'An toàn thông tin & Tài khoản'
) AS requested
WHERE NOT EXISTS (
    SELECT 1
    FROM categories existing
    WHERE existing.name = requested.name
);
