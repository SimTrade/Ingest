'use strict';

// ─── Mocks BEFORE require ─────────────────────────────────────────────────────

// azure-storage mock — createTableService returns a usable object
const mockTableService = {
  insertOrReplaceEntity: jest.fn((table, entity, cb) => cb && cb(null, {})),
  queryEntities: jest.fn(),
};
jest.mock('azure-storage', () => ({
  createTableService: jest.fn(() => mockTableService),
  TableQuery: jest.fn().mockImplementation(() => ({
    where: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
  })),
  TableUtilities: {
    entityGenerator: {
      String: (v) => ({ _: v }),
      Int32: (v) => ({ _: v }),
      Double: (v) => ({ _: v }),
    },
  },
}));

jest.mock('../Library/Secrets/Azure', () => ({
  Secrets: jest.fn(() => ({
    STORAGE_ACCOUNT: 'mock-account',
    ACCESS_KEY: 'mock-key',
    MongoDbUri: 'mongodb://mock',
  })),
}), { virtual: true });

const mockAzureStorage = {
  ToTable: jest.fn(),
  StoreBeta: jest.fn(),
  GetTable: jest.fn(),
  GetDaily: jest.fn(),
  StoreOrders: jest.fn(),
  GetEtfDictionary: jest.fn(),
};
jest.mock('../Library/AzureStorage', () => mockAzureStorage);

const mockMongoDb = {
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
};
jest.mock('../Library/MongoDb.js', () => mockMongoDb);

const mockAnalyze = {
  DailyShortVolume: jest.fn(),
  NasdaqCOT: jest.fn(),
  DowCOT: jest.fn(),
  BondsCOT: jest.fn(),
};
jest.mock('../Library/Analyze', () => mockAnalyze);

const mockStocklist = {
  SymbolList: jest.fn(),
  SymbolList1000: jest.fn(),
  EODList: jest.fn(() => []),
  EtfListAndSymbols: jest.fn(),
};
jest.mock('../Library/Stocklist', () => mockStocklist);

const mockBuilder = {
  TableIngestRunner: jest.fn(),
  FinishIngest: jest.fn(),
  GetBetaIEX: jest.fn(),
  COtToAzureTableStorage: jest.fn(),
};
jest.mock('../Library/Builder', () => mockBuilder);

jest.mock('../Library/logging', () => ({
  CreateCSV: jest.fn(),
  Log: jest.fn(),
  appendToErrorLog: jest.fn(),
}));

jest.mock('colors/safe', () => ({
  yellow: jest.fn((s) => s),
  green: jest.fn((s) => s),
  red: jest.fn((s) => s),
  blue: jest.fn((s) => s),
  bold: jest.fn((s) => s),
}));

