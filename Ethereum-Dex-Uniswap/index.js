require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const http = require('http')
const Web3 = require('web3')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const moment = require('moment-timezone')
const numeral = require('numeral')
const _ = require('lodash')
const fetch = require("node-fetch");
const { range } = require('lodash')
const notifier = require('node-notifier');

// SERVER CONFIG
const PORT = process.env.PORT || 5000
const app = express();
const server = http.createServer(app).listen(PORT, () => console.log(`Listening on ${ PORT }`))

// WEB3 CONFIG
const web3 = new Web3(new HDWalletProvider(process.env.PRIVATE_KEY, process.env.INFURA_URL) )

// // DAI Contract
// const DAI_ABI = process.env.DAI_ABI;
// const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
// const daiContract = new web3.eth.Contract(DAI_ABI, DAI_ADDRESS);

// // Uniswap Dai Exchange: https://etherscan.io/address/0x7a250d5630b4cf539739df2c5dacb4c659f2488d#readContract
// const EXCHANGE_ABI = process.env.UNISWAP_ABI;
// const EXCHANGE_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
// const exchangeContract = new web3.eth.Contract(EXCHANGE_ABI, EXCHANGE_ADDRESS);

// Minimum eth to swap
const ETH_AMOUNT = web3.utils.toWei('1', 'Ether')

const ETH_SELL_PRICE = web3.utils.toWei('100', 'Ether') // 200 Dai a.k.a. $200 USD

async function sellEth(ethAmount, daiAmount) {
  // Set Deadline 1 minute from now
  const moment = require('moment') // import moment.js library
  const now = moment().unix() // fetch current unix timestamp
  const DEADLINE = now + 60 // add 60 seconds
  console.log("Deadline", DEADLINE)

  // Transaction Settings
  const SETTINGS = {
    gasLimit: 200000, // Override gas settings: https://github.com/ethers-io/ethers.js/issues/469
    gasPrice: web3.utils.toWei('50', 'Gwei'),
    from: process.env.ACCOUNT, // Use your account here
    value: ethAmount // Amount of Ether to Swap
  }

  // Perform Swap
  console.log('Performing swap...')
  let result = await exchangeContract.methods.ethToTokenSwapInput(daiAmount.toString(), DEADLINE).send(SETTINGS)
  console.log(`Successful Swap: https://etherscan.io/tx/${result.transactionHash}`)
}

async function checkBalances() {
  let balance

  // Check Ether balance swap
  balance = await web3.eth.getBalance(process.env.ACCOUNT)
  balance = web3.utils.fromWei(balance, 'Ether')
  console.log("Ether Balance:", balance)

  // Check Dai balance swap
  balance = await daiContract.methods.balanceOf(process.env.ACCOUNT).call()
  balance = web3.utils.fromWei(balance, 'Ether')
  console.log("Dai Balance:", balance)
}

async function getDailyHistoricalPrices() {
  date = Math.round((new Date()).getTime() / 1000); //JS gets date in MS convert to sec
  oneDayWindow = (date - 86400).toString()
  apiString = `https://api.cryptowat.ch/markets/uniswap-v2/daiweth/ohlc?after=${oneDayWindow}&periods=3600` // Get data for the past day and have each candle hourly intervals
  const response = await fetch(apiString.toString());
  const myJson = await response.json(); //extract JSON from the http response
  console.log(myJson.result['3600'])
  // do something with myJson
}

async function getHourlyHistoricalPrices() {
  date = Math.round((new Date()).getTime() / 1000); //JS gets date in MS convert to sec
  oneDayWindow = (date - 3600).toString()
  apiString = `https://api.cryptowat.ch/markets/uniswap-v2/daiweth/ohlc?after=${oneDayWindow}&periods=300` // Get data for the past hour and have each candle 5 mins interval
  const response = await fetch(apiString.toString());
  const myJson = await response.json(); //extract JSON from the http response
  console.log(myJson.result['300'])
  // do something with myJson
}

async function get5MinsHistoricalPrices() {
  date = Math.round((new Date()).getTime() / 1000); //JS gets date in MS convert to sec
  oneDayWindow = (date - 600).toString()
  apiString = `https://api.cryptowat.ch/markets/uniswap-v2/daiweth/ohlc?after=${oneDayWindow}&periods=300` // Get data for the past hour and have each candle 5 mins interval
  const response = await fetch(apiString.toString());
  const myJson = await response.json(); //extract JSON from the http response
  candles = myJson.result['300']
  for (var k = 0; k < candles.length - 1; k++){
    candles[k][4] = 1/candles[k][4]
    candles[k][3] = 1/candles[k][3]
    candles[k][2] = 1/candles[k][2]
    candles[k][1] = 1/candles[k][1]
  }
  return [candles[0], candles[1]]
  // do something with myJson
}

