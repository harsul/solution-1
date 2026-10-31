import { describe, expect, it } from 'vitest';
import { checkPassword, isPasswordValid, isUsableAsSignInName, isValidEmail } from './passwordRules';

describe('checkPassword', () => {
  const rules = (minLength: boolean, hasLower: boolean, hasUpper: boolean, hasDigit: boolean, hasSymbol: boolean) => ({
    minLength,
    hasLower,
    hasUpper,
    hasDigit,
    hasSymbol,
  });

  it.each([
    ['', rules(false, false, false, false, false)],
    ['Ab1!', rules(false, true, true, true, true)],
    ['passw0rd!', rules(true, true, false, true, true)],
    ['PASSW0RD!', rules(true, false, true, true, true)],
    ['Password!', rules(true, true, true, false, true)],
    ['Passw0rd', rules(true, true, true, true, false)],
    ['Passw0rd!', rules(true, true, true, true, true)],
    // Like Identity, the character classes are ASCII only: "é" is neither a lowercase letter nor a digit.
    ['PASSW0RDé', rules(true, false, true, true, true)],
  ])('%j → %j', (password, expected) => {
    expect(checkPassword(password)).toEqual(expected);
  });

  it('is valid only when every rule is met', () => {
    expect(isPasswordValid('Passw0rd!')).toBe(true);
    expect(isPasswordValid('Passw0rd')).toBe(false);
    expect(isPasswordValid('Ab1!')).toBe(false);
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

describe('isUsableAsSignInName', () => {
  it.each([
    ['ada@example.com', true],
    ['ada.lovelace+news@ex-ample.co', true],
    ['a_b@example.com', true],
    ["o'brien@example.com", false],
    ['zoé@example.com', false],
    ['ada lovelace@example.com', false],
    ['', false],
  ])('%j → %s', (email, expected) => {
    expect(isUsableAsSignInName(email)).toBe(expected);
  });
});
