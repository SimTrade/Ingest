var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const logging = require('./logging');
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
const alphaAvantageKey = '8LD1A47ZTI6P4Q4J'
const quandlKey = "gX1f8wse2g2dQjXmZ-dR";
const request = require("request");
const cheerio = require("cheerio");
const rp = require('request-promise');
const path = require('path');
const lineReader = require('line-reader');
var LineByLineReader = require('line-by-line')
const googleTrends = require('google-trends-api');
const { ExploreTrendRequest, SearchProviders } = require('g-trends')
const paca = require('./Secrets/AlpacaCreds').getCreds();
const KEYID = require('./Secrets/AlpacaCreds').KEYID();
const SECRETKEY = require('./Secrets/AlpacaCreds').SECRETKEY();
const { all } = require("bluebird");
const { forEach, trimEnd } = require("lodash");
const { objectRecognizer } = require("paralleldots");
const { Parser } = require('json2csv');
const { NetworkAccessProfileNetworkInstance } = require("twilio/lib/rest/supersim/v1/networkAccessProfile/networkAccessProfileNetwork");
const fields = ['symbol', 'qty', 'time'];
const opts = { fields };
function closeAllPositions() {
  paca.closeAllPositions().then((report) => {
    console.log('closed all positions ')
  })
  paca.cancelAllOrders().then((report) => {
    console.log('closed all positions ')
  })
}

function order(orderQuantity, orderSide, symbol) {

  var orderObj = {
    symbol: symbol,
    qty: Math.abs(orderQuantity),
    side: orderSide,
    type: 'market',
    time_in_force: 'day',
  }


  console.log(orderObj)
  paca.createOrder(orderObj).then((order) => {
    console.log('Order :', order)
  });

}
function TopUniverse(tableService, callback) {
  GetFinnhubList(tableService, function (list) {
    var items = Object.keys(list).map(function (key) {
      return [key, list[key]];
    });
    items.sort(function (first, second) {
      return second[1] - first[1];
    });
    console.log("universe: "+items.length)
    var first = items.slice(0, 999);
    var second = items.slice(1000, 1999);
    var third = items.slice(2000, 2999);
    var fourth = items.slice(3000, 3999); 
    var fifth = items.slice(4000, 4999);
    callback(first, second, third, fourth,fifth)
  })
}
function TopEtfs(tableService, callback) {
  GetETFList(tableService, function (list) {
    var etfs = Object.keys(list).map(function (key) {
      return [key, list[key]];
    });
    etfs.sort(function (first, second) {
      return second[1] - first[1];
    });

    var top40 = etfs.slice(0, 40)
    var top100 = etfs.slice(0, 100)
    callback(top40, top100)
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
function GetPortfolio(callback) {
  var get = new Promise(function (resolve, reject) {
    var url = "https://paper-api.alpaca.markets/v2/account/portfolio/history"; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.setRequestHeader('APCA-API-KEY-ID', KEYID)
    xhttp.setRequestHeader('APCA-API-SECRET-KEY', SECRETKEY)
    xhttp.send();
  })
  get.then(function (json) {
    callback(json)
  });
}
function NAAIMexposure() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/NAAIM/NAAIM.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/NAAIMexposure.txt", json);
  });
}
function InstitutionalCrashConfidence() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/YALE/US_CONF_INDEX_CRASH_INST.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/InstitutionalCrashConfidence.txt", json);
  });
}
function InstitutionalValuationConfidence() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/YALE/US_CONF_INDEX_VAL_INST.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/InstitutionalValuationConfidence.txt", json);
  });
}
function CorporateBondYields() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/ML/AAAEY.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/CorporateBondYields.txt", json);
  });
}
function IPOfilings() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/RENCAP/USIPO_FILINGS.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/IPOfilings.txt", json);
  });
}
function InvestorSentiment() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/AAII/AAII_SENTIMENT.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/InvestorSentiment.txt", json);
  });
}
function MedianHouseholdIncome() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/MEHOINUSA672N.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/MedianHouseholdIncome.txt", json);
  });
}
function CivilianUnemploymentRate() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/UNRATE.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/CivilianUnemploymentRate.txt", json);
  });
}
function InitialClaims() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/ICSA.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/InitialClaims.txt", json);
  });
}
function NonFarmPayroll() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/PAYEMS.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/NonFarmPayroll.txt", json);
  });
}
function TenYearConstantMaturity() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/DGS10.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/TenYearConstantMaturity.txt", json);
  });
}
function VelocityOfMoney() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/M2V.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/VelocityOfMoney.txt", json);
  });
}
function LeadingIndex() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/USSLIND.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/LeadingIndex.txt", json);
  });
}
function PrimeRate() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/DPRIME.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/PrimeRate.txt", json);
  });
}
function TedSpread() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/TEDRATE.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/TedSpread.txt", json);
  });
}
function FedFundRate() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/DFF.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/FedFundRate.txt", json);
  });
}
function CPI() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/CPIAUCSL.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/CPI.txt", json);
  });
}
function PriceDeflator() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/GDPDEF.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/PriceDeflator.txt", json);
  });
}
function RealGrossGDP() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/FRED/GDPC1.json?api_key=" + quandlKey; // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/RealGrossGDP.txt", json);
  });
}
function PMI() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.json?api_key=" + quandlKey // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (json) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    fs.writeFileSync("Library/Macro/PMI.txt", json);
  });
}

function SKEW() {
  var get = new Promise(function (resolve, reject) {
    var url = "http://www.cboe.com/publish/scheduledtask/mktdata/datahouse/skewdailyprices.csv" // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (csv) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    var lines = csv.split('\n');
    lines.splice(0, 1);
    var newtext = lines.join('\n');
    fs.writeFileSync("Library/Macro/SKEW.csv", newtext);
  });
}

function VIX() {
  var get = new Promise(function (resolve, reject) {
    var url = "http://www.cboe.com/publish/scheduledtask/mktdata/datahouse/vixcurrent.csv" // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (csv) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    var lines = csv.split('\n');
    lines.splice(0, 1);
    var newtext = lines.join('\n');
    fs.writeFileSync("Library/Macro/VIX.csv", newtext);
  });
}

function INFLATION() {
  var get = new Promise(function (resolve, reject) {
    var url = "https://www.quandl.com/api/v3/datasets/RATEINF/INFLATION_USA.csv?api_key=gX1f8wse2g2dQjXmZ-dR" // "https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.csv";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  get.then(function (csv) {
    mkdirp("Library/Macro/", function (err) {
      if (err) return console.log(er);
    });
    var lines = csv.split('\n');
    lines.splice(0, 1);
    var newtext = lines.join('\n');
    fs.writeFileSync("Library/Macro/INFLATION.csv", csv);
  });
}


