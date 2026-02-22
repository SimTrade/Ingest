var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const logging = require('./logging');
const https = require('https'); 
var AzureStorage = require('./AzureStorage');
var azure = require('azure-storage');
var async = require('async');
const AzureSecrets = require('./Secrets/Azure').Secrets()
const Analyze = require('./Analyze');
const Stocklist = require('./Stocklist');
const MongoDb = require('./MongoDb.js')
var jsonquery = require('json-query')
const mkdirp = require('mkdirp');
const fs = require('fs');
const csv = require('csv-parser')
const download = require('download');
const xlsx = require('node-xlsx').default;
const quandlKey = "gX1f8wse2g2dQjXmZ-dR";
const cheerio = require("cheerio");
const rp = require('request-promise');
var LineByLineReader = require('line-by-line')
const googleTrends = require('google-trends-api');
const { ExploreTrendRequest, SearchProviders } = require('g-trends')
const paca = require('./Secrets/AlpacaCreds').getCreds();
const KEYID = require('./Secrets/AlpacaCreds').KEYID();
const SECRETKEY = require('./Secrets/AlpacaCreds').SECRETKEY();
const { Parser } = require('json2csv');
const { NetworkAccessProfileNetworkInstance } = require("twilio/lib/rest/supersim/v1/networkAccessProfile/networkAccessProfileNetwork");
const fields = ['symbol', 'qty', 'time'];
const opts = { fields };
function FinishIngest(factor, list, callback) {
  var factors = {
    Income: "Income%20Statement",
    Metrics: "Metrics",
    Growth: "Growth",
    CashFlow: "Cash%20Flow",
    BalanceSheet: "Balance%20Sheet"
  }
  var FACTOR = factors[factor]

  Stocklist.SymbolList(process.argv[4],
    function (symbols) {
      var stocks = []
      symbols.forEach(x => {
        if (!list.includes(x)) {
          stocks.push(x)
        }
      })
      console.log(stocks)
      var length = stocks.length;
      console.log("length of stocks:" + length)
      var interval = 10000;
      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            console.log(stocks[i])
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=" + FACTOR + "&sort=desc";
            unitOfWork(i, length, url, stocks, factor)

            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);
      }
    })

}

function Ingest(factor, stock, callback) {
  var factors = {
    Income: "Income%20Statement",
    Metrics: "Metrics",
    Growth: "Growth",
    CashFlow: "Cash%20Flow",
    BalanceSheet: "Balance%20Sheet"
  }
  var FACTOR = factors[factor]
  Stocklist.SymbolList(stock,
    function (stocks) {

      var length = stocks.length;
      var interval = 10000;

      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            console.log(stocks[i])
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=" + FACTOR + "&sort=desc";
            unitOfWork(i, length, url, stocks, factor)

            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);
      }
    })
}
function TopUniverse(tableService, callback) {
  GetFinnhubList(tableService, function (list) {
    var items = Object.keys(list).map(function (key) {
      return [key, list[key]];
    });
    items.sort(function (first, second) {
      return second[1] - first[1];
    });
    console.log("universe: " + items.length)
    var first = items.slice(0, 999);
    var second = items.slice(1000, 1999);
    var third = items.slice(2000, 2999);
    var fourth = items.slice(3000, 3999);
    var fifth = items.slice(4000, 4999);
    callback(first, second, third, fourth, fifth)
  })
}
function getOrders() {


  paca.getOrders({
    status: 'closed', //| 'all','open' | 
    after: '2020-11-01',
    until: '2020-12-03',
    limit: 1000000,
    direction: 'asc' //| 'desc'  
  }).then((orders) => {
    console.log(orders)
    var ordArry = []
    orders.forEach(function (order) {
      if (order.filled_qty > 0) {
        ordArry.push({
          "symbol": order.symbol,
          "qty": order.filled_qty,
          "time": order.created_at
        })
      }

    })
    try {
      const parser = new Parser(opts);
      const csv = parser.parse(ordArry);
      fs.writeFileSync("Library/TwoSigmaIntegration/Orders.csv", csv);
      console.log(csv);
    } catch (err) {
      console.error(err);
    }
  });

}
function IsTradingDay(tradingDay, callback) {
  var get = new Promise(function (resolve, reject) {
    var url = "https://paper-api.alpaca.markets/v2/calendar?start=" + tradingDay + "&end=" + tradingDay; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      } else {
        console.log(this.responseText)
      }
    };
    xhttp.open("GET", url, false);
    xhttp.setRequestHeader('APCA-API-KEY-ID', KEYID)
    xhttp.setRequestHeader('APCA-API-SECRET-KEY', SECRETKEY)
    xhttp.send();
  })
  get.then(function (json) {
    callback(JSON.parse(json)[0].date == tradingDay)
  });
}





