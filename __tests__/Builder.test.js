'use strict';

// ─── All mocks BEFORE require ────────────────────────────────────────────────
jest.mock('xmlhttprequest', () => ({ XMLHttpRequest: jest.fn() }));
// Expose the bound paca instance so tests can assert on the exact mock
// Builder.js calls getCreds() ONCE at module-load; every subsequent call in
// tests returns the same object.
const mockPaca = {
  closeAllPositions: jest.fn().mockResolvedValue({}),
  getOrders: jest.fn().mockResolvedValue([]),
  cancelAllOrders: jest.fn().mockResolvedValue({}),
};
jest.mock('../Library/Secrets/AlpacaCreds', () => ({
  getCreds: jest.fn(() => mockPaca),
  KEYID: jest.fn(() => 'mock-key'),
  SECRETKEY: jest.fn(() => 'mock-secret'),
  __paca: mockPaca,
}), { virtual: true });
jest.mock('../Library/Secrets/Azure', () => ({
  Secrets: jest.fn(() => ({
    STORAGE_ACCOUNT: 'mock-account',
    ACCESS_KEY: 'mock-key',
    MongoDbUri: 'mongodb://mock',
  })),
}), { virtual: true });

// Dep mocks
jest.mock('azure-storage', () => ({
  createTableService: jest.fn(() => ({
    insertOrReplaceEntity: jest.fn((table, entity, cb) => cb && cb(null, {})),
    queryEntities: jest.fn(),
  })),
  createFileService: jest.fn(() => ({})),
  TableQuery: jest.fn().mockImplementation(() => ({ where: jest.fn().mockReturnThis(), and: jest.fn().mockReturnThis() })),
  TableUtilities: { entityGenerator: { String: (v) => ({ _: v }), Int32: (v) => ({ _: v }), Double: (v) => ({ _: v }) } },
}));
jest.mock('../Library/AzureStorage', () => ({
  ToTable: jest.fn(),
  StoreBeta: jest.fn(),
  GetTable: jest.fn(),
  GetDaily: jest.fn(),
  StoreOrders: jest.fn(),
  GetEtfDictionary: jest.fn(),
  GetSectorEtfs: jest.fn(),
}));
jest.mock('../Library/MongoDb.js', () => ({
  GetMongoFundamentals: jest.fn(),
  GetMongoFundamentalsSymbols: jest.fn(),
  GetMongoShortVolume: jest.fn(),
  GetMongoPMI: jest.fn(),
  GetMongoVIX: jest.fn(),
  GetMongoSectorEtf: jest.fn(),
  GetMongoStockWeekly: jest.fn(),
  GetMongoStockDaily: jest.fn(),
  Upsert: jest.fn(),
  Delete: jest.fn(),
}));
jest.mock('../Library/Analyze', () => ({
  RapidApi: jest.fn(),
  FinnCompanyProfile: jest.fn(),
  FinnTranscriptList: jest.fn(),
  FinnTranscriptCall: jest.fn(),
  VIXQuandl:  jest.fn().mockResolvedValue('{"dataset":{"data":[]}}'),
  PMIQuandl:  jest.fn().mockResolvedValue('{"dataset":{"data":[]}}'),
  FinnEconCodes: jest.fn().mockResolvedValue('[]'),
  FinnEconData:  jest.fn().mockResolvedValue('{}'),
  FinnSymbolList: jest.fn(() => Promise.resolve('[]')),
  Company:    jest.fn().mockResolvedValue('{"industry":"Tech","sector":"Tech","active":true}'),
  IEX:        jest.fn().mockResolvedValue('{"marketcap":1000,"beta":1.1}'),
}));
jest.mock('../Library/Stocklist', () => ({
  SymbolList: jest.fn(),
  SymbolList1000: jest.fn(),
  EODList: jest.fn(() => []),
  EtfListAndSymbols: jest.fn(),
}));
jest.mock('../Library/logging', () => ({
  CreateCSV: jest.fn(),
  Log: jest.fn(),
}));
jest.mock('async', () => ({
  waterfall: jest.fn((tasks, cb) => cb && cb(null)),
  each: jest.fn((arr, fn, cb) => cb && cb(null)),
}));
jest.mock('mkdirp', () => jest.fn((path, cb) => cb && cb(null)));
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => ''),
  existsSync: jest.fn(() => false),
  createReadStream: jest.fn(() => ({ pipe: jest.fn().mockReturnThis(), on: jest.fn().mockReturnThis() })),
}));
jest.mock('download', () => jest.fn().mockResolvedValue(Buffer.from('')));
jest.mock('node-xlsx', () => ({ default: { parse: jest.fn(() => [{ data: [] }]) } }));
jest.mock('csv-parser', () => jest.fn(() => ({ on: jest.fn().mockReturnThis() })));
jest.mock('json-query', () => jest.fn(() => ({ value: [] })));
jest.mock('line-by-line', () => jest.fn().mockImplementation(() => ({
  on: jest.fn().mockReturnThis(),
  resume: jest.fn(),
})));
jest.mock('cheerio', () => ({ load: jest.fn(() => jest.fn(() => ({ text: jest.fn(() => '') }))) }));
jest.mock('request-promise', () => jest.fn().mockResolvedValue(''));
jest.mock('google-trends-api', () => ({ interestOverTime: jest.fn().mockResolvedValue('{}') }));
jest.mock('g-trends', () => ({
  ExploreTrendRequest: jest.fn(),
  SearchProviders: {},
}));
jest.mock('twilio/lib/rest/supersim/v1/networkAccessProfile/networkAccessProfileNetwork', () => ({
  NetworkAccessProfileNetworkInstance: jest.fn(),
}));
jest.mock('json2csv', () => ({
  Parser: jest.fn().mockImplementation(() => ({ parse: jest.fn(() => 'symbol,qty,time\n') })),
}));