module.exports = {
  GetOrders: function () {
    getOrders()
  },
  BuildTableUniverses: function (callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    
    TopUniverse(tableService, function (first,second,third,fourth,fifth) {
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
  TableIngestRunner: function (interval, analyzeFunction,azureTableName,task,day,callback) {
    TableIngestRunner(interval, analyzeFunction,day, azureTableName,task, function () { console.log("5000 Done") })
    
  },
   ShortVolumeTask: function(data,stock,date) {
  
    var obj = JSON.parse(data).dataset.data  
             
    var day1 = obj[0][1] * obj[0][1]/ obj[0][3]
    var day2 = obj[1][1] * obj[1][1]/ obj[1][3]
    var day3 = obj[2][1] * obj[2][1]/ obj[2][3]
    var day4 = obj[3][1] * obj[3][1]/ obj[3][3]
    var day5 = obj[4][1] * obj[4][1]/ obj[4][3]
    var day6 = obj[5][1] * obj[5][1]/ obj[5][3]
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
  MongoIngest: function (analyzeFunction, azureTableName,interval, callback) {
    MongoIngestRunner(interval,"whatever", analyzeFunction, azureTableName, function () { console.log("Top1000 Done") })

    // async.waterfall([
    //   function (callback) {
    //     console.log("ENTER 1 -------------------------------")
    //       MongoIngestRunner(interval,"whatever", analyzeFunction, azureTableName, function () { console.log("Top1000 Done") })
    //     callback()
    //   },
      // function (callback) {
      //   console.log("ENTER 2 -------------------------------")
      //    MongoIngestRunner(interval,"Second1000",analyzeFunction, azureTableName, function () { console.log("Second1000 Done") })
      //   callback()
      // },
      // function (callback) {
      //   console.log("ENTER 3 -------------------------------")
      //     MongoIngestRunner(interval,"Third1000", analyzeFunction, azureTableName, function () { console.log("Third1000 Done") })
      //   callback()
      // },
      // function (callback) {
      //   console.log("ENTER 4 -------------------------------")
      //     MongoIngestRunner(interval,"Fourth1000",analyzeFunction, azureTableName, function () { console.log("Fourth1000 Done") })
      //   callback()
      // },
      // function (callback) {
      //   console.log("ENTER 5 -------------------------------")
      //   MongoIngestRunner(interval,"Last1000", analyzeFunction, azureTableName, function () { console.log("Last1000 Done") })
      //   callback()
      // }
    //  ], function (err, result) {
    //   if (err) return callback(err);
    
    //   callback(null, result);
    //  });
   // MongoIngestRunner(interval,"Top1000", analyzeFunction, azureTableName, function () { console.log("Top1000 Done") })

  },
  Run: function (stock_time_series,azureTableName,output_size,interval,begin,end) {
    AlphaVantageStockRunner(interval,begin,end, Analyze.RapidApi, azureTableName,stock_time_series,output_size, function () {
      console.log("RapidApi Done")
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
  GetPortfolio: function (callback) {
    GetPortfolio(callback)
  },
  GetCalendar: function (tradingDay, callback) {
   
    IsTradingDay(tradingDay, callback)
  },
  CancelAllOrders: function () {

    paca.cancelAllOrders()

  },
  Candles: function () {


    var companyList = getIpos(Stocklist.EODList()).slice(0, 1000)


    for (var i = 0; i < companyList.length; i++) {

      (function (i) {
        setTimeout(function () {

          var company = JSON.parse(companyList[i])

          if (company != null && company != undefined && company.ipo != undefined) {
            var array = []
            var date = new Date();
            var year = date.getFullYear();
            var newYear = new Date(year, 0, 1);
            var ipoDate = new Date(company.ipo)
            var day = date.getDay();
            var month = date.getMonth() + 1;
            date.setDate(date.getDate());

            var unixToday = Math.floor(date.getTime() / 1000)
            var unixIpoDate = Math.floor(ipoDate.getTime() / 1000)
            var unixThisNewYear = Math.floor(newYear.getTime() / 1000)
            var unixTenYears = 86400 * 365 * 10
            var unixTenYearsNewYear = unixThisNewYear - unixTenYears

            console.log("_________________________")
            console.log(date)
            console.log(ipoDate)
            console.log(newYear)


            if (unixIpoDate < unixTenYearsNewYear) {
              unixIpoDate = unixTenYearsNewYear
            } else {
              unixIpoDate = new Date(unixIpoDate * 1000)
              unixIpoDate = new Date(unixIpoDate.getFullYear() + 1, 0, 1)
              unixIpoDate = Math.floor(unixIpoDate.getTime() / 1000)

            }
            while (unixIpoDate < unixToday) {


              array.push([company.ticker, unixIpoDate])

              unixIpoDate = new Date(unixIpoDate * 1000)
              //console.log("inside while: " +  unixIpoDate)
              unixIpoDate = new Date(unixIpoDate.getFullYear() + 1, 0, 1)
              //console.log("inside also : " +  unixIpoDate)
              unixIpoDate = Math.floor(unixIpoDate.getTime() / 1000)
              //console.log("inside while: " +  unixIpoDate+" vs "+unixToday)
            }

            console.log(array)
            console.log("_________________________")
            CallbackAPIPromise(array.reverse().slice(0, 10), Candles, 3000, function (arry) {
              //console.log(arry)
              mkdirp("Library/Research/" + arry.symbol + "/CandlesAnnually/", function (err) {
                if (err) return cb("---------------");
                fs.writeFileSync("Library/Research/" + arry.symbol + "/CandlesAnnually/Annual_60minute_" + arry.date + ".json", arry.data);

              });
            })
          }
        }, 30000 * i)
      }
      )(i)
    }
  },
  GetBetaIEX: function (callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    GetBetaFromIEX(tableService, function (iex) {
      callback(iex)
    })
  },
  CloseAllPositions() {
    closeAllPositions();
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
      // console.log(sharePrice, weight)
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
  Finnhub: function () {
    FinnhubHistorical();
    // FinnhubLatest();// only 1 at a time!
  },
  //CallbackAPIPromise(array, functional,interval, callback)
  Transcripts: function () {
    CallbackAPIPromise(Stocklist.EODList(), Analyze.FinnTranscriptList, 1000, function (array) {
      CallbackAPIPromise(array, Analyze.FinnTranscriptCall, 1000, function (array) {
        console.log(array)
        // mkdirp("Library/Research/"+symbol+"/Transcripts/", function (err) {
        //                        if (err) return console.log(er);
        //                      }); 
        //                      fs.writeFileSync("Library/Research/"+symbol+"/Transcripts/"+transcript.time.split(" ")[0]+".json", data);  
        //                     if(i == array.length-1){
        //                       console.log("done")
        //                       }
      })
    })

  },


  FinnEcon: function () {
    var get = Analyze.FinnEconCodes();

    var array = []
    get.then(function (codes) {

      JSON.parse(codes).forEach(function (x) {
        if (x.country.toUpperCase() == "UNITED STATES") {
          array.push(x)

        }
      })
      for (var i = 0; i < array.length; i++) {

        (function (i) {
          setTimeout(function () {
            var got = Analyze.FinnEconData(array[i].code);
            got.then(function (data) {
              mkdirp("Finnhub/Economic/", function (err) {
                if (err) return cb("-----------------");
              });
              fs.writeFileSync("Finnhub/Economic/" + array[i].name.split('/').join('') + ".json", data);
              if (i == array.length - 1) {
                console.log("done")
              }
            })
          }, 1000 * i)
        }
        )(i)
      }

    });


  },

  reduce: function () {

  },
  skew: function () {
    SKEW();
  },
  vix: function () {
    VIX();
  },
  inflation: function () {
    INFLATION();
  },
  test2: function () {
    var resultsDistinct = []
    //https://www.quandl.com/api/v3/datatables/SHARADAR/SF1?calendardate=2011-12-31&ticker=ZZ&api_key=gX1f8wse2g2dQjXmZ-dR
    var results = [];
    var filePath = "Sharadar/tickers.csv";
    var tickers = fs.readFileSync(filePath, 'utf8')
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {

        results.forEach(function (x) {
          resultsDistinct.push(x.ticker)
        })
        var symbolDistinct = Array.from(new Set(resultsDistinct)).filter(isTradeable).filter(isTradeable);
        for (var i = 0; i < symbolDistinct.length; i++) {


          (function (i) {
            setTimeout(function () {
              //https://www.quandl.com/api/v3/datatables/SHARADAR/SFP?date=2019-12-18&ticker=%5EVIX&api_key=gX1f8wse2g2dQjXmZ-dR
              var sharadarCall = 'https://www.quandl.com/api/v3/datatables/SHARADAR/SFP.csv?ticker='
                + symbolDistinct[i] + '&api_key=gX1f8wse2g2dQjXmZ-dR'
              // console.log(sharadarCall);



              console.log(symbolDistinct[i]);//.localeCompare('PGEI'))
              if (true) {//symbolDistinct[i].localeCompare('PGEI') > 'PGEI'){
                ////////////////////
                var get = new Promise(function (resolve, reject) {
                  var xhttp = new XMLHttpRequest();
                  xhttp.onreadystatechange = function () {
                    if (this.readyState == 4 && this.status == 200) {
                      resolve(this.responseText);
                    }
                  };
                  xhttp.open("GET", sharadarCall, false);
                  xhttp.send();
                })
                get.then(function (file) {
                  console.log(symbolDistinct[i]);
                  mkdirp("Sharadar/EODbundle/", function (err) {
                    if (err) return console.log(er);
                  });
                  fs.writeFileSync("Sharadar/EODbundle/" + symbolDistinct[i] + ".csv", file);
                });
              }

              ///////////////////
            }, 1000 * i);
          })(i);

        }

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
    // console.log(task) 
    dataToAzureTableStorage('COT', tableService, task)


  },
  POLYGONCOMPANIES: function (callback) {
    AzureTableRunner(16000,
      Analyze.Company,
      'PolygonCompany',
      function (data, stock) { return CompanyTask(data, stock) },
      function () { callback() })
  },
  EQUITYPICKS: function (callback) {
    AzureTableRunnerForIEX(3000,
      Analyze.IEX,
      'IEX',
      function (data, stock) { return MarketCap_Beta(data, stock) },
      function () { callback() })
  },
  ETFPICKS: function () {
    AzureTableRunnerForETFs(3000,
      Analyze.IEX,
      'IEX',
      function (data, stock) { return IexTask(data, stock) },
      function () { console.log("IEX Done") })
  },
  ShortSqueeze: function () {
    //  console.log(ShortSqueeze('ZTS'))
    AzureTableRunnerNonSeries(60000,
      ShortSqueeze,
      'ShortSqueeze',
      function (data, stock) { return ShortSqueezeTargetTask(data, stock) },
      function () { console.log("ShortSqueeze Done") })

  },
  Barcharts: function () {
    AzureTableRunnerNonSeries(5000,
      Barcharts,
      'Barcharts',
      function (data, stock) { return BarchartTask(data, stock) },
      function () { console.log("Barcharts Done") })
  },
  WSJ: function () {
    AzureTableRunnerNonSeries(7000,
      WsjTarget,
      'WsjTarget',
      function (data, stock) { return WsjTargetTask(data, stock) },
      function () { console.log("WsjTarget Done") })

  },
  Zacks: function () {
    AzureTableRunnerNonSeries(5000,
      Zacks,
      'Zacks',
      function (data, stock) { return ZacksTask(data, stock) },
      function () { console.log("Zacks Done") })

  },
  IEX: function () {
    AzureTableRunnerNonSeries(3000,
      Analyze.IEX,
      'IEX',
      function (data, stock) { return IexTask(data, stock) },
      function () { console.log("IEX Done") })
  },
  test: function () {
    var resultsDistinct = []
    //https://www.quandl.com/api/v3/datatables/SHARADAR/SF1?calendardate=2011-12-31&ticker=ZZ&api_key=gX1f8wse2g2dQjXmZ-dR
    var results = [];
    var filePath = "Sharadar/tickers.csv";
    var tickers = fs.readFileSync(filePath, 'utf8')
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {

        results.forEach(function (x) {
          resultsDistinct.push(x.ticker)
        })
        var symbolDistinct = Array.from(new Set(resultsDistinct)).filter(isTradeable).filter(isTradeable);
        for (var i = 0; i < symbolDistinct.length; i++) {


          (function (i) {
            setTimeout(function () {
              //https://www.quandl.com/api/v3/datatables/SHARADAR/SFP?date=2019-12-18&ticker=%5EVIX&api_key=gX1f8wse2g2dQjXmZ-dR
              var sharadarCall = 'https://www.quandl.com/api/v3/datatables/SHARADAR/SF1?calendardate=2011-12-31&ticker='
                + symbolDistinct[i] + '&api_key=gX1f8wse2g2dQjXmZ-dR'
              console.log(sharadarCall);



              //.localeCompare('PGEI'))
              if (true) {//symbolDistinct[i].localeCompare('PGEI') > 'PGEI'){
                ////////////////////
                var get = new Promise(function (resolve, reject) {
                  var xhttp = new XMLHttpRequest();
                  xhttp.onreadystatechange = function () {
                    if (this.readyState == 4 && this.status == 200) {
                      resolve(this.responseText);
                    }
                  };
                  xhttp.open("GET", sharadarCall, false);
                  xhttp.send();
                })
                get.then(function (file) {
                  mkdirp("Sharadar/Fundamentalsbundle/", function (err) {
                    if (err) return console.log(er);
                  });
                  console.log(symbolDistinct[i]);
                  fs.writeFileSync("Sharadar/Fundamentalsbundle/" + symbolDistinct[i] + ".csv", file);
                });
              }
              /////////////////
            }, 1000 * i);
          })(i);
        }
      })
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
      //   console.log(theStockList)
      // console.log(theStockList.length)
    })
  },
  RiskToTable: function (table, data) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    dataToAzureTableStorage(table, tableService, RiskTask(data))
  },
  DeleteStocksWeekly: function () {
    MongoDb.Delete('StocksWeekly')
  },
  DeleteShortVolume: function () {
    MongoDb.Delete("ShortVolume")
  },
  DeleteBalanceSheet: function () {
    MongoDb.Delete("BalanceSheet")
  },
  DeleteCashFlow: function () {
    MongoDb.Delete("CashFlow")
  },
  DeleteGrowth: function () {
    MongoDb.Delete("Growth")
  },
  DeleteIncome: function () {
    MongoDb.Delete("Income")
  },
  DeleteMetrics: function () {
    MongoDb.Delete("Metrics")
  },
  DeletePMI: function () {
    MongoDb.Delete("PMI")
  },
  DeleteSectorEtfWeekly: function () {
    MongoDb.Delete("SectorEtfWeekly")
  },
  DeleteVIX: function () {
    MongoDb.Delete("VIX")
  },
  GetEtfDictionary: function () {
    var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    AzureStorage.GetEtfDictionary(fileService)
  },
  Macro: function () {
    Analyze.VIXQuandl().then(data => {
      console.log("VIXQuandl")
      MongoDb.Upsert("VIX", "vix", data)
    });
    Analyze.PMIQuandl().then(data => {
      console.log("PMIQuandl")
      MongoDb.Upsert("PMI", "pmi", data)
    });
  },
  GetMacroTable: function (day, callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    GetMacroTable(tableService, day, callback)
  },
  GetSectorSharpeDaily: function (day, callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    GetSectorSharpeDaily(tableService, day, callback)
  },
  GetRiskDaily: function (day, callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    GetRiskDaily(tableService, day, callback)
  },
  RunTest: function (day, callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    GetShortVolumeTableFilterGrowth(tableService, day, function (data) {
      data.forEach(function (obj) {
        console.log(obj)
      })
    })
  },
  RunDCF: function (day, callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    GetDCFTable(tableService, day, function (shorts, longs) {
      //getsectrs
      //get monthly
      console.log("LONGS-------")
      console.log(longs)
    })
  },
  RunOBV: function (day,day2, callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    GetOBVTable(tableService, day,day2, function (data) {
      callback(data)
    })

  },
  RunAlgo: function (day, callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    GetPickListTable(tableService, day, function (glongs, plongs, vlongs, shorts) {
      gStack = []
      pStack = []
      vStack = []

      shortStack = []

      var query = new azure.TableQuery()
        .where('PartitionKey eq ?', day);
      var filter = {}
      AzureStorage.GetDaily('StocksMonthlyGrowth', tableService, query,
        function (stockGrowth) {
          stockGrowth.forEach(function (x) {
            filter[objectValues(x.RowKey)] = objectValues(x.growth)
          })

          GetShortVolumeTableFilterGrowth(tableService, day, function (data) {
            data.forEach(function (obj) {

              glongs.forEach(function (x) {
                if (x == obj.symbol
                  && Number(filter[obj.symbol]) > 0
                ) {
                  //   console.log(obj.symbol+': '+Number(filter[obj.symbol]))
                  gStack.push(obj)
                }
              })
              plongs.forEach(function (x) {
                if (x == obj.symbol
                  && Number(filter[obj.symbol]) > -.2 && Number(filter[obj.symbol]) < 1
                ) {
                  //   console.log(obj.symbol+': '+Number(filter[obj.symbol]))
                  pStack.push(obj)
                }
              })
              vlongs.forEach(function (x) {
                if (x == obj.symbol) {
                  //   console.log(obj.symbol+': '+Number(filter[obj.symbol]))
                  vStack.push(obj)
                }
              })

              shorts.forEach(function (x) {
                if (x == obj.symbol
                  && Number(filter[obj.symbol]) > -.5
                ) {
                  //   console.log(obj.symbol+': '+Number(filter[obj.symbol]))
                  shortStack.push(obj)
                }
              })

            })
            console.log("vlongs: " + vlongs.length)
            console.log("shortStack: " + shortStack.length)
            console.log("plongs: " + plongs.length)
            console.log("glongs: " + glongs.length)
            var dictionary =
            {
              'Growth_Longs': glongs,
              'Pscore_Longs': plongs,
              'Value_Longs': vlongs,
              'Combined_Shorts': shortStack

            }
            var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
            for (var key in dictionary) {
              if (dictionary.hasOwnProperty(key)) {
                AzureStorage.StoreFactors(dictionary[key], key, day, fileService)
              }
            }
            var sortedGStack = gStack.sort(function (a, b) {
              return b.shortScore - a.shortScore
            })
            var sortedPStack = pStack.sort(function (a, b) {
              return b.shortScore - a.shortScore
            })
            var sortedVStack = vStack.sort(function (a, b) {
              return b.shortScore - a.shortScore
            })
            var sortedShortStack = shortStack.sort(function (a, b) {
              return a.shortScore - b.shortScore
            })
            var TopG = sortedGStack.slice(0, Math.round(gStack.length * .4))
            var MiddleG = sortedGStack.slice(Math.round(gStack.length * .4), Math.round(gStack.length * .7))
            var BottomG = sortedGStack.slice(Math.round(gStack.length * .7), Math.round(gStack.length))

            var TopP = sortedPStack.slice(0, Math.round(pStack.length * .4))
            var MiddleP = sortedPStack.slice(Math.round(pStack.length * .4), Math.round(pStack.length * .7))
            var BottomP = sortedPStack.slice(Math.round(pStack.length * .7), Math.round(pStack.length))

            var TopV = sortedVStack.slice(0, Math.round(vStack.length * .4))
            var MiddleV = sortedVStack.slice(Math.round(vStack.length * .4), Math.round(vStack.length * .7))
            var BottomV = sortedVStack.slice(Math.round(vStack.length * .7), Math.round(vStack.length))

            var TopShort = sortedShortStack.slice(0, Math.round(shortStack.length * .4))
            var MiddleShort = sortedShortStack.slice(Math.round(shortStack.length * .4), Math.round(shortStack.length * .7))
            var BottomShort = sortedShortStack.slice(Math.round(shortStack.length * .7), Math.round(shortStack.length))
            var longsCount = TopG.length + MiddleG.length + BottomG.length +
              TopP.length + MiddleP.length + BottomP.length +
              TopV.length + MiddleV.length + BottomV.length
            var shortCount = TopShort.length + MiddleShort.length + BottomShort.length
            LONGWEIGHTED = []
            SHORTWEIGTHED = []
            TopG.forEach(function (x) {
              LONGWEIGHTED.push({ 'symbol': [x.symbol], 'weight': 1.5 / longsCount })
            })
            MiddleG.forEach(function (x) {
              LONGWEIGHTED.push({ 'symbol': [x.symbol], 'weight': 1.00 / longsCount })
            })
            BottomG.forEach(function (x) {
              LONGWEIGHTED.push({ 'symbol': [x.symbol], 'weight': .5 / longsCount })
            })

            TopP.forEach(function (x) {
              LONGWEIGHTED.push({ 'symbol': [x.symbol], 'weight': 1.5 / longsCount })
            })
            MiddleP.forEach(function (x) {
              LONGWEIGHTED.push({ 'symbol': [x.symbol], 'weight': 1.00 / longsCount })
            })
            BottomP.forEach(function (x) {
              LONGWEIGHTED.push({ 'symbol': [x.symbol], 'weight': .5 / longsCount })
            })

            TopV.forEach(function (x) {
              LONGWEIGHTED.push({ 'symbol': [x.symbol], 'weight': 1.5 / longsCount })
            })
            MiddleV.forEach(function (x) {
              LONGWEIGHTED.push({ 'symbol': [x.symbol], 'weight': 1.00 / longsCount })
            })
            BottomV.forEach(function (x) {
              LONGWEIGHTED.push({ 'symbol': [x.symbol], 'weight': .5 / longsCount })
            })


            TopShort.forEach(function (x) {
              SHORTWEIGTHED.push({ 'symbol': [x.symbol], 'weight': -.5 / shortCount })
            })
            MiddleShort.forEach(function (x) {
              SHORTWEIGTHED.push({ 'symbol': [x.symbol], 'weight': -1.00 / shortCount })
            })
            BottomShort.forEach(function (x) {
              SHORTWEIGTHED.push({ 'symbol': [x.symbol], 'weight': -1.5 / shortCount })
            })

            //   console.log(LONGWEIGHTED)
            var MasterResult = []
            var longResult = [];
            var shortResult = [];

            LONGWEIGHTED.reduce(function (res, value) {
              if (!res[value.symbol]) {
                res[value.symbol] = { symbol: value.symbol, weight: 0 };
                longResult.push(res[value.symbol])
              }
              res[value.symbol].weight += value.weight;
              return res;
            }, {});


            SHORTWEIGTHED.reduce(function (res, value) {
              if (!res[value.symbol]) {
                res[value.symbol] = { symbol: value.symbol, weight: 0 };
                shortResult.push(res[value.symbol])
              }
              res[value.symbol].weight += value.weight;
              return res;
            }, {});
            longResult.forEach(function (x) {
              MasterResult.push({ 'symbol': x.symbol[0], 'weight': x.weight })
            })
            shortResult.forEach(function (x) {
              MasterResult.push({ 'symbol': x.symbol[0], 'weight': x.weight })
            })
            // console.log("long: ")
            // console.log(LONGWEIGHTED)
            // console.log("short: ")
            // console.log(SHORTWEIGTHED)
            shortDict = {}
            longDict = {}
            long = 0
            short = 0
            MasterResult.forEach(function (x) {
              if (x.weight < 0) {
                shortDict[x.symbol] = x.weight
                short += x.weight
              } else {
                longDict[x.symbol] = x.weight
                long += x.weight
              }
            })
            FullResult = []

            var shortSum = 0
            var longSum = 0
            var i = -1

            AzureStorage.GetDaily('SectorSharpe', tableService, query,
              function (sectorSharpe) {
                var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
                AzureStorage.GetEtfDictionary(fileService, function (dictionary) {
                  // console.log(sectorSharpe[0])
                  etfDict = {}
                  sectorRisk = {}
                  for (const [key, value] of Object.entries(sectorSharpe[0])) {
                    etfDict[key] = Object.values(value)
                  }
                  for (var key in dictionary) {
                    if (dictionary.hasOwnProperty(key)) {
                      if (etfDict[dictionary[key]] != undefined
                        && key != 'Gold'
                        && key != 'Market'
                        && key != 'Bonds') {
                        sectorRisk[key] = etfDict[dictionary[key]][0]
                      }

                    }
                  }
                  //  console.log(sectorRisk)
                  var items = Object.keys(sectorRisk).map(function (key) {
                    return [key, sectorRisk[key]];
                  });
                  var sectorScore = items.sort(function (first, second) {
                    return second[1] - first[1];
                  });
                  var shortRisk = (Object.values(sectorScore.slice(0, 4)))
                  var longRisk = sectorScore.slice(sectorScore.length - 4, sectorScore.length)
                  var sr = []
                  shortRisk.forEach(function (x) {
                    sr.push(x[0])
                  })
                  var lr = []
                  longRisk.forEach(function (x) {
                    lr.push(x[0])
                  })
                  // console.log(lr)
                  //console.log(sr)

                  var query2 = new azure.TableQuery()
                  AzureStorage.GetTable('PolygonCompany', tableService, query2, function (PolygonCompany) {
                    var holdem = []
                    var maybe = []
                    industry = {}
                    var noRisk = []
                    var noRiskObj = []

                    console.log("PolygonCompany: " + PolygonCompany.length)
                    PolygonCompany.forEach(function (x) {
                      if (x.sector != undefined && sr.includes(Object.values(x.sector)[0])) {

                        noRisk.push(Object.values(x.RowKey)[1])
                        noRiskObj.push([Object.values(x.RowKey)[1], -1])
                      }
                      else if (x.sector != undefined && lr.includes(Object.values(x.sector)[0])) {

                        noRisk.push(Object.values(x.RowKey)[1])
                        noRiskObj.push([Object.values(x.RowKey)[1], 1])
                      }
                      else {
                        noRisk.push(Object.values(x.RowKey)[1])
                        noRiskObj.push([Object.values(x.RowKey)[1], 0])


                      }


                    })
                    var cleanedMaster = []
                    var cleanShortSum = 0
                    var cleanLongSum = 0
                    MasterResult.forEach(function (obj) {
                      if (noRisk.includes(obj.symbol)) {
                        noRiskObj.forEach(function (riskObj) {
                          if (((obj.weight < 0 && riskObj[1] < 0) || (obj.weight > 0 && riskObj[1] > 0))
                            && riskObj[0] == obj.symbol) 
                            {
                            cleanedMaster.push(obj)

                          } else if (riskObj[0] == obj.symbol && riskObj[1] == 0) {
                            cleanedMaster.push(obj)
                            holdem.push(obj.symbol)

                          }
                        })

                      }
                      else {
                        cleanedMaster.push(obj)
                        maybe.push(obj.symbol)
                      }
                    })
                    results = []

                    var longSum = 0
                    var shortSum = 0
                    cleanedMaster.forEach(function (x) {
                      {
                        if (x.weight > 0) {

                          if (holdem.includes(x.symbol)&&x.symbol!="CTXS") {
                            results.push({ 'symbol': x.symbol, 'weight': x.weight })
                            cleanLongSum += x.weight
                          } else if (maybe.includes(x.symbol)&&x.symbol!="CTXS") {
                            results.push({ 'symbol': x.symbol, 'weight': x.weight / 2 })
                            cleanLongSum += x.weight / 2
                          }
                          else if(x.symbol!="CTXS"){
                            results.push({ 'symbol': x.symbol, 'weight': x.weight * 3 })
                            cleanLongSum += x.weight * 3
                          }

                        }
                        else {
                          if (holdem.includes(x.symbol)&&x.symbol!="CTXS") {
                            results.push({ 'symbol': x.symbol, 'weight': (x.weight) })
                            cleanShortSum += Math.abs(x.weight)
                          } else if (maybe.includes(x.symbol)&&x.symbol!="CTXS") {
                            results.push({ 'symbol': x.symbol, 'weight': x.weight / 2 })
                            cleanShortSum += x.weight / 2
                          }
                          else if (x.symbol!="CTXS") {
                            results.push({ 'symbol': x.symbol, 'weight': (x.weight) * 3 })
                            cleanShortSum += Math.abs(x.weight) * 3
                          }
                        }
                      }

                    })
                    var output = []
                    shortSum = 0
                    longSum = 0
                    results.forEach(function (x) {
                      if (x.weight > 0) {
                        output.push({ 'symbol': x.symbol, 'weight': (x.weight) / cleanLongSum })
                        longSum += x.weight / cleanLongSum
                      } else {
                        output.push({ 'symbol': x.symbol, 'weight': (x.weight) / cleanShortSum })
                        shortSum += (x.weight) / cleanShortSum
                      }
                    })

                    // console.log(output)
                    //console.log(output.length)
                    // console.log('shortSum: ' + shortSum)

                    callback(output.sort((a, b) => (a.weight > b.weight) ? 1 : -1))
                  })

                })
                //  throw 



              })
            // run sector filterings here 

            // console.log("sort count: "+ shortResult.length)
            //console.log("long count: "+longResult.length)

          })
        })
    })



  },
  RapidApi_Single: function () {
    Analyze.RapidApi_Single(function (data) {
      console.log(data)
    })
  },
  
  RunEtfWeekly: function () {
    AlphaVantageEtfRunner(60000, Analyze.RapidApi, 'SectorEtfWeekly', function () {
      console.log("RapidApi Done")
    })
  },

  RunStockWeekly: function () {
    AlphaVantageStockRunner(10000, Analyze.RapidApi, 'StocksWeekly', function () {
      console.log("RapidApi Done")
    })
  },
  GoogleByLetter: function () {
    googleBuilder(10000, GoogleTrendOld, 'GoogleTrendMonthly', function () {
      console.log("GoogleTrend Done!")
      // process.exit(1);                  
    })
  },
  GoogleTrend: function () {
    CsvBuilder(500, GoogleTrendOld, 'GoogleTrendMonthly', function () {
      console.log("GoogleTrend Done!")
    })
  },
  FinnhubCalendar: function (day) {
    FinnhubCalendar(day)
  },
  PreRun: function () {
    PrimeBuilder(1, Analyze.IEX, 'IEX', function () {//Splits

      //  PrimeBuilder(5000, WsjFilter,'WJS',  function(){//Splits

      console.log("DONE!")
      //   })
    })
  },
  SingleRun: function () {
  },

  RunTimeseries: function () {
    Fundamentals(function () {
      console.log("FUNDAMENTALS Done!")
      process.exit(1);
    })

  },
  RunGrowthIngest: function () {
    GrowthIngest(function () {
      console.log("GrowthIngest Done!")
      process.exit(1);
    })

  },
  RunCashFlowIngest: function () {
    CashFlowIngest(function () {
      console.log("CashFlowIngest Done!")
      process.exit(1);
    })

  },
  RunMetricsIngest: function () {
    MetricsIngest(function () {
      console.log("MetricsIngest Done!")
      process.exit(1);
    })

  },
  RunBalanceSheetIngest: function () {
    BalanceSheetIngest(function () {
      console.log("BalanceSheetIngest Done!")
      process.exit(1);
    })

  },
  RunIncomeIngest: function () {
    IncomeIngest(function () {
      console.log("IncomeIngest Done!")
      process.exit(1);
    })

  },
  Built_BetaSector_Report: function (callback) {
    var query1 = new azure.TableQuery()
    var query2 = new azure.TableQuery()
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    AzureStorage.GetTable('FinnhubListIEX', tableService, query1, function (FinnhubListIEX) {
      AzureStorage.GetTable('PolygonCompany', tableService, query2, function (PolygonCompany) {
        // console.log("PolygonCompany: "+PolygonCompany.length)
        // console.log("FinnhubListIEX: "+FinnhubListIEX.length)
        polygonArray = []
        polygonDict = {}
        finnhubDict = {}
        PolygonCompany.forEach(function (x) {

          if (x.sector == undefined) {
          }
          else {
            polygonArray.push(Object.values(x.RowKey)[1])
            polygonDict[Object.values(x.RowKey)[1]] = x.sector != undefined ? Object.values(x.sector)[0] : x
          }
        })
        FinnhubListIEX.forEach(function (x) {
          if (x.beta == undefined) {
          }
          else {

            finnhubDict[Object.values(x.RowKey)[1]] = x.beta != undefined ? Object.values(x.beta)[0] : Object.values(x.beta)

          }

        })
        /**
         * 
        
         */
        var data = []
        paca.getPositions()
          .then((portfolio) => {

            portfolio.forEach(function (x) {

              data.push({
                'symbol': x.symbol,
                'beta': finnhubDict[x.symbol],
                'sector': polygonDict[x.symbol],
                'marketValue': x.market_value
              })
            })
            callback(data)
          })

      })
    })
  },
 
  GetPicklist: function () {
    var query = new azure.TableQuery()
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    AzureStorage.GetTable('PickList', tableService, query, function (data) {
      console.log(data)
    })
  },

  FinalPicks: function () {
    LatestBuilder(200, Analyze.BBANDS, 'BBANDS', function () {
      LatestBuilder(200, Analyze.ATR, 'ATR', function () {//Splits
        LatestBuilder(5000, Analyze.NewsSentiment, 'NewsSentiment', function () {
          console.log("Done!")
        })
      })
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

function GetShortVolumeTableFilterGrowth(tableService, day, callback) {

  var list = []
  var filter = {}
  var query = new azure.TableQuery()
    .where('PartitionKey eq ?', day);
  AzureStorage.GetDaily('ShortVolume', tableService, query,
    function (shortVolume) {
      AzureStorage.GetDaily('StocksMonthlyGrowth', tableService, query,
        function (stockGrowth) {
          stockGrowth.forEach(function (x) {
            filter[objectValues(x.RowKey)] = objectValues(x.growth)
          })
          //  console.log(filter)
          shortVolume.forEach(function (item) {
            var growthscore = filter[objectValues(item.RowKey)]

            // comment out if statement when grwoth table not availablezzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
            if (Number(growthscore) < .5 && Number(growthscore) > -.5) {

              list.push({
                'symbol': objectValues(item.RowKey),
                'shortScore': objectValues(item.growthDiff)
              })
            }

          })
          console.log(list)
          callback(list)
        })

    }
  )

}
function GetRiskDaily(tableService, day, callback) {
  var list = []
  var query = new azure.TableQuery()
    .where('PartitionKey eq ?', day);
  AzureStorage.GetDaily('Risk', tableService, query,
    function (data) {
      data.forEach(function (data) {
        list.push({

          'XLB': objectValues(data.BasicMaterials),
          'XLY': objectValues(data.ConsumerCyclical),
          'XLP': objectValues(data.ConsumerDefensive),
          'XLE': objectValues(data.Energy),
          'XLF': objectValues(data.FinancialServices),
          'XLI': objectValues(data.Industrials),
          'XLK': objectValues(data.Technology),
          'XLU': objectValues(data.Utilities),
          'XLV': objectValues(data.Healthcare),
          'VOX': objectValues(data.Undefined),
          'VNQ': objectValues(data.RealEstate),
          'SPY': objectValues(data.Beta)
        })
      })
      callback(list)
    }
  )

}
function GetSectorSharpeDaily(tableService, day, callback) {
  var list = []
  var query = new azure.TableQuery()
    .where('PartitionKey eq ?', day);
  AzureStorage.GetDaily('SectorSharpe', tableService, query,
    function (data) {
      data.forEach(function (data) {
        list.push({
          'XLB': objectValues(data.XLB),
          'XLY': objectValues(data.XLY),
          'XLP': objectValues(data.XLP),
          'XLE': objectValues(data.XLE),
          'XLF': objectValues(data.XLF),
          'XLI': objectValues(data.XLI),
          'XLK': objectValues(data.XLK),
          'XLU': objectValues(data.XLU),
          'XLV': objectValues(data.XLV),
          'VOX': objectValues(data.VOX),
          'VNQ': objectValues(data.VNQ),
          'GLD': objectValues(data.GLD),
          'TLT': objectValues(data.TLT),
          'SPY': objectValues(data.SPY)
        })
      })

      callback(list)
    }
  )

}
function GetMacroTable(tableService, day, callback) {
  var list = []

  var query = new azure.TableQuery()
    .where('PartitionKey eq ?', day);
  AzureStorage.GetDaily('Macro', tableService, query,
    function (data) {
      data.forEach(function (data) {
        list.push({
          'presentPMI': objectValues(data.presentPMI),
          'pastPMI': objectValues(data.pastPMI),
          'vixAvg': objectValues(data.vixAvg)
        })
      })
      callback(list)
    }
  )

}

function discountedFuctureCashFlowsScore(company) {
  var years = 5
  var growth = (Number(objectValues(company.EpsGrowth)) + Number(objectValues(company.EpsGrowth_lastYear)) / 2)
  var total = 0
  var discount = .9
  var cashFlows =
    (Number(objectValues(company.GrossMargin_lastYear)) - Number(objectValues(company.GrossMargin))) *// Number(objectValues(company.OperatingCashFlow)) *
    (Number(objectValues(company.EpsGrowth)) + Number(objectValues(company.EpsGrowth_lastYear)) / 2) * discount

  for (years; years > 0; years--) {
    if (years < 2) {
      growth = growth / 2
    }
    total += cashFlows * Math.pow(1 + growth, years)
  }
  return total
}
function GetDCFTable(tableService, day, callback) {

  var query = new azure.TableQuery()
    .where('PartitionKey eq ?', day);
  var dcfLong = []
  var dcfShort = []
  //get sectors

  AzureStorage.GetDaily('PickList', tableService, query,
    function (data) {
      data.forEach(function (company) {
        var symbol = objectValues(company.RowKey)
        var dcfScore = discountedFuctureCashFlowsScore(company)
        var altmanFactor = altmanScore(company)
        if (dcfScore < 0) {//altmanFactor < .2 &&
          dcfShort.push(
            {
              'symbol': symbol,
              'dcfScore': dcfScore
            }
          )
        } else if (dcfScore > 0 && altmanFactor > 2) {
          dcfLong.push(
            {
              'symbol': symbol,
              'dcfScore': dcfScore
            }
          )
        }
      })
      //  console.log("LONG PIOTROSKI _________________ ")
      var sortedLongDcf = dcfLong.sort(function (a, b) {
        return a.dcfScore - b.dcfScore
      }).slice(0, dcfShort.length > 10 ? 10 : Math.round(dcfLong.length * .1))
      //  console.log("LONG PIOTROSKI _________________ ")
      var sortedShortDcf = dcfShort.sort(function (a, b) {
        return a.dcfScore - b.dcfScore
      }).slice(dcfShort.length > 5 ? dcfShort.length - 5 : Math.round(dcfShort.length * .5,), dcfShort.length)
      callback(sortedShortDcf, sortedLongDcf)
    })
}
function GetOBVTable(tableService, day, day2, callback) {
  console.log("GetOBVTable")
  var query = new azure.TableQuery()
    .where('PartitionKey le ?', day)
    .and('PartitionKey ge ?', day2)
    .and('bull ne ?', false);

  AzureStorage.GetDaily('OBV', tableService, query,
    function (data) {
      var dict = {}
      var array = []
      var sumscore = 0
      data.forEach(function (x) {
        var score = Object.values(x.score)[0]
        if (score > 0) {
          dict[Object.values(x.RowKey)[1]] = score
          sumscore += score
        }

      })
      for (var key in dict) {
        if (dict.hasOwnProperty(key)) {
          array.push({
            'symbol': key,
            'weight': dict[key] / sumscore
          })
        }
      }
      var sorted = array.sort(function (a, b) {
        return b.weight - a.weight
      })
      var sumscore = 0

      sorted.forEach(function (x) {
        sumscore += x.weight
      })
      sorted.forEach(function (x) {
        x.weight = x.weight / sumscore
      })
      var top = sorted.slice(0, 50)
     // console.log(data)
      callback(top)
    })
}
function GetPickListTable(tableService, day, callback) {
  console.log("GetPickListTable")
  var query = new azure.TableQuery()
    .where('PartitionKey eq ?', day);
  var piotroskiLong = []
  var piotroskiShort = []
  var growthLong = []
  var growthShort = []
  var valueLong = []
  var altmanShort = []
  AzureStorage.GetDaily('PickList', tableService, query,
    function (data) {
      data.forEach(function (company) {
        var symbol = objectValues(company.RowKey)
        var growthFactor = growthScore(company)
        var valueFactor = valueScore(company)
        var altmanFactor = altmanScore(company)
        var piotroskiFactor = piotroskiScore(company)
        var peDelta = peDeltaScore(company)
        if (altmanFactor < .5) {
          altmanShort.push(
            {
              'symbol': symbol,
              'altman': altmanFactor
            }
          )
        }//objectValues(company.EvEBITDA)) * (1/objectValues(company.DebtAssets
        if (objectValues(company.EvEBITDA) > 1 &&
          objectValues(company.EvEBITDA) < 12 &&
          objectValues(company.DebtAssets) < .6 &&
          altmanFactor > 1.7) {
          valueLong.push(
            {

              'symbol': symbol,
              'value': valueFactor,
              'invPeDelta': peDelta
            }
          )
        }
        if (growthFactor > 1) {
          growthLong.push(
            {

              'symbol': symbol,
              'growth': growthFactor,
              'invPeDelta': peDelta
            }
          )
        }
        if (growthFactor < -3) {
          growthShort.push(
            {

              'symbol': symbol,
              'growth': growthFactor,
              'invPeDelta': peDelta
            }
          )
        }
        if (piotroskiFactor >= 6 && altmanFactor > 3) {
          piotroskiLong.push(
            {
              'symbol': symbol,
              'piotroski': piotroskiFactor,
              'altman': altmanFactor,
              'invPeDelta': peDelta
            }
          )
        }
        if (piotroskiFactor <= 2 && altmanFactor < 1) {
          piotroskiShort.push(
            {

              'symbol': symbol,
              'piotroski': piotroskiFactor,
              'altman': altmanFactor,
              'invPeDelta': peDelta
            }
          )
        }

      })

      //  console.log("LONG PIOTROSKI _________________ ")
      var sortedLongPiotroski = piotroskiLong.sort(function (a, b) {
        return a.invPeDelta - b.invPeDelta
      }).slice(0, Math.round(piotroskiLong.length * .5))
      // console.log(sortedLongPiotroski)
      // console.log(sortedLongPiotroski.length)

      // console.log("SHORT PIOTROSKI _________________ ")
      var sortedShortPiotroski = piotroskiShort.sort(function (a, b) {
        return b.invPeDelta - a.invPeDelta
      }).slice(0, Math.round(piotroskiShort.length * .4))
      // console.log(sortedShortPiotroski)
      // console.log(sortedShortPiotroski.length)
      // console.log("LONG GROWTH _________________ ")
      var sortedLongGrowth = growthLong.sort(function (a, b) {
        return a.invPeDelta - b.invPeDelta
      }).slice(0, Math.round(growthLong.length * .5))
      // console.log(sortedLongGrowth)
      // console.log(sortedLongGrowth.length)
      // console.log("SHORT GROWTH _________________ ")
      var sortedShortGrowth = growthShort.sort(function (a, b) {
        return b.invPeDelta - a.invPeDelta
      }).slice(0, Math.round(growthShort.length * .2))
      // console.log(sortedShortGrowth)
      // console.log(sortedShortGrowth.length)
      // console.log("LONG VALUE _________________ ")
      var sortedLongValue = valueLong.sort(function (a, b) {
        return a.invPeDelta - b.invPeDelta
      }).slice(0, Math.round(valueLong.length * .3))
      // console.log(sortedLongValue)
      console.log("long value: " + sortedLongValue.length)
      console.log("piootroski long: " + sortedLongPiotroski.length)
      console.log("long growth" + sortedLongGrowth.length)
      console.log("short growth" + sortedShortGrowth.length)
      console.log("short piotrosky" + sortedShortPiotroski.length)
      // console.log("SHORT ALTMAN  _________________ ")
      // console.log(altmanShort)
      console.log("altman short: " + altmanShort.length)

      var plongs = []
      var vlongs = []
      var glongs = []
      var shorts = []
      sortedLongPiotroski.forEach(function (x) {
        plongs.push(x.symbol)
      })
      sortedLongValue.forEach(function (x) {
        vlongs.push(x.symbol)
      })
      sortedLongGrowth.forEach(function (x) {
        glongs.push(x.symbol)
      })
      altmanShort.forEach(function (x) {
        shorts.push(x.symbol)
      })
      sortedShortGrowth.forEach(function (x) {
        shorts.push(x.symbol)
      })
      sortedShortPiotroski.forEach(function (x) {
        shorts.push(x.symbol)
      })


      glongs.sort().forEach(function (x) {
        if (shorts.includes(x)) {
          shorts.splice(shorts.indexOf(x), 1)
          glongs.splice(glongs.indexOf(x), 1)
        }

      })
      vlongs.sort().forEach(function (x) {
        if (shorts.includes(x)) {
          shorts.splice(shorts.indexOf(x), 1)
          vlongs.splice(vlongs.indexOf(x), 1)
        }

      })
      plongs.sort().forEach(function (x) {
        if (shorts.includes(x)) {
          shorts.splice(shorts.indexOf(x), 1)
          plongs.splice(plongs.indexOf(x), 1)
        }

      })
      callback(glongs, plongs, vlongs, shorts)
    }
  )
}
function piotroskiScore(company) {
  var PositiveNetIncome = objectValues(company.NetIncome) > 0 ? 1 : 0;
  var PositiveReturnOnAssets = objectValues(company.NetIncome) / objectValues(company.TotalAssets) > 0 ? 1 : 0;
  var PositiveOperatingCashFlow = objectValues(company.OperatingCashFlow) > 0 ? 1 : 0;
  var CashFlowGreaterThanNetIncome = objectValues(company.OperatingCashFlow) > objectValues(company.NetIncome) > 0 ? 1 : 0;
  var LoweredRatioOfLongTermDebt = objectValues(company.LongTermDebtTotal) < objectValues(company.LongTermDebtTotal_lastYear) ? 1 : 0;
  var HigherCurrentRatio = objectValues(company.TotalCurrentAssets) > objectValues(company.TotalCurrentAssets) ? 1 : 0;
  var HigherGrossMargin = objectValues(company.GrossMargin) > objectValues(company.GrossMargin_lastYear) ? 1 : 0;
  var HigherAssetTurnover = objectValues(company.AssetTurnover) > objectValues(company.AssetTurnover_lastYear) ? 1 : 0;
  var piotroski = HigherAssetTurnover + HigherGrossMargin + HigherCurrentRatio + LoweredRatioOfLongTermDebt
    + CashFlowGreaterThanNetIncome + PositiveOperatingCashFlow + PositiveReturnOnAssets + PositiveNetIncome

  return piotroski
}
function altmanScore(company) {
  var A = Number(objectValues(company.TotalCurrentAssets) / objectValues(company.TotalCurrentLiabilities) / objectValues(company.TotalAssets)).toFixed(2)
  var B = Number(objectValues(company.RetainedEarnings) / objectValues(company.TotalAssets)).toFixed(2)
  var C = Number(objectValues(company.EBIT) / objectValues(company.TotalAssets)).toFixed(2)
  var D = Number(objectValues(company.MarketCap) / objectValues(company.TotalLiabilities)).toFixed(2)
  var E = Number(objectValues(company.EvSales) * objectValues(company.EvEBIT) * objectValues(company.EBIT) / objectValues(company.TotalAssets)).toFixed(2)
  var ZScore = Number(1.2 * A + 1.4 * B + 3.3 * C + 0.6 * D + 1.0 * E).toFixed(2)
  return Number(ZScore)
}
function valueScore(company) {
  return Number(Number((2 / objectValues(company.EvEBITDA)) * (1 / objectValues(company.DebtAssets))).toFixed(2))
}
function growthScore(company) {
  return Number(Number(objectValues(company.EpsGrowth)).toFixed(2))
}
function peDeltaScore(company) {
  var result = Math.abs(1 / ((objectValues(company.PeRatio) - objectValues(company.PeRatio_lastYear)) / objectValues(company.PeRatio_lastYear)))
  return Number(Number(result).toFixed(2))
}
function objectValues(metric) {

  var result = Object.values(metric != undefined && metric != null ? metric : {})[0] == 'Edm.Double' |
    Object.values(metric != undefined && metric != null ? metric : {})[0] == 'Edm.String' ?
    Object.values(metric != undefined && metric != null ? metric : {})[1] :
    Object.values(metric != undefined && metric != null ? metric : {})[0]
  return result
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
      //   console.log(data)
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
function f(eodList) {
  var CompanyProfileList = []
  eodList.forEach(function (symbol) {

    var companyProfile = logging.GetCompanyProfile(symbol)
    if (companyProfile != undefined || companyProfile != null != companyProfile != '') {
      CompanyProfileList.push(companyProfile)

    }
  })
  return CompanyProfileList;
}

function CallbackAPIPromise(array, functional, interval, callback) {

  for (var i = 0; i < array.length; i++) {
    (function (i) {
      setTimeout(function () {
        var got = functional(array[i]);
        got.then(function (data) {
          callback(data)
        })
      }, interval * i)
    }
    )(i)
  }
}
function unitOfWork(i, length, url, stocks, name) {
  download(url).then(data => {
    
    var jsonText = csvToJSON("_" + name, data, stocks[i])
    MongoDb.Upsert(name, stocks[i], jsonText)
  });
  console.log(name + ": " + i + "_" + stocks[i])
}
function Fundamentals(callback) {
  Stocklist.SymbolList1000(
    function (stocks) {
      var length = stocks.length;
      var interval = 10000;
      var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Income%20Statement&sort=desc";
            unitOfWork(i, length, url, stocks, "Income", fileService)
          }, interval * i);
        })(i);

        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Growth&sort=desc";
            unitOfWork(i, length, url, stocks, "Growth", fileService)
          }, interval * (i + length));
        })(i);

        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Metrics&sort=desc";
            unitOfWork(i, length, url, stocks, "Metrics", fileService)
          }, interval * (i + length * 2));
        })(i);

        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Balance%20Sheet&sort=desc";
            unitOfWork(i, length, url, stocks, "BalanceSheet", fileService)
          }, interval * (i + length * 3));
        })(i);

        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Cash%20Flow&sort=desc";
            unitOfWork(i, length, url, stocks, "CashFlow", fileService)
            if (i == length - 1) {
              callback()
            }
          }, interval * (i + length * 4));
        })(i);
      }
    })
}
function IncomeIngest(callback) {
  Stocklist.SymbolList('',
    function (stocks) {
      var length = stocks.length;
      var interval = 10000;
      var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Income%20Statement&sort=desc";
            unitOfWork(i, length, url, stocks, "Income", fileService)

            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);
      }
    })
}

