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
    console.log(input+"Build OBV")
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
                    var isObvBull = twoDayobv>0 && twoDayobv > fiveDayobv && fiveDayobv > tenDayobv
                    var isObvBear = twoDayobv < 0 && (fiveDayobv < 0 || tenDayobv < 0) && (fiveDayobv < tenDayobv || twoDayobv < fiveDayobv)
                   
                   
                   
                    var obj = {

                        "symbol": symbol,
                        "tenDayobv": tenDayobv,
                        "fiveDayobv": fiveDayobv,
                        "twoDayobv": twoDayobv,
                        "score": (twoDayobv+fiveDayobv)/2,
                        "bull": isObvBull,
                        "bear": isObvBear,
                        "date": end
                    }
                    console.log(obj)
                    if(obj != undefined || obj.symbol != undefined){
                        AzureStorage.ToTable("OBV", tableService, obvDailyTask(obj));
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
        AzureStorage.ToTable("StocksDailyBacktester", tableService, StockDailyTask(data));
    })

}
async function Build_Stock_Weekly(date) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

    MongoDb.GetMongoStockWeekly(date, 'StocksWeekly', function (data) {
        AzureStorage.ToTable("StocksMonthlyGrowth", tableService, StockWeeklyTask(data));
    })

}
async function Build_Macro(date) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

    MongoDb.GetMongoSectorEtf(date, 'SectorEtfWeekly', function (data) {
        AzureStorage.ToTable("SectorSharpe", tableService, SectorEtfTask(data));
    })

    setTimeout(function () {
        MongoDb.GetMongoPMI(date, 'PMI', function (data) {
            AzureStorage.ToTable("Macro", tableService, PMITask(data));
        }), 2000
    })
    setTimeout(function () {
        MongoDb.GetMongoVIX(date, 'VIX', function (data) {
            AzureStorage.ToTable("Macro", tableService, VIXTask(data));
        }), 4000
    })

}
async function Transform_ShortVolume(date) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    MongoDb.GetMongoShortVolume(date, 'ShortVolume', function (data) {
        AzureStorage.ToTable("ShortVolume", tableService, ShortVolumeTask(data),data);
    })
}
async function DailyIngest_ShortVolume(date) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    Builder.TableIngestRunner(date,function(){
        console.log("done>>>>>>>>>>>>")
    })
}
async function Built_PickList(date) {

    try {

        var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);

        MongoDb.GetMongoFundamentals(date, 'Income',
            ['EBIT', 'Gross Margin'], function (data) {
                AzureStorage.ToTable("PickList", tableService, IncomeTask(data));
            })


        setTimeout(function () {
            MongoDb.GetMongoFundamentals(date, 'CashFlow',
                ['Operating Cash Flow', 'Net Income'], function (data) {
                    AzureStorage.ToTable("PickList", tableService, CashFlowTask(data));
                })
        }, 15000)

        setTimeout(function () {
            MongoDb.GetMongoFundamentals(date, 'Metrics',
                ['Asset Turnover', 'EV/Sales', 'EV/EBIT', 'EV/EBITDA', 'Market Cap', 'Debt/Assets', 'P/E ratio'], function (data) {
                    AzureStorage.ToTable("PickList", tableService, MetricsTask(data));
                })
        }, 30000)

        setTimeout(function () {
            MongoDb.GetMongoFundamentals(date, 'BalanceSheet',
                ['Retained Earnings', 'Total liabilities', 'Total Assets', 'Total current liabilities',
                    'Total current assets', 'Long Term Debt (Total)'], function (data) {
                        AzureStorage.ToTable("PickList", tableService, BalanceSheetTask(data));
                    })
        }, 45000)

        setTimeout(function () {
            MongoDb.GetMongoFundamentals(date, 'Growth',
                ['EPS Growth (diluted)'], function (data) {
                    AzureStorage.ToTable("PickList", tableService, GrowthTask(data));
                })
        }, 60000)
    } catch (err) {
        console.error(err);
    }
}
const _lastYear = '_lastYear'
const _lastYear_REPORT_DATE = '_lastYear_REPORT_DATE'
const _REPORT_DATE = '_REPORT_DATE'

