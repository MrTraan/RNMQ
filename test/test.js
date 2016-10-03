const chai = require('chai');
const expect = chai.expect;

const Queue = require('../build/index.js').default;

describe('Classe queue', () => {
  let q;

  before((done) => {
    q = new Queue('test');

    q.on('ready', () => done());
  });

  beforeEach((done) => {
    q.flush()
    .then(() => done())
    .catch(done);
  });

  it('Should be instanciable', () => {
    const _q = new Queue('_test');
    expect(_q).to.be.an.instanceof(Queue);
  });

  it('Should not be instanciable without a queue name', (done) => {
    try {
      const _q = new Queue();
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
      q.put('elem2')
      q.put('elem3')
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
});
