'use strict';

// ─── Mocks BEFORE require ─────────────────────────────────────────────────────

const mockAnalyze = {
  NasdaqCOT: jest.fn(),
  DowCOT: jest.fn(),
  BondsCOT: jest.fn(),
};
jest.mock('../Library/Analyze', () => mockAnalyze);

const mockBuilder = {
  COtToAzureTableStorage: jest.fn(),
};
jest.mock('../Library/Builder', () => mockBuilder);

// ─── Subject ──────────────────────────────────────────────────────────────────
const Helper = require('../Library/Helper');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal COT dataset JSON string. The dataset has rows of indicator
 * values.  Index 0 (or i) is "recent", index 3+i is "last" (used by transformCOT).
 *   columns: Date, OpenInterest, NcLong, NcShort, NcSpreads, CmLong, CmShort,
 *            TotalLong, TotalShort, NrLong, NrShort
 * We always emit 6 rows so tests with i=0 or i=1 both work (need i + 3 < length).
 */
function makeCotJson(recent, last) {
  const makeRow = (r) => [
    r.date || '2023-01-01',
    r.openInterest || 100,
    r.ncLong || 50,
    r.ncShort || 30,
    r.ncSpreads || 10,
    r.cmLong || 40,
    r.cmShort || 20,
    r.totalLong || 90,
    r.totalShort || 50,
    r.nrLong || 5,
    r.nrShort || 5,
  ];
  // 6 rows: indices 0-5. i=0 uses row[0]+row[3]; i=1 uses row[1]+row[4]. Both valid.
  return JSON.stringify({
    dataset: {
      data: [
        makeRow(recent),
        makeRow(recent),
        makeRow(last),
        makeRow(last),
        makeRow(last),
        makeRow(last),
      ],
    },
  });
}

const COT_NASDAQ = makeCotJson(
  { date: '2023-01-20', openInterest: 200, ncLong: 80, ncShort: 60, cmLong: 70, cmShort: 50 },
  { date: '2023-01-13', openInterest: 190, ncLong: 75, ncShort: 55, cmLong: 65, cmShort: 45 }
);
const COT_DOW = makeCotJson(
  { date: '2023-01-20', openInterest: 150, ncLong: 60, ncShort: 40, cmLong: 50, cmShort: 30 },
  { date: '2023-01-13', openInterest: 140, ncLong: 55, ncShort: 38, cmLong: 48, cmShort: 28 }
);
const COT_BONDS = makeCotJson(
  { date: '2023-01-20', openInterest: 300, ncLong: 120, ncShort: 80, cmLong: 100, cmShort: 70 },
  { date: '2023-01-13', openInterest: 290, ncLong: 115, ncShort: 75, cmLong: 95, cmShort: 65 }
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Helper.CotTableBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyze.NasdaqCOT.mockResolvedValue(COT_NASDAQ);
    mockAnalyze.DowCOT.mockResolvedValue(COT_DOW);
    mockAnalyze.BondsCOT.mockResolvedValue(COT_BONDS);
    mockBuilder.COtToAzureTableStorage.mockResolvedValue(undefined);
  });

  test('calls Analyze.NasdaqCOT', async () => {
    Helper.CotTableBuilder(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAnalyze.NasdaqCOT).toHaveBeenCalledTimes(1);
  });

  test('calls Analyze.DowCOT after NasdaqCOT resolves', async () => {
    Helper.CotTableBuilder(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAnalyze.DowCOT).toHaveBeenCalledTimes(1);
  });

  test('calls Analyze.BondsCOT after DowCOT resolves', async () => {
    Helper.CotTableBuilder(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAnalyze.BondsCOT).toHaveBeenCalledTimes(1);
  });

  test('calls Builder.COtToAzureTableStorage with date and numeric scores', async () => {
    Helper.CotTableBuilder(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockBuilder.COtToAzureTableStorage).toHaveBeenCalledTimes(1);
    const [date, nasdaqScore, dowScore, bondScore] =
      mockBuilder.COtToAzureTableStorage.mock.calls[0];
    expect(typeof date).toBe('string');
    expect(typeof nasdaqScore).toBe('number');
    expect(typeof dowScore).toBe('number');
    expect(typeof bondScore).toBe('number');
  });

  test('passes the date from the recent NasdaqCOT row', async () => {
    Helper.CotTableBuilder(0);
    await new Promise((r) => setTimeout(r, 0));
    const [date] = mockBuilder.COtToAzureTableStorage.mock.calls[0];
    expect(date).toBe('2023-01-20');
  });

  test('accepts a numeric offset (num > 0)', async () => {
    Helper.CotTableBuilder(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockBuilder.COtToAzureTableStorage).toHaveBeenCalledTimes(1);
  });

  test.todo('handles NasdaqCOT rejection — source has no .catch() so rejection is unhandled; would require source fix to test cleanly');
});
