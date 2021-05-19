/////////////////////////////////////////////////// DEPENDENCIES //////////////////////////////////////////////////////////////
'use strict'
process.env.UV_THREADPOOL_SIZE = 1028;

const TwilioSecrets = require('./Library/Secrets/Twilio').Secrets()
const twilio = require('twilio')(TwilioSecrets.SID, TwilioSecrets.AUTH);
var jsdom = require("jsdom");
var RunAlgo = require('./Library/RunAlgo')
var GetDaily = require('./Library/GetDaily')
const Analyze = require('./Library/Analyze');
const { JSDOM } = jsdom;
const mkdirp = require('mkdirp');
const { document } = (new JSDOM('')).window;
global.document = document;
const ModelRunner = require('./Library/ModelRunner.js')
const Builder = require('./Library/Builder');
const { Console } = require('console');

// control Builders days
var dateObj = new Date()//.toJSON().slice(0, 10)
var daysback = dateObj.setDate(dateObj.getDate() - 0)


if (process.argv[2]) {
	/**************** BEGIN -- USE FOR INJEST MICROOSERVICE **************************/


	
	/** 
	* Builds Top1000, Second1000, Third1000, Fourth1000, Last1000 Universe Tables
	* in Azure Table storage
	* RUN QUARTERLY IN TASK SCHEDULER OR MANUALLY
	*/
	if ("BuildTableUniverses" == process.argv[2]) {
		Builder.BuildTableUniverses(function () {
			console.log("DONE")
		});
	}
	else if ("POLYGONCOMPANIES" == process.argv[2]) {
		Builder.POLYGONCOMPANIES(function () {
			console.log("Polygon done!")
		});
	}
	/************** PICKLIST FUNCTIONS ************************ */	
	/** using 5000Universe more like 4k
	* <Run...Ingest's> Ingest to Mongo DB (original method)
	* <Build...Picklist's> Transform from Mongo to Table Storage (still) 
	* <HistoricWeekly...PicksList's> Build and transform only works on short timeframes (30 days) 
	
	* RUN IN TASK SCHEDULER
	*/
	//Growth
	else if ("RunGrowthIngest" == process.argv[2]) {
		Builder.RunGrowthIngest()
	}
	else if ("Transform_Growth_Picklist_Backtest" == process.argv[2]) {
		
		var ingest = 'Growth'
		var table = "Picklist5000"
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		ModelRunner.TransformIngest(input,ingest,table)
	}
	else if ("HistoricWeeklyGrowth_Picklist" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var back = dateObj.setDate(dateObj.getDate() -input)
		ModelRunner.Built_Growth(back)
		//HistoricPicklistBuilder(355 * 7, input, 100000, ModelRunner.Built_Income)
	}
	else if ("Built_Growth_PickList_Backtest" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		HistoricTransformBuilder(355 * 7, input, 100000, ModelRunner.Built_Factor_PickList,'Growth')
	}

	//Income
	else if ("RunIncomeIngest" == process.argv[2]) {
		Builder.RunIncomeIngest()
	}
	else if ("Transform_Income_Picklist_Backtest" == process.argv[2]) {
		
		var ingest = 'Income'
		var table = "Picklist5000"
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		ModelRunner.TransformIngest(input,ingest,table)
	}	
	else if ("HistoricWeeklyIncome_Picklist" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var back = dateObj.setDate(dateObj.getDate() -input)
		ModelRunner.TransformIngest(back)
		//HistoricPicklistBuilder(355 * 7, input, 100000, ModelRunner.Built_Income)
	}
	else if ("Built_Income_PickList_Backtest" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		HistoricTransformBuilder(355 * 7, input, 100000, ModelRunner.Built_Factor_PickList,'Income')
	}

	//Metrics
	else if ("RunMetricsIngest" == process.argv[2]) {
		Builder.RunMetricsIngest()
	}
	else if ("Transform_Metrics_Picklist_Backtest" == process.argv[2]) {
		
		var ingest = 'Metrics'
		var table = "Picklist5000"
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		ModelRunner.TransformIngest(input,ingest,table)
	}
	else if ("Built_Metrics_PickList_Backtest" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		HistoricTransformBuilder(355 * 7, input, 100000, ModelRunner.Built_Factor_PickList,'Metrics')
	}	

	//BalanceSheet
	else if ("RunBalanceSheetIngest" == process.argv[2]) {
		Builder.RunBalanceSheetIngest()
	}
	else if ("Transform_BalanceSheet_Picklist_Backtest" == process.argv[2]) {
		
		var ingest = 'BalanceSheet'
		var table = "Picklist5000"
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		ModelRunner.TransformIngest(input,ingest,table)
		
		//HistoricTransformBuilder(355 * 7,ingest,table, input, 100000, ModelRunner.TransformIngest)
	}
	else if ("Built_BalanceSheet_PickList_Backtest" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		HistoricTransformBuilder(355 * 7, input, 100000, ModelRunner.Built_Factor_PickList,'BalanceSheet')
	}	
	//CashFlow
	else if ("RunCashFlowIngest" == process.argv[2]) {
		Builder.RunCashFlowIngest()
	}
	else if ("Transform_CashFlow_Picklist_Backtest" == process.argv[2]) {
		
		var ingest = 'CashFlow'
		var table = "Picklist5000"
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		ModelRunner.TransformIngest(input,ingest,table)
	}	
	else if ("Built_CashFlow_PickList_Backtest" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		HistoricTransformBuilder(355 * 7, input, 100000, ModelRunner.Built_Factor_PickList,'CashFlow')
	}
	/*************end  PICKLIST functions*************************** */
/***********************************************************************************************************/

	/************** OHLC FUNCTIONS ************************ */	
	/** 
	* Builds daily ohlcv using 5000Universe
	* in StocksDailyBacktester Table Storage
	* RUN IN TASK SCHEDULER
	*/
	else if ("Scheduled_DailyIngest_StocksDailyBacktester" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var back = dateObj.setDate(dateObj.getDate() -input)
		var range = dateObj.setDate(dateObj.getDate() -(input+10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning)
		Builder.Run('TIME_SERIES_DAILY_ADJUSTED',
					'StocksDailyBacktester',
					'compact',1000,
					beginning,'')
	}
	else if ("HistoricDailyIngest_StocksDailyBacktester" == process.argv[2]) {
		Builder.Run('TIME_SERIES_DAILY_ADJUSTED',
					'StocksDailyBacktester',
					'full',83000,
					'2015-01-01','')
	}
	/*************end  OHLCV functions*************************** */
/***********************************************************************************************************/
	/************** SHORT VOLUME FUNCTIONS ************************ */
	/** 
	* Builds mongodb ShortVolume Table using 5000Universe
	* RUN MANUALLY BEFORE TRANSFORM
	*/
	else if ("ShortVolumeIngest" == process.argv[2]) {
		var day = new Date().toJSON().slice(0, 10)
		try {
			Builder.MongoIngest(Analyze.ShortVolume, 'ShortVolume', 5000,function () {
				console.log("DONE")
			});
		}
		catch {
			twilio.messages
				.create({
					body: 'Failed Daily Ingest: ' + day,
					from: '+18182178540',
					to: '+15617041814'
				})
				.then(message => console.log(message.sid))
				.done();
		}
	}

	/** 
	* Pulls from mongodb ShortVolume using 5000Universe
	* to historic build ShortVolume Table Storage
	* RUN MANUALLY AFTER INJEST
	*/
	else if ("TransformShortVolume" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		HistoricTransformBuilder(355 * 7, input, 5 * 30000, ModelRunner.TransformShortVolume,'')
	}

	/** 
	* Builds daily using 5000Universe
	* in ShortVolume Table Storage
	* RUN IN TASK SCHEDULER
	*/
	else if ("DailyIngest_ShortVolume" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var back = dateObj.setDate(dateObj.getDate() - input)
		var day = new Date(back).toJSON().slice(0, 10)
				Builder.GetCalendar(day, function (isTradingDay) {
					if (isTradingDay) {
						console.log(" trading today: " + day)
						ModelRunner.DailyIngest_ShortVolume(day, Builder.ShortVolumeTask)
					}
					else {
						console.log("not trading today: " + day)
					}
				})
	}
	/*************end shortvolume functions*************************** */


	/******************** END -- USE FOR INJEST MICROOSERVICES ********************/













	else if ("CotAlgo_Backtest" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		//var back = dateObj.setDate(dateObj.getDate() - input)
		BacktestCot(5000, input, 5000, RunAlgo.CotTableBuilder)

	}
	else
		if ("DCFalgo" == process.argv[2]) {
			var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
			//var back = dateObj.setDate(dateObj.getDate() - input)
			BacktestDF(5000, input, 5000, RunAlgo.DCFalgo)

		} else
			if ("GoogleByLetter" == process.argv[2]) {
				Builder.GoogleByLetter()

			}
			else if ("mkdirp" == process.argv[2]) {
				mkdirp("testmkdirp", function (err) {
					if (err) return console.log(err);
				});
			}
			else if ("Twilio" == process.argv[2]) {
				twilio.messages
					.create({
						body: 'failed ShortVolume Ingest',
						from: '+18182178540',
						to: '+15617041814'
					})
					.then(message => console.log(message.sid))
					.done();
			}
			else if ("Built_BetaSector_Report" == process.argv[2]) {
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
					Builder.RiskToTable(risk)
				})

			}
			
			
			
			else if ("Built_PickList" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				var back = dateObj.setDate(dateObj.getDate() - input)
				ModelRunner.Built_Factor_PickList(back)
			}
			else if ("Build_Macro" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				var back = dateObj.setDate(dateObj.getDate() - input)
				ModelRunner.Build_Macro(back)
			}
			/** Backtest runner
			 * 
			 * node --max-old-space-size=4096 process.js RunEquities_Backtest
			 */
			else if ("RunEquities_Backtest" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				BacktestRunner('csv/full-equities-backtest.csv', 365 * 7, input, 10000, RunAlgo.Equities)
			}
			else if ("RunSectorHedge_Backtest" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				BacktestRunner('csv/etf-backtest.csv', 355 * 7, input, 10000, RunAlgo.SectorHedge)
			}
			/** BACKTEST BUILDER */
			
			else if ("Build_Macro_Backtest" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				HistoricTransformBuilder(355 * 7, input, 7000, ModelRunner.Build_Macro,'')
			}

			else if ("Build_Stock_Weekly_Backtest" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				HistoricTransformBuilder(355 * 7, input, 30000, ModelRunner.Build_Stock_Weekly,'')

			}
			else if ("Build_Stock_Daily_Backtest" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				var dateTime = new Date()
				var howFar = dateTime.setDate(dateTime.getDate() - (input))
				var dayyo = new Date(howFar).toJSON().slice(0, 10)
				console.log(dayyo)
				BacktestRunBuilder(355 * 7, input, 90000, ModelRunner.Build_Stock_Daily)

			}

			else if ("BuildOBV" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				ModelRunner.BuildOBV(input)

			}
			else if ("BuildOBVBacktest" == process.argv[2]) {
				var begin = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				var end = Number(process.argv[3] != (undefined) ? process.argv[4] : 0)
				BacktestOBV(begin, 25000, ModelRunner.BuildOBV)


			}
			else if ("BacktestResults__Backtest" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				ReturnsBuilder(input, 3000, ModelRunner.BacktestResults)
			}
			else if ("BacktestResults" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				var back = dateObj.setDate(dateObj.getDate() - input)
				ModelRunner.BacktestResults(back)
			}
			else if ("Build_Stock_Daily" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				var back = dateObj.setDate(dateObj.getDate() - input)
				ModelRunner.Build_Stock_Daily(back)
			}
			else if ("Build_Stock_Weekly" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				var back = dateObj.setDate(dateObj.getDate() - input)
				ModelRunner.Build_Stock_Weekly(back)
			}

			else if ("RunEtfWeekly" == process.argv[2]) { //run on friday
				Builder.RunEtfWeekly()
				Builder.POLYGONCOMPANIES(function () {
					console.log("Polygon done!")
				});
			}
			else if ("RunStockWeekly" == process.argv[2]) { //run on friday
				Builder.RunStockWeekly()
			}
			
			else if ("RapidApi_Single" == process.argv[2]) {
				Builder.RapidApi_Single()
			}// RapidApi_Single
			else if ("GetCalendar" == process.argv[2]) {
				var dateObj = new Date()//.toJSON().slice(0, 10)
				var d = dateObj.setDate(dateObj.getDate() - 1)
				var day = new Date().toJSON().slice(0, 10)
				Builder.GetCalendar(day, function (isTradingDay) {
					if (isTradingDay) {
						console.log(" trading today: " + day)
					}
					else {
						console.log("not trading today: " + day)
					}
				})
			}
			else if ("CancelAllOrders" == process.argv[2]) { //run on friday
				Builder.CancelAllOrders()

			}
			else if ("DeleteDaily" == process.argv[2]) {
				try {
					Builder.DeleteShortVolume()
				} catch {
					console.log("Cant DeleteShortVolume")
				}
			}
			else if ('DeleteStocksWeekly' == process.argv[2]) {
				Builder.DeleteStocksWeekly()
			}
			else if ("DeleteAll" == process.argv[2]) {

				try {
					Builder.DeleteShortVolume()
				} catch {
					console.log("Cant DeleteShortVolume")
				}
				try {
					Builder.DeleteBalanceSheet()
				} catch {
					console.log("Cant DeleteBalanceSheet")
				}
				try {
					Builder.DeleteCashFlow()
				} catch {
					console.log("Cant DeleteCashFlow")
				}
				try {
					Builder.DeleteGrowth()
				} catch {
					console.log("Cant DeleteGrowth")
				}
				try {
					Builder.DeleteIncome()
				} catch {
					console.log("Cant DeleteIncome")
				}
				try {
					Builder.DeleteMetrics()
				} catch {
					console.log("Cant DeleteMetrics")
				}
				try {
					Builder.DeletePMI()
				} catch {
					console.log("Cant DeletePMI")
				}
				try {
					Builder.DeleteSectorEtfWeekly()
				} catch {
					console.log("Cant DeleteSectorEtfWeekly")
				}
				try {
					Builder.DeleteVIX()
				} catch {
					console.log("Cant DeleteVIX")
				}


			}

			else if ("EQUITYPICKS" == process.argv[2]) {
				Builder.EQUITYPICKS(function () {
					console.log("done with Build all")
				});
			}



			else if ('StockList' == [process.argv[2]]) {
				Builder.Stocklist()
			}
			else if ('GetPicklist' == [process.argv[2]]) {
				Builder.GetPicklist()
			}

			else if ("CompanyProfile" == process.argv[2]) {
				Builder.CompanyProfile(process.argv[3]);
			}
			else if ("TableRun" == process.argv[2]) {
				Builder.Barcharts();
				Builder.WSJ();
				Builder.Zacks();
				Builder.IEX();
				//Builder.ShortSqueeze();
			} else if ("ShortSqueeze" == process.argv[2]) {
				Builder.ShortSqueeze();

			}
			//////////////////////////////////////////////////////////


			///////////////////////////////////////////////////////////
			
			else if ("BuildTableUniverses" == process.argv[2]) {
				Builder.BuildTableUniverses(function () { console.log("done") });
			}


			else if ("GetOrders" == process.argv[2]) {
				Builder.GetOrders()
			}

			else if ("IPOS" == process.argv[2]) {
				for (var i = 1; i < 4; i++) {
					Builder.FinnhubCalendar(i * 100)
					Builder.FinnhubCalendar(i * 100 + 50)
				}

			}
			else if ("CloseAllPositions" == process.argv[2]) {
				Builder.CloseAllPositions()
			}
			else if ("GetDaily" == process.argv[2]) {

				GetDaily.GetDaily()
			}

			else if ("GetEtfDictionary" == process.argv[2]) {
				Builder.GetEtfDictionary()
				//Builder.AlphaVantage()
			}
			else if ("GetPortfolio" == process.argv[2]) {
				Builder.GetPortfolio(function (x) {
					console.log(x)
				})
			}
			else if ("RunSectorHedge" == process.argv[2]) {
				var day = new Date(daysback).toJSON().slice(0, 10)
				try {
					Builder.GetCalendar(day, function (isTradingDay) {
						if (isTradingDay) {
							RunAlgo.SectorHedge(day, true)
						}
						else {
							console.log("not trading today: " + day)
						}
					})

				} catch {
					console.log("runsector no data")
				}

			}
			else if ("RunOBV_Backtest" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				BacktestObvRunner('csv/obv.csv', 365 * 7, input, 10000, RunAlgo.OBV)
			}
			else if ("RunOBV" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				console.log(input)
				var back = dateObj.setDate(dateObj.getDate() - input)
				var day = new Date(back).toJSON().slice(0, 10)
				var back2 = dateObj.setDate(dateObj.getDate() - (input + 30))
				var day2 = new Date(back2).toJSON().slice(0, 10)
				try {
					Builder.GetCalendar(day, function (isTradingDay) {
						if (isTradingDay) {
							RunAlgo.OBV(day, day2, 'csv/obv.csv', true)
						}
						else {
							console.log("not trading today: " + day)
						}
					})

				} catch {
					console.log("runsector no data")
				}
			}
			else if ("RunEquities" == process.argv[2]) {
				var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
				console.log(input)
				var back = dateObj.setDate(dateObj.getDate() - input)
				var day = new Date(back).toJSON().slice(0, 10)
				try {
					Builder.GetCalendar(day, function (isTradingDay) {
						if (isTradingDay) {
							RunAlgo.Equities(day, 'csv/outOfSample.csv', true)
						}
						else {
							console.log("not trading today: " + day)
						}
					})

				} catch {
					console.log("runsector no data")
				}
			}
			else if ("RunTest" == process.argv[2]) {
				var day = new Date(daysback).toJSON().slice(0, 10)
				try {
					Builder.GetCalendar(day, function (isTradingDay) {
						if (isTradingDay) {
							Builder.RunTest(day)
						}
						else {
							console.log("not trading today: " + day)
						}
					})

				} catch {
					console.log("runsector no data")
				}
			}

			else {
				console.log('no known call....');
			}
} else {
	console.log('no known call....');


}
function ReturnsBuilder(indexAdder, incrementer, method) {
	var returns = 0
	var j = 1
	for (var i = indexAdder; i > 0; i--) {
		(function (i) {
			setTimeout(function () {
				console.log("____________| Daysback: " + (i))
				var dateTime = new Date()
				var howFar = dateTime.setDate(dateTime.getDate() - (i))
				var dayyo = new Date(howFar).toJSON().slice(0, 10)
				try {
					Builder.GetCalendar(dayyo, function (isTradingDay) {
						if (isTradingDay) {
							method(dayyo, function (x) {
								returns += Number(x)
								RunAlgo.writecsvRow('algo', returns, dayyo, '/csv/fullequities_returns.csv', 'market,weight,day')
								console.log('Total:', returns + '%')
							})
							console.log("Is Trading Today: " + dayyo)
						}
						else {
							console.log("Not Trading Today: " + dayyo)
						}
					})

				} catch {
					console.log("runsector no data")
				}
			}, (i == 0 ? 1 : j++ * incrementer));
		})(i);
	}
}								
function HistoricTransformBuilder(daysback, indexAdder, incrementer, method,factor) {
	var returns = 0
	for (var i = 0; i < daysback; i++) {
		(function (i) {
			setTimeout(function () {
				console.log("____________Daysback: " + (i + indexAdder))
				var dateTime = new Date()
				var howFar = dateTime.setDate(dateTime.getDate() - (i + indexAdder))
				var day_of_reference = new Date(howFar).toJSON().slice(0, 10)
				if (i > 300) { //dont run longer than a year for performance data leaks
					console.log("indexer: " + (i + indexAdder))
					console.log("date: " + day_of_reference)
					throw "*********** DONE **********************"
				}
				try {
					Builder.GetCalendar(day_of_reference, function (isTradingDay) {
						if (isTradingDay) {
							method(day_of_reference,factor)
							console.log("TRADING TODAY: " + day_of_reference)
						}
						else {
							console.log("NOT TRADING ON: " + day_of_reference)
						}
					})

				} catch {
					console.log("HistoricTransformBuilder has NO DATA THIS ITERATION " + (i + indexAdder) + " For Date " + day_of_reference)
				}
			}, (i == 0 ? 1 : i * incrementer));
		})(i);
	}
}
function HistoricPicklistBuilder(daysback, indexAdder, incrementer, method) {
	for (var i = 0; i < daysback; i++) {
		(function (i) {
			setTimeout(function () {
				console.log("____________Daysback: " + (i + indexAdder))
				var dateTime = new Date()
				var howFar = dateTime.setDate(dateTime.getDate() - (i + indexAdder))
				var day_of_reference = new Date(howFar).toJSON().slice(0, 10)
				if (i > 101) { //dont run longer than a year for performance data leaks
					console.log("indexer: " + (i + indexAdder))
					console.log("date: " + day_of_reference)
					throw "*********** DONE **********************"
				}
				try {
					Builder.GetCalendar(day_of_reference, function (isTradingDay) {
						if (isTradingDay) {
							method(day_of_reference,indexAdder)
							console.log("TRADING TODAY: " + day_of_reference)
						}
						else {
							console.log("NOT TRADING ON: " + day_of_reference)
						}
					})

				} catch {
					console.log("HistoricTransformBuilder has NO DATA THIS ITERATION " + (i + indexAdder) + " For Date " + day_of_reference)
				}
			}, (i == 0 ? 1 : i * incrementer));
		})(i);
	}
}
function BacktestRunBuilder(daysback, indexAdder, incrementer, method) {
	var returns = 0
	for (var i = 0; i < daysback; i++) {
		(function (i) {
			setTimeout(function () {
				console.log("____________| Daysback: " + (i + indexAdder))
				var dateTime = new Date()
				var howFar = dateTime.setDate(dateTime.getDate() - (i + indexAdder))
				var dayyo = new Date(howFar).toJSON().slice(0, 10)
				try {
					Builder.GetCalendar(dayyo, function (isTradingDay) {
						if (isTradingDay) {
							method(dayyo)
							//	console.log("YAY trading today: " + dayyo)
						}
						else {
							console.log("not trading today: " + dayyo)
						}
					})

				} catch {
					console.log("runsector no data")
				}
			}, (i == 0 ? 1 : i * incrementer));
		})(i);
	}
}
function BacktestRunner(file, daysback, indexAdder, incrementer, method) {

	for (var i = 0; i < daysback; i++) {

		(function (i) {
			setTimeout(function () {
				console.log("____________| Daysback: " + (i + indexAdder))
				var dateTime = new Date()
				var howFar = dateTime.setDate(dateTime.getDate() - (i + indexAdder))
				var dayyo = new Date(howFar).toJSON().slice(0, 10)
				console.log(dayyo)
				if (i > 300) { //dont run longer than a year for performance data leaks
					console.log("indexer: " + (i + indexAdder))
					console.log("date: " + dayyo)
					throw "done"
				}
				try {
					Builder.GetCalendar(dayyo, function (isTradingDay) {
						if (isTradingDay) {
							method(dayyo, file, false)
							//	console.log("YAY trading today: " + dayyo)
						}
						else {
							console.log("not trading today: " + dayyo)
						}
					})

				} catch {
					console.log("runsector no data")
				}

			}, (i == 0 ? 1 : i * incrementer));
		})(i);
	}
}
function BacktestObvRunner(file, daysback, indexAdder, incrementer, method) {

	for (var i = 0; i < daysback; i++) {

		(function (i) {
			setTimeout(function () {
				console.log("____________| Daysback: " + (i + indexAdder))
				var dateTime = new Date()
				var howFar = dateTime.setDate(dateTime.getDate() - (i + indexAdder))
				var dayyo = new Date(howFar).toJSON().slice(0, 10)
				var howFar2 = dateTime.setDate(dateTime.getDate() - (i + indexAdder + 10))
				var dayyo2 = new Date(howFar2).toJSON().slice(0, 10)
				console.log(dayyo)
				if (i > 100) { //dont run longer than a year for performance data leaks
					console.log("indexer: " + (i + indexAdder))
					console.log("date: " + dayyo)
					throw "done"
				}
				try {
					Builder.GetCalendar(dayyo, function (isTradingDay) {
						if (isTradingDay) {
							method(dayyo, dayyo2, file, false)
							//	console.log("YAY trading today: " + dayyo)
						}
						else {
							console.log("not trading today: " + dayyo)
						}
					})

				} catch {
					console.log("runsector no data")
				}

			}, (i == 0 ? 1 : i * incrementer));
		})(i);
	}
}
function BacktestOBV(begin, incrementer, method) {
	var end = begin + 300
	console.log(end + " - " + begin)
	for (var i = begin - 1; i >= end; i--) {

		(function (i) {
			setTimeout(function () {

				try {
					method(i)
				} catch {
					console.log("no obv no data")
				}

			}, (i == 0 ? 1 : (begin - i) * incrementer));
		})(i);
	}
}
function BacktestCot(count, adder, incrementer, method) {
	for (var i = 0; i < count; i++) {
		(function (i) {
			setTimeout(function () {
				try {
					method(i + adder)
				} catch {
					console.log("BacktestCot no data")
				}
			}, (i == 0 ? 1 : i * incrementer));
		})(i);
	}
}
function BacktestDF(count, adder, incrementer, method) {
	for (var i = 0; i < count; i++) {
		(function (i) {
			setTimeout(function () {
				try {
					var daysback = dateObj.setDate(dateObj.getDate() - i + adder)
					var day = new Date(daysback).toJSON().slice(0, 10)
					console.log(day)
					method(day, false)
				} catch {
					console.log("BacktestCot no data")
				}
			}, (i == 0 ? 1 : i * incrementer));
		})(i);
	}
}