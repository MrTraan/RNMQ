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

    this.opts = {
      host: '127.0.0.1',
      port: 6379,
      options: {},
      client: null,
      ...options,
    };

    if (this.opts.client !== null && this.opts.client.constructor.name === 'RedisClient') {
      this.client = this.opts.client;
    } else {
      this.client = Redis.createClient(this.opts.port, this.opts.host, {
        ...this.opts.options,
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

  getAllErrors() {
    return new Promise((resolve, reject) => {
      this.client.lrange(`${this.name}_error`, 0, -1, (err, n) => {
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

  /**
   *  Subscribe creates an alternate redis client to use pub/sub commands.
   *  A redis client using pub/sub will lose access to all other method,
   *  so that's why we need to create a new client.
   */
  subscribe() {
    const TIMEOUT = 1 * 1000; // 1 second

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Subscribe timeout after ${TIMEOUT / 1000}s`));
      }, TIMEOUT);

      this.subclient = Redis.createClient(this.opts.port, this.opts.host, {
        ...this.opts.options,
        retry_strategy: (log) => {
          if (log.error) {
            reject(log.error);
            return log.error;
          }
          return 3000;
        },
      });

      this.subclient.once('connect', () => {
        this.subclient.subscribe(this.name);

        this.subclient.once('subscribe', (channel, count) => {
          clearTimeout(timeout);
          resolve(count);
        });

        this.subclient.on('message', (channel, message) => {
          this.emit('message', message);
        });
      });
    });
  }

  unsubscribe() {
    return new Promise((resolve, reject) => {
      const TIMEOUT = 1 * 1000;
      this.subclient.unsubscribe();

      const timeout = setTimeout(() => {
        reject(new Error(`Unsubscribe timeout after ${TIMEOUT / 1000}s`));
      }, TIMEOUT);

      this.subclient.once('unsubscribe', (channel, count) => {
        clearTimeout(timeout);
        resolve(count);
      });
    });
  }

  publish(payload) {
    this.client.publish(this.name, payload);
  }

  requeue(payload) {
    return new Promise((resolve, reject) => {
      this.client.rpush([`${this.name}_error`, payload], (err, reply) => {
        if (err) return reject(err);
        return resolve(reply);
      });
    });
  }
}