module.exports = {
  RunIngest: function (factor, stock, callback) {
    Ingest(factor, stock, function () {
      callback()
    })

  },
  FinishIngest: function (factor, stocks, callback) {
    FinishIngest(factor, stocks, function () {
      callback()
    })

  },
  GetOrders: function () {
    getOrders()
  },
  BuildTableUniverses: function (callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

    TopUniverse(tableService, function (first, second, third, fourth, fifth) {
      async.waterfall([
        function (callback) {
          console.log("ENTER 1 -------------------------------")
          first.forEach(function (x) {
            AzureStorage.ToTable("Top1000", tableService, UniverseTask(x[0]));
          })
          callback()
        },
        function (callback) {
          console.log("ENTER 2 -------------------------------")
          second.forEach(function (x) {
            AzureStorage.ToTable("Second1000", tableService, UniverseTask(x[0]));
          })
          callback()
        },
        function (callback) {
          console.log("ENTER 3 -------------------------------")
          third.forEach(function (x) {
            AzureStorage.ToTable("Third1000", tableService, UniverseTask(x[0]));
          })
          callback()
        },
        function (callback) {
          console.log("ENTER 4 -------------------------------")
          fourth.forEach(function (x) {
            AzureStorage.ToTable("Fourth1000", tableService, UniverseTask(x[0]));
          })
          callback()
        },
        function (callback) {
          console.log("ENTER 5 -------------------------------")
          fifth.forEach(function (x) {
            AzureStorage.ToTable("Last1000", tableService, UniverseTask(x[0]));
          })
          callback()
        }
      ], function (err, result) {
        if (err) return callback(err);

        callback(null, result);
      });


    })

  },
  TableIngestRunner: function (interval, analyzeFunction, azureTableName, task, day, symbolStart, callback) {
    TableIngestRunner(interval, analyzeFunction, day, azureTableName, task, symbolStart, function () { console.log("5000 Done") })

  },
  ShortVolumeTask: function (data, stock, date) {

    var obj = JSON.parse(data).dataset.data

    var day1 = obj[0] ? obj[0][1] * obj[0][1] / obj[0][3] : 0
    var day2 = obj[1] ? obj[1][1] * obj[1][1] / obj[1][3] : 0
    var day3 = obj[2] ? obj[2][1] * obj[2][1] / obj[2][3] : 0
    var day4 = obj[3] ? obj[3][1] * obj[3][1] / obj[3][3] : 0
    var day5 = obj[4] ? obj[4][1] * obj[4][1] / obj[4][3] : 0
    var day6 = obj[5] ? obj[5][1] * obj[5][1] / obj[5][3] : 0
    var wkAvg = (day2 + day3 + day4 + day5 + day6) / 5
    var task = {
      PartitionKey: { '_': date },
      RowKey: { '_': stock },
      growthDiff: { '_': (wkAvg - day1) },
      shortDay: { '_': day1 },
      shortWeekAvg: { '_': wkAvg },

    };

    return task
  },
  MongoIngest: function (analyzeFunction, azureTableName, interval, callback) {
    MongoIngestRunner(interval, "whatever", analyzeFunction, azureTableName, function () { console.log("Top1000 Done") })

  },
  RunDaily: function (stock_time_series, azureTableName, output_size, interval, begin, end, stock, callback) {
    AlphaVantageDailyStockRunner(interval, begin, end, Analyze.RapidApi, azureTableName, stock_time_series, output_size, stock, callback)
  },
  RunWeeklyToMonthly: function (stock_time_series, azureTableName, output_size, interval, begin, end, symbol) {
    AlphaVantageWeeklyToMonthlyStockRunner(interval, begin, end, Analyze.RapidApi, azureTableName, stock_time_series, output_size, symbol, function () {
      console.log("RapidApi Done")
      process.exit(0)
    })
  },
  LogBeta: function (data) {
    var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    AzureStorage.StoreBeta(data, fileService)
  },
  CompanyProfile: function () {
    Builder(5000, Analyze.FinnCompanyProfile, 'CompanyProfile', function () {
      console.log("Done")
    })
  },
  GetCalendar: function (tradingDay, callback) {

    IsTradingDay(tradingDay, callback)
  },
  GetBetaIEX: function (callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    GetBetaFromIEX(tableService, function (iex) {
      callback(iex)
    })
  },
  SubmitOrder: function (symbol, weight, sharesExisting, callback) {
    var orderSide = '';
    const barset = paca.getBars(
      'day',
      symbol,
      {
        limit: 5
      }
    ).then((barset) => {

      var sharePrice = barset[symbol][0].closePrice
      var ordersRaw = Math.round(weight / sharePrice)
      var shares = Math.abs(Math.round(ordersRaw - sharesExisting))

      if (Number(ordersRaw) > Number(sharesExisting)) {

        orderSide = 'buy'
      }
      else {
        orderSide = 'sell'
      }
      if ((ordersRaw > 0 && sharesExisting < 0) || (ordersRaw < 0 && sharesExisting > 0)) {
        shares = Math.abs(sharesExisting)
      }


      order(shares, orderSide, symbol)
      if (orderSide == 'sell') {
        shares = -1 * shares
      }
      data = {
        'shares': shares,
        'symbol': symbol
      }
      var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
      AzureStorage.StoreOrders(data, symbol, fileService)


    })


  },
  GetDaily: function (barchartLongCutoff, barchartShortCutoff, callback) {

    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    mergeWJSBARCHART(barchartLongCutoff, barchartShortCutoff, tableService, function (mergeLong, mergeShort) {
      longs = {}
      shorts = []
      GetZacksTable(tableService, function (zacks) {
        Object.values(mergeLong).forEach(function (x) {
          longs[x[0]] = zacks[x[0]]
        })
        Object.values(mergeShort).forEach(function (x) {
          shorts[x[0]] = zacks[x[0]]
        })
        callback(longs, shorts)
      })
    })
  },
  
  COtToAzureTableStorage: function (date, nasdaq, dow, bonds) {

    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);


    var task = {
      PartitionKey: { '_': date },
      RowKey: { '_': date },
      NasdaqScore: { '_': nasdaq },
      dowScore: { '_': dow },
      BondsScore: { '_': bonds }
    }
    console.log(task)
    dataToAzureTableStorage('COT', tableService, task)


  },
  POLYGONCOMPANIES: function (callback) {
    AzureTableRunner(16000,
      Analyze.Company,
      'PolygonCompany',
      function (data, stock) { return CompanyTask(data, stock) },
      function () { callback() })
  },
  FINNHUBLISTIEX: function (callback) {
    AzureTableRunnerForFinnhubListIEX(3000,
      Analyze.IEX,
      'IEX',
      function (data, stock) { return MarketCap_Beta(data, stock) },
      function () { callback() })
  },
  ShortSqueeze: function (stock) {
    AzureTableRunnerNonSeries(60000,
      ShortSqueeze,
      'ShortSqueeze', stock,
      function (data, stock) { return ShortSqueezeTargetTask(data, stock) },
      function () { console.log("ShortSqueeze Done") })

  },
  Barcharts: function (stock) {
    AzureTableRunnerNonSeries(5000,
      Barcharts,
      'Barcharts', stock,
      function (data, stock) { return BarchartTask(data, stock) },
      function () { console.log("Barcharts Done") })
  },
  WSJ: function (stock) {
    AzureTableRunnerNonSeries(7000,
      WsjTarget,
      'WsjTarget', stock,
      function (data, stock) { return WsjTargetTask(data, stock) },
      function () { console.log("WsjTarget Done") })

  },
  Zacks: function (stock) {
    AzureTableRunnerNonSeries(5000,
      Zacks,
      'Zacks', stock,
      function (data, stock) { return ZacksTask(data, stock) },
      function () { console.log("Zacks Done") })

  },
  IEX: function (stock) {
    AzureTableRunnerNonSeries(3000,
      Analyze.IEX,
      'IEX', stock,
      function (data, stock) { return IexTask(data, stock) },
      function () { console.log("IEX Done") })
  },

  Stocklist: function () {
    stocklist(function (data) {
      data = JSON.parse(data)
      data = jsonquery('[*type=EQS].symbol', { data: data }).value
      var theStockList = []
      data.forEach(function (row) {
        if (row.length < 5 && !(row.includes('/') || row.includes('.'))) {
          //  theStockList.push(row)
        }
      })
    })
  },
  DeleteTable: function (table, callback) {
    MongoDb.Delete(table, callback)
  },
  GetEtfDictionary: function () {
    var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    AzureStorage.GetEtfDictionary(fileService)
  },
  PmiVixIngestion: function () {
    Analyze.VIXQuandl().then(data => {
      console.log("VIXQuandl")
      MongoDb.Upsert("VIX", "vix", data)
    });
    Analyze.PMIQuandl().then(data => {
      console.log("PMIQuandl")
      MongoDb.Upsert("PMI", "pmi", data)
    });
  },

  SectorEtfIngestion: function () {
    AlphaVantageEtfRunner(5000, Analyze.RapidApi, 'TIME_SERIES_WEEKLY_ADJUSTED', 'full', 'SectorEtfWeekly', function () {
      console.log("RapidApi Done")
      process.exit(0);
    })
  },

  GoogleByLetter: function () {
    googleBuilder(10000, GoogleTrendOld, 'GoogleTrendMonthly', function () {
      console.log("GoogleTrend Done!")
      // process.exit(0);                  
    })
  },
  FinnhubIpoCalendar: function (day) {
    FinnhubIpoCalendar(day)
  },


  GetPicklist: function () {
    var query = new azure.TableQuery()
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    AzureStorage.GetTable('PickList', tableService, query, function (data) {
      console.log(data)
    })
  },

}
function mergeWJSBARCHART(barchartLongCutoff, barchartShortCutoff, tableService, callback) {
  GetWJSTable(tableService, function (wjs) {
    GetBarchartsTable(tableService, function (bar) {
      var longs = {}
      var shorts = {}
      bar.shorts.forEach(function (symbol) {
        wjs.forEach(function (x) {
          if (x[0] == symbol) {
            shorts[symbol] = x[1];
          }
        })
      })
      bar.longs.forEach(function (symbol) {
        wjs.forEach(function (x) {
          if (x[0] == symbol) {
            longs[symbol] = x[1]
          }
        })
      })

      var longItems = Object.keys(longs).map(function (key) {
        return [key, longs[key]];
      });
      var shortItems = Object.keys(shorts).map(function (key) {
        return [key, shorts[key]];
      });
      shortItems.sort(function (first, second) {
        return second[1] - first[1];
      });
      longItems.sort(function (first, second) {
        return second[1] - first[1];
      });


      var start = Math.round(shortItems.length * barchartShortCutoff)
      var shortArray = shortItems.slice(start, shortItems.length - 1);

      var end = Math.round(longItems.length * barchartLongCutoff)
      var longArray = longItems.slice(0, end);

      console.log(bar.longs, bar.shorts)
      callback(longArray, shortArray)
    })
  })
}
function GetBetaFromIEX(tableService, callback) {

  var query = new azure.TableQuery()
  // .where('PartitionKey eq ?', day);
  AzureStorage.GetDaily('FinnhubListIEX', tableService, query,
    function (data) {
      IEX = {}
      data.forEach(function (x) {
        IEX[Object.values(x.RowKey)[1]] = x.beta && Object.values(x.beta)[0]
      }, null)

      callback(IEX)

    }
  )
}