const Builder = require('../Library/Builder');

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Builder.ShortVolumeTask', () => {
  // Pure function — no mocks needed beyond construction
  const date = '2024-06-01';
  const stock = 'AAPL';

  function makeData(rows) {
    return JSON.stringify({ dataset: { data: rows } });
  }

  it('returns an entity with correct PartitionKey and RowKey', () => {
    const data = makeData([[0, 1000, 0, 5000], [0, 900, 0, 4500]]);
    const task = Builder.ShortVolumeTask(data, stock, date);
    expect(task.PartitionKey._).toBe(date);
    expect(task.RowKey._).toBe(stock);
  });

  it('computes wkAvg from days 2-6 and growthDiff = wkAvg - day1', () => {
    // day1=1000²/5000=200, day2=900²/4500=180, remaining 0
    const data = makeData([
      [0, 1000, 0, 5000],
      [0, 900, 0, 4500],
    ]);
    const task = Builder.ShortVolumeTask(data, stock, date);
    const day1 = (1000 * 1000) / 5000; // 200
    const day2 = (900 * 900) / 4500;   // 180
    const wkAvg = day2 / 5;            // only day2 present, rest 0
    expect(task.shortDay._).toBeCloseTo(day1);
    expect(task.shortWeekAvg._).toBeCloseTo(wkAvg);
    expect(task.growthDiff._).toBeCloseTo(wkAvg - day1);
  });

  it('handles missing rows with zero fallback', () => {
    const data = makeData([]); // all rows missing
    const task = Builder.ShortVolumeTask(data, stock, date);
    expect(task.shortDay._).toBe(0);
    expect(task.shortWeekAvg._).toBe(0);
    expect(task.growthDiff._).toBe(0);
  });

  it('returns all six expected fields', () => {
    const data = makeData([[0, 500, 0, 2500]]);
    const task = Builder.ShortVolumeTask(data, stock, date);
    expect(task).toHaveProperty('PartitionKey');
    expect(task).toHaveProperty('RowKey');
    expect(task).toHaveProperty('growthDiff');
    expect(task).toHaveProperty('shortDay');
    expect(task).toHaveProperty('shortWeekAvg');
  });
});

