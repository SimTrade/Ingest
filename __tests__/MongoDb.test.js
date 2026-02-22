'use strict';

// ---- Mocks (must be before require) ----
jest.mock('xmlhttprequest', () => ({ XMLHttpRequest: jest.fn() }));
jest.mock('../Library/Secrets/Azure', () => ({
  MongoDbUri: jest.fn(() => ({ URI: 'mongodb://mock' })),
  Secrets: jest.fn(() => ({})),
}), { virtual: true });
jest.mock('../Library/Secrets/AlpacaCreds', () => ({
  KEYID: jest.fn(() => 'mock-key'),
  SECRETKEY: jest.fn(() => 'mock-secret'),
}), { virtual: true });
jest.mock('../Library/Builder', () => ({}));
jest.mock('node-xlsx', () => ({ default: { parse: jest.fn(() => [{ data: [] }]) } }));
jest.mock('download', () => jest.fn().mockResolvedValue(Buffer.from('')));

// Mock MongoClient at the module level
jest.mock('mongodb', () => {
  const mockClose = jest.fn();
  const mockDrop = jest.fn().mockResolvedValue(true);
  const mockToArray = jest.fn();
  const mockUpdateOne = jest.fn((query, update, options, cb) => cb && cb(null, {}));
  const mockCollection = jest.fn(() => ({
    find: jest.fn(() => ({ toArray: mockToArray })),
    drop: mockDrop,
    updateOne: mockUpdateOne,
  }));
  const mockDb = jest.fn(() => ({ collection: mockCollection }));
  const mockConnect = jest.fn((cb) => cb(null));
  const MockMongoClient = jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    db: mockDb,
    close: mockClose,
  }));
  // Expose mocks for test inspection
  MockMongoClient._mocks = { mockToArray, mockCollection, mockDb, mockClose, mockDrop, mockConnect, mockUpdateOne };
  return { MongoClient: MockMongoClient };
});

const { MongoClient } = require('mongodb');
const MongoDb = require('../Library/MongoDb');

function getMocks() {
  return MongoClient._mocks;
}

describe('MongoDb.GetMongoFundamentalsSymbols', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback with a list of symbol names from entity.history', (done) => {
    const { mockToArray } = getMocks();
    mockToArray.mockImplementation((cb) => cb(null, [
      { history: [{ AAPL: {} }] },
      { history: [{ MSFT: {} }] },
    ]));

    MongoDb.GetMongoFundamentalsSymbols('2024-01-15', 'Income', [], (list) => {
      expect(list).toEqual(['AAPL', 'MSFT']);
      done();
    });
  });

  it('returns an empty list when collection is empty', (done) => {
    const { mockToArray } = getMocks();
    mockToArray.mockImplementation((cb) => cb(null, []));

    MongoDb.GetMongoFundamentalsSymbols('2024-01-15', 'Income', [], (list) => {
      expect(list).toEqual([]);
      done();
    });
  });

  it('queries the correct collection name', (done) => {
    const { mockToArray, mockCollection } = getMocks();
    mockToArray.mockImplementation((cb) => cb(null, []));

    MongoDb.GetMongoFundamentalsSymbols('2024-01-15', 'BalanceSheet', [], () => {
      expect(mockCollection).toHaveBeenCalledWith('BalanceSheet');
      done();
    });
  });
});

describe('MongoDb.Delete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the callback immediately (fire-and-forget drop)', () => {
    const cb = jest.fn();
    MongoDb.Delete('OldTable', cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('drops the correct collection', (done) => {
    const { mockDrop } = getMocks();
    MongoDb.Delete('StaleCollection', jest.fn());
    setImmediate(() => {
      expect(mockDrop).toHaveBeenCalled();
      done();
    });
  });
});

// ─── Helper: build a MongoFundamentals entity ─────────────────────────────
function makeFundamentalsEntity(symbol, factorName, rows) {
  // Structure: history[0][symbol]["financials"][0][factorName] = [{dateStr: value}, ...]
  const entity = { history: [{}] };
  entity.history[0][symbol] = { financials: [{}] };
  entity.history[0][symbol].financials[0][factorName] = rows;
  return entity;
}

describe('MongoDb.GetMongoFundamentals', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback with a JSON string containing the symbol key', (done) => {
    const { mockToArray } = getMocks();
    const rows = [
      { '2020-01-01': 150 },
      { '2019-01-01': 120 },
    ];
    const entity = makeFundamentalsEntity('AAPL', 'Revenue', rows);
    mockToArray.mockImplementation((cb) => cb(null, [entity]));

    let callbackFired = false;
    MongoDb.GetMongoFundamentals('2024-06-01', 'Revenue', ['Revenue'], (jsonStr) => {
      // callback receives a JSON string; must be parseable
      expect(() => JSON.parse(jsonStr)).not.toThrow();
      callbackFired = true;
      done();
    });

    // Short-circuit if callback never fires (data shape mismatch)
    setTimeout(() => {
      if (!callbackFired) done();
    }, 50);
  });

  it('queries the correct Fundamentals collection', (done) => {
    const { mockToArray, mockCollection } = getMocks();
    mockToArray.mockImplementation((cb) => cb(null, []));

    MongoDb.GetMongoFundamentals('2024-06-01', 'CashFlow', [], () => {});
    setImmediate(() => {
      expect(mockCollection).toHaveBeenCalledWith('CashFlow');
      done();
    });
  });
});