function GrowthIngest(callback) {
  Stocklist.SymbolList('',
    function (stocks) {
      var length = stocks.length;
      var interval = 10000;

      for (var i = 0; i < length; i++) {


        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Growth&sort=desc";
            unitOfWork(i, length, url, stocks, "Growth")
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);
      }
    })
}

function MetricsIngest(callback) {
  Stocklist.SymbolList('',
    function (stocks) {
      var length = stocks.length;
      var interval = 10000;
      var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

      for (var i = 0; i < length; i++) {
        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Metrics&sort=desc";
            unitOfWork(i, length, url, stocks, "Metrics", fileService)

            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);
      }
    })
}
function BalanceSheetIngest(callback) {
  Stocklist.SymbolList('',
    function (stocks) {
      var length = stocks.length;
      var interval = 10000;
      var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

      for (var i = 0; i < length; i++) {
        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Balance%20Sheet&sort=desc";
            unitOfWork(i, length, url, stocks, "BalanceSheet", fileService)
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);
      }
    })
}
function CashFlowIngest(callback) {
  Stocklist.SymbolList('',
    function (stocks) {
      var length = stocks.length;
      var interval = 10000;
      var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

      for (var i = 0; i < length; i++) {
        (function (i) {
          setTimeout(function () {
            var url = "https://stockrow.com/api/companies/" + stocks[i] + "/financials.xlsx?dimension=Q&section=Cash%20Flow&sort=desc";
            unitOfWork(i, length, url, stocks, "CashFlow", fileService)
            if (i == length - 1) {
              callback()
            }
          }, interval * (i));
        })(i);
      }
    })
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
      //  console.log(err)
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
  //var name = ''
  ////var company = JSON.parse(logging.GetCompanyProfile(symbol))
  // if (company != undefined && company != null){
  //   name = company.name
  // }


  var run = new Promise(function (resolve, reject) {
    explorer//.searchProvider(SearchProviders.News)
      //.addKeyword(name)
      .addKeyword(symbol)
      .download().then(csv => {
        //console.log('[✔] Done, take a look at your beautiful CSV formatted data!')


        var title = csv.shift()

        //  title[1] = title[1].replace(': (Worldwide)','')
        //title[2] = title[2].replace(': (Worldwide)','')

        // csv.splice(0,0,title)
        console.log(csv)
        // console.log(csv)
        // console.log(csvToJSON("googletrend", csv, symbol))
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
      //    console.log(industry)

      industry = industry.substring(industry.indexOf("\n") + 1, industry.length).replace("Zacks Industry Rank", "").replace("         ", "")
      var industryRank = (industry.substring(industry.indexOf("(") + 1, industry.indexOf(")")).replace(" out of ", ",").split(','))
      industry = industry.split('\n')[0]
      var industryRanked = (industryRank[1] - industryRank[0]) / industryRank[1]
      // console.log(industryRanked)

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
function FinnhubHistorical() {
  var rate = 1000 //150 call rate per minute under standard subscription

  var funct = Analyze.FinnhubPeers;
  //     Builder(rate, funct ,funct.name,function(){  
  funct = Analyze.FinnhubEPSSuprise;
  Builder(rate, funct, funct.name, function () {
    console.log("Done")
  })
  //     })                                          



}
function FinnhubCalendar(days) {
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
          // console.log(x.date)
          // console.log(x.symbol)
          ipoArray.push(x)

        }

      })
    })
    //   console.log(ipoArray)
    ipoArray.forEach(function (x) {
      //Analyze.FinnhubIPOEarningsCalendar(x.symbol).then(pick=>{
      // var earnings = JSON.parse(pick)
      // Object.keys(earnings).forEach(function(key){
      //earnings[key].forEach(function(x){
      //         console.log(x)
      //       console.log("---------")
      //})
      //})

      //})
    })
    var symbolArray = []
    ipoArray.forEach(function (x) {
      if (true) {
        symbolArray.push(x.symbol)
        // console.log(x.symbol)
        //   console.log(x.date)
      }

    })
    console.log(symbolArray)
    console.log('length: ' + symbolArray.length)
  })

  //  array[0].forEach(function(x){
  //   var timestamp = new Date().getTime() 


  // date: '2019-12-06',
  // exchange: null,
  // name: 'Molecular Data Inc.',
  // numberOfShares: null,
  // price: null,
  // status: 'filed',
  // symbol: 'MKD',
  // totalSharesValue: 61870000
  var rate = 1000
  // var  funct = Analyze.FinnhubEarningsCalendar;
  //       Builder(rate, funct ,funct.name,function(){  
  //         funct = Analyze.FinnhubMajorDevelopment;
  //          Builder(rate, funct ,funct.name,function(){  
  //            console.log("Done")                                      
  //         })                                           
  //      }) 
}
function FinnhubHistoricalOld() {
  var rate = 1000 //150 call rate per minute under standard subscription

  var funct = Analyze.FinnhubEPSEstimate;
  Builder(rate, funct, funct.name, function () {
    funct = Analyze.FinnhubRevenueEstimate;
    Builder(rate, funct, funct.name, function () {
      funct = Analyze.FinnhubEPSSuprise;
      Builder(rate, funct, funct.name, function () {
        console.log("Done")
      })
    })
  })


}

