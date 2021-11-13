
'use strict'
const Builder = require('./Builder');
const Analyze = require('./Analyze');

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


