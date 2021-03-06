import { assertEquals } from "../vendor/https/deno.land/std/testing/asserts.ts";
import {
  newClient,
  nextPort,
  startRedis,
  stopRedis,
  TestSuite,
} from "./test_util.ts";

const suite = new TestSuite("acl");
const port = nextPort();
const server = await startRedis({ port });
const client = await newClient({ hostname: "127.0.0.1", port });

suite.afterAll(() => {
  stopRedis(server);
  client.close();
});

suite.test("whoami", async () => {
  assertEquals(await client.aclWhoami(), "default");
});

suite.test("list", async () => {
  assertEquals(await client.aclList(), ["user default on nopass ~* &* +@all"]);
});

suite.test("getuser", async () => {
  assertEquals(await client.aclGetUser("default"), [
    "flags",
    ["on", "allkeys", "allchannels", "allcommands", "nopass"],
    "passwords",
    [],
    "commands",
    "+@all",
    "keys",
    ["*"],
    "channels",
    ["*"],
  ]);
});

suite.test("cat", async () => {
  assertEquals(
    (await client.aclCat()).sort(),
    [
      "keyspace",
      "read",
      "write",
      "set",
      "sortedset",
      "list",
      "hash",
      "string",
      "bitmap",
      "hyperloglog",
      "geo",
      "stream",
      "pubsub",
      "admin",
      "fast",
      "slow",
      "blocking",
      "dangerous",
      "connection",
      "transaction",
      "scripting",
    ].sort(),
  );
  assertEquals(
    (await client.aclCat("dangerous")).sort(),
    [
      "lastsave",
      "shutdown",
      "module",
      "monitor",
      "role",
      "client",
      "replconf",
      "config",
      "pfselftest",
      "save",
      "replicaof",
      "restore-asking",
      "restore",
      "latency",
      "swapdb",
      "slaveof",
      "bgsave",
      "debug",
      "bgrewriteaof",
      "sync",
      "flushdb",
      "keys",
      "psync",
      "pfdebug",
      "flushall",
      "failover",
      "cluster",
      "info",
      "migrate",
      "acl",
      "sort",
      "slowlog",
    ].sort(),
  );
});

suite.test("users", async () => {
  assertEquals(await client.aclUsers(), ["default"]);
});

suite.test("acl_setuser", async () => {
  assertEquals(await client.aclSetUser("alan", "+get"), "OK");
  assertEquals(await client.aclDelUser("alan"), 1);
});

suite.test("deluser", async () => {
  assertEquals(await client.aclDelUser("alan"), 0);
});

suite.test("genpass", async () => {
  assertEquals((await client.aclGenPass()).length, 64);
  const testlen = 32;
  assertEquals((await client.aclGenPass(testlen)).length, testlen / 4);
});

suite.test("aclauth", async () => {
  assertEquals(await client.auth("default", ""), "OK");
});

suite.test("log", async () => {
  const randString = "balh";
  try {
    await client.auth(randString, randString);
  } catch (_error) {
    // skip invalid username-password pair error
  }
  assertEquals((await client.aclLog(1))[0][9], randString);
  assertEquals(await client.aclLog("RESET"), "OK");
});

suite.test("module_list", async () => {
  assertEquals(await client.moduleList(), []);
});

suite.runTests();
