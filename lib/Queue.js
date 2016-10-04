import Redis from 'redis';
import { EventEmitter } from 'events';
import { isStringSet } from './utils';

export default class Queue extends EventEmitter {
  constructor(name, options = {}) {
    super();

    if (!isStringSet(name)) {
      throw new Error('Queue constructor error: parameter `name` is not set');
    }
    this.name = name;

    const opts = {
      host: '127.0.0.1',
      port: 6379,
      options: {},
      client: null,
      ...options,
    };

    if (opts.client !== null && opts.client.constructor.name === 'RedisClient') {
      this.client = opts.client;
    } else {
      this.client = Redis.createClient(opts.port, opts.host, {
        ...opts.options,
        retry_strategy: (log) => {
          if (log.error.code === 'ENOTFOUND') {
            this.emit('error', log.error);
            return log.error;
          }
          return 3000;
        },
      });
    }

    this.client.on('connect', () => {
      this.connected = true;
      this.emit('connect');
    });

    this.client.on('ready', () => {
      this.ready = true;
      this.emit('ready');
    });

    this.client.on('error', (err) => {
      this.emit('error', err);
    });

    this.client.on('reconnecting', (err) => {
      this.emit('reconnecting', err);
    });

    this.client.on('message', (channel, message) => {
      this.emit('message', message);
    });
  }

  quit() {
    this.redis.quit();
  }

  /**
   * @payload : {String}
   */
  put(payload) {
    return new Promise((resolve, reject) => {
      this.client.rpush([this.name, payload], (err, reply) => {
        if (err) return reject(err);
        return resolve(reply);
      });
    });
  }

  pop() {
    return new Promise((resolve, reject) => {
      this.client.lpop(this.name, (err, item) => {
        if (err) return reject(err);
        return resolve(item);
      });
    });
  }

  getAll() {
    return new Promise((resolve, reject) => {
      this.client.lrange(this.name, 0, -1, (err, n) => {
        if (err) return reject(err);
        return resolve(n);
      });
    });
  }

  flush() {
    return new Promise((resolve, reject) => {
      this.client.flushall((err, log) => {
        if (err) return reject(err);
        return resolve(log);
      });
    });
  }

  // Close the connection to redis
  close() {
    this.client.end(true);
  }

  subscribe() {
    return new Promise((resolve, reject) => {
      const TIMEOUT = 1 * 1000;

      this.client.subscribe(this.name);

      const timeout = setTimeout(() => {
        reject(new Error(`Subscribe timeout after ${TIMEOUT / 1000}s`));
      }, TIMEOUT);

      this.client.once('subscribe', (channel, count) => {
        clearTimeout(timeout);
        resolve(count);
      });
    });
  }

  unsubscribe() {
    return new Promise((resolve, reject) => {
      const TIMEOUT = 1 * 1000;
      this.client.unsubscribe();

      const timeout = setTimeout(() => {
        reject(new Error(`Unsubscribe timeout after ${TIMEOUT / 1000}s`));
      }, TIMEOUT);

      this.client.once('unsubscribe', (channel, count) => {
        clearTimeout(timeout);
        resolve(count);
      });
    });
  }

  publish(payload) {
    this.client.publish(this.name, payload);
  }
}
