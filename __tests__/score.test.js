'use strict';

// ─── XHR mock: must be set up BEFORE require so the module-level require picks it up ─
let xhrInstances = [];
// Tests can set this to control what `send()` serves as responseText
let mockXHRResponse = '{}';

function MockXHR() {
  this.readyState = 0;
  this.status = 0;
  this.responseText = '';
  this.onreadystatechange = null;
  this.open = jest.fn();
  this.send = jest.fn().mockImplementation(() => {
    // Simulate a successful synchronous response
    this.readyState = 4;
    this.status = 200;
    this.responseText = mockXHRResponse;
    if (typeof this.onreadystatechange === 'function') {
      this.onreadystatechange.call(this);
    }
  });
  xhrInstances.push(this);
}
jest.mock('xmlhttprequest', () => ({ XMLHttpRequest: MockXHR }));

// ─── Other mocks ─────────────────────────────────────────────────────────────
jest.mock('mkdirp', () => jest.fn().mockResolvedValue(undefined));
jest.mock('download', () => jest.fn().mockResolvedValue(undefined));

const mockLogging = {
  News: jest.fn(),
  Analysis: jest.fn(),
  Sentiment: jest.fn(),
  LastQuote: jest.fn(),
  Company: jest.fn(),
  Dividends: jest.fn(),
  Splits: jest.fn(),
  Earnings: jest.fn(),
  Financials: jest.fn(),
  appendToErrorLog: jest.fn(),
};
jest.mock('../Library/logging', () => mockLogging);

jest.mock('paralleldots', () => ({
  sentimentBatch: jest.fn().mockResolvedValue(
    JSON.stringify({ sentiment: [{ positive: 0.8, negative: 0.1 }, { positive: 0.7, negative: 0.2 }] })
  ),
  apiKey: jest.fn(),
}));

// ncp is required at module level
jest.mock('ncp', () => ({ ncp: jest.fn() }));

const mockFs = {
  open: jest.fn(),
  statSync: jest.fn(() => ({ atime: new Date('2020-01-01') })),
  writeFile: jest.fn((path, data, cb) => cb && cb(null)),
  readFile: jest.fn((path, opts, cb) => cb && cb(null, JSON.stringify([]))),
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

// ─── Subject ──────────────────────────────────────────────────────────────────
const score = require('../Library/score');

// ─── Helper ───────────────────────────────────────────────────────────────────
function resetXhr() {
  xhrInstances = [];
  mockXHRResponse = '{}';
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const VALID_ANALYST_RESPONSE = JSON.stringify({
  analysts: 5,
  change: 0.01,
  updated: '2023-01-01',
  sell: { current: 1, month1: 1, month2: 1, month3: 0 },
  strongSell: { current: 0, month1: 0, month2: 0, month3: 0 },
  buy: { current: 3, month1: 2, month2: 2, month3: 3 },
  strongBuy: { current: 1, month1: 1, month2: 1, month3: 1 },
});

beforeEach(() => {
  jest.clearAllMocks();
  resetXhr();
  // Default to valid analyst JSON so any background .then() callbacks don't
  // throw "Cannot read properties of undefined" when tests omit explicit setup.
  mockXHRResponse = VALID_ANALYST_RESPONSE;
});

describe('score.Analysis', () => {
  test('creates an XHR GET request to the analysts endpoint', () => {
    // mockXHRResponse is already valid JSON from beforeEach
    score.Analysis('AAPL', 'algo1');
    expect(xhrInstances.length).toBeGreaterThan(0);
    const xhr = xhrInstances[0];
    expect(xhr.open).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('AAPL'),
      false
    );
    expect(xhr.send).toHaveBeenCalled();
  });

  test('calls logging.Analysis with symbol and response when XHR succeeds', async () => {
    const analystData = {
      analysts: 5,
      change: 0.01,
      updated: '2023-01-01',
      current: 55.0,
      sell: { current: 1, month1: 1, month2: 1, month3: 0 },
      strongSell: { current: 0, month1: 0, month2: 0, month3: 0 },
      buy: { current: 3, month1: 2, month2: 2, month3: 3 },
      strongBuy: { current: 1, month1: 1, month2: 1, month3: 1 },
    };
    mockXHRResponse = JSON.stringify(analystData);
    score.Analysis('AAPL', 'algo1');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogging.Analysis).toHaveBeenCalledWith(
      'AAPL',
      expect.objectContaining({ Analysis: expect.anything() }),
      'algo1'
    );
  });
});

