process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/curtis_inn_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-with-at-least-24-characters';
