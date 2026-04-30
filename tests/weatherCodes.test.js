import { test } from "node:test";
import assert from "node:assert/strict";
import { describeWeatherCode } from "../src/weatherCodes.js";

test("describeWeatherCode maps known codes", () => {
  assert.equal(describeWeatherCode(0), "Clear sky");
  assert.equal(describeWeatherCode(3), "Overcast");
  assert.equal(describeWeatherCode(95), "Thunderstorm");
});

test("describeWeatherCode returns 'Unknown' for unmapped codes", () => {
  assert.equal(describeWeatherCode(9999), "Unknown");
});

test("describeWeatherCode handles non-numeric input safely", () => {
  assert.equal(describeWeatherCode(null), "Unknown");
  assert.equal(describeWeatherCode("3"), "Unknown");
  assert.equal(describeWeatherCode(undefined), "Unknown");
  assert.equal(describeWeatherCode(NaN), "Unknown");
});
