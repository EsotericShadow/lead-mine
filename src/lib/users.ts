import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  lastLogin?: Date;
}

// In production, this would be a database
// For this demo, we're using in-memory storage with pre-hashed passwords
const users: User[] = [
  {
    id: 'user_gabriel_001',
    username: 'Gabriel_evergreen',
    // Password: JZEau/TyI4aGaTcdQhCZmqrXP7Z5bwQiLGLM5nCzqrg=
    passwordHash: '$2b$12$AhXz83kLztWl4UbosmSnuuPjYT4AqYA7PNRZU48RwT6faj8A.eCB.',
    createdAt: new Date('2025-01-01'),
  },
  {
    id: 'user_wardo_002',
    username: 'Wardo',
    // Password: pei1fEcmxaG+2hEfM0L4hcm1ItjdGYHbrnXLWvC+PIg=
    passwordHash: '$2b$12$IXUE1MvDjxxsJk7SMmbE2.qfegrv1mNT7tiGMMw7xepYJ2HPr0PSO',
    createdAt: new Date('2025-01-01'),
  }
];

export async function findUserByUsername(username: string): Promise<User | null> {
  const user = users.find(u => u.username === username);
  return user || null;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function updateLastLogin(userId: string): Promise<void> {
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].lastLogin = new Date();
  }
}

// Function to generate the initial password hashes (for development setup)
export async function generatePasswordHashes() {
  const password1 = 'JZEau/TyI4aGaTcdQhCZmqrXP7Z5bwQiLGLM5nCzqrg=';
  const password2 = 'pei1fEcmxaG+2hEfM0L4hcm1ItjdGYHbrnXLWvC+PIg=';
  
  const hash1 = await hashPassword(password1);
  const hash2 = await hashPassword(password2);
  
  console.log('Gabriel_evergreen hash:', hash1);
  console.log('Wardo hash:', hash2);
}