function obvDailyTask(obj){
    var task = {
        PartitionKey: { '_': obj.date},
        RowKey: { '_': obj.symbol !=undefined?obj.symbol:'' },
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
function BalanceSheetTask(data) {
    //'Retained Earnings', 'Total liabilities', 'Total Assets', 'Total current liabilities',
    // 'Total current assets', 'Long Term Debt (Total)'
    var obj = JSON.parse(data)
    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj.symbol },
        RetainedEarnings: { '_': obj['Retained Earnings'] },
        RetainedEarnings_lastYear: { '_': obj['Retained Earnings' + _lastYear] },
        RetainedEarnings_lastYear_REPORT_DATE: { '_': obj['Retained Earnings' + _lastYear_REPORT_DATE] },
        RetainedEarnings_REPORT_DATE: { '_': obj['Retained Earnings' + _REPORT_DATE] },

        TotalLiabilities: { '_': obj['Total liabilities'] },
        TotalLiabilities_lastYear: { '_': obj['Total liabilities' + _lastYear] },
        TotalLiabilities_lastYear_REPORT_DATE: { '_': obj['Total liabilities' + _lastYear_REPORT_DATE] },
        TotalLiabilities_REPORT_DATE: { '_': obj['Total liabilities' + _REPORT_DATE] },

        TotalAssets: { '_': obj['Total Assets'] },
        TotalAssets_lastYear: { '_': obj['Total Assets' + _lastYear] },
        TotalAssets_lastYear_REPORT_DATE: { '_': obj['Total Assets' + _lastYear_REPORT_DATE] },
        TotalAssets_REPORT_DATE: { '_': obj['Total Assets' + _REPORT_DATE] },

        TotalCurrentLiabilities: { '_': obj['Total current liabilities'] },
        TotalCurrentLiabilities_lastYear: { '_': obj['Total current liabilities' + _lastYear] },
        TotalCurrentLiabilities_lastYear_REPORT_DATE: { '_': obj['Total current liabilities' + _lastYear_REPORT_DATE] },
        TotalCurrentLiabilities_REPORT_DATE: { '_': obj['Total current liabilities' + _REPORT_DATE] },

        TotalCurrentAssets: { '_': obj['Total current assets'] },
        TotalCurrentAssets_lastYear: { '_': obj['Total current assets' + _lastYear] },
        TotalCurrentAssets_lastYear_REPORT_DATE: { '_': obj['Total current assets' + _lastYear_REPORT_DATE] },
        TotalCurrentAssets_REPORT_DATE: { '_': obj['Total current assets' + _REPORT_DATE] },

        LongTermDebtTotal: { '_': obj['Long Term Debt (Total)'] },
        LongTermDebtTotal_lastYear: { '_': obj['Long Term Debt (Total)' + _lastYear] },
        LongTermDebtTotal_lastYear_REPORT_DATE: { '_': obj['Long Term Debt (Total)' + _lastYear_REPORT_DATE] },
        LongTermDebtTotal_REPORT_DATE: { '_': obj['Long Term Debt (Total)' + _REPORT_DATE] }
    };
    console.log(task)
    return task
}
function MetricsTask(data) {//'Asset Turnover', 'EV/Sales', 'EV/EBIT', 'EV/EBITDA', 'Market Cap', 'Debt/Assets', 'P/E ratio'
    var obj = JSON.parse(data)
    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj.symbol },

        AssetTurnover: { '_': obj['Asset Turnover'] },
        AssetTurnover_lastYear: { '_': obj['Asset Turnover' + _lastYear] },
        AssetTurnover_lastYear_REPORT_DATE: { '_': obj['Asset Turnover' + _lastYear_REPORT_DATE] },
        AssetTurnover_REPORT_DATE: { '_': obj['Asset Turnover' + _REPORT_DATE] },

        EvSales: { '_': obj['EV/Sales'] },
        EvSales_lastYear: { '_': obj['EV/Sales' + _lastYear] },
        EvSales_lastYear_REPORT_DATE: { '_': obj['EV/Sales' + _lastYear_REPORT_DATE] },
        EvSales_REPORT_DATE: { '_': obj['EV/Sales' + _REPORT_DATE] },

        EvEBIT: { '_': obj['EV/EBIT'] },
        EvEBIT_lastYear: { '_': obj['EV/EBIT' + _lastYear] },
        EvEBIT_lastYear_REPORT_DATE: { '_': obj['EV/EBIT' + _lastYear_REPORT_DATE] },
        EvEBIT_REPORT_DATE: { '_': obj['EV/EBIT' + _REPORT_DATE] },

        EvEBITDA: { '_': obj['EV/EBITDA'] },
        EvEBITDA_lastYear: { '_': obj['EV/EBITDA' + _lastYear] },
        EvEBITDA_lastYear_REPORT_DATE: { '_': obj['EV/EBITDA' + _lastYear_REPORT_DATE] },
        EvEBITDA_REPORT_DATE: { '_': obj['EV/EBITDA' + _REPORT_DATE] },

        MarketCap: { '_': obj['Market Cap'] },
        MarketCap_lastYear: { '_': obj['Market Cap' + _lastYear] },
        MarketCap_lastYear_REPORT_DATE: { '_': obj['Market Cap' + _lastYear_REPORT_DATE] },
        MarketCap_REPORT_DATE: { '_': obj['Market Cap' + _REPORT_DATE] },

        DebtAssets: { '_': obj['Debt/Assets'] },
        DebtAssets_lastYear: { '_': obj['Debt/Assets' + _lastYear] },
        DebtAssets_lastYear_REPORT_DATE: { '_': obj['Debt/Assets' + _lastYear_REPORT_DATE] },
        DebtAssets_REPORT_DATE: { '_': obj['Debt/Assets' + _REPORT_DATE] },

        PeRatio: { '_': obj['P/E ratio'] },
        PeRatio_lastYear: { '_': obj['P/E ratio' + _lastYear] },
        PeRatio_lastYear_REPORT_DATE: { '_': obj['P/E ratio' + _lastYear_REPORT_DATE] },
        PeRatio_REPORT_DATE: { '_': obj['P/E ratio' + _REPORT_DATE] }
    };
    console.log(task)
    return task
}
function CashFlowTask(data) { //'Operating Cash Flow', 'Net Income'
    var obj = JSON.parse(data)
    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj.symbol },

        OperatingCashFlow: { '_': obj['Operating Cash Flow'] },
        OperatingCashFlow_lastYear: { '_': obj['Operating Cash Flow' + _lastYear] },
        OperatingCashFlow_lastYear_REPORT_DATE: { '_': obj['Operating Cash Flow' + _lastYear_REPORT_DATE] },
        OperatingCashFlow_REPORT_DATE: { '_': obj['Operating Cash Flow' + _REPORT_DATE] },

        NetIncome: { '_': obj['Net Income'] },
        NetIncome_lastYear: { '_': obj['Net Income' + _lastYear] },
        NetIncome_lastYear_REPORT_DATE: { '_': obj['Net Income' + _lastYear_REPORT_DATE] },
        NetIncome_REPORT_DATE: { '_': obj['Net Income' + _REPORT_DATE] }
    };
    console.log(task)
    return task
}
function GrowthTask(data) {
    var obj = JSON.parse(data)
    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj.symbol },

        EpsGrowth: { '_': obj['EPS Growth (diluted)'] },
        EpsGrowth_lastYear: { '_': obj['EPS Growth (diluted)' + _lastYear] },
        EpsGrowthLastYear_lastYear_REPORT_DATE: { '_': obj['EPS Growth (diluted)' + _lastYear_REPORT_DATE] },
        EpsGrowth_REPORT_DATE: { '_': obj['EPS Growth (diluted)' + _REPORT_DATE] }
    };
    console.log(task)
    return task
}

function IncomeTask(data) {
    var obj = JSON.parse(data)
    var task = {
        PartitionKey: { '_': obj["backtest Date"] },
        RowKey: { '_': obj.symbol },

        GrossMargin: { '_': obj['Gross Margin'] },
        GrossMargin_lastYear: { '_': obj['Gross Margin' + _lastYear] },
        GrossMargin_lastYear_REPORT_DATE: { '_': obj['Gross Margin' + _lastYear_REPORT_DATE] },
        GrossMargin_REPORT_DATE: { '_': obj['Gross Margin' + _REPORT_DATE] },

        EBIT: { '_': obj['EBIT'] },
        EBIT_lastYear: { '_': obj['EBIT' + _lastYear] },
        EBIT_lastYear_REPORT_DATE: { '_': obj['EBIT' + _lastYear_REPORT_DATE] },
        EBIT_REPORT_DATE: { '_': obj['EBIT' + _REPORT_DATE] }
    };
    console.log(task)
    return task
}
module.exports = {
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
    DailyIngest_ShortVolume: function (daysback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        DailyIngest_ShortVolume(day)
    },
    Built_PickList: function (daysback) {
        var day = new Date(daysback).toJSON().slice(0, 10)
        Built_PickList(day)

    }

}