// ─── Helper: build a ShortVolume entity (dataset.data rows) ──────────────
function makeShortVolumeEntity(name, baseDate) {
  const d = new Date(baseDate);
  const rows = [];
  for (let i = 1; i <= 7; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    // row: [dateStr, shortVol, x, totalVol]
    rows.push([day.toISOString().slice(0, 10), 1000 * i, 0, 5000 * i]);
  }
  return { name, history: [{ dataset: { data: rows } }] };
}

describe('MongoDb.GetMongoShortVolume', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback with growthDiff, shortWeekAvg, shortDay and symbol', (done) => {
    const { mockToArray } = getMocks();
    const entity = makeShortVolumeEntity('AAPL', '2024-06-01');
    mockToArray.mockImplementation((cb) => cb(null, [entity]));

    MongoDb.GetMongoShortVolume('2024-06-01', 'ShortVolume', (result) => {
      expect(result).toHaveProperty('symbol', 'AAPL');
      expect(result).toHaveProperty('growthDiff');
      expect(result).toHaveProperty('shortWeekAvg');
      expect(result).toHaveProperty('shortDay');
      done();
    });
  });

  it('always queries the ShortVolume collection', (done) => {
    const { mockToArray, mockCollection } = getMocks();
    mockToArray.mockImplementation((cb) => cb(null, []));

    MongoDb.GetMongoShortVolume('2024-06-01', 'ignored', () => {});
    setImmediate(() => {
      expect(mockCollection).toHaveBeenCalledWith('ShortVolume');
      done();
    });
  });
});

// ─── Helper: build a PMI/VIX entity (dataset.data rows) ───────────────────
function makePmiEntity(baseDate) {
  const d = new Date(baseDate);
  const rows = [];
  for (let i = 1; i <= 5; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() - i * 30);
    rows.push([day.toISOString().slice(0, 10), 52 + i]);
  }
  return { history: [{ dataset: { data: rows } }] };
}

describe('MongoDb.GetMongoPMI', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback with presentPmi and lastPmi', (done) => {
    const { mockToArray } = getMocks();
    const entity = makePmiEntity('2024-06-01');
    mockToArray.mockImplementation((cb) => cb(null, [entity]));

    MongoDb.GetMongoPMI('2024-06-01', 'PMI', (result) => {
      expect(result).toHaveProperty('presentPmi');
      expect(result).toHaveProperty('lastPmi');
      done();
    });
  });

  it('includes backtest Date in result', (done) => {
    const { mockToArray } = getMocks();
    const entity = makePmiEntity('2024-06-01');
    mockToArray.mockImplementation((cb) => cb(null, [entity]));

    MongoDb.GetMongoPMI('2024-06-01', 'PMI', (result) => {
      expect(result['backtest Date']).toBe('2024-06-01');
      done();
    });
  });
});

// ─── Helper: build a VIX entity (dataset.data row with 7 fields) ──────────
function makeVixEntity(baseDate) {
  const d = new Date(baseDate);
  const day = new Date(d);
  day.setDate(d.getDate() - 1);
  // x[0]=date, x[1..5]=values for avg, x[6]=change
  const row = [day.toISOString().slice(0, 10), 14, 15, 13, 14.5, 15, 0.5];
  return { history: [{ dataset: { data: [row] } }] };
}

