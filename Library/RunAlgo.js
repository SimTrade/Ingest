
'use strict'

const FACTOR = 1// 1// opening //.92
const shoreUp = 1 //1 //.99//opening .85
const Builder = require('./Builder');
const Analyze = require('./Analyze');
var json2csv = require('json2csv').parse;
const alpaca = require('./Secrets/AlpacaCreds').getCreds();

// Be sure to set your API key
const minimist = require('minimist')
/**
 *  
 */
const metric = Object.freeze({
    'Date': 0,
    'Open Interest': 1,
    'Noncommercial Long': 2,
    'Noncommercial Short': 3,
    'Noncommercial Spreads': 4,
    'Commercial Long': 5,
    'Commercial Short': 6,
    'Total Long': 7,
    'Total Short': 8,
    'Nonreportable Positions Long': 9,
    'Nonreportable Positions Short': 10
})
module.exports = {
    writecsvRow(symbol, weight, day,file,columns){
        writecsvRow(symbol, weight, day,file,columns)
    },
    CotTableBuilder: function (num) {
        var i = Number(num)
        Analyze.NasdaqCOT().then(obj => {
            var recent = JSON.parse(obj).dataset.data[0+i]
            var nasdaqScore =  transformCOT(obj,i)

            Analyze.DowCOT().then(obj => {
                var dowScore =  transformCOT(obj,i)
                
                Analyze.BondsCOT().then(obj => {
                    var bondScore = transformCOT(obj,i)
                    var sumScore = Math.abs(nasdaqScore) + Math.abs(dowScore) + Math.abs(bondScore)
                    console.log(recent[metric['Date']])
                    Builder.COtToAzureTableStorage(recent[metric['Date']], nasdaqScore,dowScore,bondScore) 
                });
            });
        });
        
        

    },
    DCFalgo: function(day,trade){
        Builder.RunDCF(day, function (data){})
    },
    SectorHedge: function (day, trade) {
        console.log("what fuckin day!!!!!!!!!!!!!! " + day)
        var factor = 1 - FACTOR
        alpaca.getPositions()
            .then((portfolio) => {
                alpaca.getAccount()
                    .then((account) => {

                        var portfolioSymbols = []
                        var portfolioSharesDictionary = {}
                        portfolio.forEach(function (x) {
                            portfolioSymbols.push(x.symbol)
                            portfolioSharesDictionary[x.symbol] = x.qty
                        })

                        Builder.GetMacroTable(day, function (macro) {
                            if (!(macro[0] == undefined)) { //grossly handles non-trading days

                                var VIX = macro[0].vixAvg
                                var VIXchange = macro[0].vixChange
                                var PMI = macro[0].presentPMI

                                Builder.GetSectorSharpeDaily(day, function (sharpe) {

                                    var spySharpe = sharpe[0].SPY
                                    var etfs = Object.keys(sharpe[0])
                                    etfs.push('QQQ')
                                    etfs.push('TLT')
                                    etfs.push('GLD')
                                    etfs.push('UPRO')
                                    etfs.push('VIXY')
                                    etfs.push('BIL')

                                    
                                    var hold = {}
                                    Builder.GetRiskDaily(day, function (risk) {
                                        // delete sharpe[0]['SPY']
                                        // delete sharpe[0]['TLT']
                                        // delete sharpe[0]['GLD']
                                        var items = Object.keys(sharpe[0]).map(function (key) { return [key, sharpe[0][key]]; });
                                        // console.log(sharpe[0])
                                        items.sort(function (first, second) { return second[1] - first[1]; });
                                        var longpicks = items.slice(0, 3)
                                        //  console.log(longpicks)
                                        var shortpicks = items.slice(items.length - 2, items.length)
                                        console.log("------RISK---------")

                                        var beta = risk[0] != undefined ? risk[0].SPY : 0
                                        if (VIX < 30 && (VIXchange < 0 || VIX < 25)) {
                                            if (PMI > 50) {
                                                if (beta <= 0) {
                                                    hold['QQQ'] = Math.abs(.3 - beta)
                                                    hold['UPRO'] = Math.abs(.3 - beta)
                                                }

                                            } else {
                                                hold['VIXY'] = .7
                                                hold['BIL'] = 1
                                            }
                                            longpicks.forEach(function (x) {
                                                if (risk[0] != undefined) {
                                                    hold[x[0]] = .25 - (risk[0][x[0]] != undefined ? risk[0][x[0]] : 0)
                                                }

                                            })




                                        } else if (VIX < 40) {
                                            if (beta < .2) {
                                                hold['SPY'] = 1
                                                hold['TLT'] = .7
                                                hold['GLD'] = .7
                                            }
                                            else {
                                                hold['TLT'] = 1
                                                hold['GLD'] = 1
                                            }
                                        }
                                        else {
                                            hold['GLD'] = .8
                                            hold['BIL'] = 1
                                        }
                                        shortpicks.forEach(function (x) {
                                            hold[x[0]] = -1
                                        })
                                        var longsum = 0
                                        var shortsum = 0
                                        var orders = Object.values(hold)
                                        var etfsToHold = Object.keys(hold)
                                        for (var key in hold) {
                                            // check if the property/key is defined in the object itself, not in parent
                                            if (hold.hasOwnProperty(key)) {
                                                if (!trade){
                                                    writecsvRow(key, hold[key] * factor * shoreUp * .5, day,'csv/backtest.csv','symbol,weight,day')

                                                }
                                               
                                            }
                                        }
                                        if (trade) {
                                        orders.forEach(val => {
                                            if (val > 0) {
                                                longsum += val
                                            }
                                            else {
                                                shortsum -= val
                                            }

                                        });
                                        for (var i = 0; i < portfolioSymbols.length; i++) {
                                            (function (i) {
                                                setTimeout(function () {

                                                    if (!etfsToHold.includes(portfolioSymbols[i]) && etfs.includes(portfolioSymbols[i])) {
                                                        console.log("Close Positions")
                                                        if (trade) {
                                                            Builder.SubmitOrder(portfolioSymbols[i], 0, portfolioSharesDictionary[portfolioSymbols[i]], function () { })
                                                        }
                                                    }

                                                }, i * portfolioSymbols.length);
                                            })(i);
                                        }
                                        var data = []
                                        for (const [key, value] of Object.entries(hold)) {
                                            data.push({
                                                'symbol': key,
                                                'weight': Number(value > 0 ? value / longsum : value / shortsum).toFixed(2)
                                            });
                                        }

                                        for (var i = 0; i < data.length; i++) {
                                            (function (i) {
                                                setTimeout(function () {
                                                    var shares = 0
                                                    if (portfolioSymbols.includes(data[i].symbol)) {
                                                        shares = portfolioSharesDictionary[data[i].symbol]
                                                    }

                                                    var weight = data[i].weight * account.cash
                                                    console.log(data[i].symbol, weight * factor * shoreUp * .5, shares)
                                                    if (trade) {
                                                        Builder.SubmitOrder(data[i].symbol, weight * factor * shoreUp * .5, shares, function () { })

                                                    }
                                                    if (i >= data.length - 1) {
                                                        BuildRisk('AdjustedRisk')
                                                        setTimeout(function () {
                                                            process.abort();
                                                        }, 10000)
                                                    }
                                                }, 500 * i);
                                            })(i);

                                         }
                                        }
                                        //	console.log(hold)
                                    })
                                })


                            } else {
                                console.log("undefined")
                            }
                        })
                    })
            })
    },
    OBV: function (day,day2,file, trade) {

        Builder.RunOBV(day,day2, function (data) {
            console.log(data)
            data.forEach(function(x){
                writecsvRow(x.symbol, x.weight, day+' 14:30:00Z',file,'Ticker,position_dollars,time')
            })
        })
    },
    Equities: function (day,file, trade) {
        console.log("equities day: " + day)
        Builder.GetMacroTable(day, function (macro) {

            if (!(macro[0] == undefined)) { // grossly handles non-trading days

                var VIX = macro.vixAvg
                var VIXchange = macro.vixChange
                var PMI = macro.presentPMI
                var LastPMI = macro.pastPMI
                var longweight = .5
                var shortweight = .5

                var factor = FACTOR
                if (VIX >= 50) {
                    longweight = .4
                    shortweight = .6
                }
                else if (PMI > 50 && PMI > LastPMI) {
                    longweight = .65
                    shortweight = .35
                }
                else if (PMI > LastPMI || PMI > 50) {
                    longweight = .6
                    shortweight = .4
                }
                if (VIX < 30 && (VIXchange < 0 || VIX < 25)) {
                    if (PMI > 50) {
                        ALGO = .8
                    } else {
                        ALGO = .85
                    }

                }
                alpaca.getPositions()
                    .then((portfolio) => {
                        alpaca.getAccount()
                            .then((account) => {
                                var portfolioSymbols = []
                                var portfolioSharesDictionary = {}
                                var orderSymbols = []
                                portfolio.forEach(function (x) {
                                    portfolioSymbols.push(x.symbol)
                                    portfolioSharesDictionary[x.symbol] = x.qty
                                })
                                var symbolWeightsDictionary = {}
                                Builder.GetSectorSharpeDaily(day, function (sharpe) {
                                  //  console.log(sharpe)
                                    var etfs = Object.keys(sharpe[0])
                                    etfs.push('QQQ')
                                    etfs.push('TLT')
                                    etfs.push('GLD')
                                    etfs.push('UPRO')
                                    etfs.push('VIXY')
                                    etfs.push('BIL')
                                    Builder.GetBetaIEX(function (iex) {
                                        Builder.RunAlgo(day, function (data) {
                                           
                                           // console.log(data)
                                            console.log(data.length)
                                            if (data.length > 50) {
                                                data.forEach(function (x) {
                                                    if (!trade){
                                                       writecsvRow(x.symbol, x.weight, day+' 14:30:00Z',file,'Ticker,position_dollars,time')
                                                   // console.log(x.symbol, x.weight, day)
                                                    }
                                                   

                                                    orderSymbols.push(x.symbol)
                                                    symbolWeightsDictionary[x.symbol] = x.weight
                                                })
                                                for (var i = 0; i < portfolioSymbols.length; i++) {
                                                    (function (i) {
                                                        setTimeout(function () {
                                                            if (trade) {
                                                                if (!orderSymbols.includes(portfolioSymbols[i]) && !etfs.includes(portfolioSymbols[i])) {

                                                                    Builder.SubmitOrder(portfolioSymbols[i], 0, portfolioSharesDictionary[portfolioSymbols[i]], function () { })

                                                                }
                                                             //   console.log(portfolioSymbols[i].symbol)
                                                            }

                                                        }, i * portfolioSymbols.length);
                                                    })(i);
                                                }
                                                //  console.log(data)
                                                for (var i = 0; i < data.length; i++) {
                                                    (function (i) {
                                                        setTimeout(function () {
                                                            var shares = 0
                                                            if (portfolioSymbols.includes(data[i].symbol)) {
                                                                shares = portfolioSharesDictionary[data[i].symbol]
                                                            }

                                                            var weight = data[i].weight * account.cash
                                                            var weightedCalc = weight > 0 ? weight * longweight : weight * shortweight

                                                            if ("CTXS"!= data[i].symbol) {
                                                                if (trade) {
                                                                    Builder.SubmitOrder(data[i].symbol, weightedCalc, shares, function () { })

                                                                }
                                                              //  console.log(data[i].symbol)
                                                            }
                                                            if (i >= data.length - 1) {
                                                                BuildRisk('Risk')
                                                            }
                                                        }, 500 * i);
                                                    })(i);

                                                }
                                            }
                                        })
                                    })
                                })
                            })
                    })
            } else {
                console.log("undefined")
            }
        })
    }
}
function transformCOT(obj,i){
    var recent = JSON.parse(obj).dataset.data[0+i]
                    var last = JSON.parse(obj).dataset.data[3+i]
                    var interestDirection = recent[metric['Noncommercial Long']] / recent[metric['Open Interest']] -
                        JSON.parse(obj).dataset.data[0][metric['Noncommercial Short']] / recent[metric['Open Interest']]
                    
                    var institutionalGrowthSkew = (recent[metric['Noncommercial Long']] - last[metric['Noncommercial Long']]) / recent[metric['Noncommercial Long']] -
                        (recent[metric['Noncommercial Short']] - last[metric['Noncommercial Short']]) / recent[metric['Noncommercial Short']]
                   
                    var commercialGrowthSkew = (recent[metric['Commercial Long']] - last[metric['Commercial Long']]) / recent[metric['Commercial Long']] -
                        (recent[metric['Commercial Short']] - last[metric['Commercial Short']]) / recent[metric['Commercial Short']]
                   
                    var weeklyCotsScore = Math.abs(interestDirection) + 
                        Math.abs(institutionalGrowthSkew) +  Math.abs(commercialGrowthSkew) 
                      
        
                    return  (interestDirection/weeklyCotsScore +
                    institutionalGrowthSkew/weeklyCotsScore -
                    commercialGrowthSkew/weeklyCotsScore)/3
}
function BuildRisk(table) {
    var marketprice = 0
    var risk = {}
    Builder.Built_BetaSector_Report(function (report) {
        report.forEach(function (x) {
            if (!risk[x.sector]) {
                risk[x.sector] = Number(x.marketValue)
            }
            else {
                risk[x.sector] += Number(x.marketValue)
            }
            if (!risk['Beta']) {
                risk['Beta'] = x.beta * Number(x.marketValue)
            }
            else {
                risk['Beta'] += x.beta * Number(x.marketValue)
            }
            marketprice += Number(Math.abs(x.marketValue))
        })
        Object.keys(risk).forEach(function (key) {
            risk[key] /= marketprice;
        });
        Object.keys(risk).forEach(function (key) {
            risk[key] = risk[key].toFixed(3);
        });
        Builder.RiskToTable(table, risk)
    })
}








var fs = require('fs');
const { valuesIn } = require('lodash');
function writecsvRow(symbol, weight, day,file,columns) {
    var objstr = symbol + ',' + weight + ',' + day
    var newLine = '\r\n';
    var csv = objstr + newLine;
    var fields = columns + newLine;

    fs.stat(file, function (err, stat) {
        if (err == null) {
      
         //   console.log(csv)
            fs.appendFile(file, csv, function (err) {
                if (err) throw err;
            });
        } else {
            //write the headers and newline
         //   console.log(fields);

            fs.writeFile(file, fields, function (err) {
                if (err) throw err;
            //    console.log(fields);
            });
            fs.appendFile(file, csv, function (err) {
                if (err) throw err;
            });
        }
    });
}