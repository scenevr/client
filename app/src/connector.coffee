Element = require('./element')

class Connector
  constructor: (@client, @scene, @camera, host, port) ->
    @host = host || window.location.host.split(":")[0]
    @port = port || 8080
    @adapter = new ConnectorAdapter(this)
    @protocol = "scene-server"
    @packets = []

  connect: ->
    @ws = new WebSocket("ws://#{@host}:#{@port}/", @protocol);
    @ws.binaryType = 'arraybuffer'
    @ws.onopen = =>
      console.log "Opened socket"
      @interval = setInterval @tick, 1000 / 2
      @authenticate()
    @ws.onclose = =>
      console.log "Closed socket"
      clearInterval @interval
    @ws.onmessage = @onMessage

  sendPacket: (packet) ->
    @packets.push packet

  # dispatchPackets: ->
  #   message = JSON.stringify(@packets)
  #   console.log message
  #   @ws.send(message)

  tick: =>
    # send location..

  onMessage: (e) =>
    messages = JSON.parse(e.data)

    console.log e.data

    for message in messages
      if typeof @adapter[message.method] == "function"
        @adapter[message.method].apply(@adapter, message.args)
      else
        console.log "Invalid message recieved " + JSON.stringify(message)
  
module.exports = Connector