browserify = require('browserify-middleware')
express = require('express')
app = express()
fs = require('fs')

app.use(express.static(__dirname))

# provide browserified versions of all the files in a directory
app.use('/js/bundle.js', browserify('./index.coffee', {
  transform : ['coffeeify']
}))

app.get '/connect/*', (req, res) ->
  res.send fs.readFileSync(__dirname + "/index.html").toString()

app.listen(9000)
