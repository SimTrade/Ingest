/////////////////////////////////////////////////// DEPENDENCIES //////////////////////////////////////////////////////////////
'use strict'
process.env.UV_THREADPOOL_SIZE = 1028;

const TwilioSecrets = require('./Library/Secrets/Twilio').Secrets()
const twilio = require('twilio')(TwilioSecrets.SID, TwilioSecrets.AUTH);
var jsdom = require("jsdom");
var Helper = require('./Library/Helper')
const Analyze = require('./Library/Analyze');
const { JSDOM } = jsdom;
const mkdirp = require('mkdirp');
const { document } = (new JSDOM('')).window;
global.document = document;
const PipelineRunner = require('./Library/PipelineRunner.js')
const Builder = require('./Library/Builder');
var dateObj = new Date()//.toJSON().slice(0, 10)

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
	else if ("FINNHUBLISTIEX" == process.argv[2]) {
		Builder.FINNHUBLISTIEX(function () {
			console.log("FINNHUBLISTIEX done!")
		});
	}
	/* MACRO HANDLING */


	else if ("MacroIngest" == process.argv[2]) { //run on friday
		Builder.DeleteTable("PMI", function () {
			Builder.DeleteTable("VIX", function () {
				Builder.PmiVixIngestion()
				// Builder.DeleteTable("SectorEtfWeekly", function () {
				// 	Builder.SectorEtfIngestion()
				// })
			})
		})





	}
	else if ("MacroTransform" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var back = dateObj.setDate(dateObj.getDate() - input)
		PipelineRunner.Build_Macro(back)

	}

	else if ("HistoricMacroTransform" == process.argv[2]) { //take about an hour to transform all 5 fundamentals
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		HistoricTransformBuilder(355 * 7, 100, input, 1000, PipelineRunner.Build_Macro, process.argv[3])
	}
	/*RUN DAILY*/


	else if ("TableRun" == process.argv[2]) {
		var stock = (process.argv[3] != (undefined) ? process.argv[3] : 'FULL')
		Builder.Barcharts(stock);
		Builder.WSJ(stock);
		Builder.Zacks(stock);
		Builder.IEX(stock);
		//Builder.ShortSqueeze();
	}
	//Weekly Generic ingest
	else if ("Ingest" == process.argv[2]) {
		var stock = (process.argv[3] != (undefined) ? process.argv[3] : 'NONE')
		if (stock == "DELETE") {
			Builder.DeleteTable("BalanceSheet", function () {
				Builder.DeleteTable("CashFlow", function () {
					Builder.DeleteTable("Growth", function () {
						Builder.DeleteTable("Income", function () {
							Builder.DeleteTable("Metrics", function () {
								console.log( "Delete Done!")
							})
						})
					})
				})
			})
		}
		else if (stock == "REVERSE" || stock == "NORMAL") {
			// Builder.RunIngest("Metrics", stock, function () {
			// 	Builder.RunIngest("CashFlow", stock, function () {
			// 		Builder.RunIngest("Growth", stock, function () {
			// 			Builder.RunIngest("Income", stock, function () {
							Builder.RunIngest(process.argv[4], stock, function () {

								console.log( "Ingest Done!")
								process.exit(0);
							})
			// 			})
			// 		})
			// 	})
			// })
		}

	}
	else if ("HistoricPicklistTransform" == process.argv[2]) { //take about an hour to transform all 5 fundamentals
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)

		//                     daysback, days, indexAdder, incrementer, method, factor
		HistoricTransformBuilder(355 * 7, 300, input, 60000, PipelineRunner.Transform_Factor_PickList, process.argv[4])
	}
	// daily generic transform
	else if ("Transform" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var back = dateObj.setDate(dateObj.getDate() - input)
		PipelineRunner.Transform_Factor_PickList(back,process.argv[4], function (x) {
			console.log("done!")
              process.exit(0);
		})
	}
	else if ("CompleteIngest" == process.argv[2]) {
		var input = Number(process.argv[5] != (undefined) ? process.argv[5] : 0)
		var back = dateObj.setDate(dateObj.getDate() - input)
		PipelineRunner.Complete_Ingest(back,process.argv[3], function (list) {
				  process.exit(0)
		})
	}


	/*************end  PICKLIST functions*************************** */
	/***********************************************************************************************************/

	/************** OHLC FUNCTIONS ************************ */
	/**
	* Builds hourly ohlcv using 5000Universe
	* in StocksHourlyBacktester Table Storage
	* RUN IN TASK SCHEDULER
	*/

	else if ("HistoricHourlyIngest_StocksHourlyBacktester" == process.argv[2]) {
		var first = Number(process.argv[3] != (undefined) ? process.argv[3] : 1)
		var second = Number(process.argv[3] != (undefined) ? process.argv[4] : 1)
		Builder.RunDaily('TIME_SERIES_INTRADAY_EXTENDED&slice=year' + first + 'month' + second + '&interval=60min',
			'StocksHourlyBacktester',
			'full', 12000,
			'2015-01-01', '', function(){
				console.log("done!")
              process.exit(0);
			})
	}
	else if ("Scheduled_HourlyIngest_StocksHourlyBacktester" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning)
		Builder.RunDaily('TIME_SERIES_INTRADAY&interval=60min',
			'StocksHourlyBacktester',
			'compact', 4000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	/**
	* Builds daily ohlcv using 5000Universe
	* in StocksDailyBacktester Table Storage
	* RUN IN TASK SCHEDULER
	*/
	else if ("Scheduled_DailyIngest_StocksDailyBacktester" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning)
		Builder.RunDaily('TIME_SERIES_DAILY_ADJUSTED',
			'StocksDailyBacktester',
			'compact', 1000,
			beginning, '','',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	else if ("HistoricDailyIngest_StocksDailyBacktester" == process.argv[2]) {
		Builder.RunDaily('TIME_SERIES_DAILY_ADJUSTED',
			'StocksDailyBacktester',
			'full', 83000,
			'2015-01-01',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	//SMA&symbol=IBM&interval=weekly&time_period=10&series_type=open
	//BBANDS&symbol=IBM&interval=weekly&time_period=5&series_type=close
	else if ("Historic_BuildCCI20Day" == process.argv[2]) {
		Builder.RunDaily('CCI&interval=daily&time_period=20&series_type=close',
			'CCI20Day',
			'full', 40000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}


	else if ("Scheduled_DailyIngest_BuildCCI20Day" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('CCI&interval=daily&time_period=20&series_type=close',
			'CCI20Day',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	else if ("Build50DaySMA" == process.argv[2]) {
		Builder.RunDaily('SMA&interval=daily&time_period=50&series_type=close',
			'SMA50Day',
			'full', 83000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}
	else if ("Scheduled_DailyIngest_Build50DaySMA" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('SMA&interval=daily&time_period=50&series_type=close',
			'SMA50Day',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	else if ("Build20DaySMA" == process.argv[2]) {
		Builder.RunDaily('SMA&interval=daily&time_period=20&series_type=close',
			'SMA20Day',
			'full', 83000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}
	else if ("Scheduled_DailyIngest_Build20DaySMA" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('SMA&interval=daily&time_period=20&series_type=close',
			'SMA20Day',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}

	else if ("BuildBBandsDaily" == process.argv[2]) {
		Builder.RunDaily('BBANDS&interval=daily&time_period=20&series_type=close',
			'BBandsDaily',
			'full', 83000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}
	else if ("Scheduled_DailyIngest_BuildBBandsDaily" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('BBANDS&interval=daily&time_period=20&series_type=close',
			'BBandsDaily',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	else if ("BuildBBandsWeekly" == process.argv[2]) {
		Builder.RunDaily('BBANDS&interval=weekly&time_period=10&series_type=close',
			'BBandsWeekly',
			'full', 25000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}
	else if ("Scheduled_DailyIngest_BuildBBandsWeekly" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('BBANDS&interval=weekly&time_period=10&series_type=close',
			'BBandsWeekly',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	else if ("BuildOBVMonthly" == process.argv[2]) {
		Builder.RunDaily('OBV&interval=monthly',
			'OBVMonthly',
			'full', 15000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}
	else if ("Scheduled_DailyIngest_BuildOBVMonthly" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('OBV&interval=monthly',
			'OBVMonthly',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}

	else if ("BuildOBVDaily" == process.argv[2]) {
		Builder.RunDaily('OBV&interval=daily',
			'OBVDaily',
			'full', 83000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}
	else if ("Scheduled_DailyIngest_BuildOBVDaily" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('OBV&interval=daily',
			'OBVDaily',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	else if ("BuildOBVWeekly" == process.argv[2]) {
		Builder.RunDaily('OBV&interval=weekly',
			'OBVWeekly',
			'full', 25000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}
	else if ("Scheduled_DailyIngest_BuildOBVWeekly" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('OBV&interval=weekly',
			'OBVWeekly',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}


	else if ("Scheduled_DailyIngest_TA" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)


				Builder.RunDaily('CCI&interval=daily&time_period=20&series_type=close',
					'CCI20Day',
					'compact', 250,
					beginning, '', symbol, function () {
						Builder.RunDaily('SMA&interval=daily&time_period=50&series_type=close',
							'SMA50Day',
							'compact', 250,
							'2015-01-01', '', '', function () {
								Builder.RunDaily('SMA&interval=daily&time_period=20&series_type=close',
									'SMA20Day',
									'compact', 250,
									beginning, '', symbol, function () {
										Builder.RunDaily('BBANDS&interval=daily&time_period=20&series_type=close',
											'BBandsDaily',
											'compact', 250,
											beginning, '', symbol, function () {
												Builder.RunDaily('BBANDS&interval=weekly&time_period=10&series_type=close',
													'BBandsWeekly',
													'compact', 250,
													beginning, '', symbol, function () {
														Builder.RunDaily('OBV&interval=monthly',
															'OBVMonthly',
															'compact', 250,
															beginning, '', symbol, function () {
																Builder.RunDaily('OBV&interval=daily',
																	'OBVDaily',
																	'compact', 250,
																	beginning, '', symbol, function () {
																		Builder.RunDaily('OBV&interval=weekly',
																			'OBVWeekly',
																			'compact', 250,
																			beginning, '', symbol, function () {
																				Builder.RunDaily('AD&interval=monthly',
																					'ADMonthly',
																					'compact', 250,
																					beginning, '', symbol, function () {
																						Builder.RunDaily('AD&interval=weekly',
																							'ADWeekly',
																							'compact', 250,
																							beginning, '', symbol, function () {
																								Builder.RunDaily('AD&interval=daily',
																									'ADDaily',
																									'compact', 250,
																									beginning, '', symbol, function () {
																										Builder.RunDaily('TIME_SERIES_INTRADAY&interval=60min',
																											'StocksHourlyBacktester',
																											'compact', 1000,
																											beginning, '', function () {
																												Builder.RunDaily('TIME_SERIES_DAILY_ADJUSTED',
																													'StocksDailyBacktester',
																													'compact', 250,
																													beginning, '', function () {
																														Builder.RunWeeklyToMonthly('TIME_SERIES_WEEKLY_ADJUSTED',
																															'StocksMonthlyGrowth',
																															'compact', 250,
																															beginning, '', symbol)
																													})
																											})
																										// console.log("TA Ingest Done")
																										// process.exit(0)

																									})
																							})
																					})
																			})
																	})
															})
													})
											})
									})
							})
					})

	}
	else if ("BuildADMonthly" == process.argv[2]) {
		Builder.RunDaily('AD&interval=monthly',
			'ADMonthly',
			'full', 15000,
			'2015-01-01', '', 'REVERSE')

	}
	else if ("Scheduled_DailyIngest_BuildADMonthly" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('AD&interval=monthly',
			'ADMonthly',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	else if ("BuildADDaily" == process.argv[2]) {
		Builder.RunDaily('AD&interval=daily',
			'ADDaily',
			'full', 83000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}
	else if ("Scheduled_DailyIngest_BuildADDaily" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('AD&interval=daily',
			'ADDaily',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}
	else if ("BuildADWeekly" == process.argv[2]) {
		Builder.RunDaily('AD&interval=weekly',
			'ADWeekly',
			'full', 25000,
			'2015-01-01', '',  function(){
				console.log("done!")
              process.exit(0);
			})

	}
	else if ("Scheduled_DailyIngest_BuildADWeekly" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunDaily('AD&interval=weekly',
			'ADWeekly',
			'compact', 1000,
			beginning, '',  function(){
				console.log("done!")
              process.exit(0);
			})
	}

	else if ("BuildCot" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		Helper.CotTableBuilder(input)

	}
	else if ("Build_Cot_Backtest" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		//var back = dateObj.setDate(dateObj.getDate() - input)
		BacktestCot(5000, input, 5000, Helper.CotTableBuilder)

	}
	/**
	 Buid Stocks weekly

	*/
  else if ("runallTaDailyIngest" == process.argv[2]) {
    var input = Number(process.argv[3] != undefined ? process.argv[3] : 0);
    var symbol = process.argv[4] != undefined ? process.argv[4] : "";
    var back = dateObj.setDate(dateObj.getDate() - input);
    var range = dateObj.setDate(dateObj.getDate() - (input + 10));
    var beginning = new Date(range).toJSON().slice(0, 10);
    var day = new Date(back).toJSON().slice(0, 10);
    Builder.RunDaily(
      "TIME_SERIES_DAILY_ADJUSTED",
      "StocksDailyBacktester",
      "compact",
      250,
      beginning,
      "",symbol,
      function () {
        Builder.RunDaily(
          "CCI&interval=daily&time_period=20&series_type=close",
          "CCI20Day",
          "compact",
          250,
          beginning,
          "",symbol,
          function () {
            Builder.RunDaily(
              "SMA&interval=daily&time_period=50&series_type=close",
              "SMA50Day",
              "compact",
              250,
              beginning,
              "",symbol,
              function () {
                Builder.RunDaily(
                  "SMA&interval=daily&time_period=20&series_type=close",
                  "SMA20Day",
                  "compact",
                  250,
                  beginning,
                  "",symbol,
                  function () {
                    Builder.RunDaily(
						"AD&interval=daily",
						"ADDaily",
						"compact",
						250,
						beginning,
						"",symbol,
						function () {
						  Builder.RunWeeklyToMonthly('TIME_SERIES_WEEKLY_ADJUSTED',
							'StocksMonthlyGrowth',
							'compact', 250,
							beginning, '', symbol,function(){
								console.log(factor + "Ingest Done!")
								process.exit(0);
							})
						}
					  );
                  }
                );
              }
            );
          }
        );
      }
    );
}
	else if ("Scheduled_DailyIngest_StocksMonthlyGrowth" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		var symbol = (process.argv[4] != (undefined) ? process.argv[4] : '')
		var back = dateObj.setDate(dateObj.getDate() - input)
		var range = dateObj.setDate(dateObj.getDate() - (input + 10))
		var beginning = new Date(range).toJSON().slice(0, 10)
		var day = new Date(back).toJSON().slice(0, 10)
		console.log(beginning + symbol)
		Builder.RunWeeklyToMonthly('TIME_SERIES_WEEKLY_ADJUSTED',
			'StocksMonthlyGrowth',
			'compact', 1000,
			beginning, '', symbol)
	}
	else if ("HistoricDailyIngest_StocksMonthlyGrowth" == process.argv[2]) {
		var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
		Builder.RunWeeklyToMonthly('TIME_SERIES_WEEKLY_ADJUSTED',
			'StocksMonthlyGrowth',
			'full', 83000,
			'2015-01-01', '')

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
			Builder.MongoIngest(Analyze.ShortVolume, 'ShortVolume', 5000, function () {
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

		HistoricTransformBuilder(355 * 7, 300, input, 100000, PipelineRunner.TransformShortVolume, '')
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
				PipelineRunner.DailyIngest_ShortVolume(day, Builder.ShortVolumeTask, process.argv[4])
			}
			else {
				console.log("not trading today: " + day)
			}
		})
	}
	/*************end shortvolume functions*************************** */


	/******************** END -- USE FOR INGEST MICROOSERVICES ********************/














	else
		if ("DCFalgo" == process.argv[2]) {
			var input = Number(process.argv[3] != (undefined) ? process.argv[3] : 0)
			//var back = dateObj.setDate(dateObj.getDate() - input)
			BacktestDF(5000, input, 5000, Helper.DCFalgo)

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










			else if ('StockList' == [process.argv[2]]) {
				Builder.Stocklist()
			}
			else if ('GetPicklist' == [process.argv[2]]) {
				Builder.GetPicklist()
			}

			else if ("CompanyProfile" == process.argv[2]) {
				Builder.CompanyProfile(process.argv[3]);
			}
			else if ("ShortSqueeze" == process.argv[2]) {
				Builder.ShortSqueeze();

			}
			//////////////////////////////////////////////////////////


			///////////////////////////////////////////////////////////

			// else if ("BuildTableUniverses" == process.argv[2]) {
			// 	Builder.BuildTableUniverses(function () { console.log("done") });
			// }


			// else if ("GetOrders" == process.argv[2]) {
			// 	Builder.GetOrders()
			// }

			else if ("IPOS" == process.argv[2]) {
				for (var i = 1; i < 4; i++) {
					Builder.FinnhubIpoCalendar(i * 100)
					Builder.FinnhubIpoCalendar(i * 100 + 50)
				}

			}



			// else if ("GetEtfDictionary" == process.argv[2]) {
			// 	Builder.GetEtfDictionary()
			// 	//Builder.AlphaVantage()
			// }


			else {
				console.log('no known call....');
			}
} else {
	console.log('no known call....');


}
function HistoricTransformBuilder(daysback, days, indexAdder, incrementer, method, factor) {
	for (var i = 0; i < daysback; i++) {
		(function (i) {
			setTimeout(function () {
				console.log("____________Daysback: " + (i + indexAdder))
				var dateTime = new Date()
				var howFar = dateTime.setDate(dateTime.getDate() - (i + indexAdder))
				var day_of_reference = new Date(howFar).toJSON().slice(0, 10)
				if (i > days) { //dont run longer than a year for performance data leaks
					console.log("indexer: " + (i + indexAdder))
					console.log("date: " + day_of_reference)
					throw "*********** DONE **********************"
				}
				try {

					Builder.GetCalendar(day_of_reference, function (isTradingDay) {
						if (isTradingDay) {
							console.log("------"+factor)
							method(day_of_reference, factor)
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
					console.log("BacktestDF no data")
				}
			}, (i == 0 ? 1 : i * incrementer));
		})(i);
	}
}