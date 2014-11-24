browserify = require('browserify-middleware')
express = require('express')
app = express()
fs = require('fs')

app.use(express.static(__dirname))

# provide browserified versions of all the files in a directory
app.use('/js/bundle.js', browserify('./index.coffee', {
  transform : ['coffeeify']
}))

# Try loading the path /connect/localhost:8080/index.xml to 
# specify the server and scene you want to load
app.get '/connect/*', (req, res) ->
  res.send fs.readFileSync(__dirname + "/index.html").toString()

console.log "[webclient] Listening for connections on localhost:9000..."

app.listen(9000)
