Packets = require('./packets')
Element = require('./element')

class ConnectorAdapter
  constructor: (@connector) ->
    # ...

  addElement: (elementId, modelId, positionX, positionY, positionZ, scaleX, scaleY, scaleZ) ->
    element = new Element
    element.id = elementId
    element.position = new THREE.Vector3 positionX, positionY, positionZ
    element.scale = new THREE.Vector3 scaleX, scaleY, scaleZ
    element.modelId = modelId

    @connector.client.appendElement(element)

class Connector
  constructor: (@client, @scene, @camera, host, port) ->
    @host = host || window.location.host.split(":")[0]
    @port = port || 8080
    @adapter = new ConnectorAdapter(this)
    @protocol = "mv-protocol"
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

  dispatchPackets: ->
    message = JSON.stringify(@packets)

    console.log message

    @ws.send(message)

  authenticate: ->
    # packet = new Packets.packets.Authenticate(
    #   [null, "ben", "some-credentials-here"]
    # )
    # @sendPacket(packet)

  tick: =>
    avatar = @client.getAvatarObject()

    # packet = new Packets.packets.Update(
    #   [null, @client.avatar.id, avatar.position.x, avatar.position.y, avatar.position.z, avatar.rotation.x, avatar.rotation.y, avatar.rotation.z]
    # )
    # 
    # Don't send client updates until we have authenticated and we have an id for our avatar
    # if @client.avatar.id
    #   sendPacket(packet.toWireFormat())

    if @packets.length > 0
      @dispatchPackets()

    @packets = []

  onMessage: (e) =>
    messages = JSON.parse(e.data)

    console.log e.data

    for message in messages
      if typeof @adapter[message.method] == "function"
        @adapter[message.method].apply(@adapter, message.args)
      else
        console.log "Invalid message recieved " + JSON.stringify(message)


      # packetId = message[0]
      # klass = Packets.dictionary[packetId]

      # packet = new klass(message)
      # packet.process(@scene, @client)
  
module.exports = Connector