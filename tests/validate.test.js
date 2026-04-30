import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCity, validateCoords } from "../src/validate.js";

test("validateCity accepts simple ASCII names", () => {
  const r = validateCity("London");
  assert.equal(r.ok, true);
  assert.equal(r.value, "London");
});

test("validateCity trims surrounding whitespace", () => {
  const r = validateCity("  San Francisco  ");
  assert.equal(r.ok, true);
  assert.equal(r.value, "San Francisco");
});

test("validateCity accepts unicode letters and accents", () => {
  const r = validateCity("São Paulo");
  assert.equal(r.ok, true);
});

test("validateCity accepts hyphens, apostrophes, periods, commas", () => {
  for (const name of ["Saint-Étienne", "L'Aquila", "St. John's", "Paris, France"]) {
    assert.equal(validateCity(name).ok, true, `should accept ${name}`);
  }
});

test("validateCity rejects empty / whitespace input", () => {
  assert.equal(validateCity("").ok, false);
  assert.equal(validateCity("   ").ok, false);
});

test("validateCity rejects non-string input", () => {
  assert.equal(validateCity(123).ok, false);
  assert.equal(validateCity(null).ok, false);
  assert.equal(validateCity(undefined).ok, false);
});

test("validateCity rejects strings over 100 chars", () => {
  const long = "a".repeat(101);
  const r = validateCity(long);
  assert.equal(r.ok, false);
  assert.match(r.reason, /100/);
});

test("validateCity rejects injection-shaped or control characters", () => {
  const bad = [
    "<script>",
    "x;rm -rf",
    "/etc/passwd",
    "\"quoted\"",
    "back\\slash",
    "city\nname",
    "city\tname",
  ];
  for (const s of bad) {
    assert.equal(validateCity(s).ok, false, `should reject ${JSON.stringify(s)}`);
  }
});

test("validateCoords accepts in-range floats", () => {
  const r = validateCoords("51.5", "-0.12");
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { lat: 51.5, lon: -0.12 });
});

test("validateCoords rejects non-numeric input", () => {
  assert.equal(validateCoords("abc", "1").ok, false);
  assert.equal(validateCoords("1", "xyz").ok, false);
});

test("validateCoords rejects out-of-range latitudes", () => {
  assert.equal(validateCoords("90.1", "0").ok, false);
  assert.equal(validateCoords("-91", "0").ok, false);
});

test("validateCoords rejects out-of-range longitudes", () => {
  assert.equal(validateCoords("0", "180.1").ok, false);
  assert.equal(validateCoords("0", "-181").ok, false);
});

test("validateCoords rejects when either is missing", () => {
  assert.equal(validateCoords(undefined, "0").ok, false);
  assert.equal(validateCoords("0", undefined).ok, false);
});
