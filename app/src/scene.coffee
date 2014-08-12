class Scene
  constructor: ->
    @childNodes = {}
  
  getElementById: (id) ->
    @childNodes[id]
  
  appendChild: (element) ->
    @childNodes[element.id] = element
  
  removeChild: (element) ->
    @childNodes[element.id] = null

  firstChild: ->
    for id, value of @childNodes
      return value
  
module.exports = Scene