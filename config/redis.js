import Redis from 'ioredis';

const redisConfig = {
	host: process.env.REDIS_HOST || "localhost",
	port: parseInt(process.env.REDIS_PORT) || 6379,
	maxRetriesPerRequest: null,
};

export const redisPubClient = new Redis(redisConfig);
export const redisSubClient = new Redis(redisConfig);
export const redisClient = new Redis(redisConfig);

redisPubClient.on('connect', () => {
    console.log('Redis Pub Client connected');
});

redisSubClient.on('connect', () => {
    console.log('Redis Sub Client connected');
});

redisClient.on('connect', () => {
    console.log('Redis Client connected');
});

redisPubClient.on('error', (err) => {
    // console.error('Redis Pub Client Error:', err);
});

redisSubClient.on('error', (err) => {
    // console.error('Redis Sub Client Error:', err);
});

redisClient.on('error', (err) => {
    // console.error('Redis Client Error:', err);
});