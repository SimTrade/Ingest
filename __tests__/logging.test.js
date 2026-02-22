'use strict';

jest.mock('fs');
jest.mock('fs-extra');
jest.mock('mkdirp');
jest.mock('line-reader-sync', () => jest.fn(), { virtual: true });

const fs = require('fs');
const fsextra = require('fs-extra');
const logging = require('../Library/logging');

describe('logging.CreateCSV', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the CSV content to the correct file path', () => {
    fs.writeFileSync.mockImplementation(() => {});
    const cb = jest.fn();

    logging.CreateCSV('a,b,c\n1,2,3', 'myReport', cb);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'Library/TwoSigmaIntegration/csv/myReport.csv',
      'a,b,c\n1,2,3'
    );
  });

  it('calls the callback with the path and name after writing', () => {
    fs.writeFileSync.mockImplementation(() => {});
    const cb = jest.fn();

    logging.CreateCSV('data', 'testFile', cb);

    expect(cb).toHaveBeenCalledWith('Library/TwoSigmaIntegration/csv/', 'testFile');
  });

  it('still calls the callback even if writeFileSync throws', () => {
    fs.writeFileSync.mockImplementation(() => { throw new Error('disk full'); });
    const cb = jest.fn();

    logging.CreateCSV('data', 'failFile', cb);

    expect(cb).toHaveBeenCalledWith('Library/TwoSigmaIntegration/csv/', 'failFile');
  });
});

describe('logging.appendToErrorLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('[]');
    fs.writeFileSync.mockImplementation(() => {});
    fsextra.ensureFileSync.mockImplementation(() => {});
  });

  it('appends the error to the correct log file path', () => {
    logging.appendToErrorLog('pipeline', 'AAPL', '2024-01-15', { msg: 'timeout' });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'Library/Logs/pipeline_failures/2024-01-15_AAPL.json',
      expect.any(String)
    );
  });

  it('appends _failures suffix to the folder name', () => {
    logging.appendToErrorLog('scraper', 'TSLA', '2024-01-15', { msg: 'error' });

    const callPath = fs.writeFileSync.mock.calls[0][0];
    expect(callPath).toContain('scraper_failures');
  });
});
