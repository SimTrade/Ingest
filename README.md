# Ingest

Cloud data pipeline for the [SimTrade](https://github.com/SimTrade) organization. Fetches, transforms, and stores equity market data into Azure Table Storage and MongoDB — feeding the [Backtester](https://github.com/SimTrade/Backtester) with the data it needs to run simulations and live trades.

## What It Does

- Builds and maintains equity universe tables (top 5000 symbols segmented by tier)
- Scrapes and ingests daily price and fundamental data from Barcharts, WSJ, Zacks, IEX, Polygon, and Finnhub
- Ingests and transforms macro data (PMI, VIX, sector ETFs)
- Scores and ranks equities for model consumption
- Sends SMS alerts via Twilio
- Automated daily runs managed via Windows Task Scheduler

## Infrastructure Requirements

- **Azure Table Storage** — primary data store for market and macro data
- **MongoDB** — secondary storage and pipeline state
- **VM or cloud host** — for running scheduled pipeline jobs
- **Twilio** — SMS notifications

## Usage

```bash
# Build equity universe tables in Azure (run quarterly)
node process.js BuildTableUniverses

# Run daily data scrape (Barcharts, WSJ, Zacks, IEX)
node process.js TableRun

# Ingest macro data — PMI and VIX (run weekly/Friday)
node process.js MacroIngest

# Transform macro data for a specific date offset
node process.js MacroTransform <daysBack>

# Bulk historical macro transform (~7 years)
node process.js HistoricMacroTransform

# Ingest Polygon company list
node process.js POLYGONCOMPANIES

# Ingest Finnhub/IEX stock list
node process.js FINNHUBLISTIEX
```

## Directory Structure

```
process.js                       ← entry point and pipeline command router
Library/
    Builder.js                   ← master data builder (scraping + API calls)
    PipelineRunner.js            ← orchestrates transform pipelines
    Analyze.js                   ← signal and analysis computations
    score.js                     ← equity scoring and ranking logic
    GetDaily.js                  ← daily price and data fetching
    Stocklist.js                 ← equity universe management
    MongoDb.js                   ← MongoDB connector
    AzureStorage.js              ← Azure Table Storage connector
    Helper.js                    ← shared utilities
    logging.js                   ← logging utilities
    MasterDailySymbolsEOD.js     ← end-of-day symbol processing
TaskScheduler/
    Trade_Zack1000.xml           ← Windows Task Scheduler config for daily runs
```

## Requirements

- Node.js
- Azure Table Storage connection string / SAS token
- MongoDB connection string
- Twilio SID and Auth token
- Data API keys: Polygon, Finnhub, IEX, Barcharts
