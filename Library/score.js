var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const logging = require('./logging');

const mkdirp = require('mkdirp');
const ncp = require('ncp').ncp;
const fs = require('fs');
const download = require('download');
const pd = require('paralleldots');
var firstTime = 0;
const apiKey = 'PKNYXL88E6BDB07YIQYY';
module.exports = {
NewsSentiment: function(symbol, algo){
      var url = 'https://api.polygon.io/v1/meta/symbols/'+symbol+'/news?perpage=15&page=1&apiKey='+apiKey;
  var xhttp = new XMLHttpRequest();
  var newsArray = [];
  xhttp.onreadystatechange = function() {

    if (this.readyState == 4 && this.status == 200) {
     
     var text = this.responseText.replace("'","")
                               .replace("(","").replace(')','')
                               .replace("\'", "")
          
     var news = JSON.parse(text)
     for (var i in news)
     {    
      var timestamp =  new Date(news[i].timestamp);
      var date = new Date();
          date.setMonth(date.getMonth() - 3);
      var entry = news[i].title.replace('"','').replace("'","").replace("\'","").replace("(","").replace(')','')
      if (date < timestamp){
      newsArray.push(entry);
      }
     }
     var twentydaysOfNews = newsArray.slice(0,15);
    
     var newsResult = JSON.stringify(twentydaysOfNews).replace("'","").replace("(","").replace(')','')
     logging.News(symbol, twentydaysOfNews, algo);
         var path = 'Algorithm/'+algo+'/info/'+symbol+'/sentiment.txt';    
               fs.open(path, 'wx', (err, fd) => {
                  if (err) {
                    if (err.code === 'EEXIST') {
                        var stat = fs.statSync(path).atime;
                        var date = new Date(stat)
                        var now = new Date()
                        
                      if(date.getFullYear() <= now.getFullYear() && date.getMonth() <= now.getMonth()
                         && date.getDay() < now.getDay()){
                          logging.News(symbol, twentydaysOfNews, algo);
                         getSentiment(newsResult,symbol,algo);                      
                      } 
                      
                      return;
                    } else{
                      logging.News(symbol, twentydaysOfNews, algo);
                      getSentiment(newsResult,symbol,algo);
                    }         
                    
                  }
                  else
                    {
                      logging.News(symbol, twentydaysOfNews, algo);
                      return twentydaysOfNews;
                       getSentiment(newsResult,symbol,algo);
                    }  
                    
                });   
    }
  };
  xhttp.open("GET", url, false);
  xhttp.send();

  },

  Analysis: function(symbol, algo){
   var callAnalysis = new Promise(function(resolve,reject){ 
    
  var url2 = 'https://api.polygon.io/v1/meta/symbols/'+symbol+'/analysts?apiKey='+apiKey;
  var xhttp2 = new XMLHttpRequest();
  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {

    resolve(this.responseText);   
    }
  };
  xhttp2.open("GET", url2, false);
  xhttp2.send();      
        
     })
      var sell = 0;
      var buy = 0;
      var keys = ["current","month1","month2","month3"]
      var results = [0,0,0,0]
      let stockQuote =  callAnalysis.then(function(value) {
    
          var numAnalyst = JSON.parse(value).analysts;
          var change = JSON.parse(value).change;
          var updated = JSON.parse(value).updated;

          for(key in keys){
           
            
            results[key] += -1*JSON.parse(value).sell[keys[key]]/numAnalyst;
            results[key] += -2*JSON.parse(value).strongSell[keys[key]]/numAnalyst;
            results[key] += JSON.parse(value).buy[keys[key]]/numAnalyst;
            results[key] += 2*JSON.parse(value).strongBuy[keys[key]]/numAnalyst;
            
          }
          var delta = 'none'
          if (results[0] > (results[1]+results[2]+results[3])/3)
          {
              delta = 'hot'
          }
          if (results[0] < (results[1]+results[2]+results[3])/3)
          {
              delta = 'cold'
          }
            
            var q = new Date();
            var m = q.getMonth();
            var y = q.getFullYear();
            var date = new Date(y,q);
            mydate=new Date(updated);
             q = new Date();
             var mm = mydate.getMonth();
             var yy = mydate.getFullYear();
            var analysis = {Analysis:{
              avg: ((results[1]+results[2]+results[3]+results[0])/4).toFixed(2),
              weight: numAnalyst,
               change: change,
               signal: delta,

               "updated": (yy == y && !(1-m>mm))
            }
          }
           logging.Analysis(symbol, analysis,algo)
            return analysis;
        });
       return stockQuote.then(function(data){
        return JSON.stringify(data)
      });
  },
  
   LastQuote: function(symbol, algo){

   var lastQuote = new Promise(function(resolve,reject){ 
 
  var url2 = 'https://api.polygon.io/v1/meta/symbols/'+symbol+'/analysts?apiKey='+apiKey;
  var xhttp2 = new XMLHttpRequest();
  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
    resolve(this.responseText);   
    }
  };
  xhttp2.open("GET", url2, false);
  xhttp2.send();      
        
     })
      
        lastQuote.then(function(value) {
          logging.LastQuote(symbol, value,algo)
            return value;
        });

  },

  Company: function(symbol, algo){

   var company = new Promise(function(resolve,reject){ 
  
  var url2 = 'https://api.polygon.io/v1/meta/symbols/'+symbol+'/company?apiKey='+apiKey;
  var xhttp2 = new XMLHttpRequest();
  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
    resolve(this.responseText);   
    }
  };
  xhttp2.open("GET", url2, false);
  xhttp2.send();      
        
     })
      
        company.then(function(value) {
             logging.Company(symbol, value,algo)
            return value;
        });

  },
  Dividends: function(symbol, algo){

   var dividends = new Promise(function(resolve,reject){ 
  
  var url2 = 'https://api.polygon.io/v1/meta/symbols/'+symbol+'/analysts?apiKey='+apiKey;
  var xhttp2 = new XMLHttpRequest();
  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
    resolve(this.responseText);   
    }
  };
  xhttp2.open("GET", url2, false);
  xhttp2.send();      
        
     })
      
        dividends.then(function(value) {
            logging.Dividends(symbol, value,algo)
            return value;
        });

  },
  Splits: function(symbol, algo){

   var splits = new Promise(function(resolve,reject){ 
  
  var url2 = 'https://api.polygon.io/v1/meta/symbols/'+symbol+'/splits?apiKey='+apiKey;
  var xhttp2 = new XMLHttpRequest();
  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
    resolve(this.responseText);   
    }
  };
  xhttp2.open("GET", url2, false);
  xhttp2.send();      
        
     })
      
        splits.then(function(value) {
         logging.Splits(symbol, value,algo)
            return value;
        });

  },
  Earnings: function(symbol, algo){

   var earnings = new Promise(function(resolve,reject){ 
  
  var url2 = 'https://api.polygon.io/v1/meta/symbols/'+symbol+'/earnings?apiKey='+apiKey;
  var xhttp2 = new XMLHttpRequest();
  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
    resolve(this.responseText);   
    }
  };
  xhttp2.open("GET", url2, false);
  xhttp2.send();      
        
     })
      
        earnings.then(function(value) {
         logging.Earnings(symbol, value,algo)
            return value;
        });

  },
  Financials: function(symbol,algo){

   var financials = new Promise(function(resolve,reject){ 
  
  var url2 = 'https://api.polygon.io/v1/meta/symbols/'+symbol+'/financials?apiKey='+apiKey;
  var xhttp2 = new XMLHttpRequest();
  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
    resolve(this.responseText);   
    }
  };
  xhttp2.open("GET", url2, false);
  xhttp2.send();      
        
     })
      
        financials.then(function(value) {
         logging.Financials(symbol, value,algo)
            return value;
        });

  },

  LastQuote: function(symbol, algo){

   var lastQuote = new Promise(function(resolve,reject){ 
  
  var url2 = 'https://api.polygon.io/v1/last_quote/stocks/'+symbol+'?apiKey='+apiKey;
  var xhttp2 = new XMLHttpRequest();
  xhttp2.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
    resolve(this.responseText);   
    }
  };
  xhttp2.open("GET", url2, false);
  xhttp2.send();      
        
     })
      
        lastQuote.then(function(value) {
         logging.LastQuote(symbol, value,algo)
            return value;
        });

  }
  
}