function GetFinnhubList(tableService, callback) {

  var query = new azure.TableQuery()
  AzureStorage.GetTable('FinnhubListIEX', tableService, query, function (data) {
    FinnhubList = {}
    data.forEach(function (x) {
      if (x.marketcap) {
        var marketCap = Object.values(x.marketcap)[0]
        if (Object.values(x.marketcap)[0] == 'Edm.Double') {
          marketCap = Object.values(x.marketcap)[1]
        }
        FinnhubList[Object.values(x.RowKey)[1]] = marketCap
      }

    }, null)

    callback(FinnhubList)

  }
  )
}
function GetETFList(tableService, callback) {

  var day = new Date('2020-09-30').toJSON().slice(0, 10)
  var query = new azure.TableQuery()
  //  .where('PartitionKey eq ?', day);
  AzureStorage.GetTable('ETFS', tableService, query, function (data) {
    FinnhubList = {}
    data.forEach(function (x) {
      console.log(x)
      if (x.marketcap) {
        var marketCap = Object.values(x.marketcap)[0]
        if (Object.values(x.marketcap)[0] == 'Edm.Double') {
          marketCap = Object.values(x.marketcap)[1]
        }
        FinnhubList[Object.values(x.RowKey)[1]] = marketCap
      }

    }, null)

    callback(FinnhubList)

  }
  )
}
function GetZacksTable(tableService, callback) {

  var day = new Date().toJSON().slice(0, 10)
  var query = new azure.TableQuery()
    .where('PartitionKey eq ?', day);
  AzureStorage.GetDaily('Zacks', tableService, query,
    function (data) {
      zacks = {}
      data.forEach(function (x) {
        zacks[Object.values(x.RowKey)[1]] = Object.values(x.Composite)[0] * Object.values(x.ZackRank)[0]
      }, null)
      callback(zacks)

    }
  )
}
function GetBarchartsTable(tableService, callback) {

  var day = new Date().toJSON().slice(0, 10)
  var query = new azure.TableQuery()
    .select(['Score', 'RowKey'])
    .where('PartitionKey eq ?', day);
  AzureStorage.GetDaily('Barcharts', tableService, query,
    function (data) {
      longs = []
      shorts = []
      data.forEach(function (x) {
        if (Object.values(x.Score)[0] > 379) {
          longs.push(Object.values(x.RowKey)[1])
        }
        if (Object.values(x.Score)[0] < -380) {

          shorts.push(Object.values(x.RowKey)[1])
        }
      }, null)

      callback({ 'longs': longs, 'shorts': shorts })

    }
  )
}
function GetWJSTable(tableService, callback) {

  var day = new Date().toJSON().slice(0, 10)
  var query = new azure.TableQuery()
    .where('PartitionKey eq ?', day);
  AzureStorage.GetDaily('WsjTarget', tableService, query,
    function (data) {
      var all = []

      data.forEach(function (x) {
        var symbol = Object.values(x.RowKey)[1]
        var currentPrice = x.currentPrice && Object.values(x.currentPrice)[0]
        var avgTarget = x.avgTarget && Object.values(x.avgTarget)[0]
        all.push([symbol, ((avgTarget - currentPrice) / currentPrice).toFixed(2)])
      }, null)
      callback(all)

    }
  )
}

