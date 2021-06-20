var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const fs = require('fs');
const pd = require('paralleldots');
const apiKey = 'QQ6XMgWUEbDyXmxIIcXXYpAi9vbk6jyE';
const alphaKey = '8LD1A47ZTI6P4Q4J'
const finnhubToken = 'bpr374frh5r8s3uv51ug';
const AYLIENTextAPI = require('aylien_textapi');
const iexToken = 'pk_2fa4dd5b39324e608cfd3904f3f6eaa3'
const textapi = new AYLIENTextAPI({
  application_id: "f69b3e1d",
  application_key: "348381f55fce2d3f80848ece644a9885"
});
module.exports = {
  ShortVolume: function (symbol) {
    var url = 'https://www.quandl.com/api/v3/datasets/FINRA/FNYX_' + symbol + '.json?api_key=gX1f8wse2g2dQjXmZ-dR';
    return ApiCall(url)
  },
  DailyShortVolume: function (symbol,endDate) {
    var day = new Date(endDate)
        var back = day.setDate(day.getDate() - 30)
        var startDate = new Date(back).toJSON().slice(0, 10)
    var url = 'https://www.quandl.com/api/v3/datasets/FINRA/FNYX_' + symbol + '?start_date='+startDate+'&end_date='+endDate+'&api_key=gX1f8wse2g2dQjXmZ-dR';
    return ApiCall(url)
  },




  
  stats: function (symbol) {
    var url = 'https://api.iextrading.com/1.0/stock/' + symbol + '/stats?token=' + iexToken;
    return ApiCall(url)
  },
  chart: function (symbol) {
    var url = 'https://api.iextrading.com/1.0/stock/' + symbol + '/chart?token=' + iexToken;
    return ApiCall(url)

  },
  news: function (symbol) {
    var url = 'https://api.iextrading.com/1.0/stock/' + symbol + '/news?token=' + iexToken;
    return ApiCall(url)
  },

  // candles and ticks
  Candles: function (symbol, resolution, from, to) {//hourly

    var url = 'https://finnhub.io/api/v1/stock/candle?symbol='
      + symbol + '&resolution=' + resolution + '&from=' + from + '&to=' + to + '&token=' + finnhubToken;
    var date = new Date(from * 1000)
    var year = date.getFullYear()
    var month = date.getMonth() + 1
    var day = date.getDate()
    var dateStamp = year + " to " + (year + 1)
    date = new Date()

    if (year == date.getFullYear()) {
      dateStamp = year + " to " + (date.toLocaleString('default', { month: 'short' }) + "" + date.getDate())
    }
    return ApiCallArgs(url, symbol, dateStamp)
  },
  FinnSymbolList: function () {
    var url = 'https://finnhub.io/api/v1/stock/symbol?exchange=US&token=' + finnhubToken;
    return ApiCall(url)
  },
  FinnCompanyProfile: function (symbol) {
    var url = 'https://finnhub.io/api/v1/stock/profile?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url)
  },
  // Macro Econ
  FinnTranscriptList: function (symbol) {
    var url = 'https://finnhub.io/api/v1/stock/transcripts/list?symbol=' + symbol + '&token=' + finnhubToken;
    console.log("transcripts list")
    return ApiCall(url)
  },
  FinnTranscriptCall: function (id) {
    var url = 'https://finnhub.io/api/v1/stock/transcripts?id=' + id + '&token=' + finnhubToken;
    console.log("transcripts call")
    return ApiCall(url)
  },


  // Macro Econ
  FinnEconCodes: function () {
    var url = 'https://finnhub.io/api/v1/economic/code?token=' + finnhubToken;
    return ApiCall(url)
  },
  FinnEconData: function (code) {
    var url = 'https://finnhub.io/api/v1/economic?code=' + code + '&token=' + finnhubToken;
    return ApiCall(url)
  },


  //news-sentiment
  FinnNewsSentiment: function (symbol) {
    var url = 'https://finnhub.io/api/v1/news-sentiment?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url)
  },
  FinnMajorDevelopment: function (symbol) {
    var url = 'https://finnhub.io/api/v1/major-development?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url)
  },
  FinnhubNews: function (symbol) {
    var url = 'https://finnhub.io/api/v1/news/' + symbol + '?token=' + finnhubToken;
    return ApiCall(url)
  },

  FinnhubRecommendation: function (symbol) {
    var url = 'https://finnhub.io/api/v1/stock/recommendation?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url)
  },
  FinnhubPeers: function (symbol) {
    var url = 'https://finnhub.io/api/v1/stock/peers?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url)
  },
  FinnhubFundOwnership: function (symbol) {
    var url = 'https://finnhub.io/api/v1/stock/fund-ownership?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url)
  },

  FinnhubInvestorOwnership: function (symbol) {
    var url = 'https://finnhub.io/api/v1/stock/investor-ownership?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url)
  },
  FinnhubRevenueEstimate: function (symbol) {
    var url = 'https://finnhub.io/api/v1/stock/revenue-estimate?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url)
  },
  FinnhubEPSSuprise: function (symbol) {
    var url = 'https://finnhub.io/api/v1/stock/earnings?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url) ///stock/earnings?sy
  },//
  FinnhubMajorDevelop: function (symbol) {
    var url = 'https://finnhub.io/api/v1/major-development?symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url)
  },
  FinnhubIPOEarningsCalendar: function (symbol) {
    var twoDaysAgo = buildDate(5)
    var tenDaysAgo = buildDate(50)
    var url = 'https://finnhub.io/api/v1/calendar/earnings?from=' + twoDaysAgo + '&to=' + tenDaysAgo + '&symbol=' + symbol + '&token=' + finnhubToken;
    console.log(url)
    return ApiCall(url) //calendar/earnings
  },
  FinnhubIpoCalendar: function (days) { // 2019-09-01&to=2020-06-30&
    var sixtyDaysAgo = buildDate(days - 50)
    var YearsAgo = buildDate(days)
    console.log(sixtyDaysAgo)
    console.log(YearsAgo)
    var url = 'https://finnhub.io/api/v1/calendar/ipo?from=' + YearsAgo + '&to=' + sixtyDaysAgo + '&token=' + finnhubToken;
    console.log(url)
    //url = 'https://finnhub.io/api/v1/calendar/ipo?from=2016-02-03&to=2020-04-15&token=bpr374frh5r8s3uv51ug'
    return ApiCall(url)
  },
  ///calendar/earnings?from=2010-01-01&to=2020-03-15&symbol=AAPL
  FinnhubEPSEstimate: function (symbol) {

    var url = 'https://finnhub.io/api/v1/stock/eps-estimate?from=2010-01-01&to=2020-03-15&symbol=' + symbol + '&token=' + finnhubToken;
    return ApiCall(url) ///stock/eps-estimate?
  },
  DowCOT: function () {
    var url = 'https://www.quandl.com/api/v3/datasets/CFTC/124603_FO_L_ALL.json?api_key=gX1f8wse2g2dQjXmZ-dR';
    return ApiCall(url)
  }, NasdaqCOT: function () {
    var url = 'https://www.quandl.com/api/v3/datasets/CFTC/209742_FO_L_ALL.json?api_key=gX1f8wse2g2dQjXmZ-dR';
    return ApiCall(url)
  }, BondsCOT: function () {
    var url = 'https://www.quandl.com/api/v3/datasets/CFTC/020601_FO_L_ALL.json?api_key=gX1f8wse2g2dQjXmZ-dR';
    return ApiCall(url)
  },
 
  VIXQuandl: function () {

    var url = 'https://www.quandl.com/api/v3/datasets/CHRIS/CBOE_VX1.json?api_key=gX1f8wse2g2dQjXmZ-dR';
    return ApiCall(url)
  },
  PMIQuandl: function () {
    var url = 'https://www.quandl.com/api/v3/datasets/ISM/MAN_PMI.json?api_key=gX1f8wse2g2dQjXmZ-dR';
    return ApiCall(url)
  },
  NewsSentiment: function (symbol) {
    var news = new Promise(function (resolve, reject) {
      var url = 'https://api.polygon.io/v1/meta/symbols/' + symbol + '/news?perpage=15&page=1&apiKey=' + apiKey;
      var xhttp = new XMLHttpRequest();
      var newsArray = [];
      xhttp.onreadystatechange = function () {

        if (this.readyState == 4 && this.status == 200) {

          var text = this.responseText.replace("'", "")
            .replace("(", "").replace(')', '')
            .replace("\'", "")

          //console.log(text)                      
          var news = JSON.parse(text)
          for (var i in news) {
            var timestamp = new Date(news[i].timestamp);
            var date = new Date();
            date.setMonth(date.getMonth() - 3);
            var entry = news[i].title.replace('"', '').replace("'", "").replace("\'", "").replace("(", "").replace(')', '')
            if (date < timestamp) {
              newsArray.push(entry);
            }
          }
          //console.log(newsArray)
          var twentydaysOfNews = newsArray.slice(0, 15);

          var newsResult = JSON.stringify(twentydaysOfNews).replace("'", "").replace("(", "").replace(')', '')

          var result = sentimentGetter(newsResult, function (result) {
            resolve(JSON.stringify(result));
          });



        }
      };
      xhttp.open("GET", url, false);
      xhttp.send();
    })
    return news.then(function (value) {

      return value;
    });
  },

  Deprecated: function (symbol) {
    // console.log("Analysis.")
    var callAnalysis = new Promise(function (resolve, reject) {

      var url2 = 'https://api.polygon.io/v1/meta/symbols/' + symbol + '/analysts?apiKey=' + apiKey;
      var xhttp2 = new XMLHttpRequest();
      xhttp2.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {

          resolve(this.responseText);
        }
      };
      xhttp2.open("GET", url2, false);
      xhttp2.send();

    })
    var sell = 0;
    var buy = 0;
    var keys = ["current", "month1", "month2", "month3"]
    var results = [0, 0, 0, 0]
    let stockQuote = callAnalysis.then(function (value) {

      var numAnalyst = JSON.parse(value).analysts;
      var change = JSON.parse(value).change;
      var updated = JSON.parse(value).updated;

      for (key in keys) {


        results[key] += -1 * JSON.parse(value).sell[keys[key]] / numAnalyst;
        results[key] += -2 * JSON.parse(value).strongSell[keys[key]] / numAnalyst;
        results[key] += JSON.parse(value).buy[keys[key]] / numAnalyst;
        results[key] += 2 * JSON.parse(value).strongBuy[keys[key]] / numAnalyst;

      }
      var delta = 'none'
      if (results[0] > (results[1] + results[2] + results[3]) / 3) {
        delta = 'hot'
      }
      if (results[0] < (results[1] + results[2] + results[3]) / 3) {
        delta = 'cold'
      }

      var q = new Date();
      var m = q.getMonth();
      var y = q.getFullYear();
      var date = new Date(y, q);
      mydate = new Date(updated);
      q = new Date();
      var mm = mydate.getMonth();
      var yy = mydate.getFullYear();
      var analysis = {
        Analysis: {
          avg: ((results[1] + results[2] + results[3] + results[0]) / 4).toFixed(2),
          weight: numAnalyst,
          change: change,
          signal: delta,

          "updated": (yy == y && !(1 - m > mm))
        }
      }


      return analysis;
    });
    return stockQuote.then(function (data) {
      return JSON.stringify(data)
    });
  },
  /////**********************END***************************/////////////////
  // 'https://cloud.iexapis.com/beta/stock/AAPL/stats?token=pk_2fa4dd5b39324e608cfd3904f3f6eaa3
  IEX: function (symbol) {
    var url = 'https://cloud.iexapis.com/beta/stock/' + symbol + '/stats?token=' + iexToken;
    return ApiCall(url)
  },
  ATR: function (symbol) {
    var url = 'https://www.alphavantage.co/query?function=ATR&symbol=' + symbol + '&interval=daily&time_period=14&apikey=' + alphaKey;
    return ApiCall(url)

  },
  BBANDS: function (symbol) {
    var url = 'https://www.alphavantage.co/query?function=BBANDS&symbol=' + symbol + '&interval=daily&time_period=5&series_type=close&nbdevup=3&nbdevdn=3&apikey=' + alphaKey;
    return ApiCall(url)

  },
  Weekly: function (symbol) {
    var url = 'https://api.polygon.io/v2/aggs/ticker/' + symbol + '/range/1/week/' + todaysDateDiff(12) + '/' + todaysDateDiff(0) + '?unadjusted=false&apikey=' + apiKey;
    return ApiCall(url)
  },
  Hourly: function (symbol) {
    var url = 'https://api.polygon.io/v2/aggs/ticker/' + symbol + '/range/1/hour/' + todaysDateDiff(1) + '/' + todaysDateDiff(0) + '?unadjusted=false&apikey=' + apiKey;
    return ApiCall(url)
  },
  Daily: function (symbol) {
    var url = 'https://api.polygon.io/v2/aggs/ticker/' + symbol + '/range/1/day/' + todaysDateDiff(6) + '/' + todaysDateDiff(0) + '?unadjusted=false&apikey=' + apiKey;
    return ApiCall(url)
  },

  Company: function (symbol) {
    console.log("inside COMPANY")
    var url = 'https://api.polygon.io/v1/meta/symbols/' + symbol + '/company?apiKey=' + apiKey;
    return ApiCall(url)
  },

  Analysis: function (symbol) {
    var url = 'https://api.polygon.io/v1/meta/symbols/' + symbol + '/analysts?apiKey=' + apiKey;
    return ApiCall(url)
  },
  Dividends: function (symbol) {
    var url = 'https://api.polygon.io/v1/meta/symbols/' + symbol + '/dividends?apiKey=' + apiKey;
    return ApiCall(url)
  },
  Splits: function (symbol) {
    var url = 'https://api.polygon.io/v1/meta/symbols/' + symbol + '/splits?apiKey=' + apiKey;
    return ApiCall(url)
  },
  Earnings: function (symbol) {
    var url = 'https://api.polygon.io/v1/meta/symbols/' + symbol + '/earnings?apiKey=' + apiKey;
    return ApiCall(url)
  },
  RapidApi: function (symbol,stock_time_series,output_size) {
    return RapidApi_Timeseries(symbol,stock_time_series,output_size)
  },
 
  RapidApi_Single: function(callback){
    RapidApi_Single(callback)
  }
}
function buildDate(daysback) {
  var d = new Date()
  d.setDate(d.getDate() - daysback);
  var month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2)
    month = '0' + month;
  if (day.length < 2)
    day = '0' + day;
  return [year, month, day].join('-')
}
function RapidApi_Timeseries(symbol,stock_time_series,output_size) {
  var run = new Promise(function (resolve, reject) {
    var http = require("https");
    var options = {
      "method": "GET",
      "hostname": "alpha-vantage.p.rapidapi.com",
      "port": null,
      "path": "/query?symbol=" + symbol + 
              "&datatype=json&function="+stock_time_series+"&outputsize="+output_size,
      "headers": {
        "x-rapidapi-host": "alpha-vantage.p.rapidapi.com",
        "x-rapidapi-key": "c25cb216f4mshf884e46c3c24667p11a0b9jsn557c1341ee0e",
        "useQueryString": true
      }
    };
    try {
      var req = http.request(options, function (res) {
        var chunks = [];
        var value = ''
        res.on("data", function (chunk) {
          chunks.push(chunk);
        });

        res.on("end", function () {
          var body = Buffer.concat(chunks);
          resolve(body.toString());
        });
      });
      req.end();
    } catch (ex) {
      console.log(ex)
    }

  })
  return run.then(function (value) {
    return value;
  });
}
function RapidApi_Single(callback) {
  var unirest = require("unirest");

var req = unirest("GET", "https://alpha-vantage.p.rapidapi.com/query");

req.query({
	"function": "SECTOR"
});

req.headers({
	"x-rapidapi-key": "c25cb216f4mshf884e46c3c24667p11a0b9jsn557c1341ee0e",
	"x-rapidapi-host": "alpha-vantage.p.rapidapi.com",
	"useQueryString": true
});


req.end(function (res) {
	if (res.error) throw new Error(res.error);

	callback(res.body);
});
}

