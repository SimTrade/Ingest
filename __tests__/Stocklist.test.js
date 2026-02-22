'use strict';

// ---------------------------------------------------------------------------
// Mocks — all before require()
// ---------------------------------------------------------------------------

// jsdom is real but JSDOM constructor is straightforward; mock to stay in Node env
jest.mock('jsdom', () => {
  const mockWindow = { document: {}, location: {} };
  const JSDOM = jest.fn().mockImplementation(() => ({ window: mockWindow }));
  return { JSDOM };
});

// jquery vendor factory: require('./js/jquery')(window) → jQuery-like object
jest.mock('../Library/js/jquery', () =>
  jest.fn().mockReturnValue({
    unique: (arr) => [...new Set(arr)],
  }), { virtual: true }
);

// jquery csv plugin (just needs to exist)
jest.mock('../Library/js/jquery.csv.js', () => ({}), { virtual: true });

jest.mock('../Library/Secrets/Azure', () => ({
  Secrets: jest.fn(() => ({
    STORAGE_ACCOUNT: 'mock-account',
    ACCESS_KEY:      'mock-key',
  })),
}), { virtual: true });

jest.mock('azure-storage', () => ({
  createTableService: jest.fn(() => ({})),
  TableQuery:         jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../Library/AzureStorage', () => ({
  GetTable: jest.fn(),
  GetDaily: jest.fn(),
}));

jest.mock('../Library/logging', () => ({
  newestlisttopVolume: jest.fn(() => []),
  getEodCsvs:          jest.fn(() => []),
  getEODMaster:        jest.fn(() => []),
  GetStockList:        jest.fn(() => '{"obj":[]}'),
}));

// ---------------------------------------------------------------------------

const AzureStorage = require('../Library/AzureStorage');
const Stocklist    = require('../Library/Stocklist');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build an entity row whose RowKey[1] yields the given symbol.
 * Stocklist uses Object.values(x.RowKey)[1] to extract the symbol.
 */
function row(symbol) {
  return { RowKey: { type: 'Edm.String', value: symbol } };
}

/**
 * Route AzureStorage.GetTable so each named table returns its own rows array.
 * Tables not in the map return [].
 */
function routeGetTable(tableMap) {
  AzureStorage.GetTable.mockImplementation((tableName, _ts, _q, cb) => {
    cb((tableMap[tableName] || []).map((s) => row(s)));
  });
}

// ---------------------------------------------------------------------------
// SymbolList
// ---------------------------------------------------------------------------

describe('Stocklist.SymbolList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls GetTable for all five tables', (done) => {
    routeGetTable({});

    Stocklist.SymbolList('NORMAL', () => {
      const tables = AzureStorage.GetTable.mock.calls.map(([t]) => t);
      expect(tables).toContain('Top1000');
      expect(tables).toContain('Second1000');
      expect(tables).toContain('Third1000');
      expect(tables).toContain('Fourth1000');
      expect(tables).toContain('Last1000');
      done();
    });
  });

  it('calls GetTable exactly five times', (done) => {
    routeGetTable({});

    Stocklist.SymbolList('NORMAL', () => {
      expect(AzureStorage.GetTable).toHaveBeenCalledTimes(5);
      done();
    });
  });

  it('aggregates symbols from all five tables', (done) => {
    routeGetTable({
      Top1000:    ['AAPL'],
      Second1000: ['MSFT'],
      Third1000:  ['GOOG'],
      Fourth1000: ['TSLA'],
      Last1000:   ['NVDA'],
    });

    Stocklist.SymbolList('NORMAL', (symbols) => {
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('MSFT');
      expect(symbols).toContain('GOOG');
      expect(symbols).toContain('TSLA');
      expect(symbols).toContain('NVDA');
      done();
    });
  });

  it('de-duplicates symbols appearing in multiple tables', (done) => {
    routeGetTable({
      Top1000:    ['AAPL', 'MSFT'],
      Second1000: ['AAPL'],         // duplicate
      Third1000:  [],
      Fourth1000: [],
      Last1000:   [],
    });

    Stocklist.SymbolList('NORMAL', (symbols) => {
      const aaplCount = symbols.filter((s) => s === 'AAPL').length;
      expect(aaplCount).toBe(1);
      done();
    });
  });

  it('reverses the list when symbolStart is "REVERSE"', (done) => {
    routeGetTable({
      Top1000:    ['AAPL'],
      Second1000: ['MSFT'],
      Third1000:  ['GOOG'],
      Fourth1000: [],
      Last1000:   [],
    });

    Stocklist.SymbolList('REVERSE', (symbols) => {
      // Sorted then reversed → last alphabetically first
      const sorted  = [...symbols].sort();
      const reversed = [...sorted].reverse();
      expect(symbols).toEqual(reversed);
      done();
    });
  });

  it('calls the callback with an array', (done) => {
    routeGetTable({});

    Stocklist.SymbolList('FULL', (symbols) => {
      expect(Array.isArray(symbols)).toBe(true);
      done();
    });
  });

  it('returns an empty array when all tables are empty', (done) => {
    routeGetTable({});

    Stocklist.SymbolList('NORMAL', (symbols) => {
      expect(symbols).toEqual([]);
      done();
    });
  });
});

