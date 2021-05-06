
const MongoClient = require('mongodb').MongoClient;
const MongoDbUri = require('./Secrets/Azure').MongoDbUri()
const fs = require('fs');
const { isPlainObject, result, toArray } = require('lodash');

module.exports = {

  Delete: function (tableName) {
    var client = new MongoClient(MongoDbUri.URI, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {
      const collection = client.db("Fundamentals").collection(tableName);
      collection.drop()
        .then(result => {
          console.log(result)
          client.close();
        })
        .catch(err => console.error(`Failed to drop:${tableName} ${symbol} ${err}`)
        )

    });
  },
  Upsert: function (tableName, symbol, data) {
    var client = new MongoClient(MongoDbUri.URI, { useNewUrlParser: true, useUnifiedTopology: true });

    var query = { "name": symbol };
    var options = { "upsert": true };
    var update = {
      "$push": {
        "history": JSON.parse(data)
      }
    };

    client.connect(err => {
      const collection = client.db("Fundamentals").collection(tableName);
      collection.updateOne(query, update, options)
        .then(result => {
          const { matchedCount, modifiedCount } = result;
          if (matchedCount && modifiedCount) {
            console.log(`Successfully added a new record.`)

          }  
          client.close();
        })
        

    });
    
  },


  GetMongoFundamentals: function (date, factor, factorArray, callback) {

    var array = {}
    var client = new MongoClient(MongoDbUri.URI, { useNewUrlParser: true, useUnifiedTopology: true });
    client.connect(err => {

      client.db("Fundamentals").collection(factor).find({}).toArray((error, result) => {
        console.log(error)
        if (!error) {

          result.forEach(function (entity) {
            //  console.log(entity)


            try {
              var index = entity.history.length - 1
              var jsonString = '"symbol":"' + Object.keys(entity.history[index])[0] + '",'
              Object.values(Object.values(entity.history[index])[0][0])[0].forEach(function (x) {
                var d1 = new Date(date);
                d1.setFullYear(d1.getFullYear())
                jsonString += '"backtest Date":"' + d1.toJSON().slice(0, 10).toString() + '",'
                var d2 = new Date(date);
                d2.setFullYear(d1.getFullYear() - 1)
                factorArray.forEach(
                  function (factor) {
                    if (x[factor]) {
                      var unentered1 = true
                      var unentered2 = true
                      x[factor].forEach(function (row) {
                        var factorIndex = x[factor].length
                        var reportDate = new Date(Object.keys(row)[0]);
                        //2020-10-25, 2019-10-25, 2020-07-01
                        //  console.log(d1.toJSON().slice(0, 10),d2.toJSON().slice(0, 10), reportDate.toJSON().slice(0, 10))

                        if (d1 > reportDate && unentered1) {
                          unentered1 = false
                          jsonString += '"' + factor + '":' + Object.values(row)[0] + ','
                          jsonString += '"' + factor + '_REPORT_DATE' + '":"' + reportDate.toJSON().slice(0, 10).toString() + '",'
                        }
                        if (d2 > reportDate && unentered2) {
                          unentered2 = false
                          jsonString += '"' + factor + '_lastYear":' + Object.values(row)[0] + ','
                          jsonString += '"' + factor + '_lastYear_REPORT_DATE' + '":"' + reportDate.toJSON().slice(0, 10).toString() + '",'
                        }

                        factorIndex--
                      })

                    }
                  }
                )
              })
              var jsonify = '{' + (jsonString.substring(0, jsonString.length - 1)) + '}'
              callback(jsonify)
              client.close();
              // array[JSON.parse(jsonify).symbol] = JSON.parse(jsonify)
            } catch {
              client.close();
              //  console.log("failed")
              //  console.log(jsonify)
            }

          })
          // console.log(array)
          // callback()
        }
      })

    });

  },


  GetMongoShortVolume: function (date, factor, callback) {
    console.log("mongo short volume")
    var array = {}
    var client = new MongoClient(MongoDbUri.URI, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {
      console.log("in connect")
      client.db("Fundamentals").collection("ShortVolume").find({}).toArray((error, result) => {
        console.log("in collection")
        if (!error) {
          console.log("inside client")

          result.forEach(function (entity) {
            console.log("inside client")
            var unentered1 = true
            var unentered2 = true
            var unentered3 = true
            var unentered4 = true
            var unentered5 = true
            var unentered6 = true

            try {
              var index = entity.history.length - 1
              var jsonString = '"symbol":"' + entity.name + '",'
              var d1 = new Date(date);
              jsonString += '"backtest Date":"' + d1.toJSON().slice(0, 10).toString() + '",'
              var d2 = new Date(date);
              d2.setDate(d1.getDate() - 1);
              var d3 = new Date(date);
              d3.setDate(d1.getDate() - 2);
              var d4 = new Date(date);
              d4.setDate(d1.getDate() - 3);
              var d5 = new Date(date);
              d5.setDate(d1.getDate() - 4);
              var d6 = new Date(date);
              d6.setDate(d1.getDate() - 5);

              Object.values(Object.values(entity.history[index].dataset.data)).forEach(function (x) {
                var reportDate = new Date(x[0]);
                if (d1 > reportDate && unentered1) {
                  unentered1 = false
                  jsonString += '"' + 'ShortVolume1' + '":' + x[1] + ','
                  jsonString += '"' + 'TotalVolume1' + '":' + x[3] + ','
                }


                if (d2 > reportDate && unentered2) {
                  unentered2 = false
                  jsonString += '"' + 'ShortVolume2' + '":' + x[1] + ','
                  jsonString += '"' + 'TotalVolume2' + '":' + x[3] + ','
                }


                if (d3 > reportDate && unentered3) {
                  unentered3 = false
                  jsonString += '"' + 'ShortVolume3' + '":' + x[1] + ','
                  jsonString += '"' + 'TotalVolume3' + '":' + x[3] + ','
                }


                if (d4 > reportDate && unentered4) {
                  unentered4 = false
                  jsonString += '"' + 'ShortVolume4' + '":' + x[1] + ','
                  jsonString += '"' + 'TotalVolume4' + '":' + x[3] + ','
                }


                if (d5 > reportDate && unentered5) {
                  unentered5 = false
                  jsonString += '"' + 'ShortVolume5' + '":' + x[1] + ','
                  jsonString += '"' + 'TotalVolume5' + '":' + x[3] + ','
                }
                if (d6 > reportDate && unentered6) {
                  unentered6 = false
                  jsonString += '"' + 'ShortVolume6' + '":' + x[1] + ','
                  jsonString += '"' + 'TotalVolume6' + '":' + x[3] + ','
                }

              })
              var jsonify = '{' + (jsonString.substring(0, jsonString.length - 1)) + '}'
             // console.log(jsonify)
              var obj = JSON.parse(jsonify)
              var day1 = obj.ShortVolume1 * obj.ShortVolume1 / obj.TotalVolume1
              var day2 = obj.ShortVolume2 * obj.ShortVolume2 / obj.TotalVolume2
              var day3 = obj.ShortVolume3 * obj.ShortVolume3 / obj.TotalVolume3
              var day4 = obj.ShortVolume4 * obj.ShortVolume4 / obj.TotalVolume4
              var day5 = obj.ShortVolume5 * obj.ShortVolume5 / obj.TotalVolume5
              var day6 = obj.ShortVolume6 * obj.ShortVolume6 / obj.TotalVolume6
              var wkAvg = (day2 + day3 + day4 + day5 + day6) / 5

              callback({ 'symbol': obj.symbol, 'growthDiff': (wkAvg - day1), 'shortWeekAvg': wkAvg, 'shortDay': day1, 'backtest Date': obj['backtest Date'] })
              client.close();
            } catch {
              console.log("failed")
            }

          })

        }
        else {
          console.log("error")
          console.log(result)
        }
      })

    });

  },//SectorETFWeekly

  GetMongoPMI: function (date, factor, callback) {

    var array = {}
    var client = new MongoClient(MongoDbUri.URI, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {

      client.db("Fundamentals").collection(factor).find({}).toArray((error, result) => {

        if (!error) {


          result.forEach(function (entity) {
            var unentered1 = true
            var unentered2 = true

            try {
              var index = entity.history.length - 1
              var jsonString = ''
              var d1 = new Date(date);
              var d2 = new Date(date);
              d2.setDate(d2.getDate() - 32);
              jsonString += '"backtest Date":"' + d1.toJSON().slice(0, 10).toString() + '",'


              Object.values(Object.values(entity.history[index].dataset.data)).forEach(function (x) {
                var reportDate = new Date(x[0]);
                if (d1 > reportDate && unentered1) {
                  unentered1 = false
                  jsonString += '"' + 'presentDate' + '":"' + reportDate.toJSON().slice(0, 10).toString() + '",'
                  jsonString += '"' + 'presentPmi' + '":' + x[1] + ','
                }
                else if (d2 > reportDate && unentered2) {
                  unentered2 = false
                  jsonString += '"' + 'lastDate' + '":"' + reportDate.toJSON().slice(0, 10).toString() + '",'
                  jsonString += '"' + 'lastPmi' + '":' + x[1] + ','
                }

              })
              var jsonify = '{' + (jsonString.substring(0, jsonString.length - 1)) + '}'
              var obj = JSON.parse(jsonify)
              callback(obj)
              client.close();
            } catch {
              console.log("failed")
              //  console.log(jsonify)
            }

          })

          // callback()
        }
      })

    });

  },

  GetMongoVIX: function (date, factor, callback) {

    var array = {}
    var client = new MongoClient(MongoDbUri.URI, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {

      client.db("Fundamentals").collection(factor).find({}).toArray((error, result) => {

        if (!error) {


          result.forEach(function (entity) {
            var unentered1 = true

            try {
              var index = entity.history.length - 1
              var jsonString = ''
              var d1 = new Date(date);

              jsonString += '"backtest Date":"' + d1.toJSON().slice(0, 10).toString() + '",'


              Object.values(Object.values(entity.history[index].dataset.data)).forEach(function (x) {
                var reportDate = new Date(x[0]);
                if (d1 > reportDate && unentered1) {
                  unentered1 = false
                  jsonString += '"' + 'vixDay' + '":"' + reportDate.toJSON().slice(0, 10).toString() + '",'
                  jsonString += '"' + 'vixAvg' + '":' + (x[1] + x[2] + x[3] + x[4] + x[5]) / 5 + ','
                  jsonString += '"' + 'vixChange' + '":' + x[6] + ','
                }


              })
              var jsonify = '{' + (jsonString.substring(0, jsonString.length - 1)) + '}'
              var obj = JSON.parse(jsonify)
              callback(obj)
              client.close();
            } catch {
              console.log("failed")
              //  console.log(jsonify)
            }

          })

          // callback()
        }
      })

    });
  },

  GetMongoSectorEtf: function (date, factor, callback) {
    var d1 = new Date(date);
    var d2 = new Date(date);
    d2.setDate(d2.getDate() - 7);
    var array = {}
    var client = new MongoClient(MongoDbUri.URI, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {

      client.db("Fundamentals").collection(factor).find({}).toArray((error, result) => {
        var jsonCollectionstring = ''
        if (!error) {


          result.forEach(function (entity) {
            console.log(entity)
            var unentered1 = true
            var unentered2 = true

            try {
              var index = entity.history.length - 1
              var jsonString = ''

              jsonString += '"backtest Date":"' + d1.toJSON().slice(0, 10).toString() + '",'

              var index = entity.history.length - 1
              //  jsonString += '"symbol":"' +entity.name + '",'
              var columnName = "Weekly Adjusted Time Series"
              Object.values(Object.keys(entity.history[index][columnName])).forEach(function (x) {
                // console.log(x)
                var open = '1. open'//: '151.4300',
                var high = '2. high'//: '152.0500',
                var low = '3. low'//: '145.0800',
                var close = '5. adjusted close'//: '145.2400',
                var vol = '6. volume'//: '10857156'
                var reportDate = new Date(x);
                if (d1 > reportDate && unentered1) {
                  unentered1 = false

                  var openCurrent = Number(entity.history[index][columnName][x][open])
                  var highCurrent = Number(entity.history[index][columnName][x][high])
                  var lowCurrent = Number(entity.history[index][columnName][x][low])
                  var closeCurrent = Number(entity.history[index][columnName][x][close])
                  var volCurrent = Number(entity.history[index][columnName][x][vol])

                  var returnsCurrent = closeCurrent - openCurrent
                  var avgCurrent = (openCurrent + highCurrent + lowCurrent + closeCurrent) / 4

                  var stdDev = Math.sqrt((Math.pow(openCurrent - avgCurrent, 2) +
                    Math.pow(highCurrent - avgCurrent, 2) +
                    Math.pow(lowCurrent - avgCurrent, 2) +
                    Math.pow(closeCurrent - avgCurrent, 2) / 4))
                  jsonString += '"' + 'reportDateCurrent' + '":"' + reportDate.toJSON().slice(0, 10).toString() + '",'

                  jsonString += '"' + entity.name + 'sharpeCurrent' + '":' + returnsCurrent / stdDev + ','
                  jsonString += '"' + entity.name + 'volCurrent' + '":' + volCurrent + ','

                } else if (d2 > reportDate && unentered2) {
                  unentered2 = false

                  var openLast = Number(entity.history[index][columnName][x][open])
                  var highLast = Number(entity.history[index][columnName][x][high])
                  var lowLast = Number(entity.history[index][columnName][x][low])
                  var closeLast = Number(entity.history[index][columnName][x][close])
                  var volLast = Number(entity.history[index][columnName][x][vol])

                  var returnsLast = closeLast - openLast
                  var avgLast = (openLast + highLast + lowLast + closeLast) / 4
                  var stdDevLast = Math.pow(Math.pow(openLast - avgLast, 2) +
                    Math.pow(highLast - avgLast, 2) +
                    Math.pow(lowLast - avgLast, 2) +
                    Math.pow(closeLast - avgLast, 2), 2)

                  jsonString += '"' + 'reportDateLast' + '":"' + reportDate.toJSON().slice(0, 10).toString() + '",'
                  jsonString += '"' + entity.name + 'sharpeLast' + '":' + returnsLast / stdDevLast + ','
                  jsonString += '"' + entity.name + 'volLast' + '":' + volLast + ','

                }


              })
              var jsonify = '{' + (jsonString.substring(0, jsonString.length - 1)) + '}'
              var obj = JSON.parse(jsonify)
              //  console.log(obj)
              var obj2 = {}
              obj2[entity.name] = Number((obj[entity.name + 'volCurrent'] - obj[entity.name + 'volLast']) / obj[entity.name + 'volLast']).toFixed(2)
              //  + Number(obj[entity.name+ 'sharpeCurrent']).toFixed(2)
              //  +  Number(obj[entity.name+'sharpeLast']).toFixed(2)


              jsonCollectionstring += JSON.stringify(obj2).replace('{', ',').replace('}', "")

            } catch (ex) {
              console.log(ex)
              //  console.log(jsonify)
            }

          })
          const editedText = '{' + '"backtest Date":"' + d1.toJSON().slice(0, 10).toString() + '",' + jsonCollectionstring.substring(1, jsonCollectionstring.length) + '}'
          var edited = JSON.parse(editedText)
          //  console.log(jsonCollectionstring)
          callback(edited)
          client.close();
        }
      })

    });

  },

  GetMongoStockWeekly: function (date, factor, callback) {
    var d1 = new Date(date);
    var d2 = new Date(date);
    d2.setDate(d1.getDate() - 31);
    var array = {}
    var client = new MongoClient(MongoDbUri.URI, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {
      var columnName = "Weekly Adjusted Time Series"
      client.db("Fundamentals").collection(factor).find({}).toArray((error, result) => {
        var jsonCollectionstring = ''
        if (!error) {
          console.log("entity")

          result.forEach(function (entity) {
            var unentered1 = true
            var unentered2 = true

            try {
              var index = entity.history.length - 1
              var jsonString = ''

              jsonString += '"backtest Date":"' + d1.toJSON().slice(0, 10).toString() + '",'

              var index = entity.history.length - 1
              //  jsonString += '"symbol":"' +entity.name + '",'
              Object.values(Object.keys(entity.history[index][columnName])).forEach(function (x) {
                var open = '1. open'//: '151.4300',
                var high = '2. high'
                var low = '3. low'
                var adjustedClose = '5. adjusted close'
                var volume = '6. volume'

                var reportDate = new Date(x);
                // console.log("---------------------")
                // console.log(reportDate +' ==:== '+d1)
                // console.log(reportDate +' ==:== '+d2)
                if (d1 > reportDate && unentered1) {
                  unentered1 = false

                  var currentAdjOpen = Number(entity.history[index][columnName][x][open])
                  var currentAdjHigh = Number(entity.history[index][columnName][x][high])
                  var currentAdjLow = Number(entity.history[index][columnName][x][low])
                  var currentAdjClose = Number(entity.history[index][columnName][x][adjustedClose])
                  var currentAdjVolume = Number(entity.history[index][columnName][x][volume])

                  jsonString += '"' + 'reportDateCurrent' + '":"' + reportDate.toJSON().slice(0, 10).toString() + '",'
                  jsonString += '"currentAdjOpen":' + currentAdjOpen + ','
                  jsonString += '"currentAdjHigh":' + currentAdjHigh + ','
                  jsonString += '"currentAdjLow":' + currentAdjLow + ','
                  jsonString += '"currentAdjClose":' + currentAdjClose + ','
                  jsonString += '"currentAdjVolume":' + currentAdjVolume + ','

                } else if (d2 > reportDate && unentered2) {
                  unentered2 = false

                  var lastAdjOpen = Number(entity.history[index][columnName][x][open])
                  var lastAdjHigh = Number(entity.history[index][columnName][x][high])
                  var lastAdjLow = Number(entity.history[index][columnName][x][low])
                  var lastAdjClose = Number(entity.history[index][columnName][x][adjustedClose])
                  var lastAdjVolume = Number(entity.history[index][columnName][x][volume])

                  jsonString += '"' + 'reportDateLast' + '":"' + reportDate.toJSON().slice(0, 10).toString() + '",'
                  jsonString += '"lastAdjOpen":' + lastAdjOpen + ','
                  jsonString += '"lastAdjHigh":' + lastAdjHigh + ','
                  jsonString += '"lastAdjLow":' + lastAdjLow + ','
                  jsonString += '"lastAdjClose":' + lastAdjClose + ','
                  jsonString += '"lastAdjVolume":' + lastAdjVolume + ','
                }


              })
              var jsonify = '{' + (jsonString.substring(0, jsonString.length - 1)) + '}'
              var obj = JSON.parse(jsonify)
              obj.symbol = entity.name
              obj.growth = (obj.currentAdjClose - obj.lastAdjClose) / obj.lastAdjClose
              var wkGrowth = obj.currentAdjOpen - obj.currentAdjClose
              var lastWkGrowth = obj.lastAdjOpen = obj.lastAdjClose
              var monthAvg = (lastWkGrowth + wkGrowth) / 2
              var delta = (monthAvg + wkGrowth) / 2
              var trend = 0
              if (wkGrowth > 0) {
                trend = obj.currentAdjHigh - obj.currentAdjClose
              }
              else {
                trend = obj.currentAdjLow - obj.currentAdjClose
              }
              obj.direction = delta + trend
              callback(obj)
              client.close();

            } catch {
              console.log("failed")
              //  console.log(jsonify)
            }

          })

        }
      })

    });

  },
  

  GetMongoStockDaily: function (date, factor, callback) {
    var d1 = new Date(date);
    var client = new MongoClient(MongoDbUri.URI, { useNewUrlParser: true, useUnifiedTopology: true });
    client.connect(err => {
      var columnName = "Time Series (Daily)"
      console.log("obj")
      client.db("Fundamentals").collection(factor).find({}).toArray((error, result) => {
        var jsonCollectionstring = ''
       
        if (!error) {
         

          result.forEach(function (entity) {

            try {
              var index = entity.history.length - 1
              var jsonString = ''

              jsonString += '"backtest Date":"' + d1.toJSON().slice(0, 10).toString() + '",'

              var index = entity.history.length - 1
              //  jsonString += '"symbol":"' +entity.name + '",'
              if (entity.history[index][columnName]) {

                Object.values(Object.keys(entity.history[index][columnName])).forEach(function (x) {

                  var open = '1. open'//: '151.4300',
                  var high = '2. high'
                  var low = '3. low'
                  var close = '4. close'
                  var adjustedClose = '5. adjusted close'
                  var volume = '6. volume'

                  if (date == x) {

                    var open = Number(entity.history[index][columnName][x][open])
                    var high = Number(entity.history[index][columnName][x][high])
                    var low = Number(entity.history[index][columnName][x][low])
                    var close = Number(entity.history[index][columnName][x][close])
                    var adjustedClose = Number(entity.history[index][columnName][x][adjustedClose])
                    var volume = Number(entity.history[index][columnName][x][volume])

                    jsonString += '"open":' + open + ','
                    jsonString += '"high":' + high + ','
                    jsonString += '"low":' + low + ','
                    jsonString += '"close":' + close + ','
                    jsonString += '"adjustedClose":' + adjustedClose + ','
                    jsonString += '"volume":' + volume + ','
                    var jsonify = '{' + (jsonString.substring(0, jsonString.length - 1)) + '}'
                    var obj = JSON.parse(jsonify)
                    obj.symbol = entity.name
                    
                    callback(obj)
                    client.close();
                  }
                })
              }
              


            } catch (ex) {
              console.log(ex + "/n end catch")
            }

          })

        }
      })

    });

  }


}



