import Redis from 'redis';

import { EventEmitter } from 'events';

const isStringSet = str => typeof str === 'string' && str.length > 0;

export default class Queue extends EventEmitter {
  constructor(name, options = {}) {
    super();

    if (!isStringSet(name)) {
      throw new Error('Queue constructor error: parameter `name` is not set');
    }
    this.name = name;

    const opts = Object.assign({
      host: '127.0.0.1',
      port: 6379,
      options: {},
      client: null,
    }, options);

    if (opts.client !== null && opts.client.constructor.name === 'RedisClient') {
      this.client = opts.client;
    } else {
      this.client = Redis.createClient(opts.port, opts.host, opts.options);
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

  getAll() {
    return new Promise((resolve, reject) => {
      this.client.lrange(this.name, 0, -1, (err, n) => {
        return resolve(n);
      });
    });
  }

  flushAll() {
    return new Promise((resolve, reject) => {
      this.client.flushall((err, log) => {
        if (err) return reject(err);
        return resolve(log);
      });
    });
  }
}