describe('score.NewsSentiment', () => {
  test('creates an XHR GET request for news', () => {
    // Provide a valid JSON array so JSON.parse succeeds
    mockXHRResponse = JSON.stringify([
      { title: 'MSFT hits record', timestamp: new Date().toISOString() },
    ]);
    mockFs.open.mockImplementation((path, flags, cb) => cb(null, 1));
    score.NewsSentiment('MSFT', 'algo1');
    expect(xhrInstances.length).toBeGreaterThan(0);
    const xhr = xhrInstances[0];
    expect(xhr.open).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('MSFT'),
      false
    );
  });

  test('calls logging.News when news response is received and file does not exist', () => {
    mockXHRResponse = JSON.stringify([
      { title: 'MSFT hits record', timestamp: new Date().toISOString() },
    ]);
    // fs.open with no error (new file) → else branch → logging.News + return
    mockFs.open.mockImplementation((path, flags, cb) => cb(null, 1));
    score.NewsSentiment('MSFT', 'algo1');
    expect(mockLogging.News).toHaveBeenCalledWith(
      'MSFT',
      expect.any(Array),
      'algo1'
    );
  });

  test('calls logging.News when EEXIST and file is stale', () => {
    mockXHRResponse = JSON.stringify([
      { title: 'Old news', timestamp: new Date().toISOString() },
    ]);
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 2); // 2 days ago → stale (day < now.day)
    mockFs.statSync.mockReturnValue({ atime: staleDate });
    // fs.open with EEXIST
    mockFs.open.mockImplementation((path, flags, cb) => {
      const err = new Error('EEXIST');
      err.code = 'EEXIST';
      cb(err, undefined);
    });
    score.NewsSentiment('MSFT', 'algo1');
    expect(mockLogging.News).toHaveBeenCalled();
  });
});

describe('score.LastQuote', () => {
  test('creates an XHR GET request to the last_quote endpoint', () => {
    score.LastQuote('GOOG', 'algo2');
    const xhr = xhrInstances[0];
    expect(xhr.open).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('GOOG'),
      false
    );
    expect(xhr.send).toHaveBeenCalled();
  });

  test('calls logging.LastQuote with response after XHR resolves', async () => {
    score.LastQuote('GOOG', 'algo2');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogging.LastQuote).toHaveBeenCalledWith(
      'GOOG',
      expect.anything(),
      'algo2'
    );
  });
});

describe('score.Company', () => {
  test('creates an XHR GET request to the company endpoint', () => {
    score.Company('AMZN', 'algo1');
    const xhr = xhrInstances[0];
    expect(xhr.open).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('AMZN'),
      false
    );
    expect(xhr.send).toHaveBeenCalled();
  });

  test('calls logging.Company with correct args after XHR resolves', async () => {
    score.Company('AMZN', 'algo1');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogging.Company).toHaveBeenCalledWith('AMZN', expect.anything(), 'algo1');
  });
});

describe('score.Dividends', () => {
  test('creates an XHR GET request to the dividends endpoint', () => {
    score.Dividends('IBM', 'algo3');
    const xhr = xhrInstances[0];
    expect(xhr.open).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('IBM'),
      false
    );
    expect(xhr.send).toHaveBeenCalled();
  });

  test('calls logging.Dividends after XHR resolves', async () => {
    score.Dividends('IBM', 'algo3');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogging.Dividends).toHaveBeenCalledWith('IBM', expect.anything(), 'algo3');
  });
});

describe('score.Splits', () => {
  test('creates an XHR GET request to the splits endpoint', () => {
    score.Splits('TSLA', 'algo1');
    const xhr = xhrInstances[0];
    expect(xhr.open).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('TSLA'),
      false
    );
    expect(xhr.send).toHaveBeenCalled();
  });

  test('calls logging.Splits after XHR resolves', async () => {
    score.Splits('TSLA', 'algo1');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogging.Splits).toHaveBeenCalledWith('TSLA', expect.anything(), 'algo1');
  });
});

describe('score.Earnings', () => {
  test('creates an XHR GET request to the earnings endpoint', () => {
    score.Earnings('NFLX', 'algo1');
    const xhr = xhrInstances[0];
    expect(xhr.open).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('NFLX'),
      false
    );
    expect(xhr.send).toHaveBeenCalled();
  });

  test('calls logging.Earnings after XHR resolves', async () => {
    score.Earnings('NFLX', 'algo1');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogging.Earnings).toHaveBeenCalledWith('NFLX', expect.anything(), 'algo1');
  });
});

describe('score.Financials', () => {
  test('creates an XHR GET request to the financials endpoint', () => {
    score.Financials('META', 'algo1');
    const xhr = xhrInstances[0];
    expect(xhr.open).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('META'),
      false
    );
    expect(xhr.send).toHaveBeenCalled();
  });

  test('calls logging.Financials after XHR resolves', async () => {
    score.Financials('META', 'algo1');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLogging.Financials).toHaveBeenCalledWith('META', expect.anything(), 'algo1');
  });
});
