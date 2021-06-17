var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var AzureStorage = require('./AzureStorage');
const logging = require('./logging');
var azure = require('azure-storage');
const AzureSecrets = require('./Secrets/Azure').Secrets()
const Analyze = require('./Analyze');
const Stocklist = require('./Stocklist');
const MongoDb = require('./MongoDb.js')
const Builder = require('./Builder');
var jsonquery = require('json-query')
const mkdirp = require('mkdirp');
const colors = require('colors/safe');
const fs = require('fs');
const { callbackify } = require("util");

async function BuildOBV(input) {
    console.log(input + "Build OBV")
    var dateObj = new Date()
    var end = dateObj.setDate(dateObj.getDate() - input)
    var begin = dateObj.setDate((new Date(end)).getDate() - 20)
    begin = new Date(begin).toJSON().slice(0, 10)
    end = new Date(end).toJSON().slice(0, 10)
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);


    var query = new azure.TableQuery()
        .where("PartitionKey ge ?", begin)
        .and("PartitionKey le ?", end)
    AzureStorage.GetTable('StocksDailyBacktester', tableService, query, function (result) {
        Stocklist.SymbolList1000(
            function (stocks) {
                stocks.forEach(function (symbol) {
                    var data = result.filter(obj => {
                        return Object.values(obj.RowKey)[1] == symbol
                    })

                    var tenDayobv = 0
                    var fiveDayobv = 0
                    var twoDayobv = 0
                    var sumVol = 0
                    var length = data.length - 1
                    for (var i = length; i > length - 10; i--) {

                        if (data[i] != undefined) {

                            sumVol += Object.values(data[i].volume)[0]


                            if (0 < (Object.values(data[i].close)[0] - Object.values(data[i].open)[0])) {
                                tenDayobv += Object.values(data[i].volume)[0]
                                if (i < 5) {
                                    twoDayobv += Object.values(data[i].volume)[0]
                                }
                                if (i < 8) {
                                    fiveDayobv += Object.values(data[i].volume)[0]
                                }
                            } else {
                                tenDayobv -= Object.values(data[i].volume)[0]
                                if (i < 5) {
                                    twoDayobv -= Object.values(data[i].volume)[0]
                                }
                                if (i < 8) {
                                    fiveDayobv -= Object.values(data[i].volume)[0]
                                }
                            }
                        }


                    }
                    var avgVol = sumVol / length
                    tenDayobv = tenDayobv / avgVol / length
                    fiveDayobv = fiveDayobv / avgVol / 7
                    twoDayobv = twoDayobv / avgVol / 4
                    var isObvBull = twoDayobv > 0 && twoDayobv > fiveDayobv && fiveDayobv > tenDayobv
                    var isObvBear = twoDayobv < 0 && (fiveDayobv < 0 || tenDayobv < 0) && (fiveDayobv < tenDayobv || twoDayobv < fiveDayobv)



                    var obj = {

                        "symbol": symbol,
                        "tenDayobv": tenDayobv,
                        "fiveDayobv": fiveDayobv,
                        "twoDayobv": twoDayobv,
                        "score": (twoDayobv + fiveDayobv) / 2,
                        "bull": isObvBull,
                        "bear": isObvBear,
                        "date": end
                    }
                    console.log(obj)
                    if (obj != undefined || obj.symbol != undefined) {
                        AzureStorage.ToTable("OBV", tableService, obvDailyTask(obj),'');
                    }

                })

            })

    })

}

