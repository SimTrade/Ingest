'use strict';

// ---------------------------------------------------------------------------
// Mocks — all before require()
// ---------------------------------------------------------------------------

jest.mock('xmlhttprequest', () => ({ XMLHttpRequest: jest.fn() }));

jest.mock('aylien_textapi', () =>
  jest.fn().mockImplementation(() => ({
    sentiment: jest.fn(),
  }))
);

jest.mock('paralleldots', () => ({
  sentimentBatch: jest.fn(),
}));

jest.mock('https', () => ({
  request: jest.fn(),
}));

jest.mock('unirest', () => jest.fn());

jest.mock('fs', () => ({ readFileSync: jest.fn(() => '') }));

// ---------------------------------------------------------------------------

const { XMLHttpRequest } = require('xmlhttprequest');
const https              = require('https');
const unirest            = require('unirest');
const Analyze            = require('../Library/Analyze');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Configure XMLHttpRequest mock to fire onreadystatechange with the given
 * responseText and HTTP status as soon as .send() is called.
 */
function mockXHR(responseText, status = 200) {
  XMLHttpRequest.mockImplementation(function () {
    this.open = jest.fn();
    this.send = jest.fn(function () {
      this.readyState  = 4;
      this.status      = status;
      this.responseText = responseText;
      this.onreadystatechange();
    });
  });
}

/**
 * Configure the https.request mock to stream chunks then end, delivering
 * the given body string as a Buffer concat.
 */
function mockHttps(body) {
  https.request.mockImplementation((options, cb) => {
    const chunks = [Buffer.from(body)];
    const res = {
      on: jest.fn((event, handler) => {
        if (event === 'data') chunks.forEach(handler);
        if (event === 'end')  handler();
      }),
    };
    cb(res);
    return { end: jest.fn() };
  });
}

// ---------------------------------------------------------------------------
// ApiCall-based methods (XHR → Promise → resolves with responseText)
// ---------------------------------------------------------------------------

