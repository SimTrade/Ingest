//
var jsdom = require("jsdom");
var AzureStorage = require('./AzureStorage');
var azure = require('azure-storage');
const AzureSecrets = require('./Secrets/Azure').Secrets()
const { JSDOM } = jsdom;
const { window } = new JSDOM();
const { document } = (new JSDOM('')).window;
global.document = document;

var $ = jQuery = require('./js/jquery')(window);
var csv = require('./js/jquery.csv.js');
const logging = require('./logging');

module.exports = {
  Prime: function () {
    var rootlist = logging.newestlisttopVolume()
    console.log()
    var symbolDistinct = []

    //rootlist = $.csv.toArrays(rootlist)
    console.log("dirtylist: " + rootlist.length)
    rootlist.forEach(function (line) {
      var symbol = line.split(',')[0];
      if ((symbol.length < 5) && !(symbol.includes("-") && !symbol.includes(".") && !symbol.includes("_"))) {

        if (symbol[0] > 'S') {
          symbolDistinct.push(symbol)
        }

      }
    })
    var list = jQuery.unique(symbolDistinct).sort()
    //console.log(list)
    console.log("clean list: " + list.length)
    return list;
  },
  CSV2Array: function () {
    //console.log(logging.getEodCsvs())
    // console.log(logging.getEodCsvs().length)
    return logging.getEodCsvs()
  },//logging.getEODMaster()
  EODListRunner: function (id) {

    var stocklist = logging.getEODMaster()
    // console.log(logging.getEODMaster())
    var symbolDistinct = []
    stocklist.forEach(function (symbol) {
      if (symbol[0] == id)//symbol[0] != '' )
      {
        symbolDistinct.push(symbol)
      }
    })
    var list = jQuery.unique(symbolDistinct).sort()
    console.log(list)
    console.log(list.length)
    return list;
  },


  EODList: function () {

    var stocklist = logging.getEODMaster()
    console.log(logging.getEODMaster())
    var symbolDistinct = []
    stocklist.forEach(function (symbol) {
      //if(symbol[0] =='A' )//symbol[0] != '' )
      {
        symbolDistinct.push(symbol)
      }
    })
    var list = jQuery.unique(symbolDistinct).sort()
    console.log(list)
    console.log(list.length)
    return list;
  },

  SymbolList: function (symbolStart,callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    var symbolDistinct = []
    var query = new azure.TableQuery()
    AzureStorage.GetTable('Top1000', tableService, query, function (data) {
      data = data.sort()
      data.forEach(function (x) {
          symbolDistinct.push(Object.values(x.RowKey)[1])
      })
      AzureStorage.GetTable('Second1000', tableService, query, function (data) {
        data = data.sort()
        data.forEach(function (x) {
                  symbolDistinct.push(Object.values(x.RowKey)[1])  
        })
        AzureStorage.GetTable('Third1000', tableService, query, function (data) {
          data = data.sort()
          data.forEach(function (x) {
            symbolDistinct.push(Object.values(x.RowKey)[1])
          })
          AzureStorage.GetTable('Fourth1000', tableService, query, function (data) {
            data = data.sort()
            data.forEach(function (x) {
              symbolDistinct.push(Object.values(x.RowKey)[1])
            })
            AzureStorage.GetTable('Last1000', tableService, query, function (data) {
              data = data.sort()
              data.forEach(function (x) {
                symbolDistinct.push(Object.values(x.RowKey)[1])
              })
             
              var symbols = symbolDistinct.sort().filter(onlyUnique)
              if(symbolStart == "REVERSE"){
                symbols = symbols.reverse()
                
              }
              if(symbolStart == "REVERSE"||symbolStart == "NORMAL"){
                symbols = symbols.slice(0, Math.ceil(symbols.length/2));
              }
              
              console.log("symbollist length:"+ symbols.length)
              callback(symbols)
            }
            )
          }
          )
        }
        )
      }
      )
    }
    )

  },
  SymbolList1000: function (callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    var symbolDistinct = []
    var query = new azure.TableQuery()//Top1000
    AzureStorage.GetTable('Top1000', tableService, query, function (data) {
      data.forEach(function (x) {
        symbolDistinct.push(Object.values(x.RowKey)[1])
      })
      var etfs = ["QQQ", "UPRO", "VOX", "XLB",
        "XLY",
        "XLP",
        "XLE",
        "XLF",
        "XLV",
        "XLI",
        "VNQ",
        "XLK",
        "XLU",
        "GLD",
        "TLT",
        "SPY",
        "VIXY",
        "BIL"]
      symbolDistinct = symbolDistinct.concat(etfs)
      callback(symbolDistinct.reverse())
    }
    )

  },
  EtfListAndSymbols: function (universe,callback) {
    var tableService = azure.createTableService(AzureSecrets.STORAGE_ACCOUNT, AzureSecrets.ACCESS_KEY);
    var symbolDistinct = []
    var query = new azure.TableQuery()//Top1000
    AzureStorage.GetTable(universe, tableService, query, function (data) {
      data.forEach(function (x) {
        symbolDistinct.push(Object.values(x.RowKey)[1])
      })
      var etfs = ["QQQ", "UPRO", "VOX", "XLB",
        "XLY",
        "XLP",
        "XLE",
        "XLF",
        "XLV",
        "XLI",
        "VNQ",
        "XLK",
        "XLU",
        "GLD",
        "TLT",
        "SPY",
        "VIXY",
        "BIL"]
      symbolDistinct = symbolDistinct.concat(etfs)
      callback(symbolDistinct.reverse())
    }
    )

  }
  ,


  TwoSigma: function () {
    //console.log(logging.GetStockList()[0])
    var stocklist = JSON.parse(logging.GetStockList()).obj//[0].replace('{','').split(/},{/);
    console.log(stocklist)
    var symbolDistinct = []
    stocklist.forEach(function (line) {
      var symbol = JSON.parse(line).symbol
      if (symbol[0] == 'A') {
        symbolDistinct.push(symbol)
      }
    })
    var list = jQuery.unique(symbolDistinct).sort()
    console.log(list)
    console.log(list.length)
    return list;
  }
}