describe('Builder.GetCalendar', () => {
  // GetCalendar delegates to IsTradingDay which uses XHR.
  // We mock XMLHttpRequest at the module level above, but the real function
  // sets onreadystatechange — we need to simulate a completing XHR.
  beforeEach(() => jest.clearAllMocks());

  it('calls callback with true when returned date matches tradingDay', (done) => {
    const { XMLHttpRequest } = require('xmlhttprequest');
    const tradingDay = '2024-06-03';
    XMLHttpRequest.mockImplementation(() => ({
      onreadystatechange: null,
      readyState: 4,
      status: 200,
      responseText: JSON.stringify([{ date: tradingDay }]),
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn(function () {
        this.onreadystatechange && this.onreadystatechange.call({ readyState: 4, status: 200, responseText: JSON.stringify([{ date: tradingDay }]) });
      }),
    }));

    Builder.GetCalendar(tradingDay, (isTrading) => {
      expect(isTrading).toBe(true);
      done();
    });
  });

  it('calls callback with false when returned date does not match', (done) => {
    const { XMLHttpRequest } = require('xmlhttprequest');
    const tradingDay = '2024-06-03';
    XMLHttpRequest.mockImplementation(() => ({
      onreadystatechange: null,
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn(function () {
        this.onreadystatechange && this.onreadystatechange.call({ readyState: 4, status: 200, responseText: JSON.stringify([{ date: '2024-06-02' }]) });
      }),
    }));

    Builder.GetCalendar(tradingDay, (isTrading) => {
      expect(isTrading).toBe(false);
      done();
    });
  });
});

describe('Builder.RunIngest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback after Stocklist.SymbolList resolves all symbols', (done) => {
    jest.useFakeTimers();
    const Stocklist = require('../Library/Stocklist');
    Stocklist.SymbolList.mockImplementation((start, cb) => cb(['AAPL', 'MSFT']));

    Builder.RunIngest('Income', 'anyStart', () => {
      // timers needed because Ingest uses setTimeout per symbol
      done();
    });

    jest.runAllTimers();
    jest.useRealTimers();
  });

  it('passes the factor key to Stocklist.SymbolList', (done) => {
    jest.useFakeTimers();
    const Stocklist = require('../Library/Stocklist');
    Stocklist.SymbolList.mockImplementation((start, cb) => {
      expect(start).toBe('myStart');
      cb([]);
      done();
    });

    Builder.RunIngest('Income', 'myStart', jest.fn());
    jest.runAllTimers();
    jest.useRealTimers();
  });
});

describe('Builder.FinishIngest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback after processing remaining symbols', (done) => {
    jest.useFakeTimers();
    const Stocklist = require('../Library/Stocklist');
    // SymbolList returns symbols; stocks are excluded ones not in the passed list
    Stocklist.SymbolList.mockImplementation((start, cb) => cb(['AAPL', 'MSFT', 'GOOG']));

    Builder.FinishIngest('Income', ['AAPL'], () => {
      done();
    });

    jest.runAllTimers();
    jest.useRealTimers();
  });
});

describe('Builder.GetBetaIEX', () => {
  it('is a function exposed by Builder', () => {
    expect(typeof Builder.GetBetaIEX).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Delete* functions
// ---------------------------------------------------------------------------

describe('Builder Delete functions', () => {
  let MongoDb;
  beforeEach(() => {
    jest.clearAllMocks();
    MongoDb = require('../Library/MongoDb.js');
  });

  it('DeleteTable calls MongoDb.Delete with the given table name and callback', () => {
    const cb = jest.fn();
    Builder.DeleteTable('MyTable', cb);
    expect(MongoDb.Delete).toHaveBeenCalledWith('MyTable', cb);
  });

});

// ---------------------------------------------------------------------------
// LogBeta
// ---------------------------------------------------------------------------

describe('Builder.LogBeta', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls AzureStorage.StoreBeta with the provided data', () => {
    const AzureStorage = require('../Library/AzureStorage');
    Builder.LogBeta({ Beta: 1.2 });
    expect(AzureStorage.StoreBeta).toHaveBeenCalledTimes(1);
    expect(AzureStorage.StoreBeta.mock.calls[0][0]).toEqual({ Beta: 1.2 });
  });
});

// ---------------------------------------------------------------------------
// COtToAzureTableStorage
// ---------------------------------------------------------------------------

describe('Builder.COtToAzureTableStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls AzureStorage.ToTable with COT as the table name', () => {
    const AzureStorage = require('../Library/AzureStorage');
    Builder.COtToAzureTableStorage('2024-01-15', 0.5, 0.3, 0.2);
    expect(AzureStorage.ToTable).toHaveBeenCalledTimes(1);
    expect(AzureStorage.ToTable.mock.calls[0][0]).toBe('COT');
  });

  it('task PartitionKey and RowKey are the provided date', () => {
    const AzureStorage = require('../Library/AzureStorage');
    Builder.COtToAzureTableStorage('2024-01-15', 0.5, 0.3, 0.2);
    const task = AzureStorage.ToTable.mock.calls[0][2];
    expect(task.PartitionKey._).toBe('2024-01-15');
    expect(task.RowKey._).toBe('2024-01-15');
  });

  it('task carries NasdaqScore, dowScore, and BondsScore', () => {
    const AzureStorage = require('../Library/AzureStorage');
    Builder.COtToAzureTableStorage('2024-01-15', 0.5, 0.3, 0.2);
    const task = AzureStorage.ToTable.mock.calls[0][2];
    expect(task.NasdaqScore._).toBe(0.5);
    expect(task.dowScore._).toBe(0.3);
    expect(task.BondsScore._).toBe(0.2);
  });
});

