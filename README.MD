## Subarashi
A lightweight IRC client.

Subarashi is an IRC client based off of [node-irc](https://github.com/bleakgadfly/node-irc) with similar API functions.

## Installation
`npm install subarashi`

## Usage
To get started with Subarashi, you can use this sample script:

```javascript
var Subarashi = require('subarashi');
var Client = new Subarashi.Client('<irc server>');

Client.on('ready', () => {
    console.log('Client connected!');
});

Client.connect();
```

This gives you a very basic user account called 'Subarashi' on the IRC server. A full documentation list can be found [here](https://lewistehminerz.github.io/Subarashi).