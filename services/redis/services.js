import { redisClient } from "../../config/redis.js"
import { REDIS_KEYS } from "./keys.js"

export const setOnlineUsers = async (userId) => {
    await redisClient.sadd(REDIS_KEYS.ONLINE_USERS, userId)
}

export const setOfflineUsers = async (userId) => {
    await redisClient.srem(REDIS_KEYS.ONLINE_USERS, userId)
}

export const getOnlineUsers = async () => {
    const onlineUsers = await redisClient.smembers(REDIS_KEYS.ONLINE_USERS)
    return onlineUsers
}

export const isUserOnline = async (userId) => {
    const isOnline = await redisClient.sismember(REDIS_KEYS.ONLINE_USERS, userId)
    return isOnline === 1
}