function unitOfWork(i, length, url, stocks, name) {
  https.get(url, function(response) {
    if(response.statusCode==200){
      download(url).then(data => {

        var jsonText = csvToJSON("_" + name, data, stocks[i])
        MongoDb.Upsert(name, stocks[i], jsonText)
      });
    }else{
      console.log(stocks[i]+" doesn't exist in stockrow")
    }
  });
  
  console.log(name + ": " + i + "_" + stocks[i])
}

function ShortSqueeze(symbol) {
  var options = {
    uri: 'https://shortsqueeze.com/?symbol=' + symbol + '&submit=Short+Quote',
    transform: function (body) {
      return cheerio.load(body);
    }
  };
  return rp(options)
    .then(function ($) {
      var arry = []
      $('table').each(function (i, e) {
        arry[i] = $(this);
      });
      var data = {
        'daysToCover': Number(arry[arry.length - 18].text().split('\n')[7]),
        'percentFloat': Number(arry[arry.length - 18].text().split('\n')[11].replace('%', '')) / 100,
        'interestGrowth': Number(arry[arry.length - 18].text().split('\n')[15].replace('%', '')) / 100
      }
      console.log(data)
      return JSON.stringify(data);//
    })
    .catch(function (err) {
    });
}

function WsjTarget(symbol) {

  var options = {
    uri: 'https://quotes.wsj.com/' + symbol + '/research-ratings',
    transform: function (body) {
      return cheerio.load(body);
    }
  };
  return rp(options)
    .then(function ($) {
      var targetObject = $('#historicalCol :nth-child(2) :nth-child(1) :nth-child(1) :nth-child(2) :nth-child(2)').text().split("  ");
      medianTarget = Number(targetObject[3].replace('$', ''))//(medianTarget.indexOf('$')+1,medianTarget.length);
      lowTarget = Number(targetObject[4].replace('$', ''))
      highTarget = Number(targetObject[0].replace('$', ''))
      avgTarget = Number(targetObject[5].replace('$', ''))
      currentPrice = Number(targetObject[6].replace('$', ''))
      var data = {
        'medianTarget': medianTarget,
        'lowTarget': lowTarget,
        'highTarget': highTarget,
        'avgTarget': avgTarget,
        'currentPrice': currentPrice
      };
      return JSON.stringify(data);//
    })
    .catch(function (err) {
      console.log(err)
    });
}


function letterScore(string) {
  var score = 0;
  if (string == 'A') {
    score = 1
  } else if (string == 'B') {
    score = .75
  } else if (string == 'C') {
    score = .50
  } else if (string == 'D') {
    score = .25
  } else if (string == 'F') {
    score = 0
  }
  return score
}

function numberScore(num) {
  num = Number(num)
  var score = 0;
  if (num == 1) {
    score = 1
  } else if (num == 2) {
    score = .75
  } else if (num == 3) {
    score = .50
  } else if (num == 4) {
    score = .25
  } else if (num == 5) {
    score = 0
  }
  return score
}
function GoogleTrend(symbol) {
  var explorer = new ExploreTrendRequest()
  ////var company = JSON.parse(logging.GetCompanyProfile(symbol))
  // }


  var run = new Promise(function (resolve, reject) {
    explorer
      .addKeyword(symbol)
      .download().then(csv => {

        console.log(csv)
        resolve(JSON.stringify(csv))
      }).catch(error => {
        console.log('[!] Failed fetching csv data due to an error', error)
        resolve(error)
      })
  })
  return run.then(function (value) {
    return value;
  });

}
function GoogleTrendOld(symbol) {

  let query = {
    keyword: symbol,
    granularTimeResolution: true
  };
  var run = new Promise(function (resolve, reject) {
    googleTrends.interestOverTime({ keyword: symbol + " stock" })
      .then(function (results) {
        resolve(results);
      })
      .catch(function (err) {
        resolve("Err" + err);
      });
  })
  return run.then(function (value) {
    return value;
  });
}
function Zacks(symbol) {
  var options = {
    uri: 'https://www.zacks.com/stock/quote/' + symbol,
    transform: function (body) {
      return cheerio.load(body);
    }
  };

  return rp(options)
    .then(function ($) {
      var zackRank = parseInt($('#quote_ribbon_v2 .quote_rank_summary .zr_rankbox .rank_view .rankrect_1').text() + $('#quote_ribbon_v2 .quote_rank_summary .zr_rankbox .rank_view .rankrect_2').text() + $('#quote_ribbon_v2 .quote_rank_summary .zr_rankbox .rank_view .rankrect_3').text() + $('#quote_ribbon_v2 .quote_rank_summary .zr_rankbox .rank_view .rankrect_4').text() + $('#quote_ribbon_v2 .quote_rank_summary .zr_rankbox .rank_view .rankrect_5').text());
      var str = ($('#quote_ribbon_v2 .quote_rank_summary .industry_rank :nth-child(2)').text().trim())
      str = str.substring(str.indexOf('(') + 1);

      // order of operations matter
      var industry = $('#quote_ribbon_v2 .quote_rank_summary .industry_rank :nth-child(3)').text();

      industry = industry.substring(industry.indexOf("\n") + 1, industry.length).replace("Zacks Industry Rank", "").replace("         ", "")
      var industryRank = (industry.substring(industry.indexOf("(") + 1, industry.indexOf(")")).replace(" out of ", ",").split(','))
      industry = industry.split('\n')[0]
      var industryRanked = (industryRank[1] - industryRank[0]) / industryRank[1]

      var value = $('#quote_ribbon_v2 .quote_rank_summary .composite_group .rank_view .composite_val').text()[0];
      var growth = $('#quote_ribbon_v2 .quote_rank_summary .composite_group .rank_view .composite_val').text()[1];
      var momentum = $('#quote_ribbon_v2 .quote_rank_summary .composite_group .rank_view .composite_val').text()[2];
      var composite = $('#quote_ribbon_v2 .quote_rank_summary .composite_group .rank_view .composite_val').text()[3];
      var EarningsESP = $('#quote_overview #stock_key_earnings .abut_bottom tbody').children().first().text().replace("Earnings ESP", "").replace("%", "").replace(/\s/g, '')
      var data = { "earningsESP": Number(EarningsESP), "industryRank": industryRanked.toFixed(2), "industry": industry, "value": letterScore(value), "growth": letterScore(growth), "momentum": letterScore(momentum), "composite": letterScore(composite), "zackRank": numberScore(zackRank) };
      // fs.writeFileSync("Library/Research/"+symbol+"/Latest/"+symbol+"_Zacks.txt", JSON.stringify(data) );


      return JSON.stringify(data);

    })
    .catch(function (err) {
      console.log(err)
    });

}
function FinnhubIpoCalendar(days) {
  var ipoCalendar = Analyze.FinnhubIpoCalendar(days)
  ipoCalendar.then(data => {

    array = JSON.parse(data)
    ipoArray = []

    Object.keys(array).forEach(function (key) {
      console.log("make sure upder 200: " + array[key].length)
      array[key].forEach(function (x) {

        if (x.exchange != null && x.price > 5
          && x.totalSharesValue > 200000000 && x.symbol != '' &&
          x.symbol.length < 5 && !x.symbol.includes('\\') && !x.symbol.includes('.')) {
          ipoArray.push(x)

        }

      })
    })
    ipoArray.forEach(function (x) {
      // Object.keys(earnings).forEach(function(key){
      //earnings[key].forEach(function(x){
      //})
      //})

      //})
    })
    var symbolArray = []
    ipoArray.forEach(function (x) {
      if (true) {
        symbolArray.push(x.symbol)
      }

    })
    console.log(symbolArray)
    console.log('length: ' + symbolArray.length)
  })

  //  array[0].forEach(function(x){


  // date: '2019-12-06',
  // exchange: null,
  // name: 'Molecular Data Inc.',
  // numberOfShares: null,
  // price: null,
  // status: 'filed',
  // symbol: 'MKD',
  // totalSharesValue: 61870000
  var rate = 1000
  //       Builder(rate, funct ,funct.name,function(){  
  //          Builder(rate, funct ,funct.name,function(){  
  //         })                                           
  //      }) 
}

