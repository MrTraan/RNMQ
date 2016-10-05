const chai = require('chai');
const { Queue } = require('../build/index.js');

const expect = chai.expect;
const host = process.env.REDIS_HOST || '127.0.0.1';

const SMALL_DELAY = 10 // Delay used to wait for pub/sub actions, in ms

describe('Class queue', () => {
  let q;

  before((done) => {
    q = new Queue('test', { host });

    q.on('ready', () => done());
  });

  beforeEach((done) => {
    q.unsubscribe()
    .catch((err) => {});
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

  describe('PubSub', () => {
    describe('#subscribe', () => {
      it('Should subscribe to new message events', (done) => {
        const _q = new Queue('test', { host });
        const msgs = [];

        _q.on('message', msg => msgs.push(msg));
        _q.on('ready', () => {
          _q.subscribe()
          .then((count) => {
            expect(count).to.eql(1);
            q.publish('elem1');
            q.publish('elem2');
            q.publish('elem3');

            setTimeout(() => {
              expect(msgs.length).to.eql(3);
              done();
            }, SMALL_DELAY);
          })
          .catch(done);
        });
      });
    });

    describe('#unsubscribe', () => {
      it('Should unsubscribe to new message events', (done) => {
        const _q = new Queue('test', { host });
        const msgs = [];

        _q.on('message', msg => msgs.push(msg));
        _q.on('ready', () => {
          _q.subscribe()
          .then((count) => {
            expect(count).to.eql(1);
            return _q.unsubscribe();
          })
          .then((count) => {
            //expect(count).to.eql(0);
            q.publish('elem1');
            q.publish('elem2');
            q.publish('elem3');

            setTimeout(() => {
              expect(msgs.length).to.eql(0);
              done();
            }, SMALL_DELAY);
          })
          .catch(done);
        });
      });
    });

    describe('#requeue', () => {
      it('Should requeue a message', (done) => {
        const _q = new Queue('test', { host });

        _q.on('message', msg => _q.requeue(msg));

        _q.on('ready', () => {
          _q.subscribe()
          .then((count) => {
            expect(count).to.eql(1);
            
            q.publish('elem1');
            q.publish('elem2');
            q.publish('elem3');

            setTimeout(() => {
              _q.getAllErrors()
              .then((msgs) => {
                expect(msgs.length).to.eql(3);
                done();
              })
              .catch(done);
            }, SMALL_DELAY);
          })
          .catch(done);
        });
      });
    });
  });
});
