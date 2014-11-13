browserify = require('browserify-middleware')
express = require('express')
app = express()

app.use(express.static(__dirname))

# provide browserified versions of all the files in a directory
app.use('/js/bundle.js', browserify('./index.coffee', {
  transform : ['coffeeify']
}))

app.listen(9000)
