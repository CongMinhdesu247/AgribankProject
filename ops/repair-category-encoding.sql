-- Repair only the four known seed labels misread as MySQL latin1.
-- Keep category IDs and all ticket references. Atomic UPDATE; repeatable.
SET NAMES utf8mb4;
UPDATE categories AS c
JOIN (
  SELECT UNHEX('5068e1baa76e2063e1bba96e67202f204dc3a17920696e202f205043') AS raw_name
  UNION ALL SELECT UNHEX('4de1baa16e672026204be1babf74206ee1bb9169206ee1bb99692062e1bb99') AS raw_name
  UNION ALL SELECT UNHEX('5468e1babb20262041544d202f20504f53') AS raw_name
  UNION ALL SELECT UNHEX('416e20746fc3a06e207468c3b46e672074696e20262054c3a069206b686fe1baa36e') AS raw_name
) AS expected
  ON CAST(c.name AS BINARY) = CAST(
    CONVERT(CONVERT(expected.raw_name USING latin1) USING utf8mb4) AS BINARY
  )
SET c.name = CONVERT(expected.raw_name USING utf8mb4);
SELECT ROW_COUNT() AS repaired_categories;
SELECT id, name, HEX(name) AS utf8_hex FROM categories ORDER BY id;