function ApiCall(url) {
  var run = new Promise(function (resolve, reject) {
    //console.log(url)
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        //console.log(this.responseText)
        resolve(this.responseText);

      } else {
        console.log(this.responseText)
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  return run.then(function (value) {
    return value;
  });
}

function ApiCallArgs(url, symbol, date) {
  var run = new Promise(function (resolve, reject) {
    console.log(url)
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(this.responseText);
      }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
  })
  return run.then(function (value) {
    var obj = { 'symbol': symbol, 'date': date, 'data': value }
    return obj;
  });
}
/////**********************END***************************/////////////////

function sentimentGetter(newsResult, callback) {

  return textapi.sentiment({
    'text': newsResult.replace(/\[/g, '').replace(/\]/g, '').replace(/\"/g, '').replace(/\"/g, '').replace(/\\/g, ''),
    'mode': 'document'
  }, function (error, response) {
    if (error === null) {
      callback(response);
    }
  });
}
function getSentiment(newsResult, symbol) {

  return pd.sentimentBatch(newsResult, 'en')
    .then((response) => {

      // console.log(response)
      var sentiment = JSON.parse(response).sentiment;

      if (sentiment != null && sentiment != undefined) {
        var neg = 0;
        var pos = 0;
        var negative = 0;
        var positive = 0;
        var count = 0;
        if (sentiment.length > 0) {
          count = sentiment.length;
        }

        var signal = 'none';
        var alertCount = 0;
        var alert = 'none';
        sentiment.forEach(function (x) {
          neg += x.negative;
          pos += x.positive;
          if (x.negative > .5) {
            alertCount += 1;
          }

        });
        if (count > 0) {
          var firstPos = sentiment[0].positive;
          var firstNeg = sentiment[0].negative;
          if (count > 1) {
            var secondPos = sentiment[1].positive;
            var secondNeg = sentiment[1].negative;
          }
          negative = neg / sentiment.length;
          positive = pos / sentiment.length;
          if ((firstPos > positive || secondPos > positive) && firstPos > negative) {
            signal = 'hot'
          }
          if ((firstNeg > negative || secondNeg > negative) && firstNeg > positive) {
            signal = 'cold'
          }
          if (alertCount == 1 || alertCount > .1 * count) {
            alert = 'concern'
          }
          if (alertCount > .2 * count) {
            alert = 'avoid'
          }
        }

        var setAvg = {
          Sentiment: {
            avg: (positive + (-1 * negative)).toFixed(2),
            weight: count, signal: signal, alert: alert
          }
        };

        // console.log(response)
        return setAvg;
      }

    }).catch((error) => {
      console.log(error);
    })
}

function todaysDateDiff(diff) {
  var date = new Date();
  date.setMonth(date.getMonth() - diff)
  var dd = String(date.getDate()).padStart(2, '0');
  var mm = String(date.getMonth() + 1).padStart(2, '0'); //January is 0!
  var yyyy = date.getFullYear();
  return yyyy + '-' + mm + '-' + dd;
}