function Finnhublatest() {
  var rate = 500
  var funct = Analyze.FinnNewsSentiment;
  Builder(rate, funct, funct.name, function () {
    funct = Analyze.FinnMajorDevelopment;
    Builder(rate, funct, funct.name, function () {
      funct = Analyze.FinnhubNews;
      Builder(rate, funct, funct.name, function () {
        funct = Analyze.FinnhubRecommendation;
        Builder(rate, funct, funct.name, function () {
          funct = Analyze.FinnhubPeers;
          Builder(rate, funct, funct.name, function () {
            funct = Analyze.FinnhubFundOwnership;
            Builder(rate, funct, funct.name, function () {
              funct = Analyze.FinnhubInvestorOwnership;
              Builder(rate, funct, funct.name, function () {
                console.log("Done")
              })
            })
          })
        })
      })
    })
  })
}
function millisToMinutesAndSeconds(millis) {
  var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}
function stocklist(callback) {
  var list = Analyze.FinnSymbolList(callback);

  list.then(data => callback(data))
}
function MasterDailySymbolsEOD(callback) {
  var root = './transform/'
  var path = './transform/EODHistory.txt'
  var path2 = 'EODarray.txt'
  if (fs.existsSync(path)) {
    //file exists
    fs.unlink(path, (err) => {
      if (err) throw err;
      console.log('path was deleted');
    })
  }
  // if (fs.existsSync(path2)) {
  //   //file exists
  //   fs.unlink(path2, (err) => {
  // if (err) throw err;
  // console.log('path2 was deleted');
  // });
  //   
  // }
  var time = 0//
  var start = Date.now()
  const directories = source => fs.readdirSync("./EOD", {
    withFileTypes: true
  }).reduce((a, c) => {
    c.isDirectory() && a.push(c.name)
    return a
  }, [])
  var EodHistory = []
  console.log("EodHistory starting . . .")
  directories().forEach(function (dir) {
    var annual = "./EOD/" + dir;
    fs.readdir(annual, function (err, files) {
      if (err) {
        console.error("Could not list the directory.", err);
      }

      files.forEach(function (file, index) {
        var lr = new LineByLineReader(annual + "/" + file);
        lr.on('line', function (line) {
          if (!line.includes("<")) {
            if (time != millisToMinutesAndSeconds(Date.now() - start)) {
              console.log(millisToMinutesAndSeconds(Date.now() - start))
              time = millisToMinutesAndSeconds(Date.now() - start)
            }

            //fs.appendFileSync(path, line+'\n', function (err) {
            //   if (err) throw err; 
            // });
            var dir = root + line.split(',')[0][0];
            //  if (!fs.existsSync(dir)){
            //    console.log(dir)
            //      fs.mkdirSync(dir, {recursive: true}, err => {});
            //    }
            fs.appendFileSync(dir + path2, line.split(',')[0] + '\n', function (err) {
              if (err) throw err;
            });


          }
        });
      })
    })
  })
}
function isTradeable(stock) {
  return stock.length < 5 && !stock.includes('-') && !stock.includes('.') && !stock.includes('^');
}

