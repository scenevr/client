Client = require("./app/src/client")

$ -> 
  setTimeout(
    -> window.client = new Client
  , 250)
