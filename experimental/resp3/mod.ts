import { connect as _connect } from "../../redis.ts";
import type { Redis as BaseRedis, RedisConnectOptions } from "../../redis.ts";
import type {
  ConditionalMap,
  ConditionalSet,
  MapReply,
  RedisValue,
  SetReply,
} from "../../protocol/mod.ts";

export interface Redis extends BaseRedis {
  hgetallMap(key: string): Promise<ConditionalMap>;
  smembersSet(key: string): Promise<ConditionalSet>;
}

export async function connect(opts: RedisConnectOptions): Promise<Redis> {
  const redis = await _connect(opts);
  await redis.hello(3);
  return createRESP3Client(redis);
}

// FIXME:
function createRESP3Client(redis: BaseRedis): Redis {
  async function execMapReply(
    command: string,
    args: RedisValue[] = [],
  ): Promise<ConditionalMap> {
    const reply = await redis.executor.exec(command, ...args) as MapReply;
    return reply.map();
  }

  async function execSetReply(
    command: string,
    args: RedisValue[] = [],
  ): Promise<ConditionalSet> {
    const reply = await redis.executor.exec(command, ...args) as SetReply;
    return reply.set();
  }

  return Object.assign(redis, {
    hgetallMap: (key: string) => execMapReply("HGETALL", [key]),
    smembersSet: (key: string) => execSetReply("SMEMBERS", [key]),
  });
}
