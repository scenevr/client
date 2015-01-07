/**
 * @author mrdoob / http://mrdoob.com/
 * @author schteppe / https://github.com/schteppe
 */
 var PointerLockControls = function ( camera, client, MOBILE ) {

    var cannonBody = null;
    var velocity = new THREE.Vector3;
    var eyeYPos = 2; // eyes are 2 meters above the ground
    var velocityFactor = 0.2;
    var jumpVelocity = 8;
    var scope = this;

    var pitchObject = new THREE.Object3D();
    pitchObject.add( camera );

    var yawObject = new THREE.Object3D();
    yawObject.position.y = 2;
    yawObject.add( pitchObject );

    var quat = new THREE.Quaternion();

    var moveForward = false;
    var moveBackward = false;
    var moveLeft = false;
    var moveRight = false;

    var canJump = false;

    var contactNormal = new CANNON.Vec3(); // Normal in the contact, pointing *out* of whatever the player touched
    var upAxis = new CANNON.Vec3(0,1,0);

    this.setCannonBody = function(x){
        cannonBody = x;

        velocity = cannonBody.velocity;

        cannonBody.addEventListener("collide",function(e){
            var contact = e.contact;

            // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
            // We do not yet know which one is which! Let's check.
            if(contact.bi.id == cannonBody.id)  // bi is the player body, flip the contact normal
                contact.ni.negate(contactNormal);
            else
                contactNormal.copy(contact.ni); // bi is something else. Keep the normal as it is

            // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
            if(contactNormal.dot(upAxis) > 0.5) // Use a "good" threshold value between 0 and 1 here!
                canJump = true;
        });
    };

    var PI_2 = Math.PI / 2;

    if(MOBILE){
        var direction = $("<div />").addClass('direction dpad').appendTo('body'),
            movement = $("<div />").addClass('movement dpad').appendTo('body');
    }
	var onMouseClick = function( event) {
		if ( scope.enabled === false ) return;
		event.preventDefault();
		client.trigger('click');
	};

    var onMouseDown = function( event) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
        client.trigger('mousedown');
    };

    var onMouseUp = function( event) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
        client.trigger('mouseup');
    };

    var onMouseMove = function ( event ) {

        if ( scope.enabled === false ) return;

        var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        yawObject.rotation.y -= movementX * 0.002;
        pitchObject.rotation.x -= movementY * 0.002;

        pitchObject.rotation.x = Math.max( - PI_2, Math.min( PI_2, pitchObject.rotation.x ) );
    };

    var onKeyDown = function ( event ) {

        if ( scope.enabled === false ) return;

        switch ( event.keyCode ) {

            case 38: // up
            case 87: // w
                moveForward = true;
                break;

            case 37: // left
            case 65: // a
                moveLeft = true; break;

            case 40: // down
            case 83: // s
                moveBackward = true;
                break;

            case 39: // right
            case 68: // d
                moveRight = true;
                break;

            case 32: // space
                if ( canJump === true ){
                    velocity.y = jumpVelocity;
                }
                canJump = false;
                break;
        }

    };

    var onKeyUp = function ( event ) {

        if ( scope.enabled === false ) return;

        switch( event.keyCode ) {

            case 38: // up
            case 87: // w
                moveForward = false;
                break;

            case 37: // left
            case 65: // a
                moveLeft = false;
                break;

            case 40: // down
            case 83: // a
                moveBackward = false;
                break;

            case 39: // right
            case 68: // d
                moveRight = false;
                break;

        }

    };

    document.addEventListener( 'click', onMouseClick, false );
    document.addEventListener( 'mousedown', onMouseDown, false );
    document.addEventListener( 'mouseup', onMouseUp, false );
    document.addEventListener( 'mousemove', onMouseMove, false );
    document.addEventListener( 'keydown', onKeyDown, false );
    document.addEventListener( 'keyup', onKeyUp, false );

    document.addEventListener("touchstart", function(e){
        e.preventDefault();
    }, false);

    var movementX = 0,
        movementY = 0;

    var direction = new THREE.Vector2(0,0);

    document.addEventListener("touchstart", function(e){
        for(i=0;i<e.touches.length;i++){
            var touch = e.touches[i];

            if(touch.clientY < window.innerHeight * 0.75){
                client.trigger('click');
            }
        }
    });
    
    document.addEventListener("touchend", function(e){
        movementX = 0;
        movementY = 0;
        direction.set(0,0);
    });

    document.addEventListener("touchmove", function(e){
        if ( scope.enabled === false ) return;

        var i;

        for(i=0;i<e.touches.length;i++){
            var touch = e.touches[i];

            if(touch.clientY < window.innerHeight * 0.75){
                continue;
            }

            if(touch.clientX > window.innerWidth / 2){
                movementX = touch.clientX - (window.innerWidth - 60);
                movementY = touch.clientY - (window.innerHeight - 60);

                movementX *= 0.4;
                movementY *= 0.4;
            }

            if(touch.clientX < window.innerWidth / 2){
                direction.set(
                    touch.clientX - (60),
                    touch.clientY - (window.innerHeight - 60)
                );

                direction.multiplyScalar(0.1);
                direction.clampscalar(-1,1);
            }
        }

        e.preventDefault();
    });

    document.addEventListener("contextmenu",function(e){
        if ( scope.enabled === false ) return;
        e.preventDefault();
        return false;
    });

    document.addEventListener("dblclick",function(e){
        if ( scope.enabled === false ) return;
        e.preventDefault();
        return false;
    });

    this.enabled = false;

    this.getObject = function () {
        return yawObject;
    };

    this.getYaw = function(){
        return yawObject.rotation.y;
    }

    this.getDirection = function(targetVec){
        targetVec.set(0,0,-1);
        targetVec.applyQuaternion(quat);

        // Fixme - this is a gross hack, and I don't know why it's necessary
        targetVec.y = pitchObject.rotation.x / (Math.PI / 2)

        return targetVec;
    }

    // Moves the camera to the Cannon.js object position and adds velocity to the object if the run key is down
    var inputVelocity = new THREE.Vector3();
    var euler = new THREE.Euler();
    this.update = function ( delta ) {

        if(!cannonBody){
            console.log("wtf?");
            return;
        }

        yawObject.rotation.y -= movementX * 0.002;
        pitchObject.rotation.x -= movementY * 0.002;

        pitchObject.rotation.x = Math.max( - PI_2, Math.min( PI_2, pitchObject.rotation.x ) );

        delta *= 0.5;

        inputVelocity.set(0,0,0);

        if(MOBILE){
            inputVelocity.z = direction.y * velocityFactor * delta * 0.3;
            inputVelocity.x = direction.x * velocityFactor * delta * 0.3;
        }

        if ( moveForward ){
            inputVelocity.z = -velocityFactor * delta;
        }
        if ( moveBackward ){
            inputVelocity.z = velocityFactor * delta;
        }

        if ( moveLeft ){
            inputVelocity.x = -velocityFactor * delta;
        }
        if ( moveRight ){
            inputVelocity.x = velocityFactor * delta;
        }

        // Convert velocity to world coordinates
        euler.x = pitchObject.rotation.x;
        euler.y = yawObject.rotation.y;
        euler.order = "XYZ";

        if(client.vrHMD){
            euler.x = 0;
        }

        quat.setFromEuler(euler);
        inputVelocity.applyQuaternion(quat);

        // Add to the object
        velocity.x = velocity.x * 0.7 + inputVelocity.x;
        velocity.z = velocity.z * 0.7 + inputVelocity.z;

        yawObject.position.copy(cannonBody.position).add(new THREE.Vector3(0,0.9,0));
    };
};