function stocklist(callback) {
  var list = Analyze.FinnSymbolList(callback);

  list.then(data => callback(data))
}

function barchartBuysell(signal, amount) {

  if (signal == "" || amount == null || amount == undefined) {
    amount = 0;
  }
  amount = amount.toString();
  if (signal == 'Buy') {
    amount = Number(amount.replace("%", ""));
  } else if (signal == 'Sell') {
    amount = -1 * Number(amount.replace("%", ""));
  } else {
    amount = Number(amount.replace("%", "")) / 2 + 50;
  }
  return amount;
}

function Barcharts(symbol) {
  var options = {
    uri: 'https://www.barchart.com/stocks/quotes/' + symbol + '/opinion',
    transform: function (body) {
      return cheerio.load(body);
    }
  };

  return rp(options)
    .then(function ($) {
      var opinion = $('.barchart-content-block .opinion-percent').text();
      var buySell = $('.barchart-content-block .opinion-signal').text();

      var signal = $('.background-widget .clearfix').children().text();
      var wut = signal.match(/Buy|Sell|Hold/g);
      var numbers = signal.match(/\d+/g).map(Number);
      var yesterday = barchartBuysell(wut[0], numbers[0])
      var lastWeek = barchartBuysell(wut[1], numbers[1])
      var lastMonth = barchartBuysell(wut[2], numbers[2])
      var data = { "Overall": yesterday, "Yesterday": yesterday, "LastWeek": lastWeek, "LastMonth": lastMonth };


      return JSON.stringify(data);


    })
    .catch(function (err) {
      console.log(err)
    });

}
async function MongoIngestRunner(interval, universe, analyzer, name, callback) {
  Stocklist.SymbolList(universe,
    function (stocks) {
      var length = stocks.length;
      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i]).then(data => {
                MongoDb.Upsert(name, stocks[i], data)
              });
            } catch {
              var data = analyzer(stocks[i]);
              MongoDb.Upsert(name, stocks[i], data)
            }
            console.log(name + ": " + i + "_" + stocks[i])
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);

      }
    })
}
function TableIngestRunner(interval, analyzer, day, azureTableName, task, symbolStart, callback) {
  Stocklist.SymbolList(symbolStart,
    function (stocks) {
      var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

      var length = stocks.length;
      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i], day).then(data => {
                var obj = {
                  'symbol': stocks[i],
                  'backtest Date': day
                }

                dataToAzureTableStorage(azureTableName, tableService, task(data, stocks[i], day))
              });
            } catch {
              var data = analyzer(stocks[i], day);
              dataToAzureTableStorage(azureTableName, tableService, task(data, stocks[i], day))
            }
            console.log(azureTableName + ": " + i + "_" + stocks[i])
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);

      }
    })
}
function AlphaVantageEtfRunner(interval, analyzer, api, outputSize, name, callback) {
  var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
  AzureStorage.GetSectorEtfs(fileService,
    function (stocks) {
      var length = stocks.length;
      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i], api, outputSize).then(data => {
                MongoDb.Upsert(name, stocks[i], data)
              });
            } catch {
              var data = analyzer(stocks[i]);
              MongoDb.Upsert(name, stocks[i], data)
            }
            console.log(name + ": " + i + "_" + stocks[i])
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);

      }

    })

}
function AlphaVantageDailyStockRunner(interval, begin, end, analyzer, name, stock_time_series, output_size, stock, callback) {
  var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
  Stocklist.SymbolList(stock,
    function (stocks) {
      var length = stocks.length;
      var open = "1. open"
      var high = "2. high"
      var low = "3. low"
      var close = "4. close"
      var adjustedClose = "5. adjusted close"
      var volume = "6. volume"
      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i], stock_time_series, output_size).then(data => {


                if (stock_time_series.includes("EXTENDED")) {
                  var datum = '{"Meta Data": {"1. Information": "Daily Time Series with Splits and Dividend Events","2. Symbol": "A","3. Last Refreshed": "2021-06-18","4. Output Size": "Full size","5. Time Zone": "US/Eastern"},"Time Series (Daily)":{'
                  data = data.split('\n')
                  data.shift()

                  data.forEach(function (x) {
                    var row = x.replace('\r', '').split(',')
                    if (row[0]) {
                      datum += '"' + [row[0]] + '":{"' + open + '":"' + row[1] + '","' + high + '":"' + row[2] + '","' + low + '":"' + row[3] + '","' + close + '":"' + row[4] + '"},'
                    }

                  })
                  data = datum.slice(0, -1)
                  data = data + '}}'
                }

                var vals = Object.values(JSON.parse(data))[1]
                var keys = Object.keys(Object.values(JSON.parse(data))[1])
                var datalength = keys.length

                for (var j = 0; j < datalength; j++) {
                  if (keys[j] < begin) {
                    throw 'threw';

                  }
                  if (keys[j] < end || end == '') {
                    (function (j) {
                      setTimeout(function () {
                        if (name.includes("SMA")) {
                          var task = {
                            PartitionKey: { '_': keys[j] },
                            RowKey: { '_': stocks[i] },
                            SMA: { '_': vals[keys[j]]["SMA"] }
                          };
                        }
                        else if (name.includes("OBV")) {
                          var task = {
                            PartitionKey: { '_': keys[j] },
                            RowKey: { '_': stocks[i] },
                            OBV: { '_': vals[keys[j]]["OBV"] }
                          };
                        } else if (name.includes("BBands")) {
                          var task = {
                            PartitionKey: { '_': keys[j] },
                            RowKey: { '_': stocks[i] },
                            Real_Middle_Band: { '_': vals[keys[j]]["Real Middle Band"] },
                            Real_Upper_Band: { '_': vals[keys[j]]["Real Upper Band"] },
                            Real_Lower_Band: { '_': vals[keys[j]]["Real Lower Band"] }
                          };
                        }

                        else if (name.includes("AD")) {
                          var task = {
                            PartitionKey: { '_': keys[j] },
                            RowKey: { '_': stocks[i] },
                            AD_Line: { '_': vals[keys[j]]["Chaikin A/D"] }

                          };
                        }
                        else if (name.includes("CCI")) {
                          var task = {
                            PartitionKey: { '_': keys[j] },
                            RowKey: { '_': stocks[i] },
                            CCI: { '_': vals[keys[j]]["CCI"] }

                          };
                        }
                        else {

                          var task = {
                            PartitionKey: { '_': keys[j] },
                            RowKey: { '_': stocks[i] },
                            open: { '_': vals[keys[j]][open] },
                            high: { '_': vals[keys[j]][high] },
                            low: { '_': vals[keys[j]][low] },
                            close: { '_': vals[keys[j]][close] },
                            adjustedClose: { '_': vals[keys[j]][adjustedClose] },
                            volume: { '_': vals[keys[j]][volume] }
                          };
                        }
                        var obj = {
                          'symbol': stocks[i],
                          'backtest Date': keys[j]
                        }


                        console.log(task)
                        AzureStorage.ToTable(name, tableService, task, obj, keys[j]);

                      }, 50 * (j))
                    })(j)
                  }
                }
              });
            } catch {
              console.log("tyr/catch for ")
            }
            console.log(name + ": " + i + "_" + stocks[i])
            if (i == length - 1) {
              callback();
              // process.exit(0);
            }
          }, interval * (i));
        })(i);

      }

    })
}
function AlphaVantageWeeklyToMonthlyStockRunner(interval, begin, end, analyzer, name, stock_time_series, output_size, symbol, callback) {
  var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

  Stocklist.SymbolList(symbol,
    function (stocks) {
      var length = stocks.length;
      var open = "1. open"
      var high = "2. high"
      var low = "3. low"
      var close = "4. close"
      var adjustedClose = "5. adjusted close"
      var volume = "6. volume"
      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i], stock_time_series, output_size).then(data => {

                if (!data.includes("Error Message\": \"Invalid API call.")) {
                  var vals = Object.values(JSON.parse(data))[1]
                  var keys = Object.keys(Object.values(JSON.parse(data))[1])
                  var datalength = keys.length

                  var date2 = new Date();
                  var date1 = new Date(begin);
                  var Difference_In_Time = date2.getTime() - date1.getTime();
                  var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);

                  for (var k = 0; k < Difference_In_Days; k++) {
                    console.log("***********************")
                    var d1 = new Date();
                    d1.setDate(d1.getDate() - k);
                    var d2 = new Date(d1);
                    d2.setDate(d2.getDate() - 31);
                    var unentered1 = true
                    var unentered2 = true

                    if (keys[j] < begin) {
                      throw 'date too far back';
                    }
                    var startKey = ''
                    var endKey = ''
                    var unentered3 = true;
                    for (var j = 0; j < datalength; j++) {

                      if (keys[j] < end || end == '') {
                        if (d1.toJSON().slice(0, 10).toString() > keys[j] && unentered1) {

                          startKey = keys[j]
                          unentered1 = false

                        } else if (d2.toJSON().slice(0, 10).toString() > keys[j] && unentered2) {

                          endKey = keys[j]
                          unentered2 = false

                        } else if (!unentered1 && !unentered2 && unentered3) {
                          unentered3 = false
                          var currentAdjOpen = Number(vals[startKey][open])
                          var currentAdjHigh = Number(vals[startKey][high])
                          var currentAdjLow = Number(vals[startKey][low])
                          var currentAdjClose = Number(vals[startKey][adjustedClose])

                          var lastAdjOpen = Number(vals[endKey][open])

                          var lastAdjClose = Number(vals[endKey][adjustedClose])


                          var growth = (currentAdjClose - lastAdjClose) / lastAdjClose
                          var wkGrowth = currentAdjOpen - currentAdjClose
                          var lastWkGrowth = lastAdjOpen = lastAdjClose
                          var monthAvg = (lastWkGrowth + wkGrowth) / 2
                          var delta = (monthAvg + wkGrowth) / 2
                          var trend = 0
                          var date = d1.toJSON().slice(0, 10).toString()
                          if (wkGrowth > 0) {
                            trend = currentAdjHigh - currentAdjClose
                          }
                          else {
                            trend = currentAdjLow - currentAdjClose
                          }
                          var direction = delta + trend
                          var task = {
                            PartitionKey: { '_': date },
                            RowKey: { '_': stocks[i] },
                            direction: { '_': direction },
                            growth: { '_': growth }
                          };
                          var obj = {
                            'symbol': stocks[i],
                            'backtest Date': keys[j]
                          }

                          AzureStorage.ToTable(name, tableService, task, '-');
                        }
                      }
                    }
                  }
                }
              });
            } catch {
              console.log("tyr/catch for ")
            }
            console.log(name + ": " + i + "_" + stocks[i])
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);

      }

    })
}
function RiskTask(data) {

  var day = new Date().toJSON().slice(0, 10)
  var task = {
    PartitionKey: { '_': day },
    RowKey: { '_': day },
    Beta: { '_': data.Beta },
    BasicMaterials: { '_': data['Basic Materials'] },
    Healthcare: { '_': data['Healthcare'] },
    RealEstate: { '_': data['Real Estate'] },
    Industrials: { '_': data['Industrials'] },
    ConsumerCyclical: { '_': data['Consumer Cyclical'] },
    FinancialServices: { '_': data['Financial Services'] },
    Energy: { '_': data.Energy },
    ConsumerDefensive: { '_': data['Consumer Defensive'] },
    Utilities: { '_': data.Utilities },
    Technology: { '_': data.Technology },
    Undefined: { '_': data.undefined }
  };
  return task
}
function UniverseTask(stock) {

  var day = new Date().toJSON().slice(0, 10)
  var task = {
    PartitionKey: { '_': stock },
    RowKey: { '_': stock },

  };
  return task
}
function MarketCap_Beta(data, stock) {
  var obj = JSON.parse(data)
  var day = new Date().toJSON().slice(0, 10)
  var task = {
    PartitionKey: { '_': stock },
    RowKey: { '_': stock },
    marketcap: { '_': obj.marketcap },
    beta: { '_': obj.beta }

  };
  return task
}