// ---------------------------------------------------------------------------
// SymbolList1000
// ---------------------------------------------------------------------------

describe('Stocklist.SymbolList1000', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls GetTable with Top1000', (done) => {
    routeGetTable({ Top1000: ['AAPL'] });

    Stocklist.SymbolList1000(() => {
      expect(AzureStorage.GetTable.mock.calls[0][0]).toBe('Top1000');
      done();
    });
  });

  it('calls GetTable exactly once', (done) => {
    routeGetTable({ Top1000: ['AAPL'] });

    Stocklist.SymbolList1000(() => {
      expect(AzureStorage.GetTable).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('appends the hardcoded ETF list to symbols from Top1000', (done) => {
    routeGetTable({ Top1000: ['NVDA'] });

    Stocklist.SymbolList1000((symbols) => {
      // ETFs that should always be included
      expect(symbols).toContain('SPY');
      expect(symbols).toContain('QQQ');
      expect(symbols).toContain('GLD');
      expect(symbols).toContain('TLT');
      expect(symbols).toContain('VIXY');
      done();
    });
  });

  it('also contains the original Top1000 symbol', (done) => {
    routeGetTable({ Top1000: ['TSLA'] });

    Stocklist.SymbolList1000((symbols) => {
      expect(symbols).toContain('TSLA');
      done();
    });
  });

  it('calls the callback with an array', (done) => {
    routeGetTable({ Top1000: [] });

    Stocklist.SymbolList1000((symbols) => {
      expect(Array.isArray(symbols)).toBe(true);
      done();
    });
  });
});

// ---------------------------------------------------------------------------
// EtfListAndSymbols
// ---------------------------------------------------------------------------

describe('Stocklist.EtfListAndSymbols', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls GetTable with the provided universe name', (done) => {
    routeGetTable({ MyUniverse: ['AAPL'] });

    Stocklist.EtfListAndSymbols('MyUniverse', () => {
      expect(AzureStorage.GetTable.mock.calls[0][0]).toBe('MyUniverse');
      done();
    });
  });

  it('calls GetTable exactly once', (done) => {
    routeGetTable({ SomeUniverse: [] });

    Stocklist.EtfListAndSymbols('SomeUniverse', () => {
      expect(AzureStorage.GetTable).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('appends standard ETFs to universe symbols', (done) => {
    routeGetTable({ MyUniverse: ['NVDA'] });

    Stocklist.EtfListAndSymbols('MyUniverse', (symbols) => {
      expect(symbols).toContain('SPY');
      expect(symbols).toContain('QQQ');
      expect(symbols).toContain('XLK');
      expect(symbols).toContain('GLD');
      done();
    });
  });

  it('result contains the universe symbol', (done) => {
    routeGetTable({ Etfs: ['ARKK'] });

    Stocklist.EtfListAndSymbols('Etfs', (symbols) => {
      expect(symbols).toContain('ARKK');
      done();
    });
  });

  it('calls the callback with an array', (done) => {
    routeGetTable({ X: [] });

    Stocklist.EtfListAndSymbols('X', (symbols) => {
      expect(Array.isArray(symbols)).toBe(true);
      done();
    });
  });
});
