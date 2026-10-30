import { describe, expect, it } from 'vitest';
import { checkPassword, isPasswordValid, isValidEmail } from './passwordRules';

describe('checkPassword', () => {
  it.each([
    ['', { minLength: false, hasLetter: false, hasDigit: false }],
    ['abcdefgh', { minLength: true, hasLetter: true, hasDigit: false }],
    ['12345678', { minLength: true, hasLetter: false, hasDigit: true }],
    ['abc1', { minLength: false, hasLetter: true, hasDigit: true }],
    ['Passw0rd', { minLength: true, hasLetter: true, hasDigit: true }],
    ['ćevap123', { minLength: true, hasLetter: true, hasDigit: true }],
    ['𝐀1234567', { minLength: true, hasLetter: true, hasDigit: true }],
  ])('%j → %j', (password, expected) => {
    expect(checkPassword(password)).toEqual(expected);
  });

  it('is valid only when every rule is met', () => {
    expect(isPasswordValid('Passw0rd')).toBe(true);
    expect(isPasswordValid('Password')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it.each([
    ['ada@example.com', true],
    ['  ada@example.com ', true],
    ['ada@example', false],
    ['ada.example.com', false],
    ['ada @example.com', false],
    ['', false],
  ])('%j → %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });
});
