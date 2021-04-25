var azure = require('azure-storage');
const fs = require('fs');
const AzureSecrets = require('./Secrets/Azure')
const logging = require('./logging');
/*
*********** set environment variable ******************
*/

//var nextContinuationToken = null;
var entities = []
function GetTable(tableName, tableService, query, callback, nextContinuationToken) {


  tableService.queryEntities(tableName, query, nextContinuationToken, function (error, results) {
    if (error) {
      throw error
    }
    else {
      results.entries.forEach(function (x) {

        entities.push(x)
      }
      )

      if (results.continuationToken) {
        GetTable(tableName, tableService, query, callback, results.continuationToken);
      }
      else {
        var entry = entities
        entities = []
        callback(entry)
      }
    }
  });

}
function GetDaily(tableName, tableService, query, callback) {

  var nextContinuationToken = null;
  tableService.queryEntities(tableName, query, nextContinuationToken, function (error, results) {
    if (error) throw error;

    if (results.continuationToken) {
      nextContinuationToken = results.continuationToken;
    }
    callback && callback(results.entries)
  });

}
module.exports = {
  GetDaily: function (tableName, tableService, query, callback) {
    GetDaily(tableName, tableService, query, callback)
  },
  GetTable: function (tableName, tableService, query, callback) {
    GetTable(tableName, tableService, query, callback, null)
  },
  ToTable: function (tableName, tableService, task,data,date) {
    
    tableService.insertOrMergeEntity(tableName, task, function (error, result, response) {
      if (!error) {
        console.log(data.symbol+" entered:"+data['backtest Date'])
        
      }
      else {
        console.log(error)
          tableService.createTableIfNotExists(tableName, function (error, result) {
             logging.appendToErrorLog(tableName,data,error)
          });
        logging.appendToErrorLog(tableName,data,[date,error])
      }

    });
  },
  GetEtfDictionary: function (fileService, callback) {
    fileService.getFileToText('etf-dictionary', '', 'SectorEtfs.txt', function (error, result) {
      if (error) {
        console.log("error");
        console.log(error);
      } else {
        callback(JSON.parse(result))
      }
    })

  },
  GetSectorEtfs: function (fileService, callback) {
    fileService.getFileToText('etf-dictionary', '', 'SectorEtfs.txt', function (error, result) {
      if (error) {
        console.log("error");
        console.log(error);
      } else {
        callback(Object.values(JSON.parse(result)))
      }
    })

  },
  GetBacktest: function (fileService, callback) {
    fileService.getFileToText('etf-dictionary', '', 'SectorEtfs.txt', function (error, result) {
      if (error) {
        console.log("error");
        console.log(error);
      } else {
        callback(Object.values(JSON.parse(result)))
      }
    })

  },
  StoreOrders: function (data, symbol, fileService) {
    var day = new Date().toJSON().slice(0, 10)
    var datetime = new Date().toJSON().slice(10, 16)
    fileService.createShareIfNotExists('orders', function (error, result, response) {
      if (!error) {
        if (result) {
          // console.log(response)
          //  console.log("Share Created")
        } else {
          console.log("Beta Existed")
        }
      }
      else {
        console.log(error)
      }

      fileService.createDirectoryIfNotExists('orders', day, function (error, result, response) {
        if (!error) {
          if (result) {
            // console.log(response)
            //  console.log("Share Created")
          } else {
            console.log("Beta Existed")
          }
        }
        else {
          console.log(error)
        }
        var rand = Math.random() * 16
        fileService.createFileFromText('orders', day, symbol + '_' + rand + '.txt', JSON.stringify(data), function (error, result, response) {
          if (!error) {
            console.log("file created")
          }
          else {
            console.log('directory error creating azure file storage ' + data + '_' + day)
            console.log(error)
          }
        })
      })
    })
  }
  ,
  StoreFactors: function (data, strategy, backDate, fileService) {
    var day = new Date().toJSON().slice(0, 10)
    var datetime = new Date().toJSON().slice(10, 16)
    fileService.createShareIfNotExists('factors', function (error, result, response) {
      if (!error) {
        if (result) {
          // console.log(response)
          //  console.log("Share Created")
        } else {
          console.log("factors Existed")
        }
      }
      else {
        console.log(error)
      }

      fileService.createDirectoryIfNotExists('factors', strategy, function (error, result, response) {
        if (!error) {
          if (result) {
            // console.log(response)
            //  console.log("Share Created")
          } else {
            console.log("factors Existed")
          }
        }
        else {
          console.log(error)
        }
        var rand = Math.random() * 16
        fileService.createFileFromText('factors', strategy, strategy + '_' + backDate + '.txt', JSON.stringify(data), function (error, result, response) {
          if (!error) {
            console.log("file created")
          }
          else {
            console.log('directory error creating azure file storage ' + data + '_' + day)
            console.log(error)
          }
        })
      })
    })
  },
  StoreBeta: function (data, fileService) {
    var day = new Date().toJSON().slice(0, 10)
    fileService.createShareIfNotExists('beta', function (error, result, response) {
      if (!error) {
        if (result) {
          // console.log(response)
          //  console.log("Share Created")
        } else {
          console.log("Beta Existed")
        }
      }
      else {
        console.log(error)
      }

      fileService.createDirectoryIfNotExists('beta', 'beta', function (error, result, response) {
        if (!error) {
          if (result) {
            // console.log(response)
            //  console.log("Share Created")
          } else {
            console.log("Beta Existed")
          }
        }
        else {
          console.log(error)
        }

        fileService.createFileFromText('beta', 'beta', day + '.txt', JSON.stringify(data), function (error, result, response) {
          if (!error) {
            console.log("file created")
          }
          else {
            console.log('directory error creating azure file storage ' + data + '_' + day)
            console.log(error)
          }
        })
      })
    })
  }
  ,
  Upload: function (directory, stock, name, fileService, data) {

    fileService.createShareIfNotExists('scraper', function (error, result, response) {
      if (!error) {
        if (result) {
          // console.log(response)
          //  console.log("Share Created")
        } else {
          console.log("Share Existed")
        }
      }
      else {
        console.log(error)
      }
      fileService.createDirectoryIfNotExists('scraper', directory, function (error, result, response) {
        if (!error) {
          if (result) {
            //console.log(response)
            //  console.log("Directory Created")
          } else {
            console.log("Directory Existed")
          }
        }
        else {
          console.log(error)
        }
        directory = directory + '/' + stock
        fileService.createDirectoryIfNotExists('scraper', directory, function (error, result, response) {
          if (!error) {
            if (result) {
              //console.log(response)
              //   console.log("Directory Created")
            } else {
              console.log("Directory Existed")
            }
          }
          else {
            console.log(error)
          }
          fileService.createFileFromText('scraper', directory, stock + '_' + name + '.txt', data, function (error, result, response) {
            if (!error) {
              console.log("file created")
            }
            else {
              console.log('directory error creating azure file storage ' + stock + '_' + name)
              console.log(error)
            }
            console.log('\n')
          });

        });
      });
    });





  }
}