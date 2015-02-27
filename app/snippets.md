Message input prototype:

    addMessageInput: ->
      @chatForm = $("<div id='message-input'>
        <label>Enter chat message...</label>
        <input type='text' />
      </div>").appendTo("body")

      input = @chatForm.find('input')

      input.on 'keydown', (e) =>
        if e.keyCode == 13
          @connector.sendChat input.val()
          input.val("")

CSS for message input:

    #message-input{
      background: rgba(32,32,32,0.5);
      border-radius: 2px;
      width: 500px;
      position: absolute;
      left : 10px;
      bottom: 10px;
      z-index: 90;
      padding: 10px;
    }
    #message-input label{
      display: block;
      color: white;
      margin-bottom: 10px;
      text-shadow: 1px 1px 1px black;
    }
    #message-input input{
      width: 100%;
      border: none;
      box-shadow: 1px 1px 3px black;
      font: inherit;
      padding: 5px;
      border-radius: 2px;
    }

Load and play video:

  createVideo: (el) ->
    video = document.createElement( 'video' );
    video.src = "//" + @getAssetHost() + "/videos/bubblepop.mp4"
    video.crossOrigin = true
    video.load()
    video.play()

    videoTexture = new THREE.VideoTexture( video );
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.needsUpdate = true;
    videoTexture.format = THREE.RGBFormat;

    movieMaterial = new THREE.MeshBasicMaterial( { map: videoTexture, overdraw: true, side:THREE.DoubleSide } )
    # the geometry on which the movie will be displayed;
    #    movie image will be scaled to fit these dimensions.
    movieGeometry = new THREE.PlaneGeometry( 6.4, 3.6, 4, 4 );
    movieScreen = new THREE.Mesh( movieGeometry, movieMaterial );
    movieScreen.position.set(-10,1.8,0);
    movieScreen.rotation.set(0, Math.PI / 2, 0);
    @client.scene.add(movieScreen);