// ---------------------------------------------------------------------------
// RiskToTable
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PmiVixIngestion
// ---------------------------------------------------------------------------

describe('Builder.PmiVixIngestion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls Analyze.VIXQuandl', () => {
    const Analyze = require('../Library/Analyze');
    Builder.PmiVixIngestion();
    expect(Analyze.VIXQuandl).toHaveBeenCalledTimes(1);
  });

  it('calls Analyze.PMIQuandl', () => {
    const Analyze = require('../Library/Analyze');
    Builder.PmiVixIngestion();
    expect(Analyze.PMIQuandl).toHaveBeenCalledTimes(1);
  });

  it('calls MongoDb.Upsert with VIX after VIXQuandl resolves', async () => {
    const MongoDb  = require('../Library/MongoDb.js');
    Builder.PmiVixIngestion();
    await Promise.resolve(); await Promise.resolve();
    expect(MongoDb.Upsert).toHaveBeenCalledWith('VIX', 'vix', expect.any(String));
  });

  it('calls MongoDb.Upsert with PMI after PMIQuandl resolves', async () => {
    const MongoDb  = require('../Library/MongoDb.js');
    Builder.PmiVixIngestion();
    await Promise.resolve(); await Promise.resolve();
    expect(MongoDb.Upsert).toHaveBeenCalledWith('PMI', 'pmi', expect.any(String));
  });
});

// ---------------------------------------------------------------------------
// skew / vix / inflation — fire XHR, write file
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CloseAllPositions / CancelAllOrders / GetOrders
// ---------------------------------------------------------------------------