/**
 * Convert data in CSV (comma separated value) format to a javascript array.
 *
 * Values are separated by a comma, or by a custom one character delimeter.
 * Rows are separated by a new-line character.
 *
 * Leading and trailing spaces and tabs are ignored.
 * Values may optionally be enclosed by double quotes.
 * Values containing a special character (comma's, double-quotes, or new-lines)
 *   must be enclosed by double-quotes.
 * Embedded double-quotes must be represented by a pair of consecutive 
 * double-quotes.
 *
 * Example usage:
 *   var csv = '"x", "y", "z"\n12.3, 2.3, 8.7\n4.5, 1.2, -5.6\n';
 *   var array = csv2array(csv);
 *  
 * Author: Jos de Jong, 2010
 * 
 * @param {string} data      The data in CSV format.
 * @param {string} delimeter [optional] a custom delimeter. Comma ',' by default
 *                           The Delimeter must be a single character.
 * @return {Array} array     A two dimensional array containing the data
 * @throw {String} error     The method throws an error when there is an
 *                           error in the provided data.
 */
function csv2array(data, delimeter) {
  // Retrieve the delimeter
  if (delimeter == undefined)
    delimeter = ',';
  if (delimeter && delimeter.length > 1)
    delimeter = ',';

  // initialize variables
  var newline = '\n';
  var eof = '';
  var i = 0;
  var c = data.charAt(i);
  var row = 0;
  var col = 0;
  var array = new Array();

  while (c != eof) {
    // skip whitespaces
    while (c == ' ' || c == '\t' || c == '\r') {
      c = data.charAt(++i); // read next char
    }

    // get value
    var value = "";
    if (c == '\"') {
      // value enclosed by double-quotes
      c = data.charAt(++i);

      do {
        if (c != '\"') {
          // read a regular character and go to the next character
          value += c;
          c = data.charAt(++i);
        }

        if (c == '\"') {
          // check for escaped double-quote
          var cnext = data.charAt(i + 1);
          if (cnext == '\"') {
            // this is an escaped double-quote. 
            // Add a double-quote to the value, and move two characters ahead.
            value += '\"';
            i += 2;
            c = data.charAt(i);
          }
        }
      }
      while (c != eof && c != '\"');

      if (c == eof) {
        throw "Unexpected end of data, double-quote expected";
      }

      c = data.charAt(++i);
    }
    else {
      // value without quotes
      while (c != eof && c != delimeter && c != newline && c != ' ' && c != '\t' && c != '\r') {
        value += c;
        c = data.charAt(++i);
      }
    }

    // add the value to the array
    if (array.length <= row)
      array.push(new Array());
    array[row].push(value);

    // skip whitespaces
    while (c == ' ' || c == '\t' || c == '\r') {
      c = data.charAt(++i);
    }

    // go to the next row or column
    if (c == delimeter) {
      // to the next column
      col++;
    }
    else if (c == newline) {
      // to the next row
      col = 0;
      row++;
    }
    else if (c != eof) {
      // unexpected character
      throw "Delimiter expected after character " + i;
    }

    // go to the next character
    c = data.charAt(++i);
  }

  return array;
}

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}


