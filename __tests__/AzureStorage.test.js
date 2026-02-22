'use strict';

jest.mock('azure-storage', () => ({}));
jest.mock('../Library/Secrets/Azure', () => ({
  Secrets: jest.fn(() => ({ URL: 'https://mock.azure', SAS: 'mock-sas' })),
  MongoDbUri: jest.fn(() => ({ URI: 'mongodb://mock' })),
}), { virtual: true });
jest.mock('../Library/logging', () => ({
  appendToErrorLog: jest.fn(),
}));

const AzureStorage = require('../Library/AzureStorage');

function makeTableService(pages) {
  let call = 0;
  return {
    queryEntities: jest.fn((tableName, query, token, cb) => {
      const page = pages[call++] || { entries: [], continuationToken: null };
      cb(null, page);
    }),
    createTableIfNotExists: jest.fn((name, cb) => cb(null, {})),
    insertOrMergeEntity: jest.fn((name, task, cb) => cb(null, {}, {})),
  };
}

function makeFileService(result = '{"SPY":"spy","QQQ":"qqq"}', error = null) {
  return {
    getFileToText: jest.fn((share, dir, file, cb) => cb(error, result)),
    createShareIfNotExists: jest.fn((share, cb) => cb(null, {}, {})),
    createDirectoryIfNotExists: jest.fn((share, dir, cb) => cb(null, {}, {})),
    createFileFromText: jest.fn((share, dir, name, data, cb) => cb(null, {}, {})),
  };
}

describe('AzureStorage.GetTable', () => {
  it('returns all entries from a single page', (done) => {
    const svc = makeTableService([{ entries: [{ id: 1 }], continuationToken: null }]);
    AzureStorage.GetTable('T', svc, {}, (result) => {
      expect(result).toEqual([{ id: 1 }]);
      done();
    });
  });

  it('paginates — accumulates entries across multiple pages', (done) => {
    const svc = makeTableService([
      { entries: [{ id: 1 }], continuationToken: 'tok' },
      { entries: [{ id: 2 }], continuationToken: null },
    ]);
    AzureStorage.GetTable('T', svc, {}, (result) => {
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
      done();
    });
  });

  it('passes the continuation token to the next page call', (done) => {
    const svc = makeTableService([
      { entries: [], continuationToken: 'tok-xyz' },
      { entries: [], continuationToken: null },
    ]);
    AzureStorage.GetTable('T', svc, {}, () => {
      expect(svc.queryEntities.mock.calls[1][2]).toBe('tok-xyz');
      done();
    });
  });

  it('returns empty array when table has no entries', (done) => {
    const svc = makeTableService([{ entries: [], continuationToken: null }]);
    AzureStorage.GetTable('T', svc, {}, (result) => {
      expect(result).toEqual([]);
      done();
    });
  });
});

describe('AzureStorage.GetDaily', () => {
  it('calls callback with entries from the first page', (done) => {
    const svc = makeTableService([{ entries: [{ price: 150 }], continuationToken: null }]);
    AzureStorage.GetDaily('D', svc, {}, (result) => {
      expect(result).toEqual([{ price: 150 }]);
      done();
    });
  });

  it('returns empty array when no entries', (done) => {
    const svc = makeTableService([{ entries: [], continuationToken: null }]);
    AzureStorage.GetDaily('D', svc, {}, (result) => {
      expect(result).toEqual([]);
      done();
    });
  });
});

describe('AzureStorage.ToTable', () => {
  it('calls createTableIfNotExists and insertOrMergeEntity', () => {
    const svc = makeTableService([]);
    const task = { RowKey: { _: 'AAPL' }, PartitionKey: { _: 'equity' } };
    AzureStorage.ToTable('TestTable', svc, task, 'price');
    expect(svc.createTableIfNotExists).toHaveBeenCalledWith('TestTable', expect.any(Function));
    expect(svc.insertOrMergeEntity).toHaveBeenCalledWith('TestTable', task, expect.any(Function));
  });
});

describe('AzureStorage.GetEtfDictionary', () => {
  it('parses JSON and passes the result object to the callback', (done) => {
    const fileService = makeFileService('{"SPY":"spy","QQQ":"qqq"}');
    AzureStorage.GetEtfDictionary(fileService, (result) => {
      expect(result).toEqual({ SPY: 'spy', QQQ: 'qqq' });
      done();
    });
  });
});

describe('AzureStorage.GetSectorEtfs', () => {
  it('returns Object.values of the parsed JSON', (done) => {
    const fileService = makeFileService('{"SPY":"spy","QQQ":"qqq"}');
    AzureStorage.GetSectorEtfs(fileService, (result) => {
      expect(result).toEqual(['spy', 'qqq']);
      done();
    });
  });

  it('does not call callback on file service error', (done) => {
    const fileService = makeFileService(null, new Error('not found'));
    const cb = jest.fn();
    AzureStorage.GetSectorEtfs(fileService, cb);
    // error path logs and does not call callback
    setImmediate(() => {
      expect(cb).not.toHaveBeenCalled();
      done();
    });
  });
});