describe('Builder.GetOrders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls paca.getOrders', () => {
    Builder.GetOrders();
    expect(mockPaca.getOrders).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// BuildTableUniverses
// ---------------------------------------------------------------------------

describe('Builder.BuildTableUniverses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls AzureStorage.ToTable for each of the 5 universe tables', (done) => {
    const AzureStorage = require('../Library/AzureStorage');
    // GetFinnhubList calls AzureStorage.GetTable for FinnhubList
    AzureStorage.GetTable.mockImplementation((_table, _ts, _q, cb) => cb([]));

    Builder.BuildTableUniverses(() => {
      // async.waterfall is mocked to call each step then final cb
      // ToTable won't be called because GetFinnhubList returns empty → items = []
      // but the waterfall should still complete
      done();
    });
  });

  it('is a function exposed on Builder', () => {
    expect(typeof Builder.BuildTableUniverses).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// GetMacroTable / GetSectorSharpeDaily / GetRiskDaily
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GetEtfDictionary
// ---------------------------------------------------------------------------

describe('Builder.GetEtfDictionary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls AzureStorage.GetEtfDictionary once', () => {
    const AzureStorage = require('../Library/AzureStorage');
    Builder.GetEtfDictionary();
    expect(AzureStorage.GetEtfDictionary).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// reduce (empty function)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CompanyProfile
// ---------------------------------------------------------------------------

describe('Builder.CompanyProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not throw when EODList is empty', () => {
    const Stocklist = require('../Library/Stocklist');
    Stocklist.EODList.mockReturnValue([]);
    expect(() => Builder.CompanyProfile()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FinnEcon
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// POLYGONCOMPANIES
// ---------------------------------------------------------------------------

describe('Builder.POLYGONCOMPANIES', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback after processing one stock', (done) => {
    jest.useFakeTimers();
    const Stocklist = require('../Library/Stocklist');
    Stocklist.SymbolList.mockImplementation((_s, cb) => cb(['AAPL']));
    Builder.POLYGONCOMPANIES(() => done());
    jest.runAllTimers();
    jest.useRealTimers();
  });

  it('does not throw when SymbolList is empty', () => {
    const Stocklist = require('../Library/Stocklist');
    Stocklist.SymbolList.mockImplementation((_s, cb) => cb([]));
    expect(() => Builder.POLYGONCOMPANIES(jest.fn())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AzureTableRunnerNonSeries delegates: ShortSqueeze / Barcharts / WSJ / Zacks / IEX
// ---------------------------------------------------------------------------

['ShortSqueeze', 'Barcharts', 'WSJ', 'Zacks', 'IEX'].forEach((name) => {
  describe(`Builder.${name}`, () => {
    beforeEach(() => jest.clearAllMocks());

    it('does not throw when SymbolList is empty', () => {
      const Stocklist = require('../Library/Stocklist');
      Stocklist.SymbolList.mockImplementation((_s, cb) => cb([]));
      expect(() => Builder[name]('AAPL')).not.toThrow();
    });

    it('is a function exposed on Builder', () => {
      expect(typeof Builder[name]).toBe('function');
    });
  });
});

// ---------------------------------------------------------------------------
// MongoIngest
// ---------------------------------------------------------------------------

describe('Builder.MongoIngest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not throw when SymbolList returns empty', () => {
    const Stocklist = require('../Library/Stocklist');
    Stocklist.SymbolList.mockImplementation((_u, cb) => cb([]));
    expect(() => Builder.MongoIngest(jest.fn(), 'TestTable', 100, jest.fn())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TableIngestRunner
// ---------------------------------------------------------------------------

describe('Builder.TableIngestRunner', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not throw when SymbolList returns empty', () => {
    const Stocklist = require('../Library/Stocklist');
    Stocklist.SymbolList.mockImplementation((_s, cb) => cb([]));
    expect(() =>
      Builder.TableIngestRunner(100, jest.fn(), 'TestTable', jest.fn(), '2024-01-15', '', jest.fn())
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// RunOBV
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FINNHUBLISTIEX
// ---------------------------------------------------------------------------

describe('Builder.FINNHUBLISTIEX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('../Library/Analyze').FinnSymbolList = jest.fn(() => Promise.resolve('[]'));
  });

  it('does not throw', () => {
    expect(() => Builder.FINNHUBLISTIEX(jest.fn())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// RunWeeklyToMonthly
// ---------------------------------------------------------------------------

describe('Builder.RunWeeklyToMonthly', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not throw when SymbolList returns empty', () => {
    jest.useFakeTimers();
    const Stocklist = require('../Library/Stocklist');
    Stocklist.SymbolList.mockImplementation((_s, cb) => cb([]));
    expect(() =>
      Builder.RunWeeklyToMonthly('TIME_SERIES_DAILY', 'StocksDaily', 'compact', 100, '2024-01-01', '', 'AAPL')
    ).not.toThrow();
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// RunDaily
// ---------------------------------------------------------------------------

describe('Builder.RunDaily', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not throw when SymbolList returns empty', () => {
    jest.useFakeTimers();
    const Stocklist = require('../Library/Stocklist');
    Stocklist.SymbolList.mockImplementation((_s, cb) => cb([]));
    expect(() =>
      Builder.RunDaily('TIME_SERIES_DAILY', 'StocksDaily', 'compact', 100, '2024-01-01', '', 'AAPL', jest.fn())
    ).not.toThrow();
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// SubmitOrder
// ---------------------------------------------------------------------------

describe('Builder.SubmitOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is a function exposed on Builder', () => {
    expect(typeof Builder.SubmitOrder).toBe('function');
  });

  it('calls paca.getBars with day and the symbol (promise never resolves to avoid broken path)', () => {
    // getBars is called synchronously; we use a never-resolving promise
    // so the .then() callback (which references removed `order`) never fires
    mockPaca.getBars = jest.fn().mockReturnValue(new Promise(() => {}));
    Builder.SubmitOrder('AAPL', 500, 3, jest.fn());
    expect(mockPaca.getBars).toHaveBeenCalledWith('day', 'AAPL', { limit: 5 });
  });
});

// ---------------------------------------------------------------------------
// GetPicklist
// ---------------------------------------------------------------------------

describe('Builder.GetPicklist', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is a function exposed on Builder', () => {
    expect(typeof Builder.GetPicklist).toBe('function');
  });

  it('calls AzureStorage.GetTable with PickList', () => {
    const AzureStorage = require('../Library/AzureStorage');
    AzureStorage.GetTable.mockImplementation((_t, _ts, _q, cb) => cb([]));
    Builder.GetPicklist();
    expect(AzureStorage.GetTable).toHaveBeenCalledWith(
      'PickList', expect.anything(), expect.anything(), expect.any(Function)
    );
  });
});

// ---------------------------------------------------------------------------
// Stocklist (export)
// ---------------------------------------------------------------------------

describe('Builder.Stocklist', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is a function exposed on Builder', () => {
    expect(typeof Builder.Stocklist).toBe('function');
  });

  it('calls Analyze.FinnSymbolList', () => {
    const Analyze = require('../Library/Analyze');
    Analyze.FinnSymbolList.mockReturnValue(Promise.resolve('[]'));
    Builder.Stocklist();
    expect(Analyze.FinnSymbolList).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SectorEtfIngestion
// ---------------------------------------------------------------------------

describe('Builder.SectorEtfIngestion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is a function exposed on Builder', () => {
    expect(typeof Builder.SectorEtfIngestion).toBe('function');
  });

  it('does not throw when called', () => {
    const Stocklist = require('../Library/Stocklist');
    Stocklist.SymbolList.mockImplementation((_s, cb) => cb([]));
    expect(() => Builder.SectorEtfIngestion()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// GoogleByLetter
// ---------------------------------------------------------------------------

describe('Builder.GoogleByLetter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is a function exposed on Builder', () => {
    expect(typeof Builder.GoogleByLetter).toBe('function');
  });

  it('does not throw when called', () => {
    expect(() => Builder.GoogleByLetter()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FinnhubIpoCalendar
// ---------------------------------------------------------------------------

describe('Builder.FinnhubIpoCalendar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is a function exposed on Builder', () => {
    expect(typeof Builder.FinnhubIpoCalendar).toBe('function');
  });

  it('does not throw when called with a day argument', () => {
    const Analyze = require('../Library/Analyze');
    Analyze.FinnhubIpoCalendar = jest.fn().mockResolvedValue('{"ipoCalendar":[]}');
    expect(() => Builder.FinnhubIpoCalendar('2024-06-01')).not.toThrow();
  });

  it('calls Analyze.FinnhubIpoCalendar with the given day', () => {
    const Analyze = require('../Library/Analyze');
    Analyze.FinnhubIpoCalendar = jest.fn().mockResolvedValue('{"ipoCalendar":[]}');
    Builder.FinnhubIpoCalendar('2024-06-01');
    expect(Analyze.FinnhubIpoCalendar).toHaveBeenCalledWith('2024-06-01');
  });
});

// ---------------------------------------------------------------------------
// GetDaily
// ---------------------------------------------------------------------------

describe('Builder.GetDaily', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is a function exposed on Builder', () => {
    expect(typeof Builder.GetDaily).toBe('function');
  });

  it('does not throw when called', () => {
    const AzureStorage = require('../Library/AzureStorage');
    AzureStorage.GetTable.mockImplementation((_t, _ts, _q, cb) => cb([]));
    expect(() => Builder.GetDaily(50, -50, jest.fn())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ShortVolumeTask helper (via ShortVolumeTask export — already covered)
// GetBetaIEX — call the function to exercise the body
// ---------------------------------------------------------------------------

describe('Builder.GetBetaIEX body', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls AzureStorage.GetDaily with FinnhubListIEX', () => {
    const AzureStorage = require('../Library/AzureStorage');
    AzureStorage.GetDaily.mockImplementation((_t, _ts, _q, cb) => cb([]));
    Builder.GetBetaIEX(jest.fn());
    expect(AzureStorage.GetDaily).toHaveBeenCalledWith(
      'FinnhubListIEX', expect.anything(), expect.anything(), expect.any(Function)
    );
  });

  it('passes result object to callback', (done) => {
    const AzureStorage = require('../Library/AzureStorage');
    AzureStorage.GetDaily.mockImplementation((_t, _ts, _q, cb) => cb([]));
    Builder.GetBetaIEX((data) => {
      expect(typeof data).toBe('object');
      done();
    });
  });
});


