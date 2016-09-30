
const chai = require('chai');
const expect = chai.expect;

const Queue = require('../build/index.js').default;

describe('#put', () => {
  let q;
  before((done) => {
    q = new Queue('test');

    q.on('ready', () => done());
  })
  it('should insert an item', (done) => {
    q.flushAll()
      .then(() => q.put('first elem'))
      .then(() => q.put('second elem'))
      .then(() => q.getAll())
      .then((elems) => {
        expect(elems).to.be.an('array');
        expect(elems.length).to.eql(2);
        expect(elems[0]).to.eql('first elem');
        expect(elems[1]).to.eql('second elem');
        done();
      })
      .catch(done)
  })
})