function IexTask(data, stock) {
  var obj = JSON.parse(data)
  var day = new Date().toJSON().slice(0, 10)
  var task = {
    PartitionKey: { '_': day },
    RowKey: { '_': stock },
    marketcap: { '_': obj.marketcap },
    peRatio: { '_': obj.peRatio },
    exDividendDate: { '_': obj.exDividendDate },
    nextEarningsDate: { '_': obj.nextEarningsDate },
    day5ChangePercent: { '_': obj.day5ChangePercent },
    day30ChangePercent: { '_': obj.day30ChangePercent },
    month1ChangePercent: { '_': obj.month1ChangePercent },
    month3ChangePercent: { '_': obj.month3ChangePercent },
    month6ChangePercent: { '_': obj.month6ChangePercent },
    ytdChangePercenteta: { '_': obj.ytdChangePercent },
    year2ChangePercent: { '_': obj.year2ChangePercent },
    year5ChangePercent: { '_': obj.year5ChangePercent },
    maxChangePercent: { '_': obj.maxChangePercent },
    sharesOutstanding: { '_': obj.sharesOutstanding },
    companyName: { '_': obj.companyName },
    ttmDividendRate: { '_': obj.ttmDividendRate },
    ttmEPS: { '_': obj.ttmEPS },
    avg30Volume: { '_': obj.avg30Volume },
    avg10Volume: { '_': obj.avg10Volume },
    float: { '_': obj.float },
    day50MovingAvg: { '_': obj.day50MovingAvg },
    day200MovingAvg: { '_': obj.day200MovingAvg },
    employees: { '_': obj.employees },
    week52low: { '_': obj.week52low },
    week52high: { '_': obj.week52high },
    week52change: { '_': obj.week52change },
    beta: { '_': obj.beta },


  };
  return task
}

