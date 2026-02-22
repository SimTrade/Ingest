
'use strict'
var jsdom = require("jsdom");
var AzureStorage = require('./AzureStorage');
const { JSDOM } = jsdom;
const mkdirp = require('mkdirp');
const { window } = new JSDOM();
const { document } = (new JSDOM('')).window;
global.document = document;


const Builder = require('./Builder');
const alpaca = require('./Secrets/AlpacaCreds').getCreds();

// Be sure to set your API key
const minimist = require('minimist')

module.exports = {
    GetDaily: function (day) {
        
     
		var longCutoff = process.argv[4]
		var shortCutoff = 1 - process.argv[5]
		var barchartLongCutoff = process.argv[6]
		var barchartShortCutoff = 1 - process.argv[7]
		var longSplit = process.argv[3]
		var shortSplit = 1 - process.argv[3]

		Builder.GetDaily(barchartLongCutoff, barchartShortCutoff, function (longs, shorts) {
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


			var start = Math.round(shortItems.length * shortCutoff)
			var shortArray = shortItems.slice(start, shortItems.length - 1);

			var end = Math.round(longItems.length * longCutoff)
			var longArray = longItems.slice(0, end);
			var longBeta = 0
			var shortBeta = 0
			alpaca.getAccount()
				.then((account) => {
					Builder.GetBetaIEX(function (iex) {
						// Check if our account is restricted from trading.
						if (account.trading_blocked) {
							console.log('Account is currently restricted from trading.')
						}
						else {
							longArray.forEach(function (x) {
								var weight = 1 / longArray.length * account.cash
								var symbol = x[0]
								x[1] = weight * longSplit
								longBeta += iex[symbol]
								Builder.SubmitOrder(symbol, x[1], function () { })
							})

							shortArray.forEach(function (x) {
								var weight = 1 / shortArray.length * account.cash
								var symbol = x[0]
								x[1] = weight * longSplit
								shortBeta -= iex[symbol]
							//	Builder.SubmitOrder(symbol, x[1], function () { }) //
							})
						}
						shortBeta = Math.round(shortBeta * shortSplit / shortArray.length * 1e2) / 1e2;
						longBeta = Math.round(longBeta * longSplit / longArray.length * 1e2) / 1e2;
						console.log()
						var log = {
							'Longs': longArray,
							'Shorts': shortArray,
							'LongLengh': longArray.length,
							'ShortLenth': shortArray.length,
							'Long/Short_weight': (longSplit) * 100 + '%',
							'LongBeta': longBeta,
							'ShortBeta': shortBeta,
							'Beta': Math.round((longBeta + shortBeta) * 1e2) / 1e2
						}
						console.log()
						console.log(log)
						Builder.LogBeta(log)
					})
				})
		})
    }
}