async function getHourlySSLChannel() {
  date = Math.round((new Date()).getTime() / 1000); //JS gets date in MS convert to sec
  oneDayWindow = (date - 43200).toString()
  apiString = `https://api.cryptowat.ch/markets/uniswap-v2/daiweth/ohlc?after=${oneDayWindow}&periods=3600` // Get data for the past 12 hrs and have each candle 1 hr interval
  const response = await fetch(apiString.toString());
  const myJson = await response.json(); //extract JSON from the http response
  candles = myJson.result['3600']
  var highSum = 0;
  var lowSum = 0;
  var sumVolume = 0;
  var prevHighSum = 0;
  var prevLowSum = 0;
  var aboveAvgVolume = false;
  for (var k = 0; k < candles.length; k++){
    candles[k][4] = 1/candles[k][4]
    candles[k][2] = 1/candles[k][2]
    candles[k][3] = 1/candles[k][3]
    if(k < 12){
      sumVolume = sumVolume + candles[k][5]
    }
  }
  for (var i = candles.length - 2; i > 1; i--){
    highSum = highSum + candles[i][3]
    prevHighSum = prevHighSum + candles[i-1][3]
    lowSum = lowSum + candles[i][2]
    prevLowSum = prevLowSum + candles[i-1][2]
  }
  highSMA = highSum/10;
  lowSMA = lowSum/10;
  prevHighSMA = prevHighSum/10
  prevLowSMA = prevLowSum/10
  volumeAvg = sumVolume/10;
  if(candles[11][5] > volumeAvg + 7000){
    aboveAvgVolume = true;
  }
  // currentCandleVolume = candles[12][5]
  // currentCandleHigh = candles[12][2]
  // currentCandleLow = candles[12][3]
  return [lowSMA, highSMA, prevLowSMA, prevHighSMA, aboveAvgVolume, candles[11][4]]
}

async function get50MinDayEMA() {
  date = Math.round((new Date()).getTime() / 1000); //JS gets date in MS convert to sec
  oneDayWindow = (date - 172800).toString()
  apiString = `https://api.cryptowat.ch/markets/uniswap-v2/daiweth/ohlc?after=${oneDayWindow}&periods=300` // Get data for the past 2days and have each candle 5mins day interval
  const response = await fetch(apiString.toString());
  const myJson = await response.json(); //extract JSON from the http response
  candles = myJson.result['300']
  var pastEMA = 0;
  var emaList = new Array();
  for (var k = 0; k < candles.length; k++){
    candles[k][4] = 1/candles[k][4]
    candles[k][3] = 1/candles[k][3]
    candles[k][2] = 1/candles[k][2]
    candles[k][1] = 1/candles[k][1]
  }
  for (var i = candles.length - 52; i < candles.length-2; i++) {
    if(i >= candles.length - 51){
      pastEMA = (candles[i][4] * (2/51)) + (pastEMA * (1-(2/51))) //EMA formula EMA=Price(currentDay)×#ofDaysWanted+EMA(pastDay)×(1−#ofDaysWanted)
      emaList.push(pastEMA)
    } else{
      pastEMA = ((candles[candles.length-52][4] + candles[candles.length-51][4] + candles[candles.length-50][4] + candles[candles.length-49][4] + candles[candles.length-48][4] + candles[candles.length-47][4] + candles[candles.length-46][4] + candles[candles.length-45][4] + candles[candles.length-44][4] + candles[candles.length-43][4] + candles[candles.length-42][4] + candles[candles.length-41][4] + candles[candles.length-40][4] + candles[candles.length-39][4] + candles[candles.length-38][4] + candles[candles.length-37][4] + candles[candles.length-36][4] + candles[candles.length-35][4] + candles[candles.length-34][4] + candles[candles.length-33][4] + candles[candles.length-32][4] + candles[candles.length-31][4] + candles[candles.length-30][4] + candles[candles.length-29][4] + candles[candles.length-28][4] + candles[candles.length-27][4] + candles[candles.length-26][4] + candles[candles.length-25][4] + candles[candles.length-24][4] + candles[candles.length-23][4] + candles[candles.length-22][4] + candles[candles.length-21][4] + candles[candles.length-20][4] + candles[candles.length-19][4] + candles[candles.length-18][4] + candles[candles.length-17][4] + candles[candles.length-16][4] + candles[candles.length-15][4] + candles[candles.length-14][4] + candles[candles.length-13][4] + candles[candles.length-12][4] + candles[candles.length-11][4] + candles[candles.length-10][4] + candles[candles.length-9][4] + candles[candles.length-8][4] + candles[candles.length-7][4] + candles[candles.length-6][4] + candles[candles.length-5][4] + candles[candles.length-4][4] + candles[candles.length-3][4])/50) //get EMA of 10th day
      emaList.push(pastEMA)
    }
  }
  return [emaList, candles[candles.length-2], candles[candles.length-3]]
}

