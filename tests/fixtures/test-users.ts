export function generateTestUser(role: "player" | "coach" = "player") {
    const timestamp = Date.now();
  
    return {
      role,
      name: `Test ${role} ${timestamp}`,
      email: `test_${role}_${timestamp}@tennisconnect.test`,
      password: "Test123456!",
    };
  }