async function BacktestResults(date, callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

    var query = new azure.TableQuery()
        .where('PartitionKey eq ?', date);
    AzureStorage.GetTable('StocksDailyBacktester', tableService, query, function (data) {

        var filePath = __dirname + "\\full-equities-backtest.csv";//equities-backtest.csv

        var backtest = fs.readFileSync(filePath, 'utf8')
        var boom = backtest.split('\n')
        var yay = []

        boom.forEach(function (x) {
            var push = x.replace('\r', '').split(',')
            if (push[2] != undefined && push[2].slice(0, 10) == date) {
                // console.log(push)
                yay.push(push)
            }

        })
        var returns = 0

        yay.forEach(function (ea) {
            //  console.log(ea)
            var dayReturn = 0
            data.forEach(element => {
                var weight = Number(ea[1]).toFixed(3)
                if (ea[0] == Object.values(element.RowKey)[1]) {//
                    var open = Number(Object.values(element.open)[0]).toFixed(2)
                    var close = Number(Object.values(element.close)[0]).toFixed(2)
                    var diff = Number((close - open) / open).toFixed(2)

                    var sym = ea[0]
                    var space = ''
                    var spaces = ''
                    if (sym.length == 3) {
                        spaces = ' '
                    } else if (sym.length == 2) {
                        spaces = '  '
                    } else if (sym.length == 1) {
                        spaces = '   '
                    }
                    if (sum < 0) {
                        spaces = spaces.slice(0, -3)
                    } else {
                        space = spaces//.slice(0,-3)
                    }

                    var sum = Number(Number(weight) * Number(diff))//.toFixed(4)
                    var percent = (sum * 100).toFixed(2)
                    console.log(space + colors.yellow(sym) + ': ' + (Number(sum) > 0 ? colors.green(' ' + percent + '%') : colors.red('-' + Math.abs(percent) + '%')) + (Math.abs(percent).toString().length == 1 ? '   ' : '') + ' O: ' + colors.blue(open) + ' C: ' + colors.blue(close) + ' W: ' + colors.blue(weight))

                    dayReturn += sum
                    return
                }

            });
            returns += dayReturn
        })
        console.log(date)
        console.log(colors.bold('Daily: ' + (returns * 100).toFixed(2) + '%'))
        callback((returns * 100).toFixed(4))

    })

}
async function Build_Stock_Daily(date) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

    MongoDb.GetMongoStockDaily(date, 'StocksDaily', function (data) {
        AzureStorage.ToTable("StocksDailyBacktester", tableService, StockDailyTask(data),'');
    })

}
async function Build_Stock_Weekly(date) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    
    MongoDb.GetMongoStockWeekly(date, 'StocksWeekly', function (data) {
        AzureStorage.ToTable("StocksMonthlyGrowth", tableService, StockWeeklyTask(data),'');
    })

}
async function Build_Macro(date) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

    MongoDb.GetMongoSectorEtf(date, 'SectorEtfWeekly', function (data) {
        AzureStorage.ToTable("SectorSharpe", tableService, SectorEtfTask(data),'');
    })

    setTimeout(function () {
        MongoDb.GetMongoPMI(date, 'PMI', function (data) {
            AzureStorage.ToTable("Macro", tableService, PMITask(data),'');
        }), 2000
    })
    setTimeout(function () {
        MongoDb.GetMongoVIX(date, 'VIX', function (data) {
            AzureStorage.ToTable("Macro", tableService, VIXTask(data),'');
        }), 4000
    })

}
async function Transform_DailyOhlcv(date) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    MongoDb.GetMongoStockDaily(date, 'StocksDaily', function (data) {
        AzureStorage.ToTable("StocksDailyBacktester", tableService, StockDailyTask(data),'');
    })
}
async function Transform_ShortVolume(date) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    MongoDb.GetMongoShortVolume(date, 'ShortVolume', function (data) {
        AzureStorage.ToTable("ShortVolume", tableService, ShortVolumeTask(data),'');
    })
}
async function DailyIngest_ShortVolume(endDate, task) {
    Builder.TableIngestRunner(3000, Analyze.DailyShortVolume, 'ShortVolume', task, endDate, function () {
        console.log("done>>>>>>>>>>>>")
    })
}
const FundamentalsFeatures = {
    'Income': ['Income%20Statement', ['Income from Continuous Operations','SG&A Expenses','EBIT','Net Profit Margin', 'Gross Margin','Revenue','Cost of Revenue','R&D Expenses']],
    'CashFlow': ['Cash%20Flow', ['Operating Cash Flow','Depreciation & Amortization','Operating Cash Flow', 'Net Income','Financing cash flow']],
    'Metrics': ['Metrics', ['Free Cash Flow','Working Capital','Graham Net Nets','Operating CF/Net income','Enterprise Value','Asset Turnover', 'EV/Sales', 'EV/EBIT', 'EV/EBITDA', 'Market Cap', 'Debt/Assets', 'P/E ratio','Enterprise Value']],
    'BalanceSheet': ['Balance%20Sheet', ['Total Debt','Receivables','Retained Earnings', 'Total liabilities', 'Total Assets', 'Total current liabilities',
        'Total current assets', 'Long Term Debt (Total)','Property, Plant, Equpment (Net)']],
    'Growth': ['Growth', ['EPS Growth (diluted)','Net Income Growth']]
}

async function Transform_PickList_From_Mongo(date,factor) {
    try {
        var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
        var features = Object.values(FundamentalsFeatures[factor])[1]
            MongoDb.GetMongoFundamentals(date, factor,
                features, function (data) {
                        AzureStorage.ToTable("PickList5000", tableService, GenericTask(data),factor);
                        console.log(factor)
                })  
    } catch (err) {
        console.error(err);
    }
}