describe('Analyze — ApiCall methods resolve with responseText', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ShortVolume resolves with responseText', async () => {
    mockXHR(JSON.stringify({ data: [1, 2, 3] }));
    const result = await Analyze.ShortVolume('AAPL');
    expect(result).toBe(JSON.stringify({ data: [1, 2, 3] }));
  });

  it('DailyShortVolume resolves with responseText', async () => {
    mockXHR('{"rows":[]}');
    const result = await Analyze.DailyShortVolume('MSFT', '2024-01-15');
    expect(result).toBe('{"rows":[]}');
  });

  it('stats resolves with responseText', async () => {
    mockXHR('{"marketcap":1000}');
    const result = await Analyze.stats('AAPL');
    expect(result).toBe('{"marketcap":1000}');
  });

  it('chart resolves with responseText', async () => {
    mockXHR('[{"close":150}]');
    const result = await Analyze.chart('AAPL');
    expect(result).toBe('[{"close":150}]');
  });

  it('news resolves with responseText', async () => {
    mockXHR('[{"headline":"test"}]');
    const result = await Analyze.news('TSLA');
    expect(result).toBe('[{"headline":"test"}]');
  });

  it('FinnSymbolList resolves with responseText', async () => {
    mockXHR('[{"symbol":"AAPL"}]');
    const result = await Analyze.FinnSymbolList();
    expect(result).toBe('[{"symbol":"AAPL"}]');
  });

  it('FinnCompanyProfile resolves with responseText', async () => {
    mockXHR('{"name":"Apple"}');
    const result = await Analyze.FinnCompanyProfile('AAPL');
    expect(result).toBe('{"name":"Apple"}');
  });

  it('FinnNewsSentiment resolves with responseText', async () => {
    mockXHR('{"buzz":{"articlesInLastWeek":5}}');
    const result = await Analyze.FinnNewsSentiment('AAPL');
    expect(result).toBe('{"buzz":{"articlesInLastWeek":5}}');
  });

  it('FinnhubRecommendation resolves with responseText', async () => {
    mockXHR('[{"buy":10}]');
    const result = await Analyze.FinnhubRecommendation('AAPL');
    expect(result).toBe('[{"buy":10}]');
  });

  it('FinnhubPeers resolves with responseText', async () => {
    mockXHR('["MSFT","GOOG"]');
    const result = await Analyze.FinnhubPeers('AAPL');
    expect(result).toBe('["MSFT","GOOG"]');
  });

  it('FinnhubEPSSuprise resolves with responseText', async () => {
    mockXHR('[{"actual":2.5}]');
    const result = await Analyze.FinnhubEPSSuprise('AAPL');
    expect(result).toBe('[{"actual":2.5}]');
  });

  it('IEX resolves with responseText', async () => {
    mockXHR('{"peRatio":25}');
    const result = await Analyze.IEX('AAPL');
    expect(result).toBe('{"peRatio":25}');
  });

  it('ATR resolves with responseText', async () => {
    mockXHR('{"Technical Analysis: ATR":{}}');
    const result = await Analyze.ATR('AAPL');
    expect(result).toBe('{"Technical Analysis: ATR":{}}');
  });

  it('BBANDS resolves with responseText', async () => {
    mockXHR('{"Technical Analysis: BBANDS":{}}');
    const result = await Analyze.BBANDS('AAPL');
    expect(result).toBe('{"Technical Analysis: BBANDS":{}}');
  });

  it('Company resolves with responseText', async () => {
    mockXHR('{"symbol":"AAPL","name":"Apple Inc."}');
    const result = await Analyze.Company('AAPL');
    expect(result).toBe('{"symbol":"AAPL","name":"Apple Inc."}');
  });

  it('Analysis resolves with responseText', async () => {
    mockXHR('{"analysts":10}');
    const result = await Analyze.Analysis('AAPL');
    expect(result).toBe('{"analysts":10}');
  });

  it('Dividends resolves with responseText', async () => {
    mockXHR('[{"amount":0.25}]');
    const result = await Analyze.Dividends('AAPL');
    expect(result).toBe('[{"amount":0.25}]');
  });

  it('Splits resolves with responseText', async () => {
    mockXHR('[{"ratio":4}]');
    const result = await Analyze.Splits('AAPL');
    expect(result).toBe('[{"ratio":4}]');
  });

  it('Earnings resolves with responseText', async () => {
    mockXHR('[{"eps":3.0}]');
    const result = await Analyze.Earnings('AAPL');
    expect(result).toBe('[{"eps":3.0}]');
  });

  it('DowCOT resolves with responseText', async () => {
    mockXHR('{"dataset":{}}');
    const result = await Analyze.DowCOT();
    expect(result).toBe('{"dataset":{}}');
  });

  it('NasdaqCOT resolves with responseText', async () => {
    mockXHR('{"dataset":{}}');
    const result = await Analyze.NasdaqCOT();
    expect(result).toBe('{"dataset":{}}');
  });

  it('VIXQuandl resolves with responseText', async () => {
    mockXHR('{"dataset":{"data":[]}}');
    const result = await Analyze.VIXQuandl();
    expect(result).toBe('{"dataset":{"data":[]}}');
  });

  it('PMIQuandl resolves with responseText', async () => {
    mockXHR('{"dataset":{"data":[]}}');
    const result = await Analyze.PMIQuandl();
    expect(result).toBe('{"dataset":{"data":[]}}');
  });

  it('FinnEconCodes resolves with responseText', async () => {
    mockXHR('[{"code":"RETAIL_SALES"}]');
    const result = await Analyze.FinnEconCodes();
    expect(result).toBe('[{"code":"RETAIL_SALES"}]');
  });

  it('FinnEconData resolves with responseText', async () => {
    mockXHR('[{"value":1.5}]');
    const result = await Analyze.FinnEconData('RETAIL_SALES');
    expect(result).toBe('[{"value":1.5}]');
  });

  it('Weekly resolves with responseText', async () => {
    mockXHR('{"results":[]}');
    const result = await Analyze.Weekly('AAPL');
    expect(result).toBe('{"results":[]}');
  });

  it('Daily resolves with responseText', async () => {
    mockXHR('{"results":[{"c":150}]}');
    const result = await Analyze.Daily('AAPL');
    expect(result).toBe('{"results":[{"c":150}]}');
  });

  it('Hourly resolves with responseText', async () => {
    mockXHR('{"results":[]}');
    const result = await Analyze.Hourly('AAPL');
    expect(result).toBe('{"results":[]}');
  });
});

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

