UPDATE users
SET slug = 'player-playwright'
WHERE email = 'player@test.com';

UPDATE users
SET slug = 'coach-playwright'
WHERE email = 'coach@test.com';

UPDATE users
SET is_admin = true
WHERE email = 'admin@test.com';