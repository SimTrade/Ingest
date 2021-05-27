// tools.js
// ========
var mkdirp = require('mkdirp');
LineReaderSync = require("line-reader-sync")
var getDirName = require('path').dirname;
var count =0;
var fs = require('fs');
const fsextra = require('fs-extra');
module.exports = {
	appendToErrorLog: function(folder,symbol,date,error){
		folder +='_failures'
		var file = date+"_"+symbol
		if (!fs.existsSync("Library/Logs/")){
			fs.mkdirSync("Library/Logs/");
		}
		if (!fs.existsSync("Library/Logs/"+folder)){
			fs.mkdirSync("Library/Logs/"+folder);
		}
		if (!fs.existsSync("Library/Logs/"+folder)){
			fs.mkdirSync("Library/Logs/"+folder);
		}
		fsextra.ensureFileSync("Library/Logs/"+folder+"/"+file+".json")
		var lines = fs.readFileSync("Library/Logs/"+folder+"/"+file+".json", 'utf-8')
		if(lines == ''){
			lines = '[]'
		}
		try{
			var table = JSON.parse(lines)
			table.push(error);
			fs.writeFileSync("Library/Logs/"+folder+"/"+file+".json", JSON.stringify(error));
		}
		catch(ex){
			console.log(ex)
			console.log("ex at line 34 /logging")
		}
		
	},
  CreateCSV: function(all,name, callback){
  	try{
  		var path = 'Library/TwoSigmaIntegration/csv/'
  		fs.writeFileSync(path+name+'.csv', all); 
		}catch(err)
		{
			console.log(err);
		}
		finally{
			callback(path,name)
		}
  },
  DeleteCSV: function(path,name){
  	fs.unlink(path+name+'.csv', (err) => {
  		if (err) throw err;
  		console.log(path+name+' was deleted');
	});
  },


  SetPositionsCSV: function(all,callback){
  	try{
  		fs.writeFileSync("Library/TwoSigmaIntegration/positions.csv", all); 
		}catch(err)
		{
			console.log(err);
		}
		finally{
			callback()
		}
  },
  PrintFigiList: function(all){
  	try{
  		fs.writeFileSync("Library/TwoSigmaIntegration/QuantopianFigi.csv", all); 
		}catch(err)
		{
			console.log(err);
		}
  },
  LogTwoSigmaStrategies: function(all){
  	try{
				fs.writeFileSync("Library/TwoSigmaIntegration/Strategies.txt", all); 
		}catch(err)
		{
			console.log(err);
		}
  },
  LogTwoSigmaInstruments: function(all) {
  	console.log(all)
  		try{
				fs.writeFileSync("Library/TwoSigmaIntegration/Figilist.txt", all); 
		}catch(err)
		{
			console.log(err);
		}

  },

  LogTwoSigmaPositions: function(all){
  	try{
				fs.writeFileSync("Library/TwoSigmaIntegration/TwoSigmaPositions.txt", all); 
		}catch(err)
		{
			console.log(err);
		}
  }, 
  GetCompanyProfile(symbol){
  	try{
				return fs.readFileSync("Library/Research/"+symbol+"/"+symbol+"_CompanyProfile.txt", 'utf-8'); 
				 
		}catch(err)
		{
			return null;
		}
  },
  GetFigi: function(){
  	try{
				return fs.readFileSync("Library/TwoSigmaIntegration/Figilist.txt", 'utf-8'); 
				 
		}catch(err)
		{
			console.log(err);
		}
  }, 
  GetFile: function(file){
  	try{
				return fs.readFileSync(file, 'utf-8'); 
				 
		}catch(err)
		{
			console.log(err);
		}
  }, 
  SetPrime: function(all){
  	try{
				fs.writeFileSync("Library/StockList/stocklist.txt", all); 
		}catch(err)
		{
			console.log(err);
		}
  },
  GetStockList: function () {
      var lines = fs.readFileSync("Library/StockList/stocklist.txt", 'utf-8')

    return lines;

	},
	newestlisttopVolume: function () {
  
      var lines = fs.readFileSync("Library/StockList/devList.txt", 'utf-8')
      .split('\n')
      .filter(Boolean);
    

    return lines;

	},
	clearPrimeList: function(){
		fs.writeFileSync("Library/StockList/stocklist.txt", '{"obj":[]}'); 

	},
	appendToPrimeList: function(line){
		var lines = fs.readFileSync("Library/StockList/stocklist.txt", 'utf-8')
		var table = JSON.parse(lines)
		table.obj.push(line);
		fs.writeFileSync("Library/StockList/stocklist.txt", JSON.stringify(table));
	},
	
	Analysis: function(symbol, value, algo){
		
    	var callPromise = new Promise(function(resolve,reject){ 
    		    		var done=	fs.promises.mkdir('Algorithm/'+algo+'/info/'+symbol, { recursive: true }).catch(console.error);
    		    	resolve(done);
    	})
    	callPromise.then(function(done) {
				fs.writeFileSync('Algorithm/'+algo+'/info/'+symbol+'/analysis.txt', JSON.stringify(value)); 
    	})
  
	},
	News: function(symbol, value, algo){
		var callPromise = new Promise(function(resolve,reject){ 
    		    		var done=	fs.promises.mkdir('Algorithm/'+algo+'/info/'+symbol, { recursive: true }).catch(console.error);
    		    	resolve(done);
    	})
    	callPromise.then(function(done) {
				fs.writeFileSync('Algorithm/'+algo+'/info/'+symbol+'/news.txt', JSON.stringify(value)); 
    	})
	},
	Sentiment: function(symbol, value, algo){
		var callPromise = new Promise(function(resolve,reject){ 
    		    		var done=	fs.promises.mkdir('Algorithm/'+algo+'/info/'+symbol, { recursive: true }).catch(console.error);
    		    	resolve(done);
    	})
    	callPromise.then(function(done) {
				fs.writeFileSync('Algorithm/'+algo+'/info/'+symbol+'/sentiment.txt', JSON.stringify(value)); 
    	})
	},
	Company: function(symbol, value, algo){
		var callPromise = new Promise(function(resolve,reject){ 
    		    		var done=	fs.promises.mkdir('Algorithm/'+algo+'/info/'+symbol, { recursive: true }).catch(console.error);
    		    	resolve(done);
    	})
    	callPromise.then(function(done) {
				fs.writeFileSync('Algorithm/'+algo+'/info/'+symbol+'/company.txt', JSON.stringify(value)); 
    	})
	},
	Dividends: function(symbol, value, algo){
		var callPromise = new Promise(function(resolve,reject){ 
    		    		var done=	fs.promises.mkdir('Algorithm/'+algo+'/info/'+symbol, { recursive: true }).catch(console.error);
    		    	resolve(done);
    	})
    	callPromise.then(function(done) {
				fs.writeFileSync('Algorithm/'+algo+'/info/'+symbol+'/dividends.txt', JSON.stringify(value)); 
    	})
	},
	Splits: function(symbol, value, algo){
		var callPromise = new Promise(function(resolve,reject){ 
    		    		var done=	fs.promises.mkdir('Algorithm/'+algo+'/info/'+symbol, { recursive: true }).catch(console.error);
    		    	resolve(done);
    	})
    	callPromise.then(function(done) {
				fs.writeFileSync('Algorithm/'+algo+'/info/'+symbol+'/splits.txt', JSON.stringify(value)); 
    	})
	},
	Earnings: function(symbol, value, algo){
		var callPromise = new Promise(function(resolve,reject){ 
    		    		var done=	fs.promises.mkdir('Algorithm/'+algo+'/info/'+symbol, { recursive: true }).catch(console.error);
    		    	resolve(done);
    	})
    	callPromise.then(function(done) {
				fs.writeFileSync('Algorithm/'+algo+'/info/'+symbol+'/earnings.txt', JSON.stringify(value)); 
    	})
	},
	Financials: function(symbol, value, algo){
		var callPromise = new Promise(function(resolve,reject){ 
    		    		var done=	fs.promises.mkdir('Algorithm/'+algo+'/info/'+symbol, { recursive: true }).catch(console.error);
    		    	resolve(done);
    	})
    	callPromise.then(function(done) {
				fs.writeFileSync('Algorithm/'+algo+'/info/'+symbol+'/financials.txt', JSON.stringify(value)); 
    	})
	},
	LastQuote: function(symbol, value, algo){
		var callPromise = new Promise(function(resolve,reject){ 
    		    		var done=	fs.promises.mkdir('Algorithm/'+algo+'/info/'+symbol, { recursive: true }).catch(console.error);
    		    	resolve(done);
    	})
    	callPromise.then(function(done) {
				fs.writeFileSync('Algorithm/'+algo+'/info/'+symbol+'/lastQuote.txt', value); 
    	})
	},
	logAllpaca: function(all){
		try{
				fs.writeFileSync("robinhood/logAllpaca.txt", all); 
		}catch(err)
		{
			console.log(err);
		}
	},
	logAlllongShortAccount: function(all){
		try{
				fs.writeFileSync("robinhood/logAlllongShortAccount.txt", all); 
		}catch(err)
		{
			console.log(err);
		}
	},
	logAllMyLongAccount: function(all){
		try{
				fs.writeFileSync("robinhood/logAllMyLongAccount.txt", all); 
		}catch(err)
		{
			console.log(err);
		}
	},
	logRH: function(rhPositions){
		try{
				fs.writeFileSync('robinhood/rhPositions.txt', rhPositions); 
		}catch(err)
		{
			console.log(err);
		}
	},
	getRH: function(algo){
		try{
			
			return JSON.parse(fs.readFileSync("robinhood/logAllpaca.txt", 'utf8')); 
		}catch(err)
		{
			console.log(err);
		}
	},
	getEODMaster: function(){
		var masterpath = 'transform/EODworkArea/master.csv';
	    if (fs.existsSync(masterpath)) {
		    try{
				return fs.readFileSync(masterpath, 'utf8').split('\n'); 
			}catch(err)
			{
			console.log(err);
			}
		}
	},
	getEodCsvs: function(){
		var masterpath = 'transform/EODworkArea/master.csv';
	     if (fs.existsSync(masterpath)) {
           fs.unlink(masterpath, (err) => {
   	       if (err) throw err;
        	 console.log('path was deleted');
        	}) 
  	    }
		try{
			var master = []
			  var alphabet = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
			  for(var i=0;i<alphabet.length;i++){
			  	var eod = fs.readFileSync("transform/EODworkArea/"+alphabet[i]+".csv", 'utf8')
				    var eodList = eod.split('\n')
					eodList.forEach(function(x){
						if ((!x.includes('-'))&& (!x.includes('.')) && x.length < 5){
							console.log(x)
								fs.appendFileSync(masterpath, x+'\n', function (err) {
            						 if (err) throw err; 
           						});
						}
					})
			  		
			  }
			
			 
		}catch(err)
		{
			console.log(err);
		}
	},
	getCSV: function(){
		try{
			
			return JSON.parse(fs.readFileSync("robinhood/logForCSV.txt", 'utf8')); 
		}catch(err)
		{
			console.log(err);
		}
	},
	setCSV: function(all){
		try{
				fs.writeFileSync("robinhood/logForCSV.txt", all); 
		}catch(err)
		{
			console.log(err);
		}
	},
	logReturns: function(returns, algo){
		try{
				fs.writeFileSync('Algorithm/'+algo+'/status/returns.txt', returns); 
		}catch(err)
		{
			console.log(err);
		}
	},
	logHighReturns: function(returns, algo){
		try{
				fs.writeFileSync('Algorithm/'+algo+'/status/highReturns.txt', returns); 
		}catch(err)
		{
			console.log(err);
		}
	},
	tallySharpe: function(sharpe, algo){
		try{
			//console.log("========== tallySharpe ================")
			
			var tenDaySharpe = fs.readFileSync('Algorithm/'+algo+'/status/sharpe.txt', 'utf8').split('\n'); 
				
					if (tenDaySharpe.length < 10){
						tenDaySharpe.push(sharpe);
					}
					else{
						tenDaySharpe.push(sharpe);
						tenDaySharpe.shift();
					}
    				fs.writeFileSync('Algorithm/'+algo+'/status/sharpe.txt', tenDaySharpe.join('\n')); 
				
		}catch(err)
		{
			console.log(err);
		}
	},
	logHighSharpe: function(sharpe, algo){
		try{
				fs.writeFileSync('Algorithm/'+algo+'/status/highSharpe.txt', sharpe); 
		}catch(err)
		{
			console.log(err);
		}
	},
	getHighReturns: function(algo){
		try{
				return fs.readFileSync('Algorithm/'+algo+'/status/highReturns.txt', 'utf8'); 
				 
		}catch(err)
		{
			console.log(err);
		}
	},
	getReturns: function(algo){
		try{
				return fs.readFileSync('Algorithm/'+algo+'/status/returns.txt', 'utf8'); 
				 
		}catch(err)
		{
			console.log(err);
		}
	},
	getTenDaySharpeAvg: function(algo){
		try{
				var tenDaySharpe = fs.readFileSync('Algorithm/'+algo+'/status/sharpe.txt', 'utf8').split('\n'); 
				
				var sum = 0;
			//	if (tenDaySharpe.length > 1){
			//		tenDaySharpe.pop();
			//	}
				
				
				for (i = 0; i < tenDaySharpe.length; i++) { 
					if (!isNaN(tenDaySharpe[i])){
						sum += Number(tenDaySharpe[i]);
						}
    				
					}
					//console.log(algo)
					//console.log(sum)
					//console.log(tenDaySharpe.length)
				return sum/tenDaySharpe.length;
		}catch(err)
		{
			console.log(err);
		}
	},
	getHighSharpe: function(algo){
		try{
				return fs.readFileSync('Algorithm/'+algo+'/status/highSharpe.txt', 'utf8'); 
		}catch(err)
		{
			console.log(err);
		}
	},

	
	getOrders: function(algo){
		
		try{
			var file = fs.readFileSync('Algorithm/'+algo+'/orders.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{"orders":[]}'));
			}
			else{

				return file;
			}
		}catch(err){
			fs.writeFileSync('Algorithm/'+algo+'/orders.txt', '{"orders":[]}')
			return JSON.stringify(JSON.parse('{"orders":[]}'));
		}
	},
	getLogOrders: function(algo){
		
		try{
			var file = fs.readFileSync('robinhood/logAllpaca.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{"orders":[]}'));
			}
			else{

				return file;
			}
		}catch(err)
		{
			console.log(err);
		}
	},
	getPositions: function(algo){
		var file = fs.readFileSync('Algorithm/'+algo+'/positions.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{"positions":[]}'));
			}
			else{

				return file;
			}
	},
	
	getValues: function(algo){
		var file = fs.readFileSync('Algorithm/'+algo+'/watch.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{"positions":[]}'));
			}
			else{

				return file;
			}
	},
	logToOrders: function (item, algo) {
		
		
		try{
						
				var file = fs.readFileSync('Algorithm/'+algo+'/orders.txt', 'utf8');
				
				if (file == '' || file == null)
				{
					var orderObj = JSON.parse('{"orders":[]}');
					orderObj['orders'].push(item);
					fs.writeFileSync('Algorithm/'+algo+'/orders.txt', JSON.stringify(orderObj)); 
				}else
				{
					var orderObj = JSON.parse(file);
					orderObj['orders'].push(item);
					fs.writeFileSync('Algorithm/'+algo+'/orders.txt', JSON.stringify(orderObj));
	
				}
			
				return fs.readFileSync('Algorithm/'+algo+'/orders.txt', 'utf8');
			
		}
		catch(err)
		{
			console.log(err);
		}
		
	},
	logAnOrder: function (symbol,order,algo) {
		 var path = 'Algorithm/'+algo+'/order/'+currentDate();
		try{
			if (!fs.existsSync(path))
			{
				fs.mkdirSync(path);
			}
				count++;
			var	loggedOrder = path+"/"+symbol+"_order_"+count+".txt";
			
			fs.writeFileSync(loggedOrder, order); 		
	
			}
			catch(err)
			{
				console.log(err);
			}
			
	},

	logAllPositions: function (stateObj) {
	 
			try{
				
				var lock = fs.readFileSync('Algorithm/'+stateObj.algo+'/lock.txt', 'utf8')
				fs.writeFileSync('Algorithm/'+stateObj.algo+'/lock.txt', ""); 
						
					fs.writeFileSync('Algorithm/'+stateObj.algo+'/positions.txt', JSON.stringify(stateObj));
					fs.writeFileSync('Algorithm/'+stateObj.algo+'/lock.txt', lock); 
					
			}
			catch(err)
			{
				//fs.writeFileSync("Log/archive/positions_"+currentDate()+currentTime()+".txt", file); 
				
				console.log(err);
			}
		
	},
	getAllPositions: function (stateObj) {
	  
			var file = fs.readFileSync('Algorithm/'+stateObj.algo+'/positions.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{"positions":[]}'));
			}
			else{

				return file;
			}
		
	},
	buildModel: function (algo) {
	  
			var file = fs.readFileSync('Algorithm/'+algo+'/positions.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{"positions":[]}'));
			}
			else{

				return file;
			}
		
	},
	watchPositions: function (positions,algo) {
	  	
			try{
									
					fs.writeFileSync('Algorithm/'+algo+'/watch.txt', JSON.stringify(positions));	
			}
			catch(err)
			{	
				console.log(err);
			}
	},
	GetSentiment: function(symbol,algo){
		try{
		var file = fs.readFileSync('Algorithm/'+algo+'/info/'+symbol+'/sentiment.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{}'));
			}
			else{

				return file;
			}
			}
			catch(err)
			{	 
				return JSON.stringify(JSON.parse('{}'));
			}
	},
	GetNews: function(symbol,algo){
		try{
		var file = fs.readFileSync('Algorithm/'+algo+'/info/'+symbol+'/news.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{}'));
			}
			else{

				return file;
			}
			}
			catch(err)
			{	 
				return JSON.stringify(JSON.parse('{}'));
			}
	},
	GetLastQuote: function(symbol,algo){
		try{
		var file = fs.readFileSync('Algorithm/'+algo+'/info/'+symbol+'/lastQuote.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{}'));
			}
			else{

				return file;
			}
			}
			catch(err)
			{	 
				return JSON.stringify(JSON.parse('{}'));
			}
	},
	GetAnalysis: function(symbol,algo){
		try{
		var file = fs.readFileSync('Algorithm/'+algo+'/info/'+symbol+'/analysis.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{}'));
			}
			else{

				return file;
			}
			}
			catch(err)
			{	 
				return JSON.stringify(JSON.parse('{}'));
			}
	},
	getWatchPositions: function (algo) {
	  
			var file = fs.readFileSync('Algorithm/'+algo+'/watch.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{"positions":[]}'));
			}
			else{

				return file;
			}
		
	},
	watchOrders: function (orders,algo) {
	  
			try{			
						//console.log(orders)
					fs.writeFileSync('Algorithm/'+algo+'/watchorders.txt', JSON.stringify(orders));
					
			}
			catch(err)
			{			
				
				console.log(err);
			}
		
	},
	getWatchOrders: function (algo) {
	  
			var file = fs.readFileSync('Algorithm/'+algo+'/watchorders.txt', 'utf8')
		if (file == ''){
				return JSON.stringify(JSON.parse('{"orders":[]}'));
			}
			else{

				return file;
			}
		
	},
	getAccountSid: function(){
		try{

		var file = fs.readFileSync('Library/security/accountSid.txt', 'utf8')

				return file;
			}
			catch(err)
			{
				console.log("get sid failed.")
			}
	},
	getAuth: function(){
		try{
		var file = fs.readFileSync('Library/security/authToken.txt', 'utf8')
				return file;
			}
			catch(err)
			{
				console.log("get auth token failed.")
			}
	},
	getUser: function(){
		try{
		var file = fs.readFileSync('Library/security/user.txt', 'utf8')
		
				return file;
			}
			catch(err)
			{
				console.log("get user failed.")
			}
	},
	getPass: function(){
		try{
		var file = fs.readFileSync('Library/security/password.txt', 'utf8')
				return file;
			}
			catch(err)
			{
				console.log("get password failed.")
			}
	},

	clearPositionsOrdersAndReturns: function(algo){
		fs.writeFileSync('Algorithm/'+algo+'/watch.txt', '{"positions":[]}');
		fs.writeFileSync('Algorithm/'+algo+'/watchorders.txt', '{"orders":[]}');
		fs.writeFileSync('Algorithm/'+algo+'/positions.txt', '{"positions":[]}');
		fs.writeFileSync('Algorithm/'+algo+'/orders.txt', '{"orders":[]}'); 
		fs.writeFileSync('Algorithm/'+algo+'/status/returns.txt', null); 
		//fs.writeFileSync('Algorithm/'+algo+'/status/sharpe.txt', 0); 
		fs.writeFileSync('Algorithm/'+algo+'/lock.txt', "");
	},
	getLock: function(algo){
		try{
			var lock = fs.readFileSync('Algorithm/'+algo+'/lock.txt', 'utf8')
			return lock;
			}
			catch(err)
			{
				console.log(err)
			}
	},
	clearOrdersNightly: function(algo){
		fs.writeFileSync('Algorithm/'+algo+'/orders.txt', '{"orders":[]}'); 
	}



	
};
function currentDate()
{
	var currentDate = new Date();
  var currentDay = currentDate.getDate();
  if (currentDay < Number(10))
  {
    currentDay = '0' + currentDay;
  }

  var month = currentDate.getMonth() + 1;
  if (month < Number(10))
  {
    month = '0' + month;
  }
//console.log("Date:"+ currentDate.getMonth())
  
  var orderDay = currentDate.getFullYear()+ "-" + month +"-"+ currentDay ;
  return orderDay;
}
function getSum(total, num) {
    return total + num;
}

function currentTime(){
	var currentDate = new Date();
  
  var h = currentDate.getHours();
  var m = currentDate.getMinutes();
  var s = currentDate.getSeconds();

  if (s < 10)
  {
    s = '0' + s;
  }
  if (h < 10)
  {
    h = '0' + h;
  }
  if (m < 10)
  {
    m = '0' + m;
  }
  var orderTime = h +"_"+ m + "_" + s;
  return orderTime;
}