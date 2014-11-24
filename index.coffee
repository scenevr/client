Client = require("./app/src/client.coffee")

$ -> 
  setTimeout(
    -> window.client = new Client
  , 250)
