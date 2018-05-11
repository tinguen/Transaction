function Transaction() {}

Transaction.start = (data) => {
  console.log('\nstart transaction');

  if (typeof data !== 'object' && typeof data !== 'function') data = { data };

  const events = {
    commit: [], rollback: [], timeout: [], change: []
  };
  let delta = {};
  let deleted = [];
  let innerTransaction = {};

  const emit = (name) => {
    const event = events[name];
    for (const listener of event) listener(data);
  };

  const methods = {
    commit: () => {
      Object.assign(data, delta);
      deleted.forEach(key => delete data[key]);
      delta = {};
      deleted = [];
      Object.keys(innerTransaction).forEach(
        key => innerTransaction[key].commit()
      );
      emit('commit');
    },
    rollback: () => {
      delta = {};
      deleted = [];
      Object.keys(innerTransaction).forEach(
        k => innerTransaction[k].rollback()
      );
      emit('rollback');
    },
    clone: () => {
      const cloned = Transaction.start(data);
      Object.assign(cloned.delta, delta);
      Object.assign(cloned.deleted, deleted);
      return cloned;
    },
    on: (name, callback) => {
      const event = events[name];
      if (event) event.push(callback);
    }
  };

  return new Proxy(data, {
    get(target, key) {
      if (typeof target[key] === 'object' || typeof target[key] === 'function' && target[key] !== null) {
        if (innerTransaction[key]) return innerTransaction[key];
        return innerTransaction[key] = Transaction.start(target[key]);
      }
      if (key === 'delta') return delta;
      if (key === 'deleted') return deleted;
      if (methods.hasOwnProperty(key)) return methods[key];
      if (delta.hasOwnProperty(key)) return delta[key];
      if (deleted.indexOf(key) !== -1) return undefined;
      return target[key];
    },
    getOwnPropertyDescriptor: (target, key) => {
      if (deleted.indexOf(key) !== -1) return undefined;
      return Object.getOwnPropertyDescriptor(
        delta.hasOwnProperty(key) ? delta : target, key
      );
    },
    ownKeys() {
      const changes = Object.keys(delta);
      const keys = Object.keys(data)
        .filter(x => deleted.indexOf(x) === -1)
        .concat(changes);
      return keys.filter((x, i, a) => a.indexOf(x) === i);
    },
    set(target, key, val) {
      console.log('set', key, val);
      const index = deleted.indexOf(key);
      if (index !== -1) delete deleted.slice(index, 1);
      if (target[key] === val) delete delta[key];
      else delta[key] = val;
      return true;
    },
    deleteProperty(target, key) {
      console.log('delete', target, key);
      if (target[key] || delta[key]) deleted.push(key);
      delete delta[key];
      return true;
    }
  });
};

function DatasetTransaction(dataset) {
  this.proxy = Transaction.start({ dataset });
	this.dataset = this.proxy.dataset;
}

DatasetTransaction.start = function(dataset) {
	if (typeof dataset !== 'object' && typeof dataset !== 'function') dataset = { data: dataset };
  return new DatasetTransaction(dataset);
};

DatasetTransaction.prototype.commit = function() {
	this.proxy.commit();
};

DatasetTransaction.prototype.rollback = function() {
  this.proxy.rollback();
};

DatasetTransaction.prototype.add = function(dataset) {
  const transactions = [];
  if (dataset.isArray) dataset.forEach(data => transactions.push(Transaction.start(data)));
  else transactions.push(Transaction.start(dataset));
  transactions.forEach(transaction => this.dataset.push(transaction));
};

DatasetTransaction.prototype.delete = function(index) {
  if (this.dataset.length < index) return false;
  delete this.dataset[index];
  return true;
};

//Usage

const data = [
  { name: 'Marcus Aurelius', born: 121 },
  { name: { name: 'Marcus', info: { city: 'Kyiv', language: 'JS' } }, born: 121 },
  { name: 'Marcus Aurelius', born: 121 }
];

const transaction = DatasetTransaction.start(data);

for (const person of transaction.dataset) {
  person.city = 'Shaoshan';
  delete person.born;
}

transaction.add({ city: 'Hanoi' });
transaction.add(1);
transaction.delete(0);
transaction.dataset[1].name.name = 'Tin';
transaction.dataset[1].name.info.city = 'Odessa';
delete transaction.dataset[1].name.info.language;

console.dir({ data });
console.log(data[1].name);


// transaction.rollback();
transaction.commit();

console.dir({ data });
console.log(data[1].name);