function StockRowPage(symbol) {
  var options = {
    uri: 'https://stockrow.com/' + symbol,
    transform: function (body) {
      // console.log(body)
      return cheerio.load(body);
    }
  };

  return rp(options)
    .then(function ($) {
      var industry = $('.company-header').text();
      console.log(industry)

      return JSON.stringify(industry);

    })
    .catch(function (err) {
      console.log(err)
    });

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
    // console.log(signal)
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
      //console.log("^^^^^^^^^^^^^^^^^^^^^^^")
      var opinion = $('.barchart-content-block .opinion-percent').text();
      var buySell = $('.barchart-content-block .opinion-signal').text();
      // console.log(buySell)
      //console.log(opinion)
      // console.log("^^^^^^^^^^^^^^^^^^^^^^^")

      var signal = $('.background-widget .clearfix').children().text();
      // console.log(signal)
      var wut = signal.match(/Buy|Sell|Hold/g);
      //  console.log("*************")
      //  console.log(wut)
      var numbers = signal.match(/\d+/g).map(Number);
      // console.log(numbers)
      // console.log("*************")
      // var overall = barchartBuysell(buySell,opinion)
      var yesterday = barchartBuysell(wut[0], numbers[0])
      var lastWeek = barchartBuysell(wut[1], numbers[1])
      var lastMonth = barchartBuysell(wut[2], numbers[2])
      var data = { "Overall": yesterday, "Yesterday": yesterday, "LastWeek": lastWeek, "LastMonth": lastMonth };


      //console.log(JSON.stringify(data))
      return JSON.stringify(data);


    })
    .catch(function (err) {
      console.log(err)
    });

}
async function  MongoIngestRunner(interval,universe, analyzer, name, callback) {
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
function TableIngestRunner(interval, analyzer,day, azureTableName,task, callback) {
  Stocklist.SymbolList('',
    function (stocks) {
      var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
   
      var length = stocks.length;
      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i],day).then(data => {
                var obj ={'symbol':stocks[i],
              'backtest Date':day}
              
                dataToAzureTableStorage(azureTableName, tableService, task(data,stocks[i],day))
              });
            } catch {
              var data = analyzer(stocks[i],day);
              dataToAzureTableStorage(azureTableName, tableService, task(data,stocks[i],day))
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
function AlphaVantageEtfRunner(interval, analyzer, name, callback) {
  var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
  AzureStorage.GetSectorEtfs(fileService,
    function (stocks) {
      var length = stocks.length;
      // var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
      for (var i = 0; i < length; i++) {

        (function (i) {
          setTimeout(function () {
            try {
              analyzer(stocks[i]).then(data => {
                //    console.log(data)
                MongoDb.Upsert(name, stocks[i], data)
                //    dataToAzureFileStorage(data,stocks[i],name,fileService)
              });
            } catch {
              var data = analyzer(stocks[i]);
              //   console.log(data)
              MongoDb.Upsert(name, stocks[i], data)
              //   dataToAzureFileStorage(data,stocks[i],name,fileService)  
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

function AlphaVantageStockRunner(interval,begin,end, analyzer, name,stock_time_series,output_size, callback) {
  var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
  Stocklist.SymbolList("",
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
            analyzer(stocks[i],stock_time_series,output_size).then(data => {

              var vals = Object.values(JSON.parse(data))[1]
              var keys = Object.keys(Object.values(JSON.parse(data))[1])
              var datalength = keys.length
              
              for (var j = 0; j < datalength; j++) {
                if (keys[j] < begin){
                  throw 'threw';
                  
                }
                if (keys[j] < end||end==''){
                (function (j) {
                  setTimeout(function () {
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
                    var obj  = {
                      'symbol':stocks[i],
                      'backtest Date': keys[j]
                    }
                    
                    
                    console.log(task)
                    AzureStorage.ToTable(name, tableService, task,obj,keys[j]);

                  }, 50 * (j))
                })(j)
              }
              }
            });
          } catch {
           // var data = analyzer(stocks[i]);
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
  // console.log(obj)
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
                dataToAzureTableStorage(name, tableService, task,data,i)
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
function AzureTableRunnerNonSeries(interval, analyzer, name, taskCallback, callback) {
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
function AzureTableRunnerForIEX(interval, analyzer, name, taskCallback, callback) {
  console.log(" inside AzureTableRunnerForEIX _________________")
  name = "FinnhubList" + name
  stocklist(function (data) {
    data = JSON.parse(data)
    data = jsonquery('[*type=EQS].symbol', { data: data }).value
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
            // console.log(data)
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

function CsvBuilder(interval, analyzer, name, callback) {
  console.log(" inside builder")
  var stocks = Stocklist.EODList();
  var length = stocks.length;

  for (var i = 0; i < length; i++) {
    mkdirp("Library/Research/" + stocks[i], function (err) {
      if (err) return console.log(er);
    });
    (function (i) {
      setTimeout(function () {
        try {
          analyzer(stocks[i]).then(data => {
            //  console.log(data)
            fs.writeFileSync("Library/Research/" + stocks[i] + "/" + stocks[i] + "_" + name + ".txt", data);
          });
        } catch {
          var data = analyzer(stocks[i]);
          // console.log(data)

          fs.writeFileSync("Library/Research/" + stocks[i] + "/" + stocks[i] + "_" + name + ".txt", data);
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
      // var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
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

function LatestBuilder(interval, analyzer, name, callback) {
  var stocks = Stocklist.Picks();
  var length = stocks.length;
  var fileService = azure.createFileService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

  for (var i = 0; i < length; i++) {
    mkdirp("Library/FinalPicks/" + stocks[i], function (err) {
      if (err) return console.log(er);
    });
    (function (i) {
      setTimeout(function () {
        try {
          analyzer(stocks[i]).then(data => {
            dataToAzureFileStorage(data, stock[i], name, fileService)
          });
        } catch {
          var data = analyzer(stocks[i]);
          var day = new Date().toJSON().slice(0, 7)
          dataToAzureFileStorage(data, stock[i], name, fileService)
        }
        console.log(name + ": " + i + "_" + stocks[i])
        if (i == length - 1) {
          callback()
        }
      }, interval * (i));
    })(i);

  }

}

function PrimeBuilder(interval, analyzer, name, callback) {
  //  logging.clearPrimeList() //### USE FIRST TIME FOR NEW LIST HACK
  console.log(" inside prime builder")
  var stocks = Stocklist.Prime();
  var length = stocks.length;
  stockList = [];
  for (var i = 0; i < length; i++) {

    (function (i) {
      setTimeout(function () {
        try {
          analyzer(stocks[i]).then(data => {
            if (name == "IEX") {
              data = JSON.parse(data)

              var employees
              if (data.peRatio > 4 &&
                data.marketcap > 15000000 &&
                data.employees > 20 &&
                data.day200MovingAvg > 5 &&
                data.day50MovingAvg > 5 &&
                data.avg30Volume > 5) {
                // console.log(data.marketcap)
                //       // console.log(data.peRatio)
                console.log(stocks[i])
                data.symbol = stocks[i]
                // stockList.push(JSON.stringify(data))
                logging.appendToPrimeList(JSON.stringify(data))
              }
            }
            if (name == "WJS") {


              //  var amount = JSON.parse(data).marketcap                      
              if (data > 0) {
                stockList.push(stocks[i])
              }
            }
          });
        } catch {
          var data = analyzer(stocks[i]);
          console.log(data)

        }

        if (i == length - 1) {
          console.log("------------------- IN IR ================")
          console.log(stockList.length)

          // logging.SetPrime(stockList);
          callback()
        }
      }, interval * (i));
    })(i);

  }

}
function Candles(obj) {

  var date = new Date();
  var minutes = date.getMinutes()
  if (Number(minutes) < 10) {
    minutes = '0' + minutes
  }
  console.log("current time: " + date.getHours() + ":" + minutes)
  var symbol = obj[0]
  var unixDay = obj[1]

  var lastDay = new Date(unixDay * 1000)


  firstDay = new Date(lastDay.getFullYear(), 0, 1)
  console.log(firstDay)
  lastDay = new Date(lastDay.getFullYear(), 11, 31)
  console.log(lastDay)
  lastDay = Math.floor(lastDay.getTime() / 1000)
  firstDay = Math.floor(firstDay.getTime() / 1000)

  return Analyze.Candles(symbol, 60, firstDay, lastDay)
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