function CompanyTask(data, stock) {
  var obj = JSON.parse(data)
  var day = new Date().toJSON().slice(0, 10)
  var task = {
    PartitionKey: { '_': stock },
    RowKey: { '_': stock },
    industry: { '_': obj.industry },
    sector: { '_': obj.sector },
    active: { '_': obj.active }

  };
  return task
}
function ZacksTask(data, stock) {

  var obj = JSON.parse(data)
  var day = new Date().toJSON().slice(0, 10)
  var task = {
    PartitionKey: { '_': day },
    RowKey: { '_': stock },
    EarningsESP: { '_': obj.earningsESP },
    IndustryRank: { '_': obj.industryRank },
    Value: { '_': obj.value },
    Growth: { '_': obj.growth },
    Industry: { '_': obj.industry },
    Momentum: { '_': obj.momentum },
    Composite: { '_': obj.composite },
    ZackRank: { '_': obj.zackRank }
  };
  return task
}
function ShortSqueezeTargetTask(data, stock) {
  var obj = JSON.parse(data)
  console.log(obj)
  var day = new Date().toJSON().slice(0, 10)
  var task = {
    PartitionKey: { '_': day },
    RowKey: { '_': stock },
    daysToCover: { '_': obj.daysToCover },
    percentFloat: { '_': obj.percentFloat },
    interestGrowth: { '_': obj.interestGrowth }
  };
  return task
}
function WsjTargetTask(data, stock) {
  var obj = JSON.parse(data)
  var day = new Date().toJSON().slice(0, 10)
  var task = {
    PartitionKey: { '_': day },
    RowKey: { '_': stock },
    medianTarget: { '_': obj.medianTarget },
    lowTarget: { '_': obj.lowTarget },
    highTarget: { '_': obj.highTarget },
    avgTarget: { '_': obj.avgTarget },
    currentPrice: { '_': obj.currentPrice }
  };
  return task
}
function BarchartTask(data, stock) {

  var obj = JSON.parse(data)
  var sum = obj.Overall + obj.Yesterday + obj.LastWeek
  var total = sum + obj.LastMonth
  var day = new Date().toJSON().slice(0, 10)
  var task = {
    PartitionKey: { '_': day },
    RowKey: { '_': stock },
    Score: { '_': total }
  };
  return task
}
function AzureTableRunner(interval, analyzer, name, taskCallback, callback) {
  Stocklist.SymbolList('',
    function (stocks) {
      console.log("______________stocks__________")
      var length = stocks.length;
      var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i]).then(data => {
                var task = taskCallback(data, stocks[i])
                dataToAzureTableStorage(name, tableService, task, data, i)
              });
            } catch {
              var data = analyzer(stocks[i]);
              var task = taskCallback(data, stocks[i])
              dataToAzureTableStorage(name, tableService, task)
            }
            console.log(name + ": " + i + "_" + stocks[i])
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);

      }
    }
  );
}
function AzureTableRunnerNonSeries(interval, analyzer, name, stock, taskCallback, callback) {
  Stocklist.SymbolList(stock,
    function (stocks) {
      console.log("______________stocks__________")
      var length = stocks.length;
      var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i]).then(data => {
                var task = taskCallback(data, stocks[i])
                dataToAzureTableStorage(name, tableService, task)
              });
            } catch {
              var data = analyzer(stocks[i]);
              var task = taskCallback(data, stocks[i])
              dataToAzureTableStorage(name, tableService, task)
            }
            console.log(name + ": " + i + "_" + stocks[i])
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);

      }
    }
  );
}
// /AzureTableRunnerForCompany
function AzureTableRunnerForETFs(interval, analyzer, name, taskCallback, callback) {
  console.log(" inside AzureTableRunnerForETFs _________________")
  name = "ETFS"
  stocklist(function (data) {
    data = JSON.parse(data)
    data = jsonquery('[*type=ETF].symbol', { data: data }).value
    var theStockList = []
    data.forEach(function (row) {
      if (row.length < 5 && !(row.includes('/') || row.includes('.'))) {
        theStockList.push(row)
      }
    })


    var stocks = theStockList//Stocklist.theStockList();
    var length = stocks.length;
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

    for (var i = 0; i < length; i++) {

      (function (i) {
        setTimeout(function () {
          try {
            analyzer(stocks[i]).then(data => {
              var task = taskCallback(data, stocks[i])
              dataToAzureTableStorage(name, tableService, task)
            });
          } catch {
            var data = analyzer(stocks[i]);
            var task = taskCallback(data, stocks[i])
            dataToAzureTableStorage(name, tableService, task)
          }
          console.log(name + ": " + i + "_" + stocks[i])
          if (i == length - 1) {
            callback()
          }
        }, interval * (i));
      })(i);

    }
  })

}
function AzureTableRunnerForFinnhubListIEX(interval, analyzer, name, taskCallback, callback) {
  var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
  console.log(" inside AzureTableRunnerForEIX _________________")
  name = "FinnhubList" + name
  stocklist(function (data) {

    data = JSON.parse(data)
    data = jsonquery('[*type=Common Stock].symbol', { data: data }).value

    var stocks = []

    data.forEach(function (row) {

      if (row.length < 5 && !(row.includes('/') || row.includes('.'))) {

        stocks.push(row)
      }
    })
    stocks = stocks.sort((a, b) =>
      a > b ? 1 : -1);
    var length = stocks.length;

    for (var i = 0; i < length; i++) {

      (function (i) {
        setTimeout(function () {
          try {
            analyzer(stocks[i]).then(data => {
              var task = taskCallback(data, stocks[i])
              dataToAzureTableStorage(name, tableService, task)
            });
          } catch {
            var data = analyzer(stocks[i]);
            var task = taskCallback(data, stocks[i])
            dataToAzureTableStorage(name, tableService, task)
          }
          console.log(name + ": " + i + "_" + stocks[i])
          if (i == length - 1) {
            callback()
          }
        }, interval * (i));
      })(i);

    }
  })

}

