'use strict';

jest.mock('line-reader-sync', () => jest.fn(), { virtual: true });
jest.mock('mkdirp', () => jest.fn());
jest.mock('fs-extra');
jest.mock('fs');

const fs = require('fs');
const fsextra = require('fs-extra');

// fs.promises.mkdir is not auto-mocked — set it up manually
const fsMkdirMock = jest.fn().mockResolvedValue(undefined);
Object.defineProperty(fs, 'promises', {
  value: { mkdir: fsMkdirMock },
  writable: true,
});

const logging = require('../Library/logging');

beforeEach(() => {
  jest.clearAllMocks();
  fs.existsSync.mockReturnValue(true);
  fs.readFileSync.mockReturnValue('');
  fs.writeFileSync.mockImplementation(() => {});
  fs.mkdirSync.mockImplementation(() => {});
  fsextra.ensureFileSync.mockImplementation(() => {});
  fsMkdirMock.mockResolvedValue(undefined);
});

// ─── GetCompanyProfile ────────────────────────────────────────────────────────
describe('logging.GetCompanyProfile', () => {
  it('returns file content for given symbol', () => {
    fs.readFileSync.mockReturnValue('{"name":"Apple"}');
    expect(logging.GetCompanyProfile('AAPL')).toBe('{"name":"Apple"}');
    expect(fs.readFileSync).toHaveBeenCalledWith(
      'Library/Research/AAPL/AAPL_CompanyProfile.txt', 'utf-8'
    );
  });

  it('returns null when read throws', () => {
    fs.readFileSync.mockImplementation(() => { throw new Error('no file'); });
    expect(logging.GetCompanyProfile('AAPL')).toBeNull();
  });
});

// ─── GetStockList ─────────────────────────────────────────────────────────────
describe('logging.GetStockList', () => {
  it('reads and returns stocklist.txt content', () => {
    fs.readFileSync.mockReturnValue('AAPL\nMSFT');
    expect(logging.GetStockList()).toBe('AAPL\nMSFT');
    expect(fs.readFileSync).toHaveBeenCalledWith(
      'Library/StockList/stocklist.txt', 'utf-8'
    );
  });
});

// ─── newestlisttopVolume ──────────────────────────────────────────────────────
describe('logging.newestlisttopVolume', () => {
  it('reads devList.txt and returns non-empty lines as array', () => {
    fs.readFileSync.mockReturnValue('AAPL\nMSFT\n\nGOOG\n');
    expect(logging.newestlisttopVolume()).toEqual(['AAPL', 'MSFT', 'GOOG']);
  });
});

// ─── appendToPrimeList ────────────────────────────────────────────────────────
describe('logging.appendToPrimeList', () => {
  it('appends item to existing list and writes back', () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({ obj: ['AAPL'] }));
    logging.appendToPrimeList('MSFT');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'Library/StockList/stocklist.txt',
      JSON.stringify({ obj: ['AAPL', 'MSFT'] })
    );
  });
});

// ─── Async info writers: Analysis / News / Sentiment / Company / Dividends / Splits / Earnings / Financials / LastQuote
const asyncWriteFunctions = [
  { name: 'Analysis',   file: 'analysis.txt' },
  { name: 'News',       file: 'news.txt' },
  { name: 'Sentiment',  file: 'sentiment.txt' },
  { name: 'Company',    file: 'company.txt' },
  { name: 'Dividends',  file: 'dividends.txt' },
  { name: 'Splits',     file: 'splits.txt' },
  { name: 'Earnings',   file: 'earnings.txt' },
  { name: 'Financials', file: 'financials.txt' },
  { name: 'LastQuote',  file: 'lastQuote.txt' },
];

asyncWriteFunctions.forEach(({ name, file }) => {
  describe(`logging.${name}`, () => {
    it(`calls fs.promises.mkdir then writes ${file}`, async () => {
      logging[name]('AAPL', { data: 'test' }, 'myAlgo');
      await new Promise((r) => setTimeout(r, 10));
      expect(fsMkdirMock).toHaveBeenCalledWith(
        'Algorithm/myAlgo/info/AAPL', { recursive: true }
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        `Algorithm/myAlgo/info/AAPL/${file}`,
        expect.anything()
      );
    });
  });
});

// ─── getEODMaster ─────────────────────────────────────────────────────────────
describe('logging.getEODMaster', () => {
  it('returns split lines when master.csv exists', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('AAPL\nMSFT');
    expect(logging.getEODMaster()).toEqual(['AAPL', 'MSFT']);
  });

  it('returns undefined when master.csv does not exist', () => {
    fs.existsSync.mockReturnValue(false);
    expect(logging.getEODMaster()).toBeUndefined();
  });

  it('does not throw when read fails', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation(() => { throw new Error('err'); });
    expect(() => logging.getEODMaster()).not.toThrow();
  });
});

// ─── getEodCsvs ───────────────────────────────────────────────────────────────
describe('logging.getEodCsvs', () => {
  it('deletes master.csv when it exists and processes alphabet csvs', () => {
    fs.existsSync.mockReturnValue(true);
    fs.unlink = jest.fn((path, cb) => cb(null));
    fs.readFileSync.mockReturnValue('AAPL\nAMZN\n');
    fs.appendFileSync = jest.fn();
    expect(() => logging.getEodCsvs()).not.toThrow();
    expect(fs.unlink).toHaveBeenCalled();
  });

  it('does not throw when master.csv does not exist', () => {
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('');
    expect(() => logging.getEodCsvs()).not.toThrow();
  });

  it('does not throw when alphabet csv read fails', () => {
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockImplementation(() => { throw new Error('no file'); });
    expect(() => logging.getEodCsvs()).not.toThrow();
  });
});