function getSentiment(newsResult,symbol,algo){
   
    pd.sentimentBatch(newsResult,'en')
      .then((response) => {
          
        var sentiment = JSON.parse(response).sentiment;
      
      if (sentiment != null && sentiment != undefined){
       var neg = 0;
       var pos = 0;
       var negative = 0;
       var positive = 0;
       var count = 0;
       if (sentiment.length > 0){
        count = sentiment.length;
       }
       
       var signal = 'none';
       var alertCount = 0;
       var alert = 'none';
        sentiment.forEach(function(x){
          neg += x.negative;
          pos += x.positive;
          if (x.negative>.5)
          {
            alertCount +=1;
          }
         
        });
        if (count > 0)
        {
          var firstPos = sentiment[0].positive;
          var firstNeg = sentiment[0].negative; 
          if(count > 1)
          {
            var secondPos = sentiment[1].positive;
            var secondNeg = sentiment[1].negative; 
          }
           negative = neg/sentiment.length;
           positive = pos/sentiment.length;
           if ((firstPos > positive||secondPos >positive) && firstPos > negative){
            signal = 'hot'
           }
           if ((firstNeg > negative||secondNeg >negative) && firstNeg > positive){
            signal = 'cold'
           }
           if(alertCount ==1 || alertCount > .1*count)
           {
            alert = 'concern'
           }
           if (alertCount > .2*count)
           {
            alert = 'avoid'
           }
        }
        
        var setAvg =  {Sentiment:{ avg: (positive + (-1*negative)).toFixed(2),
         weight: count, signal: signal,alert: alert}};
                    logging.Sentiment(symbol, setAvg,algo)
                    return setAvg;
          }
         
    }).catch((error) =>{
        console.log(error);
   })
  }
  