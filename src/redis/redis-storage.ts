import type { IStorage } from "@inrupt/solid-client-authn-node";
import { Redis } from "ioredis";

export class RedisSolidStorage implements IStorage {
    private client;

    public constructor() {
        this.client = Redis.createClient();
        console.log("Redis client created");
    }

    async delete(key: string): Promise<void> {
        try {
            const result = await this.client.del(key).then();
            if (result > 0) return;
        } catch (e) {
            console.log("Could not delete key: " + key);
        }
    }

    async get(key: string): Promise<string | undefined> {
        try {
            const value = await this.client.get(key);
            return value || undefined;
        } catch (e) {
            return undefined;
        }
    }

    async set(key: string, value: string): Promise<void> {
        try {
            const result = await this.client.set(key, value);
            if (result === "OK") return;
        } catch (e) {
            console.log("Could not set key: " + key + " and value: " + value);
        }
    }
}
