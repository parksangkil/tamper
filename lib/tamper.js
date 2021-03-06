
module.exports = function(accept) {

  return function(req, res, next) {
    var headersSet
      , reason
      , tamper
      , buffer

    function mustCapture() {
      if (!headersSet) res.writeHead(res.statusCode)
      return !!tamper
    }

    var original = patch(res, {

      writeHead: function(statusCode, reasonPhrase, headers) {
        if (typeof reasonPhrase == 'object') {
          headers = reasonPhrase
          reasonPhrase = undefined
        }

        this.statusCode = statusCode
        reason = reasonPhrase

        for (var name in headers) {
          this.setHeader(name, headers[name])
        }
        headersSet = true

        this.writeHead = original.writeHead
        tamper = accept(req, this)
        if (!tamper) {
          // un-patch response and continue as usual
          this.write = original.write
          this.end = original.end
          this.writeHead(statusCode, reason)
        }
      },

      write: function(chunk) {
        if (mustCapture()) {
          buffer = (buffer && append(buffer, chunk))
            || (Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk))

        }
        else this.write(chunk)
      },

      end: function(body) {
        if (mustCapture()) {
          if (buffer) {
            if (body) buffer = append(buffer, body)
            body = buffer.toString()
          }
          else {
            if (Buffer.isBuffer(body)) body = body.toString()
          }
          body = tamper(body || '', req, this.headers)
          this.write = original.write
          this.end = original.end
          this.setHeader('Content-Length', Buffer.byteLength(body))
          this.writeHead(this.statusCode, reason)
        }
        this.end(body)
      }
    })

    next()
  }
}

// Overwrites properties of the given object and returns the old values
function patch(obj, properties) {
  var old = {}
  for (var name in properties) {
    old[name] = obj[name]
    obj[name] = properties[name]
  }
  return old
}

// Returns a new buffer by appending the given chunk to an exisiting buffer
function append(buffer, chunk) {
  if (!Buffer.isBuffer(chunk)) chunk = new Buffer(chunk)
  var target = new Buffer(buffer.length + chunk.length)
  buffer.copy(target)
  chunk.copy(target, buffer.length)
  return target
}
