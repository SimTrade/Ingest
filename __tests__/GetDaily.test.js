'use strict';

// ─── Mocks BEFORE require ─────────────────────────────────────────────────────
jest.mock('jsdom', () => {
  const window = {};
  const document = {};
  function JSDOM() {}
  JSDOM.prototype.window = window;
  Object.defineProperty(JSDOM.prototype, 'window', { get: () => ({ document }) });
  return { JSDOM };
});

jest.mock('mkdirp', () => jest.fn());

const mockAlpaca = {
  getAccount: jest.fn(),
};
jest.mock('../Library/Secrets/AlpacaCreds', () => ({
  getCreds: jest.fn(() => mockAlpaca),
}), { virtual: true });

const mockBuilder = {
  GetDaily: jest.fn(),
  GetBetaIEX: jest.fn(),
  SubmitOrder: jest.fn(),
  LogBeta: jest.fn(),
};
jest.mock('../Library/Builder', () => mockBuilder);

jest.mock('../Library/AzureStorage', () => ({
  ToTable: jest.fn(),
  StoreBeta: jest.fn(),
  GetTable: jest.fn(),
  GetDaily: jest.fn(),
  StoreOrders: jest.fn(),
  GetEtfDictionary: jest.fn(),
}));

jest.mock('azure-storage', () => ({
  createTableService: jest.fn(() => ({
    insertOrReplaceEntity: jest.fn(),
    queryEntities: jest.fn(),
  })),
  createFileService: jest.fn(() => ({})),
  TableQuery: jest.fn().mockImplementation(() => ({ where: jest.fn().mockReturnThis() })),
  TableUtilities: { entityGenerator: { String: (v) => ({ _: v }) } },
}));

jest.mock('../Library/Secrets/Azure', () => ({
  Secrets: jest.fn(() => ({
    STORAGE_ACCOUNT: 'mock-account',
    ACCESS_KEY: 'mock-key',
    MongoDbUri: 'mongodb://mock',
  })),
}), { virtual: true });

jest.mock('minimist', () => jest.fn(() => ({})));

// ─── Subject ──────────────────────────────────────────────────────────────────
const GetDaily = require('../Library/GetDaily');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GetDaily', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate process.argv values used by GetDaily
    process.argv[3] = '0.5';  // longSplit
    process.argv[4] = '0.9';  // longCutoff
    process.argv[5] = '0.1';  // 1-shortCutoff
    process.argv[6] = '0.8';  // barchartLongCutoff
    process.argv[7] = '0.2';  // 1-barchartShortCutoff
  });

  test('calls Builder.GetDaily with barchart cutoffs and a callback', () => {
    GetDaily.GetDaily('2023-01-01');
    expect(mockBuilder.GetDaily).toHaveBeenCalledTimes(1);
    const [longCutoff, shortCutoff, cb] = mockBuilder.GetDaily.mock.calls[0];
    expect(typeof cb).toBe('function');
  });

  test('calls alpaca.getAccount inside the Builder.GetDaily callback', () => {
    mockAlpaca.getAccount.mockResolvedValue({
      trading_blocked: false,
      cash: '10000',
    });
    mockBuilder.GetBetaIEX.mockImplementation((cb) => cb({}));
    mockBuilder.GetDaily.mockImplementation((longCutoff, shortCutoff, cb) => {
      cb({ AAPL: 0.9, MSFT: 0.8 }, { TSLA: 0.7 });
    });

    GetDaily.GetDaily('2023-01-01');
    expect(mockAlpaca.getAccount).toHaveBeenCalledTimes(1);
  });

  test('calls Builder.GetBetaIEX after getAccount resolves', async () => {
    const accountData = { trading_blocked: false, cash: '10000' };
    mockAlpaca.getAccount.mockResolvedValue(accountData);
    mockBuilder.GetBetaIEX.mockImplementation((cb) => cb({}));
    mockBuilder.GetDaily.mockImplementation((longCutoff, shortCutoff, cb) => {
      cb({ AAPL: 0.9 }, { TSLA: 0.7 });
    });

    GetDaily.GetDaily('2023-01-01');
    await Promise.resolve(); // flush promise queue
    expect(mockBuilder.GetBetaIEX).toHaveBeenCalledTimes(1);
  });

  test('calls Builder.SubmitOrder for each long when trading is not blocked', async () => {
    const iexData = { AAPL: 1.1, MSFT: 0.9 };
    const accountData = { trading_blocked: false, cash: '10000' };
    mockAlpaca.getAccount.mockResolvedValue(accountData);
    mockBuilder.GetBetaIEX.mockImplementation((cb) => cb(iexData));
    mockBuilder.GetDaily.mockImplementation((longCutoff, shortCutoff, cb) => {
      cb({ AAPL: 0.99, MSFT: 0.85 }, { TSLA: 0.7 });
    });

    GetDaily.GetDaily('2023-01-01');
    await Promise.resolve();
    // SubmitOrder is called for each long item
    expect(mockBuilder.SubmitOrder).toHaveBeenCalled();
  });

  test('does not call Builder.SubmitOrder when trading is blocked', async () => {
    const accountData = { trading_blocked: true, cash: '10000' };
    mockAlpaca.getAccount.mockResolvedValue(accountData);
    mockBuilder.GetBetaIEX.mockImplementation((cb) => cb({ AAPL: 1.0 }));
    mockBuilder.GetDaily.mockImplementation((longCutoff, shortCutoff, cb) => {
      cb({ AAPL: 0.99 }, { TSLA: 0.7 });
    });

    GetDaily.GetDaily('2023-01-01');
    await Promise.resolve();
    expect(mockBuilder.SubmitOrder).not.toHaveBeenCalled();
  });

  test('calls Builder.LogBeta after processing longs and shorts', async () => {
    const iexData = { AAPL: 1.1 };
    const accountData = { trading_blocked: false, cash: '10000' };
    mockAlpaca.getAccount.mockResolvedValue(accountData);
    mockBuilder.GetBetaIEX.mockImplementation((cb) => cb(iexData));
    mockBuilder.GetDaily.mockImplementation((longCutoff, shortCutoff, cb) => {
      cb({ AAPL: 0.99 }, { TSLA: 0.7 });
    });

    GetDaily.GetDaily('2023-01-01');
    await Promise.resolve();
    expect(mockBuilder.LogBeta).toHaveBeenCalledTimes(1);
    const logArg = mockBuilder.LogBeta.mock.calls[0][0];
    expect(logArg).toHaveProperty('Longs');
    expect(logArg).toHaveProperty('Shorts');
    expect(logArg).toHaveProperty('LongBeta');
    expect(logArg).toHaveProperty('ShortBeta');
    expect(logArg).toHaveProperty('Beta');
  });

  test('handles empty longs and shorts arrays without crashing', async () => {
    const accountData = { trading_blocked: false, cash: '10000' };
    mockAlpaca.getAccount.mockResolvedValue(accountData);
    mockBuilder.GetBetaIEX.mockImplementation((cb) => cb({}));
    mockBuilder.GetDaily.mockImplementation((longCutoff, shortCutoff, cb) => {
      cb({}, {});
    });

    expect(() => GetDaily.GetDaily('2023-01-01')).not.toThrow();
    await Promise.resolve();
    expect(mockBuilder.LogBeta).toHaveBeenCalled();
  });
});
