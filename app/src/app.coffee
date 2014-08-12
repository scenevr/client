require.config {
    urlArgs : "nonce=" + (new Date()).getTime()
}

require [
  "/app/components/jquery/dist/jquery.js", 
  "/app/src/client.js",
], (_jquery, Client) ->
  $ -> window.client = new Client
