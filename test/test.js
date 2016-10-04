const chai = require('chai');
const { Queue } = require('../build/index.js');

const expect = chai.expect;
const host = process.env.REDIS_HOST || '127.0.0.1';

describe('Classe queue', () => {
  let q;

  before((done) => {
    q = new Queue('test', { host });

    q.on('ready', () => done());
  });

  beforeEach((done) => {
    q.unsubscribe();
    q.flush()
    .then(() => done())
    .catch(done);
  });

  it('Should be instanciable', () => {
    const _q = new Queue('_test', { host });
    expect(_q).to.be.an.instanceof(Queue);
  });

  it('Should not be instanciable without a queue name', (done) => {
    try {
      const _q = new Queue({ host });
    } catch (err) {
      expect(err).to.exists;
      done();
      return;
    }
    done(new Error('New queue didnt throw an error when called without parameters'));
  });

  it('Should be instanciable with an existing redis client', () => {
    const _q = new Queue('_test', { client: q.client });
    expect(_q).to.be.an.instanceof(Queue);
    expect(q.client).to.be.eql(_q.client);
  });

  it('Should be instanciable using redis host options', (done) => {
    const _q = new Queue('_test', { host: 'https://google.com' });

    _q.on('error', (err) => {
      expect(err).to.exists;
      expect(err.code).to.eql('ENOTFOUND');
      expect(err.host).to.eql('https://google.com');
      done();
    });

    _q.on('ready', () => {
      done(new Error('Queue emitted connect event with invalid redis host params'));
    });
  });

  describe('#put', () => {
    it('Should insert an item', (done) => {
      q.put('first elem')
        .then(() => q.put('second elem'))
        .then(() => q.getAll())
        .then((elems) => {
          expect(elems).to.be.an('array');
          expect(elems.length).to.eql(2);
          expect(elems[0]).to.eql('first elem');
          expect(elems[1]).to.eql('second elem');
          done();
        })
        .catch(done);
    });
  });

  describe('#pop', () => {
    it('Should get an item', (done) => {
      q.put('elem1')
        .then(() => q.put('elem2'))
        .then(() => q.put('elem3'))
        .then(() => q.pop())
        .then((item) => {
          expect(item).to.exists;
          expect(item).to.be.eql('elem1');
          return q.pop();
        })
        .then((item) => {
          expect(item).to.exists;
          expect(item).to.be.eql('elem2');
          return q.pop();
        })
        .then((item) => {
          expect(item).to.exists;
          expect(item).to.be.eql('elem3');
          return q.pop();
        })
        .then((item) => {
          expect(item).to.be.eql(null);
          done();
        })
        .catch(done);
    });
  });

  describe('#subscribe', () => {
    it('Should subscribe to new message events', function(done) {
      this.timeout(10000);
      const _q = new Queue('test');
      const msgs = [];

      _q.on('message', msg => msgs.push(msg));
      _q.on('ready', () => {
        console.log('_q is ready');
        _q.subscribe();
        q.publish('elem1');
        q.publish('elem2');
        q.publish('elem3');

        setTimeout(() => {
          expect(msgs.length).to.eql(3);
          done();
        }, 200);
      });

      _q.on('error', done);
      _q.on('reconnecting', done);
    });
  });
});
