Model = require("./elements/model")
Packets = require("./packets")

class Uploader
  constructor: (@client) ->
    @endpoint = "//#{@assetServerHost()}/upload"

    $('body').on 'dragover', (e) =>
      if !@message
        @createElements()

      clearTimeout @timeout

      # console.log "trying to detect... #{e.originalEvent.clientX} #{e.originalEvent.clientY}"

      @position = @client.getPlayerDropPoint() # detectCollision(e.originalEvent.clientX, e.originalEvent.clientY)

    $('body').on 'dragleave', (e) =>
      @timeout = setTimeout(
          => @removeElements()
        , 100)

      # @removeElements()

  assetServerHost: ->
    window.location.host.split(':')[0] + ":8090"

  createElements: ->
    @client.hideOverlays()

    @message = $("<div />").addClass("upload-message").html('''
      <h1>Drop a file to upload..</h1

      <p>
        Currently only collada <code>.dae</code> is supported.
      </p>
    ''').appendTo @client.container

    @overlay = $("<div />").addClass('upload-overlay').appendTo @client.container

    @form = $("<form method='post' enctype='multipart/form-data' action='#{@endpoint}' />").addClass('upload-form').html('''
      <input type="file" name="upload" />
    ''').appendTo @client.container

    @form.find('input').change (e) =>
      @submit()

  removeElements: ->
    if @message
      @message.remove()
      @overlay.remove()
      @form.remove()

    @message = @overlay = @form = null

    @client.showOverlays()


  onSuccess: (model) =>
    console.log "file upload complete.."
    console.log model

    @removeElements()

    element = new Model
    element.src = "//localhost:8090/models/#{model.id}/model.js" # text
    element.position = @position
    element.position.y = 0
    element.rotation.y = -Math.PI/2
    element.scale.x = element.scale.y = element.scale.z = 5.0

    @client.addModel(element.src, element.position)

    @client.connector.sendPacket {
      method : 'addElement'
      args : [model.id, @position.x, @position.y, @position.z]
    }

    # Send an introduction packet to the server...
    # I wonder if we should just send some javascript to the server to do this... I guess I'd need
    # to work out how to sandbox properly in node.js before we allowed that.
    # packet = new Packets.packets.Introducing([null, element.getInnerXML()])
    # @client.connector.sendPacket(packet.toWireFormat())


  submit: ->
    clearTimeout @timeout
    # @form.submit()
    # return

    file = @form.find('input').get(0).files[0]

    # unless file.name.match /dae$/i
    #   alert "Sorry, only files of type .dae (collada) are able to be uploaded..."
    #   return

    username = "ben"
    password="foobar"
    
    unless @position
      alert "Sorry, couldnt detect drop position..."
      return

    setTimeout(
      => @message.html("<h1>Uploading...</h1><p>This may take a while...</p>") if @message
    , 200)

    $.ajax {
      type : "post"
      url : @endpoint
      data : new FormData(@form.get(0))
      processData : false
      contentType : false
      beforeSend: (xhr) -> xhr.setRequestHeader("Authorization", "Basic " + btoa(username + ":" + password))
      success : @onSuccess

      error: (response, text) =>
        alert "error contacting asset server..."
        # console.log "Error was: " + text
        @removeElements()

      xhrFields: {
        # add listener to XMLHTTPRequest object directly for progress (not sure if using deferred works)
        onprogress: (progress) ->
          # calculate upload progress
          percentage = Math.floor((progress.total / progress.totalSize) * 100);

          # log upload progress to console
          console.log('progress', percentage);

          if percentage == 100
            console.log('done uploading...!');
      }
    }

module.exports = Uploader