# Easy RCON
A very simple & easy-to-use RCON client for TCP based RCON servers.

## Installation
```js
npm install easy-rcon
yarn install easy-rcon
```

## Usage

**Example NodeJS Script**
```js
import RCON from "easy-rcon"

try {
    const rcon = RCON()
    rcon.connect(
        "127.0.0.1",
        27015,
        "YOUR_RCON_PASSWORD"
    )

    const response = rcon.send("info")
    console.log(response)
    rcon.disconnect()
} catch (error) {
    console.error(error)
}
```

**Connecting**

Connect to a remote RCON server using:

```js
rcon_client.connect(host, port, password)
```

**Sending Command**

Send a command to a remote RCON server using:

```js
rcon_client.send(command)
```

**Disconnecting**

Disconnect from the remote RCON server using:

```js
rcon_client.disconnect()
```

## Limitations
* Does not support multi-packet responses

## Roadmap
1. Implement support for multi-packet responses
2. Add game specific libraries (e.g. CS, Palword etc)