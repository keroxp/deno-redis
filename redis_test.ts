import { connect } from "./redis.ts";
import {
  assertEquals,
  assertThrowsAsync,
  assertArrayContains
} from "./vendor/https/deno.land/std/testing/asserts.ts";
const { test } = Deno;

// can be substituted with env variable
const addr = {
  hostname: "127.0.0.1",
  port: 6379
};

let redis = await connect({ ...addr, db: 0 });
await redis.flushdb(false);

test(async function testExists() {
  const none = await redis.exists("none", "none2");
  assertEquals(none, 0);
  await redis.set("exists", "aaa");
  const exists = await redis.exists("exists", "none");
  assertEquals(exists, 1);
});

test(async function testGetWhenNil() {
  const hoge = await redis.get("none");
  assertEquals(hoge, undefined);
});

test(async function testSet() {
  const s = await redis.set("get", "fuga你好こんにちは");
  assertEquals(s, "OK");
  const fuga = await redis.get("get");
  assertEquals(fuga, "fuga你好こんにちは");
});

test(async function testGetSet() {
  await redis.set("getset", "val");
  const v = await redis.getset("getset", "lav");
  assertEquals(v, "val");
  assertEquals(await redis.get("getset"), "lav");
});

test(async function testMget() {
  await redis.set("mget1", "val1");
  await redis.set("mget2", "val2");
  await redis.set("mget3", "val3");
  const v = await redis.mget("mget1", "mget2", "mget3");
  assertEquals(v, ["val1", "val2", "val3"]);
});

test(async function testDel() {
  let s = await redis.set("del1", "fuga");
  assertEquals(s, "OK");
  s = await redis.set("del2", "fugaaa");
  assertEquals(s, "OK");
  const deleted = await redis.del("del1", "del2");
  assertEquals(deleted, 2);
});

test(async function testIncr() {
  const rep = await redis.incr("incr");
  assertEquals(rep, 1);
  assertEquals(await redis.get("incr"), "1");
});

test(async function testIncrby() {
  const rep = await redis.incrby("incrby", 101);
  assertEquals(rep, 101);
  assertEquals(await redis.get("incrby"), "101");
});

test(async function testDecr() {
  const rep = await redis.decr("decr");
  assertEquals(rep, -1);
  assertEquals(await redis.get("decr"), "-1");
});

test(async function testDecrby() {
  const rep = await redis.decrby("decryby", 101);
  assertEquals(rep, -101);
  assertEquals(await redis.get("decryby"), "-101");
});

test(async function testConcurrent() {
  let promises: Promise<any>[] = [];
  for (const key of ["a", "b", "c"]) {
    promises.push(redis.set(key, key));
  }
  await Promise.all(promises);
  promises = [];
  for (const key of ["a", "b", "c"]) {
    promises.push(redis.get(key));
  }
  const [a, b, c] = await Promise.all(promises);
  assertEquals(a, "a");
  assertEquals(b, "b");
  assertEquals(c, "c");
});

test(async function testDb0Option() {
  const key = "exists";
  await redis.set(key, "aaa");
  const exists1 = await redis.exists(key);
  assertEquals(exists1, 1);
  const client2 = await connect({ ...addr, db: 0 });
  const exists2 = await client2.exists(key);
  assertEquals(exists2, 1);
});

test(async function testDb1Option() {
  const key = "exists";
  await redis.set(key, "aaa");
  const exists1 = await redis.exists(key);
  assertEquals(exists1, 1);
  const client2 = await connect({ ...addr, db: 1 });
  const exists2 = await client2.exists(key);
  assertEquals(exists2, 0);
});

[Infinity, NaN, "", "port"].forEach(v => {
  test(`invalid port: ${v}`, () => {
    assertThrowsAsync(async () => {
      await connect({ hostname: "127.0.0.1", port: v });
    }, Error, "invalid");
  });
});

import "./tests/connection_test.ts";
import "./tests/geo_test.ts";
import "./tests/hash_test.ts";
import "./tests/hyper_loglog_test.ts";
import "./tests/list_test.ts";
import "./tests/set_test.ts";
import "./tests/sorted_set_test.ts";