function Builder(interval, analyzer, name, callback) {
  console.log(" inside builder")
  var stocks = Stocklist.EODList();
  var length = stocks.length;
  var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

  for (var i = 0; i < length; i++) {
    mkdirp("Library/Research/" + stocks[i], function (err) {
      if (err) return console.log(er);
    });
    (function (i) {
      setTimeout(function () {
        try {
          analyzer(stocks[i]).then(data => {
            dataToAzureFileStorage(data, stocks[i], name, fileService)
          });
        } catch {
          var data = analyzer(stocks[i]);
          console.log(data)
          dataToAzureFileStorage(data, stocks[i], name, fileService)
        }
        console.log(name + ": " + i + "_" + stocks[i])
        if (i == length - 1) {
          callback()
        }
      }, interval * (i));
    })(i);

  }

}

function dataToAzureFileStorage(data, stock, name, fileService) {
  var day = new Date().toJSON().slice(0, 7)
  AzureStorage.Upload(day, stock, name, fileService, data);
}

function dataToAzureTableStorage(name, tableService, task) {
  AzureStorage.ToTable(name, tableService, task);
}


function googleBuilder(interval, analyzer, name, callback) {
  Stocklist.SymbolList1000(
    function (stocks) {
      var length = stocks.length;
      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i]).then(data => {
                MongoDb.Upsert(name, stocks[i], data)
                //  dataToAzureFileStorage(data,stocks[i],name,fileService)
              });
            } catch {
              var data = analyzer(stocks[i]);
              // dataToAzureFileStorage(data,stock[i],name,fileService)
              MongoDb.Upsert(name, stocks[i], data)
            }
            console.log(name + ": " + i + "_" + stocks[i])
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);

      }
    })
}



function csvToJSON(type, data, symbol) {
  var jsonString = '{"' + symbol + '":[{"' + type + '":[';
  var statement = xlsx.parse(data);
  statement[0]['data'].forEach(function (metric) {
    var count = 1;

    if (statement[0]['data'][0] !== metric) {
      jsonString += '{"' + metric[0] + '":[';
      var lines = statement[0]['data'][0];
      lines.forEach(function (datetime) {
        if (statement[0]['data'][0][0] !== datetime) {
          var date = new Date(1900, 0, datetime);
          var year = date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear();
          if (metric[count] == undefined) {
            metric[count] = '"undefined"';
          }
          if (metric[count] == "") {
            metric[count] = '"empty"';
          }
          if (count + 1 < lines.length) {
            jsonString += '{"' + year + '" : ' + metric[count++] + '},'
          }
          else {
            jsonString += '{"' + year + '" : ' + metric[count++] + '}]},'
          }
        }
      })
    }
  })
  jsonString = jsonString.substring(0, jsonString.length - 1);
  jsonString += "]}]}";
  return jsonString;
}
