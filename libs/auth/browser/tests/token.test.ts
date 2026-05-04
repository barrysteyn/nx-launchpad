import { getToken, saveToken, clearToken } from '../src/token';

beforeEach(() => localStorage.clear());

test('getToken returns null when nothing stored', () => {
  expect(getToken()).toBeNull();
});

test('saveToken and getToken round-trip', () => {
  saveToken('test-jwt');
  expect(getToken()).toBe('test-jwt');
});

test('clearToken removes the token', () => {
  saveToken('test-jwt');
  clearToken();
  expect(getToken()).toBeNull();
});