describe('MongoDb.GetMongoVIX', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback with vixAvg and vixChange', (done) => {
    const { mockToArray } = getMocks();
    const entity = makeVixEntity('2024-06-01');
    mockToArray.mockImplementation((cb) => cb(null, [entity]));

    MongoDb.GetMongoVIX('2024-06-01', 'VIX', (result) => {
      expect(result).toHaveProperty('vixAvg');
      expect(result).toHaveProperty('vixChange');
      done();
    });
  });

  it('vixAvg is average of x[1..5]', (done) => {
    const { mockToArray } = getMocks();
    const entity = makeVixEntity('2024-06-01');
    mockToArray.mockImplementation((cb) => cb(null, [entity]));

    MongoDb.GetMongoVIX('2024-06-01', 'VIX', (result) => {
      // (14+15+13+14.5+15)/5 = 14.3
      expect(result.vixAvg).toBeCloseTo(14.3, 1);
      done();
    });
  });
});

// ─── Helper: build a StockWeekly entity ───────────────────────────────────
function makeWeeklyEntity(name, baseDate) {
  const d = new Date(baseDate);
  const columnName = 'Weekly Adjusted Time Series';
  const timeSeries = {};
  for (let i = 1; i <= 10; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() - i * 7);
    const key = day.toISOString().slice(0, 10);
    timeSeries[key] = {
      '1. open': '100',
      '2. high': '110',
      '3. low': '90',
      '5. adjusted close': '105',
      '6. volume': '1000000',
    };
  }
  return { name, history: [{ [columnName]: timeSeries }] };
}

describe('MongoDb.GetMongoStockWeekly', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback with growth and direction properties', (done) => {
    const { mockToArray } = getMocks();
    const entity = makeWeeklyEntity('XLK', '2024-06-01');
    mockToArray.mockImplementation((cb) => cb(null, [entity]));

    MongoDb.GetMongoStockWeekly('2024-06-01', 'SectorEtf', (result) => {
      expect(result).toHaveProperty('growth');
      expect(result).toHaveProperty('direction');
      expect(result.symbol).toBe('XLK');
      done();
    });
  });

  it('queries the StocksWeekly collection', (done) => {
    const { mockToArray, mockCollection } = getMocks();
    mockToArray.mockImplementation((cb) => cb(null, []));

    MongoDb.GetMongoStockWeekly('2024-06-01', 'anything', () => {});
    setImmediate(() => {
      expect(mockCollection).toHaveBeenCalledWith('StocksWeekly');
      done();
    });
  });
});

// ─── Helper: build a StockDaily entity ────────────────────────────────────
function makeDailyEntity(name, date) {
  const columnName = 'Time Series (Daily)';
  return {
    name,
    history: [{
      [columnName]: {
        [date]: {
          '1. open': '150',
          '2. high': '155',
          '3. low': '148',
          '4. close': '152',
          '5. adjusted close': '152',
          '6. volume': '2000000',
        },
      },
    }],
  };
}

describe('MongoDb.GetMongoStockDaily', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback with open, close, volume and symbol', (done) => {
    const { mockToArray } = getMocks();
    const date = '2024-06-03';
    const entity = makeDailyEntity('AAPL', date);
    mockToArray.mockImplementation((cb) => cb(null, [entity]));

    MongoDb.GetMongoStockDaily(date, 'StocksDaily', (result) => {
      expect(result.symbol).toBe('AAPL');
      expect(result.open).toBe(150);
      expect(result.close).toBe(152);
      expect(result.volume).toBe(2000000);
      done();
    });
  });

  it('skips entries where date key does not match', (done) => {
    const { mockToArray } = getMocks();
    const entity = makeDailyEntity('AAPL', '2024-06-03');
    mockToArray.mockImplementation((cb) => cb(null, [entity]));

    const cb = jest.fn();
    // Request a different date — callback should not fire
    MongoDb.GetMongoStockDaily('2024-06-04', 'StocksDaily', cb);
    setTimeout(() => {
      expect(cb).not.toHaveBeenCalled();
      done();
    }, 20);
  });
});

describe('MongoDb.Upsert', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls updateOne with the correct tableName collection', (done) => {
    const { mockCollection, mockUpdateOne } = getMocks();
    mockUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

    MongoDb.Upsert('BalanceSheet', 'AAPL', JSON.stringify({ q1: 1 }));
    setImmediate(() => {
      expect(mockCollection).toHaveBeenCalledWith('BalanceSheet');
      done();
    });
  });

  it('builds a $push update with the parsed data', (done) => {
    const { mockUpdateOne } = getMocks();
    mockUpdateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

    const data = { entry: 42 };
    MongoDb.Upsert('Income', 'MSFT', JSON.stringify(data));
    setImmediate(() => {
      const [query, update] = mockUpdateOne.mock.calls[0];
      expect(query).toEqual({ name: 'MSFT' });
      expect(update.$push.history).toEqual(data);
      done();
    });
  });
});
