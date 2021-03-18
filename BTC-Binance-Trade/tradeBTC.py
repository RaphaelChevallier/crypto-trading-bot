import cryptowatch as cw

bitcoin = cw.markets.get("BINANCE-US:BTCUSD")

print(bitcoin._http_response.content)