async function getTenDayEMA() {
  date = Math.round((new Date()).getTime() / 1000); //JS gets date in MS convert to sec
  oneDayWindow = (date - 1728000).toString()
  apiString = `https://api.cryptowat.ch/markets/uniswap-v2/daiweth/ohlc?after=${oneDayWindow}&periods=86400` // Get data for the past 20days and have each candle 1 day interval
  const response = await fetch(apiString.toString());
  const myJson = await response.json(); //extract JSON from the http response
  candles = myJson.result['86400']
  var pastEMA = 0;
  var emaList = new Array(); //create list of EMA for every day. start is day 10 and last is most recent
  for (var k = 0; k < candles.length - 1; k++){
    candles[k][4] = 1/candles[k][4]
  }
  for (var i = candles.length - 11; i < candles.length - 1; i++) { //get the 10-Day EMA value
    console.log(candles[k][0])
    if(i > candles.length - 11){
      pastEMA = (candles[i][4] * (2/11)) + (pastEMA * (1-(2/11))) //EMA formula EMA=Price(currentDay)×#ofDaysWanted+EMA(pastDay)×(1−#ofDaysWanted)
      emaList.push(pastEMA)
    } else{
      pastEMA = ((candles[i][4] + candles[i - 1][4] + candles[i - 2][4] + candles[i - 3][4] + candles[i - 4][4] + candles[i - 5][4] + candles[i - 6][4] + candles[i - 7][4] + candles[i - 8][4] + candles[i - 9][4])/10) //get EMA of 10th day
      emaList.push(pastEMA)
    }
  }
  return emaList
}

async function getWeeklyHistoricalPrices() {
  var lowestPrices = [];
  var highestPrices = [];
  date = Math.round((new Date()).getTime() / 1000); //JS gets date in MS convert to sec
  oneDayWindow = (date - 604800).toString()
  apiString = `https://api.cryptowat.ch/markets/uniswap-v2/daiweth/ohlc?after=${oneDayWindow}&periods=21600` //Get data for past week with each 8hrs candles so 3 times a day
  const response = await fetch(apiString.toString());
  const myJson = await response.json(); //extract JSON from the http response
  candles = myJson.result['21600']
  //Get biggest most common support level
  for( var i = 0; i < candles.length - 1; i++){
    for(var j = 0; j < 15; j++){ //get lowest 10 prices of the week
      if(lowestPrices.length < 15){
        lowestPrices.push(1/candles[i][2]) //prices are inverted to get the highest eth price to dollar as this is getting dollar to eth prices
        break;
      }
      if (1/candles[i][2] < lowestPrices[j]) {
        lowestPrices[j] = 1/candles[i][2]
        break;
      }
    }
    for(var j = 0; j < 15; j++){ //get lowest 10 prices of the week
      if(highestPrices.length < 15){
        highestPrices.push(1/candles[i][3])
        break;
      } 
      if (1/candles[i][3] > highestPrices[j]) {
        highestPrices[j] = 1/candles[i][3]
        break;
      }
    }
  }
  return [lowestPrices, highestPrices]
}

let priceMonitor
let monitoringPrice = false
let countMarkers = 0;

