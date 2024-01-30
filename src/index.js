import { Buffer } from "node:buffer"
import net from "node:net"

// keeping this constant for now
const packetId = 1337

/**
 * Packet Type ENUM
 * @type {{RESPONSE_VALUE: number, AUTH: number, EXEC_COMMAND: number, AUTH_RESPONSE: number}}
 */
const PACKET_TYPE = {
    AUTH: 3,
    AUTH_RESPONSE: 2,
    EXEC_COMMAND: 2,
    RESPONSE_VALUE: 0
}

/**
 * Helper function to get the body ("payload") of a data packet
 * @param buffer {Buffer}
 * @returns {String} String based payload
 */
function getPayload(buffer) {
    const size = buffer.subarray(0, 4).readInt32LE()
    return buffer.subarray(12, 12 + (size - 10)).toString('ascii')
}

/**
 * Helper function to get the ID of a data packet
 * @param buffer {Buffer}
 * @returns {number} Packet ID
 */
function getId(buffer) {
    return buffer.subarray(4, 8).readInt32LE()
}

/**
 * Helper function to get the packet type from a data packet
 * @param buffer {Buffer}
 * @returns {number} Packet Type
 */
function getType(buffer) {
    return buffer.subarray(8, 12).readInt32LE()
}

/**
 * Helper function to create data packets that follow the RCON packet specification.
 * Specification can be found here: https://developer.valvesoftware.com/wiki/Source_RCON_Protocol
 * @param type {Number} Type of packet to create
 * @param payload {String} String based command payload to send to RCON server
 * @returns {Buffer} Buffer ready to send to RCON server
 */
function createPacket(type, payload) {
    // keep null handy so that we can use it when we concatenate things together
    const nullBuffer = Buffer.alloc(1, 0)

    // create size portion of packet
    const sizeBuffer = Buffer.alloc(4, 0)

    // create id portion of packet and write value
    const idBuffer = Buffer.alloc(4, 0)
    idBuffer.writeInt32LE(packetId)

    // create type portion of packet and write value
    const typeBuffer = Buffer.alloc(4, 0)
    typeBuffer.writeInt32LE(type)

    // create the payload portion of the buffer and write value
    const payloadBuffer = Buffer.from(payload, 'ascii')

    // combine them altogether to create the command
    const commandBuffer = Buffer.concat([
        idBuffer,
        typeBuffer,
        payloadBuffer,
        nullBuffer,
        nullBuffer
    ])

    // update the size based on the command buffer size
    sizeBuffer.writeInt32LE(commandBuffer.byteLength)

    // create the final packet
    return Buffer.concat([
        sizeBuffer,
        commandBuffer
    ])
}

function RCON() {
    let client = null
    let isAuthenticated = false
    let isAuthenticating = false
    let rconPassword = null
    let connectResolve = null
    let connectReject = null
    let sendResolve = null
    let sendReject = null

    /**
     * Handle socket connection being successfully established.
     * Start the authentication procedure with the RCON server.
     */
    function handleConnect() {
        if (isAuthenticated) {
            return;
        }

        isAuthenticating = true
        const authPacket = createPacket(PACKET_TYPE.AUTH, rconPassword)
        client.write(authPacket)
    }

    /**
     * Handle socket closing. If an error has occurred then trigger a rejection of the send promise.
     * @param hasError {Boolean}
     */
    function handleClose(hasError) {
        if (hasError) {
            return sendReject?.("Unable to connect to remote host")
        }
    }

    /**
     * Handle socket errors. Currently only handles errors that occur during initial connection.
     * @param error {Error}
     */
    function handleError(error) {
        if (error.errno === -4078) {
            return connectReject("Remote host refused connection")
        } else if (error.errno === -3008) {
            return connectReject("Unable to connect to remote host")
        } else if (error.errno === -4039) {
            return connectReject("Connection to remote host timed out")
        }
    }

    /**
     * Handle any data received by our socket and pass it onto the relevant handler.
     * @param buffer {Buffer}
     */
    function handleData(buffer) {
        if (isAuthenticating) {
            handleAuthResponse(buffer)
        }
        handleDataResponse(buffer)
    }

    /**
     * Handle auth response from RCON server
     * @param buffer {Buffer}
     */
    function handleAuthResponse(buffer) {
        isAuthenticating = false
        if (getId(buffer) !== packetId) {
            isAuthenticated = false
            connectReject("RCON authentication failed")
            return;
        }

        isAuthenticated = true
        connectResolve()
    }

    /**
     * Handle data response from RCON server
     * @param buffer {Buffer}
     */
    function handleDataResponse(buffer) {
        sendResolve?.(getPayload(buffer))
    }

    /**
     * Connect to RCON server
     * @param host {String} IP address or domain of RCON server
     * @param port {Number} Port number that the RCON server is listening on
     * @param password {String} Password to authenticate to the RCON server
     * @returns {Promise}
     */
    function connect(host, port, password) {
        return new Promise((resolve, reject) => {
            connectReject = reject
            connectResolve = resolve

            client = net.createConnection(port, host)
            rconPassword = password
            client.on('close', handleClose)
            client.on('data', handleData)
            client.on('connect', handleConnect)
            client.on('error', handleError)
        })
    }

    /**
     * Disconnect from the RCON server
     * @returns {Promise}
     */
    function disconnect() {
        return new Promise((resolve) => {
            client.destroy()
            isAuthenticated = false
            isAuthenticating = false
            resolve()
        })
    }

    /**
     * Send string based command to RCON server.
     * @param command {String} The RCON command to send to the server.
     * @returns {Promise}
     */
    function send(command) {
        return new Promise((resolve, reject) => {
            sendReject = reject
            sendResolve = resolve

            if (!isAuthenticated) {
                reject("RCON client not authenticated")
            }

            const commandPacket = createPacket(PACKET_TYPE.EXEC_COMMAND, command)
            client.write(commandPacket)
        })
    }

    return {
        connect,
        send,
        disconnect
    }
}

export default RCON