describe('Analyze — URL contains expected symbol/parameter', () => {
  let capturedUrl;
  beforeEach(() => {
    jest.clearAllMocks();
    capturedUrl = null;
    XMLHttpRequest.mockImplementation(function () {
      this.open = jest.fn((method, url) => { capturedUrl = url; });
      this.send = jest.fn(function () {
        this.readyState  = 4;
        this.status      = 200;
        this.responseText = '{}';
        this.onreadystatechange();
      });
    });
  });

  it('ShortVolume URL contains the symbol', async () => {
    await Analyze.ShortVolume('TSLA');
    expect(capturedUrl).toContain('TSLA');
  });

  it('DailyShortVolume URL contains the symbol and date', async () => {
    await Analyze.DailyShortVolume('NVDA', '2024-06-01');
    expect(capturedUrl).toContain('NVDA');
    expect(capturedUrl).toContain('2024-06-01');
  });

  it('FinnCompanyProfile URL contains the symbol', async () => {
    await Analyze.FinnCompanyProfile('GOOG');
    expect(capturedUrl).toContain('GOOG');
  });

  it('IEX URL contains the symbol', async () => {
    await Analyze.IEX('MSFT');
    expect(capturedUrl).toContain('MSFT');
  });

  it('Company URL contains the symbol', async () => {
    await Analyze.Company('AMZN');
    expect(capturedUrl).toContain('AMZN');
  });
});

// ---------------------------------------------------------------------------
// ApiCallArgs — Candles returns {symbol, date, data}
// ---------------------------------------------------------------------------

describe('Analyze.Candles — ApiCallArgs shape', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves with an object containing symbol, date, and data', async () => {
    mockXHR('{"s":"ok","c":[150,151]}');
    // from = unix timestamp for 2023-01-01, to = 2024-01-01
    const from = Math.floor(new Date('2023-01-01').getTime() / 1000);
    const to   = Math.floor(new Date('2024-01-01').getTime() / 1000);
    const result = await Analyze.Candles('AAPL', 'D', from, to);
    expect(result).toHaveProperty('symbol', 'AAPL');
    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('data', '{"s":"ok","c":[150,151]}');
  });

  it('date field is a non-empty string', async () => {
    mockXHR('{}');
    const from = Math.floor(new Date('2022-01-01').getTime() / 1000);
    const result = await Analyze.Candles('TSLA', 'W', from, from + 86400);
    expect(typeof result.date).toBe('string');
    expect(result.date.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// RapidApi — wraps RapidApi_Timeseries (https-based)
// ---------------------------------------------------------------------------

describe('Analyze.RapidApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves with the response body string', async () => {
    mockHttps('{"Time Series (Daily)":{}}');
    const result = await Analyze.RapidApi('AAPL', 'TIME_SERIES_DAILY', 'compact');
    expect(result).toBe('{"Time Series (Daily)":{}}');
  });

  it('calls https.request', async () => {
    mockHttps('{}');
    await Analyze.RapidApi('MSFT', 'TIME_SERIES_WEEKLY', 'full');
    expect(https.request).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// RapidApi_Single — unirest callback
// ---------------------------------------------------------------------------

describe('Analyze.RapidApi_Single', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the callback with the response body', (done) => {
    unirest.mockImplementation(() => ({
      query:   jest.fn().mockReturnThis(),
      headers: jest.fn().mockReturnThis(),
      end:     jest.fn(function (cb) { cb({ error: null, body: { Sector: {} } }); }),
    }));

    Analyze.RapidApi_Single((body) => {
      expect(body).toEqual({ Sector: {} });
      done();
    });
  });
});