async function monitorPrice() {
  if(monitoringPrice) {
    return
  }

  console.log("Checking price...")
  console.log(POLLING_INTERVAL)
  monitoringPrice = true
  var trend;

//Check inverse highs and lows since I inverse data from candles from dai-eth to eth-dai
  if(POLLING_INTERVAL == 3600000){
    var SSL = await getHourlySSLChannel()
    console.log(SSL)
    if(SSL[4] == true){
      if(SSL[1] < SSL[5]){
        console.log("Trending UP")
        notifier.notify({
          'title': 'Found trend going Up. Looking at EMA.',
          'message': 'Up Trend Identified',
          'sound': 'ding.mp3',
          'wait': true,
          timeout: 5
        });
        trend = "Up"
        clearInterval()
        POLLING_INTERVAL = 300000 || process.env.POLLING_INTERVAL
        setInterval(async () => await monitorPrice(), 300000);
      } else if(SSL[0] > SSL[5]){
        console.log("Trending Down")
        notifier.notify({
          'title': 'Found trend going Down. Looking at EMA.',
          'message': 'Down Trend Identified',
          'sound': 'ding.mp3',
          'wait': true,
          timeout: 5
        });
        trend = "Down"
        clearInterval()
        POLLING_INTERVAL = 300000 || process.env.POLLING_INTERVAL
        setInterval(async () => await monitorPrice(), 300000);
      } else {
        console.log("No trend change")
        trend = "No Trend"
        console.log("Current Balances")
        console.log("Eth Amount: " + eth)
        console.log("Dai Amount: " + dai)
      }
    }
  } else if(POLLING_INTERVAL == 300000){
    countMarkers = countMarkers + 1
    console.log("Count of tries to touch EMA: " + countMarkers)
    if(countMarkers > 6){
      console.log("Never Touched EMA")
      countMarkers = 0;
      clearInterval()
      POLLING_INTERVAL = 3600000 || process.env.POLLING_INTERVAL
      setInterval(async () => await monitorPrice(), 3600000);
    } else{
      var EMA = await get50MinDayEMA();
      var getEMA = EMA[0]
      var getMostRecent = EMA[1]
      var getNextMostRecent = EMA[2]
      console.log("Most Recent Candle is: " + getMostRecent)
      console.log("Next Most Recent Candle is: " + getNextMostRecent)
      console.log("The Last two EMA values older to newest were: " + getEMA[48] + " and " + getEMA[49])
      if (trend === "Up"){
        if(getNextMostRecent[1] > getNextMostRecent[4] && getMostRecent[1] < getMostRecent[4] && (getNextMostRecent[2] <= getEMA[48] && getNextMostRecent[3] >= getEMA[48]) && (getMostRecent[2] <= getEMA[49] && getMostRecent[3] >= getEMA[49])){
          if(dai > 100){
            console.log("Buy Eth")
            notifier.notify({
              'title': 'Hit EMA on up trend.',
              'message': 'Buying Eth on known uptrend',
              'sound': 'ding.mp3',
              'wait': true,
              timeout: 5
            });
            priceEth = getMostRecent[4];
            eth = eth + ((dai*.9)/priceEth)
            dai = dai - 15 -(dai*.1);
            console.log("New Dai Amount: " + dai)
            console.log("New Eth Amount: " + eth)
            clearInterval()
            POLLING_INTERVAL = 3600000 || process.env.POLLING_INTERVAL
            setInterval(async () => await monitorPrice(), 3600000);
          }
        }
      } else if(trend === "Down"){
        if(getNextMostRecent[1] < getNextMostRecent[4] && getMostRecent[1] > getMostRecent[4] && (getNextMostRecent[2] <= getEMA[48] && getNextMostRecent[3] >= getEMA[48]) && (getMostRecent[2] <= getEMA[49] && getMostRecent[3] >= getEMA[49])){
          if(eth > .5){
            console.log("Sell Eth")
            notifier.notify({
              'title': 'Hit EMA on down trend.',
              'message': 'Selling Eth on known uptrend',
              'sound': 'ding.mp3',
              'wait': true,
              timeout: 5
            });
            priceDai = 1/getMostRecent[4];
            dai = dai + ((eth*.9)/priceDai);
            eth = eth - 0.00833386 - (eth*.1);
            console.log("New Dai Amount: " + dai)
            console.log("New Eth Amount: " + eth)
            clearInterval()
            POLLING_INTERVAL = 3600000 || process.env.POLLING_INTERVAL
            setInterval(async () => await monitorPrice(), 3600000);
          }
        }
      }
    }
  }

  // try {

  //   // Check Eth Price
  //   const daiAmount = await exchangeContract.methods.getEthToTokenInputPrice(ETH_AMOUNT).call()
  //   const price = web3.utils.fromWei(daiAmount.toString(), 'Ether')
  //   console.log('Eth Price:', price, ' DAI')

  //   if(price <= ETH_SELL_PRICE) {
  //     console.log('Selling Eth...')
  //     // Check balance before sale
  //     await checkBalances()

  //     // Sell Eth
  //     await sellEth(ETH_AMOUNT, daiAmount)

  //     // Check balances after sale
  //     await checkBalances()

  //     // Stop monitoring prices
  //     clearInterval(priceMonitor)
  //   }

  // } catch (error) {
  //   console.error(error)
  //   monitoringPrice = false
  //   clearInterval(priceMonitor)
  //   return
  // }

  monitoringPrice = false
}

var eth = 10;
var dai = 5000;
// Check markets every n seconds
var POLLING_INTERVAL = process.env.POLLING_INTERVAL || 3600000 // 1 Hr
priceMonitor = setInterval(async () => { await monitorPrice() }, POLLING_INTERVAL)