const _lastYear = '_lastYear'
const _lastYear_REPORT_DATE = '_lastYear_REPORT_DATE'
const _REPORT_DATE = '_REPORT_DATE'

function obvDailyTask(obj) {
    var task = {
        PartitionKey: { '_': obj.date },
        RowKey: { '_': obj.symbol != undefined ? obj.symbol : '' },
        tenDayobv: { '_': obj.tenDayobv },
        fiveDayobv: { '_': obj.fiveDayobv },
        twoDayobv: { '_': obj.twoDayobv },
        score: { '_': obj.score },
        bull: { '_': obj.bull },
        bear: { '_': obj.bear }
    };
    console.log(obj)
    return task
}
function StockDailyTask(obj) {

    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj.symbol },
        open: { '_': obj.open },
        high: { '_': obj.high },
        low: { '_': obj.low },
        close: { '_': obj.close },
        adjustedClose: { '_': obj.adjustedClose },
        volume: { '_': obj.volume }
    };
    console.log(obj)
    return task
}
function StockWeeklyTask(obj) {

    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj.symbol },
        growth: { '_': obj.growth },
        direction: { '_': obj.direction }
    };
    console.log(task)
    return task
}
function SectorEtfTask(obj) {
    var task = {

        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj["backtest Date"] },
        VOX: { '_': obj.VOX },
        XLB: { '_': obj.XLB },
        XLY: { '_': obj.XLY },
        XLP: { '_': obj.XLP },
        XLE: { '_': obj.XLE },
        XLF: { '_': obj.XLF },
        XLV: { '_': obj.XLV },
        XLI: { '_': obj.XLI },
        XLV: { '_': obj.XLV },
        VNQ: { '_': obj.VNQ },
        XLK: { '_': obj.XLK },
        XLU: { '_': obj.XLU },
        GLD: { '_': obj.GLD },
        TLT: { '_': obj.TLT },
        SPY: { '_': obj.SPY },
    };
    console.log(task)
    return task
}
function PMITask(obj) {

    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj["backtest Date"] },
        presentDate: { '_': obj.presentDate },
        presentPMI: { '_': obj.presentPmi },
        lastdate: { '_': obj.lastDate },
        pastPMI: { '_': obj.lastPmi }
    };
    console.log(task)
    return task
}

function VIXTask(obj) {

    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj["backtest Date"] },
        vixDay: { '_': obj.vixDay },
        vixAvg: { '_': obj.vixAvg },
        vixChange: { '_': obj.vixChange }
    };
    console.log(task)
    return task
}
function ShortVolumeTask(obj) {

    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj.symbol },
        shortWeekAvg: { '_': obj.shortWeekAvg },
        shortDay: { '_': obj.shortDay },
        growthDiff: { '_': obj.growthDiff }
    };
    console.log(task)
    return task
}


function GenericTask(data) {
    var obj = JSON.parse(data)
    
    var jsonString = ''
    for (const [k, v] of Object.entries(obj)) {
        var value = typeof v === 'number' ? '{ "_":' + v + '},' : '{ "_":"' + v + '"},'
        var key = k;
        if (key == 'symbol') {
            key = 'RowKey'
        }
        if (key == 'backtest Date') {
            key = 'PartitionKey'
        }
        jsonString += '"' + key + '":' + value
    }

    var task = JSON.parse('{' + (jsonString.substring(0, jsonString.length - 1)) + '}')
    console.log(task)
    return task
}
module.exports = {

    Transform_Growth_PickList: function (daysback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        Transform_Growth_PickList(day)

    },
    Transform_Income_PickList: function (daysback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        Transform_Income_PickList(day)

    },
    Transform_Metrics_PickList: function (daysback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        Transform_Metrics_PickList(day)

    },
    BuildOBV: function (input) {

        BuildOBV(input)


    },
    BacktestResults: function (daysback, callback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        BacktestResults(day, callback)
    },
    Build_Stock_Daily: function (daysback) {

        var day = new Date(daysback).toJSON().slice(0, 10)
        Build_Stock_Daily(day)
    },
    Build_Stock_Weekly: function (daysback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
       
        Build_Stock_Weekly(day)
    },
    Build_Macro: function (daysback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        Build_Macro(day)
    },
    TransformShortVolume: function (daysback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        Transform_ShortVolume(day)
    },
    TransformDailyOhlcv: function (daysback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        Transform_DailyOhlcv(day)
    },
    DailyIngest_ShortVolume: function (day, task) {
        DailyIngest_ShortVolume(day, task)
    },
    Transform_Factor_PickList: function (daysback,factor) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        Transform_PickList_From_Mongo(day,factor)

    }
}