const mockFs = {
  readFileSync: jest.fn(() => ''),
  writeFile: jest.fn((path, data, cb) => cb && cb(null)),
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

// ─── Subject ──────────────────────────────────────────────────────────────────
const PipelineRunner = require('../Library/PipelineRunner');

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Date conversion wrappers ─────────────────────────────────────────────────

describe('exported wrapper date conversion', () => {
  test('Build_Stock_Daily converts daysback to ISO date and calls MongoDb', () => {
    mockMongoDb.GetMongoStockDaily.mockImplementation((date, col, cb) => {
      cb({ 'backtest Date': date, symbol: 'AAPL', open: 1, high: 2, low: 0.9, close: 1.1, adjustedClose: 1.1, volume: 1000 });
    });
    PipelineRunner.Build_Stock_Daily('2023-06-01T00:00:00Z');
    expect(mockMongoDb.GetMongoStockDaily).toHaveBeenCalledWith(
      '2023-06-01',
      'StocksDaily',
      expect.any(Function)
    );
  });

  test('Build_Stock_Weekly converts daysback to ISO date and calls MongoDb', () => {
    mockMongoDb.GetMongoStockWeekly.mockImplementation((date, col, cb) => {
      cb({ 'backtest Date': date, symbol: 'MSFT', growth: 0.05, direction: 'up' });
    });
    PipelineRunner.Build_Stock_Weekly('2023-06-01T00:00:00Z');
    expect(mockMongoDb.GetMongoStockWeekly).toHaveBeenCalledWith(
      '2023-06-01',
      'StocksWeekly',
      expect.any(Function)
    );
  });

  test('Build_Macro converts daysback and triggers PMI/VIX queries via setTimeout', (done) => {
    mockMongoDb.GetMongoPMI.mockImplementation((date, col, cb) => {
      cb({ 'backtest Date': date, presentDate: date, presentPmi: 55, lastDate: date, lastPmi: 53 });
    });
    mockMongoDb.GetMongoVIX.mockImplementation((date, col, cb) => {
      cb({ 'backtest Date': date, vixDay: 20, vixAvg: 18, vixChange: 0.5 });
    });
    PipelineRunner.Build_Macro('2023-06-01T00:00:00Z');
    // setTimeout(fn, 0) — flush in next tick
    setTimeout(() => {
      expect(mockMongoDb.GetMongoPMI).toHaveBeenCalledWith(
        '2023-06-01',
        'PMI',
        expect.any(Function)
      );
      done();
    }, 50);
  });

  test('TransformShortVolume converts daysback and calls MongoDb', () => {
    mockMongoDb.GetMongoShortVolume.mockImplementation((date, col, cb) => {
      cb({ 'backtest Date': date, symbol: 'TSLA', shortWeekAvg: 10, shortDay: 8, growthDiff: 0.2 });
    });
    PipelineRunner.TransformShortVolume('2023-06-01T00:00:00Z');
    expect(mockMongoDb.GetMongoShortVolume).toHaveBeenCalledWith(
      '2023-06-01',
      'ShortVolume',
      expect.any(Function)
    );
  });

  test('TransformDailyOhlcv converts daysback and calls MongoDb', () => {
    mockMongoDb.GetMongoStockDaily.mockImplementation((date, col, cb) => {
      cb({ 'backtest Date': date, symbol: 'AAPL', open: 1, high: 2, low: 0.9, close: 1.1, adjustedClose: 1.1, volume: 1000 });
    });
    PipelineRunner.TransformDailyOhlcv('2023-06-01T00:00:00Z');
    expect(mockMongoDb.GetMongoStockDaily).toHaveBeenCalledWith(
      '2023-06-01',
      'StocksDaily',
      expect.any(Function)
    );
  });

  test('BacktestResults converts daysback and invokes callback', () => {
    mockAzureStorage.GetTable.mockImplementation((table, svc, query, cb) => cb([]));
    mockFs.readFileSync.mockReturnValue('');
    const cb = jest.fn();
    PipelineRunner.BacktestResults('2023-06-01T00:00:00Z', cb);
    expect(mockAzureStorage.GetTable).toHaveBeenCalledWith(
      'StocksDailyBacktester',
      mockTableService,
      expect.anything(),
      expect.any(Function)
    );
    expect(cb).toHaveBeenCalled();
  });

  test('DailyIngest_ShortVolume passes day and task to Builder.TableIngestRunner', () => {
    PipelineRunner.DailyIngest_ShortVolume('2023-06-01', 'myTask', 0);
    expect(mockBuilder.TableIngestRunner).toHaveBeenCalledWith(
      3000,
      mockAnalyze.DailyShortVolume,
      'ShortVolume',
      'myTask',
      '2023-06-01',
      0,
      expect.any(Function)
    );
  });

  test('Transform_Factor_PickList converts daysback and calls MongoDb', () => {
    mockMongoDb.GetMongoFundamentals.mockImplementation((date, factor, features, cb) => {
      cb(JSON.stringify({ 'backtest Date': date, symbol: 'AAPL', someVal: 42 }));
    });
    PipelineRunner.Transform_Factor_PickList('2023-06-01T00:00:00Z', 'Income', jest.fn());
    expect(mockMongoDb.GetMongoFundamentals).toHaveBeenCalledWith(
      '2023-06-01',
      'Income',
      expect.any(Array),
      expect.any(Function)
    );
  });

  test('Complete_Ingest converts daysback and calls MongoDb.GetMongoFundamentalsSymbols', () => {
    mockMongoDb.GetMongoFundamentalsSymbols.mockImplementation((date, factor, features, cb) => {
      cb([]);
    });
    mockBuilder.FinishIngest.mockImplementation((factor, data, cb) => cb());
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    PipelineRunner.Complete_Ingest('2023-06-01T00:00:00Z', 'Growth', jest.fn());
    expect(mockMongoDb.GetMongoFundamentalsSymbols).toHaveBeenCalledWith(
      '2023-06-01',
      'Growth',
      expect.any(Array),
      expect.any(Function)
    );
    mockExit.mockRestore();
  });
});

// ─── Pure task-builder functions (via callback execution) ─────────────────────

describe('StockDailyTask via Build_Stock_Daily callback', () => {
  test('ToTable is called with the task built from MongoDb data', () => {
    const data = {
      'backtest Date': '2023-06-01',
      symbol: 'AAPL',
      open: 150.0,
      high: 155.0,
      low: 149.0,
      close: 153.0,
      adjustedClose: 153.0,
      volume: 50000,
    };
    mockMongoDb.GetMongoStockDaily.mockImplementation((date, col, cb) => cb(data));
    PipelineRunner.Build_Stock_Daily('2023-06-01T00:00:00Z');

    expect(mockAzureStorage.ToTable).toHaveBeenCalledTimes(1);
    const [tableName, svc, task] = mockAzureStorage.ToTable.mock.calls[0];
    expect(tableName).toBe('StocksDailyBacktester');
    expect(task.PartitionKey._).toBe('2023-06-01');
    expect(task.RowKey._).toBe('AAPL');
    expect(task.open._).toBe(150.0);
    expect(task.close._).toBe(153.0);
  });
});

describe('StockWeeklyTask via Build_Stock_Weekly callback', () => {
  test('ToTable is called with the task built from MongoDb data', () => {
    const data = {
      'backtest Date': '2023-06-01',
      symbol: 'MSFT',
      growth: 0.05,
      direction: 'up',
    };
    mockMongoDb.GetMongoStockWeekly.mockImplementation((date, col, cb) => cb(data));
    PipelineRunner.Build_Stock_Weekly('2023-06-01T00:00:00Z');

    expect(mockAzureStorage.ToTable).toHaveBeenCalledTimes(1);
    const [tableName, svc, task] = mockAzureStorage.ToTable.mock.calls[0];
    expect(tableName).toBe('StocksMonthlyGrowth');
    expect(task.PartitionKey._).toBe('2023-06-01');
    expect(task.growth._).toBe(0.05);
    expect(task.direction._).toBe('up');
  });
});

describe('ShortVolumeTask via TransformShortVolume callback', () => {
  test('ToTable is called with the correct task structure', () => {
    const data = {
      'backtest Date': '2023-06-01',
      symbol: 'TSLA',
      shortWeekAvg: 100000,
      shortDay: 80000,
      growthDiff: 0.25,
    };
    mockMongoDb.GetMongoShortVolume.mockImplementation((date, col, cb) => cb(data));
    PipelineRunner.TransformShortVolume('2023-06-01T00:00:00Z');

    expect(mockAzureStorage.ToTable).toHaveBeenCalledTimes(1);
    const [tableName, svc, task] = mockAzureStorage.ToTable.mock.calls[0];
    expect(tableName).toBe('ShortVolume');
    expect(task.PartitionKey._).toBe('2023-06-01');
    expect(task.RowKey._).toBe('TSLA');
    expect(task.shortWeekAvg._).toBe(100000);
    expect(task.growthDiff._).toBe(0.25);
  });
});

describe('GenericTask via Transform_Factor_PickList callback', () => {
  test('produces a task with PartitionKey and RowKey remapped from backtest Date and symbol', () => {
    const obj = { 'backtest Date': '2023-06-01', symbol: 'AMZN', peRatio: 30.5 };
    mockMongoDb.GetMongoFundamentals.mockImplementation((date, factor, features, cb) => {
      cb(JSON.stringify(obj));
    });
    PipelineRunner.Transform_Factor_PickList('2023-06-01T00:00:00Z', 'Income', jest.fn());

    expect(mockAzureStorage.ToTable).toHaveBeenCalledTimes(1);
    const [tableName, svc, task] = mockAzureStorage.ToTable.mock.calls[0];
    expect(tableName).toBe('PickList5000');
    expect(task).toHaveProperty('PartitionKey');
    expect(task).toHaveProperty('RowKey');
    expect(task.PartitionKey._).toBe('2023-06-01');
    expect(task.RowKey._).toBe('AMZN');
    expect(task.peRatio._).toBe(30.5);
  });

  test('GenericTask handles string values correctly', () => {
    const obj = { 'backtest Date': '2023-06-01', symbol: 'GOOG', industry: 'Technology' };
    mockMongoDb.GetMongoFundamentals.mockImplementation((date, factor, features, cb) => {
      cb(JSON.stringify(obj));
    });
    PipelineRunner.Transform_Factor_PickList('2023-06-01T00:00:00Z', 'Metrics', jest.fn());

    const [, , task] = mockAzureStorage.ToTable.mock.calls[0];
    expect(task.industry._).toBe('Technology');
  });
});

describe('PMITask and VIXTask via Build_Macro', () => {
  test('PMITask builds correct task shape', (done) => {
    const pmiData = {
      'backtest Date': '2023-06-01',
      presentDate: '2023-06-01',
      presentPmi: 55,
      lastDate: '2023-05-25',
      lastPmi: 53,
    };
    const vixData = {
      'backtest Date': '2023-06-01',
      vixDay: 20,
      vixAvg: 18,
      vixChange: 0.5,
    };
    mockMongoDb.GetMongoPMI.mockImplementation((date, col, cb) => cb(pmiData));
    mockMongoDb.GetMongoVIX.mockImplementation((date, col, cb) => cb(vixData));
    PipelineRunner.Build_Macro('2023-06-01T00:00:00Z');

    setTimeout(() => {
      // First ToTable call = PMI, second = VIX
      const calls = mockAzureStorage.ToTable.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const pmiTask = calls[0][2];
      expect(pmiTask.PartitionKey._).toBe('2023-06-01');
      expect(pmiTask.presentPMI._).toBe(55);
      done();
    }, 50);
  });
});

describe('BuildOBV', () => {
  test('calls AzureStorage.GetTable for OBV computation', () => {
    mockAzureStorage.GetTable.mockImplementation((table, svc, query, cb) => cb([]));
    mockStocklist.SymbolList.mockImplementation((prefix, flag, cb) => cb([]));
    PipelineRunner.BuildOBV('2023-06-01T00:00:00Z');
    expect(mockAzureStorage.GetTable).toHaveBeenCalledWith(
      'StocksDailyBacktester',
      mockTableService,
      expect.anything(),
      expect.any(Function)
    );
  });

  test('processes symbols and calls ToTable for each non-empty OBV result', () => {
    const makeRow = (symbol, date, open, close, volume) => ({
      RowKey: { _: '', 1: symbol },
      close: { _: close, 0: close },
      open: { _: open, 0: open },
      volume: { _: volume, 0: volume },
      PartitionKey: { _: date },
    });
    const data = Array.from({ length: 20 }, (_, i) =>
      makeRow('AAPL', `2023-05-${String(i + 1).padStart(2, '0')}`, 100, 105 + i, 1000 + i * 100)
    );
    mockAzureStorage.GetTable.mockImplementation((table, svc, query, cb) => cb(data));
    mockStocklist.SymbolList.mockImplementation((prefix, flag, cb) => cb(['AAPL']));
    PipelineRunner.BuildOBV('2023-06-01T00:00:00Z');
    expect(mockAzureStorage.ToTable).toHaveBeenCalled();
  });
});
