const net = require('net'),
    EventEmitter = require('events');

/**
 * A response object, built by {@link Client#assembleResponse}.
 * @typedef {object} response
 */

class Client extends EventEmitter {
    /**
     * Creates a new instance of the client.
     * @param {string} server The IRC server to connect to.
     * @param {number} [port=6667] The port for the IRC server.
     * @param {string} [nickname="Subarashi"] The nickname used for connecting.
     * @param {string} [realname="Subarashi IRC Client"] The real name of the client.
     * @param {string} [password=null] The password used to authenticate.
     * @param {number} [verbosity=1] The maximum verbosity level that can be logged from 0-4. Verbosity level 0 completely disables all output.
     * @param {boolean} [debug=false] Enable raw data logging messages.
     */
    constructor(server, port = 6667, nickname = "Subarashi", realname = "Subarashi IRC Client", password = null, verbosity = 1, debug = false) {
        super();
        this.host = server;
        this.port = port;
        this.nick = nickname;
        this.fullName = realname;
        this.password = password;
        this.verbosity = verbosity;
        this.debug = debug;
    }
    /**
     * Writes raw data to the IRC server.
     * @param {string} data The data to send.
     */
    writeRaw(data) {
        this.client.write(data + '\r\n');
    }  
    /**
     * Connect to the IRC server.
     */
    connect() {
        var client = net.createConnection({
            host: this.host,
            port: this.port
        });
        client.addListener('connect', () => {
            if (this.password) {
                this.writeRaw('PASS ' + this.password);
            }
            this.writeRaw('USER ' + this.nick + ' 0 * :' + this.fullName);
            this.writeRaw('NICK ' + this.nick);
            this.logger('Client connected to server', 1);
        });

        client.addListener('data', data => {
            if (this.debug) console.log(`Debug ==> ${data.toString()}`);
            this.dispatch(data.toString());
        });

        client.addListener('close', data => {
            this.logger('Disconnected from server', 1);
            this.emit('disconnected');
        });

        this.client = client;
    }
    /**
     * Handle data.
     * @param {string} data Data to handle.
     */
    dispatch(data) {
        let response = data.split('\n'),
            formatted,
            prepared,
            sorted;
        this.emit('rawdata', data);
        if (data.match('^PING')) {
            this.ping(data);
        } else {
            for (let i = response.length; i--;) {
                let raw = response[i].split(' ');
                if (raw[1] === '376') { // registration success or MOTD sent
                    this.emit('ready');
                } else {
                    this.handleEvents(this.assembleResponse(raw));
                }
            }
        }
    }
    /**
     * Handle events using a response object.
     * @param {response} data A response object.
     */
    handleEvents(data) {
        if (data.method === 'PRIVMSG') {
            data.message = data.message.join(' ');
            data.message = data.message.substring(1, data.message.length - 1);
            if (data.receiver.match(/^#/)) {
                data.method = 'CHANMSG';
            }
            this.emit('message', data);
        }
    }
    /**
     * Sends a PONG message back to the IRC server. Automatically handled by the library.
     * @param {string} response The response that the IRC server sent when sending a PING.
     */
    ping(response) {
        let split = response.split(' ');
        this.logger('PING ' + split[1], 2);
        this.logger('PONG ' + split[1], 2);
        this.writeRaw('PONG ' + split[1]);
    }
    /**
     * Joins a channel on the IRC server.
     * @param {string} channel The channel to join.
     */
    join(channel) {
        this.logger('JOIN ' + channel, 1);
        this.writeRaw('JOIN ' + channel);
    }
    /**
     * Leaves a channel on the IRC server.
     * @param {string} channel The channel to leave.
     */
    part(channel) {
        this.logger('PART ' + channel, 1);
        this.writeRaw('PART ' + channel);
    }
    /**
     * Disconnects the client from the server.
     * @param {string} [message="Quitting"] The message to send when quitting.
     */
    quit(message = "Quitting") {
        this.logger('QUIT ' + message, 2);
        this.writeRaw('QUIT : ' + message);
    }
    /**
     * Sends a message to a user or channel.
     * @param {string} receiver The receiver of the message. Either a user or channel.
     * @param {string} message The message to send.
     */
    say(receiver, message) {
        this.logger('PRIVMSG ' + receiver + ' ' + message, 2);
        this.writeRaw('PRIVMSG ' + receiver + ' :' + message);
    }
    /**
     * Sets the client's nickname.
     * @param {string} nickname The nickname to change to.
     */
    nick(nickname) {
        this.logger('NICK ' + nickname, 2);
        this.writeRaw('NICK ' + nickname);
    }
    /**
     * Kicks a user from a channel.
     * @param {string} channel The channel to kick the user from.
     * @param {string} nick The nickname of the user.
     * @param {string} reason The reason to kick the user out of the channel for.
     */
    kick(channel, nick, reason) {
        this.logger('KICK ' + channel + ' ' + nick + ' ' + reason, 2);
        this.client.write('KICK ' + channel + ' ' + nick + ' :' + reason + '\r\n');
    }
    /**
     * Logs messages.
     * @param {string} message Message to log.
     * @param {number} verbosity The verbosity level of the message.
     */
    logger(message, verbosity) {
        if ((this.verbosity !== 0) && (this.verbosity >= verbosity)) {
            console.log(`Log ==> ${message}`);
        }
    }
    /**
     * Assembles raw data into a response object.
     * @param {string} data The raw data to assemble into a response object.
     * @returns {response} The formatted response object.
     */
    assembleResponse(data) {
        let sender,
            formatUserhost,
            formatNick,
            formattedReturn,
            host,
            formatHost,
            shost,
            nick;
        // if sender is a nick!user@host, parse the nick
        try {
            formatUserhost = new RegExp(/\b[^]*(.*?)!/);
            nick = formatUserhost.exec(data[0]);
            formatNick = nick.join('');
            sender = formatNick.substring(0, formatNick.length - 1);
        } catch (e) {
            sender = undefined;
        }

        try {
            formatUserhost = new RegExp(/@\b[^]*(.*?)/);
            host = formatUserhost.exec(data[0].substr(1));
            formatHost = host.join('');
            shost = formatHost.substr(1);
        } catch (e) {
            shost = undefined;
        }

        return {
            method: data[1],
            receiver: data[2],
            sender: sender,
            message: data.slice(3),
            shost: shost
        };
    }
}

module.exports.Client = Client;