export function generateTestUser(
  role: 'player' | 'coach' = 'player'
) {
  const timestamp = Date.now();

  return {
    role,
    name: `Test ${role} ${timestamp}`,
    email: `test_${role}_${timestamp}@tennisconnect.test`,
    password: 'Test123456!',
    isTestUser: true,
  };
}

export const TEST_USERS = {
  player: {
    email: 'player@test.com',
    password: 'Test12345!',
    slug: 'player-playwright',
  },

  coach: {
    email: 'coach@test.com',
    password: 'Test12345!',
    slug: 'coach-playwright',
  },

  admin: {
    email: 'admin@test.com',
    password: 'Test12345!',
    slug: 'admin-playwright',
  },
};