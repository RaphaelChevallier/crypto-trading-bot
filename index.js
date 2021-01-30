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
console.log("Eth Amount", ETH_AMOUNT)

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
  apiString = `https://api.cryptowat.ch/markets/uniswap-v2/daiweth/ohlc?after=${oneDayWindow}&periods=600` // Get data for the past hour and have each candle 10 mins interval
  const response = await fetch(apiString.toString());
  const myJson = await response.json(); //extract JSON from the http response
  console.log(myJson.result['600'])
  // do something with myJson
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
  for (var i = candles.length - 11; i < candles.length - 1; i++) { //get the 10-Day EMA value
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
    console.log("go through " + i)
    for(var j = 0; j < 18; j++){ //get lowest 10 prices of the week
      console.log("break1")
      if(lowestPrices.length < 11){
        lowestPrices.push(candles[i][3])
        break;
      }
      if (candles[i][4] < lowestPrices[j]) {
        lowestPrices[j] = candles[i][3]
        break
      }
    }
    for(var j = 0; j < 18; j++){ //get lowest 10 prices of the week
      console.log("break2")
      if(highestPrices.length < 11){
        highestPrices.push(candles[i][2])
        break;
      } 
      if (candles[i][4] < highestPrices[j]) {
        highestPrices[j] = candles[i][2]
        break
      }
    }
  }
  return [lowestPrices, highestPrices]
}

let priceMonitor
let monitoringPrice = false

async function monitorPrice() {
  if(monitoringPrice) {
    return
  }

  console.log("Checking price...")
  monitoringPrice = true

  var EMA = await getWeeklyHistoricalPrices()
  console.log(EMA[0])
  console.log(EMA[1])
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

// Check markets every n seconds
const POLLING_INTERVAL = process.env.POLLING_INTERVAL || 5000 // 1 Second
priceMonitor = setInterval(async () => { await monitorPrice() }, POLLING_INTERVAL)
