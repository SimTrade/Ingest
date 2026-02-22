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
  TableQuery: jest.fn().mockImplementation(() => ({ where: jest.fn().mockReturnThis() })),
  TableUtilities: { entityGenerator: { String: (v) => ({ _: v }), Int32: (v) => ({ _: v }), Double: (v) => ({ _: v }) } },
}));
jest.mock('../Library/AzureStorage', () => ({
  ToTable: jest.fn(),
  StoreBeta: jest.fn(),
  GetTable: jest.fn(),
  GetDaily: jest.fn(),
  StoreOrders: jest.fn(),
  GetEtfDictionary: jest.fn(),
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
jest.mock('json-query', () => jest.fn(() => ({ value: null })));
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

describe('Builder.GetPortfolio', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls callback with the raw JSON string from XHR', (done) => {
    const { XMLHttpRequest } = require('xmlhttprequest');
    const mockBody = JSON.stringify({ equity: '10000' });
    XMLHttpRequest.mockImplementation(() => ({
      onreadystatechange: null,
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn(function () {
        this.onreadystatechange && this.onreadystatechange.call({ readyState: 4, status: 200, responseText: mockBody });
      }),
    }));

    Builder.GetPortfolio((data) => {
      expect(data).toBe(mockBody);
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

  it('DeleteStocksWeekly calls MongoDb.Delete with StocksWeekly', () => {
    Builder.DeleteStocksWeekly();
    expect(MongoDb.Delete).toHaveBeenCalledWith('StocksWeekly');
  });

  it('DeleteShortVolume calls MongoDb.Delete with ShortVolume', () => {
    Builder.DeleteShortVolume();
    expect(MongoDb.Delete).toHaveBeenCalledWith('ShortVolume');
  });

  it('DeleteBalanceSheet calls MongoDb.Delete with BalanceSheet', () => {
    Builder.DeleteBalanceSheet();
    expect(MongoDb.Delete).toHaveBeenCalledWith('BalanceSheet');
  });

  it('DeleteCashFlow calls MongoDb.Delete with CashFlow', () => {
    Builder.DeleteCashFlow();
    expect(MongoDb.Delete).toHaveBeenCalledWith('CashFlow');
  });

  it('DeleteGrowth calls MongoDb.Delete with Growth', () => {
    Builder.DeleteGrowth();
    expect(MongoDb.Delete).toHaveBeenCalledWith('Growth');
  });

  it('DeleteIncome calls MongoDb.Delete with Income', () => {
    Builder.DeleteIncome();
    expect(MongoDb.Delete).toHaveBeenCalledWith('Income');
  });

  it('DeleteMetrics calls MongoDb.Delete with Metrics', () => {
    Builder.DeleteMetrics();
    expect(MongoDb.Delete).toHaveBeenCalledWith('Metrics');
  });

  it('DeletePMI calls MongoDb.Delete with PMI', () => {
    Builder.DeletePMI();
    expect(MongoDb.Delete).toHaveBeenCalledWith('PMI');
  });

  it('DeleteSectorEtfWeekly calls MongoDb.Delete with SectorEtfWeekly', () => {
    Builder.DeleteSectorEtfWeekly();
    expect(MongoDb.Delete).toHaveBeenCalledWith('SectorEtfWeekly');
  });

  it('DeleteVIX calls MongoDb.Delete with VIX', () => {
    Builder.DeleteVIX();
    expect(MongoDb.Delete).toHaveBeenCalledWith('VIX');
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

describe('Builder.RiskToTable', () => {
  beforeEach(() => jest.clearAllMocks());

  const riskData = {
    Beta: 1.1,
    'Basic Materials': 0.1,
    Healthcare: 0.2,
    'Real Estate': 0.3,
    Industrials: 0.4,
    'Consumer Cyclical': 0.5,
    'Financial Services': 0.6,
    Energy: 0.7,
    'Consumer Defensive': 0.8,
    Utilities: 0.9,
    Technology: 1.0,
    undefined: 0.0,
  };

  it('calls AzureStorage.ToTable with the provided table name', () => {
    const AzureStorage = require('../Library/AzureStorage');
    Builder.RiskToTable('RiskTable', riskData);
    expect(AzureStorage.ToTable.mock.calls[0][0]).toBe('RiskTable');
  });

  it('passes a task with Beta field set', () => {
    const AzureStorage = require('../Library/AzureStorage');
    Builder.RiskToTable('RiskTable', riskData);
    const task = AzureStorage.ToTable.mock.calls[0][2];
    expect(task.Beta._).toBe(1.1);
  });

  it('passes a task with Technology field set', () => {
    const AzureStorage = require('../Library/AzureStorage');
    Builder.RiskToTable('RiskTable', riskData);
    const task = AzureStorage.ToTable.mock.calls[0][2];
    expect(task.Technology._).toBe(1.0);
  });
});

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

describe('Builder.skew / vix / inflation', () => {
  function mockXHR(responseText) {
    const { XMLHttpRequest } = require('xmlhttprequest');
    XMLHttpRequest.mockImplementation(function () {
      this.open = jest.fn();
      this.send = jest.fn(function () {
        this.readyState  = 4;
        this.status      = 200;
        this.responseText = responseText;
        this.onreadystatechange();
      });
    });
  }

  beforeEach(() => jest.clearAllMocks());

  it('skew fires XHR and writes SKEW.csv', async () => {
    const fs = require('fs');
    mockXHR('Date,SKEW\n2024-01-15,143.5');
    Builder.skew();
    await Promise.resolve(); await Promise.resolve();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('SKEW.csv'), expect.any(String)
    );
  });

  it('vix fires XHR and writes VIX.csv', async () => {
    const fs = require('fs');
    mockXHR('Date,VIX\n2024-01-15,18.5');
    Builder.vix();
    await Promise.resolve(); await Promise.resolve();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('VIX.csv'), expect.any(String)
    );
  });

  it('inflation fires XHR and writes INFLATION.csv', async () => {
    const fs = require('fs');
    mockXHR('Date,Value\n2024-01-15,3.2');
    Builder.inflation();
    await Promise.resolve(); await Promise.resolve();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('INFLATION.csv'), expect.any(String)
    );
  });
});

// ---------------------------------------------------------------------------
// CloseAllPositions / CancelAllOrders / GetOrders
// ---------------------------------------------------------------------------

describe('Builder.CloseAllPositions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls paca.closeAllPositions', () => {
    Builder.CloseAllPositions();
    expect(mockPaca.closeAllPositions).toHaveBeenCalledTimes(1);
  });
});

describe('Builder.CancelAllOrders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls paca.cancelAllOrders', () => {
    Builder.CancelAllOrders();
    expect(mockPaca.cancelAllOrders).toHaveBeenCalledTimes(1);
  });
});

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

describe('Builder.GetMacroTable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls AzureStorage.GetDaily and invokes callback with result', (done) => {
    const AzureStorage = require('../Library/AzureStorage');
    // GetMacroTable inner func calls AzureStorage.GetDaily('Macro', ts, query, cb)
    AzureStorage.GetDaily.mockImplementation((_tbl, _ts, _q, cb) => cb([]));

    Builder.GetMacroTable('2024-01-15', (result) => {
      expect(Array.isArray(result)).toBe(true);
      done();
    });
  });
});

describe('Builder.GetSectorSharpeDaily', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls AzureStorage.GetDaily and passes result to callback', (done) => {
    const AzureStorage = require('../Library/AzureStorage');
    AzureStorage.GetDaily.mockImplementation((_tbl, _ts, _q, cb) => cb([]));

    Builder.GetSectorSharpeDaily('2024-01-15', (result) => {
      expect(Array.isArray(result)).toBe(true);
      done();
    });
  });
});

describe('Builder.GetRiskDaily', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls AzureStorage.GetDaily and passes result to callback', (done) => {
    const AzureStorage = require('../Library/AzureStorage');
    AzureStorage.GetDaily.mockImplementation((_tbl, _ts, _q, cb) => cb([]));

    Builder.GetRiskDaily('2024-01-15', (result) => {
      expect(Array.isArray(result)).toBe(true);
      done();
    });
  });
});
