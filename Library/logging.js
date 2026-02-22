'use strict';
var mkdirp = require('mkdirp');
LineReaderSync = require("line-reader-sync")
var getDirName = require('path').dirname;
var fs = require('fs');
const fsextra = require('fs-extra');

module.exports = {

  GetCompanyProfile: function (symbol) {
    try {
      return fs.readFileSync("Library/Research/" + symbol + "/" + symbol + "_CompanyProfile.txt", 'utf-8');
    } catch (err) {
      return null;
    }
  },

  GetStockList: function () {
    var lines = fs.readFileSync("Library/StockList/stocklist.txt", 'utf-8')
    return lines;
  },

  newestlisttopVolume: function () {
    var lines = fs.readFileSync("Library/StockList/devList.txt", 'utf-8')
      .split('\n')
      .filter(Boolean);
    return lines;
  },

  appendToPrimeList: function (line) {
    var lines = fs.readFileSync("Library/StockList/stocklist.txt", 'utf-8')
    var table = JSON.parse(lines)
    table.obj.push(line);
    fs.writeFileSync("Library/StockList/stocklist.txt", JSON.stringify(table));
  },

  Analysis: function (symbol, value, algo) {
    var callPromise = new Promise(function (resolve, reject) {
      var done = fs.promises.mkdir('Algorithm/' + algo + '/info/' + symbol, { recursive: true }).catch(console.error);
      resolve(done);
    })
    callPromise.then(function (done) {
      fs.writeFileSync('Algorithm/' + algo + '/info/' + symbol + '/analysis.txt', JSON.stringify(value));
    })
  },

  News: function (symbol, value, algo) {
    var callPromise = new Promise(function (resolve, reject) {
      var done = fs.promises.mkdir('Algorithm/' + algo + '/info/' + symbol, { recursive: true }).catch(console.error);
      resolve(done);
    })
    callPromise.then(function (done) {
      fs.writeFileSync('Algorithm/' + algo + '/info/' + symbol + '/news.txt', JSON.stringify(value));
    })
  },

  Sentiment: function (symbol, value, algo) {
    var callPromise = new Promise(function (resolve, reject) {
      var done = fs.promises.mkdir('Algorithm/' + algo + '/info/' + symbol, { recursive: true }).catch(console.error);
      resolve(done);
    })
    callPromise.then(function (done) {
      fs.writeFileSync('Algorithm/' + algo + '/info/' + symbol + '/sentiment.txt', JSON.stringify(value));
    })
  },

  Company: function (symbol, value, algo) {
    var callPromise = new Promise(function (resolve, reject) {
      var done = fs.promises.mkdir('Algorithm/' + algo + '/info/' + symbol, { recursive: true }).catch(console.error);
      resolve(done);
    })
    callPromise.then(function (done) {
      fs.writeFileSync('Algorithm/' + algo + '/info/' + symbol + '/company.txt', JSON.stringify(value));
    })
  },

  Dividends: function (symbol, value, algo) {
    var callPromise = new Promise(function (resolve, reject) {
      var done = fs.promises.mkdir('Algorithm/' + algo + '/info/' + symbol, { recursive: true }).catch(console.error);
      resolve(done);
    })
    callPromise.then(function (done) {
      fs.writeFileSync('Algorithm/' + algo + '/info/' + symbol + '/dividends.txt', JSON.stringify(value));
    })
  },

  Splits: function (symbol, value, algo) {
    var callPromise = new Promise(function (resolve, reject) {
      var done = fs.promises.mkdir('Algorithm/' + algo + '/info/' + symbol, { recursive: true }).catch(console.error);
      resolve(done);
    })
    callPromise.then(function (done) {
      fs.writeFileSync('Algorithm/' + algo + '/info/' + symbol + '/splits.txt', JSON.stringify(value));
    })
  },

  Earnings: function (symbol, value, algo) {
    var callPromise = new Promise(function (resolve, reject) {
      var done = fs.promises.mkdir('Algorithm/' + algo + '/info/' + symbol, { recursive: true }).catch(console.error);
      resolve(done);
    })
    callPromise.then(function (done) {
      fs.writeFileSync('Algorithm/' + algo + '/info/' + symbol + '/earnings.txt', JSON.stringify(value));
    })
  },

  Financials: function (symbol, value, algo) {
    var callPromise = new Promise(function (resolve, reject) {
      var done = fs.promises.mkdir('Algorithm/' + algo + '/info/' + symbol, { recursive: true }).catch(console.error);
      resolve(done);
    })
    callPromise.then(function (done) {
      fs.writeFileSync('Algorithm/' + algo + '/info/' + symbol + '/financials.txt', JSON.stringify(value));
    })
  },

  LastQuote: function (symbol, value, algo) {
    var callPromise = new Promise(function (resolve, reject) {
      var done = fs.promises.mkdir('Algorithm/' + algo + '/info/' + symbol, { recursive: true }).catch(console.error);
      resolve(done);
    })
    callPromise.then(function (done) {
      fs.writeFileSync('Algorithm/' + algo + '/info/' + symbol + '/lastQuote.txt', value);
    })
  },

  getEODMaster: function () {
    var masterpath = 'transform/EODworkArea/master.csv';
    if (fs.existsSync(masterpath)) {
      try {
        return fs.readFileSync(masterpath, 'utf8').split('\n');
      } catch (err) {
        console.log(err);
      }
    }
  },

  getEodCsvs: function () {
    var masterpath = 'transform/EODworkArea/master.csv';
    if (fs.existsSync(masterpath)) {
      fs.unlink(masterpath, (err) => {
        if (err) throw err;
        console.log('path was deleted');
      })
    }
    try {
      var alphabet = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
      for (var i = 0; i < alphabet.length; i++) {
        var eod = fs.readFileSync("transform/EODworkArea/" + alphabet[i] + ".csv", 'utf8')
        var eodList = eod.split('\n')
        eodList.forEach(function (x) {
          if ((!x.includes('-')) && (!x.includes('.')) && x.length < 5) {
            console.log(x)
            fs.appendFileSync(masterpath, x + '\n', function (err) {
              if (err) throw err;
            });
          }
        })
      }
    } catch (err) {
      console.log(err);
    }
  },

};
